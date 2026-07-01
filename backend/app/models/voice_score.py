"""Voice Score ORM models stored separately from content scoring."""

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class VoiceScore(Base, TimestampMixin):
    """Voice-only score for a coaching session."""

    __tablename__ = "voice_scores"

    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("coaching_sessions.id"), unique=True, nullable=False, index=True
    )
    overall_voice_score: Mapped[float] = mapped_column(nullable=False)
    feedback_summary: Mapped[str] = mapped_column(Text, default="")

    session = relationship("CoachingSession", back_populates="voice_score")
    details = relationship(
        "VoiceScoreDetail",
        back_populates="voice_score",
        cascade="all, delete-orphan",
    )


class VoiceScoreDetail(Base, TimestampMixin):
    """Individual voice scoring dimension."""

    __tablename__ = "voice_score_details"

    voice_score_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("voice_scores.id"), nullable=False, index=True
    )
    dimension: Mapped[str] = mapped_column(String(50), nullable=False)
    score: Mapped[float] = mapped_column(nullable=False)
    weight: Mapped[int] = mapped_column(nullable=False)
    strengths: Mapped[str] = mapped_column(Text, default="[]")
    weaknesses: Mapped[str] = mapped_column(Text, default="[]")
    suggestions: Mapped[str] = mapped_column(Text, default="[]")
    category: Mapped[str] = mapped_column(String(20), server_default="voice")

    voice_score = relationship("VoiceScore", back_populates="details")
