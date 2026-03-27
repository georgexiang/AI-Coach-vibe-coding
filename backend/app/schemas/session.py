"""Coaching Session request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SessionCreate(BaseModel):
    """Create a new coaching session."""

    scenario_id: str
    mode: str = "text"  # text / voice / avatar


class SendMessageRequest(BaseModel):
    """Send a message in a coaching session."""

    message: str


class MessageResponse(BaseModel):
    """Individual message response."""

    id: str
    session_id: str
    role: str
    content: str
    message_index: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionResponse(BaseModel):
    """Coaching session response with all fields."""

    id: str
    user_id: str
    scenario_id: str
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    duration_seconds: int | None
    key_messages_status: str  # JSON string from DB
    overall_score: float | None
    passed: bool | None
    mode: str = "text"
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
