"""Scenario request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ScenarioCreate(BaseModel):
    """Create a new scenario."""

    name: str
    hcp_profile_id: str
    rubric_id: str
    description: str = ""
    tags: list[str] = []
    mode: str = "f2f"
    difficulty: str = "medium"
    status: str = "draft"
    key_messages: list[str] = []
    skill_id: str | None = None
    pass_threshold: int = 70


class ScenarioUpdate(BaseModel):
    """Update an existing scenario. All fields optional for partial updates."""

    name: str | None = None
    hcp_profile_id: str | None = None
    rubric_id: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    mode: str | None = None
    difficulty: str | None = None
    status: str | None = None
    key_messages: list[str] | None = None
    skill_id: str | None = None
    pass_threshold: int | None = None


class ScenarioResponse(BaseModel):
    """Scenario response with all fields."""

    id: str
    name: str
    description: str
    tags: str  # JSON string from DB
    mode: str
    difficulty: str
    status: str
    hcp_profile_id: str
    key_messages: str  # JSON string from DB
    skill_id: str | None = None
    skill_version_id: str | None = None
    rubric_id: str
    pass_threshold: int
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
