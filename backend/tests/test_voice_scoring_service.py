"""Unit tests for voice scoring service (Speech-first, no mock fallback)."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy import select

from app.models.session import CoachingSession
from app.services.pronunciation_assessment_service import PronunciationAssessmentResult
from app.services.voice_scoring_service import (
    VOICE_DIMENSIONS,
    trigger_voice_scoring,
)


class TestVoiceDimensions:
    """Tests for VOICE_DIMENSIONS configuration."""

    def test_has_four_dimensions(self):
        assert len(VOICE_DIMENSIONS) == 4

    def test_dimension_names(self):
        names = {d["name"] for d in VOICE_DIMENSIONS}
        assert names == {"fluency", "tone", "pace", "pronunciation"}

    def test_weights_sum_to_100(self):
        total = sum(d["weight"] for d in VOICE_DIMENSIONS)
        assert total == 100

    def test_all_dimensions_have_required_fields(self):
        for dim in VOICE_DIMENSIONS:
            assert "name" in dim
            assert "weight" in dim
            assert "max_score" in dim
            assert "description" in dim
            assert dim["max_score"] == 100


class TestTriggerVoiceScoring:
    """Tests for trigger_voice_scoring background task."""

    async def test_skips_when_no_session(self, db_session, monkeypatch):
        from tests.conftest import TestSessionLocal

        monkeypatch.setattr(
            "app.services.voice_scoring_service.AsyncSessionLocal",
            TestSessionLocal,
        )
        await trigger_voice_scoring("nonexistent-session-id")

    async def test_skips_when_no_audio_url(self, db_session, monkeypatch):
        from tests.conftest import TestSessionLocal

        monkeypatch.setattr(
            "app.services.voice_scoring_service.AsyncSessionLocal",
            TestSessionLocal,
        )

        session = CoachingSession(
            id=str(uuid.uuid4()),
            user_id="fake-user-id",
            scenario_id="fake-scenario-id",
            status="completed",
            audio_url=None,
        )
        db_session.add(session)
        await db_session.commit()

        await trigger_voice_scoring(session.id)

        result = await db_session.execute(
            select(CoachingSession).where(CoachingSession.id == session.id)
        )
        s = result.scalar_one()
        assert s.voice_score_status == "none"

    async def test_sets_failed_when_speech_not_configured(self, db_session, monkeypatch):
        """When Speech key is not configured, voice scoring sets status to failed."""
        from tests.conftest import TestSessionLocal

        monkeypatch.setattr(
            "app.services.voice_scoring_service.AsyncSessionLocal",
            TestSessionLocal,
        )

        session_id = str(uuid.uuid4())
        session = CoachingSession(
            id=session_id,
            user_id="fake-user-id",
            scenario_id="fake-scenario-id",
            status="completed",
            audio_url="audio/sessions/test/recording.webm",
            voice_score_status="pending",
        )
        db_session.add(session)
        await db_session.commit()

        with (
            patch(
                "app.services.voice_scoring_service.config_service.get_effective_key",
                new_callable=AsyncMock,
                return_value="",
            ),
            patch(
                "app.services.voice_scoring_service.config_service.get_effective_region",
                new_callable=AsyncMock,
                return_value="eastus2",
            ),
        ):
            await trigger_voice_scoring(session_id)

        async with TestSessionLocal() as verify_session:
            result = await verify_session.execute(
                select(CoachingSession).where(CoachingSession.id == session_id)
            )
            s = result.scalar_one()
            assert s.voice_score_status == "failed"

    async def test_completes_when_pronunciation_assessment_succeeds(self, db_session, monkeypatch):
        """When Speech pronunciation scoring succeeds, sets status to completed."""
        from tests.conftest import TestSessionLocal

        monkeypatch.setattr(
            "app.services.voice_scoring_service.AsyncSessionLocal",
            TestSessionLocal,
        )

        session_id = str(uuid.uuid4())
        session = CoachingSession(
            id=session_id,
            user_id="fake-user-id",
            scenario_id="fake-scenario-id",
            status="completed",
            audio_url="https://blob.core.windows.net/audio/test.webm",
            voice_score_status="pending",
        )
        db_session.add(session)
        await db_session.commit()

        mock_storage = AsyncMock()
        mock_storage.read = AsyncMock(return_value=b"audio-bytes")
        speech_result = PronunciationAssessmentResult(
            dimensions=[
                {"name": "pronunciation", "score": 90, "weight": 25},
                {"name": "fluency", "score": 85, "weight": 25},
                {"name": "pace", "score": 75, "weight": 25},
                {"name": "tone", "score": 80, "weight": 25},
            ],
            feedback_summary="Overall good voice quality",
            raw_result={},
        )

        with (
            patch(
                "app.services.voice_scoring_service.config_service.get_effective_key",
                new_callable=AsyncMock,
                return_value="test-key",
            ),
            patch(
                "app.services.voice_scoring_service.config_service.get_effective_region",
                new_callable=AsyncMock,
                return_value="eastus2",
            ),
            patch(
                "app.services.voice_scoring_service.assess_pronunciation",
                new_callable=AsyncMock,
                return_value=speech_result,
            ) as mock_assess,
            patch(
                "app.services.voice_scoring_service.get_storage",
                return_value=mock_storage,
            ),
        ):
            await trigger_voice_scoring(session_id)

        mock_storage.read.assert_awaited_once_with("https://blob.core.windows.net/audio/test.webm")
        assert mock_assess.await_args.kwargs["audio_data"] == b"audio-bytes"
        assert mock_assess.await_args.kwargs["speech_key"] == "test-key"
        assert mock_assess.await_args.kwargs["speech_region"] == "eastus2"

        async with TestSessionLocal() as verify_session:
            result = await verify_session.execute(
                select(CoachingSession).where(CoachingSession.id == session_id)
            )
            s = result.scalar_one()
            assert s.voice_score_status == "completed"

    async def test_transcodes_private_audio_when_enabled(self, db_session, monkeypatch):
        """Cloud voice scoring transcodes private WebM audio before Speech submission."""
        from tests.conftest import TestSessionLocal

        monkeypatch.setattr(
            "app.services.voice_scoring_service.AsyncSessionLocal",
            TestSessionLocal,
        )

        session_id = str(uuid.uuid4())
        session = CoachingSession(
            id=session_id,
            user_id="fake-user-id",
            scenario_id="fake-scenario-id",
            status="completed",
            audio_url="https://blob.core.windows.net/audio/test.webm",
            voice_score_status="pending",
        )
        db_session.add(session)
        await db_session.commit()

        mock_storage = AsyncMock()
        mock_storage.read = AsyncMock(return_value=b"webm-bytes")
        settings = MagicMock()
        settings.voice_scoring_transcode_enabled = True
        settings.voice_scoring_transcode_timeout_seconds = 120
        speech_result = PronunciationAssessmentResult(
            dimensions=[
                {"name": "pronunciation", "score": 90, "weight": 25},
                {"name": "fluency", "score": 85, "weight": 25},
                {"name": "pace", "score": 75, "weight": 25},
                {"name": "tone", "score": 80, "weight": 25},
            ],
            feedback_summary="ok",
            raw_result={},
        )

        with (
            patch(
                "app.services.voice_scoring_service.config_service.get_effective_key",
                new_callable=AsyncMock,
                return_value="test-key",
            ),
            patch(
                "app.services.voice_scoring_service.config_service.get_effective_region",
                new_callable=AsyncMock,
                return_value="eastus2",
            ),
            patch(
                "app.services.voice_scoring_service.get_storage",
                return_value=mock_storage,
            ),
            patch(
                "app.services.voice_scoring_service.get_settings",
                return_value=settings,
            ),
            patch(
                "app.services.voice_scoring_service.transcode_audio_to_wav_pcm",
                new_callable=AsyncMock,
                return_value=b"wav-bytes",
            ) as mock_transcode,
            patch(
                "app.services.voice_scoring_service.assess_pronunciation",
                new_callable=AsyncMock,
                return_value=speech_result,
            ) as mock_assess,
        ):
            await trigger_voice_scoring(session_id)

        mock_transcode.assert_awaited_once_with(b"webm-bytes", timeout_seconds=120)
        assert mock_assess.await_args.kwargs["audio_data"] == b"wav-bytes"
