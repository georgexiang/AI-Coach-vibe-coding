"""Skill management API endpoints."""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.dependencies import get_db, require_role
from app.models.skill import SkillResource
from app.models.user import User
from app.schemas.skill import (
    SkillCreate,
    SkillListOut,
    SkillOut,
    SkillResourceOut,
    SkillUpdate,
    StructureCheckOut,
)
from app.services import skill_evaluation_service, skill_service
from app.services.skill_service import (
    MAX_RESOURCES_PER_SKILL,
    sanitize_filename,
    validate_file_upload,
)
from app.services.skill_validation_service import check_skill_structure, to_dict
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
# Quality gate routes (L1 structure check + L2 AI evaluation)
# ---------------------------------------------------------------------------


@router.post("/{skill_id}/check-structure", response_model=StructureCheckOut)
async def run_structure_check(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Run L1 structure check on a skill. Instant, rule-based. Admin only."""
    skill = await skill_service.get_skill(db, skill_id)
    result = await check_skill_structure(skill)

    # Update skill with check results
    skill.structure_check_passed = result.passed
    skill.structure_check_details = json.dumps(to_dict(result), ensure_ascii=False)
    await db.flush()

    return StructureCheckOut(
        passed=result.passed,
        score=result.score,
        issues=[
            {
                "severity": issue.severity,
                "dimension": issue.dimension,
                "message": issue.message,
                "suggestion": issue.suggestion,
            }
            for issue in result.issues
        ],
    )


@router.post("/{skill_id}/evaluate-quality")
async def run_quality_evaluation(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Trigger L2 AI quality evaluation (async background task). Admin only.

    Returns 202 Accepted immediately. Poll GET /{skill_id}/evaluation for results.
    """
    # Verify skill exists
    await skill_service.get_skill(db, skill_id)

    async def _run_evaluation(sid: str) -> None:
        """Durable background evaluation task with its own DB session."""
        async with AsyncSessionLocal() as session:
            try:
                await skill_evaluation_service.evaluate_skill_quality(session, sid)
                await session.commit()
            except Exception as e:
                await session.rollback()
                logger.error("L2 evaluation failed for skill %s: %s", sid, e, exc_info=True)

    asyncio.create_task(_run_evaluation(skill_id))
    return JSONResponse(status_code=202, content={"status": "evaluating"})


@router.get("/{skill_id}/evaluation")
async def get_evaluation_results(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Get combined L1 + L2 evaluation results with staleness indicator. Admin only."""
    skill = await skill_service.get_skill(db, skill_id)

    # Parse stored details
    try:
        structure_details = json.loads(skill.structure_check_details or "{}")
    except (json.JSONDecodeError, TypeError):
        structure_details = {}

    try:
        quality_details = json.loads(skill.quality_details or "{}")
    except (json.JSONDecodeError, TypeError):
        quality_details = {}

    # Staleness check
    is_stale = skill_evaluation_service.is_evaluation_stale(skill)

    return {
        "structure_check": {
            "passed": skill.structure_check_passed,
            "details": structure_details,
        },
        "quality": {
            "score": skill.quality_score,
            "verdict": skill.quality_verdict,
            "details": quality_details,
            "is_stale": is_stale,
        },
    }


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
