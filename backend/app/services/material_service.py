"""Material service: CRUD, versioning, and file storage."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.material import MaterialVersion, TrainingMaterial
from app.schemas.material import MaterialUpdate
from app.services.storage import get_storage
from app.utils.exceptions import not_found


async def upload_material(
    db: AsyncSession,
    content: bytes,
    filename: str,
    content_type: str,
    product: str,
    name: str,
    tags: str = "",
    therapeutic_area: str = "",
    material_id: str | None = None,
    user_id: str = "",
) -> TrainingMaterial:
    """Upload a new material or new version of an existing material.

    If material_id is provided, creates a new version for the existing material.
    Otherwise, creates a new TrainingMaterial record.
    """
    if material_id:
        # Load existing material
        result = await db.execute(
            select(TrainingMaterial)
            .options(selectinload(TrainingMaterial.versions))
            .where(TrainingMaterial.id == material_id)
        )
        material = result.scalar_one_or_none()
        if material is None:
            not_found("Material not found")
        version_number = material.current_version + 1
    else:
        # Create new material
        material = TrainingMaterial(
            name=name,
            product=product,
            therapeutic_area=therapeutic_area,
            tags=tags,
            created_by=user_id,
            current_version=0,  # Will be updated below
        )
        db.add(material)
        await db.flush()
        version_number = 1

    # Store file via storage backend
    storage = get_storage()
    storage_url = await storage.save(
        f"materials/{material.id}/v{version_number}/{filename}", content
    )

    # Create version record
    version = MaterialVersion(
        material_id=material.id,
        version_number=version_number,
        filename=filename,
        file_size=len(content),
        content_type=content_type,
        storage_url=storage_url,
        is_active=True,
    )
    db.add(version)
    await db.flush()

    # Update material version counter
    material.current_version = version_number
    await db.flush()

    # Expunge and re-query to get fully loaded material with fresh versions
    material_id_ref = material.id
    db.expunge(material)

    refreshed = await db.execute(
        select(TrainingMaterial)
        .options(selectinload(TrainingMaterial.versions))
        .where(TrainingMaterial.id == material_id_ref)
    )
    return refreshed.scalar_one()


async def get_materials(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    product: str | None = None,
    search: str | None = None,
    include_archived: bool = False,
) -> tuple[list[TrainingMaterial], int]:
    """List materials with optional filters and pagination."""
    query = select(TrainingMaterial)

    if not include_archived:
        query = query.where(TrainingMaterial.is_archived == False)  # noqa: E712
    if product:
        query = query.where(TrainingMaterial.product == product)
    if search:
        query = query.where(TrainingMaterial.name.ilike(f"%{search}%"))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    query = query.order_by(TrainingMaterial.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def get_material(db: AsyncSession, material_id: str) -> TrainingMaterial:
    """Get a single material with versions. Raises 404 if not found."""
    result = await db.execute(
        select(TrainingMaterial)
        .options(selectinload(TrainingMaterial.versions))
        .where(TrainingMaterial.id == material_id)
    )
    material = result.scalar_one_or_none()
    if material is None:
        not_found("Material not found")
    return material


async def update_material(
    db: AsyncSession, material_id: str, data: MaterialUpdate
) -> TrainingMaterial:
    """Update material metadata (name, product, tags, etc.)."""
    material = await get_material(db, material_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(material, field, value)
    await db.flush()

    # Re-query to get fully loaded material with versions
    refreshed = await db.execute(
        select(TrainingMaterial)
        .options(selectinload(TrainingMaterial.versions))
        .where(TrainingMaterial.id == material_id)
    )
    return refreshed.scalar_one()


async def archive_material(db: AsyncSession, material_id: str) -> TrainingMaterial:
    """Soft-delete a material by setting is_archived=True."""
    material = await get_material(db, material_id)
    material.is_archived = True
    await db.flush()

    # Re-query to get fully loaded material with versions
    refreshed = await db.execute(
        select(TrainingMaterial)
        .options(selectinload(TrainingMaterial.versions))
        .where(TrainingMaterial.id == material_id)
    )
    return refreshed.scalar_one()


async def restore_material(db: AsyncSession, material_id: str) -> TrainingMaterial:
    """Restore a soft-deleted material by setting is_archived=False."""
    material = await get_material(db, material_id)
    material.is_archived = False
    await db.flush()

    # Re-query to get fully loaded material with versions
    refreshed = await db.execute(
        select(TrainingMaterial)
        .options(selectinload(TrainingMaterial.versions))
        .where(TrainingMaterial.id == material_id)
    )
    return refreshed.scalar_one()


async def get_versions(db: AsyncSession, material_id: str) -> list[MaterialVersion]:
    """Get all versions for a material, ordered by version_number descending."""
    # Verify material exists
    await get_material(db, material_id)
    result = await db.execute(
        select(MaterialVersion)
        .where(MaterialVersion.material_id == material_id)
        .order_by(MaterialVersion.version_number.desc())
    )
    return list(result.scalars().all())
