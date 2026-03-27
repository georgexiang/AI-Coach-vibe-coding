"""Voice Live service: token generation and configuration validation for Azure Voice Live API."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.voice_live import VoiceLiveConfigStatus, VoiceLiveTokenResponse
from app.services import config_service

SUPPORTED_REGIONS = {"eastus2", "swedencentral"}


async def get_voice_live_token(db: AsyncSession) -> VoiceLiveTokenResponse:
    """Generate a token response for the frontend to connect directly to Azure Voice Live API."""
    # Fetch azure_voice_live config
    vl_config = await config_service.get_config(db, "azure_voice_live")
    if not vl_config or not vl_config.is_active:
        raise ValueError("Voice Live not configured")

    api_key = await config_service.get_decrypted_key(db, "azure_voice_live")
    if not api_key:
        raise ValueError("Voice Live API key not set")

    # Fetch avatar config
    avatar_config = await config_service.get_config(db, "azure_avatar")
    avatar_key = ""
    if avatar_config and avatar_config.is_active:
        avatar_key = await config_service.get_decrypted_key(db, "azure_avatar")

    return VoiceLiveTokenResponse(
        endpoint=vl_config.endpoint,
        token=api_key,
        region=vl_config.region,
        model=vl_config.model_or_deployment or "gpt-4o-realtime-preview",
        avatar_enabled=bool(avatar_config and avatar_config.is_active and avatar_key),
        avatar_character=(
            avatar_config.model_or_deployment if avatar_config else "Lisa-casual-sitting"
        ),
        voice_name="zh-CN-XiaoxiaoMultilingualNeural",
    )


async def get_voice_live_status(db: AsyncSession) -> VoiceLiveConfigStatus:
    """Check Voice Live and Avatar availability for the current deployment."""
    vl_config = await config_service.get_config(db, "azure_voice_live")
    vl_key = await config_service.get_decrypted_key(db, "azure_voice_live") if vl_config else ""
    avatar_config = await config_service.get_config(db, "azure_avatar")
    avatar_key = await config_service.get_decrypted_key(db, "azure_avatar") if avatar_config else ""

    return VoiceLiveConfigStatus(
        voice_live_available=bool(vl_config and vl_config.is_active and vl_key),
        avatar_available=bool(avatar_config and avatar_config.is_active and avatar_key),
        voice_name="zh-CN-XiaoxiaoMultilingualNeural",
        avatar_character=(
            avatar_config.model_or_deployment if avatar_config else "Lisa-casual-sitting"
        ),
    )


def validate_region(region: str) -> bool:
    """Check if the given region supports Azure Voice Live API."""
    return region.lower() in SUPPORTED_REGIONS
