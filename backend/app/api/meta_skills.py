"""Meta Skill configuration API endpoints."""

import logging

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.models.user import User
from app.schemas.meta_skill import (
    MetaSkillRead,
    MetaSkillResourceOut,
    MetaSkillSyncResponse,
    MetaSkillUpdate,
)
from app.services import meta_skill_service
from app.utils.exceptions import not_found

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meta-skills", tags=["meta-skills"])


# --- Static routes (before /{skill_type} to avoid capture) ---


@router.get("", response_model=list[MetaSkillRead])
async def list_meta_skills(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """List all meta skill configurations."""
    return await meta_skill_service.get_all_meta_skills(db)


# --- Parameterized routes ---


@router.get("/{skill_type}/export")
async def export_meta_skill_zip(
    skill_type: str,
    _user: User = Depends(require_role("admin")),
):
    """Export a meta-skill as a ZIP archive containing SKILL.md + resources."""
    result = meta_skill_service.export_meta_skill_zip(skill_type)
    if result is None:
        not_found(f"Meta skill type '{skill_type}' not found or has no files")
    zip_filename, zip_bytes = result
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
    )


@router.get("/{skill_type}/resources", response_model=list[MetaSkillResourceOut])
async def list_meta_skill_resources(
    skill_type: str,
    _user: User = Depends(require_role("admin")),
):
    """List bundled reference and script files for a meta-skill type."""
    resources = meta_skill_service.list_meta_skill_resources(skill_type)
    if not resources and skill_type not in ("creator", "evaluator"):
        not_found(f"Meta skill type '{skill_type}' not found")
    return resources


@router.get("/{skill_type}/resources/{resource_type}/{filename:path}")
async def download_meta_skill_resource(
    skill_type: str,
    resource_type: str,
    filename: str,
    _user: User = Depends(require_role("admin")),
):
    """Download a specific bundled resource file."""
    result = meta_skill_service.get_meta_skill_resource_content(
        skill_type,
        resource_type,
        filename,
    )
    if result is None:
        not_found(f"Resource '{filename}' not found for meta-skill '{skill_type}'")
    content_type, file_bytes = result
    return Response(
        content=file_bytes,
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/{skill_type}", response_model=MetaSkillRead)
async def get_meta_skill(
    skill_type: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Get a specific meta skill configuration by type ('creator' or 'evaluator')."""
    meta = await meta_skill_service.get_meta_skill(db, skill_type)
    if not meta:
        not_found(f"Meta skill '{skill_type}' not found")
    return meta


@router.put("/{skill_type}", response_model=MetaSkillRead)
async def update_meta_skill(
    skill_type: str,
    body: MetaSkillUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Update a meta skill configuration (model, template, language, active state)."""
    meta = await meta_skill_service.update_meta_skill(
        db,
        skill_type,
        model=body.model,
        template_content=body.template_content,
        template_language=body.template_language,
        is_active=body.is_active,
    )
    if not meta:
        not_found(f"Meta skill '{skill_type}' not found")
    return meta


@router.post("/{skill_type}/sync", response_model=MetaSkillSyncResponse)
async def sync_meta_skill_agent(
    skill_type: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Sync the meta skill agent to Azure AI Foundry (create or update)."""
    meta = await meta_skill_service.sync_meta_skill_agent(db, skill_type)
    if not meta:
        not_found(f"Meta skill '{skill_type}' not found or empty template")
    return MetaSkillSyncResponse(
        agent_id=meta.agent_id,
        agent_version=meta.agent_version,
        model=meta.model,
        synced_at=meta.last_synced_at,
    )


@router.get("/{skill_type}/default-template")
async def get_default_template(
    skill_type: str,
    language: str = "en",
    _user: User = Depends(require_role("admin")),
):
    """Return the bundled default template content for a given type and language."""
    from app.services.meta_skill_service import _load_default_template

    content = _load_default_template(skill_type, language)
    if not content:
        not_found(f"No default template for type='{skill_type}', language='{language}'")
    return {"template_content": content, "language": language}


@router.post("/{skill_type}/reset", response_model=MetaSkillRead)
async def reset_meta_skill_template(
    skill_type: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Reset the meta skill template to the bundled default."""
    meta = await meta_skill_service.reset_to_default(db, skill_type)
    if not meta:
        not_found(f"Meta skill '{skill_type}' not found")
    return meta
