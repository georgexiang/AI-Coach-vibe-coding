"""Database initialization during startup."""

import logging

from app.database import engine
from app.models.base import Base

logger = logging.getLogger(__name__)


async def init_tables() -> None:
    """Create all tables if they don't exist (dev/SQLite only)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized")
