"""Seed initial users: one admin and one regular user.

Idempotent -- skips users that already exist.
Run with: python scripts/seed_data.py
"""

import asyncio
import sys
from pathlib import Path

# Add backend root to path so 'app' package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models.user import User
from app.services.auth import get_password_hash

settings = get_settings()

SEED_USERS = [
    {
        "username": "admin",
        "email": "admin@aicoach.com",
        "password": "admin123",
        "role": "admin",
        "full_name": "System Admin",
        "preferred_language": "zh-CN",
    },
    {
        "username": "user1",
        "email": "user1@aicoach.com",
        "password": "user123",
        "role": "user",
        "full_name": "Test MR",
        "preferred_language": "zh-CN",
    },
]


async def seed_users() -> None:
    """Create seed users if they do not already exist."""
    from app.models.base import Base

    engine = create_async_engine(settings.database_url, echo=False)

    # Ensure tables exist before seeding
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        for user_data in SEED_USERS:
            result = await session.execute(
                select(User).where(User.username == user_data["username"])
            )
            if result.scalar_one_or_none() is not None:
                print(f"  [skip] User '{user_data['username']}' already exists")
                continue

            user = User(
                username=user_data["username"],
                email=user_data["email"],
                hashed_password=get_password_hash(user_data["password"]),
                full_name=user_data["full_name"],
                role=user_data["role"],
                preferred_language=user_data["preferred_language"],
            )
            session.add(user)
            print(f"  [created] User '{user_data['username']}' (role={user_data['role']})")

        await session.commit()

    await engine.dispose()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed_users())
