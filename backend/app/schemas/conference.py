"""Conference presentation module request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AudienceHcpCreate(BaseModel):
    """Add an HCP profile to a conference scenario audience."""

    hcp_profile_id: str
    role_in_conference: str = "audience"
    voice_id: str = ""
    sort_order: int = 0


class AudienceHcpResponse(BaseModel):
    """Audience HCP member response with profile summary."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    scenario_id: str
    hcp_profile_id: str
    role_in_conference: str
    voice_id: str
    sort_order: int
    hcp_name: str = ""
    hcp_specialty: str = ""


class ConferenceSessionCreate(BaseModel):
    """Create a new conference-type coaching session."""

    scenario_id: str


class ConferenceSessionResponse(BaseModel):
    """Conference session response with conference-specific fields."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    scenario_id: str
    status: str
    session_type: str
    sub_state: str
    presentation_topic: str | None = None
    audience_config: str | None = None
    key_messages_status: str | None = None
    created_at: datetime | None = None


class ConferenceMessageSend(BaseModel):
    """Send a message in a conference session."""

    action: str = Field(description="present or respond")
    message: str
    target_hcp_id: str | None = None


class QueuedQuestionResponse(BaseModel):
    """A queued question from an HCP audience member."""

    hcp_profile_id: str
    hcp_name: str
    question: str
    relevance_score: float
    status: str


class ConferenceSubStateUpdate(BaseModel):
    """Update the conference sub-state (presenting or qa)."""

    sub_state: str = Field(pattern="^(presenting|qa)$")
