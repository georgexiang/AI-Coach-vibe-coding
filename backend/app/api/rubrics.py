"""Rubric CRUD API router: admin-only management of scoring rubrics."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.models.user import User
from app.schemas.scoring_rubric import RubricCreate, RubricResponse, RubricUpdate
from app.services import rubric_service

router = APIRouter(prefix="/rubrics", tags=["rubrics"])


@router.post("/", response_model=RubricResponse, status_code=201)
async def create_rubric(
    request: RubricCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Create a new scoring rubric. Admin only."""
    return await rubric_service.create_rubric(db, request, user.id)


@router.get("/", response_model=list[RubricResponse])
async def list_rubrics(
    scenario_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """List scoring rubrics with optional scenario_type filter. Admin only."""
    return await rubric_service.list_rubrics(db, scenario_type)


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


@router.delete("/{rubric_id}", status_code=204)
async def delete_rubric(
    rubric_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Delete a scoring rubric. Admin only."""
    await rubric_service.delete_rubric(db, rubric_id)
    return Response(status_code=204)
