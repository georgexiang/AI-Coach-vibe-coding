"""Skill API integration tests."""

import io
import zipfile

import yaml

from app.models.material import MaterialVersion, TrainingMaterial
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from app.services.storage import get_storage
from tests.conftest import TestSessionLocal


async def _create_admin_and_token(username="skill_api_admin") -> tuple[str, str]:
    """Create an admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Skill API Admin",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


def _make_skill_zip(name: str = "API Import Skill") -> bytes:
    """Create a valid Skill ZIP for API testing."""
    frontmatter = yaml.dump(
        {"name": name, "description": "API test import", "product": "APIProd"},
        allow_unicode=True,
    )
    skill_md = f"---\n{frontmatter}---\n\n## Step 1\nAPI test content"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w") as zf:
        zf.writestr("SKILL.md", skill_md)
        zf.writestr("references/doc.txt", "Reference content")
    return buf.getvalue()


class TestSkillCrudApi:
    """Test Skill CRUD API endpoints."""

    async def test_create_skill_api(self, client):
        _, token = await _create_admin_and_token("create_api_admin")
        response = await client.post(
            "/api/v1/skills",
            json={"name": "API Skill", "description": "Created via API", "product": "APIProd"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "API Skill"
        assert data["status"] == "draft"
        assert "id" in data

    async def test_list_skills_api(self, client):
        _, token = await _create_admin_and_token("list_api_admin")

        # Create 3 skills
        for i in range(3):
            await client.post(
                "/api/v1/skills",
                json={"name": f"List Skill {i}", "product": "P"},
                headers={"Authorization": f"Bearer {token}"},
            )

        response = await client.get(
            "/api/v1/skills",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["items"]) == 3

    async def test_get_skill_api(self, client):
        _, token = await _create_admin_and_token("get_api_admin")
        create_resp = await client.post(
            "/api/v1/skills",
            json={"name": "Get Skill", "product": "P"},
            headers={"Authorization": f"Bearer {token}"},
        )
        skill_id = create_resp.json()["id"]

        response = await client.get(
            f"/api/v1/skills/{skill_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Get Skill"

    async def test_delete_skill_api(self, client):
        _, token = await _create_admin_and_token("delete_api_admin")
        create_resp = await client.post(
            "/api/v1/skills",
            json={"name": "Delete Skill", "product": "P"},
            headers={"Authorization": f"Bearer {token}"},
        )
        skill_id = create_resp.json()["id"]

        response = await client.delete(
            f"/api/v1/skills/{skill_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 204


class TestSkillZipApi:
    """Test ZIP export/import API endpoints."""

    async def test_export_api(self, client):
        _, token = await _create_admin_and_token("export_api_admin")

        # Create a skill
        create_resp = await client.post(
            "/api/v1/skills",
            json={"name": "Export API Skill", "content": "SOP", "product": "P"},
            headers={"Authorization": f"Bearer {token}"},
        )
        skill_id = create_resp.json()["id"]

        response = await client.get(
            f"/api/v1/skills/{skill_id}/export",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/zip"

        # Verify it's a valid ZIP
        zf = zipfile.ZipFile(io.BytesIO(response.content))
        assert "SKILL.md" in zf.namelist()
        zf.close()

    async def test_import_api(self, client):
        _, token = await _create_admin_and_token("import_api_admin")
        zip_bytes = _make_skill_zip("Import API Skill")

        response = await client.post(
            "/api/v1/skills/import",
            files={"file": ("skill.zip", zip_bytes, "application/zip")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Import API Skill"
        assert "id" in data

    async def test_import_invalid_zip(self, client):
        _, token = await _create_admin_and_token("import_inv_admin")

        response = await client.post(
            "/api/v1/skills/import",
            files={"file": ("bad.zip", b"not a zip", "application/zip")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    async def test_import_non_zip_extension(self, client):
        _, token = await _create_admin_and_token("import_ext_admin")

        response = await client.post(
            "/api/v1/skills/import",
            files={"file": ("doc.pdf", b"pdf-content", "application/pdf")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422


async def _seed_material(user_id: str) -> str:
    """Create a training material with a file and return its ID."""
    async with TestSessionLocal() as session:
        material = TrainingMaterial(
            name="Test Material",
            product="TestProd",
            created_by=user_id,
        )
        session.add(material)
        await session.flush()

        # Save a dummy file
        storage = get_storage()
        storage_path = f"materials/{material.id}/v1/test_doc.pdf"
        await storage.save(storage_path, b"%PDF-1.4 test content")

        version = MaterialVersion(
            material_id=material.id,
            version_number=1,
            filename="test_doc.pdf",
            file_size=21,
            content_type="application/pdf",
            storage_url=storage_path,
            is_active=True,
        )
        session.add(version)
        await session.commit()
        return material.id


class TestSkillFromMaterialsApi:
    """Test creating skills from existing training materials."""

    async def test_create_from_materials_success(self, client):
        user_id, token = await _create_admin_and_token("from_mat_admin")
        material_id = await _seed_material(user_id)

        response = await client.post(
            "/api/v1/skills/from-materials",
            json={"material_ids": [material_id], "name": "Material Skill"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 202
        data = response.json()
        assert data["materials_copied"] == 1
        assert "id" in data
        assert data["status"] == "pending"

    async def test_create_from_materials_empty_ids_rejected(self, client):
        _, token = await _create_admin_and_token("from_mat_empty_admin")
        response = await client.post(
            "/api/v1/skills/from-materials",
            json={"material_ids": []},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    async def test_create_from_materials_nonexistent_material(self, client):
        _, token = await _create_admin_and_token("from_mat_404_admin")
        response = await client.post(
            "/api/v1/skills/from-materials",
            json={"material_ids": ["nonexistent-id"]},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404

    async def test_create_from_multiple_materials(self, client):
        user_id, token = await _create_admin_and_token("from_mat_multi_admin")
        mat1 = await _seed_material(user_id)
        mat2 = await _seed_material(user_id)

        response = await client.post(
            "/api/v1/skills/from-materials",
            json={"material_ids": [mat1, mat2]},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 202
        assert response.json()["materials_copied"] == 2
