"""Conference Audience HCP ORM model for multi-HCP conference scenarios."""

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ConferenceAudienceHcp(Base, TimestampMixin):
    """Links HCP profiles to a conference scenario as audience members."""

    __tablename__ = "conference_audience_hcps"

    scenario_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scenarios.id"), nullable=False, index=True
    )
    hcp_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("hcp_profiles.id"), nullable=False, index=True
    )
    role_in_conference: Mapped[str] = mapped_column(
        String(50), default="audience"
    )  # audience / moderator
    voice_id: Mapped[str] = mapped_column(String(100), default="")
    sort_order: Mapped[int] = mapped_column(default=0)

    # Relationships
    scenario = relationship("Scenario")
    hcp_profile = relationship("HcpProfile")
