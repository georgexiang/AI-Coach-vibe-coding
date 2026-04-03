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

    # Voice Live model selection (Phase 13)
    voice_live_model: str = "gpt-4o"

    # Voice/Avatar settings (D-01, D-04 defaults)
    voice_name: str = "en-US-AvaNeural"
    voice_type: str = "azure-standard"
    voice_temperature: float = 0.9
    voice_custom: bool = False
    avatar_character: str = "lori"
    avatar_style: str = "casual"
    avatar_customized: bool = False
    turn_detection_type: str = "server_vad"
    noise_suppression: bool = False
    echo_cancellation: bool = False
    eou_detection: bool = False
    recognition_language: str = "auto"
    agent_instructions_override: str = ""


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

    # Voice Live model selection (Phase 13)
    voice_live_model: str | None = None

    # Voice/Avatar settings (all optional for partial updates)
    voice_name: str | None = None
    voice_type: str | None = None
    voice_temperature: float | None = None
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
    agent_id: str = ""
    agent_sync_status: str = "none"
    agent_sync_error: str = ""

    # Voice Live model selection (Phase 13)
    voice_live_model: str = "gpt-4o"

    # Voice/Avatar settings
    voice_name: str = "en-US-AvaNeural"
    voice_type: str = "azure-standard"
    voice_temperature: float = 0.9
    voice_custom: bool = False
    avatar_character: str = "lori"
    avatar_style: str = "casual"
    avatar_customized: bool = False
    turn_detection_type: str = "server_vad"
    noise_suppression: bool = False
    echo_cancellation: bool = False
    eou_detection: bool = False
    recognition_language: str = "auto"
    agent_instructions_override: str = ""

    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HcpProfileListResponse(BaseModel):
    """Paginated list of HCP profiles."""

    items: list[HcpProfileResponse]
    total: int
