"""Configuration API endpoint: feature flags, available adapters."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.config import get_settings
from app.dependencies import get_current_user
from app.services.agents.registry import registry

router = APIRouter(prefix="/config", tags=["config"])


class FeatureFlags(BaseModel):
    """Current feature toggle state."""

    avatar_enabled: bool
    voice_enabled: bool
    realtime_voice_enabled: bool
    conference_enabled: bool
    voice_live_enabled: bool
    default_voice_mode: str
    region: str


class ConfigResponse(BaseModel):
    """Configuration response with feature flags and available adapters."""

    features: FeatureFlags
    available_adapters: dict[str, list[str]]


@router.get("/features", response_model=ConfigResponse)
async def get_features(user=Depends(get_current_user)):
    """Return current feature flags and available adapters."""
    settings = get_settings()
    adapters = registry.list_all_categories()
    return ConfigResponse(
        features=FeatureFlags(
            avatar_enabled=settings.feature_avatar_enabled,
            voice_enabled=settings.feature_voice_enabled,
            realtime_voice_enabled=settings.feature_realtime_voice_enabled,
            conference_enabled=settings.feature_conference_enabled,
            voice_live_enabled=settings.feature_voice_live_enabled,
            default_voice_mode=settings.default_voice_mode,
            region=settings.region,
        ),
        available_adapters=adapters,
    )
