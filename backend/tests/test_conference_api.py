"""Integration tests for conference API endpoints."""

import json

import pytest
from httpx import AsyncClient

from app.models.conference import ConferenceAudienceHcp
from app.models.hcp_profile import HcpProfile
from app.models.scenario import Scenario
from app.models.user import User
from app.services.agents.adapters.mock import MockCoachingAdapter
from app.services.agents.avatar.mock import MockAvatarAdapter
from app.services.agents.registry import ServiceRegistry
from app.services.agents.stt.mock import MockSTTAdapter
from app.services.agents.tts.mock import MockTTSAdapter
from app.services.auth import get_password_hash
from tests.conftest import TestSessionLocal


@pytest.fixture(autouse=True)
def register_mock_adapters():
    """Register mock adapters (lifespan not triggered in tests)."""
    ServiceRegistry._instance = None
    ServiceRegistry._categories = {}
    reg = ServiceRegistry()
    reg.register("llm", MockCoachingAdapter())
    reg.register("stt", MockSTTAdapter())
    reg.register("tts", MockTTSAdapter())
    reg.register("avatar", MockAvatarAdapter())
    yield
    ServiceRegistry._instance = None
    ServiceRegistry._categories = {}


async def _seed_conference_data() -> dict:
    """Create user, HCP profiles, conference scenario, and audience HCPs."""
    async with TestSessionLocal() as session:
        user = User(
            username="confapi-user",
            email="confapi@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Conference API Tester",
            role="user",
        )
        session.add(user)
        await session.flush()

        admin = User(
            username="confapi-admin",
            email="confapiadmin@test.com",
            hashed_password=get_password_hash("adminpass"),
            full_name="Conference Admin",
            role="admin",
        )
        session.add(admin)
        await session.flush()

        hcps = []
        for i in range(3):
            hcp = HcpProfile(
                name=f"Dr. Conf-{i}",
                specialty="Oncology",
                personality_type="friendly",
                created_by=user.id,
            )
            session.add(hcp)
            hcps.append(hcp)
        await session.flush()

        scenario = Scenario(
            name="API Conference Scenario",
            product="TestDrug",
            mode="conference",
            hcp_profile_id=hcps[0].id,
            created_by=user.id,
            key_messages=json.dumps(["Key msg 1", "Key msg 2"]),
            description="API test conference",
        )
        session.add(scenario)
        await session.flush()

        for i, hcp in enumerate(hcps):
            ah = ConferenceAudienceHcp(
                scenario_id=scenario.id,
                hcp_profile_id=hcp.id,
                role_in_conference="audience",
                voice_id=f"voice-{i}",
                sort_order=i,
            )
            session.add(ah)
        await session.flush()

        await session.commit()

        return {
            "user_id": user.id,
            "admin_id": admin.id,
            "scenario_id": scenario.id,
            "hcp_ids": [h.id for h in hcps],
        }


async def _login(client: AsyncClient, username: str, password: str) -> str:
    """Login and return the access token."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


class TestConferenceSessionEndpoints:
    """Tests for conference session CRUD endpoints."""

    async def test_create_conference_session(self, client: AsyncClient):
        """POST /conference/sessions returns 201 with conference fields."""
        data = await _seed_conference_data()
        token = await _login(client, "confapi-user", "password123")

        resp = await client.post(
            "/api/v1/conference/sessions",
            json={"scenario_id": data["scenario_id"]},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["session_type"] == "conference"
        assert body["sub_state"] == "presenting"
        assert body["status"] == "created"
        assert body["scenario_id"] == data["scenario_id"]

    async def test_get_conference_session(self, client: AsyncClient):
        """GET /conference/sessions/{id} returns session details."""
        data = await _seed_conference_data()
        token = await _login(client, "confapi-user", "password123")

        # Create session first
        create_resp = await client.post(
            "/api/v1/conference/sessions",
            json={"scenario_id": data["scenario_id"]},
            headers={"Authorization": f"Bearer {token}"},
        )
        session_id = create_resp.json()["id"]

        # Get session
        resp = await client.get(
            f"/api/v1/conference/sessions/{session_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == session_id

    async def test_get_session_not_found(self, client: AsyncClient):
        """GET /conference/sessions/{bad_id} returns 404."""
        await _seed_conference_data()
        token = await _login(client, "confapi-user", "password123")

        resp = await client.get(
            "/api/v1/conference/sessions/nonexistent",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_update_sub_state(self, client: AsyncClient):
        """PATCH /conference/sessions/{id}/sub-state changes sub_state."""
        data = await _seed_conference_data()
        token = await _login(client, "confapi-user", "password123")

        create_resp = await client.post(
            "/api/v1/conference/sessions",
            json={"scenario_id": data["scenario_id"]},
            headers={"Authorization": f"Bearer {token}"},
        )
        session_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/v1/conference/sessions/{session_id}/sub-state",
            json={"sub_state": "qa"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["sub_state"] == "qa"

    async def test_end_conference_session(self, client: AsyncClient):
        """POST /conference/sessions/{id}/end returns completed session."""
        data = await _seed_conference_data()
        token = await _login(client, "confapi-user", "password123")

        create_resp = await client.post(
            "/api/v1/conference/sessions",
            json={"scenario_id": data["scenario_id"]},
            headers={"Authorization": f"Bearer {token}"},
        )
        session_id = create_resp.json()["id"]

        resp = await client.post(
            f"/api/v1/conference/sessions/{session_id}/end",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        # Status may be 'completed' or 'scored' if scoring service runs
        assert resp.json()["status"] in ("completed", "scored")

    async def test_get_session_forbidden(self, client: AsyncClient):
        """GET session owned by another user returns 403."""
        data = await _seed_conference_data()
        user_token = await _login(client, "confapi-user", "password123")

        # Create session as user
        create_resp = await client.post(
            "/api/v1/conference/sessions",
            json={"scenario_id": data["scenario_id"]},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        session_id = create_resp.json()["id"]

        # Try to access as admin (different user)
        admin_token = await _login(client, "confapi-admin", "adminpass")
        resp = await client.get(
            f"/api/v1/conference/sessions/{session_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 403

    async def test_update_sub_state_not_found(self, client: AsyncClient):
        """PATCH sub-state for non-existent session returns 404."""
        await _seed_conference_data()
        token = await _login(client, "confapi-user", "password123")

        resp = await client.patch(
            "/api/v1/conference/sessions/nonexistent/sub-state",
            json={"sub_state": "qa"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_update_sub_state_forbidden(self, client: AsyncClient):
        """PATCH sub-state for another user's session returns 403."""
        data = await _seed_conference_data()
        user_token = await _login(client, "confapi-user", "password123")

        create_resp = await client.post(
            "/api/v1/conference/sessions",
            json={"scenario_id": data["scenario_id"]},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        session_id = create_resp.json()["id"]

        admin_token = await _login(client, "confapi-admin", "adminpass")
        resp = await client.patch(
            f"/api/v1/conference/sessions/{session_id}/sub-state",
            json={"sub_state": "qa"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 403


class TestConferenceAuthRequired:
    """Tests for authentication requirements on conference endpoints."""

    async def test_create_session_unauthenticated(self, client: AsyncClient):
        """POST /conference/sessions without token returns 401."""
        resp = await client.post(
            "/api/v1/conference/sessions",
            json={"scenario_id": "any"},
        )
        assert resp.status_code == 401


class TestAudienceManagement:
    """Tests for audience HCP management endpoints."""

    async def test_get_audience_hcps(self, client: AsyncClient):
        """GET /conference/scenarios/{id}/audience returns audience list."""
        data = await _seed_conference_data()
        token = await _login(client, "confapi-user", "password123")

        resp = await client.get(
            f"/api/v1/conference/scenarios/{data['scenario_id']}/audience",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 3
        assert body[0]["role_in_conference"] == "audience"

    async def test_set_audience_hcps(self, client: AsyncClient):
        """PUT /conference/scenarios/{id}/audience replaces audience list."""
        data = await _seed_conference_data()
        token = await _login(client, "confapi-admin", "adminpass")

        new_audience = [
            {
                "hcp_profile_id": data["hcp_ids"][0],
                "role_in_conference": "moderator",
                "voice_id": "new-voice",
                "sort_order": 0,
            },
            {
                "hcp_profile_id": data["hcp_ids"][1],
                "role_in_conference": "audience",
                "voice_id": "",
                "sort_order": 1,
            },
        ]

        resp = await client.put(
            f"/api/v1/conference/scenarios/{data['scenario_id']}/audience",
            json=new_audience,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 2
        assert body[0]["role_in_conference"] == "moderator"

    async def test_set_audience_requires_admin(self, client: AsyncClient):
        """PUT audience endpoint requires admin role."""
        data = await _seed_conference_data()
        token = await _login(client, "confapi-user", "password123")

        resp = await client.put(
            f"/api/v1/conference/scenarios/{data['scenario_id']}/audience",
            json=[],
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


class TestStreamEndpoint:
    """Tests for the SSE stream endpoint."""

    async def test_stream_endpoint_exists(self, client: AsyncClient):
        """POST /conference/sessions/{id}/stream route resolves."""
        data = await _seed_conference_data()
        token = await _login(client, "confapi-user", "password123")

        # Create a session first
        create_resp = await client.post(
            "/api/v1/conference/sessions",
            json={"scenario_id": data["scenario_id"]},
            headers={"Authorization": f"Bearer {token}"},
        )
        session_id = create_resp.json()["id"]

        # The stream endpoint should return 200 (SSE response)
        resp = await client.post(
            f"/api/v1/conference/sessions/{session_id}/stream",
            json={
                "action": "present",
                "message": "Let me present our drug data",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        # SSE returns 200 with streaming content type
        assert resp.status_code == 200

    async def test_stream_unknown_action(self, client: AsyncClient):
        """POST stream with unknown action returns error event."""
        data = await _seed_conference_data()
        token = await _login(client, "confapi-user", "password123")

        create_resp = await client.post(
            "/api/v1/conference/sessions",
            json={"scenario_id": data["scenario_id"]},
            headers={"Authorization": f"Bearer {token}"},
        )
        session_id = create_resp.json()["id"]

        resp = await client.post(
            f"/api/v1/conference/sessions/{session_id}/stream",
            json={"action": "invalid", "message": "test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        # Response body should contain error event
        assert "error" in resp.text

    async def test_stream_not_found(self, client: AsyncClient):
        """POST stream for non-existent session returns 404."""
        await _seed_conference_data()
        token = await _login(client, "confapi-user", "password123")

        resp = await client.post(
            "/api/v1/conference/sessions/nonexistent/stream",
            json={"action": "present", "message": "test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_stream_forbidden(self, client: AsyncClient):
        """POST stream for another user's session returns 403."""
        data = await _seed_conference_data()
        user_token = await _login(client, "confapi-user", "password123")

        create_resp = await client.post(
            "/api/v1/conference/sessions",
            json={"scenario_id": data["scenario_id"]},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        session_id = create_resp.json()["id"]

        admin_token = await _login(client, "confapi-admin", "adminpass")
        resp = await client.post(
            f"/api/v1/conference/sessions/{session_id}/stream",
            json={"action": "present", "message": "test"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 403

    async def test_stream_closed_session(self, client: AsyncClient):
        """POST stream for completed session returns 409."""
        data = await _seed_conference_data()
        token = await _login(client, "confapi-user", "password123")

        # Create and end session
        create_resp = await client.post(
            "/api/v1/conference/sessions",
            json={"scenario_id": data["scenario_id"]},
            headers={"Authorization": f"Bearer {token}"},
        )
        session_id = create_resp.json()["id"]
        await client.post(
            f"/api/v1/conference/sessions/{session_id}/end",
            headers={"Authorization": f"Bearer {token}"},
        )

        resp = await client.post(
            f"/api/v1/conference/sessions/{session_id}/stream",
            json={"action": "present", "message": "test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409

    async def test_stream_respond_no_target(self, client: AsyncClient):
        """POST stream respond without target_hcp_id returns error."""
        data = await _seed_conference_data()
        token = await _login(client, "confapi-user", "password123")

        create_resp = await client.post(
            "/api/v1/conference/sessions",
            json={"scenario_id": data["scenario_id"]},
            headers={"Authorization": f"Bearer {token}"},
        )
        session_id = create_resp.json()["id"]

        resp = await client.post(
            f"/api/v1/conference/sessions/{session_id}/stream",
            json={"action": "respond", "message": "test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert "error" in resp.text
        assert "target_hcp_id" in resp.text

    async def test_stream_respond_with_target(self, client: AsyncClient):
        """POST stream respond with target_hcp_id triggers respond flow."""
        data = await _seed_conference_data()
        token = await _login(client, "confapi-user", "password123")

        create_resp = await client.post(
            "/api/v1/conference/sessions",
            json={"scenario_id": data["scenario_id"]},
            headers={"Authorization": f"Bearer {token}"},
        )
        session_id = create_resp.json()["id"]

        # First present to generate questions
        await client.post(
            f"/api/v1/conference/sessions/{session_id}/stream",
            json={"action": "present", "message": "Our drug data"},
            headers={"Authorization": f"Bearer {token}"},
        )

        # Respond to first HCP
        resp = await client.post(
            f"/api/v1/conference/sessions/{session_id}/stream",
            json={
                "action": "respond",
                "message": "Great question",
                "target_hcp_id": data["hcp_ids"][0],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
