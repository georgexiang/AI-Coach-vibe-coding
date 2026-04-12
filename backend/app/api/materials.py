"""Training material management API endpoints."""

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.models.skill import Skill, SkillSourceMaterial
from app.models.user import User
from app.schemas.material import (
    DerivedSkillInfo,
    MaterialListOut,
    MaterialOut,
    MaterialUpdate,
    MaterialVersionOut,
)
from app.services import material_service
from app.services.storage import get_storage
from app.utils.exceptions import bad_request, not_found
from app.utils.pagination import PaginatedResponse

router = APIRouter(prefix="/materials", tags=["materials"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".xlsx"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# MIME type mapping for content type detection
EXTENSION_MIME_MAP = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


@router.post("", response_model=MaterialOut, status_code=201)
async def upload_material(
    file: UploadFile = File(...),
    product: str = Form(...),
    name: str = Form(...),
    therapeutic_area: str = Form(""),
    tags: str = Form(""),
    material_id: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Upload a new material or new version of an existing material. Admin only."""
    # Validate file extension
    if not file.filename:
        bad_request("File name is required")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        bad_request(f"File type '{ext}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        bad_request(f"File size exceeds maximum of {MAX_FILE_SIZE // (1024 * 1024)}MB")

    # Determine content type from extension (more reliable than upload MIME)
    content_type = EXTENSION_MIME_MAP.get(ext, file.content_type or "application/octet-stream")

    material = await material_service.upload_material(
        db=db,
        content=content,
        filename=file.filename,
        content_type=content_type,
        product=product,
        name=name,
        tags=tags,
        therapeutic_area=therapeutic_area,
        material_id=material_id,
        user_id=user.id,
    )
    return material


@router.get(
    "/{material_id}/versions/{version_id}/download",
    responses={200: {"content": {"application/octet-stream": {}}}},
)
async def download_version(
    material_id: str,
    version_id: str,
    mode: str = Query("attachment", pattern="^(inline|attachment)$"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Download a material version file. Admin only.

    Query params:
        mode: 'inline' for browser preview (PDF), 'attachment' for download.
    """
    from sqlalchemy import select

    from app.models.material import MaterialVersion

    result = await db.execute(
        select(MaterialVersion).where(
            MaterialVersion.id == version_id,
            MaterialVersion.material_id == material_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        not_found("Material version not found")

    # Reconstruct relative storage path
    storage_path = f"materials/{material_id}/v{version.version_number}/{version.filename}"
    storage = get_storage()

    if not await storage.exists(storage_path):
        not_found("File not found in storage")

    content = await storage.read(storage_path)
    disposition = f'{mode}; filename="{version.filename}"'

    return Response(
        content=content,
        media_type=version.content_type,
        headers={"Content-Disposition": disposition},
    )


@router.get("", response_model=PaginatedResponse[MaterialListOut])
async def list_materials(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    product: str | None = Query(None),
    search: str | None = Query(None),
    include_archived: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """List training materials with optional filters. Admin only."""
    items, total = await material_service.get_materials(
        db,
        page=page,
        page_size=page_size,
        product=product,
        search=search,
        include_archived=include_archived,
    )
    # Batch-fetch derived skill counts
    material_ids = [item.id for item in items]
    counts = await _get_derived_skill_counts(db, material_ids)

    validated = []
    for item in items:
        out = MaterialListOut.model_validate(item)
        out.derived_skill_count = counts.get(item.id, 0)
        validated.append(out)

    return PaginatedResponse.create(
        items=validated,
        total=total,
        page=page,
        page_size=page_size,
    )


async def _get_derived_skills(db: AsyncSession, material_id: str) -> list[dict]:
    """Query skills derived from this material."""
    result = await db.execute(
        select(Skill.id, Skill.name, Skill.status)
        .join(SkillSourceMaterial, SkillSourceMaterial.skill_id == Skill.id)
        .where(SkillSourceMaterial.material_id == material_id)
    )
    return [{"id": r.id, "name": r.name, "status": r.status} for r in result.all()]


async def _get_derived_skill_counts(db: AsyncSession, material_ids: list[str]) -> dict[str, int]:
    """Batch query derived skill counts for a list of materials."""
    if not material_ids:
        return {}
    result = await db.execute(
        select(SkillSourceMaterial.material_id, func.count(SkillSourceMaterial.skill_id))
        .where(SkillSourceMaterial.material_id.in_(material_ids))
        .group_by(SkillSourceMaterial.material_id)
    )
    return {row[0]: row[1] for row in result.all()}


@router.get("/{material_id}", response_model=MaterialOut)
async def get_material(
    material_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Get a single material with version history. Admin only."""
    material = await material_service.get_material(db, material_id)
    result = MaterialOut.model_validate(material)
    result.derived_skills = [
        DerivedSkillInfo(**s) for s in await _get_derived_skills(db, material_id)
    ]
    return result


@router.put("/{material_id}", response_model=MaterialOut)
async def update_material(
    material_id: str,
    data: MaterialUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Update material metadata. Admin only."""
    material = await material_service.update_material(db, material_id, data)
    return material


@router.delete("/{material_id}", status_code=204)
async def archive_material(
    material_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Archive a material (soft delete). Admin only."""
    await material_service.archive_material(db, material_id)
    return Response(status_code=204)


@router.post("/{material_id}/restore", response_model=MaterialOut)
async def restore_material(
    material_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Restore an archived material. Admin only."""
    material = await material_service.restore_material(db, material_id)
    return material


@router.get("/{material_id}/versions", response_model=list[MaterialVersionOut])
async def list_versions(
    material_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """List all versions of a material. Admin only."""
    versions = await material_service.get_versions(db, material_id)
    return versions
