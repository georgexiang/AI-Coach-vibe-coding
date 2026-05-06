"""Tests for System Enums API and service layer."""

import pytest

from app.models.system_enum import SystemEnum
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _create_admin_and_token() -> tuple[str, str]:
    """Create an admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="admin_enum",
            email="admin_enum@test.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin Enums",
            role="admin",
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
            username="user_enum",
            email="user_enum@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Regular Enum User",
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


async def _seed_enums() -> list[str]:
    """Seed some test enum values and return their IDs."""
    async with TestSessionLocal() as session:
        enums = [
            SystemEnum(
                category="product",
                value="drug_a",
                label_en="Drug A",
                label_zh="药品A",
                sort_order=0,
                is_active=True,
            ),
            SystemEnum(
                category="product",
                value="drug_b",
                label_en="Drug B",
                label_zh="药品B",
                sort_order=1,
                is_active=True,
            ),
            SystemEnum(
                category="specialty",
                value="oncology",
                label_en="Oncology",
                label_zh="肿瘤科",
                sort_order=0,
                is_active=True,
            ),
            SystemEnum(
                category="product",
                value="drug_inactive",
                label_en="Inactive Drug",
                label_zh="停用药品",
                sort_order=2,
                is_active=False,
            ),
        ]
        for e in enums:
            session.add(e)
        await session.commit()
        for e in enums:
            await session.refresh(e)
        return [e.id for e in enums]


class TestListEnumsEndpoint:
    """Tests for GET /api/v1/system-enums."""

    async def test_list_all_enums_no_auth_required(self, client):
        """GET /system-enums is public (no auth needed for dropdown consumption)."""
        await _seed_enums()
        response = await client.get("/api/v1/system-enums")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # active_only=True by default, so inactive not included
        assert len(data) == 3

    async def test_list_by_category(self, client):
        await _seed_enums()
        response = await client.get("/api/v1/system-enums?category=product")
        assert response.status_code == 200
        data = response.json()
        # Only active products: drug_a and drug_b
        assert len(data) == 2
        assert all(item["category"] == "product" for item in data)

    async def test_list_includes_inactive_when_flag_false(self, client):
        await _seed_enums()
        response = await client.get("/api/v1/system-enums?category=product&active_only=false")
        assert response.status_code == 200
        data = response.json()
        # All products including inactive
        assert len(data) == 3

    async def test_list_returns_sorted_by_sort_order(self, client):
        await _seed_enums()
        response = await client.get("/api/v1/system-enums?category=product")
        data = response.json()
        assert data[0]["value"] == "drug_a"
        assert data[1]["value"] == "drug_b"

    async def test_list_empty_category_returns_empty(self, client):
        await _seed_enums()
        response = await client.get("/api/v1/system-enums?category=nonexistent")
        assert response.status_code == 200
        assert response.json() == []


class TestCreateEnumEndpoint:
    """Tests for POST /api/v1/system-enums."""

    async def test_admin_creates_enum(self, client):
        _, token = await _create_admin_and_token()
        response = await client.post(
            "/api/v1/system-enums",
            json={
                "category": "difficulty",
                "value": "expert",
                "label_en": "Expert",
                "label_zh": "专家级",
                "sort_order": 3,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["category"] == "difficulty"
        assert data["value"] == "expert"
        assert data["label_en"] == "Expert"
        assert data["label_zh"] == "专家级"
        assert data["sort_order"] == 3
        assert data["is_active"] is True
        assert "id" in data

    async def test_non_admin_gets_403(self, client):
        _, token = await _create_user_and_token()
        response = await client.post(
            "/api/v1/system-enums",
            json={
                "category": "product",
                "value": "new_drug",
                "label_en": "New Drug",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    async def test_unauthenticated_gets_401(self, client):
        response = await client.post(
            "/api/v1/system-enums",
            json={
                "category": "product",
                "value": "new_drug",
                "label_en": "New Drug",
            },
        )
        assert response.status_code == 401

    async def test_create_with_defaults(self, client):
        _, token = await _create_admin_and_token()
        response = await client.post(
            "/api/v1/system-enums",
            json={
                "category": "product",
                "value": "minimal",
                "label_en": "Minimal",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["label_zh"] == ""
        assert data["sort_order"] == 0
        assert data["is_active"] is True

    async def test_missing_required_field_returns_422(self, client):
        _, token = await _create_admin_and_token()
        response = await client.post(
            "/api/v1/system-enums",
            json={"category": "product"},  # missing value and label_en
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422


class TestUpdateEnumEndpoint:
    """Tests for PUT /api/v1/system-enums/{enum_id}."""

    async def test_admin_updates_enum(self, client):
        _, token = await _create_admin_and_token()
        ids = await _seed_enums()
        enum_id = ids[0]

        response = await client.put(
            f"/api/v1/system-enums/{enum_id}",
            json={"label_en": "Updated Drug A", "sort_order": 99},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["label_en"] == "Updated Drug A"
        assert data["sort_order"] == 99

    async def test_update_nonexistent_returns_404(self, client):
        _, token = await _create_admin_and_token()
        response = await client.put(
            "/api/v1/system-enums/nonexistent-id",
            json={"label_en": "Nope"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404

    async def test_non_admin_gets_403(self, client):
        _, token = await _create_user_and_token()
        ids = await _seed_enums()
        response = await client.put(
            f"/api/v1/system-enums/{ids[0]}",
            json={"label_en": "Hack"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    async def test_deactivate_enum(self, client):
        _, token = await _create_admin_and_token()
        ids = await _seed_enums()
        response = await client.put(
            f"/api/v1/system-enums/{ids[0]}",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False


class TestDeleteEnumEndpoint:
    """Tests for DELETE /api/v1/system-enums/{enum_id}."""

    async def test_admin_deletes_enum(self, client):
        _, token = await _create_admin_and_token()
        ids = await _seed_enums()
        enum_id = ids[0]

        response = await client.delete(
            f"/api/v1/system-enums/{enum_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 204

        # Verify deleted
        get_resp = await client.get("/api/v1/system-enums?category=product")
        values = [item["value"] for item in get_resp.json()]
        assert "drug_a" not in values

    async def test_delete_nonexistent_returns_404(self, client):
        _, token = await _create_admin_and_token()
        response = await client.delete(
            "/api/v1/system-enums/nonexistent-id",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404

    async def test_non_admin_gets_403(self, client):
        _, token = await _create_user_and_token()
        ids = await _seed_enums()
        response = await client.delete(
            f"/api/v1/system-enums/{ids[0]}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403


class TestSystemEnumServiceLayer:
    """Tests for system_enum_service functions directly."""

    async def test_get_enums_by_category_returns_sorted(self):
        await _seed_enums()
        from app.services import system_enum_service

        async with TestSessionLocal() as session:
            items = await system_enum_service.get_enums_by_category(session, "product")
            assert len(items) == 2
            assert items[0].sort_order <= items[1].sort_order

    async def test_get_enums_by_category_active_only_false(self):
        await _seed_enums()
        from app.services import system_enum_service

        async with TestSessionLocal() as session:
            items = await system_enum_service.get_enums_by_category(
                session, "product", active_only=False
            )
            assert len(items) == 3

    async def test_get_all_enums(self):
        await _seed_enums()
        from app.services import system_enum_service

        async with TestSessionLocal() as session:
            items = await system_enum_service.get_all_enums(session)
            assert len(items) == 3  # 2 active products + 1 specialty (active_only=True default)

    async def test_get_all_enums_including_inactive(self):
        await _seed_enums()
        from app.services import system_enum_service

        async with TestSessionLocal() as session:
            items = await system_enum_service.get_all_enums(session, active_only=False)
            assert len(items) == 4  # includes inactive product

    async def test_create_enum(self):
        from app.schemas.system_enum import SystemEnumCreate
        from app.services import system_enum_service

        async with TestSessionLocal() as session:
            data = SystemEnumCreate(
                category="test_cat",
                value="test_val",
                label_en="Test",
                label_zh="测试",
            )
            result = await system_enum_service.create_enum(session, data)
            assert result.id is not None
            assert result.category == "test_cat"
            assert result.value == "test_val"

    async def test_update_enum(self):
        ids = await _seed_enums()
        from app.schemas.system_enum import SystemEnumUpdate
        from app.services import system_enum_service

        async with TestSessionLocal() as session:
            data = SystemEnumUpdate(label_en="Modified")
            result = await system_enum_service.update_enum(session, ids[0], data)
            assert result.label_en == "Modified"

    async def test_update_nonexistent_raises(self):
        from app.schemas.system_enum import SystemEnumUpdate
        from app.services import system_enum_service
        from app.utils.exceptions import AppException

        async with TestSessionLocal() as session:
            data = SystemEnumUpdate(label_en="Nope")
            with pytest.raises(AppException):
                await system_enum_service.update_enum(session, "fake-id", data)

    async def test_delete_enum(self):
        ids = await _seed_enums()
        from app.services import system_enum_service

        async with TestSessionLocal() as session:
            await system_enum_service.delete_enum(session, ids[0])
            # Verify gone
            items = await system_enum_service.get_enums_by_category(session, "product")
            assert all(item.id != ids[0] for item in items)

    async def test_delete_nonexistent_raises(self):
        from app.services import system_enum_service
        from app.utils.exceptions import AppException

        async with TestSessionLocal() as session:
            with pytest.raises(AppException):
                await system_enum_service.delete_enum(session, "fake-id")
