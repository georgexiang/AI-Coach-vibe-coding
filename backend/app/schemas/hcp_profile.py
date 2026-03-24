"""HCP Profile request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class HcpProfileCreate(BaseModel):
    """Create a new HCP profile."""

    name: str
    specialty: str
    created_by: str
    hospital: str = ""
    title: str = ""
    avatar_url: str = ""
    personality_type: str = "friendly"
    emotional_state: int = 50
    communication_style: int = 50
    expertise_areas: list[str] = []
    prescribing_habits: str = ""
    concerns: str = ""
    objections: list[str] = []
    probe_topics: list[str] = []
    difficulty: str = "medium"
    is_active: bool = True


class HcpProfileUpdate(BaseModel):
    """Update an existing HCP profile. All fields optional for partial updates."""

    name: str | None = None
    specialty: str | None = None
    hospital: str | None = None
    title: str | None = None
    avatar_url: str | None = None
    personality_type: str | None = None
    emotional_state: int | None = None
    communication_style: int | None = None
    expertise_areas: list[str] | None = None
    prescribing_habits: str | None = None
    concerns: str | None = None
    objections: list[str] | None = None
    probe_topics: list[str] | None = None
    difficulty: str | None = None
    is_active: bool | None = None


class HcpProfileResponse(BaseModel):
    """HCP profile response with all fields."""

    id: str
    name: str
    specialty: str
    hospital: str
    title: str
    avatar_url: str
    personality_type: str
    emotional_state: int
    communication_style: int
    expertise_areas: str  # JSON string from DB
    prescribing_habits: str
    concerns: str
    objections: str  # JSON string from DB
    probe_topics: str  # JSON string from DB
    difficulty: str
    is_active: bool
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HcpProfileListResponse(BaseModel):
    """Paginated list of HCP profiles."""

    items: list[HcpProfileResponse]
    total: int
