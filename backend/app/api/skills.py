"""Skill management API endpoints."""

import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.dependencies import get_db, require_role
from app.models.skill import Skill, SkillResource
from app.models.user import User
from app.schemas.skill import (
    SkillCreate,
    SkillListOut,
    SkillOut,
    SkillResourceOut,
    SkillUpdate,
)
from app.services import skill_conversion_service, skill_service
from app.services.skill_service import (
    MAX_FILES_PER_UPLOAD,
    MAX_RESOURCES_PER_SKILL,
    sanitize_filename,
    validate_file_upload,
)
from app.services.storage import get_storage
from app.utils.exceptions import bad_request, not_found
from app.utils.pagination import PaginatedResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/skills", tags=["skills"])

VALID_RESOURCE_TYPES = {"reference", "script", "asset"}


# ---------------------------------------------------------------------------
# Static routes FIRST (before /{skill_id})
# ---------------------------------------------------------------------------


@router.post("", response_model=SkillOut, status_code=201)
async def create_skill(
    data: SkillCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Create a new skill. Admin only."""
    skill = await skill_service.create_skill(db, data, user.id)
    return skill


@router.get("", response_model=PaginatedResponse[SkillListOut])
async def list_skills(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    product: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """List skills with optional filters. Admin only."""
    items, total = await skill_service.get_skills(
        db, page=page, page_size=page_size, status=status, product=product, search=search
    )
    return PaginatedResponse.create(
        items=[SkillListOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/published", response_model=PaginatedResponse[SkillListOut])
async def list_published_skills(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """List published skills only. Admin only."""
    items, total = await skill_service.get_published_skills(
        db, page=page, page_size=page_size, search=search
    )
    return PaginatedResponse.create(
        items=[SkillListOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Durable background conversion wrapper
# ---------------------------------------------------------------------------


async def _run_durable_conversion(skill_id: str, job_id: str) -> None:
    """Durable background conversion with own session and idempotency check."""
    async with AsyncSessionLocal() as session:
        try:
            # Idempotency: verify job_id still matches
            skill = await session.get(Skill, skill_id)
            if not skill or skill.conversion_job_id != job_id:
                logger.info("Conversion job %s superseded, skipping", job_id)
                return
            await skill_conversion_service.start_conversion(session, skill_id)
            await session.commit()
        except Exception as e:
            await session.rollback()
            # Mark as failed in a new session to ensure the error is persisted
            async with AsyncSessionLocal() as err_session:
                try:
                    skill = await err_session.get(Skill, skill_id)
                    if skill and skill.conversion_job_id == job_id:
                        skill.conversion_status = "failed"
                        skill.conversion_error = str(e)[:2000]
                        await err_session.commit()
                except Exception:
                    logger.error("Failed to record conversion error for %s", skill_id)
            logger.error("Conversion task failed for %s: %s", skill_id, e)


# ---------------------------------------------------------------------------
# Request schemas for conversion endpoints
# ---------------------------------------------------------------------------


class RegenerateSopRequest(BaseModel):
    """Request body for AI feedback SOP regeneration."""

    feedback: str


# ---------------------------------------------------------------------------
# Conversion and regeneration endpoints (before /{skill_id} per Gotcha #3)
# ---------------------------------------------------------------------------


@router.post("/{skill_id}/convert")
async def convert_skill(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Start material-to-SOP conversion. Admin only. Returns 202 Accepted."""
    skill = await skill_service.get_skill(db, skill_id)

    # Verify at least one reference resource exists
    ref_result = await db.execute(
        select(SkillResource).where(
            SkillResource.skill_id == skill_id,
            SkillResource.resource_type == "reference",
        )
    )
    refs = list(ref_result.scalars().all())
    if not refs:
        bad_request("No reference materials found. Upload at least one reference file first.")

    if skill.conversion_status == "processing":
        bad_request("Conversion already in progress")

    # Generate job_id for idempotency
    job_id = str(uuid.uuid4())
    skill.conversion_status = "pending"
    skill.conversion_job_id = job_id
    skill.conversion_error = ""
    await db.flush()

    # Commit before launching background task so the task sees the pending state
    await db.commit()

    asyncio.create_task(_run_durable_conversion(skill_id, job_id))

    return JSONResponse(
        status_code=202,
        content={"status": "pending", "job_id": job_id},
    )


@router.post("/{skill_id}/retry-conversion")
async def retry_conversion(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Retry a failed conversion without re-uploading materials. Admin only."""
    skill = await skill_service.get_skill(db, skill_id)

    if skill.conversion_status not in ("failed", None):
        bad_request(f"Can only retry failed conversions. Current status: {skill.conversion_status}")

    # Generate new job_id
    job_id = str(uuid.uuid4())
    skill.conversion_status = "pending"
    skill.conversion_job_id = job_id
    skill.conversion_error = ""
    await db.flush()
    await db.commit()

    asyncio.create_task(_run_durable_conversion(skill_id, job_id))

    return JSONResponse(
        status_code=202,
        content={"status": "pending", "job_id": job_id},
    )


@router.get("/{skill_id}/conversion-status")
async def get_conversion_status(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Poll conversion status. Admin only."""
    skill = await skill_service.get_skill(db, skill_id)
    return {
        "conversion_status": skill.conversion_status,
        "conversion_error": skill.conversion_error,
        "conversion_job_id": skill.conversion_job_id,
    }


@router.post("/{skill_id}/upload-and-convert")
async def upload_and_convert(
    skill_id: str,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Upload reference files and trigger conversion. Max 10 files. Admin only."""
    skill = await skill_service.get_skill(db, skill_id)

    if len(files) > MAX_FILES_PER_UPLOAD:
        bad_request(f"Maximum {MAX_FILES_PER_UPLOAD} files per upload")

    # Check existing resource count
    count_result = await db.execute(select(SkillResource).where(SkillResource.skill_id == skill_id))
    existing_count = len(count_result.scalars().all())
    if existing_count + len(files) > MAX_RESOURCES_PER_SKILL:
        bad_request(f"Maximum {MAX_RESOURCES_PER_SKILL} resources per skill")

    storage = get_storage()

    # Upload each file as a reference resource
    for file in files:
        if not file.filename:
            bad_request("File name is required")
        safe_filename = sanitize_filename(file.filename)

        content = await file.read()
        file_size = len(content)
        validate_file_upload(safe_filename, file_size)

        storage_path = f"skills/{skill_id}/references/{safe_filename}"
        await storage.save(storage_path, content)

        ext = safe_filename.rsplit(".", 1)[-1].lower() if "." in safe_filename else ""
        content_type_map = {
            "pdf": "application/pdf",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "txt": "text/plain",
            "md": "text/markdown",
        }
        content_type = content_type_map.get(ext, file.content_type or "application/octet-stream")

        resource = SkillResource(
            skill_id=skill_id,
            resource_type="reference",
            filename=safe_filename,
            storage_path=storage_path,
            content_type=content_type,
            file_size=file_size,
        )
        db.add(resource)

    # Trigger conversion
    job_id = str(uuid.uuid4())
    skill.conversion_status = "pending"
    skill.conversion_job_id = job_id
    skill.conversion_error = ""
    await db.flush()
    await db.commit()

    asyncio.create_task(_run_durable_conversion(skill_id, job_id))

    return JSONResponse(
        status_code=202,
        content={"status": "pending", "job_id": job_id, "files_uploaded": len(files)},
    )


@router.post("/{skill_id}/regenerate-sop", response_model=SkillOut)
async def regenerate_sop(
    skill_id: str,
    body: RegenerateSopRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """AI feedback SOP regeneration. Admin only."""
    if not body.feedback or not body.feedback.strip():
        bad_request("Feedback is required")
    if len(body.feedback) > 5000:
        bad_request("Feedback must be 5000 characters or less")

    skill = await skill_conversion_service.regenerate_sop_with_feedback(db, skill_id, body.feedback)
    return skill


# ---------------------------------------------------------------------------
# Parameterized routes
# ---------------------------------------------------------------------------


@router.get("/{skill_id}", response_model=SkillOut)
async def get_skill(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Get a single skill with versions and resources. Admin only."""
    skill = await skill_service.get_skill(db, skill_id)
    return skill


@router.put("/{skill_id}", response_model=SkillOut)
async def update_skill(
    skill_id: str,
    data: SkillUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Update skill metadata. Admin only."""
    skill = await skill_service.update_skill(db, skill_id, data, user.id)
    return skill


@router.delete("/{skill_id}", status_code=204)
async def delete_skill(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Delete a draft or failed skill. Admin only."""
    await skill_service.delete_skill(db, skill_id)
    return Response(status_code=204)


@router.post("/{skill_id}/publish", response_model=SkillOut)
async def publish_skill(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Publish a skill after quality gate checks. Admin only."""
    skill = await skill_service.publish_skill(db, skill_id, user.id)
    return skill


@router.post("/{skill_id}/archive", response_model=SkillOut)
async def archive_skill(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Archive a published skill. Admin only."""
    skill = await skill_service.archive_skill(db, skill_id, user.id)
    return skill


@router.post("/{skill_id}/restore", response_model=SkillOut)
async def restore_skill(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Restore an archived or failed skill to draft. Admin only."""
    skill = await skill_service.restore_skill(db, skill_id, user.id)
    return skill


@router.post("/{skill_id}/new-version", response_model=SkillOut)
async def create_new_version(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Create a new draft version from a published skill. Admin only."""
    skill = await skill_service.create_new_version(db, skill_id, user.id)
    return skill


# ---------------------------------------------------------------------------
# Resource routes with file security
# ---------------------------------------------------------------------------


@router.post("/{skill_id}/resources", response_model=SkillResourceOut, status_code=201)
async def upload_resource(
    skill_id: str,
    file: UploadFile = File(...),
    resource_type: str = Query(..., pattern="^(reference|script|asset)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Upload a resource file to a skill. Admin only."""
    # Verify skill exists
    await skill_service.get_skill(db, skill_id)

    # Validate resource_type
    if resource_type not in VALID_RESOURCE_TYPES:
        bad_request(f"Invalid resource_type. Must be one of: {VALID_RESOURCE_TYPES}")

    # Validate filename
    if not file.filename:
        bad_request("File name is required")
    safe_filename = sanitize_filename(file.filename)

    # Read content
    content = await file.read()
    file_size = len(content)

    # Validate extension and size
    validate_file_upload(safe_filename, file_size)

    # Check resource count limit
    count_result = await db.execute(select(SkillResource).where(SkillResource.skill_id == skill_id))
    existing_count = len(count_result.scalars().all())
    if existing_count >= MAX_RESOURCES_PER_SKILL:
        bad_request(f"Maximum {MAX_RESOURCES_PER_SKILL} resources per skill")

    # Store file
    storage_path = f"skills/{skill_id}/{resource_type}s/{safe_filename}"
    storage = get_storage()
    await storage.save(storage_path, content)

    # Determine content type from extension
    ext = safe_filename.rsplit(".", 1)[-1].lower() if "." in safe_filename else ""
    content_type_map = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "txt": "text/plain",
        "md": "text/markdown",
        "py": "text/x-python",
        "json": "application/json",
        "csv": "text/csv",
    }
    content_type = content_type_map.get(ext, file.content_type or "application/octet-stream")

    # Create resource record
    resource = SkillResource(
        skill_id=skill_id,
        resource_type=resource_type,
        filename=safe_filename,
        storage_path=storage_path,
        content_type=content_type,
        file_size=file_size,
    )
    db.add(resource)
    await db.flush()

    return resource


@router.get("/{skill_id}/resources", response_model=list[SkillResourceOut])
async def list_resources(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """List all resources for a skill. Admin only."""
    # Verify skill exists
    await skill_service.get_skill(db, skill_id)

    result = await db.execute(
        select(SkillResource)
        .where(SkillResource.skill_id == skill_id)
        .order_by(SkillResource.created_at.desc())
    )
    return list(result.scalars().all())


@router.delete("/{skill_id}/resources/{resource_id}", status_code=204)
async def delete_resource(
    skill_id: str,
    resource_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Delete a resource from a skill. Admin only."""
    result = await db.execute(
        select(SkillResource).where(
            SkillResource.id == resource_id,
            SkillResource.skill_id == skill_id,
        )
    )
    resource = result.scalar_one_or_none()
    if resource is None:
        not_found("Resource not found")

    # Delete file from storage
    storage = get_storage()
    try:
        await storage.delete(resource.storage_path)
    except Exception:
        pass  # Best-effort file cleanup

    await db.delete(resource)
    await db.flush()
    return Response(status_code=204)


@router.get(
    "/{skill_id}/resources/{resource_id}/download",
    responses={200: {"content": {"application/octet-stream": {}}}},
)
async def download_resource(
    skill_id: str,
    resource_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Download a resource file. Never exposes storage_path. Admin only."""
    result = await db.execute(
        select(SkillResource).where(
            SkillResource.id == resource_id,
            SkillResource.skill_id == skill_id,
        )
    )
    resource = result.scalar_one_or_none()
    if resource is None:
        not_found("Resource not found")

    storage = get_storage()
    if not await storage.exists(resource.storage_path):
        not_found("File not found in storage")

    content = await storage.read(resource.storage_path)
    disposition = f'attachment; filename="{resource.filename}"'

    return Response(
        content=content,
        media_type=resource.content_type or "application/octet-stream",
        headers={"Content-Disposition": disposition},
    )
