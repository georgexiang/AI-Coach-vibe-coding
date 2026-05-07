"""Unit tests for voice scoring service."""

import pytest

from app.services.voice_scoring_service import (
    VOICE_DIMENSIONS,
    MockVoiceScoringBackend,
    get_voice_scoring_backend,
    trigger_voice_scoring,
)


class TestVoiceDimensions:
    """Tests for VOICE_DIMENSIONS configuration."""

    def test_has_four_dimensions(self):
        """VOICE_DIMENSIONS contains exactly 4 dimensions."""
        assert len(VOICE_DIMENSIONS) == 4

    def test_dimension_names(self):
        """VOICE_DIMENSIONS contains expected dimension names."""
        names = {d["name"] for d in VOICE_DIMENSIONS}
        assert names == {"fluency", "tone", "pace", "pronunciation"}

    def test_weights_sum_to_100(self):
        """Dimension weights sum to 100."""
        total = sum(d["weight"] for d in VOICE_DIMENSIONS)
        assert total == 100

    def test_all_dimensions_have_required_fields(self):
        """Each dimension has name, weight, max_score, description."""
        for dim in VOICE_DIMENSIONS:
            assert "name" in dim
            assert "weight" in dim
            assert "max_score" in dim
            assert "description" in dim
            assert dim["max_score"] == 100


class TestMockVoiceScoringBackend:
    """Tests for MockVoiceScoringBackend."""

    async def test_analyze_returns_dimensions(self):
        """analyze() returns dict with dimensions list."""
        backend = MockVoiceScoringBackend()
        result = await backend.analyze("audio/test.webm", "zh-CN")
        assert "dimensions" in result
        assert len(result["dimensions"]) == 4

    async def test_analyze_returns_overall_score(self):
        """analyze() returns overall_voice_score."""
        backend = MockVoiceScoringBackend()
        result = await backend.analyze("audio/test.webm", "en-US")
        assert "overall_voice_score" in result
        assert 0 <= result["overall_voice_score"] <= 100

    async def test_dimension_scores_in_range(self):
        """Each dimension score is between 55 and 95."""
        backend = MockVoiceScoringBackend()
        result = await backend.analyze("audio/test.webm", "zh-CN")
        for dim in result["dimensions"]:
            assert 55 <= dim["score"] <= 95

    async def test_dimension_has_feedback(self):
        """Each dimension includes feedback string."""
        backend = MockVoiceScoringBackend()
        result = await backend.analyze("audio/test.webm", "zh-CN")
        for dim in result["dimensions"]:
            assert "feedback" in dim
            assert isinstance(dim["feedback"], str)
            assert len(dim["feedback"]) > 0

    async def test_dimension_names_match_config(self):
        """Returned dimension names match VOICE_DIMENSIONS config."""
        backend = MockVoiceScoringBackend()
        result = await backend.analyze("audio/test.webm", "zh-CN")
        names = {d["name"] for d in result["dimensions"]}
        expected = {d["name"] for d in VOICE_DIMENSIONS}
        assert names == expected


class TestGetVoiceScoringBackend:
    """Tests for get_voice_scoring_backend factory."""

    def test_returns_mock_backend(self):
        """Factory returns MockVoiceScoringBackend by default."""
        backend = get_voice_scoring_backend()
        assert isinstance(backend, MockVoiceScoringBackend)


class TestTriggerVoiceScoring:
    """Tests for trigger_voice_scoring background task."""

    async def test_skips_when_no_session(self, db_session, monkeypatch):
        """trigger_voice_scoring skips gracefully for nonexistent session."""
        # Patch AsyncSessionLocal to use test session
        from tests.conftest import TestSessionLocal

        monkeypatch.setattr(
            "app.services.voice_scoring_service.AsyncSessionLocal",
            TestSessionLocal,
        )
        # Should not raise
        await trigger_voice_scoring("nonexistent-session-id")

    async def test_skips_when_no_audio_url(self, db_session, monkeypatch):
        """trigger_voice_scoring skips when session has no audio_url."""
        import uuid

        from sqlalchemy import select

        from app.models.session import CoachingSession
        from tests.conftest import TestSessionLocal

        monkeypatch.setattr(
            "app.services.voice_scoring_service.AsyncSessionLocal",
            TestSessionLocal,
        )

        # SQLite doesn't enforce FKs by default — insert with fake IDs
        session = CoachingSession(
            id=str(uuid.uuid4()),
            user_id="fake-user-id",
            scenario_id="fake-scenario-id",
            status="completed",
            audio_url=None,
        )
        db_session.add(session)
        await db_session.commit()

        # Should not raise, just skip
        await trigger_voice_scoring(session.id)

        # Verify status unchanged
        result = await db_session.execute(
            select(CoachingSession).where(CoachingSession.id == session.id)
        )
        s = result.scalar_one()
        assert s.voice_score_status == "none"

    async def test_processes_when_audio_exists(self, db_session, monkeypatch):
        """trigger_voice_scoring processes and completes when audio exists."""
        import uuid

        from sqlalchemy import select

        from app.models.session import CoachingSession
        from tests.conftest import TestSessionLocal

        monkeypatch.setattr(
            "app.services.voice_scoring_service.AsyncSessionLocal",
            TestSessionLocal,
        )

        # SQLite doesn't enforce FKs by default — insert with fake IDs
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

        # Run scoring (uses its own session via TestSessionLocal)
        await trigger_voice_scoring(session_id)

        # Verify status is completed — use fresh session to avoid cache
        async with TestSessionLocal() as verify_session:
            result = await verify_session.execute(
                select(CoachingSession).where(CoachingSession.id == session_id)
            )
            s = result.scalar_one()
            assert s.voice_score_status == "completed"
