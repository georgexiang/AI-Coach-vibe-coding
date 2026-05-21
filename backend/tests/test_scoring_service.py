"""Tests for the scoring service: LLM scoring integration and DB operations."""

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.models.hcp_profile import HcpProfile
from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.scoring_rubric import ScoringRubric
from app.models.session import CoachingSession
from app.models.user import User
from app.services.auth import get_password_hash
from app.services.scoring_service import (
    _extract_skill_criteria,
    get_session_score,
    score_session,
)
from app.utils.exceptions import AppException, NotFoundException

DEFAULT_RUBRIC_DIMENSIONS = [
    {"name": "key_message", "weight": 30, "criteria": [], "max_score": 100.0},
    {"name": "objection_handling", "weight": 25, "criteria": [], "max_score": 100.0},
    {"name": "communication", "weight": 20, "criteria": [], "max_score": 100.0},
    {"name": "product_knowledge", "weight": 15, "criteria": [], "max_score": 100.0},
    {"name": "scientific_info", "weight": 10, "criteria": [], "max_score": 100.0},
]

MOCK_LLM_RESULT = {
    "overall_score": 75.0,
    "passed": True,
    "feedback_summary": "Good performance overall.",
    "dimensions": [
        {
            "dimension": "key_message",
            "score": 80,
            "weight": 30,
            "category": "content",
            "strengths": [{"text": "Delivered PFS data", "quote": "Superior PFS"}],
            "weaknesses": [{"text": "Missed safety message", "quote": None}],
            "suggestions": ["Cover all key messages"],
        },
        {
            "dimension": "objection_handling",
            "score": 70,
            "weight": 25,
            "category": "content",
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        {
            "dimension": "communication",
            "score": 75,
            "weight": 20,
            "category": "content",
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        {
            "dimension": "product_knowledge",
            "score": 72,
            "weight": 15,
            "category": "content",
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        {
            "dimension": "scientific_info",
            "score": 68,
            "weight": 10,
            "category": "content",
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
    ],
}


async def _seed_completed_session(db) -> tuple[str, str, str]:
    """Create user, HCP profile, scenario, and a completed session with messages."""
    user = User(
        username="scorer",
        email="scorer@test.com",
        hashed_password=get_password_hash("pass"),
        full_name="Scorer User",
        role="user",
    )
    db.add(user)
    await db.flush()

    hcp = HcpProfile(
        name="Dr. Li",
        specialty="Cardiology",
        created_by=user.id,
    )
    db.add(hcp)
    await db.flush()

    rubric = ScoringRubric(
        name="Test Rubric",
        scenario_type="f2f",
        dimensions=json.dumps(DEFAULT_RUBRIC_DIMENSIONS),
        is_default=True,
        created_by=user.id,
    )
    db.add(rubric)
    await db.flush()

    scenario = Scenario(
        name="Test Scenario",
        hcp_profile_id=hcp.id,
        key_messages=json.dumps(["Superior PFS", "Better safety"]),
        rubric_id=rubric.id,
        pass_threshold=70,
        status="active",
        created_by=user.id,
        skill_id="test-skill-id",
    )
    db.add(scenario)
    await db.flush()

    km_status = json.dumps(
        [
            {"message": "Superior PFS", "delivered": True, "detected_at": "2024-01-01T00:00:00"},
            {"message": "Better safety", "delivered": False, "detected_at": None},
        ]
    )

    session = CoachingSession(
        user_id=user.id,
        scenario_id=scenario.id,
        status="completed",
        key_messages_status=km_status,
    )
    db.add(session)
    await db.flush()

    msg1 = SessionMessage(
        session_id=session.id,
        role="user",
        content="Brukinsa has superior PFS data compared to ibrutinib.",
        message_index=0,
    )
    msg2 = SessionMessage(
        session_id=session.id,
        role="assistant",
        content="Interesting, tell me more about that.",
        message_index=1,
    )
    db.add_all([msg1, msg2])
    await db.flush()

    return user.id, session.id, scenario.id


class TestScoreSessionIntegration:
    """DB integration tests for score_session and get_session_score."""

    @patch("app.services.scoring_service.score_with_llm", new_callable=AsyncMock)
    async def test_score_session_creates_score_and_details(
        self, mock_llm, db_session
    ):
        mock_llm.return_value = MOCK_LLM_RESULT
        _, session_id, _ = await _seed_completed_session(db_session)
        score = await score_session(db_session, session_id)

        assert score is not None
        assert score.session_id == session_id
        assert score.overall_score == 75.0
        assert score.passed is True
        assert len(score.details) == 5

    @patch("app.services.scoring_service.score_with_llm", new_callable=AsyncMock)
    async def test_score_session_updates_session_status_to_scored(
        self, mock_llm, db_session
    ):
        from sqlalchemy import select

        mock_llm.return_value = MOCK_LLM_RESULT
        _, session_id, _ = await _seed_completed_session(db_session)
        await score_session(db_session, session_id)

        result = await db_session.execute(
            select(CoachingSession).where(CoachingSession.id == session_id)
        )
        session = result.scalar_one()
        assert session.status == "scored"
        assert session.overall_score == 75.0

    async def test_score_session_raises_for_nonexistent_session(self, db_session):
        with pytest.raises(NotFoundException):
            await score_session(db_session, "nonexistent-id")

    @patch("app.services.scoring_service.score_with_llm", new_callable=AsyncMock)
    async def test_score_session_raises_for_already_scored(
        self, mock_llm, db_session
    ):
        mock_llm.return_value = MOCK_LLM_RESULT
        _, session_id, _ = await _seed_completed_session(db_session)
        await score_session(db_session, session_id)

        with pytest.raises(AppException) as exc_info:
            await score_session(db_session, session_id)
        assert exc_info.value.code == "ALREADY_SCORED"

    async def test_score_session_raises_for_in_progress_session(self, db_session):
        user = User(
            username="u2",
            email="u2@test.com",
            hashed_password=get_password_hash("p"),
            full_name="U2",
            role="user",
        )
        db_session.add(user)
        await db_session.flush()

        hcp = HcpProfile(name="Dr. X", specialty="Derm", created_by=user.id)
        db_session.add(hcp)
        await db_session.flush()

        rubric = ScoringRubric(
            name="Rubric",
            scenario_type="f2f",
            dimensions=json.dumps(DEFAULT_RUBRIC_DIMENSIONS),
            is_default=False,
            created_by=user.id,
        )
        db_session.add(rubric)
        await db_session.flush()

        scenario = Scenario(
            name="S",
            hcp_profile_id=hcp.id,
            key_messages="[]",
            rubric_id=rubric.id,
            status="active",
            created_by=user.id,
            skill_id="test-skill-id",
        )
        db_session.add(scenario)
        await db_session.flush()

        session = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
            status="in_progress",
            key_messages_status="[]",
        )
        db_session.add(session)
        await db_session.flush()

        with pytest.raises(AppException) as exc_info:
            await score_session(db_session, session.id)
        assert exc_info.value.code == "INVALID_STATUS"

    @patch("app.services.scoring_service.score_with_llm", new_callable=AsyncMock)
    async def test_score_session_propagates_503_on_llm_failure(
        self, mock_llm, db_session
    ):
        from app.utils.exceptions import ScoringUnavailableException

        mock_llm.side_effect = ScoringUnavailableException("LLM unavailable")
        _, session_id, _ = await _seed_completed_session(db_session)

        with pytest.raises(ScoringUnavailableException):
            await score_session(db_session, session_id)

    async def test_get_session_score_returns_none_when_not_scored(self, db_session):
        _, session_id, _ = await _seed_completed_session(db_session)
        score = await get_session_score(db_session, session_id)
        assert score is None

    @patch("app.services.scoring_service.score_with_llm", new_callable=AsyncMock)
    async def test_get_session_score_returns_score_after_scoring(
        self, mock_llm, db_session
    ):
        mock_llm.return_value = MOCK_LLM_RESULT
        _, session_id, _ = await _seed_completed_session(db_session)
        await score_session(db_session, session_id)

        score = await get_session_score(db_session, session_id)
        assert score is not None
        assert score.session_id == session_id
        assert len(score.details) == 5

    @patch("app.services.scoring_service.score_with_llm", new_callable=AsyncMock)
    async def test_score_details_have_content_category(self, mock_llm, db_session):
        mock_llm.return_value = MOCK_LLM_RESULT
        _, session_id, _ = await _seed_completed_session(db_session)
        score = await score_session(db_session, session_id)

        for detail in score.details:
            assert detail.category == "content"


class TestExtractSkillCriteria:
    """Tests for _extract_skill_criteria helper."""

    def test_returns_empty_for_none_skill(self):
        assert _extract_skill_criteria(None) == ""

    def test_returns_empty_for_skill_without_content(self):
        from unittest.mock import MagicMock

        skill = MagicMock()
        skill.content = ""
        assert _extract_skill_criteria(skill) == ""

    def test_extracts_assessment_rubric_section(self):
        from unittest.mock import MagicMock

        skill = MagicMock()
        skill.content = (
            "# Skill - Coaching Protocol\n\n"
            "## Overview\n\nSome overview text.\n\n"
            "## SOP Steps\n\n### Step 1: Opening\n\nGreet the HCP.\n\n"
            "## Assessment Rubric\n\n"
            "| Criterion | Description | Weight |\n"
            "|-----------|-------------|--------|\n"
            "| Key Message Delivery | Did the MR deliver key messages? | 30% |\n"
            "| Objection Handling | How well were objections handled? | 25% |\n\n"
            "## Key Knowledge Points\n\nSome knowledge."
        )
        result = _extract_skill_criteria(skill)
        assert "Assessment Rubric" in result
        assert "Key Message Delivery" in result
        assert "Objection Handling" in result
        assert "Key Knowledge Points" not in result

    def test_extracts_assessment_fallback_section(self):
        from unittest.mock import MagicMock

        skill = MagicMock()
        skill.content = (
            "# Protocol\n\n"
            "## Assessment\n\n"
            "Score MRs on communication skills.\n\n"
            "## References\n\nSome refs."
        )
        result = _extract_skill_criteria(skill)
        assert "Assessment" in result
        assert "communication skills" in result
        assert "References" not in result

    def test_returns_empty_when_no_assessment_section(self):
        from unittest.mock import MagicMock

        skill = MagicMock()
        skill.content = "# Simple Protocol\n\n## Steps\n\nJust steps, no rubric."
        assert _extract_skill_criteria(skill) == ""

    def test_handles_assessment_at_end_of_content(self):
        from unittest.mock import MagicMock

        skill = MagicMock()
        skill.content = (
            "# Protocol\n\n"
            "## Assessment Rubric\n\n"
            "| Criterion | Description | Weight |\n"
            "| Accuracy | Is info accurate? | 50% |\n"
        )
        result = _extract_skill_criteria(skill)
        assert "Accuracy" in result


class TestBuildScoringPromptWithSkillCriteria:
    """Tests that build_scoring_prompt correctly incorporates skill_criteria."""

    def test_prompt_includes_skill_criteria_section(self):
        from app.services.scoring_engine import build_scoring_prompt

        criteria = (
            "## Assessment Rubric\n\n"
            "| Criterion | Description | Weight |\n"
            "| Opening | Did MR greet professionally? | 20% |"
        )
        prompt = build_scoring_prompt(
            scenario_data={
                "product": "TestDrug",
                "therapeutic_area": "Oncology",
                "difficulty": "medium",
                "key_messages": "[]",
                "hcp_profile": {"name": "Dr. Test"},
            },
            messages=[{"role": "user", "content": "Hello doctor"}],
            key_messages_status=[],
            rubric_dimensions=DEFAULT_RUBRIC_DIMENSIONS,
            skill_criteria=criteria,
        )
        assert "Skill-Specific Assessment Criteria" in prompt
        assert "Opening" in prompt
        assert "Did MR greet professionally?" in prompt

    def test_prompt_without_skill_criteria_has_no_section(self):
        from app.services.scoring_engine import build_scoring_prompt

        prompt = build_scoring_prompt(
            scenario_data={
                "product": "TestDrug",
                "therapeutic_area": "Oncology",
                "difficulty": "medium",
                "key_messages": "[]",
                "hcp_profile": {},
            },
            messages=[{"role": "user", "content": "Hello"}],
            key_messages_status=[],
            rubric_dimensions=DEFAULT_RUBRIC_DIMENSIONS,
        )
        assert "Skill-Specific Assessment Criteria" not in prompt
