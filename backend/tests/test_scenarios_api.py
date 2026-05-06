"""Tests for Scenarios API endpoints (admin CRUD + user access to active scenarios)."""

from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _create_admin_and_token() -> tuple[str, str]:
    """Create an admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="admin_scn",
            email="admin_scn@test.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin Scenarios",
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
            username="user_scn",
            email="user_scn@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Regular Scn",
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


async def _create_hcp_profile(client, token, user_id) -> str:
    """Create an HCP profile and return its ID."""
    resp = await client.post(
        "/api/v1/hcp-profiles",
        json={"name": "Dr. Scn", "specialty": "Oncology", "created_by": user_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]


class TestCreateScenarioEndpoint:
    """Tests for POST /api/v1/scenarios/."""

    async def test_admin_creates_scenario(self, client):
        user_id, token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, token, user_id)

        response = await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Test Scenario",
                "product": "Brukinsa",
                "hcp_profile_id": hcp_id,
                "rubric_id": "test-rubric-id",
                "created_by": user_id,
                "key_messages": ["KM1", "KM2"],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Scenario"
        assert data["key_messages"] == ["KM1", "KM2"]
        assert data["status"] == "draft"
        assert data["rubric_id"] == "test-rubric-id"

    async def test_non_admin_gets_403(self, client):
        # Need admin to create HCP first
        admin_id, admin_token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, admin_token, admin_id)
        _, user_token = await _create_user_and_token()

        response = await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Nope",
                "product": "Drug",
                "hcp_profile_id": hcp_id,
                "rubric_id": "test-rubric-id",
                "created_by": "u1",
            },
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 403

    async def test_missing_rubric_id_returns_422(self, client):
        user_id, token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, token, user_id)

        response = await client.post(
            "/api/v1/scenarios",
            json={
                "name": "No Rubric",
                "product": "Drug",
                "hcp_profile_id": hcp_id,
                "created_by": user_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    async def test_nonexistent_hcp_returns_404(self, client):
        user_id, token = await _create_admin_and_token()
        response = await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Bad HCP",
                "product": "Drug",
                "hcp_profile_id": "nonexistent-hcp",
                "rubric_id": "test-rubric-id",
                "created_by": user_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404


class TestListScenariosEndpoint:
    """Tests for GET /api/v1/scenarios/."""

    async def test_list_returns_paginated(self, client):
        user_id, token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, token, user_id)

        for name in ["S1", "S2"]:
            await client.post(
                "/api/v1/scenarios",
                json={
                    "name": name,
                    "product": "Drug",
                    "hcp_profile_id": hcp_id,
                    "rubric_id": "test-rubric-id",
                    "created_by": user_id,
                },
                headers={"Authorization": f"Bearer {token}"},
            )

        response = await client.get(
            "/api/v1/scenarios",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    async def test_filter_by_status(self, client):
        user_id, token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, token, user_id)

        await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Draft",
                "product": "D",
                "hcp_profile_id": hcp_id,
                "rubric_id": "test-rubric-id",
                "created_by": user_id,
                "status": "draft",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Active",
                "product": "D",
                "hcp_profile_id": hcp_id,
                "rubric_id": "test-rubric-id",
                "created_by": user_id,
                "status": "active",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

        response = await client.get(
            "/api/v1/scenarios?status=active",
            headers={"Authorization": f"Bearer {token}"},
        )
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Active"


class TestListActiveScenariosEndpoint:
    """Tests for GET /api/v1/scenarios/active (user-accessible)."""

    async def test_user_can_list_active_scenarios(self, client):
        admin_id, admin_token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, admin_token, admin_id)

        # Create active scenario as admin
        await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Active For User",
                "product": "Drug",
                "hcp_profile_id": hcp_id,
                "rubric_id": "test-rubric-id",
                "created_by": admin_id,
                "status": "active",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # Regular user can access
        _, user_token = await _create_user_and_token()
        response = await client.get(
            "/api/v1/scenarios/active",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1


class TestGetScenarioEndpoint:
    """Tests for GET /api/v1/scenarios/{scenario_id}."""

    async def test_get_by_id(self, client):
        user_id, token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, token, user_id)

        create_resp = await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Single",
                "product": "Drug",
                "hcp_profile_id": hcp_id,
                "rubric_id": "test-rubric-id",
                "created_by": user_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        scn_id = create_resp.json()["id"]

        response = await client.get(
            f"/api/v1/scenarios/{scn_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Single"


class TestUpdateScenarioEndpoint:
    """Tests for PUT /api/v1/scenarios/{scenario_id}."""

    async def test_updates_scenario(self, client):
        user_id, token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, token, user_id)

        create_resp = await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Old",
                "product": "Drug",
                "hcp_profile_id": hcp_id,
                "rubric_id": "test-rubric-id",
                "created_by": user_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        scn_id = create_resp.json()["id"]

        response = await client.put(
            f"/api/v1/scenarios/{scn_id}",
            json={"name": "New Name"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "New Name"
        assert response.json()["status"] == "draft"  # status unchanged (use transition endpoint)


class TestDeleteScenarioEndpoint:
    """Tests for DELETE /api/v1/scenarios/{scenario_id}."""

    async def test_deletes_scenario(self, client):
        user_id, token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, token, user_id)

        create_resp = await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Del",
                "product": "Drug",
                "hcp_profile_id": hcp_id,
                "rubric_id": "test-rubric-id",
                "created_by": user_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        scn_id = create_resp.json()["id"]

        response = await client.delete(
            f"/api/v1/scenarios/{scn_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 204


class TestTransitionEndpoint:
    """Tests for POST /api/v1/scenarios/{scenario_id}/transition."""

    async def test_transition_draft_to_active(self, client):
        user_id, token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, token, user_id)

        create_resp = await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Draft to Active",
                "product": "Drug",
                "hcp_profile_id": hcp_id,
                "rubric_id": "test-rubric-id",
                "created_by": user_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        scn_id = create_resp.json()["id"]

        response = await client.post(
            f"/api/v1/scenarios/{scn_id}/transition",
            json={"status": "active"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "active"

    async def test_transition_active_to_archived(self, client):
        user_id, token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, token, user_id)

        create_resp = await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Active to Archived",
                "product": "Drug",
                "hcp_profile_id": hcp_id,
                "rubric_id": "test-rubric-id",
                "created_by": user_id,
                "status": "active",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        scn_id = create_resp.json()["id"]

        response = await client.post(
            f"/api/v1/scenarios/{scn_id}/transition",
            json={"status": "archived"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "archived"

    async def test_transition_invalid_returns_422(self, client):
        user_id, token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, token, user_id)

        create_resp = await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Cannot Skip",
                "product": "Drug",
                "hcp_profile_id": hcp_id,
                "rubric_id": "test-rubric-id",
                "created_by": user_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        scn_id = create_resp.json()["id"]

        # Try to go directly from draft to archived (invalid)
        response = await client.post(
            f"/api/v1/scenarios/{scn_id}/transition",
            json={"status": "archived"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    async def test_update_archived_scenario_returns_422(self, client):
        user_id, token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, token, user_id)

        # Create and archive a scenario
        create_resp = await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Will Archive",
                "product": "Drug",
                "hcp_profile_id": hcp_id,
                "rubric_id": "test-rubric-id",
                "created_by": user_id,
                "status": "active",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        scn_id = create_resp.json()["id"]

        await client.post(
            f"/api/v1/scenarios/{scn_id}/transition",
            json={"status": "archived"},
            headers={"Authorization": f"Bearer {token}"},
        )

        # Try to update archived scenario
        response = await client.put(
            f"/api/v1/scenarios/{scn_id}",
            json={"name": "New Name"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    async def test_non_admin_gets_403(self, client):
        admin_id, admin_token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, admin_token, admin_id)
        _, user_token = await _create_user_and_token()

        create_resp = await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Admin Only",
                "product": "Drug",
                "hcp_profile_id": hcp_id,
                "rubric_id": "test-rubric-id",
                "created_by": admin_id,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        scn_id = create_resp.json()["id"]

        response = await client.post(
            f"/api/v1/scenarios/{scn_id}/transition",
            json={"status": "active"},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 403


class TestCloneScenarioEndpoint:
    """Tests for POST /api/v1/scenarios/{scenario_id}/clone."""

    async def test_clones_scenario(self, client):
        user_id, token = await _create_admin_and_token()
        hcp_id = await _create_hcp_profile(client, token, user_id)

        create_resp = await client.post(
            "/api/v1/scenarios",
            json={
                "name": "Original",
                "product": "Drug",
                "hcp_profile_id": hcp_id,
                "rubric_id": "test-rubric-id",
                "created_by": user_id,
                "key_messages": ["KM1"],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        scn_id = create_resp.json()["id"]

        response = await client.post(
            f"/api/v1/scenarios/{scn_id}/clone",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Original (Copy)"
        assert data["status"] == "draft"
        assert data["id"] != scn_id
