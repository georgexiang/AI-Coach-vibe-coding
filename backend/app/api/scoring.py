"""Scoring API: trigger scoring and retrieve scores for sessions."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.score import SessionScoreResponse
from app.services import scoring_service, session_service
from app.utils.exceptions import NotFoundException

router = APIRouter(prefix="/scoring", tags=["scoring"])


# Static route BEFORE parameterized /sessions/{session_id} per Gotcha #3
@router.get("/history")
async def get_score_history(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the current user's score history with dimension trends."""
    return await scoring_service.get_score_history(db, user.id, limit)


@router.post(
    "/sessions/{session_id}/score",
    response_model=SessionScoreResponse,
    status_code=201,
)
async def trigger_scoring(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Trigger multi-dimensional scoring for a completed session."""
    # Verify session belongs to current user
    await session_service.get_session(db, session_id, user.id)
    score = await scoring_service.score_session(db, session_id)
    return score


@router.get(
    "/sessions/{session_id}/score",
    response_model=SessionScoreResponse,
)
async def get_session_score(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the existing score for a session."""
    # Verify session belongs to current user
    await session_service.get_session(db, session_id, user.id)
    score = await scoring_service.get_session_score(db, session_id)
    if score is None:
        raise NotFoundException("Session has not been scored yet")
    return score
