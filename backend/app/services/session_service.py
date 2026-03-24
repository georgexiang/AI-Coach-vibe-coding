"""Session lifecycle management: create, message, end, key message detection."""

import json
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.session import CoachingSession
from app.services.prompt_builder import build_key_message_detection_prompt
from app.utils.exceptions import AppException, NotFoundException


async def create_session(db: AsyncSession, scenario_id: str, user_id: str) -> CoachingSession:
    """Create a new coaching session for a scenario.

    Verifies the scenario exists and is active, initializes key_messages_status
    tracking from the scenario's key messages.
    """
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if scenario is None:
        raise NotFoundException("Scenario not found")
    if scenario.status != "active":
        raise AppException(
            status_code=409,
            code="SCENARIO_NOT_ACTIVE",
            message="Scenario is not active",
        )

    # Initialize key messages tracking
    key_messages = json.loads(scenario.key_messages)
    key_messages_status = [
        {"message": msg, "delivered": False, "detected_at": None} for msg in key_messages
    ]

    session = CoachingSession(
        user_id=user_id,
        scenario_id=scenario_id,
        status="created",
        key_messages_status=json.dumps(key_messages_status),
    )
    db.add(session)
    await db.flush()
    return session


async def get_session(db: AsyncSession, session_id: str, user_id: str) -> CoachingSession:
    """Fetch a session with eager-loaded scenario and HCP profile.

    Verifies the session belongs to the requesting user.
    """
    result = await db.execute(
        select(CoachingSession)
        .options(
            selectinload(CoachingSession.scenario).selectinload(Scenario.hcp_profile),
        )
        .where(CoachingSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise NotFoundException("Session not found")
    if session.user_id != user_id:
        raise AppException(
            status_code=403,
            code="FORBIDDEN",
            message="Session does not belong to this user",
        )
    return session


async def get_user_sessions(
    db: AsyncSession, user_id: str, page: int = 1, page_size: int = 20
) -> tuple[list[CoachingSession], int]:
    """List a user's sessions with pagination, ordered by created_at desc."""
    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(CoachingSession).where(CoachingSession.user_id == user_id)
    )
    total = count_result.scalar_one()

    # Fetch page
    offset = (page - 1) * page_size
    result = await db.execute(
        select(CoachingSession)
        .where(CoachingSession.user_id == user_id)
        .order_by(CoachingSession.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    sessions = list(result.scalars().all())
    return sessions, total


async def get_active_session(db: AsyncSession, user_id: str) -> CoachingSession | None:
    """Get the user's currently active (in_progress) session, if any."""
    result = await db.execute(
        select(CoachingSession)
        .options(
            selectinload(CoachingSession.scenario).selectinload(Scenario.hcp_profile),
        )
        .where(
            CoachingSession.user_id == user_id,
            CoachingSession.status == "in_progress",
        )
        .order_by(CoachingSession.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def save_message(
    db: AsyncSession, session_id: str, role: str, content: str
) -> SessionMessage:
    """Save a message to a coaching session.

    If this is the first user message and session is 'created',
    transitions the session to 'in_progress' and sets started_at.
    """
    # Count existing messages to determine message_index
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


async def end_session(db: AsyncSession, session_id: str, user_id: str) -> CoachingSession:
    """End a coaching session, transitioning from in_progress to completed.

    Calculates duration_seconds from started_at to now.
    """
    result = await db.execute(select(CoachingSession).where(CoachingSession.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise NotFoundException("Session not found")
    if session.user_id != user_id:
        raise AppException(
            status_code=403,
            code="FORBIDDEN",
            message="Session does not belong to this user",
        )
    if session.status != "in_progress":
        raise AppException(
            status_code=409,
            code="INVALID_STATUS",
            message=f"Cannot end session with status '{session.status}'. "
            "Only in_progress sessions can be ended.",
        )

    now = datetime.now(UTC)
    session.status = "completed"
    session.completed_at = now
    if session.started_at:
        session.duration_seconds = int((now - session.started_at).total_seconds())

    await db.flush()
    return session


async def get_session_messages(db: AsyncSession, session_id: str) -> list[SessionMessage]:
    """Return all messages for a session ordered by message_index."""
    result = await db.execute(
        select(SessionMessage)
        .where(SessionMessage.session_id == session_id)
        .order_by(SessionMessage.message_index)
    )
    return list(result.scalars().all())


async def detect_key_messages(
    db: AsyncSession, session: CoachingSession, mr_message: str
) -> list[dict]:
    """Detect which key messages the MR delivered in their latest message.

    Uses simple keyword matching for mock adapter. Updates session's
    key_messages_status with detected changes.
    """
    current_status = json.loads(session.key_messages_status)
    key_messages = [item["message"] for item in current_status]

    if not key_messages:
        return current_status

    # Get conversation history for context
    messages = await get_session_messages(db, session.id)
    conversation_history = [{"role": msg.role, "content": msg.content} for msg in messages]

    # Simple keyword matching for mock/fallback detection
    detected = _mock_key_message_detection(key_messages, mr_message, conversation_history)

    # Update status for detected messages
    now_str = datetime.now(UTC).isoformat()
    for item in current_status:
        if not item["delivered"] and item["message"] in detected:
            item["delivered"] = True
            item["detected_at"] = now_str

    session.key_messages_status = json.dumps(current_status)
    await db.flush()
    return current_status


def _mock_key_message_detection(
    key_messages: list[str], mr_message: str, conversation_history: list[dict]
) -> list[str]:
    """Simple keyword-based detection for mock/fallback key message matching.

    Checks if significant keywords from each key message appear in the MR's
    message or recent conversation.
    """
    # Build detection prompt for reference (used when real LLM is available)
    _prompt = build_key_message_detection_prompt(key_messages, mr_message, conversation_history)

    detected = []
    mr_lower = mr_message.lower()

    for key_msg in key_messages:
        # Split into significant words (>3 chars) and check keyword overlap
        words = [w.lower() for w in key_msg.split() if len(w) > 3]
        if not words:
            continue
        # Require at least 40% of significant words to match
        matched = sum(1 for w in words if w in mr_lower)
        threshold = max(1, len(words) * 0.4)
        if matched >= threshold:
            detected.append(key_msg)

    return detected
