"""Scoring API: trigger scoring and retrieve scores for sessions."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.score import SessionScoreResponse
from app.services import scoring_service, session_service
from app.utils.exceptions import NotFoundException

router = APIRouter(prefix="/scoring", tags=["scoring"])


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
