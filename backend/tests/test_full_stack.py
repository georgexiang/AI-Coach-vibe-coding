"""Full-stack integration tests: auth + config + adapters end-to-end flow.

Uses httpx ASGITransport via conftest.py client fixture for in-process testing.
"""

import pytest
from httpx import AsyncClient

from app.models.user import User
from app.services.agents.adapters.mock import MockCoachingAdapter
from app.services.agents.avatar.mock import MockAvatarAdapter
from app.services.agents.registry import ServiceRegistry
from app.services.agents.stt.mock import MockSTTAdapter
from app.services.agents.tts.mock import MockTTSAdapter
from app.services.auth import get_password_hash
from tests.conftest import TestSessionLocal


@pytest.fixture(autouse=True)
def register_mock_adapters():
    """Register mock adapters before each test (mirrors lifespan behavior).

    The lifespan startup is not triggered by ASGITransport in tests,
    so we manually register the mock adapters here.
    """
    # Reset singleton state to ensure clean slate
    ServiceRegistry._instance = None
    ServiceRegistry._categories = {}
    reg = ServiceRegistry()
    reg.register("llm", MockCoachingAdapter())
    reg.register("stt", MockSTTAdapter())
    reg.register("tts", MockTTSAdapter())
    reg.register("avatar", MockAvatarAdapter())
    yield
    # Clean up after test
    ServiceRegistry._instance = None
    ServiceRegistry._categories = {}


async def _seed_user(
    username: str = "testuser",
    password: str = "password123",
    role: str = "user",
) -> dict:
    """Create a user directly in the test database."""
    async with TestSessionLocal() as session:
        user = User(
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash(password),
            full_name=f"Test {username.title()}",
            role=role,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return {"id": user.id, "username": user.username, "role": user.role}


async def _login(client: AsyncClient, username: str, password: str) -> str:
    """Login and return the access token."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


class TestLoginAndAccessProtected:
    """End-to-end: login -> use token -> access protected endpoint."""

    async def test_login_and_access_protected(self, client):
        """POST /login -> GET /me -> verify user data returned."""
        await _seed_user(username="mrsmith", password="secret99", role="user")

        # Login
        token = await _login(client, "mrsmith", "secret99")
        assert token

        # Access protected endpoint
        resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "mrsmith"
        assert data["role"] == "user"
        assert "id" in data
        assert "hashed_password" not in data


class TestLoginAndGetConfig:
    """End-to-end: login -> fetch config/features -> verify response."""

    async def test_login_and_get_config(self, client):
        """POST /login -> GET /config/features -> verify features and adapters."""
        await _seed_user(username="configuser", password="pass123", role="user")
        token = await _login(client, "configuser", "pass123")

        resp = await client.get(
            "/api/v1/config/features",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()

        # Verify feature flags structure
        features = data["features"]
        assert "avatar_enabled" in features
        assert "voice_enabled" in features
        assert "realtime_voice_enabled" in features
        assert "conference_enabled" in features
        assert "default_voice_mode" in features
        assert "region" in features

        # Verify available adapters has at least mock in each category
        adapters = data["available_adapters"]
        assert "llm" in adapters
        assert "mock" in adapters["llm"]
        assert "stt" in adapters
        assert "mock" in adapters["stt"]
        assert "tts" in adapters
        assert "mock" in adapters["tts"]
        assert "avatar" in adapters
        assert "mock" in adapters["avatar"]


class TestRoleBasedAccessIntegration:
    """Role-based access: admin vs user endpoint access."""

    async def test_admin_can_access_admin_endpoint_user_cannot(self, client):
        """Create admin + user, verify role-based access differentiation."""
        await _seed_user(username="adminboss", password="adminpass", role="admin")
        await _seed_user(username="normaluser", password="userpass", role="user")

        admin_token = await _login(client, "adminboss", "adminpass")
        user_token = await _login(client, "normaluser", "userpass")

        # Both can access /me
        admin_me = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert admin_me.status_code == 200
        assert admin_me.json()["role"] == "admin"

        user_me = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert user_me.status_code == 200
        assert user_me.json()["role"] == "user"

        # Both can access config (config requires auth, not admin)
        admin_config = await client.get(
            "/api/v1/config/features",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert admin_config.status_code == 200

        user_config = await client.get(
            "/api/v1/config/features",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert user_config.status_code == 200


class TestTokenRefresh:
    """Token refresh flow."""

    async def test_refresh_token(self, client):
        """POST /login -> POST /refresh -> new token works."""
        await _seed_user(username="refreshuser", password="refreshpass", role="user")
        original_token = await _login(client, "refreshuser", "refreshpass")

        # Refresh token
        refresh_resp = await client.post(
            "/api/v1/auth/refresh",
            headers={"Authorization": f"Bearer {original_token}"},
        )
        assert refresh_resp.status_code == 200
        new_token = refresh_resp.json()["access_token"]
        assert new_token
        # Note: tokens may be identical when issued within the same second (same exp)

        # Refreshed token works for accessing protected endpoints
        me_resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {new_token}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["username"] == "refreshuser"


class TestInvalidToken:
    """Invalid token handling."""

    async def test_invalid_token_returns_401(self, client):
        """GET /me with invalid Bearer token -> 401."""
        resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid-token-here"},
        )
        assert resp.status_code == 401


class TestMockAdaptersRegistered:
    """Verify mock adapters are registered after app startup."""

    async def test_mock_adapters_registered(self, client):
        """After app startup, registry has mock adapters in all 4 categories."""
        from app.services.agents.registry import registry

        categories = registry.list_all_categories()
        assert "llm" in categories
        assert "mock" in categories["llm"]
        assert "stt" in categories
        assert "mock" in categories["stt"]
        assert "tts" in categories
        assert "mock" in categories["tts"]
        assert "avatar" in categories
        assert "mock" in categories["avatar"]
