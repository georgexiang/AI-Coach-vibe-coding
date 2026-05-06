"""SystemEnum service: CRUD operations for configurable enum values."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_enum import SystemEnum
from app.schemas.system_enum import SystemEnumCreate, SystemEnumUpdate
from app.utils.exceptions import bad_request, not_found


async def get_enums_by_category(
    db: AsyncSession, category: str, active_only: bool = True
) -> list[SystemEnum]:
    """Get all enum values for a given category, ordered by sort_order."""
    query = select(SystemEnum).where(SystemEnum.category == category)
    if active_only:
        query = query.where(SystemEnum.is_active == True)  # noqa: E712
    query = query.order_by(SystemEnum.sort_order, SystemEnum.label_en)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_all_categories(db: AsyncSession) -> list[str]:
    """Get all distinct categories."""
    result = await db.execute(select(SystemEnum.category).distinct().order_by(SystemEnum.category))
    return list(result.scalars().all())


async def create_enum(db: AsyncSession, data: SystemEnumCreate) -> SystemEnum:
    """Create a new enum value."""
    existing = await db.execute(
        select(SystemEnum).where(
            SystemEnum.category == data.category,
            SystemEnum.value == data.value,
        )
    )
    if existing.scalar_one_or_none():
        bad_request(f"Enum value '{data.value}' already exists in category '{data.category}'")

    enum_item = SystemEnum(**data.model_dump())
    db.add(enum_item)
    await db.flush()
    await db.refresh(enum_item)
    return enum_item


async def update_enum(db: AsyncSession, enum_id: str, data: SystemEnumUpdate) -> SystemEnum:
    """Update an existing enum value."""
    result = await db.execute(select(SystemEnum).where(SystemEnum.id == enum_id))
    enum_item = result.scalar_one_or_none()
    if not enum_item:
        not_found("Enum value not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(enum_item, field, value)

    await db.flush()
    await db.refresh(enum_item)
    return enum_item


async def delete_enum(db: AsyncSession, enum_id: str) -> None:
    """Delete an enum value."""
    result = await db.execute(select(SystemEnum).where(SystemEnum.id == enum_id))
    enum_item = result.scalar_one_or_none()
    if not enum_item:
        not_found("Enum value not found")
    await db.delete(enum_item)
    await db.flush()
