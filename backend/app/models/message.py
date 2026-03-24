"""Session Message ORM model for conversation history."""

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class SessionMessage(Base, TimestampMixin):
    """Individual message within a coaching session conversation."""

    __tablename__ = "session_messages"

    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("coaching_sessions.id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_index: Mapped[int] = mapped_column(nullable=False)  # ordering within session

    # Relationships
    session = relationship("CoachingSession", back_populates="messages")
