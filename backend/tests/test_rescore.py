"""Tests for re-scoring functionality: rescore endpoint and service method."""

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.models.hcp_profile import HcpProfile
from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.score import ScoreDetail, SessionScore
from app.models.scoring_rubric import ScoringRubric
from app.models.session import CoachingSession
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from app.services.scoring_service import rescore_session
from app.utils.exceptions import AppException, NotFoundException
from tests.conftest import TestSessionLocal

_MOCK_LLM_RESULT = {
    "overall_score": 82.0,
    "passed": True,
    "feedback_summary": "Improved performance after re-evaluation.",
    "dimensions": [
        {
            "dimension": "key_message",
            "score": 85,
            "weight": 30,
            "category": "content",
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        {
            "dimension": "objection_handling",
            "score": 80,
            "weight": 25,
            "category": "content",
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        {
            "dimension": "communication",
            "score": 82,
            "weight": 20,
            "category": "content",
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        {
            "dimension": "product_knowledge",
            "score": 78,
            "weight": 15,
            "category": "content",
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        {
            "dimension": "scientific_info",
            "score": 75,
            "weight": 10,
            "category": "content",
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
    ],
}

_DEFAULT_RUBRIC_DIMS = json.dumps(
    [
        {"name": "key_message", "weight": 30, "criteria": [], "max_score": 100.0},
        {"name": "objection_handling", "weight": 25, "criteria": [], "max_score": 100.0},
        {"name": "communication", "weight": 20, "criteria": [], "max_score": 100.0},
        {"name": "product_knowledge", "weight": 15, "criteria": [], "max_score": 100.0},
        {"name": "scientific_info", "weight": 10, "criteria": [], "max_score": 100.0},
    ]
)


@pytest.fixture(autouse=True)
def mock_llm_scoring():
    """Mock LLM scoring for all rescore tests."""
    with patch(
        "app.services.scoring_service.score_with_llm",
        new_callable=AsyncMock,
        return_value=_MOCK_LLM_RESULT,
    ):
        yield


async def _setup_scored_session() -> tuple[str, str, str]:
    """Create a user, scenario, and a SCORED session (already scored once).

    Returns (user_id, session_id, bearer_token).
    """
    async with TestSessionLocal() as session:
        user = User(
            username="rescoreuser",
            email="rescoreuser@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Rescore User",
            role="user",
        )
        session.add(user)
        await session.flush()

        hcp = HcpProfile(
            name="Dr. Rescore",
            specialty="Oncology",
            created_by=user.id,
        )
        session.add(hcp)
        await session.flush()

        rubric = ScoringRubric(
            name="Rescore Rubric",
            scenario_type="f2f",
            dimensions=_DEFAULT_RUBRIC_DIMS,
            is_default=True,
            created_by=user.id,
        )
        session.add(rubric)
        await session.flush()

        scenario = Scenario(
            name="Rescore Scenario",
            hcp_profile_id=hcp.id,
            key_messages=json.dumps(["PFS", "Safety"]),
            skill_id="test-skill-id",
            status="active",
            created_by=user.id,
            rubric_id=rubric.id,
        )
        session.add(scenario)
        await session.flush()

        km_status = json.dumps(
            [
                {"message": "PFS", "delivered": True, "detected_at": None},
                {"message": "Safety", "delivered": True, "detected_at": None},
            ]
        )

        # Create session already in "scored" status with existing score
        coaching_session = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
            status="scored",
            key_messages_status=km_status,
            overall_score=70.0,
            passed=True,
        )
        session.add(coaching_session)
        await session.flush()

        # Add message(s) to the session
        msg = SessionMessage(
            session_id=coaching_session.id,
            role="user",
            content="PFS data shows significant improvement in survival outcomes.",
            message_index=0,
        )
        session.add(msg)
        await session.flush()

        msg2 = SessionMessage(
            session_id=coaching_session.id,
            role="assistant",
            content="That's interesting. Can you tell me about the safety profile?",
            message_index=1,
        )
        session.add(msg2)
        await session.flush()

        msg3 = SessionMessage(
            session_id=coaching_session.id,
            role="user",
            content="The safety data demonstrates a favorable tolerability profile.",
            message_index=2,
        )
        session.add(msg3)
        await session.flush()

        # Create existing SessionScore
        existing_score = SessionScore(
            session_id=coaching_session.id,
            overall_score=70.0,
            passed=True,
            feedback_summary="Original scoring feedback.",
        )
        session.add(existing_score)
        await session.flush()

        # Create existing ScoreDetails
        for dim_name, score_val, weight in [
            ("key_message", 72, 30),
            ("objection_handling", 68, 25),
            ("communication", 70, 20),
            ("product_knowledge", 65, 15),
            ("scientific_info", 60, 10),
        ]:
            detail = ScoreDetail(
                score_id=existing_score.id,
                dimension=dim_name,
                score=score_val,
                weight=weight,
                strengths="[]",
                weaknesses="[]",
                suggestions="[]",
                category="content",
            )
            session.add(detail)

        await session.commit()

        token = create_access_token(data={"sub": user.id})
        return user.id, coaching_session.id, token


async def _setup_completed_session() -> tuple[str, str, str]:
    """Create a session in 'completed' status (not yet scored).

    Returns (user_id, session_id, bearer_token).
    """
    async with TestSessionLocal() as session:
        user = User(
            username="completeduser",
            email="completeduser@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Completed User",
            role="user",
        )
        session.add(user)
        await session.flush()

        hcp = HcpProfile(
            name="Dr. Completed",
            specialty="Cardiology",
            created_by=user.id,
        )
        session.add(hcp)
        await session.flush()

        rubric = ScoringRubric(
            name="Completed Rubric",
            scenario_type="f2f",
            dimensions=_DEFAULT_RUBRIC_DIMS,
            is_default=False,
            created_by=user.id,
        )
        session.add(rubric)
        await session.flush()

        scenario = Scenario(
            name="Completed Scenario",
            hcp_profile_id=hcp.id,
            key_messages=json.dumps(["Efficacy"]),
            skill_id="test-skill-id",
            status="active",
            created_by=user.id,
            rubric_id=rubric.id,
        )
        session.add(scenario)
        await session.flush()

        coaching_session = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
            status="completed",
            key_messages_status=json.dumps(
                [{"message": "Efficacy", "delivered": False, "detected_at": None}]
            ),
        )
        session.add(coaching_session)
        await session.flush()

        msg = SessionMessage(
            session_id=coaching_session.id,
            role="user",
            content="Hello doctor.",
            message_index=0,
        )
        session.add(msg)
        await session.commit()

        token = create_access_token(data={"sub": user.id})
        return user.id, coaching_session.id, token


class TestRescoreServiceMethod:
    """Tests for scoring_service.rescore_session()."""

    async def test_rescore_deletes_old_score_and_creates_new(self):
        """Rescore should delete old scores and create new ones."""
        _, session_id, _ = await _setup_scored_session()

        async with TestSessionLocal() as db:
            new_score = await rescore_session(db, session_id)
            await db.commit()

        # Verify new score has updated values from mock
        assert new_score.overall_score == 82.0
        assert new_score.passed is True
        assert new_score.feedback_summary == "Improved performance after re-evaluation."

    async def test_rescore_updates_session_status_to_scored(self):
        """After rescore, session status should be 'scored'."""
        _, session_id, _ = await _setup_scored_session()

        async with TestSessionLocal() as db:
            await rescore_session(db, session_id)
            await db.commit()

        # Verify session is still in 'scored' status
        from sqlalchemy import select

        async with TestSessionLocal() as db:
            result = await db.execute(
                select(CoachingSession).where(CoachingSession.id == session_id)
            )
            session = result.scalar_one()
            assert session.status == "scored"
            assert session.overall_score == 82.0
            assert session.passed is True

    async def test_rescore_raises_for_not_scored_session(self):
        """Rescore should reject sessions that haven't been scored yet."""
        _, session_id, _ = await _setup_completed_session()

        async with TestSessionLocal() as db:
            with pytest.raises(AppException) as exc_info:
                await rescore_session(db, session_id)
            assert exc_info.value.status_code == 409
            assert "NOT_SCORED" in str(exc_info.value.code)

    async def test_rescore_raises_for_nonexistent_session(self):
        """Rescore should raise 404 for non-existent session."""
        async with TestSessionLocal() as db:
            with pytest.raises(NotFoundException):
                await rescore_session(db, "nonexistent-id")

    async def test_rescore_creates_correct_number_of_details(self):
        """After rescore, correct number of ScoreDetail records should exist."""
        _, session_id, _ = await _setup_scored_session()

        async with TestSessionLocal() as db:
            new_score = await rescore_session(db, session_id)
            await db.commit()

        # Check ScoreDetail records
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        async with TestSessionLocal() as db:
            result = await db.execute(
                select(SessionScore)
                .options(selectinload(SessionScore.details))
                .where(SessionScore.session_id == session_id)
            )
            score = result.scalar_one()
            assert len(score.details) == 5  # 5 dimensions in mock result

    async def test_rescore_only_one_score_exists_after(self):
        """After rescore, only one SessionScore should exist for the session."""
        _, session_id, _ = await _setup_scored_session()

        async with TestSessionLocal() as db:
            await rescore_session(db, session_id)
            await db.commit()

        from sqlalchemy import func, select

        async with TestSessionLocal() as db:
            result = await db.execute(
                select(func.count())
                .select_from(SessionScore)
                .where(SessionScore.session_id == session_id)
            )
            count = result.scalar_one()
            assert count == 1


class TestRescoreAPIEndpoint:
    """Tests for POST /api/v1/scoring/sessions/{session_id}/rescore."""

    async def test_rescore_returns_200_with_new_score(self, client):
        """Successful rescore should return 200 with updated score data."""
        _, session_id, token = await _setup_scored_session()

        response = await client.post(
            f"/api/v1/scoring/sessions/{session_id}/rescore",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["overall_score"] == 82.0
        assert data["passed"] is True
        assert data["session_id"] == session_id
        assert len(data["details"]) == 5
        assert data["feedback_summary"] == "Improved performance after re-evaluation."

    async def test_rescore_not_scored_returns_409(self, client):
        """Attempting to rescore a session that hasn't been scored should return 409."""
        _, session_id, token = await _setup_completed_session()

        response = await client.post(
            f"/api/v1/scoring/sessions/{session_id}/rescore",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 409

    async def test_rescore_no_auth_returns_401(self, client):
        """Rescore without auth token should return 401."""
        response = await client.post(
            "/api/v1/scoring/sessions/some-id/rescore",
        )
        assert response.status_code == 401

    async def test_rescore_wrong_user_returns_403(self, client):
        """Rescore by a different user should return 403."""
        _, session_id, _ = await _setup_scored_session()

        # Create another user
        async with TestSessionLocal() as session:
            other = User(
                username="other_rescore",
                email="other_rescore@test.com",
                hashed_password=get_password_hash("pass"),
                full_name="Other User",
                role="user",
            )
            session.add(other)
            await session.commit()
            await session.refresh(other)
            other_token = create_access_token(data={"sub": other.id})

        response = await client.post(
            f"/api/v1/scoring/sessions/{session_id}/rescore",
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert response.status_code == 403

    async def test_rescore_nonexistent_session_returns_404(self, client):
        """Rescore for non-existent session should return 404."""
        _, _, token = await _setup_scored_session()

        response = await client.post(
            "/api/v1/scoring/sessions/nonexistent-id-12345/rescore",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404

    async def test_rescore_can_be_called_multiple_times(self, client):
        """Rescore should be repeatable - score, rescore, rescore again."""
        _, session_id, token = await _setup_scored_session()

        # First rescore
        response1 = await client.post(
            f"/api/v1/scoring/sessions/{session_id}/rescore",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response1.status_code == 200

        # Second rescore (should also work since session is now "scored" again)
        response2 = await client.post(
            f"/api/v1/scoring/sessions/{session_id}/rescore",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response2.status_code == 200
        data = response2.json()
        assert data["overall_score"] == 82.0
