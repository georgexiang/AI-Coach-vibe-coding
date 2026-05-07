"""Unit tests for combined scoring (Plan 04): voice score persistence + combined report."""

import uuid

import pytest
from sqlalchemy import select

from app.models.score import ScoreDetail, SessionScore
from app.models.session import CoachingSession
from app.services.scoring_service import get_combined_score_report
from app.services.voice_scoring_service import save_voice_score_details
from app.utils.exceptions import AppException, NotFoundException


@pytest.fixture
async def session_with_audio(db_session):
    """Create a session with audio_url for testing."""
    session = CoachingSession(
        id=str(uuid.uuid4()),
        user_id="test-user-1",
        scenario_id="fake-scenario-id",
        status="completed",
        audio_url="audio/sessions/test/recording.webm",
        voice_score_status="completed",
    )
    db_session.add(session)
    await db_session.commit()
    return session


@pytest.fixture
def mock_voice_scores():
    """Mock voice scoring result from backend.analyze()."""
    return {
        "dimensions": [
            {"name": "fluency", "score": 85.0, "weight": 25, "max_score": 100},
            {"name": "tone", "score": 78.0, "weight": 25, "max_score": 100},
            {"name": "pace", "score": 90.0, "weight": 25, "max_score": 100},
            {"name": "pronunciation", "score": 72.0, "weight": 25, "max_score": 100},
        ],
        "overall_voice_score": 81.3,
    }


class TestSaveVoiceScoreDetails:
    """Tests for save_voice_score_details."""

    async def test_creates_session_score_when_none_exists(
        self, db_session, session_with_audio, mock_voice_scores
    ):
        """Creates preliminary SessionScore when no content score exists."""
        session = session_with_audio
        await save_voice_score_details(db_session, session.id, mock_voice_scores)
        await db_session.commit()

        result = await db_session.execute(
            select(SessionScore).where(SessionScore.session_id == session.id)
        )
        score = result.scalar_one()
        assert score.overall_score == 81.3
        assert score.passed is True

    async def test_creates_four_voice_score_details(
        self, db_session, session_with_audio, mock_voice_scores
    ):
        """Creates 4 ScoreDetail records with category='voice'."""
        session = session_with_audio
        await save_voice_score_details(db_session, session.id, mock_voice_scores)
        await db_session.commit()

        result = await db_session.execute(
            select(ScoreDetail).where(ScoreDetail.category == "voice")
        )
        details = list(result.scalars().all())
        assert len(details) == 4
        names = {d.dimension for d in details}
        assert names == {"fluency", "tone", "pace", "pronunciation"}

    async def test_voice_details_have_correct_scores(
        self, db_session, session_with_audio, mock_voice_scores
    ):
        """ScoreDetail records have correct scores from backend."""
        session = session_with_audio
        await save_voice_score_details(db_session, session.id, mock_voice_scores)
        await db_session.commit()

        result = await db_session.execute(
            select(ScoreDetail)
            .where(ScoreDetail.category == "voice")
            .order_by(ScoreDetail.dimension)
        )
        details = list(result.scalars().all())
        scores_by_name = {d.dimension: d.score for d in details}
        assert scores_by_name["fluency"] == 85.0
        assert scores_by_name["tone"] == 78.0
        assert scores_by_name["pace"] == 90.0
        assert scores_by_name["pronunciation"] == 72.0

    async def test_appends_to_existing_session_score(
        self, db_session, session_with_audio, mock_voice_scores
    ):
        """Appends voice details to existing SessionScore (content scored first)."""
        session = session_with_audio

        # Create existing content SessionScore
        existing_score = SessionScore(
            session_id=session.id,
            overall_score=75.0,
            passed=True,
            feedback_summary="Good content performance",
        )
        db_session.add(existing_score)
        await db_session.flush()

        # Add a content detail
        content_detail = ScoreDetail(
            score_id=existing_score.id,
            dimension="key_messages",
            score=80.0,
            weight=50,
            strengths="[]",
            weaknesses="[]",
            suggestions="[]",
            category="content",
        )
        db_session.add(content_detail)
        await db_session.commit()

        # Now save voice scores — should append to existing
        await save_voice_score_details(db_session, session.id, mock_voice_scores)
        await db_session.commit()

        # Should still be only 1 SessionScore
        result = await db_session.execute(
            select(SessionScore).where(SessionScore.session_id == session.id)
        )
        scores = list(result.scalars().all())
        assert len(scores) == 1

        # Should have 5 details total (1 content + 4 voice)
        detail_result = await db_session.execute(
            select(ScoreDetail).where(ScoreDetail.score_id == existing_score.id)
        )
        all_details = list(detail_result.scalars().all())
        assert len(all_details) == 5

    async def test_voice_details_weight_stored(
        self, db_session, session_with_audio, mock_voice_scores
    ):
        """ScoreDetail weight values match dimension weights."""
        session = session_with_audio
        await save_voice_score_details(db_session, session.id, mock_voice_scores)
        await db_session.commit()

        result = await db_session.execute(
            select(ScoreDetail).where(ScoreDetail.category == "voice")
        )
        details = list(result.scalars().all())
        for d in details:
            assert d.weight == 25


class TestGetCombinedScoreReport:
    """Tests for get_combined_score_report."""

    async def test_raises_not_found_for_missing_session(self, db_session):
        """Raises NotFoundException for nonexistent session."""
        with pytest.raises(NotFoundException):
            await get_combined_score_report(db_session, "nonexistent", "user-1")

    async def test_raises_forbidden_for_wrong_user(
        self, db_session, session_with_audio
    ):
        """Raises 403 when user_id doesn't match session owner."""
        session = session_with_audio
        with pytest.raises(AppException) as exc_info:
            await get_combined_score_report(db_session, session.id, "wrong-user")
        assert exc_info.value.status_code == 403

    async def test_raises_not_found_when_no_score(
        self, db_session, session_with_audio
    ):
        """Raises NotFoundException when session has no score yet."""
        session = session_with_audio
        with pytest.raises(NotFoundException):
            await get_combined_score_report(db_session, session.id, "test-user-1")

    async def test_content_only_report(self, db_session, session_with_audio):
        """Report with only content dimensions (no voice)."""
        session = session_with_audio

        score = SessionScore(
            session_id=session.id,
            overall_score=80.0,
            passed=True,
            feedback_summary="Good performance",
        )
        db_session.add(score)
        await db_session.flush()

        detail = ScoreDetail(
            score_id=score.id,
            dimension="key_messages",
            score=80.0,
            weight=50,
            strengths="[]",
            weaknesses="[]",
            suggestions="[]",
            category="content",
        )
        db_session.add(detail)
        await db_session.commit()

        report = await get_combined_score_report(
            db_session, session.id, "test-user-1"
        )
        assert report["overall_score"] == 80.0
        # No voice dims → combined == content score
        assert report["overall_combined_score"] == 80.0
        assert len(report["content_dimensions"]) == 1
        assert len(report["voice_dimensions"]) == 0
        assert report["voice_summary"]["voice_score_status"] == "completed"

    async def test_combined_score_with_voice(
        self, db_session, session_with_audio, mock_voice_scores
    ):
        """Combined score weights content 70% + voice 30%."""
        session = session_with_audio

        score = SessionScore(
            session_id=session.id,
            overall_score=80.0,
            passed=True,
            feedback_summary="Good performance",
        )
        db_session.add(score)
        await db_session.flush()

        # Add content detail
        content_detail = ScoreDetail(
            score_id=score.id,
            dimension="key_messages",
            score=80.0,
            weight=100,
            strengths="[]",
            weaknesses="[]",
            suggestions="[]",
            category="content",
        )
        db_session.add(content_detail)

        # Add voice details
        for dim in mock_voice_scores["dimensions"]:
            voice_detail = ScoreDetail(
                score_id=score.id,
                dimension=dim["name"],
                score=dim["score"],
                weight=dim["weight"],
                strengths="[]",
                weaknesses="[]",
                suggestions="[]",
                category="voice",
            )
            db_session.add(voice_detail)
        await db_session.commit()

        report = await get_combined_score_report(
            db_session, session.id, "test-user-1"
        )

        # Voice score = (85*25 + 78*25 + 90*25 + 72*25) / 100 = 81.25
        # Combined = 80*0.7 + 81.25*0.3 = 56 + 24.375 = 80.375 ≈ 80.4
        assert report["overall_score"] == 80.0
        assert report["overall_combined_score"] == 80.4
        assert len(report["content_dimensions"]) == 1
        assert len(report["voice_dimensions"]) == 4

    async def test_report_includes_audio_url(
        self, db_session, session_with_audio
    ):
        """Report includes audio_url from session."""
        session = session_with_audio

        score = SessionScore(
            session_id=session.id,
            overall_score=75.0,
            passed=True,
            feedback_summary="OK",
        )
        db_session.add(score)
        await db_session.flush()
        await db_session.commit()

        report = await get_combined_score_report(
            db_session, session.id, "test-user-1"
        )
        assert report["audio_url"] == "audio/sessions/test/recording.webm"

    async def test_report_voice_summary_structure(
        self, db_session, session_with_audio, mock_voice_scores
    ):
        """Voice summary contains correct structure."""
        session = session_with_audio

        score = SessionScore(
            session_id=session.id,
            overall_score=80.0,
            passed=True,
            feedback_summary="Good",
        )
        db_session.add(score)
        await db_session.flush()

        for dim in mock_voice_scores["dimensions"]:
            db_session.add(ScoreDetail(
                score_id=score.id,
                dimension=dim["name"],
                score=dim["score"],
                weight=dim["weight"],
                strengths="[]",
                weaknesses="[]",
                suggestions="[]",
                category="voice",
            ))
        await db_session.commit()

        report = await get_combined_score_report(
            db_session, session.id, "test-user-1"
        )
        vs = report["voice_summary"]
        assert "overall_voice_score" in vs
        assert "voice_score_status" in vs
        assert "dimensions" in vs
        assert vs["voice_score_status"] == "completed"
        assert vs["overall_voice_score"] == 81.2  # (85+78+90+72)*25/100


class TestTriggerVoiceScoringWithPersistence:
    """Tests that trigger_voice_scoring now persists ScoreDetail records."""

    async def test_creates_voice_score_details_on_completion(
        self, db_session, monkeypatch
    ):
        """trigger_voice_scoring saves ScoreDetail records with category=voice."""
        from tests.conftest import TestSessionLocal

        monkeypatch.setattr(
            "app.services.voice_scoring_service.AsyncSessionLocal",
            TestSessionLocal,
        )

        session_id = str(uuid.uuid4())
        session = CoachingSession(
            id=session_id,
            user_id="test-user-1",
            scenario_id="fake-scenario-id",
            status="completed",
            audio_url="audio/test/rec.webm",
            voice_score_status="pending",
        )
        db_session.add(session)
        await db_session.commit()

        from app.services.voice_scoring_service import trigger_voice_scoring

        await trigger_voice_scoring(session_id)

        # Verify ScoreDetail records were created
        async with TestSessionLocal() as verify_session:
            result = await verify_session.execute(
                select(ScoreDetail).where(ScoreDetail.category == "voice")
            )
            details = list(result.scalars().all())
            assert len(details) == 4
            names = {d.dimension for d in details}
            assert names == {"fluency", "tone", "pace", "pronunciation"}
