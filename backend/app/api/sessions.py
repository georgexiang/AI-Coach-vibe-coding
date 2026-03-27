"""Session lifecycle API: create, message with SSE streaming, end, list."""

import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.config import get_settings
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.report import SessionReport
from app.schemas.session import (
    MessageResponse,
    SendMessageRequest,
    SessionCreate,
    SessionResponse,
)
from app.schemas.suggestion import SuggestionResponse
from app.services import material_service, session_service
from app.services.agents.base import CoachEventType, CoachRequest
from app.services.agents.registry import registry
from app.services.prompt_builder import build_hcp_system_prompt
from app.services.report_service import generate_report
from app.services.suggestion_service import generate_suggestions, parse_key_messages_status
from app.utils.exceptions import AppException
from app.utils.pagination import PaginatedResponse

settings = get_settings()

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    request: SessionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new coaching session for a scenario."""
    # Enforce feature flag server-side: reject voice/avatar modes when voice_live is disabled
    if request.mode in ("voice", "avatar") and not settings.feature_voice_live_enabled:
        raise AppException(
            status_code=409,
            code="VOICE_MODE_DISABLED",
            message="Voice and avatar modes are not available. "
            "Voice Live is not enabled by the administrator.",
        )
    session = await session_service.create_session(db, request.scenario_id, user.id, request.mode)
    return session


@router.get("", response_model=PaginatedResponse[SessionResponse])
async def list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List the current user's coaching sessions."""
    sessions, total = await session_service.get_user_sessions(db, user.id, page, page_size)
    return PaginatedResponse.create(sessions, total, page, page_size)


# Static route BEFORE parameterized /{session_id} per Gotcha #3
@router.get("/active", response_model=SessionResponse | None)
async def get_active_session(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the user's currently active (in_progress) session."""
    session = await session_service.get_active_session(db, user.id)
    if session is None:
        raise AppException(
            status_code=404,
            code="NO_ACTIVE_SESSION",
            message="No active session found",
        )
    return session


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific coaching session with details."""
    session = await session_service.get_session(db, session_id, user.id)
    return session


@router.post("/{session_id}/message")
async def send_message(
    session_id: str,
    request: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Send MR message and stream HCP response via SSE."""
    session = await session_service.get_session(db, session_id, user.id)
    # Reject if session is not active (COACH-09 immutability)
    if session.status not in ("created", "in_progress"):
        raise AppException(
            status_code=409,
            code="SESSION_CLOSED",
            message="Session is no longer active",
        )

    # Save MR message (transitions created -> in_progress)
    await session_service.save_message(db, session_id, "user", request.message)

    async def event_generator():
        # Get LLM adapter
        adapter = registry.get("llm", settings.default_llm_provider)
        if adapter is None:
            yield {
                "event": "error",
                "data": "No LLM adapter available",
            }
            return

        # Build HCP system prompt
        key_messages = json.loads(session.scenario.key_messages)

        # Inject training material context for RAG (CONTENT-02)
        material_ctx = await material_service.get_material_context(
            db, product=session.scenario.product, limit=20
        )

        hcp_prompt = build_hcp_system_prompt(
            session.scenario.hcp_profile,
            session.scenario,
            key_messages,
            material_context=material_ctx if material_ctx else None,
        )

        # Fetch conversation history for multi-turn dialogue
        history_messages = await session_service.get_session_messages(db, session_id)
        conversation_history = [{"role": m.role, "content": m.content} for m in history_messages]

        # Build coach request
        hcp_dict = None
        if session.scenario.hcp_profile:
            hcp_dict = session.scenario.hcp_profile.to_prompt_dict()

        coach_request = CoachRequest(
            session_id=session_id,
            message=request.message,
            scenario_context=hcp_prompt,
            hcp_profile=hcp_dict,
            scoring_criteria=(session.scenario.get_scoring_weights()),
            conversation_history=conversation_history,
        )

        full_response = ""
        async for event in adapter.execute(coach_request):
            if event.type == CoachEventType.TEXT:
                full_response += event.content
                yield {
                    "event": "text",
                    "data": event.content,
                }
            elif event.type == CoachEventType.SUGGESTION:
                yield {
                    "event": "hint",
                    "data": json.dumps(
                        {
                            "content": event.content,
                            "metadata": event.metadata,
                        }
                    ),
                }
            elif event.type == CoachEventType.DONE:
                # Save complete HCP response
                await session_service.save_message(db, session_id, "assistant", full_response)
                # Key message detection (D-03)
                km_status = await session_service.detect_key_messages(db, session, request.message)
                yield {
                    "event": "key_messages",
                    "data": json.dumps(km_status),
                }
                # Generate real-time coaching suggestions (COACH-08)
                km_status_list = parse_key_messages_status(session.key_messages_status)
                messages_for_hints = await session_service.get_session_messages(db, session_id)
                msg_dicts = [{"role": m.role, "content": m.content} for m in messages_for_hints]
                suggestions = await generate_suggestions(
                    messages=msg_dicts,
                    key_messages_status=km_status_list,
                    scoring_weights=session.scenario.get_scoring_weights(),
                )
                for suggestion in suggestions:
                    yield {
                        "event": "hint",
                        "data": json.dumps(
                            {
                                "content": suggestion.message,
                                "metadata": {
                                    "type": suggestion.type.value,
                                    "trigger": suggestion.trigger,
                                    "relevance": suggestion.relevance_score,
                                },
                            }
                        ),
                    }
                yield {"event": "done", "data": ""}

    return EventSourceResponse(event_generator())


@router.post("/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """End a coaching session (manual end)."""
    session = await session_service.end_session(db, session_id, user.id)
    return session


@router.get(
    "/{session_id}/messages",
    response_model=list[MessageResponse],
)
async def get_session_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all messages for a coaching session."""
    # Verify access
    await session_service.get_session(db, session_id, user.id)
    messages = await session_service.get_session_messages(db, session_id)
    return messages


@router.get("/{session_id}/report", response_model=SessionReport)
async def get_session_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a detailed post-session report for a scored session."""
    # Verify session belongs to user
    await session_service.get_session(db, session_id, user.id)
    report = await generate_report(db, session_id)
    return report


@router.get("/{session_id}/suggestions", response_model=list[SuggestionResponse])
async def get_session_suggestions(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get coaching suggestions for a session (regenerated on demand)."""
    session = await session_service.get_session(db, session_id, user.id)
    messages = await session_service.get_session_messages(db, session_id)
    msg_dicts = [{"role": m.role, "content": m.content} for m in messages]
    km_status_list = parse_key_messages_status(session.key_messages_status)
    suggestions = await generate_suggestions(
        messages=msg_dicts,
        key_messages_status=km_status_list,
        scoring_weights=session.scenario.get_scoring_weights(),
    )
    return suggestions
