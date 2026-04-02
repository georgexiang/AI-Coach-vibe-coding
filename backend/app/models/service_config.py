"""ServiceConfig ORM model for Azure service configuration persistence."""

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ServiceConfig(TimestampMixin, Base):
    """Stores Azure service configurations with encrypted API keys."""

    __tablename__ = "service_configs"

    service_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    endpoint: Mapped[str] = mapped_column(String(500), default="")
    api_key_encrypted: Mapped[str] = mapped_column(Text, default="")
    model_or_deployment: Mapped[str] = mapped_column(String(100), default="")
    region: Mapped[str] = mapped_column(String(50), default="")
    default_project: Mapped[str] = mapped_column(String(200), default="")
    is_master: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_by: Mapped[str] = mapped_column(String(36), default="")
