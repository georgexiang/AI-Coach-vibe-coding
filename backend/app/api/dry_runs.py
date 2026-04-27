"""Dry Run API endpoints for skill simulation."""

import asyncio
import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.models.dry_run import DryRun
from app.models.user import User
from app.schemas.dry_run import DryRunListOut, DryRunOut
from app.services import dry_run_service
from app.services.dry_run_engine import run_dry_run_simulation
from app.utils.pagination import PaginatedResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/skills/{skill_id}/dry-runs", tags=["dry-runs"])


@router.post("", response_model=DryRunOut, status_code=201)
async def create_dry_run(
    skill_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Create a new dry run for a skill. Admin only.

    Returns the pending dry run immediately. The simulation engine
    runs asynchronously as a background task.
    """
    dry_run = await dry_run_service.create_dry_run(db, skill_id, user.id)
    # Commit (not just flush) so the row is visible to the background task's
    # independent DB session.  With SQLite the background connection cannot
    # see uncommitted rows from another connection.
    await db.commit()
    # Launch simulation as background task (own DB session)
    asyncio.create_task(run_dry_run_simulation(dry_run.id))
    return DryRunOut(**dry_run_service.dry_run_to_out(dry_run))


@router.get("", response_model=PaginatedResponse[DryRunListOut])
async def list_dry_runs(
    skill_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """List dry runs for a skill with pagination. Admin only."""
    items, total = await dry_run_service.list_dry_runs(
        db, skill_id, page=page, page_size=page_size
    )
    return PaginatedResponse.create(
        items=[DryRunListOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{run_id}/status")
async def get_dry_run_status(
    skill_id: str,
    run_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Lightweight status poll for a dry run. Admin only.

    Returns minimal fields for 3-second frontend polling without
    joining messages.
    """
    from app.utils.exceptions import not_found

    dry_run = await db.get(DryRun, run_id)
    if not dry_run or dry_run.skill_id != skill_id:
        not_found("Dry run not found")
    return {
        "status": dry_run.status,
        "covered_sop_steps": dry_run.covered_sop_steps,
        "total_sop_steps": dry_run.total_sop_steps,
        "coverage_percent": dry_run.coverage_percent,
    }


@router.get("/{run_id}", response_model=DryRunOut)
async def get_dry_run(
    skill_id: str,
    run_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Get full dry run detail with messages. Admin only."""
    dry_run = await dry_run_service.get_dry_run_or_404(db, run_id)
    # Verify the dry run belongs to the specified skill
    if dry_run.skill_id != skill_id:
        from app.utils.exceptions import not_found

        not_found("Dry run not found for this skill")
    return DryRunOut(**dry_run_service.dry_run_to_out(dry_run))


@router.post("/{run_id}/cancel", response_model=DryRunOut)
async def cancel_dry_run(
    skill_id: str,
    run_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    """Cancel a pending or running dry run. Admin only."""
    # First verify the run exists and belongs to this skill
    dry_run = await dry_run_service.get_dry_run_or_404(db, run_id)
    if dry_run.skill_id != skill_id:
        from app.utils.exceptions import not_found

        not_found("Dry run not found for this skill")
    dry_run = await dry_run_service.cancel_dry_run(db, run_id)
    return DryRunOut(**dry_run_service.dry_run_to_out(dry_run))
