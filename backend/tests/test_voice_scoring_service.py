"""Unit tests for voice scoring service (CU-only, no mock)."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy import select

from app.models.session import CoachingSession
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

    async def test_sets_failed_when_cu_not_configured(self, db_session, monkeypatch):
        """When CU endpoint not configured, voice scoring sets status to failed."""
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

        # Mock config_service to return None (not configured)
        with (
            patch(
                "app.services.voice_scoring_service.config_service.get_effective_endpoint",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "app.services.voice_scoring_service.config_service.get_effective_key",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            await trigger_voice_scoring(session_id)

        async with TestSessionLocal() as verify_session:
            result = await verify_session.execute(
                select(CoachingSession).where(CoachingSession.id == session_id)
            )
            s = result.scalar_one()
            assert s.voice_score_status == "failed"

    async def test_completes_when_cu_succeeds(self, db_session, monkeypatch):
        """When CU voice scoring succeeds, sets status to completed."""
        from tests.conftest import TestSessionLocal

        monkeypatch.setattr(
            "app.services.voice_scoring_service.AsyncSessionLocal",
            TestSessionLocal,
        )

        # Create scenario and rubric for the session
        from app.models.scenario import Scenario
        from app.models.scoring_rubric import ScoringRubric

        rubric = ScoringRubric(
            name="VR",
            scenario_type="f2f",
            dimensions="[]",
            is_default=True,
            created_by="fake-user-id",
            cu_voice_analyzer_id="testVoiceAnalyzer",
        )
        db_session.add(rubric)
        await db_session.flush()

        scenario = Scenario(
            name="S",
            hcp_profile_id="fake-hcp",
            key_messages="[]",
            rubric_id=rubric.id,
            status="active",
            created_by="fake-user-id",
            skill_id="fake-skill",
        )
        db_session.add(scenario)
        await db_session.flush()

        session_id = str(uuid.uuid4())
        session = CoachingSession(
            id=session_id,
            user_id="fake-user-id",
            scenario_id=scenario.id,
            status="completed",
            audio_url="https://blob.core.windows.net/audio/test.webm",
            voice_score_status="pending",
        )
        db_session.add(session)
        await db_session.commit()

        # Mock CU calls
        mock_cu_fields = {
            "fluency": {"valueString": '{"score": 85, "feedback": "Good flow"}'},
            "tone": {"valueString": '{"score": 80, "feedback": "Professional"}'},
            "pace": {"valueString": '{"score": 75, "feedback": "Adequate"}'},
            "pronunciation": {"valueString": '{"score": 90, "feedback": "Clear"}'},
            "feedback_summary": {"valueString": "Overall good voice quality"},
            "transcript": {"valueString": "Hello doctor"},
        }

        mock_storage = AsyncMock()
        mock_storage.read = AsyncMock(return_value=b"audio-bytes")

        with (
            patch(
                "app.services.voice_scoring_service.config_service.get_effective_endpoint",
                new_callable=AsyncMock,
                return_value="https://cu.cognitiveservices.azure.com",
            ),
            patch(
                "app.services.voice_scoring_service.config_service.get_effective_key",
                new_callable=AsyncMock,
                return_value="test-key",
            ),
            patch(
                "app.services.voice_scoring_service.score_voice_with_cu",
                new_callable=AsyncMock,
                return_value=mock_cu_fields,
            ) as mock_score_voice,
            patch(
                "app.services.voice_scoring_service.get_storage",
                return_value=mock_storage,
            ),
        ):
            await trigger_voice_scoring(session_id)

        mock_storage.read.assert_awaited_once_with("https://blob.core.windows.net/audio/test.webm")
        assert mock_score_voice.await_args.kwargs["audio_data"] == b"audio-bytes"

        async with TestSessionLocal() as verify_session:
            result = await verify_session.execute(
                select(CoachingSession).where(CoachingSession.id == session_id)
            )
            s = result.scalar_one()
            assert s.voice_score_status == "completed"

    async def test_transcodes_private_audio_when_enabled(self, db_session, monkeypatch):
        """Cloud voice scoring transcodes private WebM audio before CU submission."""
        from tests.conftest import TestSessionLocal

        monkeypatch.setattr(
            "app.services.voice_scoring_service.AsyncSessionLocal",
            TestSessionLocal,
        )

        from app.models.scenario import Scenario
        from app.models.scoring_rubric import ScoringRubric

        rubric = ScoringRubric(
            name="VR",
            scenario_type="f2f",
            dimensions="[]",
            is_default=True,
            created_by="fake-user-id",
            cu_voice_analyzer_id="testVoiceAnalyzer",
        )
        db_session.add(rubric)
        await db_session.flush()

        scenario = Scenario(
            name="S",
            hcp_profile_id="fake-hcp",
            key_messages="[]",
            rubric_id=rubric.id,
            status="active",
            created_by="fake-user-id",
            skill_id="fake-skill",
        )
        db_session.add(scenario)
        await db_session.flush()

        session_id = str(uuid.uuid4())
        session = CoachingSession(
            id=session_id,
            user_id="fake-user-id",
            scenario_id=scenario.id,
            status="completed",
            audio_url="https://blob.core.windows.net/audio/test.webm",
            voice_score_status="pending",
        )
        db_session.add(session)
        await db_session.commit()

        mock_cu_fields = {
            "fluency": {"valueString": '{"score": 85, "feedback": "Good flow"}'},
            "tone": {"valueString": '{"score": 80, "feedback": "Professional"}'},
            "pace": {"valueString": '{"score": 75, "feedback": "Adequate"}'},
            "pronunciation": {"valueString": '{"score": 90, "feedback": "Clear"}'},
        }
        mock_storage = AsyncMock()
        mock_storage.read = AsyncMock(return_value=b"webm-bytes")
        settings = MagicMock()
        settings.voice_scoring_transcode_enabled = True
        settings.voice_scoring_transcode_timeout_seconds = 120

        with (
            patch(
                "app.services.voice_scoring_service.config_service.get_effective_endpoint",
                new_callable=AsyncMock,
                return_value="https://cu.cognitiveservices.azure.com",
            ),
            patch(
                "app.services.voice_scoring_service.config_service.get_effective_key",
                new_callable=AsyncMock,
                return_value="test-key",
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
                "app.services.voice_scoring_service.score_voice_with_cu",
                new_callable=AsyncMock,
                return_value=mock_cu_fields,
            ) as mock_score_voice,
        ):
            await trigger_voice_scoring(session_id)

        mock_transcode.assert_awaited_once_with(b"webm-bytes", timeout_seconds=120)
        assert mock_score_voice.await_args.kwargs["audio_data"] == b"wav-bytes"
        assert mock_score_voice.await_args.kwargs["mime_type"] == "audio/wav"
        assert mock_score_voice.await_args.kwargs["use_binary_upload"] is True
