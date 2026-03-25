"""Conference session orchestration: create, question generation, respond, score."""

import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conference import ConferenceAudienceHcp
from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.session import CoachingSession
from app.services.agents.base import CoachEventType, CoachRequest
from app.services.agents.registry import registry
from app.services.prompt_builder import build_conference_audience_prompt
from app.services.turn_manager import QueuedQuestion, turn_manager
from app.utils.exceptions import AppException, NotFoundException


async def create_conference_session(
    db: AsyncSession, scenario_id: str, user_id: str
) -> CoachingSession:
    """Create a conference session with multi-HCP audience setup.

    Verifies the scenario is conference mode, loads audience HCPs,
    and initializes session with audience_config and key_messages_status.
    """
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if scenario is None:
        raise NotFoundException("Scenario not found")
    if scenario.mode != "conference":
        raise AppException(
            status_code=409,
            code="NOT_CONFERENCE_SCENARIO",
            message="Scenario is not configured for conference mode",
        )

    # Load audience HCPs with profile data
    audience_result = await db.execute(
        select(ConferenceAudienceHcp)
        .options(selectinload(ConferenceAudienceHcp.hcp_profile))
        .where(ConferenceAudienceHcp.scenario_id == scenario_id)
        .order_by(ConferenceAudienceHcp.sort_order)
    )
    audience_hcps = list(audience_result.scalars().all())
    if len(audience_hcps) < 2:
        raise AppException(
            status_code=409,
            code="INSUFFICIENT_AUDIENCE",
            message="Conference scenario needs at least 2 HCP audience members",
        )

    # Build audience config JSON from HCP profiles
    audience_config = [
        {
            "hcp_profile_id": ah.hcp_profile_id,
            "name": ah.hcp_profile.name,
            "specialty": ah.hcp_profile.specialty,
            "personality_type": ah.hcp_profile.personality_type,
            "role": ah.role_in_conference,
            "voice_id": ah.voice_id,
        }
        for ah in audience_hcps
    ]

    # Initialize key messages tracking
    key_messages = json.loads(scenario.key_messages)
    key_messages_status = [
        {"message": msg, "delivered": False, "detected_at": None} for msg in key_messages
    ]

    session = CoachingSession(
        user_id=user_id,
        scenario_id=scenario_id,
        status="created",
        session_type="conference",
        sub_state="presenting",
        presentation_topic=scenario.description,
        audience_config=json.dumps(audience_config),
        key_messages_status=json.dumps(key_messages_status),
    )
    db.add(session)
    await db.flush()
    return session


async def generate_hcp_questions(
    db: AsyncSession, session: CoachingSession, mr_text: str
) -> list[QueuedQuestion]:
    """Generate HCP questions sequentially (not parallel, per RESEARCH Pitfall 4).

    For each HCP in the audience, builds a conference prompt and calls LLM
    to generate a question. Questions are queued in turn_manager.
    """
    audience_config = json.loads(session.audience_config or "[]")
    if not audience_config:
        return []

    # Load scenario for context
    scenario_result = await db.execute(select(Scenario).where(Scenario.id == session.scenario_id))
    scenario = scenario_result.scalar_one_or_none()

    # Get conversation history
    msg_result = await db.execute(
        select(SessionMessage)
        .where(SessionMessage.session_id == session.id)
        .order_by(SessionMessage.message_index)
    )
    messages = list(msg_result.scalars().all())
    conversation_history = [
        {"role": msg.role, "content": msg.content, "speaker_name": msg.speaker_name}
        for msg in messages
    ]

    # Get LLM adapter
    from app.config import get_settings

    settings = get_settings()
    adapter = registry.get("llm", settings.default_llm_provider)

    generated_questions: list[QueuedQuestion] = []
    other_hcp_questions: list[dict] = []

    # Generate questions sequentially -- each HCP sees prior HCPs' questions
    for hcp_config in audience_config:
        hcp_prompt = build_conference_audience_prompt(
            hcp_config=hcp_config,
            scenario=scenario,
            presentation_topic=session.presentation_topic or "",
            conversation_history=conversation_history,
            other_hcp_questions=other_hcp_questions,
        )

        question_text = ""
        if adapter is not None:
            coach_request = CoachRequest(
                session_id=session.id,
                message=mr_text,
                scenario_context=hcp_prompt,
                hcp_profile=hcp_config,
            )
            async for event in adapter.execute(coach_request):
                if event.type == CoachEventType.TEXT:
                    question_text += event.content
                elif event.type == CoachEventType.DONE:
                    break

        # Skip empty questions (HCP chose not to ask)
        question_text = question_text.strip()
        if not question_text or question_text.lower() in ("", "none", "no question"):
            continue

        # Assign relevance score based on simple keyword matching (mock heuristic)
        relevance_score = _compute_relevance_score(question_text, mr_text)

        queued = QueuedQuestion(
            hcp_profile_id=hcp_config["hcp_profile_id"],
            hcp_name=hcp_config["name"],
            question=question_text,
            relevance_score=relevance_score,
            queued_at=datetime.now(UTC),
        )
        turn_manager.add_question(session.id, queued)
        generated_questions.append(queued)

        # Track for subsequent HCPs to avoid duplicates
        other_hcp_questions.append({"hcp_name": hcp_config["name"], "question": question_text})

    return generated_questions


async def handle_respond(
    db: AsyncSession, session: CoachingSession, hcp_id: str, mr_response: str
) -> AsyncIterator[dict]:
    """Handle MR responding to a specific HCP's question.

    Activates the question in turn_manager, saves the MR response,
    generates and streams HCP follow-up with speaker attribution.
    """
    # Activate question in turn_manager
    activated = turn_manager.activate_question(session.id, hcp_id)
    if activated is None:
        yield {
            "event": "error",
            "data": json.dumps({"message": "No waiting question from this HCP"}),
        }
        return

    # Save MR response
    await _save_conference_message(db, session.id, "user", mr_response)

    # Find HCP config for speaker attribution
    audience_config = json.loads(session.audience_config or "[]")
    hcp_config = next((h for h in audience_config if h["hcp_profile_id"] == hcp_id), None)
    hcp_name = hcp_config["name"] if hcp_config else "HCP"

    # Build follow-up prompt for target HCP
    scenario_result = await db.execute(select(Scenario).where(Scenario.id == session.scenario_id))
    scenario = scenario_result.scalar_one_or_none()

    msg_result = await db.execute(
        select(SessionMessage)
        .where(SessionMessage.session_id == session.id)
        .order_by(SessionMessage.message_index)
    )
    messages = list(msg_result.scalars().all())
    conversation_history = [
        {"role": msg.role, "content": msg.content, "speaker_name": msg.speaker_name}
        for msg in messages
    ]

    hcp_prompt = build_conference_audience_prompt(
        hcp_config=hcp_config or {},
        scenario=scenario,
        presentation_topic=session.presentation_topic or "",
        conversation_history=conversation_history,
        other_hcp_questions=[],
    )

    from app.config import get_settings

    settings = get_settings()
    adapter = registry.get("llm", settings.default_llm_provider)

    if adapter is None:
        yield {"event": "error", "data": json.dumps({"message": "No LLM adapter available"})}
        return

    # Yield turn_change event
    yield {
        "event": "turn_change",
        "data": json.dumps({"speaker_id": hcp_id, "speaker_name": hcp_name, "action": "asking"}),
    }

    # Stream HCP follow-up response
    full_response = ""
    coach_request = CoachRequest(
        session_id=session.id,
        message=mr_response,
        scenario_context=hcp_prompt,
        hcp_profile=hcp_config,
    )

    async for event in adapter.execute(coach_request):
        if event.type == CoachEventType.TEXT:
            full_response += event.content
            yield {
                "event": "speaker_text",
                "data": json.dumps(
                    {
                        "speaker_id": hcp_id,
                        "speaker_name": hcp_name,
                        "content": event.content,
                    }
                ),
            }
        elif event.type == CoachEventType.DONE:
            break

    # Save HCP response with speaker attribution
    await _save_conference_message(
        db,
        session.id,
        "assistant",
        full_response,
        speaker_id=hcp_id,
        speaker_name=hcp_name,
    )

    # Mark question as answered
    turn_manager.mark_answered(session.id, hcp_id)

    yield {
        "event": "turn_change",
        "data": json.dumps({"speaker_id": hcp_id, "speaker_name": hcp_name, "action": "listening"}),
    }

    # Send updated queue
    queue = turn_manager.get_queue(session.id)
    yield {
        "event": "queue_update",
        "data": json.dumps(_serialize_queue(queue)),
    }


async def transition_sub_state(db: AsyncSession, session_id: str, new_state: str) -> None:
    """Update conference session sub_state (presenting or qa)."""
    result = await db.execute(select(CoachingSession).where(CoachingSession.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise NotFoundException("Session not found")
    session.sub_state = new_state
    await db.flush()


async def end_conference_session(
    db: AsyncSession, session_id: str, user_id: str
) -> CoachingSession:
    """End a conference session, trigger scoring, and cleanup turn_manager.

    Sets status to completed, calculates duration, and cleans up in-memory state.
    """
    result = await db.execute(select(CoachingSession).where(CoachingSession.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise NotFoundException("Session not found")
    if session.user_id != user_id:
        raise AppException(
            status_code=403, code="FORBIDDEN", message="Session does not belong to this user"
        )
    if session.status not in ("created", "in_progress"):
        raise AppException(
            status_code=409,
            code="INVALID_STATUS",
            message=f"Cannot end session with status '{session.status}'",
        )

    now = datetime.now(UTC)
    session.status = "completed"
    session.completed_at = now
    if session.started_at:
        started = session.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=UTC)
        session.duration_seconds = int((now - started).total_seconds())

    # Cleanup turn_manager in-memory state
    turn_manager.cleanup_session(session_id)

    await db.flush()
    await db.refresh(session)

    # Trigger scoring via existing scoring_service
    from app.services.scoring_service import score_session

    try:
        await score_session(db, session_id)
    except AppException:
        # Scoring may fail if no messages exist; don't block session end
        pass

    return session


async def _save_conference_message(
    db: AsyncSession,
    session_id: str,
    role: str,
    content: str,
    speaker_id: str | None = None,
    speaker_name: str = "",
) -> SessionMessage:
    """Save a conference message with speaker attribution.

    Handles message_index counting and session state transitions.
    """
    count_result = await db.execute(
        select(func.count())
        .select_from(SessionMessage)
        .where(SessionMessage.session_id == session_id)
    )
    message_index = count_result.scalar_one()

    message = SessionMessage(
        session_id=session_id,
        role=role,
        content=content,
        message_index=message_index,
        speaker_id=speaker_id,
        speaker_name=speaker_name,
    )
    db.add(message)

    # Transition created -> in_progress on first user message
    if role == "user" and message_index == 0:
        result = await db.execute(select(CoachingSession).where(CoachingSession.id == session_id))
        session = result.scalar_one_or_none()
        if session and session.status == "created":
            session.status = "in_progress"
            session.started_at = datetime.now(UTC)

    await db.flush()
    return message


def _compute_relevance_score(question: str, mr_text: str) -> float:
    """Compute a simple relevance score based on keyword overlap (mock heuristic).

    Real implementation would use LLM-based scoring.
    """
    question_words = set(question.lower().split())
    mr_words = set(mr_text.lower().split())
    if not question_words or not mr_words:
        return 0.5
    overlap = len(question_words & mr_words)
    max_possible = min(len(question_words), len(mr_words))
    if max_possible == 0:
        return 0.5
    return round(0.3 + 0.7 * (overlap / max_possible), 2)


def _serialize_queue(queue: list[QueuedQuestion]) -> list[dict]:
    """Serialize question queue for SSE transmission."""
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
