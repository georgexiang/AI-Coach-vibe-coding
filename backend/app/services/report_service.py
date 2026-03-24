"""Post-session report generation service."""

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.score import SessionScore
from app.models.session import CoachingSession
from app.schemas.report import (
    DimensionBreakdown,
    ImprovementSuggestion,
    SessionReport,
    StrengthItem,
    WeaknessItem,
)
from app.utils.exceptions import AppException, NotFoundException


async def generate_report(db: AsyncSession, session_id: str) -> SessionReport:
    """Generate a detailed post-session report from scored session data.

    Requires the session to be in 'scored' status with existing score records.
    """
    # Load session with scenario and HCP profile
    result = await db.execute(
        select(CoachingSession)
        .options(
            selectinload(CoachingSession.scenario).selectinload(Scenario.hcp_profile),
        )
        .where(CoachingSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise NotFoundException("Session not found")

    if session.status != "scored":
        raise AppException(
            status_code=409,
            code="NOT_SCORED",
            message=f"Session must be scored before generating a report. "
            f"Current status: '{session.status}'",
        )

    # Load score with details
    score_result = await db.execute(
        select(SessionScore)
        .options(selectinload(SessionScore.details))
        .where(SessionScore.session_id == session_id)
    )
    score = score_result.scalar_one_or_none()
    if score is None:
        raise NotFoundException("Score not found for this session")

    # Parse key messages status
    km_status = json.loads(session.key_messages_status)
    delivered_count = sum(1 for km in km_status if km.get("delivered"))
    total_count = len(km_status)

    # Build dimension breakdowns
    dimensions: list[DimensionBreakdown] = []
    all_strengths: list[StrengthItem] = []
    all_weaknesses: list[WeaknessItem] = []
    improvements: list[ImprovementSuggestion] = []

    for detail in score.details:
        strengths_data = json.loads(detail.strengths)
        weaknesses_data = json.loads(detail.weaknesses)
        suggestions_data = json.loads(detail.suggestions)

        dim_strengths = [StrengthItem(**s) for s in strengths_data]
        dim_weaknesses = [WeaknessItem(**w) for w in weaknesses_data]

        dimensions.append(
            DimensionBreakdown(
                dimension=detail.dimension,
                score=detail.score,
                weight=detail.weight,
                strengths=dim_strengths,
                weaknesses=dim_weaknesses,
                suggestions=suggestions_data,
            )
        )

        all_strengths.extend(dim_strengths)
        all_weaknesses.extend(dim_weaknesses)

        # Convert suggestions to improvement items
        priority = "high" if detail.score < 70 else ("medium" if detail.score < 80 else "low")
        for suggestion in suggestions_data:
            improvements.append(
                ImprovementSuggestion(
                    dimension=detail.dimension,
                    suggestion=suggestion,
                    priority=priority,
                )
            )

    scenario = session.scenario
    hcp_name = scenario.hcp_profile.name if scenario.hcp_profile else "Unknown HCP"

    return SessionReport(
        session_id=session_id,
        scenario_name=scenario.name,
        product=scenario.product,
        hcp_name=hcp_name,
        overall_score=score.overall_score,
        passed=score.passed,
        feedback_summary=score.feedback_summary,
        duration_seconds=session.duration_seconds,
        completed_at=session.completed_at,
        dimensions=dimensions,
        strengths=all_strengths,
        weaknesses=all_weaknesses,
        improvements=improvements,
        key_messages_delivered=delivered_count,
        key_messages_total=total_count,
    )
