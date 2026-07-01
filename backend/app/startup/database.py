"""Database initialization during startup."""

import logging

from app.config import get_settings
from app.database import engine
from app.models.base import Base

logger = logging.getLogger(__name__)
settings = get_settings()


async def init_tables() -> None:
    """Create all tables if they don't exist (dev/SQLite only)."""
    if not settings.database_auto_create_tables:
        logger.info("Database auto-create disabled; expecting migrations/bootstrap to be run")
        return
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized")
