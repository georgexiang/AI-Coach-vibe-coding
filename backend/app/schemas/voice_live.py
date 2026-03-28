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
    agent_id: str | None = None
    project_name: str | None = None


class VoiceLiveConfigStatus(BaseModel):
    """Voice Live and Avatar availability status for the current deployment."""

    voice_live_available: bool
    avatar_available: bool
    voice_name: str
    avatar_character: str
