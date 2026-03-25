"""Material service: CRUD, versioning, text extraction, chunk search."""

import asyncio

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.material import MaterialChunk, MaterialVersion, TrainingMaterial
from app.schemas.material import MaterialUpdate
from app.services.storage import get_storage
from app.services.text_extractor import extract_text
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
    Text is extracted from the file and stored as searchable chunks.
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

    # Extract text in thread to avoid blocking event loop (CPU-bound)
    pages = await asyncio.to_thread(extract_text, content, content_type)

    # Create chunks
    for i, (page_label, text) in enumerate(pages):
        chunk = MaterialChunk(
            version_id=version.id,
            material_id=material.id,
            chunk_index=i,
            content=text,
            page_label=page_label,
        )
        db.add(chunk)

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


async def get_version_chunks(db: AsyncSession, version_id: str) -> list[MaterialChunk]:
    """Get all chunks for a specific version, ordered by chunk_index."""
    result = await db.execute(
        select(MaterialChunk)
        .where(MaterialChunk.version_id == version_id)
        .order_by(MaterialChunk.chunk_index)
    )
    return list(result.scalars().all())


async def search_chunks(
    db: AsyncSession,
    product: str,
    query: str = "",
    limit: int = 10,
) -> list[MaterialChunk]:
    """Search material chunks by product and optional text query.

    Only returns chunks from the latest active version of each material.
    """
    # Subquery: get the max version_number per material_id where is_active=True
    latest_version_sq = (
        select(
            MaterialVersion.material_id,
            func.max(MaterialVersion.version_number).label("max_version"),
        )
        .where(MaterialVersion.is_active == True)  # noqa: E712
        .group_by(MaterialVersion.material_id)
        .subquery()
    )

    # Join to get the version IDs of the latest active versions
    latest_version_ids = (
        select(MaterialVersion.id)
        .join(
            latest_version_sq,
            (MaterialVersion.material_id == latest_version_sq.c.material_id)
            & (MaterialVersion.version_number == latest_version_sq.c.max_version),
        )
        .subquery()
    )

    chunk_query = (
        select(MaterialChunk)
        .join(MaterialVersion, MaterialChunk.version_id == MaterialVersion.id)
        .join(TrainingMaterial, MaterialChunk.material_id == TrainingMaterial.id)
        .where(
            TrainingMaterial.product == product,
            TrainingMaterial.is_archived == False,  # noqa: E712
            MaterialChunk.version_id.in_(select(latest_version_ids.c.id)),
        )
    )

    if query:
        chunk_query = chunk_query.where(MaterialChunk.content.ilike(f"%{query}%"))

    chunk_query = chunk_query.limit(limit)
    result = await db.execute(chunk_query)
    return list(result.scalars().all())


async def get_material_context(
    db: AsyncSession,
    product: str,
    limit: int = 20,
) -> list[str]:
    """Get material chunk contents for a product (for RAG prompt injection).

    Convenience function that returns plain text chunks from the latest
    active version of each material matching the product.
    """
    chunks = await search_chunks(db, product=product, query="", limit=limit)
    return [chunk.content for chunk in chunks]
