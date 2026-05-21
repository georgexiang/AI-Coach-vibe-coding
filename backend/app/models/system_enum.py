"""System enum model for configurable dropdown values."""

from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SystemEnum(Base, TimestampMixin):
    """Configurable enum values for dropdowns (products, specialties, difficulties, etc.)."""

    __tablename__ = "system_enums"

    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    label_en: Mapped[str] = mapped_column(String(255), nullable=False)
    label_zh: Mapped[str] = mapped_column(String(255), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(default=True)

    __table_args__ = (UniqueConstraint("category", "value", name="uq_system_enum_category_value"),)
