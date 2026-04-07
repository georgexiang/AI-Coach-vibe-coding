"""Integration tests for Voice Live WebSocket proxy handler.

Tests the backend WebSocket proxy (voice_live_websocket.py) using REAL configuration
data seeded into the test database. The Azure Voice Live SDK `connect()` is mocked
via sys.modules (because the handler uses lazy imports inside the function body),
but all config resolution, DB lookups, and message routing use real code paths
with real data from .env.

Test categories:
  1. _load_connection_config — config loading from DB with real values
  2. handle_voice_live_websocket — full proxy flow with mocked SDK
  3. Real credential verification — encrypt/decrypt round-trip
  4. WebSocket authentication — JWT token validation via query parameter
"""

import asyncio
import json
import sys
import types
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import WebSocket

from app.config import get_settings
from app.models.hcp_profile import HcpProfile
from app.models.service_config import ServiceConfig
from app.models.voice_live_instance import VoiceLiveInstance
from app.services.voice_live_websocket import (
    _load_connection_config,
    handle_voice_live_websocket,
)
from app.utils.encryption import encrypt_value

# ---------------------------------------------------------------------------
# Real config from .env — used to seed test DB
# ---------------------------------------------------------------------------

settings = get_settings()

REAL_FOUNDRY_ENDPOINT = settings.azure_foundry_endpoint
REAL_FOUNDRY_API_KEY = settings.azure_foundry_api_key
REAL_FOUNDRY_PROJECT = settings.azure_foundry_default_project

# Skip all tests if real Azure credentials are not configured
pytestmark = pytest.mark.skipif(
    not REAL_FOUNDRY_ENDPOINT or not REAL_FOUNDRY_API_KEY,
    reason="AZURE_FOUNDRY_ENDPOINT and AZURE_FOUNDRY_API_KEY required for real config tests",
)


# ---------------------------------------------------------------------------
# Fixtures — seed test DB with real Azure config
# ---------------------------------------------------------------------------


@pytest.fixture
async def seeded_db(db_session):
    """Seed test DB with real Azure AI Foundry config from .env.

    Creates:
    - Master config (ai_foundry) with real endpoint, key, project
    - Voice Live service config (azure_voice_live) in model mode
    - Avatar service config (azure_avatar, inactive by default)
    """
    # Master AI Foundry config — real credentials
    master = ServiceConfig(
        service_name="ai_foundry",
        display_name="Azure AI Foundry",
        endpoint=REAL_FOUNDRY_ENDPOINT,
        api_key_encrypted=encrypt_value(REAL_FOUNDRY_API_KEY),
        model_or_deployment="gpt-4o",
        region="swedencentral",
        default_project=REAL_FOUNDRY_PROJECT,
        is_master=True,
        is_active=True,
        updated_by="test-seed",
    )
    db_session.add(master)

    # Voice Live service config — model mode with supported model
    voice_live = ServiceConfig(
        service_name="azure_voice_live",
        display_name="Azure Voice Live",
        endpoint="",  # inherit from master
        api_key_encrypted="",  # inherit from master
        model_or_deployment="gpt-4o",
        region="swedencentral",
        is_master=False,
        is_active=True,
        updated_by="test-seed",
    )
    db_session.add(voice_live)

    # Avatar config — inactive for most tests
    avatar = ServiceConfig(
        service_name="azure_avatar",
        display_name="Azure Avatar",
        endpoint="",
        api_key_encrypted="",
        model_or_deployment="Lisa-casual-sitting",
        region="",
        is_master=False,
        is_active=False,
        updated_by="test-seed",
    )
    db_session.add(avatar)

    await db_session.flush()
    return db_session


@pytest.fixture
async def seeded_db_model_mode(db_session):
    """Seed test DB with gpt-4o-realtime-preview model config."""
    master = ServiceConfig(
        service_name="ai_foundry",
        display_name="Azure AI Foundry",
        endpoint=REAL_FOUNDRY_ENDPOINT,
        api_key_encrypted=encrypt_value(REAL_FOUNDRY_API_KEY),
        model_or_deployment="gpt-4o",
        region="swedencentral",
        default_project=REAL_FOUNDRY_PROJECT,
        is_master=True,
        is_active=True,
        updated_by="test-seed",
    )
    db_session.add(master)

    # Voice Live in model mode
    voice_live = ServiceConfig(
        service_name="azure_voice_live",
        display_name="Azure Voice Live",
        endpoint="",
        api_key_encrypted="",
        model_or_deployment="gpt-4o-realtime-preview",
        region="swedencentral",
        is_master=False,
        is_active=True,
        updated_by="test-seed",
    )
    db_session.add(voice_live)

    await db_session.flush()
    return db_session


@pytest.fixture
async def seeded_db_with_avatar(db_session):
    """Seed test DB with avatar enabled."""
    master = ServiceConfig(
        service_name="ai_foundry",
        display_name="Azure AI Foundry",
        endpoint=REAL_FOUNDRY_ENDPOINT,
        api_key_encrypted=encrypt_value(REAL_FOUNDRY_API_KEY),
        model_or_deployment="gpt-4o",
        region="swedencentral",
        default_project=REAL_FOUNDRY_PROJECT,
        is_master=True,
        is_active=True,
        updated_by="test-seed",
    )
    db_session.add(master)

    voice_live = ServiceConfig(
        service_name="azure_voice_live",
        display_name="Azure Voice Live",
        endpoint="",
        api_key_encrypted="",
        model_or_deployment="gpt-4o",
        region="swedencentral",
        is_master=False,
        is_active=True,
        updated_by="test-seed",
    )
    db_session.add(voice_live)

    # Avatar active with master key inherited
    avatar = ServiceConfig(
        service_name="azure_avatar",
        display_name="Azure Avatar",
        endpoint="",
        api_key_encrypted=encrypt_value(REAL_FOUNDRY_API_KEY),
        model_or_deployment="Lisa-casual-sitting",
        region="",
        is_master=False,
        is_active=True,
        updated_by="test-seed",
    )
    db_session.add(avatar)

    await db_session.flush()
    return db_session


@pytest.fixture
async def hcp_profile_with_agent(seeded_db):
    """Create an HCP profile with a synced agent_id."""
    profile = HcpProfile(
        name="Dr. WebSocket Test",
        specialty="Oncology",
        agent_id="asst_hcp_override_agent",
        agent_sync_status="synced",
        voice_name="zh-CN-XiaoxiaoMultilingualNeural",
        voice_type="azure-standard",
        avatar_character="Lisa-casual-sitting",
        avatar_style="casual",
        avatar_customized=False,
        agent_instructions_override="",
        created_by="test-user",
    )
    seeded_db.add(profile)
    await seeded_db.flush()
    await seeded_db.refresh(profile)
    return profile, seeded_db


@pytest.fixture
async def hcp_with_vl_instance(seeded_db):
    """Create an HCP profile linked to a VL Instance.

    The VL Instance has its own model_instruction ("You are an English teacher"),
    while the HCP profile has different instructions.
    Used to test that HCP instructions take priority over VL Instance instructions.
    """
    # Create VL Instance with its own instructions
    vl_inst = VoiceLiveInstance(
        name="VL-Female-Video",
        voice_live_model="gpt-4o",
        voice_name="en-US-AvaNeural",
        voice_type="azure-standard",
        avatar_character="lisa",
        avatar_style="casual-sitting",
        avatar_enabled=True,
        model_instruction="You are an English teacher named Clara.",
        created_by="test-user",
    )
    seeded_db.add(vl_inst)
    await seeded_db.flush()
    await seeded_db.refresh(vl_inst)

    # Create HCP profile linked to VL Instance — no override, no agent
    profile = HcpProfile(
        name="Dr. Wang Fang",
        specialty="Neurology",
        agent_id="",
        agent_sync_status="none",
        voice_live_instance_id=vl_inst.id,
        agent_instructions_override="",
        created_by="test-user",
    )
    seeded_db.add(profile)
    await seeded_db.flush()
    await seeded_db.refresh(profile)
    return profile, vl_inst, seeded_db


@pytest.fixture
async def hcp_with_vl_and_override(seeded_db):
    """HCP profile linked to VL Instance, but HCP has its own override.

    VL Instance: "You are an English teacher named Clara."
    HCP override: "You are Dr. Li Ming, a Cardiologist."
    Expected: HCP override wins.
    """
    vl_inst = VoiceLiveInstance(
        name="VL-Male-Video",
        voice_live_model="gpt-4o",
        voice_name="en-US-AvaNeural",
        voice_type="azure-standard",
        avatar_character="lisa",
        avatar_style="casual-sitting",
        avatar_enabled=True,
        model_instruction="You are an English teacher named Clara.",
        created_by="test-user",
    )
    seeded_db.add(vl_inst)
    await seeded_db.flush()
    await seeded_db.refresh(vl_inst)

    profile = HcpProfile(
        name="Dr. Li Ming",
        specialty="Cardiology",
        agent_id="asst_li_ming",
        agent_sync_status="synced",
        voice_live_instance_id=vl_inst.id,
        agent_instructions_override="You are Dr. Li Ming, a Cardiologist.",
        created_by="test-user",
    )
    seeded_db.add(profile)
    await seeded_db.flush()
    await seeded_db.refresh(profile)
    return profile, vl_inst, seeded_db


@pytest.fixture
async def vl_instance_standalone(seeded_db):
    """Standalone VL Instance (no HCP) with its own instructions."""
    vl_inst = VoiceLiveInstance(
        name="VL-Standalone-Test",
        voice_live_model="gpt-4o",
        voice_name="zh-CN-XiaoxiaoMultilingualNeural",
        voice_type="azure-standard",
        avatar_character="lisa",
        avatar_style="casual-sitting",
        avatar_enabled=False,
        model_instruction="You are a helpful AI assistant for testing.",
        created_by="test-user",
    )
    seeded_db.add(vl_inst)
    await seeded_db.flush()
    await seeded_db.refresh(vl_inst)
    return vl_inst, seeded_db


# ===========================================================================
# Test 1: _load_connection_config — real DB config resolution
# ===========================================================================


class TestLoadConnectionConfig:
    """Tests for _load_connection_config using real DB-seeded config."""

    async def test_model_mode_config_from_db(self, seeded_db):
        """Model mode loads model name from DB (always model mode)."""
        cfg = await _load_connection_config(seeded_db)

        assert cfg["model"] == "gpt-4o"
        # Endpoint used as-is (no cognitiveservices transform)
        assert cfg["endpoint"]
        assert cfg["endpoint"] == REAL_FOUNDRY_ENDPOINT.rstrip("/")
        # No agent-related keys
        assert "is_agent" not in cfg
        assert "agent_id" not in cfg
        assert "project_name" not in cfg
        # API key should be the real key from master
        assert cfg["api_key"] == REAL_FOUNDRY_API_KEY

    async def test_model_mode_realtime_preview(self, seeded_db_model_mode):
        """Model mode loads gpt-4o-realtime-preview when configured."""
        cfg = await _load_connection_config(seeded_db_model_mode)

        assert cfg["model"] == "gpt-4o-realtime-preview"
        assert "is_agent" not in cfg
        assert "agent_id" not in cfg
        assert cfg["api_key"] == REAL_FOUNDRY_API_KEY

    async def test_avatar_enabled_from_db(self, seeded_db_with_avatar):
        """Avatar enabled when azure_avatar config is active with key."""
        cfg = await _load_connection_config(seeded_db_with_avatar)

        assert cfg["avatar_enabled"] is True
        # avatar_character comes from azure_avatar config model_or_deployment
        assert cfg["avatar_character"] == "Lisa-casual-sitting"

    async def test_avatar_disabled_when_inactive(self, seeded_db):
        """Avatar disabled when azure_avatar config is inactive."""
        cfg = await _load_connection_config(seeded_db)

        assert cfg["avatar_enabled"] is False

    async def test_hcp_profile_overrides_voice_settings(self, hcp_profile_with_agent):
        """HCP profile overrides voice/avatar settings in model mode."""
        profile, db = hcp_profile_with_agent

        cfg = await _load_connection_config(db, hcp_profile_id=profile.id)

        # Always model mode — no agent keys
        assert "is_agent" not in cfg
        assert "agent_id" not in cfg
        # Voice settings from profile
        assert cfg["voice_name"] == "zh-CN-XiaoxiaoMultilingualNeural"
        assert cfg["voice_type"] == "azure-standard"
        # Model defaults to gpt-4o (profile has no voice_live_model override)
        assert cfg["model"] == "gpt-4o"

    async def test_hcp_profile_voice_settings_applied(self, seeded_db):
        """HCP profile voice settings are applied in model mode."""
        profile = HcpProfile(
            name="Dr. No Agent",
            specialty="Cardiology",
            agent_id="",
            agent_sync_status="none",
            voice_name="en-US-AvaNeural",
            voice_type="azure-standard",
            created_by="test-user",
        )
        seeded_db.add(profile)
        await seeded_db.flush()
        await seeded_db.refresh(profile)

        cfg = await _load_connection_config(seeded_db, hcp_profile_id=profile.id)

        # Always model mode
        assert "is_agent" not in cfg
        # Voice from profile
        assert cfg["voice_name"] == "en-US-AvaNeural"
        assert cfg["model"] == "gpt-4o"

    async def test_system_prompt_passed_through(self, seeded_db):
        """System prompt is passed through to config."""
        cfg = await _load_connection_config(
            seeded_db,
            system_prompt="You are Dr. Chen, an oncologist",
        )

        assert cfg["system_prompt"] == "You are Dr. Chen, an oncologist"

    async def test_missing_config_raises(self, db_session):
        """Missing voice_live config raises ValueError."""
        with pytest.raises(ValueError, match="not configured"):
            await _load_connection_config(db_session)

    # =======================================================================
    # HCP Instructions Priority Tests (Bug fix: HCP > client prompt > auto-gen)
    # =======================================================================

    async def test_hcp_with_override_uses_hcp_override(self, hcp_with_vl_and_override):
        """HCP's own agent_instructions_override takes priority over VL Instance's.

        Bug fix: previously used VL Instance's model_instruction
        (e.g., "English teacher"), ignoring the HCP profile's own override.
        """
        profile, vl_inst, db = hcp_with_vl_and_override

        cfg = await _load_connection_config(db, hcp_profile_id=profile.id)

        # HCP's override should win, NOT VL Instance's
        assert cfg["instructions"] == "You are Dr. Li Ming, a Cardiologist."
        # VL Instance has "English teacher" but should NOT appear
        assert "English teacher" not in cfg["instructions"]
        assert "Clara" not in cfg["instructions"]

    async def test_hcp_without_override_uses_client_system_prompt(self, hcp_with_vl_instance):
        """When HCP has no override, client-sent system_prompt is used as fallback.

        This is the auto-generated instructions sent by the frontend from
        the InstructionsSection component.
        """
        profile, vl_inst, db = hcp_with_vl_instance

        cfg = await _load_connection_config(
            db,
            hcp_profile_id=profile.id,
            system_prompt="You are Dr. Wang Fang, a Neurology specialist.",
        )

        # Client system_prompt should be used (auto-generated from frontend)
        assert cfg["instructions"] == "You are Dr. Wang Fang, a Neurology specialist."
        # NOT the VL Instance's instructions
        assert "English teacher" not in cfg["instructions"]
        assert "Clara" not in cfg["instructions"]

    async def test_hcp_without_override_and_no_prompt_uses_auto_gen(self, hcp_with_vl_instance):
        """When HCP has no override AND no client system_prompt, auto-generate from profile.

        Falls back to build_agent_instructions(profile.to_prompt_dict()).
        """
        profile, vl_inst, db = hcp_with_vl_instance

        cfg = await _load_connection_config(
            db,
            hcp_profile_id=profile.id,
            system_prompt="",  # empty — no client prompt
        )

        # Auto-generated instructions should contain HCP's name and specialty
        assert "Dr. Wang Fang" in cfg["instructions"]
        assert "Neurology" in cfg["instructions"]
        # NOT the VL Instance's instructions
        assert "English teacher" not in cfg["instructions"]
        assert "Clara" not in cfg["instructions"]

    async def test_vl_instance_standalone_uses_own_instructions(self, vl_instance_standalone):
        """Standalone VL Instance test (no HCP) uses VL Instance's own instructions."""
        vl_inst, db = vl_instance_standalone

        cfg = await _load_connection_config(
            db,
            vl_instance_id=vl_inst.id,
        )

        # VL Instance's own instructions should be used in standalone mode
        assert cfg["instructions"] == "You are a helpful AI assistant for testing."

    async def test_vl_instance_standalone_no_instructions_fallback(self, seeded_db):
        """Standalone VL Instance without instructions uses client system_prompt."""
        vl_inst = VoiceLiveInstance(
            name="VL-No-Instructions",
            voice_live_model="gpt-4o",
            voice_name="en-US-AvaNeural",
            voice_type="azure-standard",
            avatar_character="lisa",
            avatar_style="casual-sitting",
            avatar_enabled=False,
            model_instruction="",  # empty
            created_by="test-user",
        )
        seeded_db.add(vl_inst)
        await seeded_db.flush()
        await seeded_db.refresh(vl_inst)

        cfg = await _load_connection_config(
            seeded_db,
            vl_instance_id=vl_inst.id,
            system_prompt="Fallback system prompt for model test",
        )

        # Empty VL instructions → instructions field stays empty
        # system_prompt is in cfg["system_prompt"] and resolved at line 377
        assert cfg["instructions"] == ""
        assert cfg["system_prompt"] == "Fallback system prompt for model test"

    async def test_hcp_override_whitespace_only_is_treated_as_empty(self, seeded_db):
        """HCP with whitespace-only override falls back to client system_prompt."""
        vl_inst = VoiceLiveInstance(
            name="VL-Whitespace-Test",
            voice_live_model="gpt-4o",
            voice_name="en-US-AvaNeural",
            voice_type="azure-standard",
            model_instruction="You are a piano teacher.",
            created_by="test-user",
        )
        seeded_db.add(vl_inst)
        await seeded_db.flush()
        await seeded_db.refresh(vl_inst)

        profile = HcpProfile(
            name="Dr. Whitespace",
            specialty="General",
            agent_id="",
            agent_sync_status="none",
            voice_live_instance_id=vl_inst.id,
            agent_instructions_override="   ",  # whitespace only
            created_by="test-user",
        )
        seeded_db.add(profile)
        await seeded_db.flush()
        await seeded_db.refresh(profile)

        cfg = await _load_connection_config(
            seeded_db,
            hcp_profile_id=profile.id,
            system_prompt="You are Dr. Whitespace, a General practitioner.",
        )

        # Whitespace-only override treated as empty → use client system_prompt
        assert cfg["instructions"] == "You are Dr. Whitespace, a General practitioner."
        assert "piano teacher" not in cfg["instructions"]


# ===========================================================================
# Test 3: handle_voice_live_websocket — full proxy flow with mocked SDK
# ===========================================================================


def _make_mock_ws(messages: list[str]) -> MagicMock:
    """Create a mock WebSocket that returns pre-defined messages then disconnects."""
    ws = AsyncMock(spec=WebSocket)
    ws.accept = AsyncMock()
    ws.send_text = AsyncMock()
    # Provide query_params so session correlation ID extraction works
    ws.query_params = {"sid": "test0000"}

    msg_iter = iter(messages)

    async def receive_text():
        try:
            return next(msg_iter)
        except StopIteration:
            raise asyncio.CancelledError()

    ws.receive_text = AsyncMock(side_effect=receive_text)
    return ws


def _install_mock_sdk() -> tuple[MagicMock, MagicMock, MagicMock]:
    """Install mock azure-ai-voicelive SDK modules into sys.modules.

    The handler uses lazy imports (inside the function body), so standard
    patch() on module attributes won't work. Instead we pre-populate
    sys.modules with mock modules that the handler's `from X import Y`
    will resolve against.

    Returns (mock_connect_fn, mock_aio_module, mock_models_module).
    """
    # --- azure.ai.voicelive.aio module ---
    aio_mod = types.ModuleType("azure.ai.voicelive.aio")
    mock_connect_fn = MagicMock(name="connect")
    aio_mod.connect = mock_connect_fn
    aio_mod.ConnectionClosed = type("ConnectionClosed", (Exception,), {})

    # --- azure.ai.voicelive.models module ---
    models_mod = types.ModuleType("azure.ai.voicelive.models")
    models_mod.AudioEchoCancellation = MagicMock(name="AudioEchoCancellation")
    models_mod.AudioInputTranscriptionOptions = MagicMock(name="AudioInputTranscriptionOptions")
    models_mod.AudioNoiseReduction = MagicMock(name="AudioNoiseReduction")
    models_mod.AvatarConfig = MagicMock(name="AvatarConfig")
    models_mod.AzureSemanticVad = MagicMock(name="AzureSemanticVad")
    models_mod.AzureStandardVoice = MagicMock(name="AzureStandardVoice")
    models_mod.VideoParams = MagicMock(name="VideoParams")

    # Modality needs attribute-style access
    modality = MagicMock(name="Modality")
    modality.TEXT = "text"
    modality.AUDIO = "audio"
    modality.AVATAR = "avatar"
    models_mod.Modality = modality

    # RequestSession should be callable and return a dict-like mock
    models_mod.RequestSession = MagicMock(name="RequestSession")

    # ServerEventType needs attribute-style access
    server_event_type = MagicMock(name="ServerEventType")
    server_event_type.ERROR = "error"
    server_event_type.SESSION_CREATED = "session.created"
    server_event_type.SESSION_UPDATED = "session.updated"
    models_mod.ServerEventType = server_event_type

    # --- azure.core.credentials module ---
    creds_mod = types.ModuleType("azure.core.credentials")
    creds_mod.AzureKeyCredential = MagicMock(name="AzureKeyCredential")

    # --- Parent packages (Python needs these for `from X.Y.Z import ...`) ---
    azure_pkg = types.ModuleType("azure")
    azure_ai = types.ModuleType("azure.ai")
    azure_ai_vl = types.ModuleType("azure.ai.voicelive")
    azure_core = types.ModuleType("azure.core")

    # Install into sys.modules
    sys.modules["azure"] = azure_pkg
    sys.modules["azure.ai"] = azure_ai
    sys.modules["azure.ai.voicelive"] = azure_ai_vl
    sys.modules["azure.ai.voicelive.aio"] = aio_mod
    sys.modules["azure.ai.voicelive.models"] = models_mod
    sys.modules["azure.core"] = azure_core
    sys.modules["azure.core.credentials"] = creds_mod

    return mock_connect_fn, aio_mod, models_mod


def _make_mock_azure_conn() -> AsyncMock:
    """Create a mock Azure Voice Live connection (async context manager)."""
    mock_conn = AsyncMock()
    mock_conn.session = MagicMock()
    mock_conn.session.update = AsyncMock()
    mock_conn.send = AsyncMock()
    # The iterator yields nothing then stops (simulates immediate disconnect)
    mock_conn.__aiter__ = MagicMock(
        return_value=AsyncMock(__anext__=AsyncMock(side_effect=StopAsyncIteration()))
    )
    return mock_conn


@pytest.fixture
def mock_sdk():
    """Install mock Azure SDK and yield helpers. Clean up sys.modules after test."""
    sdk_keys = [
        "azure",
        "azure.ai",
        "azure.ai.voicelive",
        "azure.ai.voicelive.aio",
        "azure.ai.voicelive.models",
        "azure.core",
        "azure.core.credentials",
    ]
    # Save any existing entries
    saved = {k: sys.modules.pop(k, None) for k in sdk_keys}

    mock_connect_fn, aio_mod, models_mod = _install_mock_sdk()

    yield mock_connect_fn, aio_mod, models_mod

    # Restore
    for k in sdk_keys:
        sys.modules.pop(k, None)
        if saved[k] is not None:
            sys.modules[k] = saved[k]


class TestHandleVoiceLiveWebsocket:
    """Tests for the full WebSocket proxy handler with mocked Azure SDK."""

    async def test_sends_proxy_connected_on_success(self, seeded_db, mock_sdk):
        """Handler sends proxy.connected after Azure connection established."""
        mock_connect_fn, _, _ = mock_sdk

        # Wire mock connect to return an async context manager
        mock_conn = _make_mock_azure_conn()
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_connect_fn.return_value = mock_ctx

        session_update = json.dumps(
            {
                "type": "session.update",
                "session": {"hcp_profile_id": None, "system_prompt": "Test prompt"},
            }
        )
        ws = _make_mock_ws([session_update])

        await handle_voice_live_websocket(ws, seeded_db)

        # Verify proxy.connected was sent
        sent_calls = ws.send_text.call_args_list
        proxy_connected_sent = False
        for call in sent_calls:
            msg = json.loads(call[0][0])
            if msg.get("type") == "proxy.connected":
                proxy_connected_sent = True
                assert msg["avatar_enabled"] is False
                assert msg["model"] == "gpt-4o"
                break
        assert proxy_connected_sent, "proxy.connected message was not sent"

    async def test_rejects_non_session_update_first_message(self, seeded_db, mock_sdk):
        """Handler sends error if first message is not session.update."""
        bad_msg = json.dumps({"type": "wrong.type", "data": "test"})
        ws = _make_mock_ws([bad_msg])

        await handle_voice_live_websocket(ws, seeded_db)

        sent_calls = ws.send_text.call_args_list
        assert len(sent_calls) >= 1
        error_msg = json.loads(sent_calls[0][0][0])
        assert error_msg["type"] == "error"
        assert "session.update" in error_msg["error"]["message"]

    async def test_sends_error_when_no_config(self, db_session, mock_sdk):
        """Handler sends error when no voice_live config in DB."""
        session_update = json.dumps(
            {
                "type": "session.update",
                "session": {"hcp_profile_id": None},
            }
        )
        ws = _make_mock_ws([session_update])

        await handle_voice_live_websocket(ws, db_session)

        sent_calls = ws.send_text.call_args_list
        assert len(sent_calls) >= 1
        error_msg = json.loads(sent_calls[0][0][0])
        assert error_msg["type"] == "error"
        assert "not configured" in error_msg["error"]["message"]

    async def test_model_mode_passes_model_name(self, seeded_db, mock_sdk):
        """Model mode connect() includes model name and endpoint as-is."""
        mock_connect_fn, _, _ = mock_sdk

        mock_conn = _make_mock_azure_conn()
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_connect_fn.return_value = mock_ctx

        session_update = json.dumps(
            {
                "type": "session.update",
                "session": {"hcp_profile_id": None},
            }
        )
        ws = _make_mock_ws([session_update])

        await handle_voice_live_websocket(ws, seeded_db)

        # Verify connect() was called with correct model mode params
        mock_connect_fn.assert_called_once()
        call_kwargs = mock_connect_fn.call_args[1]
        assert call_kwargs["model"] == "gpt-4o"
        assert call_kwargs["api_version"] == "2025-05-01-preview"
        # Endpoint used as-is (no cognitiveservices transform)
        assert call_kwargs["endpoint"] == REAL_FOUNDRY_ENDPOINT.rstrip("/")
        # No query param (no agent mode)
        assert "query" not in call_kwargs

    async def test_realtime_preview_model_passed(self, seeded_db_model_mode, mock_sdk):
        """gpt-4o-realtime-preview model is passed through correctly."""
        mock_connect_fn, _, _ = mock_sdk

        mock_conn = _make_mock_azure_conn()
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_connect_fn.return_value = mock_ctx

        session_update = json.dumps(
            {
                "type": "session.update",
                "session": {"hcp_profile_id": None, "system_prompt": "You are a doctor"},
            }
        )
        ws = _make_mock_ws([session_update])

        await handle_voice_live_websocket(ws, seeded_db_model_mode)

        mock_connect_fn.assert_called_once()
        call_kwargs = mock_connect_fn.call_args[1]
        assert call_kwargs["model"] == "gpt-4o-realtime-preview"

    async def test_session_config_sent_to_azure(self, seeded_db, mock_sdk):
        """Session config (voice, VAD, noise, echo) is sent to Azure after connect."""
        mock_connect_fn, _, models_mod = mock_sdk

        mock_session_update = AsyncMock()
        mock_conn = _make_mock_azure_conn()
        mock_conn.session.update = mock_session_update

        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_connect_fn.return_value = mock_ctx

        session_update = json.dumps(
            {
                "type": "session.update",
                "session": {"hcp_profile_id": None},
            }
        )
        ws = _make_mock_ws([session_update])

        await handle_voice_live_websocket(ws, seeded_db)

        # session.update was called on azure connection
        mock_session_update.assert_called_once()
        call_kwargs = mock_session_update.call_args[1]
        assert "session" in call_kwargs

        # AzureStandardVoice was called with default voice name
        models_mod.AzureStandardVoice.assert_called_once()
        voice_kwargs = models_mod.AzureStandardVoice.call_args[1]
        assert voice_kwargs["name"] == "zh-CN-XiaoxiaoMultilingualNeural"

    async def test_credential_uses_real_api_key(self, seeded_db, mock_sdk):
        """AzureKeyCredential is called with the real API key from DB."""
        mock_connect_fn, _, _ = mock_sdk
        creds_mod = sys.modules["azure.core.credentials"]

        mock_conn = _make_mock_azure_conn()
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_connect_fn.return_value = mock_ctx

        session_update = json.dumps(
            {
                "type": "session.update",
                "session": {"hcp_profile_id": None},
            }
        )
        ws = _make_mock_ws([session_update])

        await handle_voice_live_websocket(ws, seeded_db)

        # AzureKeyCredential should be called with the real API key
        creds_mod.AzureKeyCredential.assert_called_once_with(REAL_FOUNDRY_API_KEY)


# ===========================================================================
# Test 4: Real credential verification
# ===========================================================================


class TestRealCredentialVerification:
    """Verify real .env credentials are loaded correctly through DB layer."""

    async def test_real_api_key_survives_encrypt_decrypt(self):
        """Real API key encrypts and decrypts correctly through Fernet."""
        encrypted = encrypt_value(REAL_FOUNDRY_API_KEY)
        from app.utils.encryption import decrypt_value

        decrypted = decrypt_value(encrypted)
        assert decrypted == REAL_FOUNDRY_API_KEY

    async def test_real_endpoint_is_valid_https(self):
        """Real endpoint from .env is HTTPS."""
        assert REAL_FOUNDRY_ENDPOINT.startswith("https://")

    async def test_real_project_is_set(self):
        """Real project name from .env is non-empty."""
        assert REAL_FOUNDRY_PROJECT and len(REAL_FOUNDRY_PROJECT) > 0

    async def test_effective_key_from_seeded_db(self, seeded_db):
        """config_service.get_effective_key returns real API key from seeded DB."""
        from app.services import config_service

        key = await config_service.get_effective_key(seeded_db, "azure_voice_live")
        assert key == REAL_FOUNDRY_API_KEY

    async def test_effective_endpoint_from_seeded_db(self, seeded_db):
        """config_service.get_effective_endpoint returns real endpoint from seeded DB."""
        from app.services import config_service

        endpoint = await config_service.get_effective_endpoint(seeded_db, "azure_voice_live")
        assert endpoint == REAL_FOUNDRY_ENDPOINT


# ===========================================================================
# Test 5: WebSocket authentication — JWT token validation via query parameter
# ===========================================================================


class TestWebSocketAuthentication:
    """Tests for WebSocket JWT authentication via query parameter.

    These tests do NOT require Azure credentials — they only test the auth layer.
    Uses the ASGI TestClient's websocket_connect which goes through FastAPI routing.
    """

    @pytest.fixture
    async def test_user(self, db_session):
        """Create a test user in the DB."""
        from app.models.user import User

        user = User(
            username="ws_test_user",
            email="ws@test.com",
            hashed_password="hashed_pw",
            full_name="WS Test User",
            role="user",
            is_active=True,
        )
        db_session.add(user)
        await db_session.flush()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    async def inactive_user(self, db_session):
        """Create an inactive test user."""
        from app.models.user import User

        user = User(
            username="ws_inactive_user",
            email="inactive@test.com",
            hashed_password="hashed_pw",
            full_name="Inactive User",
            role="user",
            is_active=False,
        )
        db_session.add(user)
        await db_session.flush()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    def valid_token(self, test_user):
        """Create a valid JWT token for the test user."""
        from app.services.auth import create_access_token

        return create_access_token(data={"sub": test_user.id})

    @pytest.fixture
    def inactive_user_token(self, inactive_user):
        """Create a valid JWT token for the inactive user."""
        from app.services.auth import create_access_token

        return create_access_token(data={"sub": inactive_user.id})

    @pytest.fixture
    def invalid_token(self):
        """Return a malformed JWT token."""
        return "not-a-valid-jwt-token"

    @pytest.fixture
    def wrong_user_token(self):
        """Create a JWT token with a non-existent user ID."""
        from app.services.auth import create_access_token

        return create_access_token(data={"sub": "non-existent-user-id"})

    @pytest.fixture
    def no_sub_token(self):
        """Create a JWT token without the 'sub' claim."""
        from app.services.auth import create_access_token

        return create_access_token(data={"role": "user"})

    async def test_ws_no_token_rejected(self, db_session):
        """WebSocket connection without token is rejected with 1008 and error message."""
        from app.api.voice_live import _authenticate_websocket

        ws = AsyncMock(spec=WebSocket)
        ws.query_params = {}
        ws.accept = AsyncMock()
        ws.send_text = AsyncMock()
        ws.close = AsyncMock()

        result = await _authenticate_websocket(ws, db_session)

        assert result is None
        ws.accept.assert_called_once()
        ws.send_text.assert_called_once()
        sent_msg = json.loads(ws.send_text.call_args[0][0])
        assert sent_msg["type"] == "error"
        assert "missing token" in sent_msg["error"]["message"].lower()
        ws.close.assert_called_once_with(code=1008, reason="Authentication required")

    async def test_ws_invalid_token_rejected(self, db_session, invalid_token):
        """WebSocket connection with invalid JWT is rejected with 1008."""
        from app.api.voice_live import _authenticate_websocket

        ws = AsyncMock(spec=WebSocket)
        ws.query_params = {"token": invalid_token}
        ws.accept = AsyncMock()
        ws.send_text = AsyncMock()
        ws.close = AsyncMock()

        result = await _authenticate_websocket(ws, db_session)

        assert result is None
        ws.accept.assert_called_once()
        sent_msg = json.loads(ws.send_text.call_args[0][0])
        assert sent_msg["type"] == "error"
        assert "invalid token" in sent_msg["error"]["message"].lower()
        ws.close.assert_called_once_with(code=1008, reason="Invalid token")

    async def test_ws_valid_token_accepted(self, db_session, test_user, valid_token):
        """WebSocket connection with valid JWT returns the authenticated user."""
        from app.api.voice_live import _authenticate_websocket

        ws = AsyncMock(spec=WebSocket)
        ws.query_params = {"token": valid_token}

        result = await _authenticate_websocket(ws, db_session)

        assert result is not None
        assert result.id == test_user.id
        assert result.username == "ws_test_user"
        # Should NOT have called accept (the handler does that after auth)
        ws.accept.assert_not_called()
        ws.close.assert_not_called()

    async def test_ws_nonexistent_user_rejected(self, db_session, wrong_user_token):
        """WebSocket with token for non-existent user is rejected."""
        from app.api.voice_live import _authenticate_websocket

        ws = AsyncMock(spec=WebSocket)
        ws.query_params = {"token": wrong_user_token}
        ws.accept = AsyncMock()
        ws.send_text = AsyncMock()
        ws.close = AsyncMock()

        result = await _authenticate_websocket(ws, db_session)

        assert result is None
        ws.accept.assert_called_once()
        sent_msg = json.loads(ws.send_text.call_args[0][0])
        assert sent_msg["type"] == "error"
        assert "not found" in sent_msg["error"]["message"].lower()
        ws.close.assert_called_once_with(code=1008, reason="User not found or inactive")

    async def test_ws_inactive_user_rejected(self, db_session, inactive_user, inactive_user_token):
        """WebSocket with token for inactive user is rejected."""
        from app.api.voice_live import _authenticate_websocket

        ws = AsyncMock(spec=WebSocket)
        ws.query_params = {"token": inactive_user_token}
        ws.accept = AsyncMock()
        ws.send_text = AsyncMock()
        ws.close = AsyncMock()

        result = await _authenticate_websocket(ws, db_session)

        assert result is None
        ws.accept.assert_called_once()
        sent_msg = json.loads(ws.send_text.call_args[0][0])
        assert sent_msg["type"] == "error"
        assert "inactive" in sent_msg["error"]["message"].lower()
        ws.close.assert_called_once_with(code=1008, reason="User not found or inactive")

    async def test_ws_no_sub_claim_rejected(self, db_session, no_sub_token):
        """WebSocket with JWT missing 'sub' claim is rejected as invalid token."""
        from app.api.voice_live import _authenticate_websocket

        ws = AsyncMock(spec=WebSocket)
        ws.query_params = {"token": no_sub_token}
        ws.accept = AsyncMock()
        ws.send_text = AsyncMock()
        ws.close = AsyncMock()

        result = await _authenticate_websocket(ws, db_session)

        assert result is None
        ws.accept.assert_called_once()
        sent_msg = json.loads(ws.send_text.call_args[0][0])
        assert sent_msg["type"] == "error"
        assert "invalid token" in sent_msg["error"]["message"].lower()
        ws.close.assert_called_once_with(code=1008, reason="Invalid token")
