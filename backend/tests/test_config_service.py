"""Tests for config service: CRUD operations with encrypted API keys."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.azure_config import ServiceConfigUpdate
from app.services.config_service import (
    get_all_configs,
    get_config,
    get_decrypted_key,
    upsert_config,
)
from app.utils.encryption import decrypt_value


@pytest.fixture
def sample_update() -> ServiceConfigUpdate:
    """Sample service config update payload."""
    return ServiceConfigUpdate(
        endpoint="https://my-openai.openai.azure.com/",
        api_key="sk-test-api-key-1234",
        model_or_deployment="gpt-4o",
        region="eastus",
    )


async def test_upsert_config_creates_new(db_session: AsyncSession, sample_update):
    """upsert_config should create a new ServiceConfig when none exists."""
    config = await upsert_config(
        db=db_session,
        service_name="azure_openai",
        display_name="Azure OpenAI",
        update=sample_update,
        updated_by="admin-user-id",
    )
    assert config.service_name == "azure_openai"
    assert config.display_name == "Azure OpenAI"
    assert config.endpoint == "https://my-openai.openai.azure.com/"
    assert config.model_or_deployment == "gpt-4o"
    assert config.region == "eastus"
    assert config.is_active is True
    assert config.updated_by == "admin-user-id"
    # API key should be encrypted in the stored field
    assert config.api_key_encrypted != ""
    assert config.api_key_encrypted != "sk-test-api-key-1234"
    # Decrypt to verify round-trip
    assert decrypt_value(config.api_key_encrypted) == "sk-test-api-key-1234"


async def test_upsert_config_updates_existing(db_session: AsyncSession, sample_update):
    """upsert_config should update existing ServiceConfig when one exists."""
    # Create initial
    await upsert_config(
        db=db_session,
        service_name="azure_openai",
        display_name="Azure OpenAI",
        update=sample_update,
        updated_by="admin-user-id",
    )

    # Update with new values
    updated_payload = ServiceConfigUpdate(
        endpoint="https://updated.openai.azure.com/",
        api_key="sk-new-key-5678",
        model_or_deployment="gpt-4o-mini",
        region="westus2",
    )
    config = await upsert_config(
        db=db_session,
        service_name="azure_openai",
        display_name="Azure OpenAI (Updated)",
        update=updated_payload,
        updated_by="admin-user-2",
    )
    assert config.endpoint == "https://updated.openai.azure.com/"
    assert config.model_or_deployment == "gpt-4o-mini"
    assert config.region == "westus2"
    assert config.updated_by == "admin-user-2"
    assert decrypt_value(config.api_key_encrypted) == "sk-new-key-5678"


async def test_upsert_config_preserves_key_when_empty(db_session: AsyncSession, sample_update):
    """upsert_config should preserve existing key when update.api_key is empty."""
    # Create initial with a key
    await upsert_config(
        db=db_session,
        service_name="azure_openai",
        display_name="Azure OpenAI",
        update=sample_update,
        updated_by="admin-user-id",
    )

    # Update without providing api_key
    update_no_key = ServiceConfigUpdate(
        endpoint="https://new-endpoint.openai.azure.com/",
        api_key="",
        model_or_deployment="gpt-4o",
        region="eastus",
    )
    config = await upsert_config(
        db=db_session,
        service_name="azure_openai",
        display_name="Azure OpenAI",
        update=update_no_key,
        updated_by="admin-user-id",
    )
    # Key should still be the original
    assert decrypt_value(config.api_key_encrypted) == "sk-test-api-key-1234"


async def test_get_all_configs_returns_masked_keys(db_session: AsyncSession, sample_update):
    """get_all_configs should return configs with masked keys."""
    await upsert_config(
        db=db_session,
        service_name="azure_openai",
        display_name="Azure OpenAI",
        update=sample_update,
        updated_by="admin-user-id",
    )
    configs = await get_all_configs(db_session)
    assert len(configs) == 1
    config = configs[0]
    assert config.service_name == "azure_openai"
    assert config.masked_key == "****1234"
    assert config.endpoint == "https://my-openai.openai.azure.com/"


async def test_get_config_returns_none_for_missing(db_session: AsyncSession):
    """get_config should return None when no config exists for service_name."""
    config = await get_config(db_session, "nonexistent_service")
    assert config is None


async def test_get_config_returns_existing(db_session: AsyncSession, sample_update):
    """get_config should return existing ServiceConfig by service_name."""
    await upsert_config(
        db=db_session,
        service_name="azure_speech",
        display_name="Azure Speech",
        update=sample_update,
        updated_by="admin-user-id",
    )
    config = await get_config(db_session, "azure_speech")
    assert config is not None
    assert config.service_name == "azure_speech"


async def test_get_decrypted_key_returns_plaintext(db_session: AsyncSession, sample_update):
    """get_decrypted_key should return the plaintext API key."""
    await upsert_config(
        db=db_session,
        service_name="azure_openai",
        display_name="Azure OpenAI",
        update=sample_update,
        updated_by="admin-user-id",
    )
    key = await get_decrypted_key(db_session, "azure_openai")
    assert key == "sk-test-api-key-1234"


async def test_get_decrypted_key_returns_empty_for_missing(db_session: AsyncSession):
    """get_decrypted_key should return empty string when service not found."""
    key = await get_decrypted_key(db_session, "nonexistent")
    assert key == ""
