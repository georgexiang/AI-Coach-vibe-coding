"""Voice quality scoring service using Azure Speech Pronunciation Assessment.

Uses Azure Speech Pronunciation Assessment for voice-specific dimensions:
pronunciation/accuracy, fluency, pace, tone/prosody.
No mock fallback — failures set voice_score_status = "failed".
Uses durable background task pattern (own DB session) per project convention.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.session import CoachingSession
from app.models.voice_score import VoiceScore, VoiceScoreDetail
from app.services import config_service
from app.services.audio_transcoding_service import transcode_audio_to_wav_pcm
from app.services.cu_evaluation_service import (
    CU_SERVICE_NAME,
    _parse_cu_voice_result,
    score_voice_with_cu,
)
from app.services.pronunciation_assessment_service import (
    SPEECH_STT_SERVICE_NAME,
    assess_pronunciation,
)
from app.services.storage import get_storage

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


async def _read_audio_for_scoring(audio_url: str) -> bytes:
    """Read recorded audio through the configured backend storage."""
    storage = get_storage()
    try:
        return await storage.read(audio_url)
    except Exception as exc:
        raise RuntimeError(f"Failed to read audio from storage for voice scoring: {exc}") from exc


async def save_voice_score_details(db: AsyncSession, session_id: str, scores: dict) -> None:
    """Save voice scoring results independently from content scoring."""
    result = await db.execute(select(VoiceScore).where(VoiceScore.session_id == session_id))
    voice_score = result.scalar_one_or_none()

    if not voice_score:
        voice_score = VoiceScore(
            session_id=session_id,
            overall_voice_score=scores.get("overall_voice_score", 0),
            feedback_summary=scores.get("feedback_summary", ""),
        )
        db.add(voice_score)
        await db.flush()
    else:
        voice_score.overall_voice_score = scores.get("overall_voice_score", 0)
        voice_score.feedback_summary = scores.get("feedback_summary", "")
        existing = await db.execute(
            select(VoiceScoreDetail).where(VoiceScoreDetail.voice_score_id == voice_score.id)
        )
        for detail in existing.scalars().all():
            await db.delete(detail)
        await db.flush()

    for dim in scores["dimensions"]:
        detail = VoiceScoreDetail(
            voice_score_id=voice_score.id,
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


async def _score_voice_with_pronunciation_assessment(
    db: AsyncSession,
    audio_data: bytes,
    language: str,
) -> dict:
    """Score voice quality with Azure Speech Pronunciation Assessment."""
    speech_endpoint = await config_service.get_effective_endpoint(db, SPEECH_STT_SERVICE_NAME)
    speech_key = await config_service.get_effective_key(db, SPEECH_STT_SERVICE_NAME)
    speech_region = await config_service.get_effective_region(db, SPEECH_STT_SERVICE_NAME)

    result = await assess_pronunciation(
        speech_endpoint=speech_endpoint,
        speech_key=speech_key,
        speech_region=speech_region,
        audio_data=audio_data,
        language=language,
    )
    total_w = sum(d.get("weight", 0) for d in result.dimensions)
    overall = (
        sum(d.get("score", 0) * d.get("weight", 0) for d in result.dimensions) / total_w
        if total_w > 0
        else 0
    )
    return {
        "dimensions": result.dimensions,
        "overall_voice_score": round(overall, 1),
        "feedback_summary": result.feedback_summary,
    }


async def _score_voice_with_cu_legacy(
    db: AsyncSession,
    session: CoachingSession,
    audio_data: bytes | None,
    mime_type: str | None,
) -> dict:
    """Legacy CU voice scoring path retained for future optional use."""
    endpoint = await config_service.get_effective_endpoint(db, CU_SERVICE_NAME)
    api_key = await config_service.get_effective_key(db, CU_SERVICE_NAME)

    if not endpoint:
        raise RuntimeError("CU endpoint not configured for voice scoring")

    from app.models.scenario import Scenario
    from app.models.scoring_rubric import ScoringRubric

    scenario_result = await db.execute(select(Scenario).where(Scenario.id == session.scenario_id))
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
        raise RuntimeError(f"No CU voice analyzer configured for session {session.id}")

    cu_fields = await score_voice_with_cu(
        endpoint,
        api_key,
        analyzer_id,
        session.audio_url,
        audio_data=audio_data,
        mime_type=mime_type,
        use_binary_upload=False,
    )
    voice_result = _parse_cu_voice_result(cu_fields)
    dims = voice_result.get("dimensions", [])
    total_w = sum(d.get("weight", 0) for d in dims)
    overall = (
        sum(d.get("score", 0) * d.get("weight", 0) for d in dims) / total_w if total_w > 0 else 0
    )
    return {
        "dimensions": dims,
        "overall_voice_score": round(overall, 1),
        "feedback_summary": voice_result.get("feedback_summary", ""),
    }


async def trigger_voice_scoring(session_id: str, language: str = "zh-CN") -> None:
    """Durable background task: score voice quality for a session via Speech.

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

            # Private Blob URLs are read by the backend with Managed Identity.
            audio_data = await _read_audio_for_scoring(session.audio_url)
            settings = get_settings()
            if audio_data is not None and settings.voice_scoring_transcode_enabled:
                audio_data = await transcode_audio_to_wav_pcm(
                    audio_data,
                    timeout_seconds=settings.voice_scoring_transcode_timeout_seconds,
                )

            voice_scores = await _score_voice_with_pronunciation_assessment(
                db,
                audio_data,
                language,
            )

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
