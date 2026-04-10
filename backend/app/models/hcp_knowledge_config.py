"""HCP Knowledge Base configuration ORM model."""

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class HcpKnowledgeConfig(Base, TimestampMixin):
    """Knowledge base connection configuration for an HCP Agent."""

    __tablename__ = "hcp_knowledge_configs"

    hcp_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("hcp_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    connection_name: Mapped[str] = mapped_column(String(255), nullable=False)
    connection_target: Mapped[str] = mapped_column(String(500), default="")
    index_name: Mapped[str] = mapped_column(String(255), nullable=False)
    server_label: Mapped[str] = mapped_column(String(255), default="")
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationship
    hcp_profile = relationship("HcpProfile", back_populates="knowledge_configs")
