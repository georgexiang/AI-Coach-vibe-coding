"""Voice Live Instance CRUD service.

Manages reusable Voice Live configuration instances that can be
assigned to HCP Profiles. Provides config resolution that prefers
VoiceLiveInstance over deprecated inline HcpProfile voice fields.
"""

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.hcp_profile import HcpProfile
from app.models.voice_live_instance import VoiceLiveInstance
from app.schemas.voice_live_instance import (
    VoiceLiveInstanceCreate,
    VoiceLiveInstanceUpdate,
)
from app.utils.exceptions import NotFoundException

logger = logging.getLogger(__name__)


async def create_instance(
    db: AsyncSession,
    data: VoiceLiveInstanceCreate,
    user_id: str,
) -> VoiceLiveInstance:
    """Create a new Voice Live configuration instance."""
    instance_data = data.model_dump()
    instance_data["created_by"] = user_id
    instance = VoiceLiveInstance(**instance_data)
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    logger.info("VL instance created: id=%s, name=%s", instance.id, instance.name)
    # Re-query with selectinload so hcp_profiles is available in async context
    return await get_instance(db, instance.id)


async def get_instance(db: AsyncSession, instance_id: str) -> VoiceLiveInstance:
    """Get a Voice Live Instance by ID. Raises NotFoundException if not found."""
    result = await db.execute(
        select(VoiceLiveInstance)
        .options(selectinload(VoiceLiveInstance.hcp_profiles))
        .where(VoiceLiveInstance.id == instance_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise NotFoundException(message=f"Voice Live Instance {instance_id} not found")
    return instance


async def list_instances(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[VoiceLiveInstance], int]:
    """List all Voice Live Instances with pagination. Returns (items, total)."""
    # Count
    count_q = select(func.count()).select_from(VoiceLiveInstance)
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch with eager-loaded hcp_profiles for hcp_count
    offset = (page - 1) * page_size
    query = (
        select(VoiceLiveInstance)
        .options(selectinload(VoiceLiveInstance.hcp_profiles))
        .order_by(VoiceLiveInstance.updated_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_instance(
    db: AsyncSession,
    instance_id: str,
    data: VoiceLiveInstanceUpdate,
) -> VoiceLiveInstance:
    """Update a Voice Live Instance. Raises NotFoundException if not found."""
    instance = await get_instance(db, instance_id)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(instance, key, value)
    await db.commit()
    await db.refresh(instance)
    logger.info(
        "VL instance updated: id=%s, fields=%s",
        instance_id,
        list(update_data.keys()),
    )
    # Re-query with selectinload so hcp_profiles is available in async context
    return await get_instance(db, instance.id)


async def delete_instance(db: AsyncSession, instance_id: str) -> None:
    """Delete a Voice Live Instance. Auto-unassigns HCPs before deleting."""
    instance = await get_instance(db, instance_id)

    # Auto-unassign all HCP profiles referencing this instance
    if instance.hcp_profiles:
        for profile in instance.hcp_profiles:
            profile.voice_live_instance_id = None
        await db.flush()

    await db.delete(instance)
    await db.commit()
    logger.info("VL instance deleted: id=%s", instance_id)


async def assign_to_hcp(
    db: AsyncSession,
    instance_id: str,
    hcp_profile_id: str,
) -> HcpProfile:
    """Assign a Voice Live Instance to an HCP Profile."""
    # Verify instance exists
    await get_instance(db, instance_id)

    # Load HCP profile
    result = await db.execute(select(HcpProfile).where(HcpProfile.id == hcp_profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise NotFoundException(message=f"HCP Profile {hcp_profile_id} not found")

    profile.voice_live_instance_id = instance_id
    await db.commit()
    await db.refresh(profile)
    logger.info("VL instance assigned: instance=%s, hcp=%s", instance_id, hcp_profile_id)
    # Expire cached instance so subsequent get_instance fetches fresh hcp_profiles
    db.expire_all()
    return profile


async def unassign_from_hcp(db: AsyncSession, hcp_profile_id: str) -> HcpProfile:
    """Remove Voice Live Instance association from an HCP Profile."""
    result = await db.execute(select(HcpProfile).where(HcpProfile.id == hcp_profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise NotFoundException(message=f"HCP Profile {hcp_profile_id} not found")

    profile.voice_live_instance_id = None
    await db.commit()
    await db.refresh(profile)
    logger.info("VL instance unassigned: hcp=%s", hcp_profile_id)
    return profile


def resolve_voice_config(profile: HcpProfile) -> dict:
    """Resolve voice/avatar config for an HCP Profile.

    Priority: VoiceLiveInstance > inline HcpProfile fields (deprecated).
    Returns a flat dict of all voice/avatar configuration fields.
    """
    inst = profile.voice_live_instance
    if inst:
        logger.debug(
            "resolve_voice_config: hcp=%s source=VoiceLiveInstance id=%s",
            profile.id,
            inst.id,
        )
        return {
            "voice_live_enabled": inst.enabled,
            "voice_live_model": inst.voice_live_model,
            "voice_name": inst.voice_name,
            "voice_type": inst.voice_type,
            "voice_temperature": inst.voice_temperature,
            "voice_custom": inst.voice_custom,
            "avatar_character": inst.avatar_character,
            "avatar_style": inst.avatar_style,
            "avatar_customized": inst.avatar_customized,
            "turn_detection_type": inst.turn_detection_type,
            "noise_suppression": inst.noise_suppression,
            "echo_cancellation": inst.echo_cancellation,
            "eou_detection": inst.eou_detection,
            "recognition_language": inst.recognition_language,
            "agent_instructions_override": inst.agent_instructions_override,
            # AI Foundry Playground fields (n17a)
            "response_temperature": inst.response_temperature,
            "proactive_engagement": inst.proactive_engagement,
            "auto_detect_language": inst.auto_detect_language,
            "playback_speed": inst.playback_speed,
            "custom_lexicon_enabled": inst.custom_lexicon_enabled,
            "custom_lexicon_url": inst.custom_lexicon_url,
            "avatar_enabled": inst.avatar_enabled,
        }

    # Fallback: deprecated inline fields (no Foundry-specific fields on HcpProfile)
    logger.debug(
        "resolve_voice_config: hcp=%s source=inline (no VoiceLiveInstance)",
        profile.id,
    )
    return {
        "voice_live_enabled": profile.voice_live_enabled,
        "voice_live_model": profile.voice_live_model,
        "voice_name": profile.voice_name,
        "voice_type": profile.voice_type,
        "voice_temperature": profile.voice_temperature,
        "voice_custom": profile.voice_custom,
        "avatar_character": profile.avatar_character,
        "avatar_style": profile.avatar_style,
        "avatar_customized": profile.avatar_customized,
        "turn_detection_type": profile.turn_detection_type,
        "noise_suppression": profile.noise_suppression,
        "echo_cancellation": profile.echo_cancellation,
        "eou_detection": profile.eou_detection,
        "recognition_language": profile.recognition_language,
        "agent_instructions_override": profile.agent_instructions_override,
        "response_temperature": 0.8,
        "proactive_engagement": True,
        "auto_detect_language": True,
        "playback_speed": 1.0,
        "custom_lexicon_enabled": False,
        "custom_lexicon_url": "",
        "avatar_enabled": True,
    }
