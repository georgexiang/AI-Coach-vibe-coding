"""Voice Live API: WebSocket proxy, token broker, and configuration endpoints."""

import json
import logging

from fastapi import APIRouter, Depends, Query, WebSocket
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.voice_live import (
    VoiceLiveConfigStatus,
    VoiceLiveModelInfo,
    VoiceLiveModelsResponse,
    VoiceLiveTokenResponse,
)
from app.services import voice_live_service
from app.services.voice_live_websocket import handle_voice_live_websocket
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/voice-live", tags=["voice-live"])


@router.get("/models", response_model=VoiceLiveModelsResponse, status_code=200)
async def get_voice_live_models(
    user: User = Depends(get_current_user),
) -> VoiceLiveModelsResponse:
    """Return the list of supported Voice Live generative AI models."""
    from app.services.voice_live_models import VOICE_LIVE_MODELS

    models = [
        VoiceLiveModelInfo(
            id=model_id,
            label=info["label"],
            tier=info["tier"],
            description=info["description"],
        )
        for model_id, info in VOICE_LIVE_MODELS.items()
    ]
    return VoiceLiveModelsResponse(models=models)


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


async def _authenticate_websocket(
    ws: WebSocket,
    db: AsyncSession,
) -> User | None:
    """Validate JWT token from WebSocket query parameter.

    Browser WebSocket API cannot set HTTP Authorization headers, so the token
    is passed as a query parameter: ws://host/ws?token=xxx

    Returns the authenticated User, or None if authentication fails
    (after sending an error message and closing the connection with 1008).
    """
    token = ws.query_params.get("token")
    if not token:
        await ws.accept()
        await ws.send_text(
            json.dumps(
                {
                    "type": "error",
                    "error": {"message": "Authentication required: missing token query parameter"},
                }
            )
        )
        await ws.close(code=1008, reason="Authentication required")
        return None

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise JWTError("Missing sub claim")
    except JWTError:
        await ws.accept()
        await ws.send_text(
            json.dumps(
                {
                    "type": "error",
                    "error": {"message": "Authentication failed: invalid token"},
                }
            )
        )
        await ws.close(code=1008, reason="Invalid token")
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        await ws.accept()
        await ws.send_text(
            json.dumps(
                {
                    "type": "error",
                    "error": {"message": "Authentication failed: user not found or inactive"},
                }
            )
        )
        await ws.close(code=1008, reason="User not found or inactive")
        return None

    return user


@router.websocket("/ws")
async def voice_live_websocket(
    ws: WebSocket,
    db: AsyncSession = Depends(get_db),
) -> None:
    """WebSocket proxy: client ↔ backend ↔ Azure Voice Live.

    Authentication: JWT token must be passed as query parameter `token`.
    Example: ws://host/api/v1/voice-live/ws?token=eyJhbGciOi...

    Protocol:
      1. Client connects to ws://.../api/v1/voice-live/ws?token=<jwt>
      2. Backend validates JWT token (same logic as HTTP endpoints)
      3. Client sends: {"type": "session.update", "session": {"hcp_profile_id": "...", ...}}
      4. Backend connects to Azure Voice Live via Python SDK, sends proxy.connected
      5. Bidirectional message proxy until disconnect
    """
    user = await _authenticate_websocket(ws, db)
    if user is None:
        return  # Authentication failed, connection already closed

    logger.info("Voice Live WS authenticated: user=%s", user.id)
    await handle_voice_live_websocket(ws, db)
