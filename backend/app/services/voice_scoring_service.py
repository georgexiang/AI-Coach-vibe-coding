"""Voice quality scoring service using pluggable backend.

Calls Azure Content Understanding (or mock) to analyze recorded audio
for voice-specific dimensions: fluency, tone, pace, pronunciation clarity.
Uses durable background task pattern (own DB session) per project convention.
"""

import asyncio
import logging
import random
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.score import ScoreDetail, SessionScore
from app.models.session import CoachingSession

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


class VoiceScoringBackend(Protocol):
    """Protocol for voice quality scoring backends."""

    async def analyze(self, audio_url: str, language: str) -> dict:
        """Analyze audio and return dimension scores.

        Returns dict with "dimensions" list and "overall_voice_score".
        """
        ...


class MockVoiceScoringBackend:
    """Mock implementation for development/testing."""

    async def analyze(self, audio_url: str, language: str) -> dict:
        dimensions = []
        for dim in VOICE_DIMENSIONS:
            score = random.uniform(55, 95)
            dimensions.append(
                {
                    "name": dim["name"],
                    "score": round(score, 1),
                    "weight": dim["weight"],
                    "max_score": dim["max_score"],
                    "feedback": f"Mock feedback for {dim['name']}",
                }
            )
        overall = round(sum(d["score"] * d["weight"] for d in dimensions) / 100, 1)
        return {"dimensions": dimensions, "overall_voice_score": overall}


def get_voice_scoring_backend() -> VoiceScoringBackend:
    """Factory: returns mock for now, Azure CU adapter when configured."""
    return MockVoiceScoringBackend()


async def save_voice_score_details(
    db: AsyncSession, session_id: str, scores: dict
) -> None:
    """Save voice scoring results as ScoreDetail records with category='voice'.

    If a SessionScore already exists (content scoring done first), appends voice
    dimensions to it. Otherwise creates a preliminary SessionScore for voice-only.
    """
    result = await db.execute(
        select(SessionScore).where(SessionScore.session_id == session_id)
    )
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
    """Durable background task: score voice quality for a session.

    Uses own DB session (not request-scoped) per durable task pattern.
    Updates session.voice_score_status through lifecycle: pending -> processing -> completed/failed.
    Language follows scenario config (D-12).
    """
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(CoachingSession).where(CoachingSession.id == session_id)
            )
            session = result.scalar_one_or_none()
            if not session or not session.audio_url:
                logger.warning(
                    f"Voice scoring skipped for session {session_id}: no audio"
                )
                return

            session.voice_score_status = "processing"
            await db.commit()

            # Real CU takes 30-120s; mock is instant
            await asyncio.sleep(0.1)

            backend = get_voice_scoring_backend()
            scores = await backend.analyze(session.audio_url, language)

            # Save results as ScoreDetail records with category="voice"
            await save_voice_score_details(db, session_id, scores)

            session.voice_score_status = "completed"
            await db.commit()

            logger.info(
                f"Voice scoring completed for session {session_id}: "
                f"overall={scores['overall_voice_score']}"
            )
    except Exception as e:
        logger.error(f"Voice scoring failed for session {session_id}: {e}")
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
