"""Config service: CRUD operations for Azure service configurations with encryption."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service_config import ServiceConfig
from app.schemas.azure_config import ServiceConfigResponse, ServiceConfigUpdate
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
        existing.is_active = True
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
            is_active=True,
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
