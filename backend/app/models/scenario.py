"""Scenario ORM model for training session configuration."""

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Scenario(Base, TimestampMixin):
    """Training scenario with HCP profile, key messages, and scoring weights."""

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

    # Scoring weights (must total 100)
    weight_key_message: Mapped[int] = mapped_column(default=30)
    weight_objection_handling: Mapped[int] = mapped_column(default=25)
    weight_communication: Mapped[int] = mapped_column(default=20)
    weight_product_knowledge: Mapped[int] = mapped_column(default=15)
    weight_scientific_info: Mapped[int] = mapped_column(default=10)

    pass_threshold: Mapped[int] = mapped_column(default=70)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    # Relationships
    hcp_profile = relationship("HcpProfile", back_populates="scenarios")

    def get_scoring_weights(self) -> dict:
        """Return scoring weights as a dictionary."""
        return {
            "key_message": self.weight_key_message,
            "objection_handling": self.weight_objection_handling,
            "communication": self.weight_communication,
            "product_knowledge": self.weight_product_knowledge,
            "scientific_info": self.weight_scientific_info,
        }
