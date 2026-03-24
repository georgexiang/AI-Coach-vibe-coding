"""Extended tests for Scoring API: score history gaps and response validation."""

import json

from app.models.hcp_profile import HcpProfile
from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.session import CoachingSession
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _setup_completed_session(
    username: str = "score_ext_user",
    session_status: str = "completed",
) -> tuple[str, str, str]:
    """Create user, HCP, scenario, and a session with messages.

    Returns (user_id, session_id, bearer_token).
    """
    async with TestSessionLocal() as session:
        user = User(
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Score Extended User",
            role="user",
        )
        session.add(user)
        await session.flush()

        hcp = HcpProfile(
            name="Dr. Score Ext",
            specialty="Oncology",
            created_by=user.id,
        )
        session.add(hcp)
        await session.flush()

        scenario = Scenario(
            name="Score Ext Scenario",
            product="Brukinsa",
            hcp_profile_id=hcp.id,
            key_messages=json.dumps(["PFS data", "Safety profile"]),
            status="active",
            created_by=user.id,
        )
        session.add(scenario)
        await session.flush()

        km_status = json.dumps(
            [
                {"message": "PFS data", "delivered": True, "detected_at": None},
                {"message": "Safety profile", "delivered": False, "detected_at": None},
            ]
        )

        coaching_session = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
            status=session_status,
            key_messages_status=km_status,
        )
        session.add(coaching_session)
        await session.flush()

        msg = SessionMessage(
            session_id=coaching_session.id,
            role="user",
            content="Tell me about PFS data",
            message_index=0,
        )
        session.add(msg)
        await session.commit()

        token = create_access_token(data={"sub": user.id})
        return user.id, coaching_session.id, token


class TestTriggerScoringExtended:
    """Extended tests for POST /api/v1/scoring/sessions/{id}/score."""

    async def test_score_response_full_shape(self, client):
        """Verify the full response shape with all expected fields."""
        _, session_id, token = await _setup_completed_session(username="score_shape_user")

        response = await client.post(
            f"/api/v1/scoring/sessions/{session_id}/score",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()

        # Top-level fields
        assert "id" in data
        assert "session_id" in data
        assert data["session_id"] == session_id
        assert "overall_score" in data
        assert isinstance(data["overall_score"], (int, float))
        assert 0 <= data["overall_score"] <= 100
        assert "passed" in data
        assert isinstance(data["passed"], bool)
        assert "feedback_summary" in data
        assert len(data["feedback_summary"]) > 0
        assert "created_at" in data

        # Details array
        assert "details" in data
        assert isinstance(data["details"], list)
        assert len(data["details"]) == 5

        # Each detail should have dimension, score, weight
        for detail in data["details"]:
            assert "dimension" in detail
            assert "score" in detail
            assert "weight" in detail
            assert "strengths" in detail
            assert "weaknesses" in detail
            assert "suggestions" in detail

    async def test_scoring_in_progress_session_returns_409(self, client):
        """Cannot score a session that is still in_progress."""
        _, session_id, token = await _setup_completed_session(
            username="score_inprog_user",
            session_status="in_progress",
        )

        response = await client.post(
            f"/api/v1/scoring/sessions/{session_id}/score",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 409

    async def test_scoring_created_session_returns_409(self, client):
        """Cannot score a session that is still 'created'."""
        _, session_id, token = await _setup_completed_session(
            username="score_created_user",
            session_status="created",
        )

        response = await client.post(
            f"/api/v1/scoring/sessions/{session_id}/score",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 409

    async def test_scoring_nonexistent_session_returns_404(self, client):
        """Scoring a nonexistent session returns 404."""
        _, _, token = await _setup_completed_session(username="score_notfound_user")

        response = await client.post(
            "/api/v1/scoring/sessions/nonexistent-id/score",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404


class TestGetSessionScoreExtended:
    """Extended tests for GET /api/v1/scoring/sessions/{id}/score."""

    async def test_get_score_not_scored_returns_404(self, client):
        """Session without a score should return 404."""
        _, session_id, token = await _setup_completed_session(username="getscore_404_user")

        response = await client.get(
            f"/api/v1/scoring/sessions/{session_id}/score",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404

    async def test_get_score_after_scoring_full_shape(self, client):
        """After scoring, GET returns the full score object."""
        _, session_id, token = await _setup_completed_session(username="getscore_full_user")

        # Score first
        score_resp = await client.post(
            f"/api/v1/scoring/sessions/{session_id}/score",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert score_resp.status_code == 201

        # Now GET the score
        response = await client.get(
            f"/api/v1/scoring/sessions/{session_id}/score",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session_id
        assert "overall_score" in data
        assert "details" in data
        assert len(data["details"]) == 5
        assert "feedback_summary" in data

    async def test_get_score_nonexistent_session_returns_404(self, client):
        """Getting score for nonexistent session returns 404."""
        _, _, token = await _setup_completed_session(username="getscore_missing_user")

        response = await client.get(
            "/api/v1/scoring/sessions/nonexistent-id/score",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404
