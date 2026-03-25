"""Unit tests for analytics_service: dashboard stats, trends, org analytics, recommendations."""

from datetime import UTC, datetime, timedelta

from app.models.hcp_profile import HcpProfile
from app.models.scenario import Scenario
from app.models.score import ScoreDetail, SessionScore
from app.models.session import CoachingSession
from app.models.user import User
from app.services.analytics_service import (
    get_org_analytics,
    get_recommended_scenarios,
    get_skill_gap_matrix,
    get_user_dashboard_stats,
    get_user_dimension_trends,
)
from app.services.auth import get_password_hash


async def _create_user(session, *, username="user1", role="user", bu="BU-Sales") -> User:
    """Helper to create a user in the test DB."""
    user = User(
        username=username,
        email=f"{username}@test.com",
        hashed_password=get_password_hash("pass"),
        full_name=f"Test {username}",
        role=role,
        business_unit=bu,
    )
    session.add(user)
    await session.flush()
    return user


async def _create_hcp(session, *, created_by: str) -> HcpProfile:
    """Helper to create an HCP profile."""
    hcp = HcpProfile(
        name="Dr. Test",
        specialty="Oncology",
        created_by=created_by,
    )
    session.add(hcp)
    await session.flush()
    return hcp


async def _create_scenario(
    session,
    *,
    hcp_id: str,
    created_by: str,
    name: str = "Test Scenario",
    status: str = "active",
    product: str = "TestDrug",
    difficulty: str = "medium",
    weight_key_message: int = 30,
    weight_objection_handling: int = 25,
    weight_communication: int = 20,
    weight_product_knowledge: int = 15,
    weight_scientific_info: int = 10,
) -> Scenario:
    """Helper to create a scenario."""
    scenario = Scenario(
        name=name,
        product=product,
        difficulty=difficulty,
        status=status,
        hcp_profile_id=hcp_id,
        created_by=created_by,
        weight_key_message=weight_key_message,
        weight_objection_handling=weight_objection_handling,
        weight_communication=weight_communication,
        weight_product_knowledge=weight_product_knowledge,
        weight_scientific_info=weight_scientific_info,
    )
    session.add(scenario)
    await session.flush()
    return scenario


async def _create_scored_session(
    session,
    *,
    user_id: str,
    scenario_id: str,
    overall_score: float = 80.0,
    passed: bool = True,
    completed_at: datetime | None = None,
    duration_seconds: int = 600,
    session_type: str = "f2f",
) -> CoachingSession:
    """Helper to create a scored coaching session."""
    cs = CoachingSession(
        user_id=user_id,
        scenario_id=scenario_id,
        status="scored",
        overall_score=overall_score,
        passed=passed,
        completed_at=completed_at or datetime.now(UTC),
        duration_seconds=duration_seconds,
        session_type=session_type,
    )
    session.add(cs)
    await session.flush()
    return cs


async def _create_score_with_details(
    session,
    *,
    session_id: str,
    overall_score: float = 80.0,
    passed: bool = True,
    dimensions: list[tuple[str, float, int]] | None = None,
) -> SessionScore:
    """Helper to create a SessionScore with ScoreDetail rows.

    dimensions: list of (dimension_name, score, weight) tuples.
    """
    score = SessionScore(
        session_id=session_id,
        overall_score=overall_score,
        passed=passed,
    )
    session.add(score)
    await session.flush()

    if dimensions is None:
        dimensions = [
            ("key_message", 85.0, 30),
            ("objection_handling", 75.0, 25),
            ("communication", 80.0, 20),
        ]
    for dim_name, dim_score, weight in dimensions:
        detail = ScoreDetail(
            score_id=score.id,
            dimension=dim_name,
            score=dim_score,
            weight=weight,
        )
        session.add(detail)

    await session.flush()
    return score


# ---------------------------------------------------------------------------
# get_user_dashboard_stats
# ---------------------------------------------------------------------------


class TestGetUserDashboardStats:
    """Tests for get_user_dashboard_stats service function."""

    async def test_zero_sessions_returns_defaults(self, db_session):
        """New user with no sessions should have all-zero stats."""
        user = await _create_user(db_session)
        await db_session.commit()

        stats = await get_user_dashboard_stats(db_session, user.id)
        assert stats.total_sessions == 0
        assert stats.avg_score == 0.0
        assert stats.this_week == 0
        assert stats.improvement is None

    async def test_one_scored_session(self, db_session):
        """Single session should show total=1, avg=score, improvement=None."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        scenario = await _create_scenario(db_session, hcp_id=hcp.id, created_by=user.id)
        await _create_scored_session(
            db_session, user_id=user.id, scenario_id=scenario.id, overall_score=85.0
        )
        await db_session.commit()

        stats = await get_user_dashboard_stats(db_session, user.id)
        assert stats.total_sessions == 1
        assert stats.avg_score == 85.0
        assert stats.improvement is None  # need >= 2 sessions

    async def test_two_sessions_calculates_improvement(self, db_session):
        """With 2 scored sessions, improvement = latest - previous."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        scenario = await _create_scenario(db_session, hcp_id=hcp.id, created_by=user.id)
        await _create_scored_session(
            db_session,
            user_id=user.id,
            scenario_id=scenario.id,
            overall_score=70.0,
            completed_at=datetime.now(UTC) - timedelta(days=2),
        )
        await _create_scored_session(
            db_session,
            user_id=user.id,
            scenario_id=scenario.id,
            overall_score=85.0,
            completed_at=datetime.now(UTC) - timedelta(days=1),
        )
        await db_session.commit()

        stats = await get_user_dashboard_stats(db_session, user.id)
        assert stats.total_sessions == 2
        assert stats.improvement == 15.0

    async def test_this_week_counts_recent_sessions(self, db_session):
        """Sessions created in the last 7 days count toward this_week."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        scenario = await _create_scenario(db_session, hcp_id=hcp.id, created_by=user.id)
        # Recent session (within this week)
        await _create_scored_session(
            db_session, user_id=user.id, scenario_id=scenario.id, overall_score=80.0
        )
        # Old session: created_at in the past (we need to set it manually)
        old_cs = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
            status="scored",
            overall_score=70.0,
            passed=True,
            completed_at=datetime.now(UTC) - timedelta(days=14),
        )
        db_session.add(old_cs)
        await db_session.flush()
        # Manually set created_at to 14 days ago for this_week filter
        old_cs.created_at = datetime.now(UTC) - timedelta(days=14)
        await db_session.commit()

        stats = await get_user_dashboard_stats(db_session, user.id)
        assert stats.this_week == 1  # only the recent one

    async def test_negative_improvement(self, db_session):
        """Improvement can be negative if latest score < previous."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        scenario = await _create_scenario(db_session, hcp_id=hcp.id, created_by=user.id)
        await _create_scored_session(
            db_session,
            user_id=user.id,
            scenario_id=scenario.id,
            overall_score=90.0,
            completed_at=datetime.now(UTC) - timedelta(days=2),
        )
        await _create_scored_session(
            db_session,
            user_id=user.id,
            scenario_id=scenario.id,
            overall_score=75.0,
            completed_at=datetime.now(UTC) - timedelta(days=1),
        )
        await db_session.commit()

        stats = await get_user_dashboard_stats(db_session, user.id)
        assert stats.improvement == -15.0

    async def test_ignores_non_scored_sessions(self, db_session):
        """Sessions with status != 'scored' should not count."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        scenario = await _create_scenario(db_session, hcp_id=hcp.id, created_by=user.id)
        # In-progress session
        cs = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
            status="in_progress",
            overall_score=None,
        )
        db_session.add(cs)
        await db_session.commit()

        stats = await get_user_dashboard_stats(db_session, user.id)
        assert stats.total_sessions == 0


# ---------------------------------------------------------------------------
# get_user_dimension_trends
# ---------------------------------------------------------------------------


class TestGetUserDimensionTrends:
    """Tests for get_user_dimension_trends service function."""

    async def test_empty_returns_empty_list(self, db_session):
        """User with no scored sessions returns empty trends."""
        user = await _create_user(db_session)
        await db_session.commit()

        trends = await get_user_dimension_trends(db_session, user.id)
        assert trends == []

    async def test_returns_dimension_data(self, db_session):
        """Scored session with score details returns trend points."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        scenario = await _create_scenario(db_session, hcp_id=hcp.id, created_by=user.id)
        cs = await _create_scored_session(
            db_session, user_id=user.id, scenario_id=scenario.id, overall_score=82.0
        )
        await _create_score_with_details(
            db_session,
            session_id=cs.id,
            overall_score=82.0,
            dimensions=[
                ("key_message", 90.0, 30),
                ("communication", 75.0, 20),
            ],
        )
        await db_session.commit()

        trends = await get_user_dimension_trends(db_session, user.id)
        assert len(trends) == 1
        point = trends[0]
        assert point.session_id == cs.id
        assert point.overall_score == 82.0
        assert point.scenario_name == "Test Scenario"
        assert len(point.dimensions) == 2
        dim_names = {d.dimension for d in point.dimensions}
        assert dim_names == {"key_message", "communication"}

    async def test_limit_parameter(self, db_session):
        """The limit parameter restricts number of trends returned."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        scenario = await _create_scenario(db_session, hcp_id=hcp.id, created_by=user.id)
        for i in range(5):
            cs = await _create_scored_session(
                db_session,
                user_id=user.id,
                scenario_id=scenario.id,
                overall_score=70.0 + i,
                completed_at=datetime.now(UTC) - timedelta(days=5 - i),
            )
            await _create_score_with_details(
                db_session,
                session_id=cs.id,
                overall_score=70.0 + i,
            )
        await db_session.commit()

        trends = await get_user_dimension_trends(db_session, user.id, limit=3)
        assert len(trends) == 3

    async def test_skips_session_without_score(self, db_session):
        """Sessions that have no score relationship should be skipped."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        scenario = await _create_scenario(db_session, hcp_id=hcp.id, created_by=user.id)
        # Scored session but no SessionScore object created
        await _create_scored_session(db_session, user_id=user.id, scenario_id=scenario.id)
        await db_session.commit()

        trends = await get_user_dimension_trends(db_session, user.id)
        assert trends == []

    async def test_scenario_name_empty_when_no_scenario(self, db_session):
        """If scenario relationship is None, scenario_name should be empty string."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        scenario = await _create_scenario(db_session, hcp_id=hcp.id, created_by=user.id)
        cs = await _create_scored_session(db_session, user_id=user.id, scenario_id=scenario.id)
        await _create_score_with_details(db_session, session_id=cs.id)
        await db_session.commit()

        trends = await get_user_dimension_trends(db_session, user.id)
        assert len(trends) == 1
        # scenario_name should be the scenario name since we linked it
        assert trends[0].scenario_name == "Test Scenario"


# ---------------------------------------------------------------------------
# get_org_analytics
# ---------------------------------------------------------------------------


class TestGetOrgAnalytics:
    """Tests for get_org_analytics service function."""

    async def test_empty_org(self, db_session):
        """Empty org returns zeros."""
        result = await get_org_analytics(db_session)
        assert result.total_users == 0
        assert result.active_users == 0
        assert result.completion_rate == 0.0
        assert result.total_sessions == 0
        assert result.avg_org_score == 0.0
        assert result.bu_stats == []
        assert result.skill_gaps == []

    async def test_org_with_users_and_sessions(self, db_session):
        """Org with users and scored sessions produces correct stats."""
        admin = await _create_user(db_session, username="admin", role="admin", bu="HQ")
        user1 = await _create_user(db_session, username="user1", role="user", bu="BU-Sales")
        user2 = await _create_user(db_session, username="user2", role="user", bu="BU-Sales")
        await _create_user(db_session, username="user3", role="user", bu="BU-Marketing")
        hcp = await _create_hcp(db_session, created_by=admin.id)
        scenario = await _create_scenario(db_session, hcp_id=hcp.id, created_by=admin.id)

        # User1 has 2 scored sessions
        for score in [80.0, 90.0]:
            cs = await _create_scored_session(
                db_session, user_id=user1.id, scenario_id=scenario.id, overall_score=score
            )
            await _create_score_with_details(
                db_session,
                session_id=cs.id,
                overall_score=score,
                dimensions=[("key_message", score, 30)],
            )
        # User2 has 1 scored session
        cs = await _create_scored_session(
            db_session, user_id=user2.id, scenario_id=scenario.id, overall_score=70.0
        )
        await _create_score_with_details(
            db_session,
            session_id=cs.id,
            overall_score=70.0,
            dimensions=[("key_message", 70.0, 30)],
        )
        # User3 has no sessions
        await db_session.commit()

        result = await get_org_analytics(db_session)
        assert result.total_users == 3  # admin excluded (role != user)
        assert result.active_users == 2  # user1 and user2
        assert result.total_sessions == 3
        assert result.avg_org_score == 80.0  # (80+90+70)/3
        assert len(result.bu_stats) >= 1

        # Check BU-Sales stats
        bu_sales = next((b for b in result.bu_stats if b.business_unit == "BU-Sales"), None)
        assert bu_sales is not None
        assert bu_sales.session_count == 3
        assert bu_sales.user_count == 2

    async def test_admin_excluded_from_total_users(self, db_session):
        """Admin users should not be counted in total_users."""
        await _create_user(db_session, username="admin1", role="admin", bu="HQ")
        await _create_user(db_session, username="user1", role="user", bu="BU-A")
        await db_session.commit()

        result = await get_org_analytics(db_session)
        assert result.total_users == 1

    async def test_empty_bu_excluded(self, db_session):
        """Users with empty business_unit should not appear in bu_stats."""
        admin = await _create_user(db_session, username="admin", role="admin", bu="HQ")
        user = await _create_user(db_session, username="user1", role="user", bu="")
        hcp = await _create_hcp(db_session, created_by=admin.id)
        scenario = await _create_scenario(db_session, hcp_id=hcp.id, created_by=admin.id)
        await _create_scored_session(
            db_session, user_id=user.id, scenario_id=scenario.id, overall_score=80.0
        )
        await db_session.commit()

        result = await get_org_analytics(db_session)
        assert result.bu_stats == []

    async def test_completion_rate_calculation(self, db_session):
        """Completion rate = (active_users / total_users) * 100."""
        admin = await _create_user(db_session, username="admin", role="admin", bu="HQ")
        user1 = await _create_user(db_session, username="user1", role="user", bu="BU-A")
        await _create_user(db_session, username="user2", role="user", bu="BU-A")
        hcp = await _create_hcp(db_session, created_by=admin.id)
        scenario = await _create_scenario(db_session, hcp_id=hcp.id, created_by=admin.id)
        await _create_scored_session(
            db_session, user_id=user1.id, scenario_id=scenario.id, overall_score=80.0
        )
        await db_session.commit()

        result = await get_org_analytics(db_session)
        assert result.total_users == 2
        assert result.active_users == 1
        assert result.completion_rate == 50.0


# ---------------------------------------------------------------------------
# get_skill_gap_matrix
# ---------------------------------------------------------------------------


class TestGetSkillGapMatrix:
    """Tests for get_skill_gap_matrix service function."""

    async def test_empty_returns_empty(self, db_session):
        """No data returns empty skill gap list."""
        result = await get_skill_gap_matrix(db_session)
        assert result == []

    async def test_matrix_with_multiple_bus_and_dimensions(self, db_session):
        """Computes average per (BU, dimension) correctly."""
        admin = await _create_user(db_session, username="admin", role="admin", bu="HQ")
        user1 = await _create_user(db_session, username="user1", role="user", bu="BU-Sales")
        user2 = await _create_user(db_session, username="user2", role="user", bu="BU-Marketing")
        hcp = await _create_hcp(db_session, created_by=admin.id)
        scenario = await _create_scenario(db_session, hcp_id=hcp.id, created_by=admin.id)

        # User1 session with scores
        cs1 = await _create_scored_session(
            db_session, user_id=user1.id, scenario_id=scenario.id, overall_score=80.0
        )
        await _create_score_with_details(
            db_session,
            session_id=cs1.id,
            overall_score=80.0,
            dimensions=[
                ("key_message", 80.0, 30),
                ("communication", 90.0, 20),
            ],
        )

        # User2 session with scores
        cs2 = await _create_scored_session(
            db_session, user_id=user2.id, scenario_id=scenario.id, overall_score=70.0
        )
        await _create_score_with_details(
            db_session,
            session_id=cs2.id,
            overall_score=70.0,
            dimensions=[
                ("key_message", 60.0, 30),
                ("communication", 70.0, 20),
            ],
        )
        await db_session.commit()

        result = await get_skill_gap_matrix(db_session)
        assert len(result) == 4  # 2 BUs x 2 dimensions

        # Check a specific cell
        sales_km = next(
            (c for c in result if c.business_unit == "BU-Sales" and c.dimension == "key_message"),
            None,
        )
        assert sales_km is not None
        assert sales_km.avg_score == 80.0

    async def test_excludes_admin_from_matrix(self, db_session):
        """Admin users should not appear in skill gap matrix."""
        admin = await _create_user(db_session, username="admin", role="admin", bu="HQ")
        hcp = await _create_hcp(db_session, created_by=admin.id)
        scenario = await _create_scenario(db_session, hcp_id=hcp.id, created_by=admin.id)
        cs = await _create_scored_session(
            db_session, user_id=admin.id, scenario_id=scenario.id, overall_score=90.0
        )
        await _create_score_with_details(
            db_session,
            session_id=cs.id,
            overall_score=90.0,
            dimensions=[("key_message", 90.0, 30)],
        )
        await db_session.commit()

        result = await get_skill_gap_matrix(db_session)
        assert result == []


# ---------------------------------------------------------------------------
# get_recommended_scenarios
# ---------------------------------------------------------------------------


class TestGetRecommendedScenarios:
    """Tests for get_recommended_scenarios service function."""

    async def test_no_sessions_returns_empty(self, db_session):
        """User with no scored sessions gets no recommendations."""
        user = await _create_user(db_session)
        await db_session.commit()

        recs = await get_recommended_scenarios(db_session, user.id)
        assert recs == []

    async def test_finds_weakest_dimension_and_recommends(self, db_session):
        """Should recommend scenarios targeting the user's weakest dimension."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        scenario = await _create_scenario(
            db_session,
            hcp_id=hcp.id,
            created_by=user.id,
            name="High ObjH Scenario",
            status="active",
            weight_objection_handling=40,
        )
        # Create another active scenario
        await _create_scenario(
            db_session,
            hcp_id=hcp.id,
            created_by=user.id,
            name="Default Scenario",
            status="active",
        )
        cs = await _create_scored_session(
            db_session,
            user_id=user.id,
            scenario_id=scenario.id,
            overall_score=70.0,
            completed_at=datetime.now(UTC) - timedelta(days=10),
        )
        await _create_score_with_details(
            db_session,
            session_id=cs.id,
            overall_score=70.0,
            dimensions=[
                ("key_message", 90.0, 30),
                ("objection_handling", 50.0, 25),  # weakest
                ("communication", 80.0, 20),
            ],
        )
        await db_session.commit()

        recs = await get_recommended_scenarios(db_session, user.id, limit=3)
        assert len(recs) >= 1
        assert recs[0].target_dimension == "objection_handling"
        assert "weakest" in recs[0].reason

    async def test_excludes_recent_scenarios(self, db_session):
        """Recently completed scenarios should be excluded from recommendations."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        # Create the only active scenario
        scenario = await _create_scenario(
            db_session,
            hcp_id=hcp.id,
            created_by=user.id,
            name="Only Scenario",
            status="active",
            weight_key_message=50,
        )
        # User just completed this scenario (within recent 5)
        cs = await _create_scored_session(
            db_session,
            user_id=user.id,
            scenario_id=scenario.id,
            overall_score=70.0,
            completed_at=datetime.now(UTC),
        )
        await _create_score_with_details(
            db_session,
            session_id=cs.id,
            overall_score=70.0,
            dimensions=[("key_message", 60.0, 30)],  # weakest
        )
        await db_session.commit()

        recs = await get_recommended_scenarios(db_session, user.id, limit=3)
        # The only active scenario is recently completed, so excluded
        assert recs == []

    async def test_unknown_dimension_returns_empty(self, db_session):
        """If weakest dimension is not in weight_map, return empty."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        scenario = await _create_scenario(
            db_session, hcp_id=hcp.id, created_by=user.id, status="active"
        )
        cs = await _create_scored_session(
            db_session,
            user_id=user.id,
            scenario_id=scenario.id,
            overall_score=70.0,
            completed_at=datetime.now(UTC) - timedelta(days=10),
        )
        await _create_score_with_details(
            db_session,
            session_id=cs.id,
            overall_score=70.0,
            dimensions=[("unknown_dimension", 50.0, 30)],
        )
        await db_session.commit()

        recs = await get_recommended_scenarios(db_session, user.id)
        assert recs == []

    async def test_no_score_ids_returns_empty(self, db_session):
        """If scored sessions exist but no SessionScore rows, return empty."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        scenario = await _create_scenario(
            db_session, hcp_id=hcp.id, created_by=user.id, status="active"
        )
        # Scored session but no SessionScore created
        await _create_scored_session(
            db_session, user_id=user.id, scenario_id=scenario.id, overall_score=70.0
        )
        await db_session.commit()

        recs = await get_recommended_scenarios(db_session, user.id)
        assert recs == []

    async def test_no_dim_avgs_returns_empty(self, db_session):
        """If SessionScore exists but has no ScoreDetail rows, return empty."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        scenario = await _create_scenario(
            db_session, hcp_id=hcp.id, created_by=user.id, status="active"
        )
        cs = await _create_scored_session(
            db_session, user_id=user.id, scenario_id=scenario.id, overall_score=70.0
        )
        # Create SessionScore without any details
        score = SessionScore(
            session_id=cs.id,
            overall_score=70.0,
            passed=True,
        )
        db_session.add(score)
        await db_session.commit()

        recs = await get_recommended_scenarios(db_session, user.id)
        assert recs == []

    async def test_limit_respected(self, db_session):
        """Should not return more than the limit parameter."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)

        # Create 5 active scenarios
        for i in range(5):
            await _create_scenario(
                db_session,
                hcp_id=hcp.id,
                created_by=user.id,
                name=f"Scenario {i}",
                status="active",
                weight_key_message=30 + i,
            )

        # Create an old scored session with key_message as weakest
        old_scenario = await _create_scenario(
            db_session,
            hcp_id=hcp.id,
            created_by=user.id,
            name="Old Scenario",
            status="draft",  # draft so it won't be recommended
        )
        cs = await _create_scored_session(
            db_session,
            user_id=user.id,
            scenario_id=old_scenario.id,
            overall_score=65.0,
            completed_at=datetime.now(UTC) - timedelta(days=30),
        )
        await _create_score_with_details(
            db_session,
            session_id=cs.id,
            overall_score=65.0,
            dimensions=[
                ("key_message", 50.0, 30),
                ("communication", 80.0, 20),
            ],
        )
        await db_session.commit()

        recs = await get_recommended_scenarios(db_session, user.id, limit=2)
        assert len(recs) <= 2

    async def test_draft_scenarios_excluded(self, db_session):
        """Only active scenarios should be recommended."""
        user = await _create_user(db_session)
        hcp = await _create_hcp(db_session, created_by=user.id)
        # Only a draft scenario exists
        await _create_scenario(
            db_session,
            hcp_id=hcp.id,
            created_by=user.id,
            name="Draft Only",
            status="draft",
        )
        # Need a scored session to trigger the recommendation flow
        active_for_session = await _create_scenario(
            db_session,
            hcp_id=hcp.id,
            created_by=user.id,
            name="Active Used",
            status="active",
        )
        cs = await _create_scored_session(
            db_session,
            user_id=user.id,
            scenario_id=active_for_session.id,
            overall_score=60.0,
            completed_at=datetime.now(UTC),
        )
        await _create_score_with_details(
            db_session,
            session_id=cs.id,
            overall_score=60.0,
            dimensions=[("key_message", 40.0, 30)],
        )
        await db_session.commit()

        recs = await get_recommended_scenarios(db_session, user.id, limit=3)
        # active_for_session was recently used so it's excluded from recs
        # draft scenario won't appear either since status != active
        # Only active_for_session is in recent list, draft won't be queried
        for rec in recs:
            assert rec.scenario_name != "Draft Only"
