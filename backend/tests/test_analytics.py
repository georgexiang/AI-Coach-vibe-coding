"""Analytics API endpoint tests covering all 7 analytics endpoints."""

from datetime import UTC, datetime

from app.models.hcp_profile import HcpProfile
from app.models.scenario import Scenario
from app.models.score import ScoreDetail, SessionScore
from app.models.session import CoachingSession
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _create_admin_and_token() -> tuple[str, str]:
    """Create an admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="admin_analytics",
            email="admin_analytics@test.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin Analytics",
            role="admin",
            business_unit="BU-HQ",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


async def _create_user_and_token() -> tuple[str, str]:
    """Create a regular user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="user_analytics",
            email="user_analytics@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Regular Analytics",
            role="user",
            business_unit="BU-Sales",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


class TestUserDashboardStats:
    """Tests for GET /analytics/dashboard."""

    async def test_returns_stats_for_authenticated_user(self, client):
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_sessions" in data
        assert "avg_score" in data
        assert "this_week" in data
        assert "improvement" in data

    async def test_returns_zero_stats_for_new_user(self, client):
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_sessions"] == 0
        assert data["avg_score"] == 0.0
        assert data["this_week"] == 0
        assert data["improvement"] is None

    async def test_unauthenticated_returns_401(self, client):
        response = await client.get("/api/v1/analytics/dashboard")
        assert response.status_code == 401


class TestDimensionTrends:
    """Tests for GET /analytics/trends."""

    async def test_returns_trends_for_authenticated_user(self, client):
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/trends",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_accepts_limit_param(self, client):
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/trends",
            params={"limit": 5},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    async def test_unauthenticated_returns_401(self, client):
        response = await client.get("/api/v1/analytics/trends")
        assert response.status_code == 401


class TestRecommendations:
    """Tests for GET /analytics/recommendations."""

    async def test_returns_recommendations(self, client):
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/recommendations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_accepts_limit_param(self, client):
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/recommendations",
            params={"limit": 5},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    async def test_unauthenticated_returns_401(self, client):
        response = await client.get("/api/v1/analytics/recommendations")
        assert response.status_code == 401


class TestExportSessions:
    """Tests for GET /analytics/export/sessions."""

    async def test_returns_excel_file(self, client):
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/export/sessions",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert "spreadsheetml" in response.headers.get("content-type", "")
        assert "attachment" in response.headers.get("content-disposition", "")

    async def test_unauthenticated_returns_401(self, client):
        response = await client.get("/api/v1/analytics/export/sessions")
        assert response.status_code == 401


class TestAdminOverview:
    """Tests for GET /analytics/admin/overview (admin only)."""

    async def test_returns_org_analytics_for_admin(self, client):
        _, token = await _create_admin_and_token()
        response = await client.get(
            "/api/v1/analytics/admin/overview",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "active_users" in data
        assert "completion_rate" in data
        assert "total_sessions" in data
        assert "avg_org_score" in data
        assert "bu_stats" in data
        assert "skill_gaps" in data

    async def test_regular_user_returns_403(self, client):
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/admin/overview",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    async def test_unauthenticated_returns_401(self, client):
        response = await client.get("/api/v1/analytics/admin/overview")
        assert response.status_code == 401


class TestAdminSkillGaps:
    """Tests for GET /analytics/admin/skill-gaps (admin only)."""

    async def test_returns_skill_gaps_for_admin(self, client):
        _, token = await _create_admin_and_token()
        response = await client.get(
            "/api/v1/analytics/admin/skill-gaps",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_regular_user_returns_403(self, client):
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/admin/skill-gaps",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    async def test_unauthenticated_returns_401(self, client):
        response = await client.get("/api/v1/analytics/admin/skill-gaps")
        assert response.status_code == 401


class TestAdminExport:
    """Tests for GET /analytics/export/admin-report (admin only)."""

    async def test_returns_excel_for_admin(self, client):
        _, token = await _create_admin_and_token()
        response = await client.get(
            "/api/v1/analytics/export/admin-report",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert "spreadsheetml" in response.headers.get("content-type", "")

    async def test_regular_user_returns_403(self, client):
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/export/admin-report",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    async def test_unauthenticated_returns_401(self, client):
        response = await client.get("/api/v1/analytics/export/admin-report")
        assert response.status_code == 401

    async def test_admin_export_has_content_disposition(self, client):
        """Admin export should have correct Content-Disposition header."""
        _, token = await _create_admin_and_token()
        response = await client.get(
            "/api/v1/analytics/export/admin-report",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        disposition = response.headers.get("content-disposition", "")
        assert "attachment" in disposition
        assert "admin-report.xlsx" in disposition


# ---------------------------------------------------------------------------
# Edge case tests for parameter validation and empty data
# ---------------------------------------------------------------------------


async def _create_user_with_data_and_token() -> tuple[str, str]:
    """Create a user with scored sessions, scores, and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        admin = User(
            username="admin_edge",
            email="admin_edge@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Admin Edge",
            role="admin",
            business_unit="HQ",
        )
        session.add(admin)
        await session.flush()

        user = User(
            username="user_edge",
            email="user_edge@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="User Edge",
            role="user",
            business_unit="BU-Edge",
        )
        session.add(user)
        await session.flush()

        hcp = HcpProfile(
            name="Dr. Edge",
            specialty="Oncology",
            created_by=admin.id,
        )
        session.add(hcp)
        await session.flush()

        scenario = Scenario(
            name="Edge Scenario",
            product="Drug",
            status="active",
            hcp_profile_id=hcp.id,
            created_by=admin.id,
        )
        session.add(scenario)
        await session.flush()

        cs = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
            status="scored",
            overall_score=75.0,
            passed=True,
            completed_at=datetime.now(UTC),
            duration_seconds=300,
        )
        session.add(cs)
        await session.flush()

        score = SessionScore(
            session_id=cs.id,
            overall_score=75.0,
            passed=True,
        )
        session.add(score)
        await session.flush()

        detail = ScoreDetail(
            score_id=score.id,
            dimension="key_message",
            score=75.0,
            weight=30,
        )
        session.add(detail)

        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


class TestEdgeCases:
    """Edge case tests for analytics endpoints."""

    async def test_invalid_token_returns_401(self, client):
        """Invalid bearer token should return 401 for all endpoints."""
        invalid_token = "invalid.jwt.token"
        endpoints = [
            "/api/v1/analytics/dashboard",
            "/api/v1/analytics/trends",
            "/api/v1/analytics/recommendations",
            "/api/v1/analytics/export/sessions",
        ]
        for endpoint in endpoints:
            response = await client.get(
                endpoint,
                headers={"Authorization": f"Bearer {invalid_token}"},
            )
            assert response.status_code == 401, f"Expected 401 for {endpoint}"

    async def test_trends_limit_validation_too_low(self, client):
        """Trends limit below 1 should be rejected (422)."""
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/trends",
            params={"limit": 0},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    async def test_trends_limit_validation_too_high(self, client):
        """Trends limit above 100 should be rejected (422)."""
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/trends",
            params={"limit": 101},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    async def test_recommendations_limit_validation_too_low(self, client):
        """Recommendations limit below 1 should be rejected (422)."""
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/recommendations",
            params={"limit": 0},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    async def test_recommendations_limit_validation_too_high(self, client):
        """Recommendations limit above 10 should be rejected (422)."""
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/recommendations",
            params={"limit": 11},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    async def test_dashboard_empty_data_types(self, client):
        """Dashboard empty data should have correct types."""
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        data = response.json()
        assert isinstance(data["total_sessions"], int)
        assert isinstance(data["avg_score"], float)
        assert isinstance(data["this_week"], int)
        assert data["improvement"] is None

    async def test_export_sessions_content_disposition_filename(self, client):
        """Sessions export should have correct filename in Content-Disposition."""
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/export/sessions",
            headers={"Authorization": f"Bearer {token}"},
        )
        disposition = response.headers.get("content-disposition", "")
        assert "sessions-report.xlsx" in disposition

    async def test_admin_overview_empty_arrays_in_response(self, client):
        """Admin overview with no BU data should have empty arrays."""
        _, token = await _create_admin_and_token()
        response = await client.get(
            "/api/v1/analytics/admin/overview",
            headers={"Authorization": f"Bearer {token}"},
        )
        data = response.json()
        assert isinstance(data["bu_stats"], list)
        assert isinstance(data["skill_gaps"], list)

    async def test_trends_with_scored_data(self, client):
        """Trends endpoint with actual scored data returns trend points."""
        _, token = await _create_user_with_data_and_token()
        response = await client.get(
            "/api/v1/analytics/trends",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_export_sessions_content_type(self, client):
        """Sessions export should have the correct XLSX content type."""
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/export/sessions",
            headers={"Authorization": f"Bearer {token}"},
        )
        content_type = response.headers.get("content-type", "")
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in content_type

    async def test_admin_export_content_type(self, client):
        """Admin export should have the correct XLSX content type."""
        _, token = await _create_admin_and_token()
        response = await client.get(
            "/api/v1/analytics/export/admin-report",
            headers={"Authorization": f"Bearer {token}"},
        )
        content_type = response.headers.get("content-type", "")
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in content_type

    async def test_admin_skill_gaps_empty_returns_list(self, client):
        """Admin skill-gaps with no data should return empty list."""
        _, token = await _create_admin_and_token()
        response = await client.get(
            "/api/v1/analytics/admin/skill-gaps",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json() == []


class TestDateRangeFiltering:
    """Tests for date range query params on analytics endpoints."""

    async def test_trends_accepts_date_params(self, client):
        """Trends endpoint should accept start_date and end_date params."""
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/analytics/trends",
            params={"start_date": "2026-01-01", "end_date": "2026-12-31"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_admin_overview_accepts_date_params(self, client):
        """Admin overview endpoint should accept start_date and end_date params."""
        _, token = await _create_admin_and_token()
        response = await client.get(
            "/api/v1/analytics/admin/overview",
            params={"start_date": "2026-01-01", "end_date": "2026-12-31"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
