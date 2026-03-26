"""Scenario CRUD API router: admin management of training scenarios."""

import json

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_role
from app.models.user import User
from app.schemas.scenario import ScenarioCreate, ScenarioUpdate
from app.services import scenario_service
from app.utils.pagination import PaginatedResponse

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


class ScenarioOut(BaseModel):
    """Scenario response with JSON list fields parsed to Python lists."""

    id: str
    name: str
    description: str
    product: str
    therapeutic_area: str
    mode: str
    difficulty: str
    status: str
    hcp_profile_id: str
    key_messages: list[str]
    weight_key_message: int
    weight_objection_handling: int
    weight_communication: int
    weight_product_knowledge: int
    weight_scientific_info: int
    pass_threshold: int
    created_by: str
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)

    @field_validator("key_messages", mode="before")
    @classmethod
    def parse_json_list(cls, v: str | list[str]) -> list[str]:
        """Parse JSON string field into Python list."""
        if isinstance(v, str):
            return json.loads(v)
        return v

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def datetime_to_str(cls, v: object) -> str:
        """Convert datetime to ISO string."""
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v)


@router.post("", response_model=ScenarioOut, status_code=201)
async def create_scenario(
    data: ScenarioCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Create a new scenario. Admin only."""
    scenario = await scenario_service.create_scenario(db, data, user.id)
    return scenario


@router.get("", response_model=PaginatedResponse[ScenarioOut])
async def list_scenarios(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    mode: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """List scenarios with optional filters. Admin only."""
    items, total = await scenario_service.get_scenarios(
        db, page=page, page_size=page_size, status=status, mode=mode, search=search
    )
    return PaginatedResponse.create(
        items=[ScenarioOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


# IMPORTANT: Static route /active BEFORE parameterized /{scenario_id} (Gotcha #3)
@router.get("/active", response_model=list[ScenarioOut])
async def list_active_scenarios(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List active scenarios for user selection. Accessible by authenticated users."""
    items, _ = await scenario_service.get_scenarios(db, status="active", page_size=100)
    return [ScenarioOut.model_validate(item) for item in items]


@router.get("/{scenario_id}", response_model=ScenarioOut)
async def get_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Get a single scenario with HCP profile. Admin only."""
    scenario = await scenario_service.get_scenario(db, scenario_id)
    return scenario


@router.put("/{scenario_id}", response_model=ScenarioOut)
async def update_scenario(
    scenario_id: str,
    data: ScenarioUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Update a scenario. Admin only."""
    scenario = await scenario_service.update_scenario(db, scenario_id, data)
    return scenario


@router.delete("/{scenario_id}", status_code=204)
async def delete_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Delete a scenario. Admin only."""
    await scenario_service.delete_scenario(db, scenario_id)
    return Response(status_code=204)


@router.post("/{scenario_id}/clone", response_model=ScenarioOut, status_code=201)
async def clone_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Clone an existing scenario. Admin only."""
    scenario = await scenario_service.clone_scenario(db, scenario_id, user.id)
    return scenario
