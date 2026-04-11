"""Scenario service: CRUD operations for training scenarios."""

import json
import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.scenario import Scenario
from app.models.skill import Skill, SkillVersion
from app.schemas.scenario import ScenarioCreate, ScenarioUpdate
from app.services import hcp_profile_service
from app.utils.exceptions import bad_request, not_found

logger = logging.getLogger(__name__)


async def _validate_and_pin_skill(
    db: AsyncSession, skill_id: str | None
) -> tuple[str | None, str | None]:
    """Validate skill association and pin to published version.

    Server-side enforcement: only published or archived skills allowed (D-23).
    Returns (skill_id, skill_version_id) tuple.
    """
    if not skill_id:
        return None, None

    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if skill is None:
        not_found("Skill not found")

    if skill.status not in ("published", "archived"):
        bad_request("Only published or archived skills can be associated with scenarios")

    # Pin to published version for deterministic agent behavior
    version_result = await db.execute(
        select(SkillVersion).where(
            SkillVersion.skill_id == skill_id,
            SkillVersion.is_published == True,  # noqa: E712
        )
    )
    version = version_result.scalar_one_or_none()
    if version is None:
        bad_request("Skill has no published version")

    logger.info("Pinned skill %s to version %s", skill_id, version.id)
    return skill_id, version.id


async def _trigger_agent_resync(db: AsyncSession, hcp_profile_id: str) -> None:
    """Trigger agent re-sync after skill assignment change."""
    try:
        from app.services import agent_sync_service

        profile_result = await db.execute(
            select(hcp_profile_service.HcpProfile).where(
                hcp_profile_service.HcpProfile.id == hcp_profile_id
            )
        )
        profile = profile_result.scalar_one_or_none()
        if profile and profile.agent_id:
            await agent_sync_service.sync_agent_for_profile(db, profile)
    except Exception as e:
        logger.warning("Agent re-sync after skill assignment failed: %s", e)


async def create_scenario(db: AsyncSession, data: ScenarioCreate, user_id: str) -> Scenario:
    """Create a new scenario. Verifies the referenced HCP profile exists."""
    # Verify HCP profile exists
    await hcp_profile_service.get_hcp_profile(db, data.hcp_profile_id)

    scenario_data = data.model_dump()
    scenario_data["created_by"] = user_id

    # Serialize key_messages list to JSON string
    if isinstance(scenario_data.get("key_messages"), list):
        scenario_data["key_messages"] = json.dumps(scenario_data["key_messages"])

    # Validate and pin skill version
    skill_id, skill_version_id = await _validate_and_pin_skill(db, scenario_data.get("skill_id"))
    scenario_data["skill_id"] = skill_id
    scenario_data["skill_version_id"] = skill_version_id

    scenario = Scenario(**scenario_data)
    db.add(scenario)
    await db.flush()
    await db.refresh(scenario)

    # Trigger agent re-sync if skill assigned
    if skill_id:
        await _trigger_agent_resync(db, scenario.hcp_profile_id)

    return scenario


async def get_scenarios(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    mode: str | None = None,
    search: str | None = None,
) -> tuple[list[Scenario], int]:
    """List scenarios with optional filters and eager-loaded HCP profile."""
    query = select(Scenario).options(selectinload(Scenario.hcp_profile))

    if status:
        query = query.where(Scenario.status == status)
    if mode:
        query = query.where(Scenario.mode == mode)
    if search:
        search_filter = f"%{search}%"
        query = query.where(Scenario.name.ilike(search_filter))

    # Count total
    count_query = select(func.count()).select_from(
        select(Scenario.id)
        .where(
            *[
                c
                for c in [
                    Scenario.status == status if status else None,
                    Scenario.mode == mode if mode else None,
                    Scenario.name.ilike(f"%{search}%") if search else None,
                ]
                if c is not None
            ]
        )
        .subquery()
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    query = query.order_by(Scenario.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def get_scenario(db: AsyncSession, scenario_id: str) -> Scenario:
    """Get a single scenario with eager-loaded HCP profile. Raises 404 if not found."""
    result = await db.execute(
        select(Scenario)
        .options(selectinload(Scenario.hcp_profile))
        .where(Scenario.id == scenario_id)
    )
    scenario = result.scalar_one_or_none()
    if scenario is None:
        not_found("Scenario not found")
    return scenario


async def update_scenario(db: AsyncSession, scenario_id: str, data: ScenarioUpdate) -> Scenario:
    """Update an existing scenario with partial data."""
    scenario = await get_scenario(db, scenario_id)
    update_data = data.model_dump(exclude_unset=True)

    # Serialize key_messages list to JSON string
    if "key_messages" in update_data and isinstance(update_data["key_messages"], list):
        update_data["key_messages"] = json.dumps(update_data["key_messages"])

    # If HCP profile ID is being changed, verify the new one exists
    if "hcp_profile_id" in update_data:
        await hcp_profile_service.get_hcp_profile(db, update_data["hcp_profile_id"])

    # Handle skill assignment change
    skill_changed = False
    if "skill_id" in update_data:
        new_skill_id = update_data["skill_id"]
        if new_skill_id != scenario.skill_id:
            skill_id, skill_version_id = await _validate_and_pin_skill(db, new_skill_id)
            update_data["skill_id"] = skill_id
            update_data["skill_version_id"] = skill_version_id
            skill_changed = True

    for field, value in update_data.items():
        setattr(scenario, field, value)

    await db.flush()
    await db.refresh(scenario)

    # Trigger agent re-sync if skill changed
    if skill_changed:
        await _trigger_agent_resync(db, scenario.hcp_profile_id)

    return scenario


async def delete_scenario(db: AsyncSession, scenario_id: str) -> None:
    """Delete a scenario by ID."""
    scenario = await get_scenario(db, scenario_id)
    await db.delete(scenario)
    await db.flush()


async def clone_scenario(db: AsyncSession, scenario_id: str, user_id: str) -> Scenario:
    """Clone an existing scenario with a new ID, name suffixed with (Copy), and draft status."""
    original = await get_scenario(db, scenario_id)

    clone = Scenario(
        name=f"{original.name} (Copy)",
        description=original.description,
        product=original.product,
        therapeutic_area=original.therapeutic_area,
        mode=original.mode,
        difficulty=original.difficulty,
        status="draft",
        hcp_profile_id=original.hcp_profile_id,
        key_messages=original.key_messages,
        skill_id=original.skill_id,
        skill_version_id=original.skill_version_id,
        weight_key_message=original.weight_key_message,
        weight_objection_handling=original.weight_objection_handling,
        weight_communication=original.weight_communication,
        weight_product_knowledge=original.weight_product_knowledge,
        weight_scientific_info=original.weight_scientific_info,
        pass_threshold=original.pass_threshold,
        created_by=user_id,
    )
    db.add(clone)
    await db.flush()
    await db.refresh(clone)
    return clone
