"""PostgreSQL compatibility tests for startup seed behavior."""

import json
from unittest.mock import MagicMock, patch

from sqlalchemy import select

from app.models.scenario import Scenario
from app.models.skill import Skill, SkillVersion
from app.models.user import User
from app.services.auth import get_password_hash


def _mock_seed_module() -> MagicMock:
    seed_module = MagicMock()
    seed_module.SEED_HCP_PROFILES = [{"name": "Dr. Seed", "specialty": "Oncology"}]
    seed_module.SEED_SCENARIOS = [
        {
            "name": "Seed Scenario",
            "description": "Scenario requiring a skill",
            "product": "Product A",
            "therapeutic_area": "Oncology",
            "mode": "f2f",
            "difficulty": "medium",
            "status": "active",
            "hcp_name": "Dr. Seed",
            "key_messages": "[]",
            "pass_threshold": 70,
        }
    ]
    return seed_module


def _mock_settings() -> MagicMock:
    settings = MagicMock()
    settings.azure_foundry_endpoint = ""
    return settings


async def test_seed_skips_scenarios_without_published_skill(db_session):
    """Scenario seed should not violate NOT NULL skill_id when no published skill exists."""
    with (
        patch.dict(
            "sys.modules", {"seed_phase2": _mock_seed_module(), "seed_materials": MagicMock()}
        ),
        patch("app.config.get_settings", return_value=_mock_settings()),
    ):
        from app.startup_seed import seed_all

        await seed_all(db_session)

    result = await db_session.execute(select(Scenario))
    assert result.scalars().all() == []


async def test_seed_creates_scenarios_with_published_skill(db_session):
    """Scenario seed should map legacy product fields to tags and attach a skill."""
    admin = User(
        username="admin",
        email="admin@aicoach.com",
        hashed_password=get_password_hash("admin123"),
        role="admin",
    )
    db_session.add(admin)
    await db_session.flush()
    skill = Skill(
        name="Published Skill",
        description="Seed skill",
        status="published",
        created_by=admin.id,
    )
    db_session.add(skill)
    await db_session.flush()
    version = SkillVersion(
        skill_id=skill.id,
        version_number=1,
        content="Seed content",
        is_published=True,
        created_by=admin.id,
    )
    db_session.add(version)
    await db_session.commit()

    with (
        patch.dict(
            "sys.modules", {"seed_phase2": _mock_seed_module(), "seed_materials": MagicMock()}
        ),
        patch("app.config.get_settings", return_value=_mock_settings()),
    ):
        from app.startup_seed import seed_all

        await seed_all(db_session)

    result = await db_session.execute(select(Scenario))
    scenario = result.scalar_one()
    assert scenario.skill_id == skill.id
    assert scenario.skill_version_id == version.id
    assert json.loads(scenario.tags) == ["product:Product A", "area:Oncology"]
