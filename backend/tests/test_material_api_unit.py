"""Direct unit tests for api/materials.py router functions.

Bypasses ASGI transport to cover return statement lines that
coverage.py does not track through httpx ASGITransport.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.api.materials import (
    archive_material,
    get_material,
    get_version_chunks,
    list_materials,
    list_versions,
    restore_material,
    search_chunks,
    update_material,
    upload_material,
)
from app.models.user import User
from app.schemas.material import MaterialUpdate
from app.utils.exceptions import ValidationException


def _make_user() -> User:
    """Create a fake admin user object."""
    user = MagicMock(spec=User)
    user.id = "admin-user-id"
    user.role = "admin"
    return user


def _make_upload_file(filename: str = "test.pdf", content: bytes = b"fake-pdf"):
    """Create a mock UploadFile object."""
    mock_file = MagicMock()
    mock_file.filename = filename
    mock_file.content_type = "application/pdf"
    mock_file.read = AsyncMock(return_value=content)
    return mock_file


class TestUploadMaterialEndpoint:
    """Tests for the upload_material route function."""

    async def test_upload_no_filename_raises_422(self):
        """Missing filename triggers bad_request (ValidationException 422)."""
        mock_file = _make_upload_file()
        mock_file.filename = ""
        db = AsyncMock()
        user = _make_user()

        with pytest.raises(ValidationException) as exc_info:
            await upload_material(
                file=mock_file,
                product="Drug",
                name="Test",
                therapeutic_area="",
                tags="",
                material_id=None,
                db=db,
                user=user,
            )
        assert exc_info.value.status_code == 422

    async def test_upload_invalid_extension_raises_422(self):
        """Disallowed file extension triggers bad_request (ValidationException 422)."""
        mock_file = _make_upload_file(filename="test.exe")
        db = AsyncMock()
        user = _make_user()

        with pytest.raises(ValidationException) as exc_info:
            await upload_material(
                file=mock_file,
                product="Drug",
                name="Test",
                therapeutic_area="",
                tags="",
                material_id=None,
                db=db,
                user=user,
            )
        assert exc_info.value.status_code == 422

    async def test_upload_oversized_file_raises_422(self):
        """File exceeding MAX_FILE_SIZE triggers bad_request (ValidationException 422)."""
        big_content = b"x" * (50 * 1024 * 1024 + 1)
        mock_file = _make_upload_file(content=big_content)
        db = AsyncMock()
        user = _make_user()

        with pytest.raises(ValidationException) as exc_info:
            await upload_material(
                file=mock_file,
                product="Drug",
                name="Test",
                therapeutic_area="",
                tags="",
                material_id=None,
                db=db,
                user=user,
            )
        assert exc_info.value.status_code == 422

    @patch("app.api.materials.material_service")
    async def test_upload_success_returns_material(self, mock_svc):
        """Successful upload returns the created material."""
        mock_material = MagicMock()
        mock_material.id = "mat-1"
        mock_svc.upload_material = AsyncMock(return_value=mock_material)

        mock_file = _make_upload_file()
        db = AsyncMock()
        user = _make_user()

        result = await upload_material(
            file=mock_file,
            product="Drug",
            name="Test Material",
            therapeutic_area="",
            tags="",
            material_id=None,
            db=db,
            user=user,
        )

        assert result == mock_material
        mock_svc.upload_material.assert_awaited_once()


class TestSearchChunksEndpoint:
    """Tests for the search_chunks route function."""

    @patch("app.api.materials.material_service")
    async def test_search_returns_chunks(self, mock_svc):
        """search_chunks returns list of chunks from service."""
        mock_chunks = [MagicMock(), MagicMock()]
        mock_svc.search_chunks = AsyncMock(return_value=mock_chunks)

        db = AsyncMock()
        user = _make_user()

        result = await search_chunks(
            product="Drug", query="", limit=10, db=db, _user=user
        )
        assert result == mock_chunks


class TestListMaterialsEndpoint:
    """Tests for the list_materials route function."""

    @patch("app.api.materials.material_service")
    async def test_list_returns_paginated(self, mock_svc):
        """list_materials returns PaginatedResponse."""
        mock_svc.get_materials = AsyncMock(return_value=([], 0))

        db = AsyncMock()
        user = _make_user()

        result = await list_materials(
            page=1,
            page_size=20,
            product=None,
            search=None,
            include_archived=False,
            db=db,
            _user=user,
        )
        assert result.total == 0
        assert result.items == []


class TestGetMaterialEndpoint:
    """Tests for the get_material route function."""

    @patch("app.api.materials.material_service")
    async def test_get_returns_material(self, mock_svc):
        """get_material returns the material from service."""
        mock_material = MagicMock()
        mock_svc.get_material = AsyncMock(return_value=mock_material)

        db = AsyncMock()
        user = _make_user()

        result = await get_material(material_id="m1", db=db, _user=user)
        assert result == mock_material


class TestUpdateMaterialEndpoint:
    """Tests for the update_material route function."""

    @patch("app.api.materials.material_service")
    async def test_update_returns_material(self, mock_svc):
        """update_material returns updated material from service."""
        mock_material = MagicMock()
        mock_svc.update_material = AsyncMock(return_value=mock_material)

        db = AsyncMock()
        user = _make_user()
        data = MaterialUpdate(name="Updated")

        result = await update_material(
            material_id="m1", data=data, db=db, _user=user
        )
        assert result == mock_material


class TestArchiveMaterialEndpoint:
    """Tests for the archive_material route function."""

    @patch("app.api.materials.material_service")
    async def test_archive_returns_204(self, mock_svc):
        """archive_material returns a 204 Response."""
        mock_svc.archive_material = AsyncMock()

        db = AsyncMock()
        user = _make_user()

        result = await archive_material(material_id="m1", db=db, _user=user)
        assert result.status_code == 204


class TestRestoreMaterialEndpoint:
    """Tests for the restore_material route function."""

    @patch("app.api.materials.material_service")
    async def test_restore_returns_material(self, mock_svc):
        """restore_material returns restored material."""
        mock_material = MagicMock()
        mock_svc.restore_material = AsyncMock(return_value=mock_material)

        db = AsyncMock()
        user = _make_user()

        result = await restore_material(material_id="m1", db=db, _user=user)
        assert result == mock_material


class TestListVersionsEndpoint:
    """Tests for the list_versions route function."""

    @patch("app.api.materials.material_service")
    async def test_versions_returns_list(self, mock_svc):
        """list_versions returns versions from service."""
        mock_versions = [MagicMock()]
        mock_svc.get_versions = AsyncMock(return_value=mock_versions)

        db = AsyncMock()
        user = _make_user()

        result = await list_versions(material_id="m1", db=db, _user=user)
        assert result == mock_versions


class TestGetVersionChunksEndpoint:
    """Tests for the get_version_chunks route function."""

    @patch("app.api.materials.material_service")
    async def test_chunks_returns_list(self, mock_svc):
        """get_version_chunks returns chunks from service."""
        mock_chunks = [MagicMock()]
        mock_svc.get_version_chunks = AsyncMock(return_value=mock_chunks)

        db = AsyncMock()
        user = _make_user()

        result = await get_version_chunks(
            material_id="m1", version_id="v1", db=db, _user=user
        )
        assert result == mock_chunks
