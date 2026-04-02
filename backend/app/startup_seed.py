"""Idempotent seed-all logic for app lifespan startup.

Seeds users, default rubric, HCP profiles, scenarios, and training materials.
Skips any records that already exist. Safe to run on every startup.
"""

import json
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Ensure scripts/ is importable for seed data constants
_scripts_dir = str(Path(__file__).resolve().parent.parent / "scripts")
if _scripts_dir not in sys.path:
    sys.path.insert(0, _scripts_dir)


async def seed_all(session: AsyncSession) -> None:
    """Run all seed operations in a single session."""
    from app.models.user import User
    from app.services.auth import get_password_hash

    # --- 1. Users ---
    seed_users = [
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
            "business_unit": "Oncology BU (肿瘤事业部)",
        },
        {
            "username": "user2",
            "email": "user2@aicoach.com",
            "password": "user123",
            "role": "user",
            "full_name": "Li Ming",
            "preferred_language": "zh-CN",
            "business_unit": "Hematology BU (血液事业部)",
        },
        {
            "username": "user3",
            "email": "user3@aicoach.com",
            "password": "user123",
            "role": "user",
            "full_name": "Wang Fang",
            "preferred_language": "en-US",
            "business_unit": "Solid Tumor BU (实体瘤事业部)",
        },
    ]
    for ud in seed_users:
        result = await session.execute(select(User).where(User.username == ud["username"]))
        if result.scalar_one_or_none() is None:
            session.add(
                User(
                    username=ud["username"],
                    email=ud["email"],
                    hashed_password=get_password_hash(ud["password"]),
                    full_name=ud["full_name"],
                    role=ud["role"],
                    preferred_language=ud["preferred_language"],
                    business_unit=ud.get("business_unit", ""),
                )
            )
    await session.commit()

    # Get admin user for created_by fields
    admin_result = await session.execute(select(User).where(User.role == "admin"))
    admin_user = admin_result.scalar_one_or_none()
    if admin_user is None:
        return
    admin_id = admin_user.id

    # --- 2. Default scoring rubric ---
    from app.models.scoring_rubric import ScoringRubric

    existing_rubric = await session.execute(
        select(ScoringRubric).where(
            ScoringRubric.scenario_type == "f2f",
            ScoringRubric.is_default == True,  # noqa: E712
        )
    )
    if existing_rubric.scalar_one_or_none() is None:
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
            description="Standard 5-dimension scoring rubric for F2F coaching sessions",
            scenario_type="f2f",
            dimensions=json.dumps(dimensions),
            is_default=True,
            created_by=admin_id,
        )
        session.add(rubric)
        await session.commit()

    # --- 3. HCP profiles ---
    from app.models.hcp_profile import HcpProfile

    existing_hcp = await session.execute(select(HcpProfile).limit(1))
    if existing_hcp.scalar_one_or_none() is None:
        from seed_phase2 import SEED_HCP_PROFILES

        for profile_data in SEED_HCP_PROFILES:
            profile = HcpProfile(**profile_data, created_by=admin_id)
            session.add(profile)
        await session.flush()
        await session.commit()

    # --- 4. Scenarios ---
    from app.models.scenario import Scenario

    existing_scenario = await session.execute(select(Scenario).limit(1))
    if existing_scenario.scalar_one_or_none() is None:
        from seed_phase2 import SEED_SCENARIOS

        # Build HCP name -> ID map
        hcp_result = await session.execute(select(HcpProfile))
        hcp_map = {p.name: p.id for p in hcp_result.scalars().all()}

        for scenario_data in SEED_SCENARIOS:
            data = dict(scenario_data)  # copy to avoid mutating the constant
            hcp_name = data.pop("hcp_name", None)
            hcp_id = hcp_map.get(hcp_name) if hcp_name else None
            scenario = Scenario(**data, hcp_profile_id=hcp_id, created_by=admin_id)
            session.add(scenario)
        await session.commit()

    # --- 5. Training materials ---
    from app.models.material import TrainingMaterial

    existing_mat = await session.execute(select(TrainingMaterial).limit(1))
    if existing_mat.scalar_one_or_none() is None:
        try:
            from seed_materials import seed_materials

            await seed_materials()
        except Exception:
            pass  # Materials seed creates its own engine/session
