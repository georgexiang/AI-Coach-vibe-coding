"""Voice Live Instance ORM model — independent voice/avatar configuration entity."""

from sqlalchemy import Boolean, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class VoiceLiveInstance(Base, TimestampMixin):
    """Reusable Voice Live configuration that can be assigned to one or more HCP Profiles.

    Mirrors the AI Foundry Voice Live Playground configuration page:
    model selection, voice settings, avatar settings, conversation parameters.
    """

    __tablename__ = "voice_live_instances"

    # Instance identity
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")

    # Voice Live core
    voice_live_model: Mapped[str] = mapped_column(String(50), default="gpt-4o")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Voice settings
    voice_name: Mapped[str] = mapped_column(String(200), default="en-US-AvaNeural")
    voice_type: Mapped[str] = mapped_column(String(50), default="azure-standard")
    voice_temperature: Mapped[float] = mapped_column(Float, default=0.9)
    voice_custom: Mapped[bool] = mapped_column(Boolean, default=False)

    # Avatar settings
    avatar_character: Mapped[str] = mapped_column(String(100), default="lori")
    avatar_style: Mapped[str] = mapped_column(String(100), default="casual")
    avatar_customized: Mapped[bool] = mapped_column(Boolean, default=False)

    # Conversation parameters
    turn_detection_type: Mapped[str] = mapped_column(String(50), default="server_vad")
    noise_suppression: Mapped[bool] = mapped_column(Boolean, default=False)
    echo_cancellation: Mapped[bool] = mapped_column(Boolean, default=False)
    eou_detection: Mapped[bool] = mapped_column(Boolean, default=False)
    recognition_language: Mapped[str] = mapped_column(String(20), default="auto")

    # Response settings (Image #8 — Advanced settings)
    response_temperature: Mapped[float] = mapped_column(Float, default=0.8)
    proactive_engagement: Mapped[bool] = mapped_column(Boolean, default=True)

    # Speech input settings (Image #9)
    auto_detect_language: Mapped[bool] = mapped_column(Boolean, default=True)

    # Speech output settings (Image #10 — Advanced settings)
    playback_speed: Mapped[float] = mapped_column(Float, default=1.0)
    custom_lexicon_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    custom_lexicon_url: Mapped[str] = mapped_column(String(500), default="")

    # Avatar toggle (Image #11)
    avatar_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Model instruction (not agent — VL Instance is a model/API configuration)
    model_instruction: Mapped[str] = mapped_column(Text, default="")

    # Owner
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )

    # Relationships
    hcp_profiles = relationship("HcpProfile", back_populates="voice_live_instance")
