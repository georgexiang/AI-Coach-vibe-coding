"""Tests for meta-skill resource listing and download endpoints."""

from tests.conftest import TestSessionLocal

from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from app.services.meta_skill_service import (
    get_meta_skill_resource_content,
    list_meta_skill_resources,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_admin_user() -> tuple[str, str]:
    """Create an admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="admin_res",
            email="admin_res@test.com",
            hashed_password=get_password_hash("pass123"),
            role="admin",
            is_active=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


# ---------------------------------------------------------------------------
# Service-level tests
# ---------------------------------------------------------------------------


class TestListMetaSkillResources:
    def test_creator_has_references_and_scripts(self):
        resources = list_meta_skill_resources("creator")
        types = {r["resource_type"] for r in resources}
        assert "reference" in types
        assert "script" in types

    def test_creator_reference_count(self):
        resources = list_meta_skill_resources("creator")
        refs = [r for r in resources if r["resource_type"] == "reference"]
        assert len(refs) == 3  # output-schema.json, scoring-rubric.md, sop-structure-guide.md

    def test_creator_script_count(self):
        resources = list_meta_skill_resources("creator")
        scripts = [r for r in resources if r["resource_type"] == "script"]
        assert len(scripts) == 1  # validate_creator_output.py

    def test_evaluator_has_references_and_scripts(self):
        resources = list_meta_skill_resources("evaluator")
        types = {r["resource_type"] for r in resources}
        assert "reference" in types
        assert "script" in types

    def test_evaluator_reference_count(self):
        resources = list_meta_skill_resources("evaluator")
        refs = [r for r in resources if r["resource_type"] == "reference"]
        assert len(refs) == 3  # evaluation-dimensions.md, output-schema.json, quality-standards.md

    def test_evaluator_script_count(self):
        resources = list_meta_skill_resources("evaluator")
        scripts = [r for r in resources if r["resource_type"] == "script"]
        assert len(scripts) == 1  # validate_evaluator_output.py

    def test_invalid_type_returns_empty(self):
        resources = list_meta_skill_resources("nonexistent")
        assert resources == []

    def test_resource_fields_present(self):
        resources = list_meta_skill_resources("creator")
        assert len(resources) > 0
        r = resources[0]
        assert "id" in r
        assert "resource_type" in r
        assert "filename" in r
        assert "content_type" in r
        assert "file_size" in r
        assert r["file_size"] > 0
        assert "created_at" in r
        assert "updated_at" in r

    def test_resource_ids_unique(self):
        resources = list_meta_skill_resources("creator")
        ids = [r["id"] for r in resources]
        assert len(ids) == len(set(ids))


class TestGetMetaSkillResourceContent:
    def test_read_reference_file(self):
        result = get_meta_skill_resource_content("creator", "reference", "scoring-rubric.md")
        assert result is not None
        content_type, data = result
        assert content_type == "text/markdown"
        assert len(data) > 0
        assert b"sop_completeness" in data

    def test_read_script_file(self):
        result = get_meta_skill_resource_content("creator", "script", "validate_creator_output.py")
        assert result is not None
        content_type, data = result
        assert content_type == "text/x-python"
        assert b"def validate" in data

    def test_not_found_returns_none(self):
        result = get_meta_skill_resource_content("creator", "reference", "nonexistent.md")
        assert result is None

    def test_invalid_type_returns_none(self):
        result = get_meta_skill_resource_content("bogus", "reference", "scoring-rubric.md")
        assert result is None

    def test_invalid_resource_type_returns_none(self):
        result = get_meta_skill_resource_content("creator", "asset", "something.md")
        assert result is None

    def test_path_traversal_blocked(self):
        result = get_meta_skill_resource_content("creator", "reference", "../SKILL.md")
        assert result is None

    def test_path_traversal_slash_blocked(self):
        result = get_meta_skill_resource_content("creator", "reference", "foo/../../SKILL.md")
        assert result is None

    def test_empty_filename_blocked(self):
        result = get_meta_skill_resource_content("creator", "reference", "")
        assert result is None


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------


class TestListResourcesEndpoint:
    async def test_requires_auth(self, client):
        resp = await client.get("/api/v1/meta-skills/creator/resources")
        assert resp.status_code == 401

    async def test_list_creator_resources(self, client):
        _, token = await _create_admin_user()
        resp = await client.get(
            "/api/v1/meta-skills/creator/resources",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 4  # 3 refs + 1 script

    async def test_list_evaluator_resources(self, client):
        _, token = await _create_admin_user()
        resp = await client.get(
            "/api/v1/meta-skills/evaluator/resources",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 4

    async def test_invalid_type_returns_404(self, client):
        _, token = await _create_admin_user()
        resp = await client.get(
            "/api/v1/meta-skills/nonexistent/resources",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404


class TestDownloadResourceEndpoint:
    async def test_download_reference(self, client):
        _, token = await _create_admin_user()
        resp = await client.get(
            "/api/v1/meta-skills/creator/resources/reference/scoring-rubric.md",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert "sop_completeness" in resp.text

    async def test_download_script(self, client):
        _, token = await _create_admin_user()
        resp = await client.get(
            "/api/v1/meta-skills/creator/resources/script/validate_creator_output.py",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert "def validate" in resp.text

    async def test_not_found(self, client):
        _, token = await _create_admin_user()
        resp = await client.get(
            "/api/v1/meta-skills/creator/resources/reference/nonexistent.md",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_path_traversal_rejected(self, client):
        _, token = await _create_admin_user()
        # URL with ../ gets normalized by HTTP layer, so test the service
        # function directly instead (tested in TestGetMetaSkillResourceContent).
        # At the API level, try a filename with dots that wouldn't match.
        resp = await client.get(
            "/api/v1/meta-skills/creator/resources/reference/..%2FSKILL.md",
            headers={"Authorization": f"Bearer {token}"},
        )
        # Percent-encoded traversal should be caught (404 or redirect)
        assert resp.status_code in (307, 404, 422)
