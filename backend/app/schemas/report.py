"""Post-session report schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class StrengthItem(BaseModel):
    """A strength identified in the session."""

    text: str
    quote: str | None = None

    model_config = ConfigDict(from_attributes=True)


class WeaknessItem(BaseModel):
    """A weakness identified in the session."""

    text: str
    quote: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ImprovementSuggestion(BaseModel):
    """Actionable improvement suggestion."""

    dimension: str
    suggestion: str
    priority: str = "medium"  # high / medium / low

    model_config = ConfigDict(from_attributes=True)


class DimensionBreakdown(BaseModel):
    """Per-dimension score breakdown for the report."""

    dimension: str
    score: float
    weight: int
    max_score: float = 100.0
    strengths: list[StrengthItem]
    weaknesses: list[WeaknessItem]
    suggestions: list[str]

    model_config = ConfigDict(from_attributes=True)


class SessionReport(BaseModel):
    """Complete post-session report."""

    session_id: str
    scenario_name: str
    product: str
    hcp_name: str
    overall_score: float
    passed: bool
    feedback_summary: str
    duration_seconds: int | None = None
    completed_at: datetime | None = None
    dimensions: list[DimensionBreakdown]
    strengths: list[StrengthItem]
    weaknesses: list[WeaknessItem]
    improvements: list[ImprovementSuggestion]
    key_messages_delivered: int = 0
    key_messages_total: int = 0

    model_config = ConfigDict(from_attributes=True)
