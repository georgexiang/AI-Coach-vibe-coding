"""Voice Live service: token generation and configuration validation for Azure Voice Live API.

Supports unified AI Foundry config: when the per-service voice_live row lacks
its own endpoint or API key, falls back to the master AI Foundry config.
Parses agent/model mode from model_or_deployment to include agent_id and
project_name in token responses when agent mode is selected.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.voice_live import VoiceLiveConfigStatus, VoiceLiveTokenResponse
from app.services import config_service
from app.services.agents.adapters.azure_voice_live import parse_voice_live_mode
from app.services.region_capabilities import VOICE_LIVE_REGIONS

SUPPORTED_REGIONS = VOICE_LIVE_REGIONS


async def get_voice_live_token(db: AsyncSession) -> VoiceLiveTokenResponse:
    """Generate a token response for the frontend to connect directly to Azure Voice Live API.

    Uses unified AI Foundry config as fallback for endpoint and API key.
    Parses agent/model mode to include agent_id and project_name when applicable.
    """
    # Fetch azure_voice_live config
    vl_config = await config_service.get_config(db, "azure_voice_live")
    if not vl_config or not vl_config.is_active:
        raise ValueError("Voice Live not configured")

    # Try per-service key first, then fall back to master AI Foundry key
    api_key = await config_service.get_effective_key(db, "azure_voice_live")
    if not api_key:
        raise ValueError("Voice Live API key not set")

    # Derive effective endpoint from per-service or master config
    effective_endpoint = await config_service.get_effective_endpoint(db, "azure_voice_live")
    if not effective_endpoint:
        raise ValueError("Voice Live endpoint not configured")

    # Derive effective region
    master = await config_service.get_master_config(db)
    effective_region = vl_config.region or (master.region if master else "")

    # Fetch avatar config
    avatar_config = await config_service.get_config(db, "azure_avatar")
    avatar_key = ""
    if avatar_config and avatar_config.is_active:
        avatar_key = await config_service.get_effective_key(db, "azure_avatar")

    # Parse agent/model mode from model_or_deployment
    mode_info = parse_voice_live_mode(vl_config.model_or_deployment)
    is_agent = mode_info.get("mode") == "agent"

    return VoiceLiveTokenResponse(
        endpoint=effective_endpoint,
        token=api_key,
        region=effective_region,
        model=mode_info.get("model", "gpt-4o-realtime-preview") if not is_agent else "",
        avatar_enabled=bool(avatar_config and avatar_config.is_active and avatar_key),
        avatar_character=(
            avatar_config.model_or_deployment if avatar_config else "Lisa-casual-sitting"
        ),
        voice_name="zh-CN-XiaoxiaoMultilingualNeural",
        agent_id=mode_info.get("agent_id") if is_agent else None,
        project_name=mode_info.get("project_name") if is_agent else None,
    )


async def get_voice_live_status(db: AsyncSession) -> VoiceLiveConfigStatus:
    """Check Voice Live and Avatar availability for the current deployment.

    Uses master AI Foundry config as fallback for key availability checks.
    """
    vl_config = await config_service.get_config(db, "azure_voice_live")
    vl_key = await config_service.get_effective_key(db, "azure_voice_live") if vl_config else ""

    avatar_config = await config_service.get_config(db, "azure_avatar")
    avatar_key = await config_service.get_effective_key(db, "azure_avatar") if avatar_config else ""

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
