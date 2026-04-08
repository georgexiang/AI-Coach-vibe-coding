"""Voice Live service: token generation and configuration validation for Azure Voice Live API.

Supports unified AI Foundry config: when the per-service voice_live row lacks
its own endpoint or API key, falls back to the master AI Foundry config.

Endpoint resolution:
  Voice Live WebSocket requires the cognitiveservices.azure.com endpoint,
  NOT the AI Foundry services.ai.azure.com endpoint. When the effective
  endpoint is an AI Foundry URL, it is automatically transformed to the
  corresponding Cognitive Services URL.

Agent mode resolution:
  Agent mode is activated when the HCP profile has a synced agent_id,
  regardless of the config-level model_or_deployment setting.
  This allows per-HCP agent routing through the Voice Live API.
"""

import logging

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.voice_live import VoiceLiveConfigStatus, VoiceLiveTokenResponse
from app.services import config_service
from app.services.agents.adapters.azure_voice_live import parse_voice_live_mode
from app.services.region_capabilities import VOICE_LIVE_REGIONS
from app.utils.azure_endpoints import to_cognitive_services_endpoint

logger = logging.getLogger(__name__)

SUPPORTED_REGIONS = VOICE_LIVE_REGIONS


# Keep module-level alias for backward compatibility (used by tests)
_to_cognitive_services_endpoint = to_cognitive_services_endpoint


async def _exchange_api_key_for_bearer_token(endpoint: str, api_key: str) -> str:
    """Exchange an API key for a short-lived bearer token via the Cognitive Services STS endpoint.

    Agent mode requires bearer token authentication — API key auth is rejected with
    'Key authentication is not supported in Agent mode'. This function calls the
    STS issueToken endpoint to obtain a 10-minute JWT bearer token.

    Reference: Azure Cognitive Services token authentication docs.
    """
    # STS endpoint: https://{resource}.cognitiveservices.azure.com/sts/v1.0/issueToken
    sts_url = f"{endpoint.rstrip('/')}/sts/v1.0/issueToken"
    logger.info("STS token exchange: endpoint=%s...", sts_url[:60])
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            sts_url,
            headers={"Ocp-Apim-Subscription-Key": api_key},
            content=b"",
        )
        resp.raise_for_status()
        logger.info("STS token exchange succeeded: status=%d", resp.status_code)
        return resp.text


async def get_voice_live_token(
    db: AsyncSession,
    hcp_profile_id: str | None = None,
) -> VoiceLiveTokenResponse:
    """Return Voice Live configuration metadata for the frontend.

    SECURITY: This endpoint never returns the raw API key or bearer token.
    All Voice Live connections go through the backend WebSocket proxy which
    reads credentials from DB directly. The token field is always masked.

    Uses unified AI Foundry config as fallback for endpoint and API key.
    Parses agent/model mode to include agent_id and project_name when applicable.

    If hcp_profile_id is provided and the profile has a synced agent_id,
    returns that profile-specific agent_id instead of the config-level one (D-12, D-14).
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
    raw_endpoint = await config_service.get_effective_endpoint(db, "azure_voice_live")
    if not raw_endpoint:
        raise ValueError("Voice Live endpoint not configured")

    # Voice Live WebSocket requires cognitiveservices.azure.com, not services.ai.azure.com
    effective_endpoint = to_cognitive_services_endpoint(raw_endpoint)

    # Derive effective region
    master = await config_service.get_master_config(db)
    effective_region = vl_config.region or (master.region if master else "")

    # Fetch avatar config
    avatar_config = await config_service.get_config(db, "azure_avatar")
    avatar_key = ""
    if avatar_config and avatar_config.is_active:
        avatar_key = await config_service.get_effective_key(db, "azure_avatar")

    # Parse config-level agent/model mode from model_or_deployment
    mode_info = parse_voice_live_mode(vl_config.model_or_deployment)
    config_is_agent = mode_info.get("mode") == "agent"

    logger.info(
        "get_voice_live_token: hcp=%s, vl_status=%s, mode=%s",
        hcp_profile_id,
        "active" if vl_config.is_active else "inactive",
        mode_info.get("mode", "model"),
    )

    # Default voice_live_model from config (overridden by per-HCP profile if available)
    from app.config import get_settings

    _default_model = get_settings().voice_live_default_model
    voice_live_model = mode_info.get("model", _default_model)

    # Config-level agent/project defaults
    agent_id = mode_info.get("agent_id") if config_is_agent else None
    default_project = master.default_project if master else ""
    project_name_val = mode_info.get("project_name") or default_project if config_is_agent else None

    # Per-HCP defaults (used when no profile provided or on fallback)
    voice_name = "zh-CN-XiaoxiaoMultilingualNeural"
    voice_type = "azure-standard"
    voice_temperature = 0.9
    voice_custom = False
    avatar_character_val = (
        avatar_config.model_or_deployment if avatar_config else "Lisa-casual-sitting"
    )
    avatar_style_val = "casual"
    avatar_customized_val = False
    turn_detection_type = "server_vad"
    noise_suppression = False
    echo_cancellation = False
    eou_detection = False
    recognition_language = "auto"

    # If hcp_profile_id provided, source ALL settings from HCP profile (D-08, D-12, D-14)
    # Config resolution: VoiceLiveInstance > deprecated inline HcpProfile fields
    if hcp_profile_id:
        from app.services import hcp_profile_service
        from app.services.voice_live_instance_service import resolve_voice_config

        try:
            profile = await hcp_profile_service.get_hcp_profile(db, hcp_profile_id)

            # HCP-level agent override: if this profile has a synced agent_id,
            # activate agent mode regardless of config-level setting.
            # This enables per-HCP agent routing through Voice Live.
            if profile.agent_id and profile.agent_sync_status == "synced":
                agent_id = profile.agent_id
                project_name_val = default_project

            # Resolve voice config from VoiceLiveInstance or fallback inline fields
            vc = resolve_voice_config(profile)
            voice_name = vc["voice_name"] or "en-US-AvaNeural"
            voice_type = vc["voice_type"] or "azure-standard"
            voice_temperature = (
                vc["voice_temperature"] if vc["voice_temperature"] is not None else 0.9
            )
            voice_custom = vc["voice_custom"]
            avatar_character_val = vc["avatar_character"] or "lori"
            avatar_style_val = vc["avatar_style"] or "casual"
            avatar_customized_val = vc["avatar_customized"]
            turn_detection_type = vc["turn_detection_type"] or "server_vad"
            noise_suppression = vc["noise_suppression"]
            echo_cancellation = vc["echo_cancellation"]
            eou_detection = vc["eou_detection"]
            recognition_language = vc["recognition_language"] or "auto"
            voice_live_model = vc["voice_live_model"] or _default_model
        except Exception:
            logger.warning(
                "Failed to load HCP profile %s for Voice Live token, using defaults",
                hcp_profile_id,
                exc_info=True,
            )

    # Determine final mode: agent if agent_id is set (from config or HCP profile)
    is_agent = bool(agent_id)

    # Agent mode availability for frontend display
    from app.config import get_settings as _get_settings_inner

    _agent_mode_enabled = _get_settings_inner().voice_live_agent_mode_enabled
    agent_mode_available = False
    agent_warning: str | None = None
    if hcp_profile_id:
        if is_agent and _agent_mode_enabled:
            agent_mode_available = True
        elif not is_agent:
            agent_warning = "HCP profile does not have a synced agent. Using model mode."
    # No warning when no hcp_profile_id (generic/standalone mode)

    logger.info(
        "get_voice_live_token resolved: final_mode=%s, model=%s, voice=%s, "
        "avatar=%s/%s, agent_id=%s",
        "agent" if is_agent else "model",
        voice_live_model,
        voice_name,
        avatar_character_val,
        avatar_style_val,
        agent_id or "none",
    )

    # SECURITY: Never expose the raw API key to the frontend.
    # All Voice Live connections go through the backend WebSocket proxy which
    # reads credentials from DB directly. The token broker only returns metadata.
    auth_type = "key"
    token_value = "***configured***"
    if is_agent:
        auth_type = "bearer"
        token_value = "***configured***"

    return VoiceLiveTokenResponse(
        endpoint=effective_endpoint,
        token=token_value,
        auth_type=auth_type,
        region=effective_region,
        model=voice_live_model if not is_agent else "",
        avatar_enabled=bool(avatar_config and avatar_config.is_active and avatar_key),
        avatar_character=avatar_character_val,
        voice_name=voice_name,
        agent_id=agent_id,
        project_name=project_name_val,
        # Per-HCP fields (D-08)
        avatar_style=avatar_style_val,
        avatar_customized=avatar_customized_val,
        voice_type=voice_type,
        voice_temperature=voice_temperature,
        voice_custom=voice_custom,
        turn_detection_type=turn_detection_type,
        noise_suppression=noise_suppression,
        echo_cancellation=echo_cancellation,
        eou_detection=eou_detection,
        recognition_language=recognition_language,
        agent_mode_available=agent_mode_available,
        agent_warning=agent_warning,
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
