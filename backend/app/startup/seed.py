"""Seed demo data during startup."""

import logging

from app.config import get_settings

logger = logging.getLogger(__name__)


async def run_seed() -> None:
    """Seed all demo data if SEED_DATA_IGNORE is not set.

    Idempotent — skips if data already exists.
    Tolerates missing tables on first run.
    """
    settings = get_settings()
    if settings.seed_data_ignore:
        logger.debug("Seed data skipped (SEED_DATA_IGNORE=true)")
        return

    from app.database import AsyncSessionLocal
    from app.startup_seed import seed_all

    try:
        async with AsyncSessionLocal() as seed_session:
            await seed_all(seed_session)
        logger.info("Seed data loaded")
    except Exception:
        logger.warning("Seed data skipped (table may not exist yet)")
