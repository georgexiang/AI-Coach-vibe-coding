"""Configuration API endpoint tests."""

from app.models.user import User
from app.services.auth import get_password_hash
from tests.conftest import TestSessionLocal


async def _create_and_login(client, username="configuser", password="pass123"):
    """Helper: create a user and return a valid auth token."""
    async with TestSessionLocal() as session:
        user = User(
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash(password),
            full_name=f"Test {username}",
            role="user",
        )
        session.add(user)
        await session.commit()

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    return login_resp.json()["access_token"]


class TestGetFeatures:
    """Tests for GET /api/v1/config/features."""

    async def test_get_features_with_auth_returns_200(self, client):
        token = await _create_and_login(client)
        response = await client.get(
            "/api/v1/config/features",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()

        # Verify feature flags present
        features = data["features"]
        assert "avatar_enabled" in features
        assert "voice_enabled" in features
        assert "realtime_voice_enabled" in features
        assert "conference_enabled" in features
        assert "default_voice_mode" in features
        assert "region" in features

        # Verify defaults
        assert features["avatar_enabled"] is False
        assert features["voice_enabled"] is False
        assert features["default_voice_mode"] == "text_only"
        assert features["region"] == "global"

        # Verify available_adapters is a dict
        assert "available_adapters" in data
        assert isinstance(data["available_adapters"], dict)

    async def test_get_features_without_auth_returns_401(self, client):
        response = await client.get("/api/v1/config/features")
        assert response.status_code == 401
