"""Unit tests for training material ORM models."""

from app.models.material import MaterialChunk, MaterialVersion, TrainingMaterial
from app.models.user import User


class TestTrainingMaterialModel:
    """Tests for TrainingMaterial ORM model defaults and relationships."""

    async def test_default_values(self, db_session):
        """TrainingMaterial has correct default values."""
        user = User(
            username="test_user",
            email="test@test.com",
            hashed_password="hashed",
            full_name="Test User",
            role="admin",
        )
        db_session.add(user)
        await db_session.flush()

        material = TrainingMaterial(
            name="Test Doc",
            product="Brukinsa",
            created_by=user.id,
        )
        db_session.add(material)
        await db_session.flush()

        assert material.is_archived is False
        assert material.current_version == 1
        assert material.therapeutic_area == ""
        assert material.tags == ""

    async def test_version_relationship(self, db_session):
        """TrainingMaterial.versions backref works."""
        user = User(
            username="test_rel",
            email="rel@test.com",
            hashed_password="hashed",
            full_name="Rel User",
            role="admin",
        )
        db_session.add(user)
        await db_session.flush()

        material = TrainingMaterial(
            name="Doc",
            product="Drug",
            created_by=user.id,
        )
        db_session.add(material)
        await db_session.flush()

        version = MaterialVersion(
            material_id=material.id,
            version_number=1,
            filename="test.pdf",
            file_size=1024,
            content_type="application/pdf",
            storage_url="/path/test.pdf",
        )
        db_session.add(version)
        await db_session.flush()

        # Refresh to load relationship
        await db_session.refresh(material, attribute_names=["versions"])
        assert len(material.versions) == 1
        assert material.versions[0].version_number == 1

    async def test_chunk_relationship(self, db_session):
        """MaterialVersion.chunks cascade works."""
        user = User(
            username="chunk_user",
            email="chunk@test.com",
            hashed_password="hashed",
            full_name="Chunk User",
            role="admin",
        )
        db_session.add(user)
        await db_session.flush()

        material = TrainingMaterial(
            name="Doc",
            product="Drug",
            created_by=user.id,
        )
        db_session.add(material)
        await db_session.flush()

        version = MaterialVersion(
            material_id=material.id,
            version_number=1,
            filename="test.pdf",
            file_size=1024,
            content_type="application/pdf",
            storage_url="/path",
        )
        db_session.add(version)
        await db_session.flush()

        chunk = MaterialChunk(
            version_id=version.id,
            material_id=material.id,
            chunk_index=0,
            content="Test content",
            page_label="Page 1",
        )
        db_session.add(chunk)
        await db_session.flush()

        await db_session.refresh(version, attribute_names=["chunks"])
        assert len(version.chunks) == 1
        assert version.chunks[0].content == "Test content"

    async def test_timestamp_mixin_fields(self, db_session):
        """Models have id, created_at, updated_at from TimestampMixin."""
        user = User(
            username="ts_user",
            email="ts@test.com",
            hashed_password="hashed",
            full_name="TS User",
            role="admin",
        )
        db_session.add(user)
        await db_session.flush()

        material = TrainingMaterial(
            name="Doc",
            product="Drug",
            created_by=user.id,
        )
        db_session.add(material)
        await db_session.flush()

        assert material.id is not None
        assert len(material.id) == 36  # UUID format
        assert material.created_at is not None
