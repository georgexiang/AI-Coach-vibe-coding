"""Deployment-time database migration and sample data bootstrap.

This script is intended for production-style deployments. It runs schema migrations and
idempotent sample-data seeding before the app is started or verified.
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from alembic.config import Config
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alembic import command

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import AsyncSessionLocal, engine
from app.models.skill import Skill, SkillVersion
from app.services.meta_skill_service import ensure_defaults
from app.services.skill_validation_service import _compute_content_hash
from app.startup_seed import seed_all

_QUALITY_DIMENSIONS = [
    {
        "name": "sop_completeness",
        "score": 88,
        "verdict": "PASS",
        "strengths": ["Complete SOP structure", "Clear key messages"],
        "improvements": ["Add more timing guidance"],
        "critical_issues": [],
        "rationale": "Seed content includes opening, product discussion, and closing steps.",
    },
    {
        "name": "assessment_coverage",
        "score": 82,
        "verdict": "PASS",
        "strengths": ["Covers multiple assessment dimensions"],
        "improvements": ["Add more concrete scoring examples"],
        "critical_issues": [],
        "rationale": "Rubric content covers knowledge, objections, and communication.",
    },
    {
        "name": "knowledge_accuracy",
        "score": 90,
        "verdict": "PASS",
        "strengths": ["Uses product-specific clinical evidence"],
        "improvements": ["Refresh with latest label updates when available"],
        "critical_issues": [],
        "rationale": "Seed content includes product mechanism and trial evidence.",
    },
    {
        "name": "difficulty_calibration",
        "score": 78,
        "verdict": "PASS",
        "strengths": ["Includes realistic clinical objections"],
        "improvements": ["Add progressive difficulty paths"],
        "critical_issues": [],
        "rationale": "The seeded skills include basic and advanced practice variants.",
    },
    {
        "name": "conversation_logic",
        "score": 85,
        "verdict": "PASS",
        "strengths": ["Conversation flow is coherent"],
        "improvements": ["Add more branching dialogue options"],
        "critical_issues": [],
        "rationale": "The flow progresses from trust building to evidence and next steps.",
    },
    {
        "name": "executability",
        "score": 87,
        "verdict": "PASS",
        "strengths": ["AI coach instructions are directly executable"],
        "improvements": ["Add edge-case handling guidance"],
        "critical_issues": [],
        "rationale": "Steps and key points are explicit enough for agent execution.",
    },
]


def run_migrations() -> None:
    """Upgrade the configured database to the latest Alembic head."""
    backend_root = Path(__file__).resolve().parent.parent
    alembic_cfg = Config(str(backend_root / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(backend_root / "alembic"))
    command.upgrade(alembic_cfg, "head")


def _quality_details(content: str) -> str:
    overall_score = round(sum(d["score"] for d in _QUALITY_DIMENSIONS) / len(_QUALITY_DIMENSIONS))
    return json.dumps(
        {
            "overall_score": overall_score,
            "overall_verdict": "PASS",
            "content_hash": _compute_content_hash(content),
            "evaluated_at": "2026-04-11T00:00:00+00:00",
            "summary": "Production bootstrap sample skill quality gate result.",
            "dimensions": _QUALITY_DIMENSIONS,
            "top_improvements": [
                "Add progressive difficulty design",
                "Add more branching dialogue paths",
                "Add step-level timing guidance",
            ],
        },
        ensure_ascii=False,
    )


async def seed_skills(session: AsyncSession) -> None:
    """Seed SkillHub entries directly in the database before the API is online."""
    from seed_skills import SKILLS_TO_SEED  # type: ignore[import-not-found]

    from app.models.user import User

    admin_result = await session.execute(select(User).where(User.role == "admin").limit(1))
    admin = admin_result.scalars().first()
    if admin is None:
        raise RuntimeError("Sample skill bootstrap requires an admin user")

    for skill_data in SKILLS_TO_SEED:
        result = await session.execute(select(Skill).where(Skill.name == skill_data["name"]))
        if result.scalar_one_or_none() is not None:
            continue

        target_status = skill_data["target_status"]
        content = skill_data["content"]
        skill = Skill(
            name=skill_data["name"],
            description=skill_data["description"],
            product=skill_data["product"],
            therapeutic_area=skill_data["therapeutic_area"],
            content=content,
            status=target_status,
            current_version=1,
            structure_check_passed=True if target_status in {"published", "archived"} else None,
            structure_check_details=json.dumps({"score": 100, "issues": []}),
            quality_score=85 if target_status in {"published", "archived"} else None,
            quality_verdict="PASS" if target_status in {"published", "archived"} else None,
            quality_details=(
                _quality_details(content) if target_status in {"published", "archived"} else "{}"
            ),
            created_by=admin.id,
            updated_by="bootstrap",
        )
        session.add(skill)
        await session.flush()

        session.add(
            SkillVersion(
                skill_id=skill.id,
                version_number=1,
                content=content,
                metadata_json=json.dumps(
                    {
                        "seeded": True,
                        "product": skill_data["product"],
                        "therapeutic_area": skill_data["therapeutic_area"],
                    },
                    ensure_ascii=False,
                ),
                change_notes="Initial sample skill",
                is_published=target_status in {"published", "archived"},
                created_by=admin.id,
            )
        )

    await session.commit()


_SAMPLE_VOICE_LIVE_INSTANCES = [
    {
        "name": "Sample Voice Live - Chinese Female",
        "description": "Sample: Chinese speech input, Chinese voice output, female avatar.",
        "recognition_language": "zh-CN",
        "voice_name": "zh-CN-XiaoxiaoNeural",
        "avatar_character": "lori",
        "avatar_style": "casual",
    },
    {
        "name": "Sample Voice Live - Chinese Male",
        "description": "Sample: Chinese speech input, Chinese voice output, male avatar.",
        "recognition_language": "zh-CN",
        "voice_name": "zh-CN-YunxiNeural",
        "avatar_character": "max",
        "avatar_style": "business",
    },
    {
        "name": "Sample Voice Live - English Female",
        "description": "Sample: English speech input, English voice output, female avatar.",
        "recognition_language": "en-US",
        "voice_name": "en-US-AvaNeural",
        "avatar_character": "lori",
        "avatar_style": "casual",
    },
    {
        "name": "Sample Voice Live - English Male",
        "description": "Sample: English speech input, English voice output, male avatar.",
        "recognition_language": "en-US",
        "voice_name": "en-US-AndrewNeural",
        "avatar_character": "max",
        "avatar_style": "business",
    },
]


async def seed_voice_live_instances(session: AsyncSession) -> None:
    """Seed deployment sample Voice Live Instances without affecting local startup seed."""
    from app.models.user import User
    from app.models.voice_live_instance import VoiceLiveInstance

    admin_result = await session.execute(select(User).where(User.role == "admin").limit(1))
    admin = admin_result.scalars().first()
    if admin is None:
        raise RuntimeError("Voice Live Instance sample bootstrap requires an admin user")

    for sample in _SAMPLE_VOICE_LIVE_INSTANCES:
        result = await session.execute(
            select(VoiceLiveInstance).where(VoiceLiveInstance.name == sample["name"]).limit(1)
        )
        if result.scalars().first() is not None:
            continue

        session.add(
            VoiceLiveInstance(
                name=sample["name"],
                description=sample["description"],
                voice_live_model="gpt-realtime",
                enabled=True,
                voice_name=sample["voice_name"],
                voice_type="azure-standard",
                voice_temperature=0.9,
                voice_custom=False,
                avatar_character=sample["avatar_character"],
                avatar_style=sample["avatar_style"],
                avatar_customized=False,
                turn_detection_type="server_vad",
                noise_suppression=False,
                echo_cancellation=False,
                eou_detection=False,
                recognition_language=sample["recognition_language"],
                response_temperature=0.8,
                proactive_engagement=True,
                auto_detect_language=False,
                playback_speed=1.0,
                custom_lexicon_enabled=False,
                custom_lexicon_url="",
                avatar_enabled=True,
                model_instruction="",
                created_by=admin.id,
            )
        )

    await session.commit()


async def seed_samples() -> None:
    """Run idempotent sample-data seeders in dependency order."""
    scripts_dir = str(Path(__file__).resolve().parent)
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)

    async with AsyncSessionLocal() as session:
        await seed_all(session)
        await seed_skills(session)
        await seed_voice_live_instances(session)
        await seed_all(session)
        await ensure_defaults(session)
        await session.commit()


async def _dispose() -> None:
    await engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description="Bootstrap app database and sample data")
    parser.add_argument("--skip-migrations", action="store_true")
    parser.add_argument("--skip-seed", action="store_true")
    args = parser.parse_args()

    if not args.skip_migrations:
        print("Running database migrations...")
        run_migrations()

    if not args.skip_seed:
        print("Seeding sample application data...")
        asyncio.run(seed_samples())

    asyncio.run(_dispose())
    print("Application bootstrap complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
