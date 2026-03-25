"""Conference presentation API: session management, SSE streaming, audience configuration."""

import asyncio
import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sse_starlette.sse import EventSourceResponse

from app.config import get_settings
from app.dependencies import get_current_user, get_db, require_role
from app.models.conference import ConferenceAudienceHcp
from app.models.session import CoachingSession
from app.models.user import User
from app.schemas.conference import (
    AudienceHcpCreate,
    AudienceHcpResponse,
    ConferenceMessageSend,
    ConferenceSessionCreate,
    ConferenceSessionResponse,
    ConferenceSubStateUpdate,
)
from app.services import conference_service
from app.services.turn_manager import turn_manager
from app.utils.exceptions import AppException, NotFoundException

settings = get_settings()

router = APIRouter(prefix="/conference", tags=["conference"])


# --- Session endpoints ---


@router.post("/sessions", response_model=ConferenceSessionResponse, status_code=201)
async def create_conference_session(
    request: ConferenceSessionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new conference-type coaching session."""
    session = await conference_service.create_conference_session(db, request.scenario_id, user.id)
    return session


@router.get("/sessions/{session_id}", response_model=ConferenceSessionResponse)
async def get_conference_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get conference session details."""
    result = await db.execute(select(CoachingSession).where(CoachingSession.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise NotFoundException("Session not found")
    if session.user_id != user.id:
        raise AppException(
            status_code=403, code="FORBIDDEN", message="Session does not belong to this user"
        )
    return session


@router.post("/sessions/{session_id}/stream")
async def stream_conference(
    session_id: str,
    request: ConferenceMessageSend,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """SSE endpoint for conference interaction.

    Supports two actions:
    - 'present': MR sends presentation text, receives HCP questions
    - 'respond': MR responds to a specific HCP question, receives follow-up
    """
    # Load session
    result = await db.execute(select(CoachingSession).where(CoachingSession.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise NotFoundException("Session not found")
    if session.user_id != user.id:
        raise AppException(
            status_code=403, code="FORBIDDEN", message="Session does not belong to this user"
        )
    if session.status not in ("created", "in_progress"):
        raise AppException(
            status_code=409, code="SESSION_CLOSED", message="Session is no longer active"
        )

    async def event_generator():
        heartbeat_task = None
        try:
            # Start heartbeat background task
            if request.action == "present":
                # MR is presenting -- save transcription, generate HCP questions
                await conference_service._save_conference_message(
                    db, session.id, "user", request.message
                )

                yield {
                    "event": "transcription",
                    "data": json.dumps(
                        {
                            "speaker": "MR",
                            "text": request.message,
                            "timestamp": _now_iso(),
                        }
                    ),
                }

                # Detect key messages
                from app.services.session_service import detect_key_messages

                km_status = await detect_key_messages(db, session, request.message)
                yield {"event": "key_messages", "data": json.dumps(km_status)}

                # Generate HCP questions sequentially
                questions = await conference_service.generate_hcp_questions(
                    db, session, request.message
                )

                # Send queue update for each new question
                if questions:
                    queue = turn_manager.get_queue(session.id)
                    yield {
                        "event": "queue_update",
                        "data": json.dumps(_serialize_queue(queue)),
                    }

                    # Send speaker_text events for each question
                    for q in questions:
                        yield {
                            "event": "speaker_text",
                            "data": json.dumps(
                                {
                                    "speaker_id": q.hcp_profile_id,
                                    "speaker_name": q.hcp_name,
                                    "content": q.question,
                                }
                            ),
                        }

                        # Save HCP question as message with speaker attribution
                        await conference_service._save_conference_message(
                            db,
                            session.id,
                            "assistant",
                            q.question,
                            speaker_id=q.hcp_profile_id,
                            speaker_name=q.hcp_name,
                        )

                        yield {
                            "event": "transcription",
                            "data": json.dumps(
                                {
                                    "speaker": q.hcp_name,
                                    "text": q.question,
                                    "timestamp": _now_iso(),
                                }
                            ),
                        }

                yield {"event": "done", "data": ""}

            elif request.action == "respond":
                if not request.target_hcp_id:
                    yield {
                        "event": "error",
                        "data": json.dumps({"message": "target_hcp_id is required for respond"}),
                    }
                    return

                # Stream HCP follow-up response
                async for event_data in conference_service.handle_respond(
                    db, session, request.target_hcp_id, request.message
                ):
                    yield event_data

                yield {"event": "done", "data": ""}

            else:
                yield {
                    "event": "error",
                    "data": json.dumps({"message": f"Unknown action: {request.action}"}),
                }
        finally:
            if heartbeat_task and not heartbeat_task.done():
                heartbeat_task.cancel()

    # Wrap the event generator with heartbeat support
    async def generator_with_heartbeat():
        heartbeat_stop = asyncio.Event()
        event_queue: asyncio.Queue[dict | None] = asyncio.Queue()

        async def produce_events():
            try:
                async for event in event_generator():
                    await event_queue.put(event)
            finally:
                await event_queue.put(None)  # sentinel

        async def produce_heartbeats():
            while not heartbeat_stop.is_set():
                await asyncio.sleep(15)
                if not heartbeat_stop.is_set():
                    await event_queue.put({"event": "heartbeat", "data": ""})

        event_task = asyncio.create_task(produce_events())
        heartbeat_task = asyncio.create_task(produce_heartbeats())

        try:
            while True:
                item = await event_queue.get()
                if item is None:
                    break
                yield item
        finally:
            heartbeat_stop.set()
            heartbeat_task.cancel()
            if not event_task.done():
                event_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass

    return EventSourceResponse(generator_with_heartbeat())


@router.patch("/sessions/{session_id}/sub-state")
async def update_sub_state(
    session_id: str,
    request: ConferenceSubStateUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Transition conference sub-state between presenting and qa."""
    # Verify ownership
    result = await db.execute(select(CoachingSession).where(CoachingSession.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise NotFoundException("Session not found")
    if session.user_id != user.id:
        raise AppException(
            status_code=403, code="FORBIDDEN", message="Session does not belong to this user"
        )

    await conference_service.transition_sub_state(db, session_id, request.sub_state)
    return {"sub_state": request.sub_state}


@router.post("/sessions/{session_id}/end", response_model=ConferenceSessionResponse)
async def end_conference_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """End a conference session and trigger scoring."""
    session = await conference_service.end_conference_session(db, session_id, user.id)
    return session


# --- Audience management endpoints ---


@router.get("/scenarios/{scenario_id}/audience", response_model=list[AudienceHcpResponse])
async def get_scenario_audience(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get audience HCPs for a conference scenario."""
    result = await db.execute(
        select(ConferenceAudienceHcp)
        .options(selectinload(ConferenceAudienceHcp.hcp_profile))
        .where(ConferenceAudienceHcp.scenario_id == scenario_id)
        .order_by(ConferenceAudienceHcp.sort_order)
    )
    audience_hcps = list(result.scalars().all())

    # Map to response with HCP profile info
    responses = []
    for ah in audience_hcps:
        resp = AudienceHcpResponse(
            id=ah.id,
            scenario_id=ah.scenario_id,
            hcp_profile_id=ah.hcp_profile_id,
            role_in_conference=ah.role_in_conference,
            voice_id=ah.voice_id,
            sort_order=ah.sort_order,
            hcp_name=ah.hcp_profile.name if ah.hcp_profile else "",
            hcp_specialty=ah.hcp_profile.specialty if ah.hcp_profile else "",
        )
        responses.append(resp)
    return responses


@router.put("/scenarios/{scenario_id}/audience", response_model=list[AudienceHcpResponse])
async def set_scenario_audience(
    scenario_id: str,
    audience: list[AudienceHcpCreate],
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Set audience HCPs for a conference scenario (admin only).

    Replaces all existing audience HCPs with the new list.
    """
    # Delete existing audience
    existing = await db.execute(
        select(ConferenceAudienceHcp).where(ConferenceAudienceHcp.scenario_id == scenario_id)
    )
    for item in existing.scalars().all():
        await db.delete(item)
    await db.flush()

    # Create new audience
    new_hcps = []
    for i, hcp_data in enumerate(audience):
        new_hcp = ConferenceAudienceHcp(
            scenario_id=scenario_id,
            hcp_profile_id=hcp_data.hcp_profile_id,
            role_in_conference=hcp_data.role_in_conference,
            voice_id=hcp_data.voice_id,
            sort_order=hcp_data.sort_order if hcp_data.sort_order else i,
        )
        db.add(new_hcp)
        new_hcps.append(new_hcp)

    await db.flush()

    # Reload with profile info
    result = await db.execute(
        select(ConferenceAudienceHcp)
        .options(selectinload(ConferenceAudienceHcp.hcp_profile))
        .where(ConferenceAudienceHcp.scenario_id == scenario_id)
        .order_by(ConferenceAudienceHcp.sort_order)
    )
    audience_hcps = list(result.scalars().all())

    responses = []
    for ah in audience_hcps:
        resp = AudienceHcpResponse(
            id=ah.id,
            scenario_id=ah.scenario_id,
            hcp_profile_id=ah.hcp_profile_id,
            role_in_conference=ah.role_in_conference,
            voice_id=ah.voice_id,
            sort_order=ah.sort_order,
            hcp_name=ah.hcp_profile.name if ah.hcp_profile else "",
            hcp_specialty=ah.hcp_profile.specialty if ah.hcp_profile else "",
        )
        responses.append(resp)
    return responses


# --- Helpers ---


def _now_iso() -> str:
    """Return current UTC time as ISO string."""
    from datetime import UTC, datetime

    return datetime.now(UTC).isoformat()


def _serialize_queue(queue: list) -> list[dict]:
    """Serialize question queue for SSE event data."""
    return [
        {
            "hcp_profile_id": q.hcp_profile_id,
            "hcp_name": q.hcp_name,
            "question": q.question,
            "relevance_score": q.relevance_score,
            "status": q.status,
        }
        for q in queue
    ]
