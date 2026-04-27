"""Dry Run service: CRUD operations and lifecycle management."""

import json
import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.dry_run import DryRun
from app.models.skill import Skill
from app.utils.exceptions import bad_request, not_found

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# CRUD operations
# ---------------------------------------------------------------------------


async def create_dry_run(db: AsyncSession, skill_id: str, created_by: str) -> DryRun:
    """Create a new dry run for a skill.

    Validates the skill exists and has content. Computes next sequential run_number.
    """
    # Validate skill exists and has content
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if skill is None:
        not_found("Skill not found")
    if not skill.content or not skill.content.strip():
        bad_request("Skill has no content. Generate or add content before running a dry run.")

    # Compute next run_number for this skill
    max_result = await db.execute(
        select(func.coalesce(func.max(DryRun.run_number), 0)).where(DryRun.skill_id == skill_id)
    )
    next_run_number = (max_result.scalar() or 0) + 1

    dry_run = DryRun(
        skill_id=skill_id,
        status="pending",
        run_number=next_run_number,
        created_by=created_by,
    )
    db.add(dry_run)
    await db.flush()

    # Re-query with messages loaded
    loaded = await db.execute(
        select(DryRun).options(selectinload(DryRun.messages)).where(DryRun.id == dry_run.id)
    )
    return loaded.scalar_one()


async def get_dry_run(db: AsyncSession, dry_run_id: str) -> DryRun | None:
    """Load a dry run with messages. Returns None if not found."""
    result = await db.execute(
        select(DryRun).options(selectinload(DryRun.messages)).where(DryRun.id == dry_run_id)
    )
    return result.scalar_one_or_none()


async def get_dry_run_or_404(db: AsyncSession, dry_run_id: str) -> DryRun:
    """Load a dry run with messages. Raises 404 if not found."""
    dry_run = await get_dry_run(db, dry_run_id)
    if dry_run is None:
        not_found("Dry run not found")
    return dry_run


async def list_dry_runs(
    db: AsyncSession,
    skill_id: str,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[DryRun], int]:
    """List dry runs for a skill, ordered by run_number DESC with pagination."""
    base_query = select(DryRun).where(DryRun.skill_id == skill_id)

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    query = base_query.order_by(DryRun.run_number.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def delete_dry_run(db: AsyncSession, dry_run_id: str, skill_id: str) -> None:
    """Delete a dry run and its messages. Only completed/failed/cancelled runs can be deleted."""
    dry_run = await get_dry_run_or_404(db, dry_run_id)

    if dry_run.skill_id != skill_id:
        not_found("Dry run not found for this skill")

    if dry_run.status in ("pending", "running"):
        bad_request(
            "Cannot delete a running dry run. Cancel it first."
        )

    await db.delete(dry_run)
    await db.flush()


async def cancel_dry_run(db: AsyncSession, dry_run_id: str) -> DryRun:
    """Cancel a pending or running dry run. Returns updated dry run."""
    dry_run = await get_dry_run_or_404(db, dry_run_id)

    if dry_run.status not in ("pending", "running"):
        bad_request(
            f"Cannot cancel dry run in '{dry_run.status}' status. "
            "Only pending or running dry runs can be cancelled."
        )

    dry_run.status = "cancelled"
    await db.flush()

    # Re-query with messages loaded
    result = await db.execute(
        select(DryRun).options(selectinload(DryRun.messages)).where(DryRun.id == dry_run.id)
    )
    return result.scalar_one()


def dry_run_to_out(dry_run: DryRun) -> dict:
    """Convert a DryRun ORM object to a response dict with parsed JSON fields.

    Parses sop_coverage_json and issues_json from JSON strings into Python objects.
    Used by the router to construct the full DryRunOut response.
    """
    # Parse SOP coverage JSON
    try:
        sop_coverage = json.loads(dry_run.sop_coverage_json or "[]")
    except (json.JSONDecodeError, TypeError):
        sop_coverage = []

    # Parse issues JSON
    try:
        issues = json.loads(dry_run.issues_json or "[]")
    except (json.JSONDecodeError, TypeError):
        issues = []

    # Truncate error_message to 500 chars (T-20-04: no stack traces)
    error_message = (dry_run.error_message or "")[:500]

    return {
        "id": dry_run.id,
        "skill_id": dry_run.skill_id,
        "run_number": dry_run.run_number,
        "status": dry_run.status,
        "executability_score": dry_run.executability_score,
        "coverage_percent": dry_run.coverage_percent,
        "total_sop_steps": dry_run.total_sop_steps,
        "covered_sop_steps": dry_run.covered_sop_steps,
        "partial_sop_steps": dry_run.partial_sop_steps,
        "issues_count": dry_run.issues_count,
        "duration_seconds": dry_run.duration_seconds,
        "sop_coverage": sop_coverage,
        "issues": issues,
        "error_message": error_message,
        "messages": [
            {
                "id": msg.id,
                "dry_run_id": msg.dry_run_id,
                "sequence_number": msg.sequence_number,
                "role": msg.role,
                "content": msg.content,
                "sop_step_id": msg.sop_step_id,
                "sop_step_name": msg.sop_step_name,
                "created_at": msg.created_at,
            }
            for msg in (dry_run.messages or [])
        ],
        "created_by": dry_run.created_by,
        "created_at": dry_run.created_at,
        "mr_agent_id": getattr(dry_run, "mr_agent_id", ""),
        "mr_agent_version": getattr(dry_run, "mr_agent_version", ""),
        "hcp_agent_id": getattr(dry_run, "hcp_agent_id", ""),
        "hcp_agent_version": getattr(dry_run, "hcp_agent_version", ""),
        "evaluator_agent_id": getattr(dry_run, "evaluator_agent_id", ""),
        "evaluator_agent_version": getattr(dry_run, "evaluator_agent_version", ""),
    }
