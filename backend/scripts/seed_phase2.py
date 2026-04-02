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
        "name": "Dr. Zhang Wei (张维)",
        "specialty": "Hematology/Oncology (血液肿瘤科)",
        "hospital": "Peking Union Medical College Hospital (北京协和医院)",
        "title": "Chief Hematologist (主任医师)",
        "personality_type": "skeptical",
        "emotional_state": 80,
        "communication_style": 30,
        "expertise_areas": json.dumps(
            ["Hematologic malignancies", "BTK inhibitor therapy", "CLL/SLL", "Clinical trials"]
        ),
        "prescribing_habits": (
            "Conservative prescriber, prefers well-established treatments with head-to-head data"
        ),
        "concerns": (
            "Cardiac toxicity (atrial fibrillation), "
            "long-term PFS data, cost-effectiveness vs ibrutinib"
        ),
        "objections": json.dumps(
            [
                "What about the cardiac toxicity reported in post-market studies?",
                "The cost is too high for most patients without insurance coverage",
                "I need to see more real-world evidence beyond clinical trials",
                "How does zanubrutinib compare with acalabrutinib?",
            ]
        ),
        "probe_topics": json.dumps(
            [
                "ALPINE trial head-to-head comparison data",
                "BTK selectivity and off-target effects",
                "Patient assistance programs",
            ]
        ),
        "difficulty": "hard",
        "is_active": True,
        # Voice/Avatar digital persona (Phase 12)
        "voice_name": "zh-CN-YunxiNeural",
        "voice_type": "azure-standard",
        "voice_temperature": 0.7,
        "voice_custom": False,
        "avatar_character": "harry",
        "avatar_style": "business",
        "avatar_customized": False,
        "turn_detection_type": "azure_semantic_vad",
        "noise_suppression": True,
        "echo_cancellation": False,
        "eou_detection": False,
        "recognition_language": "zh-CN",
        "agent_instructions_override": "",
    },
    {
        "name": "Dr. Li Mei (李梅)",
        "specialty": "Medical Oncology (肿瘤内科)",
        "hospital": "Shanghai Ruijin Hospital (上海瑞金医院)",
        "title": "Associate Director (副主任医师)",
        "personality_type": "friendly",
        "emotional_state": 40,
        "communication_style": 50,
        "expertise_areas": json.dumps(
            ["Immunotherapy", "NSCLC", "Esophageal cancer", "PD-1/PD-L1 checkpoint inhibitors"]
        ),
        "prescribing_habits": (
            "Open to new treatments with solid evidence, early adopter of immunotherapy"
        ),
        "concerns": (
            "Immune-related adverse events, cardiac safety "
            "of checkpoint inhibitors, combination regimen tolerability"
        ),
        "objections": json.dumps(
            [
                "How does tislelizumab compare with pembrolizumab in NSCLC?",
                "What about patients with pre-existing autoimmune conditions?",
                "Is there data for first-line combination therapy?",
            ]
        ),
        "probe_topics": json.dumps(
            [
                "RATIONALE-302/306 trial data",
                "Fc-engineered anti-PD-1 mechanism advantage",
                "Real-world patient outcomes in Chinese population",
            ]
        ),
        "difficulty": "medium",
        "is_active": True,
        # Voice/Avatar digital persona (Phase 12)
        "voice_name": "zh-CN-XiaoxiaoMultilingualNeural",
        "voice_type": "azure-standard",
        "voice_temperature": 0.9,
        "voice_custom": False,
        "avatar_character": "lisa",
        "avatar_style": "graceful-sitting",
        "avatar_customized": False,
        "turn_detection_type": "server_vad",
        "noise_suppression": False,
        "echo_cancellation": False,
        "eou_detection": False,
        "recognition_language": "auto",
        "agent_instructions_override": "",
    },
    {
        "name": "Dr. Chen Jun (陈军)",
        "specialty": "Hematology (血液科)",
        "hospital": "Guangdong General Hospital (广东省人民医院)",
        "title": "Department Director (科主任)",
        "personality_type": "analytical",
        "emotional_state": 50,
        "communication_style": 70,
        "expertise_areas": json.dumps(
            [
                "Waldenström macroglobulinemia",
                "Mantle cell lymphoma",
                "MZL",
                "Clinical research methodology",
            ]
        ),
        "prescribing_habits": (
            "Data-driven, requires strong statistical evidence and subgroup analysis"
        ),
        "concerns": (
            "Long-term safety in elderly patients, "
            "neutropenia management, MYD88 mutation status impact"
        ),
        "objections": json.dumps(
            [
                "The sample size in the ASPEN trial was insufficient for WM subgroups",
                "I would like to see longer follow-up data beyond 24 months",
                "How do you manage treatment in MYD88 wild-type patients?",
            ]
        ),
        "probe_topics": json.dumps(
            [
                "ASPEN trial WM-specific data",
                "VGPR rate comparison with ibrutinib",
                "Biomarker-driven patient selection for BTKi",
            ]
        ),
        "difficulty": "hard",
        "is_active": True,
        # Voice/Avatar digital persona (Phase 12)
        "voice_name": "en-US-AvaNeural",
        "voice_type": "azure-standard",
        "voice_temperature": 0.8,
        "voice_custom": False,
        "avatar_character": "lori",
        "avatar_style": "casual",
        "avatar_customized": False,
        "turn_detection_type": "server_vad",
        "noise_suppression": False,
        "echo_cancellation": True,
        "eou_detection": False,
        "recognition_language": "auto",
        "agent_instructions_override": "",
    },
    {
        "name": "Dr. Wang Ling (王玲)",
        "specialty": "Clinical Pharmacology (临床药理学)",
        "hospital": "West China Hospital (华西医院)",
        "title": "Senior Pharmacologist (主任药师)",
        "personality_type": "analytical",
        "emotional_state": 60,
        "communication_style": 40,
        "expertise_areas": json.dumps(
            ["Drug metabolism", "PK/PD modeling", "Drug-drug interactions", "CYP3A4 inhibition"]
        ),
        "prescribing_habits": (
            "Focused on pharmacokinetic evidence, dose optimization, and interaction profiles"
        ),
        "concerns": (
            "CYP3A4 interaction potential, dose adjustments "
            "in hepatic/renal impairment, drug interaction with antifungals"
        ),
        "objections": json.dumps(
            [
                "What is the CYP3A4 interaction profile compared to ibrutinib?",
                "Dose adjustment data for patients on moderate CYP3A inhibitors is limited",
                "How does food affect bioavailability?",
            ]
        ),
        "probe_topics": json.dumps(
            [
                "Zanubrutinib pharmacokinetic profile",
                "Dose modification guidelines",
                "Drug interaction management strategies",
            ]
        ),
        "difficulty": "medium",
        "is_active": True,
        # Voice/Avatar digital persona (Phase 12)
        "voice_name": "zh-CN-YunyiMultilingualNeural",
        "voice_type": "azure-standard",
        "voice_temperature": 0.6,
        "voice_custom": False,
        "avatar_character": "jeff",
        "avatar_style": "formal",
        "avatar_customized": False,
        "turn_detection_type": "azure_semantic_vad",
        "noise_suppression": True,
        "echo_cancellation": True,
        "eou_detection": False,
        "recognition_language": "zh-CN",
        "agent_instructions_override": "",
    },
    {
        "name": "Dr. Liu Yang (刘洋)",
        "specialty": "Immuno-Oncology (肿瘤免疫科)",
        "hospital": "Sun Yat-sen University Cancer Center (中山大学肿瘤防治中心)",
        "title": "Associate Professor (副教授)",
        "personality_type": "friendly",
        "emotional_state": 35,
        "communication_style": 60,
        "expertise_areas": json.dumps(
            [
                "Tumor microenvironment",
                "PD-1/PD-L1 biomarkers",
                "Combination immunotherapy",
                "Translational research",
            ]
        ),
        "prescribing_habits": (
            "Progressive, enthusiastic about novel combinations and biomarker-guided therapy"
        ),
        "concerns": (
            "Optimal biomarker selection for patient "
            "stratification, managing irAEs in combination regimens"
        ),
        "objections": json.dumps(
            [
                "What is the predictive value of PD-L1 TAP score for tislelizumab response?",
                "How does Fc engineering translate to clinical benefit?",
                "Is there data on tislelizumab + chemotherapy in hepatocellular carcinoma?",
            ]
        ),
        "probe_topics": json.dumps(
            [
                "Fc-engineered anti-PD-1 reduced FcγR binding mechanism",
                "Tislelizumab biomarker strategy",
                "Emerging combination data across tumor types",
            ]
        ),
        "difficulty": "easy",
        "is_active": True,
        # Voice/Avatar digital persona (Phase 12)
        "voice_name": "zh-CN-XiaomengNeural",
        "voice_type": "azure-standard",
        "voice_temperature": 0.9,
        "voice_custom": False,
        "avatar_character": "lisa",
        "avatar_style": "technical-sitting",
        "avatar_customized": False,
        "turn_detection_type": "server_vad",
        "noise_suppression": False,
        "echo_cancellation": False,
        "eou_detection": False,
        "recognition_language": "auto",
        "agent_instructions_override": "",
    },
]

SEED_SCENARIOS = [
    {
        "name": "F2F: BRUKINSA CLL/SLL Discussion (F2F: 百悦泽CLL/SLL学术讨论)",
        "description": (
            "Practice presenting Zanubrutinib / 泽布替尼 (BRUKINSA®) to a skeptical "
            "hematologist who questions cardiac safety and cost vs ibrutinib. "
            "Focus on ALPINE trial head-to-head data and superior safety profile."
        ),
        "product": "Zanubrutinib / 泽布替尼 (BRUKINSA®)",
        "therapeutic_area": "Hematology / Oncology (血液肿瘤)",
        "mode": "f2f",
        "difficulty": "hard",
        "status": "active",
        "hcp_name": "Dr. Zhang Wei (张维)",
        "key_messages": json.dumps(
            [
                "Superior ORR (78.3% vs 62.5%) vs ibrutinib in ALPINE trial",
                "Lower atrial fibrillation rate (2.5% vs 10.1%) vs ibrutinib",
                "Proven efficacy across CLL/SLL, MCL, WM, and MZL indications",
                "Patient support program (百济患者关爱计划) available for cost management",
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
        "name": "F2F: Tislelizumab NSCLC Presentation (F2F: 百泽安NSCLC推介)",
        "description": (
            "Regular visit with an oncologist to present Tislelizumab / 替雷利珠单抗 (百泽安®) "
            "data for NSCLC. The HCP is open-minded but has concerns about "
            "immune-related adverse events and combination therapy tolerability."
        ),
        "product": "Tislelizumab / 替雷利珠单抗 (百泽安®)",
        "therapeutic_area": "Oncology / Immunotherapy (肿瘤免疫)",
        "mode": "f2f",
        "difficulty": "medium",
        "status": "active",
        "hcp_name": "Dr. Li Mei (李梅)",
        "key_messages": json.dumps(
            [
                "Fc-engineered anti-PD-1 with reduced FcγR binding",
                "RATIONALE-306: PFS and OS improvement in 1L NSCLC combo",
                "Favorable safety profile with low myocarditis rate (<1%)",
                "Approved for esophageal squamous cell carcinoma and NSCLC indications",
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
        "name": "Conference: Hematology Case Review (会议: 血液学病例讨论)",
        "description": (
            "Present BRUKINSA® clinical case at a hematology conference session. "
            "Discuss Zanubrutinib in Waldenström macroglobulinemia (WM) with ASPEN trial data. "
            "Multiple HCPs in audience — formal presentation style required."
        ),
        "product": "Zanubrutinib / 泽布替尼 (BRUKINSA®)",
        "therapeutic_area": "Hematology (血液科)",
        "mode": "conference",
        "difficulty": "hard",
        "status": "active",
        "hcp_name": "Dr. Chen Jun (陈军)",
        "key_messages": json.dumps(
            [
                "ASPEN trial: zanubrutinib VGPR 28.4% vs ibrutinib 19.2% in WM patients",
                "Superior tolerability with lower cardiac and hypertension events vs ibrutinib",
                "Particular benefit in MYD88-mutated WM population",
                "SEQUOIA trial: 85% 24-month PFS in first-line CLL/SLL, superior to BR regimen",
            ]
        ),
        "weight_key_message": 25,
        "weight_objection_handling": 20,
        "weight_communication": 25,
        "weight_product_knowledge": 15,
        "weight_scientific_info": 15,
        "pass_threshold": 70,
    },
    {
        "name": "Conference: Immuno-Oncology Update (会议: 肿瘤免疫进展报告)",
        "description": (
            "Present tislelizumab / 替雷利珠单抗 (百泽安®) clinical progress at an immuno-oncology "
            "conference. Cover Fc-engineering advantage, multi-tumor data, "
            "and emerging combinations. "
            "Progressive audience eager for novel data."
        ),
        "product": "Tislelizumab / 替雷利珠单抗 (百泽安®)",
        "therapeutic_area": "Immuno-Oncology (肿瘤免疫)",
        "mode": "conference",
        "difficulty": "medium",
        "status": "active",
        "hcp_name": "Dr. Liu Yang (刘洋)",
        "key_messages": json.dumps(
            [
                "Fc-engineered: minimized FcγR binding reduces T-cell clearance",
                "RATIONALE-302: OS 17.2 months vs 10.6 months in PD-L1 TAP≥10% ESCC patients",
                "Broad tumor coverage: NSCLC, ESCC, hepatocellular, urothelial carcinomas",
                "Active combination studies with BRUKINSA® in B-cell malignancies",
            ]
        ),
        "weight_key_message": 25,
        "weight_objection_handling": 15,
        "weight_communication": 25,
        "weight_product_knowledge": 20,
        "weight_scientific_info": 15,
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
