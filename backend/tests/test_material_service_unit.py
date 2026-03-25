"""Unit tests for material service edge cases."""

import pytest

from app.models.material import MaterialChunk, MaterialVersion, TrainingMaterial
from app.models.user import User
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


async def _create_material_with_chunks(db_session, user_id: str, product: str = "Drug") -> str:
    """Helper to create a material with version and chunks. Returns material_id."""
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

    for i, text in enumerate(["Chunk A text", "Chunk B text"]):
        chunk = MaterialChunk(
            version_id=version.id,
            material_id=material.id,
            chunk_index=i,
            content=text,
            page_label=f"Page {i + 1}",
        )
        db_session.add(chunk)
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

    async def test_get_version_chunks_empty(self, db_session):
        """get_version_chunks returns empty list for version with no chunks."""
        user_id = await _create_user(db_session)
        material = TrainingMaterial(
            name="Doc", product="Drug", created_by=user_id, current_version=1
        )
        db_session.add(material)
        await db_session.flush()

        version = MaterialVersion(
            material_id=material.id,
            version_number=1,
            filename="empty.pdf",
            file_size=0,
            content_type="application/pdf",
            storage_url="/path",
        )
        db_session.add(version)
        await db_session.flush()

        chunks = await material_service.get_version_chunks(db_session, version.id)
        assert chunks == []

    async def test_search_chunks_returns_only_latest_version(self, db_session):
        """search_chunks filters to latest active version only."""
        user_id = await _create_user(db_session)
        material = TrainingMaterial(
            name="Doc", product="Brukinsa", created_by=user_id, current_version=2
        )
        db_session.add(material)
        await db_session.flush()

        # Version 1 (old)
        v1 = MaterialVersion(
            material_id=material.id,
            version_number=1,
            filename="v1.pdf",
            file_size=100,
            content_type="application/pdf",
            storage_url="/v1",
            is_active=True,
        )
        db_session.add(v1)
        await db_session.flush()

        chunk_v1 = MaterialChunk(
            version_id=v1.id,
            material_id=material.id,
            chunk_index=0,
            content="old version content",
        )
        db_session.add(chunk_v1)

        # Version 2 (latest)
        v2 = MaterialVersion(
            material_id=material.id,
            version_number=2,
            filename="v2.pdf",
            file_size=200,
            content_type="application/pdf",
            storage_url="/v2",
            is_active=True,
        )
        db_session.add(v2)
        await db_session.flush()

        chunk_v2 = MaterialChunk(
            version_id=v2.id,
            material_id=material.id,
            chunk_index=0,
            content="new version content",
        )
        db_session.add(chunk_v2)
        await db_session.flush()

        results = await material_service.search_chunks(db_session, product="Brukinsa")
        contents = [c.content for c in results]
        assert "new version content" in contents
        assert "old version content" not in contents

    async def test_get_material_context_returns_content_list(self, db_session):
        """get_material_context returns list of chunk content strings."""
        user_id = await _create_user(db_session)
        await _create_material_with_chunks(db_session, user_id, product="Brukinsa")

        context = await material_service.get_material_context(db_session, product="Brukinsa")
        assert isinstance(context, list)
        assert len(context) == 2
        assert "Chunk A text" in context
        assert "Chunk B text" in context

    async def test_get_material_context_empty_for_unknown_product(self, db_session):
        """get_material_context returns empty list for non-existent product."""
        context = await material_service.get_material_context(db_session, product="NonExistent")
        assert context == []
