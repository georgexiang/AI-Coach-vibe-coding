"""Training material ORM models for document management and RAG indexing."""

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class TrainingMaterial(Base, TimestampMixin):
    """Top-level training material with versioning support."""

    __tablename__ = "training_materials"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    product: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    therapeutic_area: Mapped[str] = mapped_column(String(255), default="")
    tags: Mapped[str] = mapped_column(Text, default="")  # comma-separated
    is_archived: Mapped[bool] = mapped_column(default=False)
    current_version: Mapped[int] = mapped_column(default=1)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    # Relationships
    versions = relationship(
        "MaterialVersion",
        back_populates="material",
        order_by="MaterialVersion.version_number.desc()",
    )
    creator = relationship("User")
    derived_skill_links = relationship(
        "SkillSourceMaterial",
        back_populates="material",
        cascade="all, delete-orphan",
    )


class MaterialVersion(Base, TimestampMixin):
    """A specific version of a training material file."""

    __tablename__ = "material_versions"

    material_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("training_materials.id"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(nullable=False)  # bytes
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    storage_url: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)

    # Relationships
    material = relationship("TrainingMaterial", back_populates="versions")
