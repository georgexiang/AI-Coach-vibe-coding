"""Coaching Session ORM model for training session lifecycle."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CoachingSession(Base, TimestampMixin):
    """Training session tracking lifecycle: created -> in_progress -> completed -> scored."""

    __tablename__ = "coaching_sessions"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    scenario_id: Mapped[str] = mapped_column(String(36), ForeignKey("scenarios.id"), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="created"
    )  # created/in_progress/completed/scored
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(nullable=True)
    key_messages_status: Mapped[str] = mapped_column(
        Text, default="[]"
    )  # JSON: [{message, delivered, detected_at}]
    overall_score: Mapped[float | None] = mapped_column(nullable=True)
    passed: Mapped[bool | None] = mapped_column(nullable=True)

    # Conference fields
    session_type: Mapped[str] = mapped_column(String(20), default="f2f")  # f2f / conference
    sub_state: Mapped[str] = mapped_column(
        String(20), default=""
    )  # presenting / qa / empty for f2f
    presentation_topic: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    audience_config: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None
    )  # JSON string

    # Relationships
    scenario = relationship("Scenario")
    user = relationship("User")
    messages = relationship("SessionMessage", back_populates="session")
    score = relationship("SessionScore", back_populates="session", uselist=False)
