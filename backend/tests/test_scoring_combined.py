"""Unit tests for combined scoring: voice score persistence + combined report."""

import json
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.models.scenario import Scenario
from app.models.score import ScoreDetail, SessionScore
from app.models.scoring_rubric import ScoringRubric
from app.models.session import CoachingSession
from app.models.voice_score import VoiceScore, VoiceScoreDetail
from app.services.scoring_service import get_combined_score_report
from app.services.voice_scoring_service import save_voice_score_details
from app.utils.exceptions import AppException, NotFoundException


@pytest.fixture
async def rubric_and_scenario(db_session):
    """Create a rubric and scenario for combined score tests."""
    rubric = ScoringRubric(
        name="Test Rubric",
        scenario_type="f2f",
        dimensions=json.dumps(
            [{"name": "key_messages", "weight": 100, "criteria": [], "max_score": 100}]
        ),
        is_default=True,
        created_by="test-user-1",
        content_weight=60,
        voice_weight=40,
        cu_voice_analyzer_id="testVoiceAnalyzer",
    )
    db_session.add(rubric)
    await db_session.flush()

    scenario = Scenario(
        name="Test Scenario",
        hcp_profile_id="fake-hcp",
        key_messages="[]",
        rubric_id=rubric.id,
        status="active",
        created_by="test-user-1",
        skill_id="fake-skill",
    )
    db_session.add(scenario)
    await db_session.flush()
    return rubric, scenario


@pytest.fixture
async def session_with_audio(db_session, rubric_and_scenario):
    """Create a session with audio_url for testing."""
    _, scenario = rubric_and_scenario
    session = CoachingSession(
        id=str(uuid.uuid4()),
        user_id="test-user-1",
        scenario_id=scenario.id,
        status="completed",
        audio_url="audio/sessions/test/recording.webm",
        voice_score_status="completed",
    )
    db_session.add(session)
    await db_session.commit()
    return session


@pytest.fixture
def mock_voice_scores():
    """Mock voice scoring result."""
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

    async def test_creates_voice_score_when_none_exists(
        self, db_session, session_with_audio, mock_voice_scores
    ):
        session = session_with_audio
        await save_voice_score_details(db_session, session.id, mock_voice_scores)
        await db_session.commit()

        result = await db_session.execute(
            select(VoiceScore).where(VoiceScore.session_id == session.id)
        )
        score = result.scalar_one()
        assert score.overall_voice_score == 81.3

        content_score_result = await db_session.execute(
            select(SessionScore).where(SessionScore.session_id == session.id)
        )
        assert content_score_result.scalar_one_or_none() is None

    async def test_creates_four_voice_score_details(
        self, db_session, session_with_audio, mock_voice_scores
    ):
        session = session_with_audio
        await save_voice_score_details(db_session, session.id, mock_voice_scores)
        await db_session.commit()

        result = await db_session.execute(
            select(VoiceScoreDetail).where(VoiceScoreDetail.category == "voice")
        )
        details = list(result.scalars().all())
        assert len(details) == 4
        names = {d.dimension for d in details}
        assert names == {"fluency", "tone", "pace", "pronunciation"}

    async def test_voice_details_have_correct_scores(
        self, db_session, session_with_audio, mock_voice_scores
    ):
        session = session_with_audio
        await save_voice_score_details(db_session, session.id, mock_voice_scores)
        await db_session.commit()

        result = await db_session.execute(
            select(VoiceScoreDetail)
            .where(VoiceScoreDetail.category == "voice")
            .order_by(VoiceScoreDetail.dimension)
        )
        details = list(result.scalars().all())
        scores_by_name = {d.dimension: d.score for d in details}
        assert scores_by_name["fluency"] == 85.0
        assert scores_by_name["tone"] == 78.0
        assert scores_by_name["pace"] == 90.0
        assert scores_by_name["pronunciation"] == 72.0

    async def test_preserves_existing_session_score(
        self, db_session, session_with_audio, mock_voice_scores
    ):
        session = session_with_audio

        existing_score = SessionScore(
            session_id=session.id,
            overall_score=75.0,
            passed=True,
            feedback_summary="Good content performance",
        )
        db_session.add(existing_score)
        await db_session.flush()

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

        await save_voice_score_details(db_session, session.id, mock_voice_scores)
        await db_session.commit()

        result = await db_session.execute(
            select(SessionScore).where(SessionScore.session_id == session.id)
        )
        scores = list(result.scalars().all())
        assert len(scores) == 1

        detail_result = await db_session.execute(
            select(ScoreDetail).where(ScoreDetail.score_id == existing_score.id)
        )
        all_details = list(detail_result.scalars().all())
        assert len(all_details) == 1

        voice_detail_result = await db_session.execute(
            select(VoiceScoreDetail).join(VoiceScore).where(VoiceScore.session_id == session.id)
        )
        voice_details = list(voice_detail_result.scalars().all())
        assert len(voice_details) == 4

    async def test_voice_details_weight_stored(
        self, db_session, session_with_audio, mock_voice_scores
    ):
        session = session_with_audio
        await save_voice_score_details(db_session, session.id, mock_voice_scores)
        await db_session.commit()

        result = await db_session.execute(
            select(VoiceScoreDetail).where(VoiceScoreDetail.category == "voice")
        )
        details = list(result.scalars().all())
        for d in details:
            assert d.weight == 25


class TestGetCombinedScoreReport:
    """Tests for get_combined_score_report."""

    async def test_raises_not_found_for_missing_session(self, db_session):
        with pytest.raises(NotFoundException):
            await get_combined_score_report(db_session, "nonexistent", "user-1")

    async def test_raises_forbidden_for_wrong_user(self, db_session, session_with_audio):
        session = session_with_audio
        with pytest.raises(AppException) as exc_info:
            await get_combined_score_report(db_session, session.id, "wrong-user")
        assert exc_info.value.status_code == 403

    async def test_raises_not_found_when_no_score(self, db_session, session_with_audio):
        session = session_with_audio
        with pytest.raises(NotFoundException):
            await get_combined_score_report(db_session, session.id, "test-user-1")

    async def test_content_only_report(self, db_session, session_with_audio):
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

        report = await get_combined_score_report(db_session, session.id, "test-user-1")
        assert report["overall_score"] == 80.0
        assert report["overall_combined_score"] == 80.0
        assert len(report["content_dimensions"]) == 1
        assert len(report["voice_dimensions"]) == 0
        assert report["voice_summary"]["voice_score_status"] == "completed"

    async def test_content_only_report_totals(self, db_session, session_with_audio):
        session = session_with_audio

        score = SessionScore(
            session_id=session.id,
            overall_score=80.0,
            passed=True,
            feedback_summary="Good performance",
        )
        db_session.add(score)
        await db_session.flush()

        db_session.add(
            ScoreDetail(
                score_id=score.id,
                dimension="key_messages",
                score=80.0,
                weight=100,
                strengths="[]",
                weaknesses="[]",
                suggestions="[]",
                category="content",
            )
        )
        await db_session.commit()

        report = await get_combined_score_report(db_session, session.id, "test-user-1")
        assert report["content_total"] == 80.0
        assert report["voice_total"] is None
        assert report["content_weight"] == 100
        assert report["voice_weight"] is None

    async def test_combined_report_totals_with_voice(
        self, db_session, session_with_audio, mock_voice_scores
    ):
        """Report with voice dims returns content_total, voice_total, rubric weights."""
        session = session_with_audio

        score = SessionScore(
            session_id=session.id,
            overall_score=80.0,
            passed=True,
            feedback_summary="Good",
        )
        db_session.add(score)
        await db_session.flush()

        db_session.add(
            ScoreDetail(
                score_id=score.id,
                dimension="key_messages",
                score=80.0,
                weight=100,
                strengths="[]",
                weaknesses="[]",
                suggestions="[]",
                category="content",
            )
        )
        for dim in mock_voice_scores["dimensions"]:
            db_session.add(
                ScoreDetail(
                    score_id=score.id,
                    dimension=dim["name"],
                    score=dim["score"],
                    weight=dim["weight"],
                    strengths="[]",
                    weaknesses="[]",
                    suggestions="[]",
                    category="voice",
                )
            )
        await db_session.commit()

        report = await get_combined_score_report(db_session, session.id, "test-user-1")
        assert report["content_total"] == 80.0
        # voice: (85+78+90+72)*25/100 = 81.25
        assert report["voice_total"] == 81.2
        # Rubric has content_weight=60, voice_weight=40
        assert report["content_weight"] == 60
        assert report["voice_weight"] == 40

    async def test_combined_score_with_voice(
        self, db_session, session_with_audio, mock_voice_scores
    ):
        """Combined score uses rubric weights (60% content + 40% voice)."""
        session = session_with_audio

        score = SessionScore(
            session_id=session.id,
            overall_score=80.0,
            passed=True,
            feedback_summary="Good performance",
        )
        db_session.add(score)
        await db_session.flush()

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

        report = await get_combined_score_report(db_session, session.id, "test-user-1")

        # Voice score = (85*25 + 78*25 + 90*25 + 72*25) / 100 = 81.25
        # Combined = (80*60 + 81.25*40) / 100 = 4800/100 + 3250/100 = 80.5
        assert report["overall_score"] == 80.0
        assert report["overall_combined_score"] == 80.5
        assert len(report["content_dimensions"]) == 1
        assert len(report["voice_dimensions"]) == 4

    async def test_report_includes_audio_url(self, db_session, session_with_audio):
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

        report = await get_combined_score_report(db_session, session.id, "test-user-1")
        assert report["audio_url"] == "audio/sessions/test/recording.webm"

    async def test_report_voice_summary_structure(
        self, db_session, session_with_audio, mock_voice_scores
    ):
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
            db_session.add(
                ScoreDetail(
                    score_id=score.id,
                    dimension=dim["name"],
                    score=dim["score"],
                    weight=dim["weight"],
                    strengths="[]",
                    weaknesses="[]",
                    suggestions="[]",
                    category="voice",
                )
            )
        await db_session.commit()

        report = await get_combined_score_report(db_session, session.id, "test-user-1")
        vs = report["voice_summary"]
        assert "overall_voice_score" in vs
        assert "voice_score_status" in vs
        assert "dimensions" in vs
        assert vs["voice_score_status"] == "completed"
        assert vs["overall_voice_score"] == 81.2


class TestTriggerVoiceScoringWithPersistence:
    """Tests that trigger_voice_scoring persists voice score records."""

    async def test_creates_voice_score_details_on_completion(
        self, db_session, monkeypatch, rubric_and_scenario
    ):
        """trigger_voice_scoring saves VoiceScoreDetail records."""
        from tests.conftest import TestSessionLocal

        monkeypatch.setattr(
            "app.services.voice_scoring_service.AsyncSessionLocal",
            TestSessionLocal,
        )

        _, scenario = rubric_and_scenario
        session_id = str(uuid.uuid4())
        session = CoachingSession(
            id=session_id,
            user_id="test-user-1",
            scenario_id=scenario.id,
            status="completed",
            audio_url="https://blob.core.windows.net/audio/test.webm",
            voice_score_status="pending",
        )
        db_session.add(session)
        await db_session.commit()

        from app.services.pronunciation_assessment_service import PronunciationAssessmentResult
        from app.services.voice_scoring_service import trigger_voice_scoring

        speech_result = PronunciationAssessmentResult(
            dimensions=[
                {"name": "fluency", "score": 85, "weight": 25},
                {"name": "tone", "score": 78, "weight": 25},
                {"name": "pace", "score": 90, "weight": 25},
                {"name": "pronunciation", "score": 72, "weight": 25},
            ],
            feedback_summary="Overall good",
            raw_result={},
        )
        mock_storage = AsyncMock()
        mock_storage.read = AsyncMock(return_value=b"audio-bytes")

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
            ),
            patch(
                "app.services.voice_scoring_service.get_storage",
                return_value=mock_storage,
            ),
        ):
            await trigger_voice_scoring(session_id)

        async with TestSessionLocal() as verify_session:
            result = await verify_session.execute(
                select(VoiceScoreDetail).where(VoiceScoreDetail.category == "voice")
            )
            details = list(result.scalars().all())
            assert len(details) == 4
            names = {d.dimension for d in details}
            assert names == {"fluency", "tone", "pace", "pronunciation"}
