"""Analytics response schemas for dashboard and reporting endpoints."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DimensionScore(BaseModel):
    """Score for one dimension in one session."""

    dimension: str
    score: float
    weight: int
    model_config = ConfigDict(from_attributes=True)


class DimensionTrendPoint(BaseModel):
    """A single data point in a per-dimension time series."""

    session_id: str
    completed_at: datetime | None
    scenario_name: str
    overall_score: float
    dimensions: list[DimensionScore]
    model_config = ConfigDict(from_attributes=True)


class UserDashboardStats(BaseModel):
    """All four stat card values for user dashboard."""

    total_sessions: int
    avg_score: float
    this_week: int
    improvement: float | None  # latest score minus previous, None if < 2 sessions
    model_config = ConfigDict(from_attributes=True)


class BuStats(BaseModel):
    """Per-business-unit aggregated stats."""

    business_unit: str
    session_count: int
    avg_score: float
    user_count: int
    model_config = ConfigDict(from_attributes=True)


class SkillGapCell(BaseModel):
    """Single cell in the skill gap heatmap matrix."""

    business_unit: str
    dimension: str
    avg_score: float
    model_config = ConfigDict(from_attributes=True)


class OrgAnalytics(BaseModel):
    """Organization-level analytics for admin dashboard."""

    total_users: int
    active_users: int
    completion_rate: float
    total_sessions: int
    avg_org_score: float
    bu_stats: list[BuStats]
    skill_gaps: list[SkillGapCell]
    model_config = ConfigDict(from_attributes=True)


class RecommendedScenarioItem(BaseModel):
    """A recommended scenario for the user."""

    scenario_id: str
    scenario_name: str
    product: str
    difficulty: str
    reason: str  # e.g. "Targets your weakest dimension: objection_handling"
    target_dimension: str
    model_config = ConfigDict(from_attributes=True)
