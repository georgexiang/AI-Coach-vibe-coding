"""Tests for Azure Config API endpoints: service status and connection testing."""

from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _create_admin_token() -> str:
    """Create an admin user and return bearer token."""
    async with TestSessionLocal() as session:
        user = User(
            username="admin_azure",
            email="admin_azure@test.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin Azure",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return create_access_token(data={"sub": user.id})


async def _create_user_token() -> str:
    """Create a regular user and return bearer token."""
    async with TestSessionLocal() as session:
        user = User(
            username="user_azure",
            email="user_azure@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Regular Azure",
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return create_access_token(data={"sub": user.id})


class TestListServicesEndpoint:
    """Tests for GET /api/v1/azure-config/services."""

    async def test_admin_can_list_services(self, client):
        token = await _create_admin_token()
        response = await client.get(
            "/api/v1/azure-config/services",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 4  # azure_openai, azure_speech, azure_avatar, azure_content

        service_names = {svc["name"] for svc in data}
        assert "azure_openai" in service_names
        assert "azure_speech" in service_names
        assert "azure_avatar" in service_names
        assert "azure_content" in service_names

    async def test_services_have_required_fields(self, client):
        token = await _create_admin_token()
        response = await client.get(
            "/api/v1/azure-config/services",
            headers={"Authorization": f"Bearer {token}"},
        )
        data = response.json()
        for svc in data:
            assert "name" in svc
            assert "display_name" in svc
            assert "status" in svc
            assert svc["status"] in ("connected", "not_configured")
            assert "masked_key" in svc

    async def test_non_admin_gets_403(self, client):
        token = await _create_user_token()
        response = await client.get(
            "/api/v1/azure-config/services",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    async def test_no_auth_returns_401(self, client):
        response = await client.get("/api/v1/azure-config/services")
        assert response.status_code == 401


class TestTestServiceEndpoint:
    """Tests for POST /api/v1/azure-config/services/{service_name}/test."""

    async def test_unknown_service_returns_failure(self, client):
        token = await _create_admin_token()
        response = await client.post(
            "/api/v1/azure-config/services/unknown_service/test",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "Unknown service" in data["message"]

    async def test_known_service_returns_result(self, client):
        """Testing a known service should return a structured result."""
        token = await _create_admin_token()
        response = await client.post(
            "/api/v1/azure-config/services/azure_openai/test",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "message" in data
        assert data["service"] == "azure_openai"
        assert isinstance(data["success"], bool)

    async def test_non_admin_gets_403(self, client):
        token = await _create_user_token()
        response = await client.post(
            "/api/v1/azure-config/services/azure_openai/test",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403


class TestMaskKeyFunction:
    """Tests for the _mask_key helper function."""

    async def test_mask_key_shows_last_4(self):
        from app.api.azure_config import _mask_key

        assert _mask_key("abcdef1234") == "****1234"

    async def test_mask_key_short_key(self):
        from app.api.azure_config import _mask_key

        assert _mask_key("ab") == "****"

    async def test_mask_key_empty(self):
        from app.api.azure_config import _mask_key

        assert _mask_key("") == ""

    async def test_mask_key_exactly_4(self):
        from app.api.azure_config import _mask_key

        assert _mask_key("abcd") == "****abcd"
