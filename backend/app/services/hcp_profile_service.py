"""HCP Profile service: CRUD operations for Healthcare Professional profiles.

Includes automatic agent sync hooks: creating/updating/deleting HCP profiles
triggers corresponding AI Foundry Agent operations via agent_sync_service.
"""

import json

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hcp_profile import HcpProfile
from app.schemas.hcp_profile import HcpProfileCreate, HcpProfileUpdate
from app.services import agent_sync_service
from app.utils.exceptions import not_found

# JSON list fields that need serialization/deserialization
_JSON_LIST_FIELDS = ("expertise_areas", "objections", "probe_topics")


async def create_hcp_profile(db: AsyncSession, data: HcpProfileCreate, user_id: str) -> HcpProfile:
    """Create a new HCP profile."""
    # Pre-fetch config BEFORE any writes to avoid SQLite locking
    try:
        endpoint, model = await agent_sync_service.prefetch_sync_config(db)
    except Exception:
        endpoint, model = None, None

    profile_data = data.model_dump()
    profile_data["created_by"] = user_id

    # Serialize list fields to JSON strings
    for field in _JSON_LIST_FIELDS:
        if field in profile_data and isinstance(profile_data[field], list):
            profile_data[field] = json.dumps(profile_data[field])

    profile = HcpProfile(**profile_data)
    db.add(profile)
    await db.flush()
    await db.refresh(profile)

    # Auto-sync agent to AI Foundry (D-01, D-02)
    profile.agent_sync_status = "pending"
    await db.flush()
    try:
        result = await agent_sync_service.sync_agent_for_profile(
            db, profile, prefetched_endpoint=endpoint, prefetched_model=model
        )
        profile.agent_id = result.get("id", "")
        profile.agent_version = str(result.get("version", ""))
        profile.agent_sync_status = "synced"
        profile.agent_sync_error = ""
    except Exception as e:
        profile.agent_sync_status = "failed"
        profile.agent_sync_error = str(e)[:500]
    await db.flush()
    await db.refresh(profile)
    return profile


async def get_hcp_profiles(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    is_active: bool | None = None,
) -> tuple[list[HcpProfile], int]:
    """List HCP profiles with optional search and active filters."""
    query = select(HcpProfile)

    if search:
        search_filter = f"%{search}%"
        query = query.where(
            or_(
                HcpProfile.name.ilike(search_filter),
                HcpProfile.specialty.ilike(search_filter),
            )
        )

    if is_active is not None:
        query = query.where(HcpProfile.is_active == is_active)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    query = query.order_by(HcpProfile.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def get_hcp_profile(db: AsyncSession, profile_id: str) -> HcpProfile:
    """Get a single HCP profile by ID. Raises 404 if not found."""
    result = await db.execute(select(HcpProfile).where(HcpProfile.id == profile_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        not_found("HCP profile not found")
    return profile


async def update_hcp_profile(
    db: AsyncSession, profile_id: str, data: HcpProfileUpdate
) -> HcpProfile:
    """Update an existing HCP profile with partial data."""
    # Pre-fetch config BEFORE any writes to avoid SQLite locking
    try:
        endpoint, model = await agent_sync_service.prefetch_sync_config(db)
    except Exception:
        endpoint, model = None, None

    profile = await get_hcp_profile(db, profile_id)
    update_data = data.model_dump(exclude_unset=True)

    # Serialize list fields to JSON strings
    for field in _JSON_LIST_FIELDS:
        if field in update_data and isinstance(update_data[field], list):
            update_data[field] = json.dumps(update_data[field])

    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.flush()
    await db.refresh(profile)

    # Re-sync agent instructions on profile update (D-01)
    profile.agent_sync_status = "pending"
    await db.flush()
    try:
        result = await agent_sync_service.sync_agent_for_profile(
            db, profile, prefetched_endpoint=endpoint, prefetched_model=model
        )
        if not profile.agent_id and result.get("id"):
            profile.agent_id = result["id"]
        profile.agent_version = str(result.get("version", ""))
        profile.agent_sync_status = "synced"
        profile.agent_sync_error = ""
    except Exception as e:
        profile.agent_sync_status = "failed"
        profile.agent_sync_error = str(e)[:500]
    await db.flush()
    await db.refresh(profile)
    return profile


async def delete_hcp_profile(db: AsyncSession, profile_id: str) -> None:
    """Delete an HCP profile by ID."""
    profile = await get_hcp_profile(db, profile_id)

    # Delete corresponding AI Foundry Agent (D-01)
    if profile.agent_id:
        try:
            await agent_sync_service.delete_agent(db, profile.agent_id)
        except Exception:
            pass  # Agent deletion failure should not block profile deletion

    await db.delete(profile)
    await db.flush()


async def retry_agent_sync(db: AsyncSession, profile_id: str) -> HcpProfile:
    """Retry agent sync for a profile with failed sync status (D-11)."""
    # Pre-fetch config BEFORE any writes to avoid SQLite locking
    try:
        endpoint, model = await agent_sync_service.prefetch_sync_config(db)
    except Exception:
        endpoint, model = None, None

    profile = await get_hcp_profile(db, profile_id)
    profile.agent_sync_status = "pending"
    profile.agent_sync_error = ""
    await db.flush()
    try:
        result = await agent_sync_service.sync_agent_for_profile(
            db, profile, prefetched_endpoint=endpoint, prefetched_model=model
        )
        if result.get("id"):
            profile.agent_id = result["id"]
        profile.agent_version = str(result.get("version", ""))
        profile.agent_sync_status = "synced"
        profile.agent_sync_error = ""
    except Exception as e:
        profile.agent_sync_status = "failed"
        profile.agent_sync_error = str(e)[:500]
    await db.flush()
    await db.refresh(profile)
    return profile


async def batch_sync_agents(db: AsyncSession) -> dict:
    """Batch sync agents for all profiles with missing or failed agent_id.

    Returns summary dict with counts of synced/failed/skipped profiles.
    """
    # Pre-fetch config once for all syncs
    try:
        endpoint, model = await agent_sync_service.prefetch_sync_config(db)
    except Exception as e:
        return {"synced": 0, "failed": 0, "skipped": 0, "error": str(e)[:500]}

    # Find profiles needing sync
    result = await db.execute(
        select(HcpProfile).where(
            (HcpProfile.agent_id == "") | (HcpProfile.agent_id.is_(None))
            | (HcpProfile.agent_sync_status == "failed")
        )
    )
    profiles = list(result.scalars().all())

    synced = 0
    failed = 0
    for profile in profiles:
        profile.agent_sync_status = "pending"
        profile.agent_sync_error = ""
        await db.flush()
        try:
            sync_result = await agent_sync_service.sync_agent_for_profile(
                db, profile, prefetched_endpoint=endpoint, prefetched_model=model
            )
            if sync_result.get("id"):
                profile.agent_id = sync_result["id"]
            profile.agent_version = str(sync_result.get("version", ""))
            profile.agent_sync_status = "synced"
            profile.agent_sync_error = ""
            synced += 1
        except Exception as e:
            profile.agent_sync_status = "failed"
            profile.agent_sync_error = str(e)[:500]
            failed += 1
        await db.flush()

    return {"synced": synced, "failed": failed, "total": len(profiles)}
