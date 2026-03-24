"""Seed initial users and default scoring rubric.

Idempotent -- skips records that already exist.
Run with: python scripts/seed_data.py
"""

import asyncio
import json
import sys
from pathlib import Path

# Add backend root to path so 'app' package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models.scoring_rubric import ScoringRubric
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


async def seed_default_rubric(session: AsyncSession, admin_user_id: str) -> None:
    """Seed a default F2F scoring rubric with 5 standard dimensions."""
    result = await session.execute(
        select(ScoringRubric).where(
            ScoringRubric.scenario_type == "f2f",
            ScoringRubric.is_default == True,  # noqa: E712
        )
    )
    if result.scalar_one_or_none() is not None:
        print("  [skip] Default F2F rubric already exists")
        return

    dimensions = [
        {
            "name": "key_message",
            "weight": 25,
            "criteria": [
                "Delivered all key messages clearly",
                "Key messages were contextually relevant",
                "Messages were delivered in logical order",
            ],
            "max_score": 100.0,
        },
        {
            "name": "objection_handling",
            "weight": 20,
            "criteria": [
                "Acknowledged HCP concerns empathetically",
                "Provided evidence-based responses",
                "Redirected conversation constructively",
            ],
            "max_score": 100.0,
        },
        {
            "name": "communication",
            "weight": 20,
            "criteria": [
                "Maintained professional tone",
                "Used active listening techniques",
                "Adapted to HCP communication style",
            ],
            "max_score": 100.0,
        },
        {
            "name": "product_knowledge",
            "weight": 20,
            "criteria": [
                "Demonstrated accurate product knowledge",
                "Addressed dosing and administration",
                "Compared with competitor products",
            ],
            "max_score": 100.0,
        },
        {
            "name": "scientific_info",
            "weight": 15,
            "criteria": [
                "Referenced relevant clinical studies",
                "Cited specific data points and endpoints",
                "Discussed patient population and outcomes",
            ],
            "max_score": 100.0,
        },
    ]

    rubric = ScoringRubric(
        name="Default F2F Scoring Rubric",
        description="Standard 5-dimension scoring rubric for face-to-face coaching sessions",
        scenario_type="f2f",
        dimensions=json.dumps(dimensions),
        is_default=True,
        created_by=admin_user_id,
    )
    session.add(rubric)
    print("  [created] Default F2F scoring rubric (5 dimensions, weights sum to 100)")


async def seed_users() -> None:
    """Create seed users and default rubric if they do not already exist."""
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

        # Seed default rubric using admin user
        admin_result = await session.execute(select(User).where(User.username == "admin"))
        admin_user = admin_result.scalar_one_or_none()
        if admin_user:
            await seed_default_rubric(session, admin_user.id)
            await session.commit()

    await engine.dispose()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed_users())
