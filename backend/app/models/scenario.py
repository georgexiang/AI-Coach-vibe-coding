"""Scenario ORM model for training session configuration."""

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Scenario(Base, TimestampMixin):
    """Training scenario with HCP profile, key messages, and rubric-based scoring."""

    __tablename__ = "scenarios"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    product: Mapped[str] = mapped_column(String(255), nullable=False)
    therapeutic_area: Mapped[str] = mapped_column(String(255), default="")
    mode: Mapped[str] = mapped_column(String(20), default="f2f")  # f2f / conference
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft / active
    hcp_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("hcp_profiles.id"), nullable=False, index=True
    )
    key_messages: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of strings

    # Skill association — version-pinned for deterministic agent behavior (D-21, D-22)
    skill_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("skills.id", ondelete="SET NULL"), nullable=True, default=None
    )
    skill_version_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("skill_versions.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
    )

    # Scoring rubric (NOT NULL — every scenario must have an explicit rubric per D-05)
    rubric_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scoring_rubrics.id"), nullable=False
    )

    pass_threshold: Mapped[int] = mapped_column(default=70)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    # Relationships
    hcp_profile = relationship("HcpProfile", back_populates="scenarios")
    rubric = relationship("ScoringRubric", foreign_keys=[rubric_id])
    skill = relationship("Skill", foreign_keys=[skill_id])
    skill_version = relationship("SkillVersion", foreign_keys=[skill_version_id])
