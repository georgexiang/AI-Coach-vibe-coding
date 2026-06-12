"""Voice Live avatar availability tests for Foundry-only configuration."""

import pytest

from app.models.service_config import ServiceConfig
from app.models.voice_live_instance import VoiceLiveInstance
from app.services.voice_live_service import get_voice_live_status
from app.services.voice_live_websocket import _load_connection_config


@pytest.fixture
async def voice_live_only_db(db_session):
    """Seed Voice Live config without a separate azure_avatar row."""
    master = ServiceConfig(
        service_name="ai_foundry",
        display_name="Azure AI Foundry",
        endpoint="https://example.services.ai.azure.com",
        api_key_encrypted="",
        model_or_deployment="gpt-realtime",
        region="swedencentral",
        default_project="demo-project",
        is_master=True,
        is_active=True,
        updated_by="test",
    )
    voice_live = ServiceConfig(
        service_name="azure_voice_live",
        display_name="Azure Voice Live",
        endpoint="",
        api_key_encrypted="",
        model_or_deployment="gpt-realtime",
        region="swedencentral",
        is_master=False,
        is_active=True,
        updated_by="test",
    )
    db_session.add_all([master, voice_live])
    await db_session.flush()
    return db_session


async def test_vl_instance_avatar_enabled_without_separate_avatar_config(voice_live_only_db):
    """A VL Instance can enable avatar through Voice Live alone."""
    vl_instance = VoiceLiveInstance(
        name="Avatar Instance",
        voice_live_model="gpt-realtime",
        voice_name="zh-CN-XiaoxiaoNeural",
        voice_type="azure-standard",
        avatar_character="lisa",
        avatar_style="casual-sitting",
        avatar_enabled=True,
        created_by="test-user",
    )
    voice_live_only_db.add(vl_instance)
    await voice_live_only_db.flush()

    cfg = await _load_connection_config(voice_live_only_db, vl_instance_id=vl_instance.id)

    assert cfg["avatar_enabled"] is True
    assert cfg["avatar_character"] == "lisa"
    assert cfg["avatar_style"] == "casual-sitting"


async def test_vl_instance_avatar_toggle_still_disables_avatar(voice_live_only_db):
    """The per-instance avatar toggle still wins when set to false."""
    vl_instance = VoiceLiveInstance(
        name="Voice Only Instance",
        voice_live_model="gpt-realtime",
        voice_name="zh-CN-XiaoxiaoNeural",
        voice_type="azure-standard",
        avatar_character="lisa",
        avatar_style="casual-sitting",
        avatar_enabled=False,
        created_by="test-user",
    )
    voice_live_only_db.add(vl_instance)
    await voice_live_only_db.flush()

    cfg = await _load_connection_config(voice_live_only_db, vl_instance_id=vl_instance.id)

    assert cfg["avatar_enabled"] is False


async def test_voice_live_status_reports_avatar_available_from_voice_live(
    voice_live_only_db,
):
    """Status should not require a standalone azure_avatar config row."""
    status = await get_voice_live_status(voice_live_only_db)

    assert status.voice_live_available is True
    assert status.avatar_available is True
