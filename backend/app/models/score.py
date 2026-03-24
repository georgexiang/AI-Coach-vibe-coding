"""Session Score and Score Detail ORM models for multi-dimensional scoring."""

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class SessionScore(Base, TimestampMixin):
    """Overall score for a coaching session with feedback summary."""

    __tablename__ = "session_scores"

    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("coaching_sessions.id"), unique=True
    )
    overall_score: Mapped[float] = mapped_column(nullable=False)
    passed: Mapped[bool] = mapped_column(nullable=False)
    feedback_summary: Mapped[str] = mapped_column(Text, default="")

    # Relationships
    session = relationship("CoachingSession", back_populates="score")
    details = relationship("ScoreDetail", back_populates="score")


class ScoreDetail(Base, TimestampMixin):
    """Individual scoring dimension with strengths, weaknesses, and suggestions."""

    __tablename__ = "score_details"

    score_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("session_scores.id"), nullable=False
    )
    dimension: Mapped[str] = mapped_column(String(50), nullable=False)
    score: Mapped[float] = mapped_column(nullable=False)
    weight: Mapped[int] = mapped_column(nullable=False)
    strengths: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of {text, quote}
    weaknesses: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of {text, quote}
    suggestions: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of strings

    # Relationships
    score = relationship("SessionScore", back_populates="details")
