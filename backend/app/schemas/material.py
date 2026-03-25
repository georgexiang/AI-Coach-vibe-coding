"""Training material request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MaterialCreate(BaseModel):
    """Create a new training material."""

    name: str
    product: str
    therapeutic_area: str = ""
    tags: str = ""


class MaterialUpdate(BaseModel):
    """Update an existing training material. All fields optional for partial updates."""

    name: str | None = None
    product: str | None = None
    therapeutic_area: str | None = None
    tags: str | None = None


class MaterialChunkOut(BaseModel):
    """Response schema for a material text chunk."""

    id: str
    chunk_index: int
    content: str
    page_label: str

    model_config = ConfigDict(from_attributes=True)


class MaterialVersionOut(BaseModel):
    """Response schema for a material version."""

    id: str
    version_number: int
    filename: str
    file_size: int
    content_type: str
    storage_url: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MaterialOut(BaseModel):
    """Full material response with versions."""

    id: str
    name: str
    product: str
    therapeutic_area: str
    tags: str
    is_archived: bool
    current_version: int
    created_by: str
    created_at: datetime
    updated_at: datetime
    versions: list[MaterialVersionOut] = []

    model_config = ConfigDict(from_attributes=True)


class MaterialListOut(BaseModel):
    """Material list item response (without versions)."""

    id: str
    name: str
    product: str
    therapeutic_area: str
    tags: str
    is_archived: bool
    current_version: int
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
