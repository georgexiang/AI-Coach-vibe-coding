"""Tests for material file download endpoint and storage_url security fix."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.material import MaterialVersion, TrainingMaterial
from app.models.user import User
from app.schemas.material import MaterialVersionOut
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_admin_and_token() -> tuple[str, str]:
    """Create an admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="admin_dl",
            email="admin_dl@test.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin Download",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_material_id():
    return str(uuid.uuid4())


@pytest.fixture
async def seed_material(db_session: AsyncSession, sample_material_id: str):
    """Create a material with one version in the test DB."""
    mat = TrainingMaterial(
        id=sample_material_id,
        name="Test Guide",
        product="TestProduct",
        therapeutic_area="Oncology",
        tags="test",
        created_by="admin-user",
        current_version=1,
    )
    db_session.add(mat)

    ver = MaterialVersion(
        id=str(uuid.uuid4()),
        material_id=sample_material_id,
        version_number=1,
        filename="guide.pdf",
        file_size=1024,
        content_type="application/pdf",
        storage_url="/fake/path/guide.pdf",
        is_active=True,
    )
    db_session.add(ver)
    await db_session.commit()
    return mat, ver


# ---------------------------------------------------------------------------
# Download endpoint tests
# ---------------------------------------------------------------------------


class TestDownloadEndpoint:
    """Tests for GET /materials/{mid}/versions/{vid}/download."""

    @pytest.mark.asyncio
    async def test_download_returns_file(self, client, seed_material, sample_material_id):
        _, ver = seed_material
        _, token = await _create_admin_and_token()
        headers = {"Authorization": f"Bearer {token}"}
        fake_content = b"%PDF-1.4 fake pdf content here"

        with patch("app.api.materials.get_storage") as mock_storage_factory:
            mock_storage = AsyncMock()
            mock_storage.exists.return_value = True
            mock_storage.read.return_value = fake_content
            mock_storage_factory.return_value = mock_storage

            resp = await client.get(
                f"/api/v1/materials/{sample_material_id}/versions/{ver.id}/download",
                headers=headers,
            )

        assert resp.status_code == 200
        assert resp.content == fake_content
        assert resp.headers["content-type"] == "application/pdf"
        assert "attachment" in resp.headers["content-disposition"]
        assert "guide.pdf" in resp.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_download_inline_mode(self, client, seed_material, sample_material_id):
        _, ver = seed_material
        _, token = await _create_admin_and_token()
        headers = {"Authorization": f"Bearer {token}"}

        with patch("app.api.materials.get_storage") as mock_storage_factory:
            mock_storage = AsyncMock()
            mock_storage.exists.return_value = True
            mock_storage.read.return_value = b"pdf-bytes"
            mock_storage_factory.return_value = mock_storage

            resp = await client.get(
                f"/api/v1/materials/{sample_material_id}/versions/{ver.id}/download?mode=inline",
                headers=headers,
            )

        assert resp.status_code == 200
        assert "inline" in resp.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_download_attachment_mode(self, client, seed_material, sample_material_id):
        _, ver = seed_material
        _, token = await _create_admin_and_token()
        headers = {"Authorization": f"Bearer {token}"}

        with patch("app.api.materials.get_storage") as mock_storage_factory:
            mock_storage = AsyncMock()
            mock_storage.exists.return_value = True
            mock_storage.read.return_value = b"docx-bytes"
            mock_storage_factory.return_value = mock_storage

            resp = await client.get(
                f"/api/v1/materials/{sample_material_id}/versions/{ver.id}/download?mode=attachment",
                headers=headers,
            )

        assert resp.status_code == 200
        assert "attachment" in resp.headers["content-disposition"]

    @pytest.mark.asyncio
    async def test_download_nonexistent_version_returns_404(
        self, client, seed_material, sample_material_id
    ):
        _, token = await _create_admin_and_token()
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.get(
            f"/api/v1/materials/{sample_material_id}/versions/nonexistent-id/download",
            headers=headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_download_nonexistent_material_returns_404(self, client):
        _, token = await _create_admin_and_token()
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.get(
            "/api/v1/materials/nonexistent/versions/nonexistent/download",
            headers=headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_download_requires_auth(self, client, seed_material, sample_material_id):
        _, ver = seed_material
        resp = await client.get(
            f"/api/v1/materials/{sample_material_id}/versions/{ver.id}/download"
        )
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_download_file_not_in_storage_returns_404(
        self, client, seed_material, sample_material_id
    ):
        _, ver = seed_material
        _, token = await _create_admin_and_token()
        headers = {"Authorization": f"Bearer {token}"}

        with patch("app.api.materials.get_storage") as mock_storage_factory:
            mock_storage = AsyncMock()
            mock_storage.exists.return_value = False
            mock_storage_factory.return_value = mock_storage

            resp = await client.get(
                f"/api/v1/materials/{sample_material_id}/versions/{ver.id}/download",
                headers=headers,
            )

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Schema security tests
# ---------------------------------------------------------------------------


class TestStorageUrlSecurity:
    """Verify storage_url is not leaked in API responses."""

    def test_version_out_has_download_url(self):
        out = MaterialVersionOut(
            id="ver-1",
            material_id="mat-1",
            version_number=1,
            filename="doc.pdf",
            file_size=100,
            content_type="application/pdf",
            is_active=True,
            created_at="2026-01-01T00:00:00",
        )
        assert out.download_url == "/api/v1/materials/mat-1/versions/ver-1/download"

    def test_version_out_no_storage_url_field(self):
        out = MaterialVersionOut(
            id="ver-1",
            material_id="mat-1",
            version_number=1,
            filename="doc.pdf",
            file_size=100,
            content_type="application/pdf",
            is_active=True,
            created_at="2026-01-01T00:00:00",
        )
        data = out.model_dump()
        assert "storage_url" not in data
        assert "download_url" in data

    def test_version_out_download_url_format(self):
        out = MaterialVersionOut(
            id="abc-123",
            material_id="mat-456",
            version_number=3,
            filename="report.xlsx",
            file_size=5000,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            is_active=True,
            created_at="2026-04-10T00:00:00",
        )
        assert "/materials/mat-456/versions/abc-123/download" in out.download_url

    @pytest.mark.asyncio
    async def test_list_versions_api_no_storage_url(
        self, client, seed_material, sample_material_id
    ):
        """Verify storage_url does not appear in the versions API response."""
        _, token = await _create_admin_and_token()
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.get(
            f"/api/v1/materials/{sample_material_id}/versions",
            headers=headers,
        )
        assert resp.status_code == 200
        versions = resp.json()
        for v in versions:
            assert "storage_url" not in v
            assert "download_url" in v
            assert "/download" in v["download_url"]
