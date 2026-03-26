"""Analytics API: dashboard stats, trends, org analytics, recommendations, exports."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_role
from app.models.user import User
from app.schemas.analytics import (
    OrgAnalytics,
    RecommendedScenarioItem,
    UserDashboardStats,
)
from app.services import analytics_service, export_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


# --- User endpoints (any authenticated user) ---


@router.get("/dashboard", response_model=UserDashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get dashboard statistics for the current user."""
    return await analytics_service.get_user_dashboard_stats(db, user.id)


@router.get("/trends")
async def get_dimension_trends(
    limit: int = Query(20, ge=1, le=100),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get per-dimension performance trends for the current user."""
    return await analytics_service.get_user_dimension_trends(
        db, user.id, limit, start_date=start_date, end_date=end_date
    )


@router.get("/recommendations", response_model=list[RecommendedScenarioItem])
async def get_recommendations(
    limit: int = Query(3, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get recommended training scenarios based on user's weaknesses."""
    return await analytics_service.get_recommended_scenarios(db, user.id, limit)


# --- Export endpoints (authenticated user for own data) ---


@router.get("/export/sessions")
async def export_sessions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export current user's session history as Excel file."""
    buffer = await export_service.export_sessions_excel(db, user.id)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=sessions-report.xlsx"},
    )


# --- Admin-only endpoints ---


@router.get("/admin/overview", response_model=OrgAnalytics)
async def get_org_overview(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Get organization-level analytics (admin only)."""
    return await analytics_service.get_org_analytics(db, start_date=start_date, end_date=end_date)


@router.get("/admin/skill-gaps")
async def get_skill_gaps(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Get skill gap matrix by BU and dimension (admin only)."""
    return await analytics_service.get_skill_gap_matrix(db)


@router.get("/export/admin-report")
async def export_admin_report(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Export full organization report as Excel file (admin only)."""
    buffer = await export_service.export_admin_report_excel(db)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=admin-report.xlsx"},
    )
