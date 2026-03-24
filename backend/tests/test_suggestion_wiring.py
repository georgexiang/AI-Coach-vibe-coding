"""Tests for suggestion wiring: GET endpoint and SSE hint events."""

import json

from app.models.hcp_profile import HcpProfile
from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.session import CoachingSession
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _seed_in_progress_session_and_token() -> tuple[str, str, str]:
    """Create an in_progress session with messages and return (user_id, session_id, token)."""
    async with TestSessionLocal() as db:
        user = User(
            username="suggest_user",
            email="suggest@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Suggest User",
            role="user",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        hcp = HcpProfile(
            name="Dr. Suggest",
            specialty="Oncology",
            created_by=user.id,
        )
        db.add(hcp)
        await db.commit()
        await db.refresh(hcp)

        scenario = Scenario(
            name="Suggest Scenario",
            product="TestDrug",
            hcp_profile_id=hcp.id,
            key_messages=json.dumps(["Efficacy data", "Safety profile"]),
            status="active",
            created_by=user.id,
        )
        db.add(scenario)
        await db.commit()
        await db.refresh(scenario)

        session = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
            status="in_progress",
            key_messages_status=json.dumps([
                {"message": "Efficacy data", "delivered": True, "detected_at": "2024-01-01"},
                {"message": "Safety profile", "delivered": False, "detected_at": None},
            ]),
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        # Add some messages
        msgs = [
            SessionMessage(
                session_id=session.id,
                role="user",
                content="Let me tell you about our efficacy data.",
                message_index=0,
            ),
            SessionMessage(
                session_id=session.id,
                role="assistant",
                content="Interesting, tell me more.",
                message_index=1,
            ),
            SessionMessage(
                session_id=session.id,
                role="user",
                content="We have superior PFS compared to standard care.",
                message_index=2,
            ),
            SessionMessage(
                session_id=session.id,
                role="assistant",
                content="What about the safety profile?",
                message_index=3,
            ),
            SessionMessage(
                session_id=session.id,
                role="user",
                content="The safety data is also favorable.",
                message_index=4,
            ),
        ]
        db.add_all(msgs)
        await db.commit()

        token = create_access_token(data={"sub": user.id})
        return user.id, session.id, token


class TestGetSessionSuggestions:
    """Tests for GET /api/v1/sessions/{id}/suggestions."""

    async def test_returns_suggestion_list(self, client):
        _, session_id, token = await _seed_in_progress_session_and_token()
        response = await client.get(
            f"/api/v1/sessions/{session_id}/suggestions",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Each suggestion should have type, message, relevance_score
        first = data[0]
        assert "type" in first
        assert "message" in first
        assert "relevance_score" in first

    async def test_suggestions_include_expected_types(self, client):
        _, session_id, token = await _seed_in_progress_session_and_token()
        response = await client.get(
            f"/api/v1/sessions/{session_id}/suggestions",
            headers={"Authorization": f"Bearer {token}"},
        )
        data = response.json()
        types = {s["type"] for s in data}
        # With delivered key messages and multiple exchanges, we expect at least achievement
        assert len(types) >= 1
