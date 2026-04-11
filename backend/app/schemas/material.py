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


class MaterialVersionOut(BaseModel):
    """Response schema for a material version."""

    id: str
    material_id: str
    version_number: int
    filename: str
    file_size: int
    content_type: str
    download_url: str = ""
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    def model_post_init(self, __context: object) -> None:
        """Generate download_url from material_id and version id."""
        if not self.download_url and self.material_id and self.id:
            self.download_url = f"/api/v1/materials/{self.material_id}/versions/{self.id}/download"


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
