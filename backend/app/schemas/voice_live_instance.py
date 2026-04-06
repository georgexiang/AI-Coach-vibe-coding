"""Voice Live Instance request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VoiceLiveInstanceCreate(BaseModel):
    """Create a new Voice Live configuration instance."""

    name: str
    description: str = ""

    # Voice Live core
    voice_live_model: str = "gpt-4o"
    enabled: bool = True

    # Voice settings
    voice_name: str = "en-US-AvaNeural"
    voice_type: str = "azure-standard"
    voice_temperature: float = Field(default=0.9, ge=0.0, le=2.0)
    voice_custom: bool = False

    # Avatar settings
    avatar_character: str = "lori"
    avatar_style: str = "casual"
    avatar_customized: bool = False

    # Conversation parameters
    turn_detection_type: str = "server_vad"
    noise_suppression: bool = False
    echo_cancellation: bool = False
    eou_detection: bool = False
    recognition_language: str = "auto"

    # Agent instruction override
    agent_instructions_override: str = ""


class VoiceLiveInstanceUpdate(BaseModel):
    """Update a Voice Live configuration instance. All fields optional."""

    name: str | None = None
    description: str | None = None
    voice_live_model: str | None = None
    enabled: bool | None = None
    voice_name: str | None = None
    voice_type: str | None = None
    voice_temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    voice_custom: bool | None = None
    avatar_character: str | None = None
    avatar_style: str | None = None
    avatar_customized: bool | None = None
    turn_detection_type: str | None = None
    noise_suppression: bool | None = None
    echo_cancellation: bool | None = None
    eou_detection: bool | None = None
    recognition_language: str | None = None
    agent_instructions_override: str | None = None


class VoiceLiveInstanceResponse(BaseModel):
    """Full Voice Live Instance response."""

    id: str
    name: str
    description: str
    voice_live_model: str
    enabled: bool
    voice_name: str
    voice_type: str
    voice_temperature: float
    voice_custom: bool
    avatar_character: str
    avatar_style: str
    avatar_customized: bool
    turn_detection_type: str
    noise_suppression: bool
    echo_cancellation: bool
    eou_detection: bool
    recognition_language: str
    agent_instructions_override: str
    hcp_count: int = 0
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VoiceLiveInstanceSummary(BaseModel):
    """Compact summary for list views and HCP profile embedding."""

    id: str
    name: str
    voice_live_model: str
    enabled: bool
    voice_name: str
    avatar_character: str
    avatar_style: str
    hcp_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class VoiceLiveInstanceListResponse(BaseModel):
    """Paginated list of Voice Live instances."""

    items: list[VoiceLiveInstanceResponse]
    total: int


class VoiceLiveInstanceAssign(BaseModel):
    """Assign a Voice Live Instance to an HCP Profile."""

    hcp_profile_id: str


class VoiceLiveInstanceUnassign(BaseModel):
    """Unassign Voice Live Instance from an HCP Profile."""

    hcp_profile_id: str
