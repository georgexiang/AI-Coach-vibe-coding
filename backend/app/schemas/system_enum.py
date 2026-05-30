"""System enum request/response schemas."""

from pydantic import BaseModel, ConfigDict


class SystemEnumCreate(BaseModel):
    """Create a new system enum value."""

    category: str
    value: str
    label_en: str
    label_zh: str = ""
    sort_order: int = 0
    is_active: bool = True


class SystemEnumUpdate(BaseModel):
    """Update a system enum value."""

    label_en: str | None = None
    label_zh: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class SystemEnumResponse(BaseModel):
    """System enum response."""

    id: str
    category: str
    value: str
    label_en: str
    label_zh: str
    sort_order: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
