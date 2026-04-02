"""Voice Live API token broker: issues credentials for direct browser-to-Azure connection."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.voice_live import VoiceLiveConfigStatus, VoiceLiveTokenResponse
from app.services import voice_live_service
from app.utils.exceptions import AppException

router = APIRouter(prefix="/voice-live", tags=["voice-live"])


@router.post("/token", response_model=VoiceLiveTokenResponse, status_code=200)
async def get_voice_live_token(
    hcp_profile_id: str | None = Query(
        None, description="HCP profile ID to source voice/avatar settings"
    ),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> VoiceLiveTokenResponse:
    """Issue credentials for direct browser-to-Azure Voice Live connection.

    When hcp_profile_id is provided, includes per-HCP voice/avatar settings.
    """
    try:
        return await voice_live_service.get_voice_live_token(db, hcp_profile_id=hcp_profile_id)
    except ValueError as e:
        raise AppException(
            status_code=503,
            code="VOICE_LIVE_NOT_CONFIGURED",
            message=str(e),
        ) from None


@router.get("/status", response_model=VoiceLiveConfigStatus, status_code=200)
async def get_voice_live_status(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> VoiceLiveConfigStatus:
    """Check Voice Live and Avatar availability for the current deployment."""
    return await voice_live_service.get_voice_live_status(db)
