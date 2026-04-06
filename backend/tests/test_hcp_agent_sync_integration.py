"""Integration tests for HCP profile agent sync lifecycle.

Tests that creating/updating/deleting HCP profiles triggers agent sync,
retry-sync endpoint works, and token broker sources agent_id from HCP profiles.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.dependencies import get_current_user
from app.main import app
from app.models.hcp_profile import HcpProfile
from app.models.user import User
from app.services.agent_sync_service import (
    _chunk_metadata_value,
    build_voice_live_metadata,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _fake_admin_user() -> User:
    """Create a fake admin user for dependency override."""
    user = MagicMock(spec=User)
    user.id = "admin-user-id-001"
    user.role = "admin"
    user.username = "testadmin"
    user.is_active = True
    return user


@pytest.fixture
def admin_client(db_session):
    """Async HTTP client with auth + db overrides for admin access."""

    async def override_get_db():
        yield db_session

    async def override_get_current_user():
        return _fake_admin_user()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield
    app.dependency_overrides.clear()


@pytest.fixture
async def aclient(admin_client):
    """Async HTTP client with admin overrides applied."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


PROFILE_DATA = {
    "name": "Dr. Test Chen",
    "specialty": "Oncology",
    "hospital": "Test Hospital",
    "title": "Professor",
    "personality_type": "analytical",
    "emotional_state": 45,
    "communication_style": 60,
    "expertise_areas": ["immunotherapy"],
    "prescribing_habits": "Evidence-based",
    "concerns": "Safety data",
    "objections": ["cost"],
    "probe_topics": ["efficacy"],
    "difficulty": "medium",
    "is_active": True,
    "created_by": "admin-user-id-001",
}


# ---------------------------------------------------------------------------
# Test 1: get_voice_live_token with hcp_profile_id returns profile agent_id
# ---------------------------------------------------------------------------


@patch("app.services.voice_live_service.config_service")
@patch("app.services.voice_live_service.parse_voice_live_mode")
async def test_voice_live_token_with_hcp_profile_id(mock_parse, mock_cfg, db_session):
    """Token broker returns agent_id from HCP profile when hcp_profile_id provided."""
    # Create a profile with agent_id
    profile = HcpProfile(
        name="Dr. Token Test",
        specialty="Cardiology",
        agent_id="asst_from_profile",
        agent_sync_status="synced",
        created_by="user-001",
    )
    db_session.add(profile)
    await db_session.flush()
    await db_session.refresh(profile)

    # Mock config_service
    vl_config = MagicMock()
    vl_config.is_active = True
    vl_config.region = "eastus2"
    vl_config.model_or_deployment = "agent:asst_config_level|proj_test"
    mock_cfg.get_config = AsyncMock(return_value=vl_config)
    mock_cfg.get_effective_key = AsyncMock(return_value="test-key")
    mock_cfg.get_effective_endpoint = AsyncMock(return_value="https://test.openai.azure.com")
    master = MagicMock()
    master.region = "eastus2"
    master.default_project = "master-default-project"
    mock_cfg.get_master_config = AsyncMock(return_value=master)

    # Parse returns agent mode
    mock_parse.return_value = {
        "mode": "agent",
        "agent_id": "asst_config_level",
        "project_name": "proj_test",
    }

    from app.services.voice_live_service import get_voice_live_token

    result = await get_voice_live_token(db_session, hcp_profile_id=profile.id)

    # Should use profile's agent_id, not config-level
    assert result.agent_id == "asst_from_profile"
    # When HCP profile overrides agent, project_name comes from master default_project
    assert result.project_name == "master-default-project"
    # Agent mode: token masked for security, auth_type = bearer
    assert result.auth_type == "bearer"
    assert result.token == "***configured***"


# ---------------------------------------------------------------------------
# Test 2: get_voice_live_token with hcp_profile_id but no profile agent_id (fallback)
# ---------------------------------------------------------------------------


@patch("app.services.voice_live_service.config_service")
@patch("app.services.voice_live_service.parse_voice_live_mode")
async def test_voice_live_token_fallback_to_config(mock_parse, mock_cfg, db_session):
    """Token broker falls back to config-level agent_id when profile has none."""
    profile = HcpProfile(
        name="Dr. No Agent",
        specialty="Dermatology",
        agent_id="",
        agent_sync_status="none",
        created_by="user-001",
    )
    db_session.add(profile)
    await db_session.flush()
    await db_session.refresh(profile)

    vl_config = MagicMock()
    vl_config.is_active = True
    vl_config.region = "eastus2"
    vl_config.model_or_deployment = "agent:asst_config_level|proj_test"
    mock_cfg.get_config = AsyncMock(return_value=vl_config)
    mock_cfg.get_effective_key = AsyncMock(return_value="test-key")
    mock_cfg.get_effective_endpoint = AsyncMock(return_value="https://test.openai.azure.com")
    master = MagicMock()
    master.region = "eastus2"
    master.default_project = "master-default-project"
    mock_cfg.get_master_config = AsyncMock(return_value=master)

    mock_parse.return_value = {
        "mode": "agent",
        "agent_id": "asst_config_level",
        "project_name": "proj_test",
    }

    from app.services.voice_live_service import get_voice_live_token

    result = await get_voice_live_token(db_session, hcp_profile_id=profile.id)

    # Should fall back to config-level agent_id since profile has none
    assert result.agent_id == "asst_config_level"


# ---------------------------------------------------------------------------
# Test 3: get_voice_live_token without hcp_profile_id (backward compatible)
# ---------------------------------------------------------------------------


@patch("app.services.voice_live_service.config_service")
@patch("app.services.voice_live_service.parse_voice_live_mode")
async def test_voice_live_token_backward_compatible(mock_parse, mock_cfg, db_session):
    """Token broker behaves as before when no hcp_profile_id provided."""
    vl_config = MagicMock()
    vl_config.is_active = True
    vl_config.region = "eastus2"
    vl_config.model_or_deployment = "agent:asst_default|proj_default"
    mock_cfg.get_config = AsyncMock(return_value=vl_config)
    mock_cfg.get_effective_key = AsyncMock(return_value="test-key")
    mock_cfg.get_effective_endpoint = AsyncMock(return_value="https://test.openai.azure.com")
    master = MagicMock()
    master.region = "eastus2"
    master.default_project = "master-default-project"
    mock_cfg.get_master_config = AsyncMock(return_value=master)

    mock_parse.return_value = {
        "mode": "agent",
        "agent_id": "asst_default",
        "project_name": "proj_default",
    }

    from app.services.voice_live_service import get_voice_live_token

    result = await get_voice_live_token(db_session)

    # Without hcp_profile_id, should use config-level agent_id
    assert result.agent_id == "asst_default"
    assert result.project_name == "proj_default"


# ---------------------------------------------------------------------------
# Test 4: create_profile endpoint triggers agent sync
# ---------------------------------------------------------------------------


@patch("app.services.hcp_profile_service.agent_sync_service")
async def test_create_profile_triggers_agent_sync(mock_sync, aclient):
    """POST /hcp-profiles triggers agent sync and returns agent_sync_status."""
    mock_sync.sync_agent_for_profile = AsyncMock(return_value={"id": "asst_test123"})

    resp = await aclient.post(
        "/api/v1/hcp-profiles",
        json=PROFILE_DATA,
    )

    assert resp.status_code == 201
    data = resp.json()
    assert data["agent_sync_status"] in ("synced", "pending", "failed")
    mock_sync.sync_agent_for_profile.assert_called_once()


# ---------------------------------------------------------------------------
# Test 5: update_profile endpoint triggers agent re-sync
# ---------------------------------------------------------------------------


@patch("app.services.hcp_profile_service.agent_sync_service")
async def test_update_profile_triggers_agent_sync(mock_sync, aclient):
    """PUT /hcp-profiles/{id} triggers agent re-sync."""
    mock_sync.sync_agent_for_profile = AsyncMock(return_value={"id": "asst_test123"})

    # First create a profile
    create_resp = await aclient.post(
        "/api/v1/hcp-profiles",
        json=PROFILE_DATA,
    )
    assert create_resp.status_code == 201
    profile_id = create_resp.json()["id"]

    # Reset mock to track update call
    mock_sync.sync_agent_for_profile.reset_mock()

    # Update the profile
    resp = await aclient.put(
        f"/api/v1/hcp-profiles/{profile_id}",
        json={"name": "Dr. Updated Chen"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["agent_sync_status"] in ("synced", "pending", "failed")
    mock_sync.sync_agent_for_profile.assert_called_once()


# ---------------------------------------------------------------------------
# Test 6: delete_profile endpoint attempts agent deletion
# ---------------------------------------------------------------------------


@patch("app.services.hcp_profile_service.agent_sync_service")
async def test_delete_profile_attempts_agent_deletion(mock_sync, aclient):
    """DELETE /hcp-profiles/{id} attempts to delete the AI Foundry agent."""
    mock_sync.sync_agent_for_profile = AsyncMock(return_value={"id": "asst_delete_me"})
    mock_sync.delete_agent = AsyncMock(return_value=True)

    # Create a profile (which gets an agent_id via mock)
    create_resp = await aclient.post(
        "/api/v1/hcp-profiles",
        json=PROFILE_DATA,
    )
    assert create_resp.status_code == 201
    profile_id = create_resp.json()["id"]

    # Delete the profile
    resp = await aclient.delete(f"/api/v1/hcp-profiles/{profile_id}")

    assert resp.status_code == 204
    # Verify delete_agent was called with the agent_id
    mock_sync.delete_agent.assert_called_once()
    call_args = mock_sync.delete_agent.call_args
    assert call_args[0][1] == "asst_delete_me"  # second positional arg is agent_id


# ---------------------------------------------------------------------------
# Test 7: retry_sync endpoint returns updated profile
# ---------------------------------------------------------------------------


@patch("app.services.hcp_profile_service.agent_sync_service")
async def test_retry_sync(mock_sync, aclient):
    """POST /hcp-profiles/{id}/retry-sync retries agent sync."""
    # First sync fails on create
    mock_sync.sync_agent_for_profile = AsyncMock(side_effect=Exception("Connection failed"))

    create_resp = await aclient.post(
        "/api/v1/hcp-profiles",
        json=PROFILE_DATA,
    )
    assert create_resp.status_code == 201
    profile_id = create_resp.json()["id"]
    assert create_resp.json()["agent_sync_status"] == "failed"

    # Now retry succeeds
    mock_sync.sync_agent_for_profile = AsyncMock(return_value={"id": "asst_retried_ok"})

    resp = await aclient.post(f"/api/v1/hcp-profiles/{profile_id}/retry-sync")

    assert resp.status_code == 200
    data = resp.json()
    assert data["agent_sync_status"] == "synced"
    assert data["agent_id"] == "asst_retried_ok"


# ---------------------------------------------------------------------------
# Test 8: create_profile with agent sync failure saves profile with failed status
# ---------------------------------------------------------------------------


@patch("app.services.hcp_profile_service.agent_sync_service")
async def test_create_profile_sync_failure(mock_sync, aclient):
    """Profile is saved even when agent sync fails (D-02, D-10)."""
    mock_sync.sync_agent_for_profile = AsyncMock(
        side_effect=Exception("AI Foundry API unavailable")
    )

    resp = await aclient.post(
        "/api/v1/hcp-profiles",
        json=PROFILE_DATA,
    )

    # Profile should still be created (201), with failed sync status
    assert resp.status_code == 201
    data = resp.json()
    assert data["agent_sync_status"] == "failed"
    assert "AI Foundry API unavailable" in data["agent_sync_error"]
    assert data["agent_id"] == ""  # No agent_id since sync failed


# ---------------------------------------------------------------------------
# Test 9: build_voice_live_metadata — basic config
# ---------------------------------------------------------------------------


def test_build_voice_live_metadata_basic():
    """Standard profile produces correct Voice Live metadata JSON."""
    profile = MagicMock()
    profile.voice_live_enabled = True
    profile.voice_name = "en-US-AvaNeural"
    profile.voice_type = "azure-standard"
    profile.voice_temperature = 0.9
    profile.turn_detection_type = "server_vad"
    profile.noise_suppression = False
    profile.echo_cancellation = False
    profile.eou_detection = False

    result = build_voice_live_metadata(profile)

    assert result is not None
    # Should have exactly one key (config fits in 512 chars)
    assert "microsoft.voice-live.configuration" in result
    config = json.loads(result["microsoft.voice-live.configuration"])
    assert config["voice"]["type"] == "azure-standard"
    assert config["voice"]["name"] == "en-US-AvaNeural"
    assert config["voice"]["temperature"] == 0.9
    assert config["turn_detection"]["type"] == "server_vad"
    # No noise/echo keys when disabled
    assert "input_audio_noise_reduction" not in config
    assert "input_audio_echo_cancellation" not in config


# ---------------------------------------------------------------------------
# Test 10: build_voice_live_metadata — with noise + echo
# ---------------------------------------------------------------------------


def test_build_voice_live_metadata_with_noise_echo():
    """Noise suppression and echo cancellation flags appear in metadata."""
    profile = MagicMock()
    profile.voice_live_enabled = True
    profile.voice_name = "en-US-JennyNeural"
    profile.voice_type = "azure-standard"
    profile.voice_temperature = 0.7
    profile.turn_detection_type = "server_vad"
    profile.noise_suppression = True
    profile.echo_cancellation = True
    profile.eou_detection = True

    result = build_voice_live_metadata(profile)

    assert result is not None
    config = json.loads(result["microsoft.voice-live.configuration"])
    assert config["input_audio_noise_reduction"]["type"] == "azure_deep_noise_suppression"
    assert config["input_audio_echo_cancellation"]["type"] == "server_echo_cancellation"
    eou = config["turn_detection"]["end_of_utterance_detection"]
    assert eou["model"] == "semantic_detection_v1"


# ---------------------------------------------------------------------------
# Test 11: build_voice_live_metadata — disabled returns None
# ---------------------------------------------------------------------------


def test_build_voice_live_metadata_disabled():
    """voice_live_enabled=False returns None (no metadata attached to agent)."""
    profile = MagicMock()
    profile.voice_live_enabled = False

    result = build_voice_live_metadata(profile)

    assert result is None


# ---------------------------------------------------------------------------
# Test 12: _chunk_metadata_value — short value stays single key
# ---------------------------------------------------------------------------


def test_chunk_metadata_value_short():
    """Short value fits in one chunk."""
    result = _chunk_metadata_value("key", "short value", max_len=512)
    assert result == {"key": "short value"}


# ---------------------------------------------------------------------------
# Test 13: _chunk_metadata_value — long value splits correctly
# ---------------------------------------------------------------------------


def test_chunk_metadata_value_long():
    """Long value is split at 512-char boundaries."""
    long_value = "A" * 1200
    result = _chunk_metadata_value("key", long_value, max_len=512)

    assert len(result) == 3
    assert "key" in result
    assert "key.1" in result
    assert "key.2" in result
    assert len(result["key"]) == 512
    assert len(result["key.1"]) == 512
    assert len(result["key.2"]) == 176
    # Reassembled value matches original
    reassembled = result["key"] + result["key.1"] + result["key.2"]
    assert reassembled == long_value


# ---------------------------------------------------------------------------
# Test 14: build_voice_live_metadata — non-azure-standard voice omits temperature
# ---------------------------------------------------------------------------


def test_build_voice_live_metadata_custom_voice():
    """Custom voice type omits temperature field."""
    profile = MagicMock()
    profile.voice_live_enabled = True
    profile.voice_name = "my-custom-voice"
    profile.voice_type = "custom-neural"
    profile.voice_temperature = 0.9
    profile.turn_detection_type = "server_vad"
    profile.noise_suppression = False
    profile.echo_cancellation = False
    profile.eou_detection = False

    result = build_voice_live_metadata(profile)

    assert result is not None
    config = json.loads(result["microsoft.voice-live.configuration"])
    assert config["voice"]["type"] == "custom-neural"
    assert config["voice"]["name"] == "my-custom-voice"
    assert "temperature" not in config["voice"]
