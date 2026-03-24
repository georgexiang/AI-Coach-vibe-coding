"""Initialize the database schema by creating all tables.

Run with: python3 scripts/init_db.py
"""

import asyncio
import sys
from pathlib import Path

# Add backend root to path so 'app' package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings
from app.models import hcp_profile, message, scenario, score, session, user  # noqa: F401
from app.models.base import Base

settings = get_settings()


async def init_db() -> None:
    """Create all database tables."""
    engine = create_async_engine(settings.database_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("Database initialized successfully.")


if __name__ == "__main__":
    asyncio.run(init_db())
