"""Admin user management schemas."""

from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator


class AdminUserResponse(BaseModel):
    """Admin-facing user response with all fields."""

    id: str
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    preferred_language: str
    business_unit: str
    created_at: str | None = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("created_at", mode="before")
    @classmethod
    def datetime_to_str(cls, v: Any) -> str | None:
        """Convert datetime to ISO string."""
        if v is None:
            return None
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v)


class UserUpdate(BaseModel):
    """Partial update schema for admin user management."""

    full_name: str | None = None
    email: str | None = None
    role: str | None = None
    is_active: bool | None = None
    preferred_language: str | None = None
    business_unit: str | None = None
