"""Voice quality scoring service using Azure Content Understanding.

Calls CU audioAnalyzer to analyze recorded audio for voice-specific dimensions:
fluency, tone, pace, pronunciation clarity.
No mock fallback — failures set voice_score_status = "failed".
Uses durable background task pattern (own DB session) per project convention.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.score import ScoreDetail, SessionScore
from app.models.session import CoachingSession
from app.services import config_service
from app.services.cu_evaluation_service import (
    CU_SERVICE_NAME,
    _parse_cu_voice_result,
    score_voice_with_cu,
)

logger = logging.getLogger(__name__)

# Voice scoring dimensions (D-09)
VOICE_DIMENSIONS = [
    {
        "name": "fluency",
        "weight": 25,
        "max_score": 100,
        "description": "Language fluency and coherence",
    },
    {
        "name": "tone",
        "weight": 25,
        "max_score": 100,
        "description": "Tone and intonation appropriateness",
    },
    {
        "name": "pace",
        "weight": 25,
        "max_score": 100,
        "description": "Speaking pace and rhythm control",
    },
    {
        "name": "pronunciation",
        "weight": 25,
        "max_score": 100,
        "description": "Pronunciation clarity",
    },
]


async def save_voice_score_details(db: AsyncSession, session_id: str, scores: dict) -> None:
    """Save voice scoring results as ScoreDetail records with category='voice'.

    If a SessionScore already exists (content scoring done first), appends voice
    dimensions to it. Otherwise creates a preliminary SessionScore for voice-only.
    """
    result = await db.execute(select(SessionScore).where(SessionScore.session_id == session_id))
    session_score = result.scalar_one_or_none()

    if not session_score:
        session_score = SessionScore(
            session_id=session_id,
            overall_score=scores.get("overall_voice_score", 0),
            passed=True,
            feedback_summary="Voice scoring completed",
        )
        db.add(session_score)
        await db.flush()

    for dim in scores["dimensions"]:
        detail = ScoreDetail(
            score_id=session_score.id,
            dimension=dim["name"],
            score=dim["score"],
            weight=dim["weight"],
            strengths="[]",
            weaknesses="[]",
            suggestions="[]",
            category="voice",
        )
        db.add(detail)
    await db.flush()


async def trigger_voice_scoring(session_id: str, language: str = "zh-CN") -> None:
    """Durable background task: score voice quality for a session via CU.

    Uses own DB session (not request-scoped) per durable task pattern.
    Updates session.voice_score_status: pending -> processing -> completed/failed.
    No mock fallback — failures set status to "failed".
    """
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(CoachingSession).where(CoachingSession.id == session_id)
            )
            session = result.scalar_one_or_none()
            if not session or not session.audio_url:
                logger.warning("Voice scoring skipped for session %s: no audio", session_id)
                return

            session.voice_score_status = "processing"
            await db.commit()

            # Get CU endpoint and key
            endpoint = await config_service.get_effective_endpoint(db, CU_SERVICE_NAME)
            api_key = await config_service.get_effective_key(db, CU_SERVICE_NAME)

            if not endpoint:
                raise RuntimeError("CU endpoint not configured for voice scoring")

            # Get voice analyzer ID from rubric
            from app.models.scenario import Scenario
            from app.models.scoring_rubric import ScoringRubric

            scenario_result = await db.execute(
                select(Scenario).where(Scenario.id == session.scenario_id)
            )
            scenario = scenario_result.scalar_one_or_none()
            analyzer_id = None
            if scenario and scenario.rubric_id:
                rubric_result = await db.execute(
                    select(ScoringRubric).where(ScoringRubric.id == scenario.rubric_id)
                )
                rubric = rubric_result.scalar_one_or_none()
                if rubric:
                    analyzer_id = rubric.cu_voice_analyzer_id

            if not analyzer_id:
                raise RuntimeError(f"No CU voice analyzer configured for session {session_id}")

            # Call CU voice scoring
            cu_fields = await score_voice_with_cu(endpoint, api_key, analyzer_id, session.audio_url)
            voice_result = _parse_cu_voice_result(cu_fields)

            # Calculate overall voice score
            dims = voice_result.get("dimensions", [])
            if dims:
                total_w = sum(d.get("weight", 0) for d in dims)
                overall = (
                    sum(d.get("score", 0) * d.get("weight", 0) for d in dims) / total_w
                    if total_w > 0
                    else 0
                )
            else:
                overall = 0

            voice_scores = {
                "dimensions": dims,
                "overall_voice_score": round(overall, 1),
            }

            await save_voice_score_details(db, session_id, voice_scores)
            session.voice_score_status = "completed"
            await db.commit()

            logger.info(
                "Voice scoring completed for session %s: overall=%s",
                session_id,
                voice_scores["overall_voice_score"],
            )
    except Exception as e:
        logger.error("Voice scoring failed for session %s: %s", session_id, e)
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(CoachingSession).where(CoachingSession.id == session_id)
                )
                session = result.scalar_one_or_none()
                if session:
                    session.voice_score_status = "failed"
                    await db.commit()
        except Exception:
            pass
