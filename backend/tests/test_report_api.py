"""Tests for session report endpoint."""

import json

from app.models.hcp_profile import HcpProfile
from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.session import CoachingSession
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from app.services.scoring_service import score_session
from tests.conftest import TestSessionLocal


async def _seed_scored_session_and_token() -> tuple[str, str, str]:
    """Create a scored session and return (user_id, session_id, token)."""
    async with TestSessionLocal() as db:
        user = User(
            username="report_user",
            email="report@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Report User",
            role="user",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        hcp = HcpProfile(
            name="Dr. Report",
            specialty="Oncology",
            created_by=user.id,
        )
        db.add(hcp)
        await db.commit()
        await db.refresh(hcp)

        scenario = Scenario(
            name="Report Scenario",
            product="TestDrug",
            hcp_profile_id=hcp.id,
            key_messages=json.dumps(["Key 1", "Key 2"]),
            status="active",
            created_by=user.id,
        )
        db.add(scenario)
        await db.commit()
        await db.refresh(scenario)

        session = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
            status="completed",
            key_messages_status=json.dumps([
                {"message": "Key 1", "delivered": True, "detected_at": "2024-01-01T00:00:00"},
                {"message": "Key 2", "delivered": False, "detected_at": None},
            ]),
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        msg = SessionMessage(
            session_id=session.id,
            role="user",
            content="TestDrug has great efficacy data.",
            message_index=0,
        )
        db.add(msg)
        await db.commit()

        # Score the session
        await score_session(db, session.id)

        token = create_access_token(data={"sub": user.id})
        return user.id, session.id, token


async def _seed_unscored_session_and_token() -> tuple[str, str, str]:
    """Create a completed but unscored session and return (user_id, session_id, token)."""
    async with TestSessionLocal() as db:
        user = User(
            username="unscored_user",
            email="unscored@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Unscored User",
            role="user",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        hcp = HcpProfile(
            name="Dr. Unscored",
            specialty="Derm",
            created_by=user.id,
        )
        db.add(hcp)
        await db.commit()
        await db.refresh(hcp)

        scenario = Scenario(
            name="Unscored Scenario",
            product="Drug",
            hcp_profile_id=hcp.id,
            key_messages=json.dumps([]),
            status="active",
            created_by=user.id,
        )
        db.add(scenario)
        await db.commit()
        await db.refresh(scenario)

        session = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
            status="completed",
            key_messages_status=json.dumps([]),
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        token = create_access_token(data={"sub": user.id})
        return user.id, session.id, token


class TestGetSessionReport:
    """Tests for GET /api/v1/sessions/{id}/report."""

    async def test_returns_report_for_scored_session(self, client):
        _, session_id, token = await _seed_scored_session_and_token()
        response = await client.get(
            f"/api/v1/sessions/{session_id}/report",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session_id
        assert "overall_score" in data
        assert "passed" in data
        assert "dimensions" in data
        assert len(data["dimensions"]) > 0
        assert "strengths" in data
        assert "weaknesses" in data
        assert "improvements" in data

    async def test_returns_409_for_unscored_session(self, client):
        _, session_id, token = await _seed_unscored_session_and_token()
        response = await client.get(
            f"/api/v1/sessions/{session_id}/report",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 409
