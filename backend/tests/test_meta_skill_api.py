"""API endpoint tests for /meta-skills router."""

from tests.conftest import TestSessionLocal

from app.models.meta_skill import MetaSkill
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_admin_user() -> tuple[str, str]:
    """Create an admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="admin_test",
            email="admin@test.com",
            hashed_password=get_password_hash("pass123"),
            role="admin",
            is_active=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


async def _create_regular_user() -> tuple[str, str]:
    """Create a non-admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="user_test",
            email="user@test.com",
            hashed_password=get_password_hash("pass123"),
            role="user",
            is_active=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


async def _seed_meta_skills() -> None:
    """Seed default creator and evaluator meta skills."""
    async with TestSessionLocal() as session:
        for skill_type, name, display_name in [
            ("creator", "skill_creator", "Skill Creator"),
            ("evaluator", "skill_evaluator", "Skill Evaluator"),
        ]:
            meta = MetaSkill(
                name=name,
                display_name=display_name,
                skill_type=skill_type,
                model="gpt-4o",
                template_content=f"Template for {skill_type}",
                template_language="en",
            )
            session.add(meta)
        await session.commit()


# ---------------------------------------------------------------------------
# GET /meta-skills
# ---------------------------------------------------------------------------


class TestListMetaSkills:
    async def test_requires_auth(self, client):
        resp = await client.get("/api/v1/meta-skills")
        assert resp.status_code == 401

    async def test_requires_admin_role(self, client):
        _, token = await _create_regular_user()
        resp = await client.get(
            "/api/v1/meta-skills",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    async def test_returns_empty_list(self, client):
        _, token = await _create_admin_user()
        resp = await client.get(
            "/api/v1/meta-skills",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_returns_seeded_skills(self, client):
        _, token = await _create_admin_user()
        await _seed_meta_skills()
        resp = await client.get(
            "/api/v1/meta-skills",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        types = {d["skill_type"] for d in data}
        assert types == {"creator", "evaluator"}


# ---------------------------------------------------------------------------
# GET /meta-skills/{skill_type}
# ---------------------------------------------------------------------------


class TestGetMetaSkill:
    async def test_not_found(self, client):
        _, token = await _create_admin_user()
        resp = await client.get(
            "/api/v1/meta-skills/creator",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_returns_creator(self, client):
        _, token = await _create_admin_user()
        await _seed_meta_skills()
        resp = await client.get(
            "/api/v1/meta-skills/creator",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["skill_type"] == "creator"
        assert data["name"] == "skill_creator"
        assert data["model"] == "gpt-4o"

    async def test_returns_evaluator(self, client):
        _, token = await _create_admin_user()
        await _seed_meta_skills()
        resp = await client.get(
            "/api/v1/meta-skills/evaluator",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["skill_type"] == "evaluator"

    async def test_response_shape(self, client):
        _, token = await _create_admin_user()
        await _seed_meta_skills()
        resp = await client.get(
            "/api/v1/meta-skills/creator",
            headers={"Authorization": f"Bearer {token}"},
        )
        data = resp.json()
        # Verify all expected fields exist
        expected_fields = {
            "id", "name", "display_name", "skill_type", "agent_id",
            "agent_version", "model", "template_content", "template_language",
            "is_active", "last_synced_at", "created_at", "updated_at",
        }
        assert set(data.keys()) >= expected_fields


# ---------------------------------------------------------------------------
# PUT /meta-skills/{skill_type}
# ---------------------------------------------------------------------------


class TestUpdateMetaSkill:
    async def test_update_model(self, client):
        _, token = await _create_admin_user()
        await _seed_meta_skills()
        resp = await client.put(
            "/api/v1/meta-skills/creator",
            json={"model": "gpt-4o-mini"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["model"] == "gpt-4o-mini"

    async def test_update_template_content(self, client):
        _, token = await _create_admin_user()
        await _seed_meta_skills()
        resp = await client.put(
            "/api/v1/meta-skills/evaluator",
            json={"template_content": "Updated evaluator template"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["template_content"] == "Updated evaluator template"

    async def test_update_language(self, client):
        _, token = await _create_admin_user()
        await _seed_meta_skills()
        resp = await client.put(
            "/api/v1/meta-skills/creator",
            json={"template_language": "zh"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["template_language"] == "zh"

    async def test_update_not_found(self, client):
        _, token = await _create_admin_user()
        resp = await client.put(
            "/api/v1/meta-skills/creator",
            json={"model": "gpt-4o-mini"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_partial_update_preserves_fields(self, client):
        _, token = await _create_admin_user()
        await _seed_meta_skills()
        # Only update model, template should remain the same
        resp = await client.put(
            "/api/v1/meta-skills/creator",
            json={"model": "gpt-4.1"},
            headers={"Authorization": f"Bearer {token}"},
        )
        data = resp.json()
        assert data["model"] == "gpt-4.1"
        assert data["template_content"] == "Template for creator"
        assert data["template_language"] == "en"

    async def test_requires_admin(self, client):
        _, token = await _create_regular_user()
        resp = await client.put(
            "/api/v1/meta-skills/creator",
            json={"model": "gpt-4o-mini"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# POST /meta-skills/{skill_type}/reset
# ---------------------------------------------------------------------------


class TestResetMetaSkill:
    async def test_reset_restores_default(self, client):
        _, token = await _create_admin_user()
        await _seed_meta_skills()
        # First update to custom content
        await client.put(
            "/api/v1/meta-skills/creator",
            json={"template_content": "CUSTOM"},
            headers={"Authorization": f"Bearer {token}"},
        )
        # Now reset
        resp = await client.post(
            "/api/v1/meta-skills/creator/reset",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["template_content"] != "CUSTOM"
        assert len(data["template_content"]) > 0

    async def test_reset_not_found(self, client):
        _, token = await _create_admin_user()
        resp = await client.post(
            "/api/v1/meta-skills/nonexistent/reset",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_requires_admin(self, client):
        _, token = await _create_regular_user()
        resp = await client.post(
            "/api/v1/meta-skills/creator/reset",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# POST /meta-skills/{skill_type}/sync (requires external services — light tests)
# ---------------------------------------------------------------------------


class TestSyncMetaSkill:
    async def test_sync_not_found(self, client):
        _, token = await _create_admin_user()
        resp = await client.post(
            "/api/v1/meta-skills/creator/sync",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_requires_admin(self, client):
        _, token = await _create_regular_user()
        resp = await client.post(
            "/api/v1/meta-skills/creator/sync",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
