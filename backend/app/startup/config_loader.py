"""Load service configs from DB and register real adapters at startup."""

import logging

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.service_config import ServiceConfig
from app.utils.encryption import decrypt_value

logger = logging.getLogger(__name__)


async def load_service_configs() -> None:
    """Load active ServiceConfig rows and register real adapters.

    Reads the master AI Foundry config first, then registers per-service
    adapters with master fallback for endpoint/key/region.

    Tolerates missing tables on first run.
    """
    from app.api.azure_config import register_adapter_from_config

    try:
        async with AsyncSessionLocal() as session:
            # Load master AI Foundry config
            master_endpoint = ""
            master_key = ""
            master_region = ""
            master_model = ""

            master_result = await session.execute(
                select(ServiceConfig).where(ServiceConfig.is_master == True)  # noqa: E712
            )
            master_cfg = master_result.scalar_one_or_none()
            if master_cfg:
                master_endpoint = master_cfg.endpoint
                master_key = decrypt_value(master_cfg.api_key_encrypted)
                master_region = master_cfg.region
                master_model = master_cfg.model_or_deployment

            # Register per-service adapters with master fallback
            result = await session.execute(
                select(ServiceConfig).where(
                    ServiceConfig.is_active == True,  # noqa: E712
                    ServiceConfig.is_master == False,  # noqa: E712
                )
            )
            configs = result.scalars().all()
            for cfg in configs:
                api_key = decrypt_value(cfg.api_key_encrypted)
                await register_adapter_from_config(
                    cfg.service_name,
                    cfg.endpoint,
                    api_key,
                    cfg.model_or_deployment,
                    cfg.region,
                    master_endpoint=master_endpoint,
                    master_key=master_key,
                    master_region=master_region,
                    master_model=master_model,
                )

            logger.info("Service configs loaded (%d active)", len(configs))
    except Exception:
        logger.warning("Service config loading skipped (table may not exist yet)")
