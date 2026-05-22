"""Tests for Voice Live WebRTC session endpoint.

Verifies that POST /api/v1/voice-live/webrtc/session returns correct signaling URL,
bearer token (never raw API key), and session configuration for direct browser-to-Azure
WebRTC connections.
"""

from unittest.mock import AsyncMock, MagicMock, patch

from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _create_user_and_token(username="webrtc_user") -> tuple[str, str]:
    """Create a regular user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="WebRTC User",
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


def _mock_vl_config(model_or_deployment="gpt-4o"):
    """Create a mock ServiceConfig for azure_voice_live."""
    config = MagicMock()
    config.is_active = True
    config.model_or_deployment = model_or_deployment
    config.region = "eastus2"
    return config


def _mock_master_config(default_project="my-project"):
    """Create a mock master config."""
    master = MagicMock()
    master.default_project = default_project
    master.region = "eastus2"
    return master


class TestWebRTCSessionModelMode:
    """Test WebRTC session creation in model mode (default)."""

    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    async def test_create_webrtc_session_success_model_mode(
        self, mock_config_svc, mock_exchange, client
    ):
        """Model mode returns signaling URL with model param and bearer token."""
        _, token = await _create_user_and_token("webrtc_model")

        mock_config_svc.get_config = AsyncMock(return_value=_mock_vl_config("gpt-4o"))
        mock_config_svc.get_effective_key = AsyncMock(return_value="test-api-key-secret")
        mock_config_svc.get_effective_endpoint = AsyncMock(
            return_value="https://test.cognitiveservices.azure.com"
        )
        mock_config_svc.get_master_config = AsyncMock(return_value=_mock_master_config())
        mock_exchange.return_value = "bearer-token-123"

        resp = await client.post(
            "/api/v1/voice-live/webrtc/session",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()

        # Verify signaling URL
        assert "wss://test.cognitiveservices.azure.com/voice-live/realtime/calls" in data[
            "signaling_url"
        ]
        assert "api-version=2026-01-01-preview" in data["signaling_url"]
        assert "model=gpt-4o" in data["signaling_url"]

        # Verify auth
        assert data["auth_token"] == "bearer-token-123"
        assert data["auth_type"] == "bearer"

        # Verify mode
        assert data["mode"] == "model"
        assert data["model"] == "gpt-4o"

        # Verify session_config
        assert "voice" in data["session_config"]
        assert "turn_detection" in data["session_config"]
        assert data["session_config"]["voice"]["name"] == "zh-CN-XiaoxiaoMultilingualNeural"
        assert data["session_config"]["turn_detection"]["type"] == "server_vad"

        # Verify avatar warning
        assert data["avatar_warning"] is not None
        assert "not supported" in data["avatar_warning"]

    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    async def test_signaling_url_uses_calls_path(self, mock_config_svc, mock_exchange, client):
        """Verify URL path is /voice-live/realtime/calls NOT /voice-live/realtime."""
        _, token = await _create_user_and_token("webrtc_calls_path")

        mock_config_svc.get_config = AsyncMock(return_value=_mock_vl_config("gpt-4o"))
        mock_config_svc.get_effective_key = AsyncMock(return_value="key-123")
        mock_config_svc.get_effective_endpoint = AsyncMock(
            return_value="https://test.cognitiveservices.azure.com"
        )
        mock_config_svc.get_master_config = AsyncMock(return_value=_mock_master_config())
        mock_exchange.return_value = "token-xyz"

        resp = await client.post(
            "/api/v1/voice-live/webrtc/session",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "realtime/calls?" in data["signaling_url"]
        # Should NOT be the plain /realtime endpoint
        assert "/realtime?" not in data["signaling_url"].replace("/realtime/calls?", "")


class TestWebRTCSessionAgentMode:
    """Test WebRTC session creation in agent mode."""

    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    async def test_create_webrtc_session_success_agent_mode(
        self, mock_config_svc, mock_exchange, client
    ):
        """Agent mode returns signaling URL with agent_id param."""
        _, token = await _create_user_and_token("webrtc_agent")

        agent_config = '{"mode": "agent", "agent_id": "agent-abc", "project_name": "proj-1"}'
        mock_config_svc.get_config = AsyncMock(return_value=_mock_vl_config(agent_config))
        mock_config_svc.get_effective_key = AsyncMock(return_value="key-456")
        mock_config_svc.get_effective_endpoint = AsyncMock(
            return_value="https://test.cognitiveservices.azure.com"
        )
        mock_config_svc.get_master_config = AsyncMock(return_value=_mock_master_config())
        mock_exchange.return_value = "agent-bearer-token"

        resp = await client.post(
            "/api/v1/voice-live/webrtc/session",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()

        assert data["mode"] == "agent"
        assert data["agent_id"] == "agent-abc"
        assert "agent_id=agent-abc" in data["signaling_url"]
        assert "project_id=proj-1" in data["signaling_url"]
        assert data["model"] == ""  # Empty for agent mode


class TestWebRTCSessionErrors:
    """Test error cases for WebRTC session endpoint."""

    @patch("app.services.voice_live_webrtc.config_service")
    async def test_create_webrtc_session_not_configured(self, mock_config_svc, client):
        """Returns 503 when Voice Live is not configured."""
        _, token = await _create_user_and_token("webrtc_noconfig")

        mock_config_svc.get_config = AsyncMock(return_value=None)

        resp = await client.post(
            "/api/v1/voice-live/webrtc/session",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 503
        data = resp.json()
        assert data["code"] == "WEBRTC_SESSION_FAILED"
        assert "not configured" in data["message"].lower()

    async def test_create_webrtc_session_requires_auth(self, client):
        """Returns 401 when no JWT token provided."""
        resp = await client.post("/api/v1/voice-live/webrtc/session")
        assert resp.status_code == 401


class TestWebRTCSessionSecurity:
    """Test security properties of WebRTC session endpoint."""

    @patch("app.services.voice_live_webrtc._exchange_api_key_for_bearer_token")
    @patch("app.services.voice_live_webrtc.config_service")
    async def test_api_key_never_in_response(self, mock_config_svc, mock_exchange, client):
        """Raw API key must never appear in any response field."""
        _, token = await _create_user_and_token("webrtc_security")

        secret_api_key = "super-secret-api-key-12345"
        mock_config_svc.get_config = AsyncMock(return_value=_mock_vl_config("gpt-4o"))
        mock_config_svc.get_effective_key = AsyncMock(return_value=secret_api_key)
        mock_config_svc.get_effective_endpoint = AsyncMock(
            return_value="https://test.cognitiveservices.azure.com"
        )
        mock_config_svc.get_master_config = AsyncMock(return_value=_mock_master_config())
        mock_exchange.return_value = "safe-bearer-token"

        resp = await client.post(
            "/api/v1/voice-live/webrtc/session",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        response_text = resp.text

        # API key must not appear anywhere in the response
        assert secret_api_key not in response_text

        # Auth token should be the bearer token, not the API key
        data = resp.json()
        assert data["auth_token"] == "safe-bearer-token"
        assert data["auth_token"] != secret_api_key
