"""MetaSkill ORM model for configurable Skill Creator and Evaluator agents."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class MetaSkill(TimestampMixin, Base):
    """Stores configuration for meta-skill agents (creator / evaluator).

    Each row represents a configurable agent whose instructions (SKILL.md template),
    model, and Azure Agent ID are managed by admins via the Meta Skills page.
    """

    __tablename__ = "meta_skills"

    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    skill_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # Azure Agent config (synced via agent_sync_service)
    agent_id: Mapped[str] = mapped_column(String(100), default="")
    agent_version: Mapped[str] = mapped_column(String(50), default="")
    model: Mapped[str] = mapped_column(String(100), default="gpt-4o")

    # Template (SKILL.md content used as agent instructions)
    template_content: Mapped[str] = mapped_column(Text, default="")
    template_language: Mapped[str] = mapped_column(String(10), default="en")

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
