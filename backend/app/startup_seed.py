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
                    "Consider which key messages were delivered and how naturally",
                    "Evaluate completeness of message coverage",
                    "Assess logical flow of message delivery",
                ],
                "max_score": 100.0,
            },
            {
                "name": "objection_handling",
                "weight": 20,
                "criteria": [
                    "Evaluate how the MR responded to HCP resistance or concerns",
                    "Assess use of clinical evidence in responses",
                    "Evaluate acknowledgment of HCP concerns before countering",
                ],
                "max_score": 100.0,
            },
            {
                "name": "communication",
                "weight": 20,
                "criteria": [
                    "Evaluate tone, active listening, professional language",
                    "Assess adaptation to HCP communication style",
                    "Evaluate use of reflective listening techniques",
                ],
                "max_score": 100.0,
            },
            {
                "name": "product_knowledge",
                "weight": 20,
                "criteria": [
                    "Evaluate accuracy and depth of product information shared",
                    "Assess dosing and administration knowledge",
                    "Evaluate competitive product comparison ability",
                ],
                "max_score": 100.0,
            },
            {
                "name": "scientific_info",
                "weight": 15,
                "criteria": [
                    "Evaluate use of clinical data, study references, and evidence-based arguments",
                    "Assess ability to cite specific study names and endpoints",
                    "Evaluate discussion of patient populations and outcomes",
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

    # --- 2b. Deduplicate defaults (fix for h21a migration creating duplicate) ---
    from sqlalchemy import func, update

    for stype in ("f2f", "conference"):
        count_result = await session.execute(
            select(func.count()).select_from(ScoringRubric).where(
                ScoringRubric.scenario_type == stype,
                ScoringRubric.is_default == True,  # noqa: E712
            )
        )
        default_count = count_result.scalar() or 0
        if default_count > 1:
            # Keep only the most recently updated default, unset the rest
            latest_result = await session.execute(
                select(ScoringRubric.id)
                .where(
                    ScoringRubric.scenario_type == stype,
                    ScoringRubric.is_default == True,  # noqa: E712
                )
                .order_by(ScoringRubric.updated_at.desc())
                .limit(1)
            )
            keep_id = latest_result.scalar()
            if keep_id:
                await session.execute(
                    update(ScoringRubric)
                    .where(
                        ScoringRubric.scenario_type == stype,
                        ScoringRubric.is_default == True,  # noqa: E712
                        ScoringRubric.id != keep_id,
                    )
                    .values(is_default=False)
                )
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

        # Resolve default rubric for rubric_id assignment
        default_rubric_result = await session.execute(
            select(ScoringRubric).where(
                ScoringRubric.is_default == True,  # noqa: E712
            )
        )
        default_rubric = default_rubric_result.scalar_one_or_none()
        default_rubric_id = default_rubric.id if default_rubric else None

        # Build HCP name -> ID map
        hcp_result = await session.execute(select(HcpProfile))
        hcp_map = {p.name: p.id for p in hcp_result.scalars().all()}

        for scenario_data in SEED_SCENARIOS:
            data = dict(scenario_data)  # copy to avoid mutating the constant
            hcp_name = data.pop("hcp_name", None)
            hcp_id = hcp_map.get(hcp_name) if hcp_name else None
            # Assign rubric_id from default rubric (required NOT NULL per D-05)
            if "rubric_id" not in data and default_rubric_id:
                data["rubric_id"] = default_rubric_id
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
            import logging as _mat_logging

            _mat_logging.getLogger(__name__).debug("Materials seed skipped", exc_info=True)

    # --- 6. Azure AI Foundry config from env vars ---
    try:
        from app.config import get_settings
        from app.models.service_config import ServiceConfig
        from app.utils.encryption import encrypt_value

        foundry_settings = get_settings()
        existing_master = await session.execute(
            select(ServiceConfig).where(ServiceConfig.is_master == True)  # noqa: E712
        )
        if existing_master.scalar_one_or_none() is None and foundry_settings.azure_foundry_endpoint:
            master = ServiceConfig(
                service_name="ai_foundry",
                display_name="Azure AI Foundry",
                endpoint=foundry_settings.azure_foundry_endpoint,
                api_key_encrypted=(
                    encrypt_value(foundry_settings.azure_foundry_api_key)
                    if foundry_settings.azure_foundry_api_key
                    else ""
                ),
                model_or_deployment=(
                    foundry_settings.azure_openai_deployment
                    or foundry_settings.voice_live_default_model
                ),
                default_project=foundry_settings.azure_foundry_default_project,
                region="swedencentral",
                is_master=True,
                is_active=True,
                updated_by="seed",
            )
            session.add(master)

            # Voice Live service row in agent mode
            if foundry_settings.azure_foundry_default_project:
                import json as _json

                mode_json = _json.dumps(
                    {
                        "mode": "agent",
                        "agent_id": "",
                        "project_name": foundry_settings.azure_foundry_default_project,
                    }
                )
                vl = ServiceConfig(
                    service_name="azure_voice_live",
                    display_name="Azure Voice Live",
                    endpoint="",
                    api_key_encrypted="",
                    model_or_deployment=mode_json,
                    region="",
                    is_master=False,
                    is_active=True,
                    updated_by="seed",
                )
                session.add(vl)
            await session.commit()
    except Exception:
        import logging as _logging

        _logging.getLogger(__name__).warning(
            "AI Foundry config seed failed (table may not exist yet)", exc_info=True
        )
