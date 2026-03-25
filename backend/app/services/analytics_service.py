"""Analytics service: aggregate queries for dashboard and reporting."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.scenario import Scenario
from app.models.score import ScoreDetail, SessionScore
from app.models.session import CoachingSession
from app.models.user import User
from app.schemas.analytics import (
    BuStats,
    DimensionScore,
    DimensionTrendPoint,
    OrgAnalytics,
    RecommendedScenarioItem,
    SkillGapCell,
    UserDashboardStats,
)


async def get_user_dashboard_stats(db: AsyncSession, user_id: str) -> UserDashboardStats:
    """Compute the four stat card values for user dashboard."""
    # Total scored sessions
    total_result = await db.execute(
        select(func.count())
        .select_from(CoachingSession)
        .where(
            and_(
                CoachingSession.user_id == user_id,
                CoachingSession.status == "scored",
            )
        )
    )
    total_sessions = total_result.scalar() or 0

    # Average overall score
    avg_result = await db.execute(
        select(func.avg(CoachingSession.overall_score)).where(
            and_(
                CoachingSession.user_id == user_id,
                CoachingSession.status == "scored",
            )
        )
    )
    avg_score = round(avg_result.scalar() or 0.0, 1)

    # Sessions this week
    week_ago = datetime.now(UTC) - timedelta(days=7)
    week_result = await db.execute(
        select(func.count())
        .select_from(CoachingSession)
        .where(
            and_(
                CoachingSession.user_id == user_id,
                CoachingSession.created_at >= week_ago,
            )
        )
    )
    this_week = week_result.scalar() or 0

    # Improvement: latest score minus previous
    improvement = None
    if total_sessions >= 2:
        recent_result = await db.execute(
            select(CoachingSession.overall_score)
            .where(
                and_(
                    CoachingSession.user_id == user_id,
                    CoachingSession.status == "scored",
                )
            )
            .order_by(CoachingSession.completed_at.desc())
            .limit(2)
        )
        scores = list(recent_result.scalars().all())
        if len(scores) == 2 and scores[0] is not None and scores[1] is not None:
            improvement = round(scores[0] - scores[1], 1)

    return UserDashboardStats(
        total_sessions=total_sessions,
        avg_score=avg_score,
        this_week=this_week,
        improvement=improvement,
    )


async def get_user_dimension_trends(
    db: AsyncSession, user_id: str, limit: int = 20
) -> list[DimensionTrendPoint]:
    """Load scored sessions with per-dimension details for trend charts."""
    result = await db.execute(
        select(CoachingSession)
        .options(
            selectinload(CoachingSession.scenario),
            selectinload(CoachingSession.score).selectinload(SessionScore.details),
        )
        .where(
            and_(
                CoachingSession.user_id == user_id,
                CoachingSession.status == "scored",
            )
        )
        .order_by(CoachingSession.completed_at.desc())
        .limit(limit)
    )
    sessions = list(result.scalars().all())

    points: list[DimensionTrendPoint] = []
    for session in sessions:
        if session.score is None:
            continue
        dimensions = [
            DimensionScore(
                dimension=detail.dimension,
                score=detail.score,
                weight=detail.weight,
            )
            for detail in session.score.details
        ]
        points.append(
            DimensionTrendPoint(
                session_id=session.id,
                completed_at=session.completed_at,
                scenario_name=session.scenario.name if session.scenario else "",
                overall_score=session.score.overall_score,
                dimensions=dimensions,
            )
        )
    return points


async def get_org_analytics(db: AsyncSession) -> OrgAnalytics:
    """Compute organization-level analytics for admin dashboard."""
    # Total users (non-admin)
    total_users_result = await db.execute(
        select(func.count()).select_from(User).where(User.role == "user")
    )
    total_users = total_users_result.scalar() or 0

    # Active users: distinct user_ids with scored sessions
    active_result = await db.execute(
        select(func.count(func.distinct(CoachingSession.user_id))).where(
            CoachingSession.status == "scored"
        )
    )
    active_users = active_result.scalar() or 0

    # Completion rate
    completion_rate = round((active_users / max(total_users, 1)) * 100, 1)

    # Total scored sessions
    total_sessions_result = await db.execute(
        select(func.count()).select_from(CoachingSession).where(CoachingSession.status == "scored")
    )
    total_sessions = total_sessions_result.scalar() or 0

    # Org-wide average score
    avg_result = await db.execute(
        select(func.avg(CoachingSession.overall_score)).where(CoachingSession.status == "scored")
    )
    avg_org_score = round(avg_result.scalar() or 0.0, 1)

    # Per-BU stats
    bu_query = (
        select(
            User.business_unit,
            func.count(CoachingSession.id).label("session_count"),
            func.avg(CoachingSession.overall_score).label("avg_score"),
            func.count(func.distinct(CoachingSession.user_id)).label("user_count"),
        )
        .join(CoachingSession, CoachingSession.user_id == User.id)
        .where(
            and_(
                CoachingSession.status == "scored",
                User.role == "user",
                User.business_unit != "",
            )
        )
        .group_by(User.business_unit)
    )
    bu_result = await db.execute(bu_query)
    bu_stats = [
        BuStats(
            business_unit=row.business_unit,
            session_count=row.session_count,
            avg_score=round(row.avg_score or 0.0, 1),
            user_count=row.user_count,
        )
        for row in bu_result.all()
    ]

    # Skill gaps
    skill_gaps = await get_skill_gap_matrix(db)

    return OrgAnalytics(
        total_users=total_users,
        active_users=active_users,
        completion_rate=completion_rate,
        total_sessions=total_sessions,
        avg_org_score=avg_org_score,
        bu_stats=bu_stats,
        skill_gaps=skill_gaps,
    )


async def get_skill_gap_matrix(db: AsyncSession) -> list[SkillGapCell]:
    """Compute skill gap matrix: avg score per (BU, dimension)."""
    query = (
        select(
            User.business_unit,
            ScoreDetail.dimension,
            func.avg(ScoreDetail.score).label("avg_score"),
        )
        .join(SessionScore, SessionScore.id == ScoreDetail.score_id)
        .join(CoachingSession, CoachingSession.id == SessionScore.session_id)
        .join(User, User.id == CoachingSession.user_id)
        .where(
            and_(
                CoachingSession.status == "scored",
                User.role == "user",
                User.business_unit != "",
            )
        )
        .group_by(User.business_unit, ScoreDetail.dimension)
    )
    result = await db.execute(query)
    return [
        SkillGapCell(
            business_unit=row.business_unit,
            dimension=row.dimension,
            avg_score=round(row.avg_score or 0.0, 1),
        )
        for row in result.all()
    ]


async def get_recommended_scenarios(
    db: AsyncSession, user_id: str, limit: int = 3
) -> list[RecommendedScenarioItem]:
    """Recommend scenarios targeting user's weakest scoring dimension."""
    # Step 1: Get user's average score per dimension from last 10 scored sessions
    session_ids_query = (
        select(CoachingSession.id)
        .where(
            and_(
                CoachingSession.user_id == user_id,
                CoachingSession.status == "scored",
            )
        )
        .order_by(CoachingSession.completed_at.desc())
        .limit(10)
    )
    session_ids_result = await db.execute(session_ids_query)
    session_ids = [row[0] for row in session_ids_result.all()]

    if not session_ids:
        return []

    # Get score IDs for those sessions
    score_ids_result = await db.execute(
        select(SessionScore.id).where(SessionScore.session_id.in_(session_ids))
    )
    score_ids = [row[0] for row in score_ids_result.all()]

    if not score_ids:
        return []

    # Step 2: Avg score per dimension
    dim_avg_result = await db.execute(
        select(
            ScoreDetail.dimension,
            func.avg(ScoreDetail.score).label("avg_score"),
        )
        .where(ScoreDetail.score_id.in_(score_ids))
        .group_by(ScoreDetail.dimension)
    )
    dim_avgs = {row.dimension: row.avg_score for row in dim_avg_result.all()}

    if not dim_avgs:
        return []

    # Step 3: Find weakest dimension
    weakest_dim = min(dim_avgs, key=lambda d: dim_avgs[d])

    # Step 4: Map dimension to scenario weight column
    weight_map = {
        "key_message": Scenario.weight_key_message,
        "objection_handling": Scenario.weight_objection_handling,
        "communication": Scenario.weight_communication,
        "product_knowledge": Scenario.weight_product_knowledge,
        "scientific_info": Scenario.weight_scientific_info,
    }
    weight_col = weight_map.get(weakest_dim)
    if weight_col is None:
        return []

    # Step 5: Exclude recently completed scenarios
    recent_scenario_ids_result = await db.execute(
        select(CoachingSession.scenario_id)
        .where(
            and_(
                CoachingSession.user_id == user_id,
                CoachingSession.status == "scored",
            )
        )
        .order_by(CoachingSession.completed_at.desc())
        .limit(5)
    )
    recent_scenario_ids = [row[0] for row in recent_scenario_ids_result.all()]

    # Step 6: Query active scenarios ordered by weight for weakest dimension
    scenario_query = (
        select(Scenario)
        .where(Scenario.status == "active")
        .order_by(weight_col.desc())
        .limit(limit + len(recent_scenario_ids))
    )
    scenario_result = await db.execute(scenario_query)
    scenarios = list(scenario_result.scalars().all())

    recommendations: list[RecommendedScenarioItem] = []
    for scenario in scenarios:
        if scenario.id in recent_scenario_ids:
            continue
        if len(recommendations) >= limit:
            break
        recommendations.append(
            RecommendedScenarioItem(
                scenario_id=scenario.id,
                scenario_name=scenario.name,
                product=scenario.product,
                difficulty=scenario.difficulty,
                reason=f"Targets your weakest dimension: {weakest_dim}",
                target_dimension=weakest_dim,
            )
        )

    return recommendations
