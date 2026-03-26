"""Seed initial users, default scoring rubric, and sample sessions/scores.

Idempotent -- skips records that already exist.
Run with: python scripts/seed_data.py
"""

import asyncio
import json
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

# Add backend root to path so 'app' package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models.scenario import Scenario
from app.models.score import ScoreDetail, SessionScore
from app.models.scoring_rubric import ScoringRubric
from app.models.session import CoachingSession
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
        "business_unit": "",
    },
    {
        "username": "user1",
        "email": "user1@aicoach.com",
        "password": "user123",
        "role": "user",
        "full_name": "Zhang Wei",
        "preferred_language": "zh-CN",
        "business_unit": "Oncology BU",
    },
    {
        "username": "user2",
        "email": "user2@aicoach.com",
        "password": "user123",
        "role": "user",
        "full_name": "Li Ming",
        "preferred_language": "zh-CN",
        "business_unit": "Hematology BU",
    },
    {
        "username": "user3",
        "email": "user3@aicoach.com",
        "password": "user123",
        "role": "user",
        "full_name": "Wang Fang",
        "preferred_language": "en-US",
        "business_unit": "Solid Tumor BU",
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


async def seed_sessions(session: AsyncSession) -> None:
    """Seed 12 scored training sessions with scores and score details.

    Creates 4 sessions per MR user (user1, user2, user3) spread over the last 30 days.
    Idempotent: skips if coaching sessions already exist for seed users.
    """
    # Check if sessions already exist for seed users
    mr_usernames = ["user1", "user2", "user3"]
    users_result = await session.execute(select(User).where(User.username.in_(mr_usernames)))
    mr_users = list(users_result.scalars().all())
    if not mr_users:
        print("  [skip] No MR users found — run seed_users first")
        return

    # Check idempotency
    user_ids = [u.id for u in mr_users]
    existing_count_result = await session.execute(
        select(func.count())
        .select_from(CoachingSession)
        .where(CoachingSession.user_id.in_(user_ids))
    )
    if (existing_count_result.scalar() or 0) > 0:
        print("  [skip] Sessions already exist for seed users")
        return

    # Get active scenarios
    scenarios_result = await session.execute(
        select(Scenario).where(Scenario.status == "active").limit(4)
    )
    scenarios = list(scenarios_result.scalars().all())
    if not scenarios:
        print("  [skip] No active scenarios found — seed scenarios first")
        return

    # Session score templates per user (vary per user and session)
    score_templates = [
        # user1 (Zhang Wei) — improving over time
        [65, 70, 78, 85],
        # user2 (Li Ming) — steady performer
        [72, 75, 73, 80],
        # user3 (Wang Fang) — high performer
        [80, 82, 88, 90],
    ]

    day_offsets = [30, 20, 10, 2]  # days ago
    dimensions = [
        "key_message",
        "objection_handling",
        "communication",
        "product_knowledge",
        "scientific_info",
    ]
    now = datetime.now(UTC)
    session_count = 0

    for user_idx, user in enumerate(mr_users):
        scores_list = score_templates[user_idx % len(score_templates)]
        for sess_idx in range(4):
            scenario = scenarios[sess_idx % len(scenarios)]
            overall = scores_list[sess_idx]
            day_offset = day_offsets[sess_idx]
            started = now - timedelta(days=day_offset, hours=2)
            duration = 300 + (sess_idx * 150)  # 300, 450, 600, 750 seconds
            completed = started + timedelta(seconds=duration)
            passed = overall >= 70

            cs_id = str(uuid.uuid4())
            cs = CoachingSession(
                id=cs_id,
                user_id=user.id,
                scenario_id=scenario.id,
                status="scored",
                session_type="f2f",
                started_at=started,
                completed_at=completed,
                duration_seconds=duration,
                overall_score=float(overall),
                passed=passed,
            )
            session.add(cs)

            score_id = str(uuid.uuid4())
            ss = SessionScore(
                id=score_id,
                session_id=cs_id,
                overall_score=float(overall),
                passed=passed,
                feedback_summary=f"Session score: {overall}/100",
            )
            session.add(ss)

            # Get scenario weights
            weights = scenario.get_scoring_weights()
            weight_list = [
                weights.get("key_message", 25),
                weights.get("objection_handling", 20),
                weights.get("communication", 20),
                weights.get("product_knowledge", 20),
                weights.get("scientific_info", 15),
            ]

            for dim_idx, dim_name in enumerate(dimensions):
                # Vary dimension score around overall (+/- 10, clamped 0-100)
                offset = (dim_idx * 5) - 10  # -10, -5, 0, 5, 10
                dim_score = max(0.0, min(100.0, float(overall + offset)))
                sd = ScoreDetail(
                    id=str(uuid.uuid4()),
                    score_id=score_id,
                    dimension=dim_name,
                    score=dim_score,
                    weight=weight_list[dim_idx],
                )
                session.add(sd)

            session_count += 1

    await session.commit()
    print(f"  [created] {session_count} scored sessions with scores and details")


async def main() -> None:
    """Create seed users, default rubric, and sample sessions."""
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
                business_unit=user_data.get("business_unit", ""),
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

        # Seed sample sessions and scores for analytics
        await seed_sessions(session)

    await engine.dispose()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(main())
