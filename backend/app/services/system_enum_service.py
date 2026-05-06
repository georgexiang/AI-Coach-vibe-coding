"""System enum service: CRUD operations for configurable enum values."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_enum import SystemEnum
from app.schemas.system_enum import SystemEnumCreate, SystemEnumUpdate
from app.utils.exceptions import not_found


async def get_enums_by_category(
    db: AsyncSession, category: str, active_only: bool = True
) -> list[SystemEnum]:
    """Get all enum values for a category, ordered by sort_order."""
    query = select(SystemEnum).where(SystemEnum.category == category)
    if active_only:
        query = query.where(SystemEnum.is_active == True)  # noqa: E712
    query = query.order_by(SystemEnum.sort_order, SystemEnum.label_en)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_all_enums(db: AsyncSession, active_only: bool = True) -> list[SystemEnum]:
    """Get all enum values across all categories."""
    query = select(SystemEnum)
    if active_only:
        query = query.where(SystemEnum.is_active == True)  # noqa: E712
    query = query.order_by(SystemEnum.category, SystemEnum.sort_order)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_enum(db: AsyncSession, data: SystemEnumCreate) -> SystemEnum:
    """Create a new enum value."""
    enum = SystemEnum(**data.model_dump())
    db.add(enum)
    await db.flush()
    await db.refresh(enum)
    return enum


async def update_enum(db: AsyncSession, enum_id: str, data: SystemEnumUpdate) -> SystemEnum:
    """Update an existing enum value."""
    result = await db.execute(select(SystemEnum).where(SystemEnum.id == enum_id))
    enum = result.scalar_one_or_none()
    if enum is None:
        not_found("System enum not found")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(enum, field, value)
    await db.flush()
    await db.refresh(enum)
    return enum


async def delete_enum(db: AsyncSession, enum_id: str) -> None:
    """Delete an enum value."""
    result = await db.execute(select(SystemEnum).where(SystemEnum.id == enum_id))
    enum = result.scalar_one_or_none()
    if enum is None:
        not_found("System enum not found")
    await db.delete(enum)
    await db.flush()
