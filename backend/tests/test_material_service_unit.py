"""Unit tests for material service edge cases."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.material import MaterialVersion, TrainingMaterial
from app.models.user import User
from app.schemas.material import MaterialUpdate
from app.services import material_service
from app.utils.exceptions import NotFoundException


async def _create_user(db_session) -> str:
    """Helper to create a test user and return user_id."""
    user = User(
        username="svc_admin",
        email="svc_admin@test.com",
        hashed_password="hashed",
        full_name="Svc Admin",
        role="admin",
    )
    db_session.add(user)
    await db_session.flush()
    return user.id


async def _create_material(db_session, user_id: str, product: str = "Drug") -> str:
    """Helper to create a material with a version. Returns material_id."""
    material = TrainingMaterial(
        name="Test Doc",
        product=product,
        created_by=user_id,
        current_version=1,
    )
    db_session.add(material)
    await db_session.flush()

    version = MaterialVersion(
        material_id=material.id,
        version_number=1,
        filename="test.pdf",
        file_size=100,
        content_type="application/pdf",
        storage_url="/path/v1.pdf",
        is_active=True,
    )
    db_session.add(version)
    await db_session.flush()

    return material.id


class TestMaterialServiceEdgeCases:
    """Tests for material_service edge cases not covered by integration tests."""

    async def test_get_material_nonexistent_raises_404(self, db_session):
        """get_material with non-existent ID raises NotFoundException."""
        with pytest.raises(NotFoundException):
            await material_service.get_material(db_session, "nonexistent-id")

    async def test_get_versions_nonexistent_material_raises_404(self, db_session):
        """get_versions with non-existent material ID raises NotFoundException."""
        with pytest.raises(NotFoundException):
            await material_service.get_versions(db_session, "no-such-material")


class TestMaterialServiceCoverage:
    """Tests to cover missing lines in material_service.py for >=95% coverage."""

    @patch("app.services.material_service.get_storage")
    async def test_upload_new_material(self, mock_get_storage, db_session):
        """upload_material with no material_id creates new material + version."""
        # Setup mock storage
        mock_storage = MagicMock()
        mock_storage.save = AsyncMock(return_value="/storage/materials/test.pdf")
        mock_get_storage.return_value = mock_storage

        user_id = await _create_user(db_session)

        result = await material_service.upload_material(
            db=db_session,
            content=b"fake-pdf-bytes",
            filename="report.pdf",
            content_type="application/pdf",
            product="Brukinsa",
            name="Clinical Report",
            tags="oncology",
            therapeutic_area="Hematology",
            material_id=None,
            user_id=user_id,
        )

        # Verify material was created
        assert result.name == "Clinical Report"
        assert result.product == "Brukinsa"
        assert result.current_version == 1
        assert result.therapeutic_area == "Hematology"
        assert result.tags == "oncology"
        assert result.created_by == user_id

        # Verify version was created
        assert len(result.versions) == 1
        assert result.versions[0].version_number == 1
        assert result.versions[0].filename == "report.pdf"
        assert result.versions[0].file_size == len(b"fake-pdf-bytes")
        assert result.versions[0].content_type == "application/pdf"

        # Verify storage.save was called
        mock_storage.save.assert_awaited_once()

    @patch("app.services.material_service.get_storage")
    async def test_upload_new_version_of_existing(self, mock_get_storage, db_session):
        """upload_material with existing material_id creates version 2."""
        mock_storage = MagicMock()
        mock_storage.save = AsyncMock(return_value="/storage/materials/v2.pdf")
        mock_get_storage.return_value = mock_storage

        user_id = await _create_user(db_session)
        mat_id = await _create_material(db_session, user_id, product="Brukinsa")

        result = await material_service.upload_material(
            db=db_session,
            content=b"updated-pdf-bytes",
            filename="report_v2.pdf",
            content_type="application/pdf",
            product="Brukinsa",
            name="Clinical Report",
            material_id=mat_id,
            user_id=user_id,
        )

        assert result.current_version == 2
        assert len(result.versions) == 2

        # Find the new version (version_number=2)
        v2 = [v for v in result.versions if v.version_number == 2]
        assert len(v2) == 1
        assert v2[0].filename == "report_v2.pdf"
        assert v2[0].file_size == len(b"updated-pdf-bytes")

    @patch("app.services.material_service.get_storage")
    async def test_upload_existing_material_not_found(self, mock_get_storage, db_session):
        """upload_material with non-existent material_id raises NotFoundException."""
        mock_storage = MagicMock()
        mock_storage.save = AsyncMock(return_value="/fake")
        mock_get_storage.return_value = mock_storage

        user_id = await _create_user(db_session)

        with pytest.raises(NotFoundException):
            await material_service.upload_material(
                db=db_session,
                content=b"bytes",
                filename="f.pdf",
                content_type="application/pdf",
                product="X",
                name="X",
                material_id="nonexistent-material-id",
                user_id=user_id,
            )

    async def test_update_material(self, db_session):
        """update_material changes metadata fields and returns refreshed material."""
        user_id = await _create_user(db_session)
        mat_id = await _create_material(db_session, user_id, product="OldProduct")

        update_data = MaterialUpdate(name="Updated Name", product="NewProduct", tags="new-tag")
        result = await material_service.update_material(db_session, mat_id, update_data)

        assert result.name == "Updated Name"
        assert result.product == "NewProduct"
        assert result.tags == "new-tag"
        # versions should still be loaded
        assert len(result.versions) >= 1

    async def test_archive_material(self, db_session):
        """archive_material sets is_archived=True."""
        user_id = await _create_user(db_session)
        mat_id = await _create_material(db_session, user_id)

        result = await material_service.archive_material(db_session, mat_id)

        assert result.is_archived is True
        assert result.id == mat_id
        # Should have versions loaded
        assert len(result.versions) >= 1

    async def test_restore_material(self, db_session):
        """restore_material sets is_archived=False after archiving."""
        user_id = await _create_user(db_session)
        mat_id = await _create_material(db_session, user_id)

        # Archive first
        await material_service.archive_material(db_session, mat_id)

        # Restore
        result = await material_service.restore_material(db_session, mat_id)

        assert result.is_archived is False
        assert result.id == mat_id
        assert len(result.versions) >= 1

    async def test_get_versions_success(self, db_session):
        """get_versions returns list of versions for an existing material."""
        user_id = await _create_user(db_session)
        mat_id = await _create_material(db_session, user_id)

        versions = await material_service.get_versions(db_session, mat_id)

        assert isinstance(versions, list)
        assert len(versions) == 1
        assert versions[0].version_number == 1
        assert versions[0].material_id == mat_id

    async def test_get_materials_with_product_filter(self, db_session):
        """get_materials with product filter returns only matching materials."""
        user_id = await _create_user(db_session)
        await _create_material(db_session, user_id, product="Brukinsa")
        await _create_material(db_session, user_id, product="OtherDrug")

        items, total = await material_service.get_materials(db_session, product="Brukinsa")

        assert total == 1
        assert len(items) == 1
        assert items[0].product == "Brukinsa"

    async def test_get_materials_with_search_filter(self, db_session):
        """get_materials with search filter returns only name-matching materials."""
        user_id = await _create_user(db_session)

        # Create two materials with different names
        m1 = TrainingMaterial(
            name="Clinical Study Alpha",
            product="Drug",
            created_by=user_id,
            current_version=1,
        )
        m2 = TrainingMaterial(
            name="Sales Brochure Beta",
            product="Drug",
            created_by=user_id,
            current_version=1,
        )
        db_session.add_all([m1, m2])
        await db_session.flush()

        items, total = await material_service.get_materials(db_session, search="Clinical")

        assert total == 1
        assert len(items) == 1
        assert "Clinical" in items[0].name

    async def test_get_materials_include_archived(self, db_session):
        """get_materials with include_archived=True returns archived materials too."""
        user_id = await _create_user(db_session)
        mat_id = await _create_material(db_session, user_id)

        # Archive it
        await material_service.archive_material(db_session, mat_id)

        # Without include_archived, should return 0
        items, total = await material_service.get_materials(db_session)
        assert total == 0

        # With include_archived, should return 1
        items, total = await material_service.get_materials(db_session, include_archived=True)
        assert total == 1
