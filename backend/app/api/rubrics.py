"""Rubric CRUD API router: admin-only management of scoring rubrics."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.models.user import User
from app.schemas.scoring_rubric import (
    CuPortalUrlResponse,
    DefaultPromptTemplateResponse,
    DefaultRubricTemplateResponse,
    RubricCreate,
    RubricResponse,
    RubricUpdate,
)
from app.services import rubric_service
from app.services.default_rubrics import get_default_f2f_rubric_template
from app.services.scoring_engine import SCORING_PROMPT_TEMPLATE

router = APIRouter(prefix="/rubrics", tags=["rubrics"])


@router.post("", response_model=RubricResponse, status_code=201)
async def create_rubric(
    request: RubricCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Create a new scoring rubric. Admin only."""
    return await rubric_service.create_rubric(db, request, user.id)


@router.get("", response_model=list[RubricResponse])
async def list_rubrics(
    scenario_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """List scoring rubrics with optional scenario_type filter. Admin only."""
    return await rubric_service.list_rubrics(db, scenario_type)


@router.get("/default-prompt-template", response_model=DefaultPromptTemplateResponse)
async def get_default_prompt_template(
    user: User = Depends(require_role("admin")),
):
    """Return the built-in scoring prompt template for admin editors."""
    return DefaultPromptTemplateResponse(prompt_template=SCORING_PROMPT_TEMPLATE)


@router.get("/default-rubric-template", response_model=DefaultRubricTemplateResponse)
async def get_default_rubric_template(
    user: User = Depends(require_role("admin")),
):
    """Return the built-in default F2F scoring rubric template for admin editors."""
    return DefaultRubricTemplateResponse(**get_default_f2f_rubric_template())


@router.get("/{rubric_id}", response_model=RubricResponse)
async def get_rubric(
    rubric_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Get a single scoring rubric by ID. Admin only."""
    return await rubric_service.get_rubric(db, rubric_id)


@router.put("/{rubric_id}", response_model=RubricResponse)
async def update_rubric(
    rubric_id: str,
    request: RubricUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Update a scoring rubric. Admin only."""
    return await rubric_service.update_rubric(db, rubric_id, request)


@router.get("/{rubric_id}/cu-portal-url", response_model=CuPortalUrlResponse)
async def get_cu_portal_url(
    rubric_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Get the Azure Content Understanding portal URLs for this rubric's analyzers."""
    import urllib.parse

    from app.config import get_settings
    from app.services import agent_sync_service, config_service
    from app.services.cu_evaluation_service import CU_SERVICE_NAME

    settings = get_settings()
    rubric = await rubric_service.get_rubric(db, rubric_id)
    endpoint = await config_service.get_effective_endpoint(db, CU_SERVICE_NAME)
    endpoint = endpoint.rstrip("/") if endpoint else ""

    content_id = rubric.cu_content_analyzer_id
    voice_id = rubric.cu_voice_analyzer_id

    # Classic Foundry CU Portal URL (requires project context + correct tenant).
    # tid MUST be the tenant that owns the resource, NOT the user's login tenant.
    # Wrong tid causes "Could not load resource" error.
    components = await agent_sync_service.get_portal_url_components(db)
    sub_id = components.get("subscription_id", "")
    rg = components.get("resource_group", "")
    resource_name = components.get("resource_name", "")
    project_name = components.get("project_name", "")
    tenant_id = settings.azure_tenant_id

    base_portal_url = None
    if sub_id and rg and resource_name and project_name:
        wsid = (
            f"/subscriptions/{sub_id}/resourceGroups/{rg}"
            f"/providers/Microsoft.CognitiveServices"
            f"/accounts/{resource_name}/projects/{project_name}"
        )
        params = {"wsid": wsid}
        if tenant_id:
            params["tid"] = tenant_id
        base_portal_url = (
            "https://ai.azure.com/resource/contentunderstanding/analyzer-list?"
            + urllib.parse.urlencode(params)
        )

    content_url = base_portal_url if content_id and base_portal_url else None
    voice_url = base_portal_url if voice_id and base_portal_url else None

    return CuPortalUrlResponse(
        cu_content_analyzer_id=content_id,
        cu_voice_analyzer_id=voice_id,
        content_analyzer_url=content_url,
        voice_analyzer_url=voice_url,
        cu_endpoint=endpoint or None,
    )


@router.delete("/{rubric_id}", status_code=204)
async def delete_rubric(
    rubric_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Delete a scoring rubric. Admin only."""
    await rubric_service.delete_rubric(db, rubric_id)
    return Response(status_code=204)
