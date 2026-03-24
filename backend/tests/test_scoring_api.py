"""Tests for Scoring API endpoints: trigger scoring and retrieve scores."""

import json

from app.models.hcp_profile import HcpProfile
from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.session import CoachingSession
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _setup_scored_session() -> tuple[str, str, str]:
    """Create user, HCP, scenario, completed session with messages.

    Returns (user_id, session_id, bearer_token).
    """
    async with TestSessionLocal() as session:
        user = User(
            username="scoreuser",
            email="scoreuser@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Score User",
            role="user",
        )
        session.add(user)
        await session.flush()

        hcp = HcpProfile(
            name="Dr. Score", specialty="Oncology", created_by=user.id,
        )
        session.add(hcp)
        await session.flush()

        scenario = Scenario(
            name="Score Scenario",
            product="Brukinsa",
            hcp_profile_id=hcp.id,
            key_messages=json.dumps(["PFS", "Safety"]),
            status="active",
            created_by=user.id,
        )
        session.add(scenario)
        await session.flush()

        km_status = json.dumps([
            {"message": "PFS", "delivered": True, "detected_at": None},
            {"message": "Safety", "delivered": False, "detected_at": None},
        ])

        coaching_session = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
            status="completed",
            key_messages_status=km_status,
        )
        session.add(coaching_session)
        await session.flush()

        msg = SessionMessage(
            session_id=coaching_session.id,
            role="user",
            content="Superior PFS data",
            message_index=0,
        )
        session.add(msg)
        await session.commit()

        token = create_access_token(data={"sub": user.id})
        return user.id, coaching_session.id, token


class TestTriggerScoringEndpoint:
    """Tests for POST /api/v1/scoring/sessions/{session_id}/score."""

    async def test_scores_completed_session(self, client):
        user_id, session_id, token = await _setup_scored_session()

        response = await client.post(
            f"/api/v1/scoring/sessions/{session_id}/score",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert "overall_score" in data
        assert "details" in data
        assert len(data["details"]) == 5
        assert data["passed"] in (True, False)

    async def test_scoring_already_scored_returns_409(self, client):
        _, session_id, token = await _setup_scored_session()

        # Score first time
        await client.post(
            f"/api/v1/scoring/sessions/{session_id}/score",
            headers={"Authorization": f"Bearer {token}"},
        )

        # Score again should fail
        response = await client.post(
            f"/api/v1/scoring/sessions/{session_id}/score",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 409

    async def test_no_auth_returns_401(self, client):
        response = await client.post(
            "/api/v1/scoring/sessions/some-id/score",
        )
        assert response.status_code == 401


class TestGetSessionScoreEndpoint:
    """Tests for GET /api/v1/scoring/sessions/{session_id}/score."""

    async def test_returns_score_after_scoring(self, client):
        _, session_id, token = await _setup_scored_session()

        # Score the session first
        await client.post(
            f"/api/v1/scoring/sessions/{session_id}/score",
            headers={"Authorization": f"Bearer {token}"},
        )

        response = await client.get(
            f"/api/v1/scoring/sessions/{session_id}/score",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session_id
        assert "overall_score" in data

    async def test_returns_404_when_not_scored(self, client):
        _, session_id, token = await _setup_scored_session()

        response = await client.get(
            f"/api/v1/scoring/sessions/{session_id}/score",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404

    async def test_wrong_user_gets_403(self, client):
        _, session_id, _ = await _setup_scored_session()

        # Create another user
        async with TestSessionLocal() as session:
            other = User(
                username="other_score",
                email="other_score@test.com",
                hashed_password=get_password_hash("pass"),
                full_name="Other",
                role="user",
            )
            session.add(other)
            await session.commit()
            await session.refresh(other)
            other_token = create_access_token(data={"sub": other.id})

        response = await client.get(
            f"/api/v1/scoring/sessions/{session_id}/score",
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert response.status_code == 403
