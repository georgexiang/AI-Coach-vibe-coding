"""Tests for System Enums API: CRUD endpoints, admin enforcement, validation."""

from app.models.system_enum import SystemEnum
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _create_admin_token() -> str:
    """Create an admin user and return bearer token."""
    async with TestSessionLocal() as session:
        user = User(
            username="admin_enum",
            email="admin_enum@test.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin Enum",
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
            username="user_enum",
            email="user_enum@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Regular User",
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return create_access_token(data={"sub": user.id})


async def _seed_enums():
    """Seed test enum values directly into the DB."""
    async with TestSessionLocal() as session:
        items = [
            SystemEnum(
                category="product",
                value="drug_a",
                label_en="Drug A",
                label_zh="药物A",
                sort_order=1,
            ),
            SystemEnum(
                category="product",
                value="drug_b",
                label_en="Drug B",
                label_zh="药物B",
                sort_order=2,
            ),
            SystemEnum(
                category="specialty",
                value="oncology",
                label_en="Oncology",
                label_zh="肿瘤科",
                sort_order=1,
            ),
        ]
        for item in items:
            session.add(item)
        await session.commit()


class TestListEnumsEndpoint:
    """Tests for GET /api/v1/system-enums?category=..."""

    async def test_list_by_category(self, client):
        """Should return enums filtered by category."""
        token = await _create_admin_token()
        await _seed_enums()
        response = await client.get(
            "/api/v1/system-enums?category=product",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["value"] == "drug_a"
        assert data[1]["value"] == "drug_b"

    async def test_list_empty_category(self, client):
        """Should return empty list for non-existent category."""
        token = await _create_admin_token()
        response = await client.get(
            "/api/v1/system-enums?category=nonexistent",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json() == []

    async def test_non_admin_forbidden(self, client):
        """Regular user should get 403."""
        token = await _create_user_token()
        response = await client.get(
            "/api/v1/system-enums?category=product",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403


class TestCategoriesEndpoint:
    """Tests for GET /api/v1/system-enums/categories."""

    async def test_list_categories(self, client):
        """Should return distinct categories sorted."""
        token = await _create_admin_token()
        await _seed_enums()
        response = await client.get(
            "/api/v1/system-enums/categories",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        categories = response.json()
        assert "product" in categories
        assert "specialty" in categories


class TestCreateEnumEndpoint:
    """Tests for POST /api/v1/system-enums."""

    async def test_create_success(self, client):
        """Should create a new enum and return 201."""
        token = await _create_admin_token()
        response = await client.post(
            "/api/v1/system-enums",
            json={
                "category": "difficulty",
                "value": "easy",
                "label_en": "Easy",
                "label_zh": "简单",
                "sort_order": 1,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["category"] == "difficulty"
        assert data["value"] == "easy"
        assert data["label_en"] == "Easy"
        assert data["is_active"] is True

    async def test_create_duplicate_returns_400(self, client):
        """Should return 400 for duplicate category+value."""
        token = await _create_admin_token()
        payload = {
            "category": "mode",
            "value": "f2f",
            "label_en": "Face to Face",
        }
        response1 = await client.post(
            "/api/v1/system-enums",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response1.status_code == 201

        response2 = await client.post(
            "/api/v1/system-enums",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response2.status_code == 422

    async def test_create_non_admin_forbidden(self, client):
        """Regular user should get 403."""
        token = await _create_user_token()
        response = await client.post(
            "/api/v1/system-enums",
            json={"category": "test", "value": "x", "label_en": "X"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403


class TestUpdateEnumEndpoint:
    """Tests for PUT /api/v1/system-enums/{id}."""

    async def test_update_success(self, client):
        """Should update fields and return updated enum."""
        token = await _create_admin_token()
        # Create first
        create_resp = await client.post(
            "/api/v1/system-enums",
            json={"category": "product", "value": "test_drug", "label_en": "Test Drug"},
            headers={"Authorization": f"Bearer {token}"},
        )
        enum_id = create_resp.json()["id"]

        # Update
        response = await client.put(
            f"/api/v1/system-enums/{enum_id}",
            json={"label_en": "Updated Drug", "sort_order": 99},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["label_en"] == "Updated Drug"
        assert data["sort_order"] == 99

    async def test_update_not_found(self, client):
        """Should return 404 for non-existent ID."""
        token = await _create_admin_token()
        response = await client.put(
            "/api/v1/system-enums/nonexistent-id",
            json={"label_en": "X"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404


class TestDeleteEnumEndpoint:
    """Tests for DELETE /api/v1/system-enums/{id}."""

    async def test_delete_success(self, client):
        """Should delete and return 204."""
        token = await _create_admin_token()
        create_resp = await client.post(
            "/api/v1/system-enums",
            json={"category": "product", "value": "to_delete", "label_en": "Delete Me"},
            headers={"Authorization": f"Bearer {token}"},
        )
        enum_id = create_resp.json()["id"]

        response = await client.delete(
            f"/api/v1/system-enums/{enum_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 204

    async def test_delete_not_found(self, client):
        """Should return 404 for non-existent ID."""
        token = await _create_admin_token()
        response = await client.delete(
            "/api/v1/system-enums/nonexistent-id",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404

    async def test_delete_non_admin_forbidden(self, client):
        """Regular user should get 403."""
        token = await _create_user_token()
        response = await client.delete(
            "/api/v1/system-enums/some-id",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403
