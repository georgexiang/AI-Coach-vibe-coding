"""Real-time coaching suggestion schemas."""

from enum import Enum

from pydantic import BaseModel, ConfigDict


class SuggestionType(str, Enum):
    """Types of coaching suggestions."""

    TIP = "tip"
    WARNING = "warning"
    ACHIEVEMENT = "achievement"
    REMINDER = "reminder"


class SuggestionCreate(BaseModel):
    """Input for creating a suggestion (internal use)."""

    session_id: str
    type: SuggestionType
    message: str
    relevance_score: float = 0.8

    model_config = ConfigDict(from_attributes=True)


class SuggestionResponse(BaseModel):
    """Suggestion returned to the client."""

    type: SuggestionType
    message: str
    relevance_score: float
    trigger: str = ""  # what triggered this suggestion

    model_config = ConfigDict(from_attributes=True)
