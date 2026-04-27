"""Dry Run ORM models for skill simulation and validation."""

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class DryRun(Base, TimestampMixin):
    """A simulation run that tests a skill's SOP against an AI-simulated HCP."""

    __tablename__ = "dry_runs"

    skill_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("skills.id", ondelete="CASCADE"), nullable=False, index=True
    )
    skill_version_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("skill_versions.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
    )
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    run_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # Scoring & coverage
    executability_score: Mapped[int | None] = mapped_column(Integer, default=None)
    coverage_percent: Mapped[int | None] = mapped_column(Integer, default=None)
    total_sop_steps: Mapped[int] = mapped_column(Integer, default=0)
    covered_sop_steps: Mapped[int] = mapped_column(Integer, default=0)
    partial_sop_steps: Mapped[int] = mapped_column(Integer, default=0)

    # Issues
    issues_count: Mapped[int] = mapped_column(Integer, default=0)
    issues_json: Mapped[str] = mapped_column(Text, default="[]")
    sop_coverage_json: Mapped[str] = mapped_column(Text, default="[]")

    # Execution metadata
    duration_seconds: Mapped[int | None] = mapped_column(Integer, default=None)
    error_message: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    # Agent audit trail (DR-05.2)
    mr_agent_id: Mapped[str] = mapped_column(String(100), default="")
    mr_agent_version: Mapped[str] = mapped_column(String(50), default="")
    hcp_agent_id: Mapped[str] = mapped_column(String(100), default="")
    hcp_agent_version: Mapped[str] = mapped_column(String(50), default="")
    evaluator_agent_id: Mapped[str] = mapped_column(String(100), default="")
    evaluator_agent_version: Mapped[str] = mapped_column(String(50), default="")

    # Relationships
    messages = relationship(
        "DryRunMessage",
        back_populates="dry_run",
        order_by="DryRunMessage.sequence_number",
        cascade="all, delete-orphan",
    )
    skill = relationship("Skill", backref="dry_runs")

    __table_args__ = (
        Index("ix_dry_runs_skill_status", "skill_id", "status"),
        Index("ix_dry_runs_created_at", "created_at"),
    )


class DryRunMessage(Base, TimestampMixin):
    """A single message in a dry run conversation (MR or HCP turn)."""

    __tablename__ = "dry_run_messages"

    dry_run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("dry_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sop_step_id: Mapped[str | None] = mapped_column(String(50), default=None)
    sop_step_name: Mapped[str | None] = mapped_column(String(255), default=None)

    # Relationships
    dry_run = relationship("DryRun", back_populates="messages")
