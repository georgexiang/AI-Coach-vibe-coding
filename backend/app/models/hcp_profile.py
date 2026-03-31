"""HCP (Healthcare Professional) Profile ORM model."""

import json

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class HcpProfile(Base, TimestampMixin):
    """HCP profile with personality, knowledge, and interaction configuration."""

    __tablename__ = "hcp_profiles"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    specialty: Mapped[str] = mapped_column(String(100), nullable=False)
    hospital: Mapped[str] = mapped_column(String(255), default="")
    title: Mapped[str] = mapped_column(String(100), default="")
    avatar_url: Mapped[str] = mapped_column(String(500), default="")
    personality_type: Mapped[str] = mapped_column(
        String(50), default="friendly"
    )  # friendly, skeptical, busy, analytical, cautious
    emotional_state: Mapped[int] = mapped_column(
        default=50
    )  # 0=calm/neutral to 100=resistant/hostile
    communication_style: Mapped[int] = mapped_column(
        default=50
    )  # 0=very direct to 100=very indirect
    expertise_areas: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of strings
    prescribing_habits: Mapped[str] = mapped_column(Text, default="")
    concerns: Mapped[str] = mapped_column(Text, default="")
    objections: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of strings
    probe_topics: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of strings
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")  # easy/medium/hard
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    agent_id: Mapped[str] = mapped_column(String(100), default="")
    agent_sync_status: Mapped[str] = mapped_column(
        String(20), default="none"
    )  # none|pending|synced|failed
    agent_sync_error: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    # Relationships
    scenarios = relationship("Scenario", back_populates="hcp_profile")

    def to_prompt_dict(self) -> dict:
        """Return all personality/knowledge fields as a dict for system prompt construction."""
        return {
            "name": self.name,
            "specialty": self.specialty,
            "hospital": self.hospital,
            "title": self.title,
            "personality_type": self.personality_type,
            "emotional_state": self.emotional_state,
            "communication_style": self.communication_style,
            "expertise_areas": json.loads(self.expertise_areas),
            "prescribing_habits": self.prescribing_habits,
            "concerns": self.concerns,
            "objections": json.loads(self.objections),
            "probe_topics": json.loads(self.probe_topics),
            "difficulty": self.difficulty,
        }
