"""Tests for Rubric CRUD API endpoints (admin-only)."""

from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _create_admin_and_token() -> tuple[str, str]:
    """Create an admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="rubric_admin",
            email="rubric_admin@test.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Rubric Admin",
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
            username="rubric_user",
            email="rubric_user@test.com",
            hashed_password=get_password_hash("pass123"),
            full_name="Regular User",
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


def _make_rubric_payload(**overrides) -> dict:
    """Create a valid rubric creation payload."""
    data = {
        "name": "Test Rubric",
        "description": "Test description",
        "scenario_type": "f2f",
        "dimensions": [
            {"name": "key_message", "weight": 40, "criteria": ["c1", "c2"]},
            {"name": "communication", "weight": 35, "criteria": ["c3"]},
            {"name": "product_knowledge", "weight": 25, "criteria": ["c4"]},
        ],
        "is_default": False,
    }
    data.update(overrides)
    return data


class TestCreateRubricEndpoint:
    """Tests for POST /api/v1/rubrics/."""

    async def test_admin_can_create_rubric(self, client):
        _, token = await _create_admin_and_token()
        payload = _make_rubric_payload()
        response = await client.post(
            "/api/v1/rubrics/",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Rubric"
        assert data["scenario_type"] == "f2f"
        assert len(data["dimensions"]) == 3
        assert "id" in data

    async def test_non_admin_gets_403(self, client):
        _, token = await _create_user_and_token()
        response = await client.post(
            "/api/v1/rubrics/",
            json=_make_rubric_payload(),
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    async def test_no_auth_returns_401(self, client):
        response = await client.post(
            "/api/v1/rubrics/",
            json=_make_rubric_payload(),
        )
        assert response.status_code == 401


class TestListRubricsEndpoint:
    """Tests for GET /api/v1/rubrics/."""

    async def test_lists_rubrics(self, client):
        _, token = await _create_admin_and_token()
        # Create two rubrics
        for name in ["R1", "R2"]:
            await client.post(
                "/api/v1/rubrics/",
                json=_make_rubric_payload(name=name),
                headers={"Authorization": f"Bearer {token}"},
            )

        response = await client.get(
            "/api/v1/rubrics/",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    async def test_filter_by_scenario_type(self, client):
        _, token = await _create_admin_and_token()
        await client.post(
            "/api/v1/rubrics/",
            json=_make_rubric_payload(name="F2F", scenario_type="f2f"),
            headers={"Authorization": f"Bearer {token}"},
        )
        await client.post(
            "/api/v1/rubrics/",
            json=_make_rubric_payload(name="Conf", scenario_type="conference"),
            headers={"Authorization": f"Bearer {token}"},
        )

        response = await client.get(
            "/api/v1/rubrics/?scenario_type=f2f",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "F2F"

    async def test_non_admin_gets_403(self, client):
        _, token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/rubrics/",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403


class TestGetRubricEndpoint:
    """Tests for GET /api/v1/rubrics/{id}."""

    async def test_get_existing_rubric(self, client):
        _, token = await _create_admin_and_token()
        create_resp = await client.post(
            "/api/v1/rubrics/",
            json=_make_rubric_payload(),
            headers={"Authorization": f"Bearer {token}"},
        )
        rubric_id = create_resp.json()["id"]

        response = await client.get(
            f"/api/v1/rubrics/{rubric_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Test Rubric"

    async def test_get_nonexistent_returns_404(self, client):
        _, token = await _create_admin_and_token()
        response = await client.get(
            "/api/v1/rubrics/nonexistent-id",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404


class TestUpdateRubricEndpoint:
    """Tests for PUT /api/v1/rubrics/{id}."""

    async def test_updates_rubric_fields(self, client):
        _, token = await _create_admin_and_token()
        create_resp = await client.post(
            "/api/v1/rubrics/",
            json=_make_rubric_payload(),
            headers={"Authorization": f"Bearer {token}"},
        )
        rubric_id = create_resp.json()["id"]

        response = await client.put(
            f"/api/v1/rubrics/{rubric_id}",
            json={"name": "Updated Rubric"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Rubric"


class TestDeleteRubricEndpoint:
    """Tests for DELETE /api/v1/rubrics/{id}."""

    async def test_deletes_rubric(self, client):
        _, token = await _create_admin_and_token()
        create_resp = await client.post(
            "/api/v1/rubrics/",
            json=_make_rubric_payload(),
            headers={"Authorization": f"Bearer {token}"},
        )
        rubric_id = create_resp.json()["id"]

        response = await client.delete(
            f"/api/v1/rubrics/{rubric_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 204

        # Verify deleted
        get_resp = await client.get(
            f"/api/v1/rubrics/{rubric_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert get_resp.status_code == 404

    async def test_delete_nonexistent_returns_404(self, client):
        _, token = await _create_admin_and_token()
        response = await client.delete(
            "/api/v1/rubrics/nonexistent-id",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404
