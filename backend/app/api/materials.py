"""Training material management API endpoints."""

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.models.user import User
from app.schemas.material import (
    MaterialChunkOut,
    MaterialListOut,
    MaterialOut,
    MaterialUpdate,
    MaterialVersionOut,
)
from app.services import material_service
from app.utils.exceptions import bad_request
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


@router.post("/", response_model=MaterialOut, status_code=201)
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


# IMPORTANT: Static route /search BEFORE parameterized /{material_id} (Gotcha #3)
@router.get("/search", response_model=list[MaterialChunkOut])
async def search_chunks(
    product: str = Query(...),
    query: str = Query(""),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Search material chunks by product and text query. Admin only."""
    chunks = await material_service.search_chunks(db, product=product, query=query, limit=limit)
    return chunks


@router.get("/", response_model=PaginatedResponse[MaterialListOut])
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
    return PaginatedResponse.create(
        items=[MaterialListOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{material_id}", response_model=MaterialOut)
async def get_material(
    material_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Get a single material with version history. Admin only."""
    material = await material_service.get_material(db, material_id)
    return material


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


@router.get("/{material_id}/versions/{version_id}/chunks", response_model=list[MaterialChunkOut])
async def get_version_chunks(
    material_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Get text chunks for a specific material version. Admin only."""
    chunks = await material_service.get_version_chunks(db, version_id)
    return chunks
