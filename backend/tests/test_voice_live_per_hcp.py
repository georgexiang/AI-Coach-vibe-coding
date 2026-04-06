"""Tests for Voice Live per-HCP voice/avatar settings (Phase 12).

Verifies that get_voice_live_token returns per-HCP voice/avatar settings
when hcp_profile_id is provided, falls back to defaults otherwise,
and handles errors gracefully.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.user import User
from app.schemas.voice_live import VoiceLiveTokenResponse
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _create_user_and_token(username="vlhcp_user") -> tuple[str, str]:
    """Create a regular user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="VL HCP User",
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


def _make_mock_vl_config():
    """Create a mock voice_live config object."""
    mock = MagicMock()
    mock.is_active = True
    mock.endpoint = "https://test.openai.azure.com"
    mock.region = "eastus2"
    mock.model_or_deployment = "gpt-4o-realtime-preview"
    mock.api_key_encrypted = ""
    return mock


def _make_mock_avatar_config():
    """Create a mock avatar config object."""
    mock = MagicMock()
    mock.is_active = True
    mock.model_or_deployment = "Lisa-casual-sitting"
    return mock


def _make_mock_hcp_profile():
    """Create a mock HCP profile with per-HCP voice/avatar settings."""
    profile = MagicMock()
    profile.agent_id = "asst_test123"
    profile.agent_sync_status = "synced"
    # VoiceLiveInstance reference — None to use inline fields (fallback path)
    profile.voice_live_instance_id = None
    profile.voice_live_instance = None
    # Voice Live flags
    profile.voice_live_enabled = True
    profile.voice_live_model = "gpt-4o-realtime-preview"
    # Voice settings
    profile.voice_name = "zh-CN-YunxiNeural"
    profile.voice_type = "azure-standard"
    profile.voice_temperature = 0.7
    profile.voice_custom = False
    # Avatar settings
    profile.avatar_character = "harry"
    profile.avatar_style = "business"
    profile.avatar_customized = False
    # Conversation parameters
    profile.turn_detection_type = "azure_semantic_vad"
    profile.noise_suppression = True
    profile.echo_cancellation = False
    profile.eou_detection = False
    profile.recognition_language = "zh-CN"
    profile.agent_instructions_override = ""
    return profile


class TestPerHcpTokenBroker:
    """Tests for get_voice_live_token with per-HCP voice/avatar settings."""

    @pytest.mark.asyncio
    async def test_token_returns_per_hcp_voice_settings(self):
        """get_voice_live_token returns per-HCP voice settings when hcp_profile_id provided."""
        from app.services.voice_live_service import get_voice_live_token

        mock_db = AsyncMock()
        mock_profile = _make_mock_hcp_profile()

        mock_config_svc_calls = {
            "azure_voice_live": _make_mock_vl_config(),
            "azure_avatar": _make_mock_avatar_config(),
        }

        with (
            patch(
                "app.services.voice_live_service.config_service.get_config",
                new_callable=AsyncMock,
                side_effect=lambda db, name: mock_config_svc_calls.get(name),
            ),
            patch(
                "app.services.voice_live_service.config_service.get_effective_key",
                new_callable=AsyncMock,
                side_effect=lambda db, name: (
                    "test-key" if name == "azure_voice_live" else "avatar-key"
                ),
            ),
            patch(
                "app.services.voice_live_service.config_service.get_effective_endpoint",
                new_callable=AsyncMock,
                return_value="https://test.openai.azure.com",
            ),
            patch(
                "app.services.voice_live_service.config_service.get_master_config",
                new_callable=AsyncMock,
                return_value=MagicMock(region="eastus2", default_project="test-project"),
            ),
            patch(
                "app.services.hcp_profile_service.get_hcp_profile",
                new_callable=AsyncMock,
                return_value=mock_profile,
            ),
        ):
            result = await get_voice_live_token(db=mock_db, hcp_profile_id="test-hcp-id")

        assert result.voice_name == "zh-CN-YunxiNeural"
        assert result.avatar_character == "harry"
        assert result.avatar_style == "business"
        assert result.voice_temperature == 0.7
        assert result.turn_detection_type == "azure_semantic_vad"
        assert result.noise_suppression is True
        assert result.recognition_language == "zh-CN"
        # Agent mode: token masked, auth_type = bearer
        assert result.auth_type == "bearer"
        assert result.token == "***configured***"

    @pytest.mark.asyncio
    async def test_token_returns_defaults_when_no_hcp_profile_id(self):
        """get_voice_live_token returns defaults when no hcp_profile_id provided."""
        from app.services.voice_live_service import get_voice_live_token

        mock_db = AsyncMock()

        with (
            patch(
                "app.services.voice_live_service.config_service.get_config",
                new_callable=AsyncMock,
                side_effect=lambda db, name: (
                    _make_mock_vl_config() if name == "azure_voice_live" else None
                ),
            ),
            patch(
                "app.services.voice_live_service.config_service.get_effective_key",
                new_callable=AsyncMock,
                side_effect=lambda db, name: "test-key" if name == "azure_voice_live" else "",
            ),
            patch(
                "app.services.voice_live_service.config_service.get_effective_endpoint",
                new_callable=AsyncMock,
                return_value="https://test.openai.azure.com",
            ),
            patch(
                "app.services.voice_live_service.config_service.get_master_config",
                new_callable=AsyncMock,
                return_value=MagicMock(region="eastus2", default_project="test-project"),
            ),
        ):
            result = await get_voice_live_token(db=mock_db, hcp_profile_id=None)

        # Should get global defaults, not per-HCP settings
        assert result.voice_name == "zh-CN-XiaoxiaoMultilingualNeural"
        assert result.turn_detection_type == "server_vad"
        assert result.noise_suppression is False
        assert result.echo_cancellation is False

    @pytest.mark.asyncio
    async def test_token_falls_back_on_hcp_service_exception(self):
        """get_voice_live_token falls back to defaults when hcp_profile_service raises."""
        from app.services.voice_live_service import get_voice_live_token

        mock_db = AsyncMock()

        with (
            patch(
                "app.services.voice_live_service.config_service.get_config",
                new_callable=AsyncMock,
                side_effect=lambda db, name: (
                    _make_mock_vl_config() if name == "azure_voice_live" else None
                ),
            ),
            patch(
                "app.services.voice_live_service.config_service.get_effective_key",
                new_callable=AsyncMock,
                side_effect=lambda db, name: "test-key" if name == "azure_voice_live" else "",
            ),
            patch(
                "app.services.voice_live_service.config_service.get_effective_endpoint",
                new_callable=AsyncMock,
                return_value="https://test.openai.azure.com",
            ),
            patch(
                "app.services.voice_live_service.config_service.get_master_config",
                new_callable=AsyncMock,
                return_value=MagicMock(region="eastus2", default_project="test-project"),
            ),
            patch(
                "app.services.hcp_profile_service.get_hcp_profile",
                new_callable=AsyncMock,
                side_effect=Exception("Profile not found"),
            ),
        ):
            # Should not crash, should return defaults
            result = await get_voice_live_token(db=mock_db, hcp_profile_id="nonexistent")

        # Defaults should be used
        assert result.voice_name == "zh-CN-XiaoxiaoMultilingualNeural"
        assert result.turn_detection_type == "server_vad"
        assert result.noise_suppression is False

    @pytest.mark.asyncio
    async def test_token_returns_per_hcp_agent_id_in_agent_mode(self):
        """get_voice_live_token returns per-HCP agent_id when in agent mode."""
        import json

        from app.services.voice_live_service import get_voice_live_token

        mock_db = AsyncMock()
        mock_profile = _make_mock_hcp_profile()
        mock_profile.agent_id = "per-hcp-agent-id"

        # Agent mode config
        mock_vl_config = _make_mock_vl_config()
        mock_vl_config.model_or_deployment = json.dumps(
            {
                "mode": "agent",
                "agent_id": "config-level-agent-id",
                "project_name": "test-project",
            }
        )

        with (
            patch(
                "app.services.voice_live_service.config_service.get_config",
                new_callable=AsyncMock,
                side_effect=lambda db, name: (
                    mock_vl_config if name == "azure_voice_live" else _make_mock_avatar_config()
                ),
            ),
            patch(
                "app.services.voice_live_service.config_service.get_effective_key",
                new_callable=AsyncMock,
                side_effect=lambda db, name: (
                    "test-key" if name == "azure_voice_live" else "avatar-key"
                ),
            ),
            patch(
                "app.services.voice_live_service.config_service.get_effective_endpoint",
                new_callable=AsyncMock,
                return_value="https://test.openai.azure.com",
            ),
            patch(
                "app.services.voice_live_service.config_service.get_master_config",
                new_callable=AsyncMock,
                return_value=MagicMock(region="eastus2", default_project="master-default-project"),
            ),
            patch(
                "app.services.hcp_profile_service.get_hcp_profile",
                new_callable=AsyncMock,
                return_value=mock_profile,
            ),
        ):
            result = await get_voice_live_token(db=mock_db, hcp_profile_id="test-hcp-id")

        # Should use per-HCP agent_id, not config-level
        assert result.agent_id == "per-hcp-agent-id"
        # When HCP profile overrides agent, project_name comes from master default_project
        assert result.project_name == "master-default-project"
        # Agent mode: token masked, auth_type = bearer
        assert result.auth_type == "bearer"
        assert result.token == "***configured***"


class TestVoiceLiveTokenResponseSchema:
    """Tests for VoiceLiveTokenResponse schema with per-HCP fields."""

    async def test_schema_includes_per_hcp_fields(self):
        """VoiceLiveTokenResponse includes all per-HCP voice/avatar fields."""
        resp = VoiceLiveTokenResponse(
            endpoint="https://example.openai.azure.com",
            token="test-key",
            region="eastus2",
            model="gpt-4o-realtime-preview",
            avatar_enabled=True,
            avatar_character="harry",
            voice_name="zh-CN-YunxiNeural",
            avatar_style="business",
            avatar_customized=False,
            voice_type="azure-standard",
            voice_temperature=0.7,
            voice_custom=False,
            turn_detection_type="azure_semantic_vad",
            noise_suppression=True,
            echo_cancellation=False,
            eou_detection=False,
            recognition_language="zh-CN",
        )
        assert resp.avatar_style == "business"
        assert resp.voice_temperature == 0.7
        assert resp.turn_detection_type == "azure_semantic_vad"
        assert resp.noise_suppression is True
        assert resp.recognition_language == "zh-CN"

    async def test_schema_defaults_for_per_hcp_fields(self):
        """VoiceLiveTokenResponse has correct defaults for per-HCP fields."""
        resp = VoiceLiveTokenResponse(
            endpoint="https://example.openai.azure.com",
            token="test-key",
            region="eastus2",
            model="gpt-4o-realtime-preview",
            avatar_enabled=False,
            avatar_character="lori",
            voice_name="en-US-AvaNeural",
        )
        assert resp.avatar_style == "casual"
        assert resp.voice_type == "azure-standard"
        assert resp.voice_temperature == 0.9
        assert resp.voice_custom is False
        assert resp.turn_detection_type == "server_vad"
        assert resp.noise_suppression is False
        assert resp.echo_cancellation is False
        assert resp.eou_detection is False
        assert resp.recognition_language == "auto"


class TestVoiceLiveAPIWithHcpProfileId:
    """Tests for Voice Live API endpoint accepting hcp_profile_id query param."""

    @patch("app.services.voice_live_service.config_service")
    async def test_token_endpoint_accepts_hcp_profile_id(self, mock_config_svc, client):
        """POST /api/v1/voice-live/token?hcp_profile_id=test-id returns 200 or 503."""
        mock_config_svc.get_config = AsyncMock(return_value=None)
        mock_config_svc.get_effective_key = AsyncMock(return_value="")
        mock_config_svc.get_effective_endpoint = AsyncMock(return_value="")
        mock_config_svc.get_master_config = AsyncMock(return_value=None)

        _, token = await _create_user_and_token("vl_hcp_query")
        response = await client.post(
            "/api/v1/voice-live/token?hcp_profile_id=test-hcp-id",
            headers={"Authorization": f"Bearer {token}"},
        )
        # 503 because no config exists, but the endpoint accepts the param
        assert response.status_code == 503

    @patch("app.services.voice_live_service.config_service")
    async def test_token_endpoint_with_hcp_and_config(self, mock_config_svc, client):
        """POST /api/v1/voice-live/token?hcp_profile_id returns per-HCP settings."""
        mock_vl_config = _make_mock_vl_config()
        mock_profile = _make_mock_hcp_profile()

        mock_config_svc.get_config = AsyncMock(
            side_effect=lambda db, name: mock_vl_config if name == "azure_voice_live" else None
        )
        mock_config_svc.get_effective_key = AsyncMock(
            side_effect=lambda db, name: "test-api-key" if name == "azure_voice_live" else ""
        )
        mock_config_svc.get_effective_endpoint = AsyncMock(
            return_value="https://test.openai.azure.com"
        )
        mock_config_svc.get_master_config = AsyncMock(
            return_value=MagicMock(region="eastus2", default_project="test-project")
        )

        _, token = await _create_user_and_token("vl_hcp_config")
        with patch(
            "app.services.hcp_profile_service.get_hcp_profile",
            new_callable=AsyncMock,
            return_value=mock_profile,
        ):
            response = await client.post(
                "/api/v1/voice-live/token?hcp_profile_id=test-hcp-id",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["voice_name"] == "zh-CN-YunxiNeural"
        assert data["avatar_character"] == "harry"
        assert data["avatar_style"] == "business"
        assert data["voice_temperature"] == 0.7
        assert data["turn_detection_type"] == "azure_semantic_vad"
        assert data["noise_suppression"] is True
