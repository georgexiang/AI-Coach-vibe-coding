"""Config service: CRUD operations for Azure service configurations with encryption.

Supports unified AI Foundry master config pattern: a single master row
(service_name='ai_foundry', is_master=True) stores the shared endpoint, region,
and API key. Per-service rows are enable/disable toggles with service-specific
deployment names, inheriting endpoint and key from master when empty.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service_config import ServiceConfig
from app.schemas.azure_config import (
    AIFoundryConfigUpdate,
    ServiceConfigResponse,
    ServiceConfigUpdate,
)
from app.utils.encryption import decrypt_value, encrypt_value


async def get_all_configs(db: AsyncSession) -> list[ServiceConfigResponse]:
    """Return all service configs with masked API keys."""
    result = await db.execute(select(ServiceConfig))
    rows = result.scalars().all()
    configs = []
    for row in rows:
        decrypted_key = decrypt_value(row.api_key_encrypted)
        masked_key = ("****" + decrypted_key[-4:]) if decrypted_key else ""
        configs.append(
            ServiceConfigResponse(
                service_name=row.service_name,
                display_name=row.display_name,
                endpoint=row.endpoint,
                masked_key=masked_key,
                model_or_deployment=row.model_or_deployment,
                region=row.region,
                default_project=row.default_project,
                is_master=row.is_master,
                is_active=row.is_active,
                updated_at=row.updated_at,
            )
        )
    return configs


async def get_config(db: AsyncSession, service_name: str) -> ServiceConfig | None:
    """Return a single ServiceConfig by service_name, or None if not found."""
    result = await db.execute(
        select(ServiceConfig).where(ServiceConfig.service_name == service_name)
    )
    return result.scalar_one_or_none()


async def get_master_config(db: AsyncSession) -> ServiceConfig | None:
    """Return the AI Foundry master config row, or None if not configured."""
    result = await db.execute(
        select(ServiceConfig).where(ServiceConfig.is_master == True)  # noqa: E712
    )
    return result.scalar_one_or_none()


async def upsert_master_config(
    db: AsyncSession,
    update: AIFoundryConfigUpdate,
    updated_by: str,
) -> ServiceConfig:
    """Create or update the AI Foundry master configuration row.

    The master row stores the shared endpoint, region, and encrypted API key
    used by all per-service toggle rows that lack their own credentials.
    """
    existing = await get_master_config(db)

    if existing:
        existing.endpoint = update.endpoint
        existing.region = update.region
        existing.model_or_deployment = update.model_or_deployment
        existing.default_project = update.default_project
        existing.updated_by = updated_by
        existing.is_active = True
        if update.api_key:
            existing.api_key_encrypted = encrypt_value(update.api_key)
        await db.flush()
        return existing
    else:
        config = ServiceConfig(
            service_name="ai_foundry",
            display_name="Azure AI Foundry",
            endpoint=update.endpoint,
            api_key_encrypted=encrypt_value(update.api_key) if update.api_key else "",
            model_or_deployment=update.model_or_deployment,
            default_project=update.default_project,
            region=update.region,
            is_master=True,
            is_active=True,
            updated_by=updated_by,
        )
        db.add(config)
        await db.flush()
        return config


async def upsert_config(
    db: AsyncSession,
    service_name: str,
    display_name: str,
    update: ServiceConfigUpdate,
    updated_by: str,
) -> ServiceConfig:
    """Create or update a service configuration.

    If the service_name already exists, update its fields.
    If update.api_key is non-empty, encrypt and store it.
    If update.api_key is empty, preserve the existing encrypted key.
    """
    existing = await get_config(db, service_name)

    if existing:
        existing.display_name = display_name
        existing.endpoint = update.endpoint
        existing.model_or_deployment = update.model_or_deployment
        existing.region = update.region
        existing.is_active = (
            update.is_active if update.is_active is not None else existing.is_active
        )
        existing.updated_by = updated_by
        if update.api_key:
            existing.api_key_encrypted = encrypt_value(update.api_key)
        await db.flush()
        return existing
    else:
        config = ServiceConfig(
            service_name=service_name,
            display_name=display_name,
            endpoint=update.endpoint,
            api_key_encrypted=encrypt_value(update.api_key),
            model_or_deployment=update.model_or_deployment,
            region=update.region,
            is_active=update.is_active if update.is_active is not None else True,
            updated_by=updated_by,
        )
        db.add(config)
        await db.flush()
        return config


async def get_decrypted_key(db: AsyncSession, service_name: str) -> str:
    """Return the decrypted API key for a given service_name, or empty string."""
    config = await get_config(db, service_name)
    if config is None:
        return ""
    return decrypt_value(config.api_key_encrypted)


async def get_effective_key(db: AsyncSession, service_name: str) -> str:
    """Return the effective API key for a service.

    If the per-service row has its own encrypted key, return that.
    Otherwise, fall back to the master AI Foundry key.
    """
    per_service_key = await get_decrypted_key(db, service_name)
    if per_service_key:
        return per_service_key
    master = await get_master_config(db)
    if master:
        return decrypt_value(master.api_key_encrypted)
    return ""


async def get_effective_endpoint(db: AsyncSession, service_name: str) -> str:
    """Return the effective endpoint for a service.

    If the per-service row has its own endpoint, return that.
    Otherwise, fall back to the master AI Foundry endpoint.
    """
    config = await get_config(db, service_name)
    if config and config.endpoint:
        return config.endpoint
    master = await get_master_config(db)
    if master:
        return master.endpoint
    return ""
