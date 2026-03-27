"""Tests for Azure Config API: DB-backed CRUD, connection testing, admin enforcement."""

from unittest.mock import AsyncMock, patch

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

    async def test_list_services_empty(self, client):
        """GET returns empty list when no configs saved."""
        token = await _create_admin_token()
        response = await client.get(
            "/api/v1/azure-config/services",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    async def test_list_services_after_save(self, client):
        """After PUT, GET returns the saved config with masked key."""
        token = await _create_admin_token()
        # First save a config
        await client.put(
            "/api/v1/azure-config/services/azure_openai",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "endpoint": "https://test.openai.azure.com",
                "api_key": "sk-test-key-1234",
                "model_or_deployment": "gpt-4o",
                "region": "eastus",
            },
        )
        # Then list
        response = await client.get(
            "/api/v1/azure-config/services",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        svc = data[0]
        assert svc["service_name"] == "azure_openai"
        assert svc["endpoint"] == "https://test.openai.azure.com"
        assert "****" in svc["masked_key"]
        assert "1234" in svc["masked_key"]
        assert svc["model_or_deployment"] == "gpt-4o"
        assert svc["is_active"] is True

    async def test_no_auth_returns_401(self, client):
        response = await client.get("/api/v1/azure-config/services")
        assert response.status_code == 401


class TestPutServiceEndpoint:
    """Tests for PUT /api/v1/azure-config/services/{service_name}."""

    async def test_put_service_config(self, client):
        """PUT creates new config, returns 200 with ServiceConfigResponse."""
        token = await _create_admin_token()
        response = await client.put(
            "/api/v1/azure-config/services/azure_openai",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "endpoint": "https://test.openai.azure.com",
                "api_key": "sk-test-key-1234",
                "model_or_deployment": "gpt-4o",
                "region": "eastus",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["service_name"] == "azure_openai"
        assert data["display_name"] == "Azure OpenAI"
        assert data["endpoint"] == "https://test.openai.azure.com"
        assert data["is_active"] is True

    async def test_put_updates_existing_config(self, client):
        """PUT updates existing config preserving key if not provided."""
        token = await _create_admin_token()
        # Create initial config
        await client.put(
            "/api/v1/azure-config/services/azure_openai",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "endpoint": "https://old.openai.azure.com",
                "api_key": "sk-old-key",
                "model_or_deployment": "gpt-4",
                "region": "westus",
            },
        )
        # Update with new endpoint but no key (should preserve old key)
        response = await client.put(
            "/api/v1/azure-config/services/azure_openai",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "endpoint": "https://new.openai.azure.com",
                "api_key": "",
                "model_or_deployment": "gpt-4o",
                "region": "eastus",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["endpoint"] == "https://new.openai.azure.com"
        assert data["model_or_deployment"] == "gpt-4o"
        # Key should still be masked (preserved from old)
        assert "****" in data["masked_key"]

    async def test_put_unknown_service_returns_400(self, client):
        """PUT with unknown service name returns 400."""
        token = await _create_admin_token()
        response = await client.put(
            "/api/v1/azure-config/services/unknown_svc",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "endpoint": "https://test.com",
                "api_key": "key123",
                "model_or_deployment": "",
                "region": "",
            },
        )
        assert response.status_code == 400

    async def test_put_non_admin_gets_403(self, client):
        token = await _create_user_token()
        response = await client.put(
            "/api/v1/azure-config/services/azure_openai",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "endpoint": "https://test.com",
                "api_key": "key123",
            },
        )
        assert response.status_code == 403


class TestTestConnectionEndpoint:
    """Tests for POST /api/v1/azure-config/services/{service_name}/test."""

    async def test_test_connection_not_configured(self, client):
        """Test returns success=False when service is not configured."""
        token = await _create_admin_token()
        response = await client.post(
            "/api/v1/azure-config/services/azure_openai/test",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["service_name"] == "azure_openai"
        assert "not configured" in data["message"].lower()

    @patch(
        "app.api.azure_config.test_service_connection",
        new_callable=AsyncMock,
        return_value=(True, "Connection successful"),
    )
    async def test_test_connection_after_save(self, mock_test, client):
        """Test calls connection tester after config is saved."""
        token = await _create_admin_token()
        # Save config first
        await client.put(
            "/api/v1/azure-config/services/azure_openai",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "endpoint": "https://test.openai.azure.com",
                "api_key": "sk-test-key",
                "model_or_deployment": "gpt-4o",
                "region": "eastus",
            },
        )
        # Test connection
        response = await client.post(
            "/api/v1/azure-config/services/azure_openai/test",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["service_name"] == "azure_openai"
        mock_test.assert_called_once()

    async def test_test_non_admin_gets_403(self, client):
        token = await _create_user_token()
        response = await client.post(
            "/api/v1/azure-config/services/azure_openai/test",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    async def test_test_no_auth_returns_401(self, client):
        response = await client.post("/api/v1/azure-config/services/azure_openai/test")
        assert response.status_code == 401


class TestAdminRoleEnforcement:
    """Verify all endpoints require admin role."""

    async def test_get_requires_admin(self, client):
        token = await _create_user_token()
        response = await client.get(
            "/api/v1/azure-config/services",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    async def test_put_requires_admin(self, client):
        token = await _create_user_token()
        response = await client.put(
            "/api/v1/azure-config/services/azure_openai",
            headers={"Authorization": f"Bearer {token}"},
            json={"endpoint": "https://x.com", "api_key": "k"},
        )
        assert response.status_code == 403

    async def test_test_requires_admin(self, client):
        token = await _create_user_token()
        response = await client.post(
            "/api/v1/azure-config/services/azure_openai/test",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403
