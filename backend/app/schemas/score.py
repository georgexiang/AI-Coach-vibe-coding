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
    category: str = "content"
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


class VoiceScoreSummary(BaseModel):
    """Voice scoring summary for the combined report (D-11)."""

    overall_voice_score: float = 0.0
    voice_score_status: str = "none"
    dimensions: list[ScoreDetailResponse] = []


class CombinedScoreReport(BaseModel):
    """Combined content + voice scoring report (D-09, D-11)."""

    session_id: str
    overall_score: float
    overall_combined_score: float
    passed: bool
    content_dimensions: list[ScoreDetailResponse] = []
    voice_dimensions: list[ScoreDetailResponse] = []
    voice_summary: VoiceScoreSummary
    strengths: list[str] = []
    weaknesses: list[str] = []
    suggestions: list[str] = []
    feedback_summary: str = ""
    audio_url: str | None = None
    content_total: float | None = None
    voice_total: float | None = None
    content_weight: int | None = None
    voice_weight: int | None = None
