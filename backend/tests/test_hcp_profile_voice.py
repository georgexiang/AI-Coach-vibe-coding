"""Tests for HCP profile voice/avatar field CRUD (Phase 12).

Validates that HCP profiles can be created and updated with the 13
voice/avatar fields, that defaults (D-04) are applied correctly,
and that the Pydantic schemas include all voice/avatar fields.
"""

from unittest.mock import patch

from app.models.user import User
from app.schemas.hcp_profile import (
    HcpProfileCreate,
    HcpProfileResponse,
    HcpProfileUpdate,
)
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _create_admin_and_token(username="hcp_voice_admin") -> tuple[str, str]:
    """Create an admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="HCP Admin",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


class TestHcpProfileCreateVoiceFields:
    """Tests for HcpProfileCreate schema with voice/avatar fields."""

    async def test_create_schema_includes_voice_fields(self):
        """HcpProfileCreate includes all 13 voice/avatar fields with defaults."""
        data = HcpProfileCreate(
            name="Dr. Test",
            specialty="Oncology",
            created_by="user-123",
        )
        # D-04 defaults
        assert data.voice_name == "en-US-AvaNeural"
        assert data.voice_type == "azure-standard"
        assert data.voice_temperature == 0.9
        assert data.voice_custom is False
        assert data.avatar_character == "lori"
        assert data.avatar_style == "casual"
        assert data.avatar_customized is False
        assert data.turn_detection_type == "server_vad"
        assert data.noise_suppression is False
        assert data.echo_cancellation is False
        assert data.eou_detection is False
        assert data.recognition_language == "auto"
        assert data.agent_instructions_override == ""

    async def test_create_schema_with_custom_voice_fields(self):
        """HcpProfileCreate accepts custom voice/avatar values."""
        data = HcpProfileCreate(
            name="Dr. Custom",
            specialty="Hematology",
            created_by="user-123",
            voice_name="zh-CN-YunxiNeural",
            voice_temperature=0.7,
            avatar_character="harry",
            avatar_style="business",
            turn_detection_type="azure_semantic_vad",
            noise_suppression=True,
            recognition_language="zh-CN",
        )
        assert data.voice_name == "zh-CN-YunxiNeural"
        assert data.voice_temperature == 0.7
        assert data.avatar_character == "harry"
        assert data.avatar_style == "business"
        assert data.turn_detection_type == "azure_semantic_vad"
        assert data.noise_suppression is True
        assert data.recognition_language == "zh-CN"

    async def test_create_schema_voice_temperature_bounds(self):
        """HcpProfileCreate accepts valid voice_temperature values."""
        data = HcpProfileCreate(
            name="Dr. Temp",
            specialty="GP",
            created_by="user-123",
            voice_temperature=0.5,
        )
        assert data.voice_temperature == 0.5


class TestHcpProfileUpdateVoiceFields:
    """Tests for HcpProfileUpdate schema with voice/avatar fields."""

    async def test_update_schema_voice_fields_optional(self):
        """HcpProfileUpdate voice/avatar fields are all optional."""
        data = HcpProfileUpdate()
        assert data.voice_name is None
        assert data.voice_type is None
        assert data.voice_temperature is None
        assert data.voice_custom is None
        assert data.avatar_character is None
        assert data.avatar_style is None
        assert data.avatar_customized is None
        assert data.turn_detection_type is None
        assert data.noise_suppression is None
        assert data.echo_cancellation is None
        assert data.eou_detection is None
        assert data.recognition_language is None
        assert data.agent_instructions_override is None

    async def test_update_schema_partial_voice_update(self):
        """HcpProfileUpdate allows partial voice field updates."""
        data = HcpProfileUpdate(
            voice_name="en-US-JennyNeural",
            voice_temperature=0.6,
        )
        assert data.voice_name == "en-US-JennyNeural"
        assert data.voice_temperature == 0.6
        # Other fields remain None
        assert data.avatar_character is None
        assert data.turn_detection_type is None


class TestHcpProfileResponseVoiceFields:
    """Tests for HcpProfileResponse schema with voice/avatar fields."""

    async def test_response_schema_includes_all_13_voice_fields(self):
        """HcpProfileResponse includes all 13 voice/avatar field keys."""
        resp = HcpProfileResponse(
            id="test-id",
            name="Dr. Test",
            specialty="Oncology",
            hospital="Test Hospital",
            title="Chief",
            avatar_url="",
            personality_type="friendly",
            emotional_state=50,
            communication_style=50,
            expertise_areas="[]",
            prescribing_habits="",
            concerns="",
            objections="[]",
            probe_topics="[]",
            difficulty="medium",
            is_active=True,
            created_by="user-123",
            created_at="2026-01-01T00:00:00",
            updated_at="2026-01-01T00:00:00",
            voice_name="zh-CN-YunxiNeural",
            voice_type="azure-standard",
            voice_temperature=0.7,
            voice_custom=False,
            avatar_character="harry",
            avatar_style="business",
            avatar_customized=False,
            turn_detection_type="azure_semantic_vad",
            noise_suppression=True,
            echo_cancellation=False,
            eou_detection=False,
            recognition_language="zh-CN",
            agent_instructions_override="Custom instructions",
        )
        # Verify all 13 voice/avatar fields
        assert resp.voice_name == "zh-CN-YunxiNeural"
        assert resp.voice_type == "azure-standard"
        assert resp.voice_temperature == 0.7
        assert resp.voice_custom is False
        assert resp.avatar_character == "harry"
        assert resp.avatar_style == "business"
        assert resp.avatar_customized is False
        assert resp.turn_detection_type == "azure_semantic_vad"
        assert resp.noise_suppression is True
        assert resp.echo_cancellation is False
        assert resp.eou_detection is False
        assert resp.recognition_language == "zh-CN"
        assert resp.agent_instructions_override == "Custom instructions"


class TestHcpProfileCRUDVoiceAPI:
    """Integration tests for HCP profile API with voice/avatar fields."""

    @patch("app.services.hcp_profile_service.agent_sync_service.prefetch_sync_config")
    @patch("app.services.hcp_profile_service.agent_sync_service.sync_agent_for_profile")
    async def test_create_hcp_profile_with_voice_fields(self, mock_sync, mock_prefetch, client):
        """POST /api/v1/hcp-profiles with voice fields returns 201 with fields."""
        mock_prefetch.return_value = ("https://endpoint", "key", "gpt-4o")
        mock_sync.return_value = {"id": "agent-1", "version": "1", "model": "gpt-4o"}

        user_id, token = await _create_admin_and_token("hcp_create_voice")
        response = await client.post(
            "/api/v1/hcp-profiles",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Dr. Voice",
                "specialty": "Oncology",
                "created_by": user_id,
                "voice_name": "en-US-JennyNeural",
                "avatar_character": "lisa",
                "avatar_style": "technical-sitting",
                "voice_temperature": 0.5,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["voice_name"] == "en-US-JennyNeural"
        assert data["avatar_character"] == "lisa"
        assert data["avatar_style"] == "technical-sitting"
        assert data["voice_temperature"] == 0.5

    @patch("app.services.hcp_profile_service.agent_sync_service.prefetch_sync_config")
    @patch("app.services.hcp_profile_service.agent_sync_service.sync_agent_for_profile")
    async def test_create_hcp_profile_with_defaults(self, mock_sync, mock_prefetch, client):
        """POST /api/v1/hcp-profiles with only name+specialty uses D-04 defaults."""
        mock_prefetch.return_value = ("https://endpoint", "key", "gpt-4o")
        mock_sync.return_value = {"id": "agent-2", "version": "1", "model": "gpt-4o"}

        user_id, token = await _create_admin_and_token("hcp_defaults_voice")
        response = await client.post(
            "/api/v1/hcp-profiles",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Dr. Default",
                "specialty": "GP",
                "created_by": user_id,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["voice_name"] == "en-US-AvaNeural"
        assert data["avatar_character"] == "lori"
        assert data["voice_temperature"] == 0.9
        assert data["turn_detection_type"] == "server_vad"

    @patch("app.services.hcp_profile_service.agent_sync_service.prefetch_sync_config")
    @patch("app.services.hcp_profile_service.agent_sync_service.sync_agent_for_profile")
    async def test_update_hcp_profile_voice_fields(self, mock_sync, mock_prefetch, client):
        """PUT /api/v1/hcp-profiles/{id} updates voice fields."""
        mock_prefetch.return_value = ("https://endpoint", "key", "gpt-4o")
        mock_sync.return_value = {"id": "agent-3", "version": "1", "model": "gpt-4o"}

        user_id, token = await _create_admin_and_token("hcp_update_voice")

        # Create profile first
        create_response = await client.post(
            "/api/v1/hcp-profiles",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Dr. Updatable",
                "specialty": "Cardiology",
                "created_by": user_id,
            },
        )
        assert create_response.status_code == 201
        profile_id = create_response.json()["id"]

        # Update voice fields
        mock_sync.return_value = {"id": "agent-3", "version": "2", "model": "gpt-4o"}
        update_response = await client.put(
            f"/api/v1/hcp-profiles/{profile_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "voice_name": "zh-CN-YunxiNeural",
                "avatar_character": "harry",
                "turn_detection_type": "azure_semantic_vad",
                "noise_suppression": True,
            },
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["voice_name"] == "zh-CN-YunxiNeural"
        assert data["avatar_character"] == "harry"
        assert data["turn_detection_type"] == "azure_semantic_vad"
        assert data["noise_suppression"] is True

    @patch("app.services.hcp_profile_service.agent_sync_service.prefetch_sync_config")
    @patch("app.services.hcp_profile_service.agent_sync_service.sync_agent_for_profile")
    async def test_get_hcp_profile_includes_voice_fields(self, mock_sync, mock_prefetch, client):
        """GET /api/v1/hcp-profiles/{id} response includes all 13 voice/avatar keys."""
        mock_prefetch.return_value = ("https://endpoint", "key", "gpt-4o")
        mock_sync.return_value = {"id": "agent-4", "version": "1", "model": "gpt-4o"}

        user_id, token = await _create_admin_and_token("hcp_get_voice")

        # Create profile
        create_response = await client.post(
            "/api/v1/hcp-profiles",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Dr. GetVoice",
                "specialty": "Neurology",
                "created_by": user_id,
                "voice_name": "en-US-GuyNeural",
                "avatar_character": "jeff",
            },
        )
        assert create_response.status_code == 201
        profile_id = create_response.json()["id"]

        # Get profile
        get_response = await client.get(
            f"/api/v1/hcp-profiles/{profile_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert get_response.status_code == 200
        data = get_response.json()

        # All 13 voice/avatar field keys must be present
        voice_fields = [
            "voice_name",
            "voice_type",
            "voice_temperature",
            "voice_custom",
            "avatar_character",
            "avatar_style",
            "avatar_customized",
            "turn_detection_type",
            "noise_suppression",
            "echo_cancellation",
            "eou_detection",
            "recognition_language",
            "agent_instructions_override",
        ]
        for field in voice_fields:
            assert field in data, f"Missing voice/avatar field: {field}"
