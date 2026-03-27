"""Tests for Voice Live API: token broker, connection tester, schemas, and region validation."""

from unittest.mock import AsyncMock, MagicMock, patch

from app.models.user import User
from app.schemas.session import SessionCreate
from app.schemas.voice_live import VoiceLiveConfigStatus, VoiceLiveTokenResponse
from app.services.auth import create_access_token, get_password_hash
from app.services.connection_tester import (
    test_azure_voice_live as _test_azure_voice_live,
)
from app.services.connection_tester import (
    test_service_connection as _test_service_connection,
)
from app.services.voice_live_service import SUPPORTED_REGIONS, validate_region
from tests.conftest import TestSessionLocal


async def _create_user_and_token(username="vl_user") -> tuple[str, str]:
    """Create a regular user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="VL User",
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


# === Schema Tests ===


class TestSessionCreateMode:
    """Tests for SessionCreate schema mode field."""

    async def test_session_create_with_mode(self):
        sc = SessionCreate(scenario_id="x", mode="voice")
        assert sc.mode == "voice"

    async def test_session_create_default_mode(self):
        sc = SessionCreate(scenario_id="x")
        assert sc.mode == "text"

    async def test_session_create_avatar_mode(self):
        sc = SessionCreate(scenario_id="x", mode="avatar")
        assert sc.mode == "avatar"


class TestVoiceLiveSchemas:
    """Tests for VoiceLiveTokenResponse and VoiceLiveConfigStatus schemas."""

    async def test_token_response_schema(self):
        resp = VoiceLiveTokenResponse(
            endpoint="https://example.openai.azure.com",
            token="test-key",
            region="eastus2",
            model="gpt-4o-realtime-preview",
            avatar_enabled=True,
            avatar_character="Lisa-casual-sitting",
            voice_name="zh-CN-XiaoxiaoMultilingualNeural",
        )
        assert resp.endpoint == "https://example.openai.azure.com"
        assert resp.avatar_enabled is True

    async def test_config_status_schema(self):
        status = VoiceLiveConfigStatus(
            voice_live_available=True,
            avatar_available=False,
            voice_name="zh-CN-XiaoxiaoMultilingualNeural",
            avatar_character="Lisa-casual-sitting",
        )
        assert status.voice_live_available is True
        assert status.avatar_available is False


# === Region Validation Tests ===


class TestRegionValidation:
    """Tests for validate_region and SUPPORTED_REGIONS."""

    async def test_validate_region_supported_eastus2(self):
        assert validate_region("eastus2") is True

    async def test_validate_region_supported_swedencentral(self):
        assert validate_region("swedencentral") is True

    async def test_validate_region_unsupported_westus(self):
        assert validate_region("westus") is False

    async def test_validate_region_case_insensitive(self):
        assert validate_region("EastUS2") is True

    async def test_supported_regions_contains_expected(self):
        assert SUPPORTED_REGIONS == {"eastus2", "swedencentral"}


# === Connection Tester Tests ===


class TestConnectionTester:
    """Tests for Voice Live connection tester."""

    async def test_connection_tester_voice_live_bad_region(self):
        success, message = await _test_azure_voice_live(
            endpoint="https://test.openai.azure.com",
            api_key="test-key",
            region="westus",
        )
        assert success is False
        assert "Unsupported region" in message
        assert "westus" in message

    async def test_connection_tester_voice_live_bad_endpoint(self):
        success, message = await _test_azure_voice_live(
            endpoint="http://not-https.com",
            api_key="test-key",
            region="eastus2",
        )
        assert success is False
        assert "Invalid endpoint" in message

    async def test_connection_tester_voice_live_no_key(self):
        success, message = await _test_azure_voice_live(
            endpoint="https://test.openai.azure.com",
            api_key="",
            region="eastus2",
        )
        assert success is False
        assert "API key is required" in message

    @patch("app.services.connection_tester.httpx.AsyncClient")
    async def test_connection_tester_voice_live_valid(self, mock_client_cls):
        """Valid config with mocked HTTP probe returning 426 (expected for WebSocket endpoint)."""
        mock_response = MagicMock()
        mock_response.status_code = 426
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        success, message = await _test_azure_voice_live(
            endpoint="https://test.openai.azure.com",
            api_key="test-key-12345",
            region="eastus2",
        )
        assert success is True
        assert "reachable" in message.lower() or "successful" in message.lower()

    @patch("app.services.connection_tester.httpx.AsyncClient")
    async def test_connection_tester_voice_live_http_failure(self, mock_client_cls):
        """HTTP probe exception falls back to format validation."""
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=Exception("Network error"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        success, message = await _test_azure_voice_live(
            endpoint="https://test.openai.azure.com",
            api_key="test-key-12345",
            region="swedencentral",
        )
        assert success is True
        assert "valid" in message.lower()

    async def test_connection_tester_dispatch_voice_live(self):
        """test_service_connection dispatches azure_voice_live correctly."""
        success, message = await _test_service_connection(
            service_name="azure_voice_live",
            endpoint="https://test.openai.azure.com",
            api_key="",
            deployment="",
            region="eastus2",
        )
        assert success is False
        assert "API key is required" in message

    async def test_connection_tester_dispatch_unknown(self):
        success, message = await _test_service_connection(
            service_name="unknown_service",
            endpoint="",
            api_key="",
            deployment="",
            region="",
        )
        assert success is False
        assert "Unknown service" in message


# === API Endpoint Tests ===


class TestVoiceLiveAPI:
    """Tests for Voice Live API endpoints."""

    async def test_token_endpoint_unauthenticated(self, client):
        """POST /api/v1/voice-live/token returns 401 without auth header."""
        response = await client.post("/api/v1/voice-live/token")
        assert response.status_code == 401

    async def test_status_endpoint_unauthenticated(self, client):
        """GET /api/v1/voice-live/status returns 401 without auth header."""
        response = await client.get("/api/v1/voice-live/status")
        assert response.status_code == 401

    @patch("app.services.voice_live_service.config_service")
    async def test_token_endpoint_no_config(self, mock_config_svc, client):
        """POST /api/v1/voice-live/token returns 503 when no config exists."""
        mock_config_svc.get_config = AsyncMock(return_value=None)

        _, token = await _create_user_and_token("vl_noconfig")
        response = await client.post(
            "/api/v1/voice-live/token",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 503
        data = response.json()
        assert data["code"] == "VOICE_LIVE_NOT_CONFIGURED"

    @patch("app.services.voice_live_service.config_service")
    async def test_status_endpoint_no_config(self, mock_config_svc, client):
        """GET /api/v1/voice-live/status returns voice_live_available=False when no config."""
        mock_config_svc.get_config = AsyncMock(return_value=None)
        mock_config_svc.get_decrypted_key = AsyncMock(return_value="")

        _, token = await _create_user_and_token("vl_status")
        response = await client.get(
            "/api/v1/voice-live/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["voice_live_available"] is False
        assert data["avatar_available"] is False

    @patch("app.services.voice_live_service.config_service")
    async def test_token_endpoint_with_config(self, mock_config_svc, client):
        """POST /api/v1/voice-live/token returns token when config exists."""
        mock_vl_config = MagicMock()
        mock_vl_config.is_active = True
        mock_vl_config.endpoint = "https://test.openai.azure.com"
        mock_vl_config.region = "eastus2"
        mock_vl_config.model_or_deployment = "gpt-4o-realtime-preview"

        mock_config_svc.get_config = AsyncMock(
            side_effect=lambda db, name: mock_vl_config if name == "azure_voice_live" else None
        )
        mock_config_svc.get_decrypted_key = AsyncMock(
            side_effect=lambda db, name: "test-api-key" if name == "azure_voice_live" else ""
        )

        _, token = await _create_user_and_token("vl_withconfig")
        response = await client.post(
            "/api/v1/voice-live/token",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["endpoint"] == "https://test.openai.azure.com"
        assert data["token"] == "test-api-key"
        assert data["region"] == "eastus2"
        assert data["avatar_enabled"] is False
        assert data["voice_name"] == "zh-CN-XiaoxiaoMultilingualNeural"
