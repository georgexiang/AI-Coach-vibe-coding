"""Tests for the scoring service: mock score generation and DB integration."""

import json

import pytest

from app.models.hcp_profile import HcpProfile
from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.session import CoachingSession
from app.models.user import User
from app.services.auth import get_password_hash
from app.services.scoring_service import (
    _extract_skill_criteria,
    _generate_mock_scores,
    get_session_score,
    score_session,
)
from app.utils.exceptions import AppException, NotFoundException


async def _seed_completed_session(db) -> tuple[str, str, str]:
    """Create user, HCP profile, scenario, and a completed session with messages.

    Returns (user_id, session_id, scenario_id).
    """
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

    scenario = Scenario(
        name="Test Scenario",
        product="Brukinsa",
        hcp_profile_id=hcp.id,
        key_messages=json.dumps(["Superior PFS", "Better safety"]),
        weight_key_message=30,
        weight_objection_handling=25,
        weight_communication=20,
        weight_product_knowledge=15,
        weight_scientific_info=10,
        pass_threshold=70,
        status="active",
        created_by=user.id,
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

    # Add messages
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


class TestGenerateMockScores:
    """Tests for the pure _generate_mock_scores function."""

    def _make_scenario(self, **overrides):
        defaults = {
            "name": "S",
            "product": "TestDrug",
            "hcp_profile_id": "p1",
            "key_messages": json.dumps(["Key msg 1", "Key msg 2"]),
            "weight_key_message": 30,
            "weight_objection_handling": 25,
            "weight_communication": 20,
            "weight_product_knowledge": 15,
            "weight_scientific_info": 10,
            "pass_threshold": 70,
            "status": "active",
            "created_by": "u1",
        }
        defaults.update(overrides)
        return Scenario(**defaults)

    def _make_messages(self, count=2):
        msgs = []
        for i in range(count):
            m = SessionMessage(
                session_id="test-session-id",
                role="user" if i % 2 == 0 else "assistant",
                content=f"Message content {i}",
                message_index=i,
            )
            msgs.append(m)
        return msgs

    async def test_returns_five_dimensions(self):
        scenario = self._make_scenario()
        messages = self._make_messages()
        km_status = [
            {"message": "Key msg 1", "delivered": True},
            {"message": "Key msg 2", "delivered": False},
        ]
        result = _generate_mock_scores(scenario, messages, km_status)
        assert len(result["dimensions"]) == 5

    async def test_dimension_names_correct(self):
        scenario = self._make_scenario()
        result = _generate_mock_scores(scenario, self._make_messages(), [])
        dim_names = {d["dimension"] for d in result["dimensions"]}
        assert dim_names == {
            "key_message",
            "objection_handling",
            "communication",
            "product_knowledge",
            "scientific_info",
        }

    async def test_scores_in_valid_range(self):
        scenario = self._make_scenario()
        km_status = [{"message": "m", "delivered": True}]
        result = _generate_mock_scores(scenario, self._make_messages(), km_status)
        for dim in result["dimensions"]:
            assert 60 <= dim["score"] <= 95

    async def test_overall_score_is_weighted_average(self):
        scenario = self._make_scenario()
        result = _generate_mock_scores(scenario, self._make_messages(), [])
        expected = sum(d["score"] * d["weight"] / 100 for d in result["dimensions"])
        assert abs(result["overall_score"] - round(expected, 1)) < 0.01

    async def test_passed_depends_on_threshold(self):
        # Very low threshold should pass
        scenario = self._make_scenario(pass_threshold=10)
        km_status = [{"message": "m", "delivered": True}]
        result = _generate_mock_scores(scenario, self._make_messages(), km_status)
        assert result["passed"] is True

    async def test_high_threshold_may_fail(self):
        scenario = self._make_scenario(pass_threshold=100)
        result = _generate_mock_scores(scenario, self._make_messages(), [])
        # Score is always < 100 given the 60-95 range
        assert result["passed"] is False

    async def test_feedback_summary_differs_for_pass_and_fail(self):
        scenario_pass = self._make_scenario(pass_threshold=10)
        scenario_fail = self._make_scenario(pass_threshold=100)
        km = [{"message": "m", "delivered": True}]

        result_pass = _generate_mock_scores(scenario_pass, self._make_messages(), km)
        result_fail = _generate_mock_scores(scenario_fail, self._make_messages(), km)

        assert "Good performance" in result_pass["feedback_summary"]
        assert "below the passing threshold" in result_fail["feedback_summary"]

    async def test_strengths_reference_delivered_messages(self):
        scenario = self._make_scenario()
        km_status = [
            {"message": "Key msg 1", "delivered": True},
            {"message": "Key msg 2", "delivered": False},
        ]
        result = _generate_mock_scores(scenario, self._make_messages(), km_status)
        km_dim = next(d for d in result["dimensions"] if d["dimension"] == "key_message")
        assert len(km_dim["strengths"]) >= 1
        assert "1 of 2" in km_dim["strengths"][0]["text"]


class TestScoreSessionIntegration:
    """DB integration tests for score_session and get_session_score."""

    async def test_score_session_creates_score_and_details(self, db_session):
        _, session_id, _ = await _seed_completed_session(db_session)
        score = await score_session(db_session, session_id)

        assert score is not None
        assert score.session_id == session_id
        assert score.overall_score > 0
        assert isinstance(score.passed, bool)
        assert len(score.details) == 5

    async def test_score_session_updates_session_status_to_scored(self, db_session):
        from sqlalchemy import select

        _, session_id, _ = await _seed_completed_session(db_session)
        await score_session(db_session, session_id)

        result = await db_session.execute(
            select(CoachingSession).where(CoachingSession.id == session_id)
        )
        session = result.scalar_one()
        assert session.status == "scored"
        assert session.overall_score is not None

    async def test_score_session_raises_for_nonexistent_session(self, db_session):
        with pytest.raises(NotFoundException):
            await score_session(db_session, "nonexistent-id")

    async def test_score_session_raises_for_already_scored(self, db_session):
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

        scenario = Scenario(
            name="S",
            product="Drug",
            hcp_profile_id=hcp.id,
            key_messages="[]",
            status="active",
            created_by=user.id,
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

    async def test_get_session_score_returns_none_when_not_scored(self, db_session):
        _, session_id, _ = await _seed_completed_session(db_session)
        score = await get_session_score(db_session, session_id)
        assert score is None

    async def test_get_session_score_returns_score_after_scoring(self, db_session):
        _, session_id, _ = await _seed_completed_session(db_session)
        await score_session(db_session, session_id)

        score = await get_session_score(db_session, session_id)
        assert score is not None
        assert score.session_id == session_id
        assert len(score.details) == 5


class TestExtractSkillCriteria:
    """Tests for _extract_skill_criteria helper that extracts assessment criteria from Skill content."""

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
        # Should not include the next section
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
            weights={"key_message": 30, "objection_handling": 25, "communication": 20,
                     "product_knowledge": 15, "scientific_info": 10},
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
            weights={"key_message": 30, "objection_handling": 25, "communication": 20,
                     "product_knowledge": 15, "scientific_info": 10},
        )
        assert "Skill-Specific Assessment Criteria" not in prompt
