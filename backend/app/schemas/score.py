"""Session Score request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ScoreDetailResponse(BaseModel):
    """Individual scoring dimension response."""

    id: str
    dimension: str
    score: float
    weight: int
    strengths: str  # JSON string from DB: array of {text, quote}
    weaknesses: str  # JSON string from DB: array of {text, quote}
    suggestions: str  # JSON string from DB: array of strings
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionScoreResponse(BaseModel):
    """Overall session score response with dimension breakdowns."""

    id: str
    session_id: str
    overall_score: float
    passed: bool
    feedback_summary: str
    details: list[ScoreDetailResponse]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
