"""Voice quality scoring service using Azure Content Understanding.

Calls CU audioAnalyzer to analyze recorded audio for voice-specific dimensions:
fluency, tone, pace, pronunciation clarity.
No mock fallback — failures set voice_score_status = "failed".
Uses durable background task pattern (own DB session) per project convention.
"""

import logging
from urllib.parse import urlparse

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


async def _read_audio_for_private_source(audio_url: str) -> bytes | None:
    """Read cloud audio through the backend when CU cannot fetch the URL itself."""
    parsed = urlparse(audio_url)
    if parsed.scheme not in {"http", "https"}:
        return None

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

            # Private Blob URLs are read by the backend with Managed Identity
            # and submitted as base64 data so CU does not need Blob access.
            audio_data = await _read_audio_for_private_source(session.audio_url)
            mime_type = None
            use_binary_upload = False
            settings = get_settings()
            if audio_data is not None and settings.voice_scoring_transcode_enabled:
                audio_data = await transcode_audio_to_wav_pcm(
                    audio_data,
                    timeout_seconds=settings.voice_scoring_transcode_timeout_seconds,
                )
                mime_type = "audio/wav"

            cu_fields = await score_voice_with_cu(
                endpoint,
                api_key,
                analyzer_id,
                session.audio_url,
                audio_data=audio_data,
                mime_type=mime_type,
                use_binary_upload=use_binary_upload,
            )
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
