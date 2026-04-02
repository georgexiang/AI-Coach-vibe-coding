"""Voice Live API request/response schemas."""

from pydantic import BaseModel


class VoiceLiveTokenResponse(BaseModel):
    """Token broker response for direct browser-to-Azure Voice Live connection."""

    endpoint: str
    token: str
    region: str
    model: str
    avatar_enabled: bool
    avatar_character: str
    voice_name: str
    auth_type: str = "key"  # "key" for API key, "bearer" for STS bearer token
    agent_id: str | None = None
    project_name: str | None = None

    # Per-HCP fields (D-08)
    avatar_style: str = "casual"
    avatar_customized: bool = False
    voice_type: str = "azure-standard"
    voice_temperature: float = 0.9
    voice_custom: bool = False
    turn_detection_type: str = "server_vad"
    noise_suppression: bool = False
    echo_cancellation: bool = False
    eou_detection: bool = False
    recognition_language: str = "auto"
    agent_instructions_override: str = ""


class VoiceLiveConfigStatus(BaseModel):
    """Voice Live and Avatar availability status for the current deployment."""

    voice_live_available: bool
    avatar_available: bool
    voice_name: str
    avatar_character: str
