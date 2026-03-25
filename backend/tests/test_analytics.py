"""Analytics API endpoint tests covering all 7 analytics endpoints."""

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
