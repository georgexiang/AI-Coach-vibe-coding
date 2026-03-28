"""Tests for Sessions API endpoints: session lifecycle via HTTP."""

from unittest.mock import patch

from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _create_admin_and_token() -> tuple[str, str]:
    """Create an admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="admin_sess",
            email="admin_sess@test.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin Sessions",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


async def _create_user_and_token(username="user_sess") -> tuple[str, str]:
    """Create a regular user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Regular User",
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


async def _create_active_scenario(client, admin_id, admin_token) -> str:
    """Create an HCP profile and active scenario. Returns scenario_id."""
    hcp_resp = await client.post(
        "/api/v1/hcp-profiles",
        json={"name": "Dr. Sess", "specialty": "Onc", "created_by": admin_id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    hcp_id = hcp_resp.json()["id"]

    scn_resp = await client.post(
        "/api/v1/scenarios",
        json={
            "name": "Active Scenario",
            "product": "Brukinsa",
            "hcp_profile_id": hcp_id,
            "created_by": admin_id,
            "status": "active",
            "key_messages": ["Superior PFS", "Better safety"],
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    return scn_resp.json()["id"]


class TestCreateSessionEndpoint:
    """Tests for POST /api/v1/sessions/."""

    async def test_user_creates_session(self, client):
        admin_id, admin_token = await _create_admin_and_token()
        scenario_id = await _create_active_scenario(client, admin_id, admin_token)

        user_id, user_token = await _create_user_and_token()
        response = await client.post(
            "/api/v1/sessions",
            json={"scenario_id": scenario_id},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "created"
        assert data["scenario_id"] == scenario_id
        assert data["user_id"] == user_id

    async def test_no_auth_returns_401(self, client):
        response = await client.post(
            "/api/v1/sessions",
            json={"scenario_id": "any"},
        )
        assert response.status_code == 401

    async def test_nonexistent_scenario_returns_404(self, client):
        _, user_token = await _create_user_and_token("user_sess_404")
        response = await client.post(
            "/api/v1/sessions",
            json={"scenario_id": "nonexistent"},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 404


class TestCreateSessionModeEndpoint:
    """Tests for POST /api/v1/sessions with mode parameter (Plan 08-06)."""

    async def test_create_session_with_voice_mode(self, client):
        """POST /sessions with mode=voice_pipeline stores mode on session response."""
        admin_id, admin_token = await _create_admin_and_token()
        scenario_id = await _create_active_scenario(client, admin_id, admin_token)
        _, user_token = await _create_user_and_token("voice_mode_user")

        with patch("app.api.sessions.settings") as mock_settings:
            mock_settings.feature_voice_live_enabled = True
            mock_settings.default_llm_provider = "mock"
            response = await client.post(
                "/api/v1/sessions",
                json={"scenario_id": scenario_id, "mode": "voice_pipeline"},
                headers={"Authorization": f"Bearer {user_token}"},
            )
        assert response.status_code == 201
        data = response.json()
        assert data["mode"] == "voice_pipeline"

    async def test_create_session_with_avatar_mode(self, client):
        """POST /sessions with mode=digital_human_pipeline stores mode on session response."""
        admin_id, admin_token = await _create_admin_and_token()
        scenario_id = await _create_active_scenario(client, admin_id, admin_token)
        _, user_token = await _create_user_and_token("avatar_mode_user")

        with patch("app.api.sessions.settings") as mock_settings:
            mock_settings.feature_voice_live_enabled = True
            mock_settings.default_llm_provider = "mock"
            response = await client.post(
                "/api/v1/sessions",
                json={"scenario_id": scenario_id, "mode": "digital_human_pipeline"},
                headers={"Authorization": f"Bearer {user_token}"},
            )
        assert response.status_code == 201
        data = response.json()
        assert data["mode"] == "digital_human_pipeline"

    async def test_create_session_default_mode_is_text(self, client):
        """POST /sessions without mode field defaults to text."""
        admin_id, admin_token = await _create_admin_and_token()
        scenario_id = await _create_active_scenario(client, admin_id, admin_token)
        _, user_token = await _create_user_and_token("default_mode_user")

        response = await client.post(
            "/api/v1/sessions",
            json={"scenario_id": scenario_id},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["mode"] == "text"

    async def test_create_session_invalid_mode_returns_422(self, client):
        """POST /sessions with invalid mode returns 422 (Literal type enforcement)."""
        admin_id, admin_token = await _create_admin_and_token()
        scenario_id = await _create_active_scenario(client, admin_id, admin_token)
        _, user_token = await _create_user_and_token("invalid_mode_user")

        response = await client.post(
            "/api/v1/sessions",
            json={"scenario_id": scenario_id, "mode": "invalid_mode"},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 422

    async def test_create_session_voice_mode_rejected_when_disabled(self, client):
        """POST /sessions with mode=voice_pipeline returns 409 when voice_live_enabled is false."""
        admin_id, admin_token = await _create_admin_and_token()
        scenario_id = await _create_active_scenario(client, admin_id, admin_token)
        _, user_token = await _create_user_and_token("voice_disabled_user")

        with patch("app.api.sessions.settings") as mock_settings:
            mock_settings.feature_voice_live_enabled = False
            response = await client.post(
                "/api/v1/sessions",
                json={"scenario_id": scenario_id, "mode": "voice_pipeline"},
                headers={"Authorization": f"Bearer {user_token}"},
            )
        assert response.status_code == 409
        data = response.json()
        assert data["code"] == "VOICE_MODE_DISABLED"

    async def test_create_session_avatar_mode_rejected_when_disabled(self, client):
        """POST /sessions with mode=digital_human_pipeline returns 409 when disabled."""
        admin_id, admin_token = await _create_admin_and_token()
        scenario_id = await _create_active_scenario(client, admin_id, admin_token)
        _, user_token = await _create_user_and_token("avatar_disabled_user")

        with patch("app.api.sessions.settings") as mock_settings:
            mock_settings.feature_voice_live_enabled = False
            response = await client.post(
                "/api/v1/sessions",
                json={"scenario_id": scenario_id, "mode": "digital_human_pipeline"},
                headers={"Authorization": f"Bearer {user_token}"},
            )
        assert response.status_code == 409
        data = response.json()
        assert data["code"] == "VOICE_MODE_DISABLED"

    async def test_create_session_text_mode_allowed_when_voice_disabled(self, client):
        """POST /sessions with mode=text succeeds even when voice_live_enabled is false."""
        admin_id, admin_token = await _create_admin_and_token()
        scenario_id = await _create_active_scenario(client, admin_id, admin_token)
        _, user_token = await _create_user_and_token("text_always_user")

        response = await client.post(
            "/api/v1/sessions",
            json={"scenario_id": scenario_id, "mode": "text"},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["mode"] == "text"


class TestListSessionsEndpoint:
    """Tests for GET /api/v1/sessions/."""

    async def test_lists_user_sessions(self, client):
        admin_id, admin_token = await _create_admin_and_token()
        scenario_id = await _create_active_scenario(client, admin_id, admin_token)
        user_id, user_token = await _create_user_and_token()

        # Create two sessions
        await client.post(
            "/api/v1/sessions",
            json={"scenario_id": scenario_id},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        await client.post(
            "/api/v1/sessions",
            json={"scenario_id": scenario_id},
            headers={"Authorization": f"Bearer {user_token}"},
        )

        response = await client.get(
            "/api/v1/sessions",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2


class TestGetSessionEndpoint:
    """Tests for GET /api/v1/sessions/{session_id}."""

    async def test_get_own_session(self, client):
        admin_id, admin_token = await _create_admin_and_token()
        scenario_id = await _create_active_scenario(client, admin_id, admin_token)
        _, user_token = await _create_user_and_token()

        create_resp = await client.post(
            "/api/v1/sessions",
            json={"scenario_id": scenario_id},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        session_id = create_resp.json()["id"]

        response = await client.get(
            f"/api/v1/sessions/{session_id}",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 200
        assert response.json()["id"] == session_id

    async def test_other_user_gets_403(self, client):
        admin_id, admin_token = await _create_admin_and_token()
        scenario_id = await _create_active_scenario(client, admin_id, admin_token)
        _, user_token = await _create_user_and_token()

        create_resp = await client.post(
            "/api/v1/sessions",
            json={"scenario_id": scenario_id},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        session_id = create_resp.json()["id"]

        # Different user
        _, other_token = await _create_user_and_token("other_user_sess")
        response = await client.get(
            f"/api/v1/sessions/{session_id}",
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert response.status_code == 403


class TestEndSessionEndpoint:
    """Tests for POST /api/v1/sessions/{session_id}/end."""

    async def test_end_in_progress_session(self, client):
        admin_id, admin_token = await _create_admin_and_token()
        scenario_id = await _create_active_scenario(client, admin_id, admin_token)
        _, user_token = await _create_user_and_token()

        # Create session
        create_resp = await client.post(
            "/api/v1/sessions",
            json={"scenario_id": scenario_id},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        session_id = create_resp.json()["id"]

        # Send a message to transition to in_progress
        await client.post(
            f"/api/v1/sessions/{session_id}/message",
            json={"message": "Hello doctor"},
            headers={"Authorization": f"Bearer {user_token}"},
        )

        # End session
        response = await client.post(
            f"/api/v1/sessions/{session_id}/end",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"

    async def test_end_created_session_returns_409(self, client):
        admin_id, admin_token = await _create_admin_and_token()
        scenario_id = await _create_active_scenario(client, admin_id, admin_token)
        _, user_token = await _create_user_and_token()

        create_resp = await client.post(
            "/api/v1/sessions",
            json={"scenario_id": scenario_id},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        session_id = create_resp.json()["id"]

        response = await client.post(
            f"/api/v1/sessions/{session_id}/end",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 409


class TestGetSessionMessagesEndpoint:
    """Tests for GET /api/v1/sessions/{session_id}/messages."""

    async def test_get_messages_after_sending(self, client):
        admin_id, admin_token = await _create_admin_and_token()
        scenario_id = await _create_active_scenario(client, admin_id, admin_token)
        _, user_token = await _create_user_and_token()

        create_resp = await client.post(
            "/api/v1/sessions",
            json={"scenario_id": scenario_id},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        session_id = create_resp.json()["id"]

        # Send a message (this triggers SSE response via mock adapter)
        await client.post(
            f"/api/v1/sessions/{session_id}/message",
            json={"message": "Hello"},
            headers={"Authorization": f"Bearer {user_token}"},
        )

        # Get messages - at minimum the user message should be saved
        response = await client.get(
            f"/api/v1/sessions/{session_id}/messages",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 200
        messages = response.json()
        assert isinstance(messages, list)
        # At least the user message should exist
        assert len(messages) >= 1
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "Hello"
