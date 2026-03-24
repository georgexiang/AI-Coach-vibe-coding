"""Seed Phase 2 demo data: HCP profiles and training scenarios.

Idempotent -- skips records that already exist (by name).
Run with: python scripts/seed_phase2.py
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
from app.models.base import Base
from app.models.hcp_profile import HcpProfile
from app.models.scenario import Scenario
from app.models.user import User

settings = get_settings()

SEED_HCP_PROFILES = [
    {
        "name": "Dr. Zhang Wei",
        "specialty": "Oncology",
        "hospital": "Beijing Cancer Hospital",
        "title": "Chief Oncologist",
        "personality_type": "skeptical",
        "emotional_state": 80,
        "communication_style": 30,
        "expertise_areas": json.dumps(
            ["Hematologic malignancies", "Targeted therapy", "Clinical trials"]
        ),
        "prescribing_habits": "Conservative prescriber, prefers well-established treatments",
        "concerns": "Side effect profiles, long-term survival data, cost-effectiveness",
        "objections": json.dumps(
            [
                "What about the cardiac toxicity reported in post-market studies?",
                "The cost is too high for most patients without insurance coverage",
                "I need to see more real-world evidence beyond clinical trials",
            ]
        ),
        "probe_topics": json.dumps(
            [
                "Mechanism of action specifics",
                "Head-to-head comparison data",
                "Patient assistance programs",
            ]
        ),
        "difficulty": "hard",
        "is_active": True,
    },
    {
        "name": "Dr. Li Ming",
        "specialty": "Cardiology",
        "hospital": "Peking Union Medical College Hospital",
        "title": "Associate Director",
        "personality_type": "friendly",
        "emotional_state": 40,
        "communication_style": 50,
        "expertise_areas": json.dumps(
            ["Heart failure", "Interventional cardiology", "Pharmacotherapy"]
        ),
        "prescribing_habits": "Open to new treatments with solid evidence",
        "concerns": "Drug interactions with cardiac medications, QT prolongation",
        "objections": json.dumps(
            [
                "How does this interact with anticoagulants?",
                "What about patients with pre-existing cardiac conditions?",
            ]
        ),
        "probe_topics": json.dumps(
            [
                "Cardiovascular safety profile",
                "Dosing adjustments for renal impairment",
                "Real-world patient outcomes",
            ]
        ),
        "difficulty": "medium",
        "is_active": True,
    },
    {
        "name": "Dr. Wang Fang",
        "specialty": "Neurology",
        "hospital": "Shanghai Huashan Hospital",
        "title": "Senior Neurologist",
        "personality_type": "analytical",
        "emotional_state": 50,
        "communication_style": 70,
        "expertise_areas": json.dumps(
            ["Neuro-oncology", "Clinical research methodology", "CNS lymphoma"]
        ),
        "prescribing_habits": "Data-driven, requires strong statistical evidence",
        "concerns": "Blood-brain barrier penetration, CNS-specific efficacy data",
        "objections": json.dumps(
            [
                "The sample size in the pivotal trial was insufficient",
                "I would like to see subgroup analysis for CNS involvement",
            ]
        ),
        "probe_topics": json.dumps(
            [
                "Clinical trial methodology and endpoints",
                "Pharmacokinetics and CNS penetration",
                "Biomarker-driven patient selection",
            ]
        ),
        "difficulty": "hard",
        "is_active": True,
    },
]

SEED_SCENARIOS = [
    {
        "name": "Product X Launch -- Skeptical Oncologist",
        "description": (
            "Practice launching Zanubrutinib to a skeptical oncologist who questions "
            "side effects and cost. The HCP is highly resistant and uses direct "
            "communication. Focus on key clinical data and real-world evidence."
        ),
        "product": "Zanubrutinib",
        "therapeutic_area": "Oncology / Hematology",
        "mode": "f2f",
        "difficulty": "hard",
        "status": "active",
        "hcp_name": "Dr. Zhang Wei",
        "key_messages": json.dumps(
            [
                "Zanubrutinib demonstrates superior PFS vs ibrutinib in ALPINE trial",
                "Lower rate of cardiac adverse events compared to first-generation BTKi",
                "Proven efficacy across multiple B-cell malignancies",
                "Patient support program available for cost management",
            ]
        ),
        "weight_key_message": 30,
        "weight_objection_handling": 25,
        "weight_communication": 20,
        "weight_product_knowledge": 15,
        "weight_scientific_info": 10,
        "pass_threshold": 70,
    },
    {
        "name": "Quarterly Update -- Friendly Cardiologist",
        "description": (
            "Regular quarterly visit with a friendly cardiologist to update on "
            "Tislelizumab data. The HCP is open-minded but has concerns about "
            "cardiac safety in immunotherapy."
        ),
        "product": "Tislelizumab",
        "therapeutic_area": "Oncology / Immunotherapy",
        "mode": "f2f",
        "difficulty": "medium",
        "status": "active",
        "hcp_name": "Dr. Li Ming",
        "key_messages": json.dumps(
            [
                "Tislelizumab shows favorable cardiac safety profile in Phase III data",
                "New indication approved for esophageal squamous cell carcinoma",
                "Updated overall survival data from RATIONALE-301 trial",
            ]
        ),
        "weight_key_message": 30,
        "weight_objection_handling": 25,
        "weight_communication": 20,
        "weight_product_knowledge": 15,
        "weight_scientific_info": 10,
        "pass_threshold": 70,
    },
]


async def seed_phase2() -> None:
    """Create seed HCP profiles and scenarios if they do not already exist."""
    engine = create_async_engine(settings.database_url, echo=False)

    # Ensure tables exist before seeding
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Get admin user for created_by
        result = await session.execute(select(User).where(User.role == "admin"))
        admin = result.scalar_one_or_none()
        if admin is None:
            print("  [error] No admin user found. Run seed_data.py first.")
            await engine.dispose()
            return

        admin_id = admin.id

        # Seed HCP profiles
        print("Seeding HCP profiles...")
        hcp_map: dict[str, str] = {}  # name -> id
        for profile_data in SEED_HCP_PROFILES:
            name = profile_data["name"]
            result = await session.execute(select(HcpProfile).where(HcpProfile.name == name))
            existing = result.scalar_one_or_none()
            if existing is not None:
                print(f"  [skip] HCP profile '{name}' already exists")
                hcp_map[name] = existing.id
                continue

            profile = HcpProfile(**profile_data, created_by=admin_id)
            session.add(profile)
            await session.flush()
            hcp_map[name] = profile.id
            print(f"  [created] HCP profile '{name}' ({profile_data['specialty']})")

        # Seed scenarios
        print("Seeding scenarios...")
        for scenario_data in SEED_SCENARIOS:
            name = scenario_data["name"]
            result = await session.execute(select(Scenario).where(Scenario.name == name))
            if result.scalar_one_or_none() is not None:
                print(f"  [skip] Scenario '{name}' already exists")
                continue

            # Resolve HCP profile ID from name
            hcp_name = scenario_data.pop("hcp_name")
            hcp_id = hcp_map.get(hcp_name)
            if hcp_id is None:
                print(f"  [error] HCP profile '{hcp_name}' not found, skipping scenario '{name}'")
                continue

            scenario = Scenario(
                **scenario_data,
                hcp_profile_id=hcp_id,
                created_by=admin_id,
            )
            session.add(scenario)
            print(f"  [created] Scenario '{name}' (product={scenario_data['product']})")

        await session.commit()

    await engine.dispose()
    print("Phase 2 seed complete.")


if __name__ == "__main__":
    asyncio.run(seed_phase2())
