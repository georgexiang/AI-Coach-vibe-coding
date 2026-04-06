"""Session Message ORM model for conversation history."""

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class SessionMessage(Base, TimestampMixin):
    """Individual message within a coaching session conversation."""

    __tablename__ = "session_messages"
    __table_args__ = (
        Index("ix_messages_session_index", "session_id", "message_index"),
    )

    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("coaching_sessions.id"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_index: Mapped[int] = mapped_column(nullable=False)  # ordering within session

    # Conference speaker attribution
    speaker_id: Mapped[str | None] = mapped_column(String(36), nullable=True, default=None)
    speaker_name: Mapped[str] = mapped_column(String(255), default="")

    # Relationships
    session = relationship("CoachingSession", back_populates="messages")
