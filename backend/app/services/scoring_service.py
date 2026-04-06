"""Post-session scoring service: multi-dimensional analysis and feedback."""

import json
import logging
import random

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.score import ScoreDetail, SessionScore
from app.models.session import CoachingSession
from app.services.rubric_service import get_default_rubric
from app.services.scoring_engine import score_with_llm
from app.utils.exceptions import AppException, NotFoundException

logger = logging.getLogger(__name__)


async def score_session(db: AsyncSession, session_id: str) -> SessionScore:
    """Score a completed coaching session with multi-dimensional analysis.

    Verifies session is 'completed' (not created, in_progress, or already scored),
    generates scoring via mock adapter, saves results, and updates session status.
    """
    # Load session with scenario and HCP profile
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

    if session.status == "scored":
        raise AppException(
            status_code=409,
            code="ALREADY_SCORED",
            message="Session has already been scored",
        )
    if session.status != "completed":
        raise AppException(
            status_code=409,
            code="INVALID_STATUS",
            message=f"Cannot score session with status '{session.status}'. "
            "Session must be completed first.",
        )

    # Load messages
    msg_result = await db.execute(
        select(SessionMessage)
        .where(SessionMessage.session_id == session_id)
        .order_by(SessionMessage.message_index)
    )
    messages = list(msg_result.scalars().all())

    # Get scenario and key messages status
    scenario = session.scenario
    key_messages_status = json.loads(session.key_messages_status)

    # Check for default rubric to override scenario weights
    rubric = await get_default_rubric(db, scenario.mode if hasattr(scenario, "mode") else "f2f")
    if rubric is not None:
        rubric_dims = json.loads(rubric.dimensions)
        rubric_weights = {d["name"]: d["weight"] for d in rubric_dims}
    else:
        rubric_weights = None

    # Build data for scoring engine
    weights = rubric_weights if rubric_weights else scenario.get_scoring_weights()
    hcp_profile_data = {}
    if scenario.hcp_profile:
        hcp_profile_data = {
            "name": scenario.hcp_profile.name,
            "specialty": scenario.hcp_profile.specialty,
            "personality_type": scenario.hcp_profile.personality_type,
            "communication_style": scenario.hcp_profile.communication_style,
        }
    scenario_data = {
        "product": scenario.product,
        "therapeutic_area": scenario.therapeutic_area,
        "difficulty": scenario.difficulty,
        "key_messages": scenario.key_messages,
        "hcp_profile": hcp_profile_data,
    }
    message_dicts = [{"role": m.role, "content": m.content} for m in messages]

    # Try LLM scoring first, fall back to mock if unavailable
    scores = await score_with_llm(
        db, scenario_data, message_dicts, key_messages_status,
        weights, scenario.pass_threshold,
    )
    if scores is None:
        logger.info("LLM scoring unavailable for session %s, using mock fallback", session_id)
        scores = _generate_mock_scores(
            scenario, messages, key_messages_status, rubric_weights=rubric_weights
        )

    # Create SessionScore
    session_score = SessionScore(
        session_id=session_id,
        overall_score=scores["overall_score"],
        passed=scores["passed"],
        feedback_summary=scores["feedback_summary"],
    )
    db.add(session_score)
    await db.flush()

    # Create ScoreDetail records
    for dim_data in scores["dimensions"]:
        detail = ScoreDetail(
            score_id=session_score.id,
            dimension=dim_data["dimension"],
            score=dim_data["score"],
            weight=dim_data["weight"],
            strengths=json.dumps(dim_data["strengths"]),
            weaknesses=json.dumps(dim_data["weaknesses"]),
            suggestions=json.dumps(dim_data["suggestions"]),
        )
        db.add(detail)

    # Update session status
    session.status = "scored"
    session.overall_score = scores["overall_score"]
    session.passed = scores["passed"]

    await db.flush()

    # Reload score with details for response
    score_result = await db.execute(
        select(SessionScore)
        .options(selectinload(SessionScore.details))
        .where(SessionScore.id == session_score.id)
    )
    return score_result.scalar_one()


async def get_session_score(db: AsyncSession, session_id: str) -> SessionScore | None:
    """Fetch the SessionScore with eager-loaded ScoreDetail for a session.

    Returns None if the session has not been scored yet.
    """
    result = await db.execute(
        select(SessionScore)
        .options(selectinload(SessionScore.details))
        .where(SessionScore.session_id == session_id)
    )
    return result.scalar_one_or_none()


async def get_score_history(db: AsyncSession, user_id: str, limit: int = 10) -> list[dict]:
    """Return last N scored sessions with dimension scores and trend data.

    For each session, computes improvement_pct per dimension by comparing
    with the previous (older) session's scores.
    """
    # Load scored sessions with score + details in a single query (fix N+1)
    result = await db.execute(
        select(CoachingSession)
        .options(
            selectinload(CoachingSession.scenario),
            selectinload(CoachingSession.score).selectinload(SessionScore.details),
        )
        .where(
            CoachingSession.user_id == user_id,
            CoachingSession.status == "scored",
        )
        .order_by(CoachingSession.completed_at.desc())
        .limit(limit)
    )
    sessions = list(result.scalars().all())

    if not sessions:
        return []

    # Build history entries with dimension details
    history: list[dict] = []
    for session in sessions:
        score = session.score
        if score is None:
            continue

        dimensions = [
            {
                "dimension": detail.dimension,
                "score": detail.score,
                "weight": detail.weight,
            }
            for detail in score.details
        ]

        history.append(
            {
                "session_id": session.id,
                "scenario_name": session.scenario.name if session.scenario else "",
                "overall_score": score.overall_score,
                "passed": score.passed,
                "completed_at": (
                    session.completed_at.isoformat() if session.completed_at else None
                ),
                "dimensions": dimensions,
            }
        )

    # Compute trends: compare each entry with the next (older) one
    for i, entry in enumerate(history):
        next_entry = history[i + 1] if i + 1 < len(history) else None
        if next_entry is None:
            # Oldest session — no previous to compare
            for dim in entry["dimensions"]:
                dim["improvement_pct"] = None
        else:
            # Build lookup for previous session dimensions
            prev_dims = {d["dimension"]: d["score"] for d in next_entry["dimensions"]}
            for dim in entry["dimensions"]:
                prev_score = prev_dims.get(dim["dimension"])
                if prev_score is not None:
                    dim["improvement_pct"] = round(dim["score"] - prev_score, 1)
                else:
                    dim["improvement_pct"] = None

    return history


def _generate_mock_scores(
    scenario: Scenario,
    messages: list[SessionMessage],
    key_messages_status: list[dict],
    rubric_weights: dict | None = None,
) -> dict:
    """Generate realistic-looking mock scores for development/testing.

    Produces scores between 60-95 with personality-appropriate feedback,
    strengths with transcript quotes, weaknesses referencing missed key messages,
    and actionable suggestions per dimension.

    If rubric_weights is provided, uses those weights instead of scenario weights.
    """
    weights = rubric_weights if rubric_weights else scenario.get_scoring_weights()
    key_messages = json.loads(scenario.key_messages)

    # Determine delivered/missed key messages
    delivered = [km for km in key_messages_status if km.get("delivered")]
    missed = [km for km in key_messages_status if not km.get("delivered")]
    delivery_ratio = len(delivered) / max(len(key_messages_status), 1)

    # Collect MR quotes for referencing in strengths
    mr_quotes = [msg.content for msg in messages if msg.role == "user"]
    sample_quote = mr_quotes[0] if mr_quotes else "Thank you for your time."

    # Generate dimension scores (slightly randomized but realistic)
    base_score = 65 + int(delivery_ratio * 25)  # 65-90 range based on delivery
    dimensions = []

    # 1. Key Message Delivery
    km_score = min(95, max(60, base_score + random.randint(-5, 10)))
    km_strengths = []
    km_weaknesses = []
    if delivered:
        km_strengths.append(
            {
                "text": (
                    f"Successfully delivered {len(delivered)} of {len(key_messages)} key messages"
                ),
                "quote": sample_quote[:100] if sample_quote else None,
            }
        )
    if missed:
        for m in missed[:2]:
            km_weaknesses.append(
                {
                    "text": f"Missed key message: {m['message']}",
                    "quote": None,
                }
            )
    dimensions.append(
        {
            "dimension": "key_message",
            "score": km_score,
            "weight": weights["key_message"],
            "strengths": km_strengths,
            "weaknesses": km_weaknesses,
            "suggestions": [
                "Prepare a structured approach to ensure all key messages are covered",
                "Practice transitioning between key messages naturally",
            ],
        }
    )

    # 2. Objection Handling
    oh_score = min(95, max(60, base_score + random.randint(-8, 8)))
    dimensions.append(
        {
            "dimension": "objection_handling",
            "score": oh_score,
            "weight": weights["objection_handling"],
            "strengths": [
                {
                    "text": "Showed willingness to address HCP concerns",
                    "quote": sample_quote[:80] if len(mr_quotes) > 1 else None,
                }
            ],
            "weaknesses": [
                {
                    "text": (
                        "Could provide more specific clinical evidence when addressing objections"
                    ),
                    "quote": None,
                }
            ],
            "suggestions": [
                "Prepare specific study references for common objections",
                "Acknowledge the HCP's concern before presenting counter-evidence",
            ],
        }
    )

    # 3. Communication Skills
    comm_score = min(95, max(60, base_score + random.randint(-5, 12)))
    dimensions.append(
        {
            "dimension": "communication",
            "score": comm_score,
            "weight": weights["communication"],
            "strengths": [
                {
                    "text": "Maintained professional tone throughout the conversation",
                    "quote": None,
                }
            ],
            "weaknesses": [
                {
                    "text": "Could improve active listening by referencing HCP's specific points",
                    "quote": None,
                }
            ],
            "suggestions": [
                "Use reflective listening techniques to show understanding",
                "Adapt communication style to match the HCP's preferences",
            ],
        }
    )

    # 4. Product Knowledge
    pk_score = min(95, max(60, base_score + random.randint(-3, 10)))
    dimensions.append(
        {
            "dimension": "product_knowledge",
            "score": pk_score,
            "weight": weights["product_knowledge"],
            "strengths": [
                {
                    "text": f"Demonstrated familiarity with {scenario.product}",
                    "quote": None,
                }
            ],
            "weaknesses": [
                {
                    "text": "Could provide more specific dosing and administration details",
                    "quote": None,
                }
            ],
            "suggestions": [
                "Study the full prescribing information for detailed questions",
                f"Prepare comparison data between {scenario.product} and competitors",
            ],
        }
    )

    # 5. Scientific Information
    si_score = min(95, max(60, base_score + random.randint(-10, 5)))
    dimensions.append(
        {
            "dimension": "scientific_info",
            "score": si_score,
            "weight": weights["scientific_info"],
            "strengths": [
                {
                    "text": "Referenced relevant clinical data during discussion",
                    "quote": None,
                }
            ],
            "weaknesses": [
                {
                    "text": "Should cite specific study names, patient populations, and endpoints",
                    "quote": None,
                }
            ],
            "suggestions": [
                "Memorize 2-3 key pivotal trial results with specific numbers",
                "Prepare visual aids summarizing clinical evidence",
            ],
        }
    )

    # Calculate weighted overall score
    overall_score = sum(dim["score"] * dim["weight"] / 100 for dim in dimensions)
    overall_score = round(overall_score, 1)
    passed = overall_score >= scenario.pass_threshold

    # Generate feedback summary
    if passed:
        feedback_summary = (
            f"Good performance with an overall score of {overall_score}. "
            f"Successfully delivered {len(delivered)} of {len(key_messages)} key messages. "
            "Focus on strengthening objection handling and scientific evidence for improvement."
        )
    else:
        feedback_summary = (
            f"Score of {overall_score} is below the passing threshold of "
            f"{scenario.pass_threshold}. "
            f"Delivered {len(delivered)} of {len(key_messages)} key messages. "
            "Review key message coverage and practice objection handling techniques."
        )

    return {
        "overall_score": overall_score,
        "passed": passed,
        "feedback_summary": feedback_summary,
        "dimensions": dimensions,
    }
