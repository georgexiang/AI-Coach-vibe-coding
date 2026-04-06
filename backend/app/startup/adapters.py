"""Register AI coaching adapters during startup."""

import logging

from app.config import get_settings

logger = logging.getLogger(__name__)


def register_adapters() -> None:
    """Register mock and Azure adapters based on available credentials."""
    from app.services.agents.adapters.mock import MockCoachingAdapter
    from app.services.agents.avatar.mock import MockAvatarAdapter
    from app.services.agents.registry import registry
    from app.services.agents.stt.mock import MockSTTAdapter
    from app.services.agents.tts.mock import MockTTSAdapter

    # Mock adapters are always available (no Azure credentials needed)
    registry.register("llm", MockCoachingAdapter())
    registry.register("stt", MockSTTAdapter())
    registry.register("tts", MockTTSAdapter())
    registry.register("avatar", MockAvatarAdapter())
    logger.info("Mock adapters registered")

    settings = get_settings()

    # Azure Speech adapters (STT + TTS)
    if settings.azure_speech_key and settings.azure_speech_region:
        from app.services.agents.stt.azure import AzureSTTAdapter
        from app.services.agents.tts.azure import AzureTTSAdapter

        registry.register(
            "stt", AzureSTTAdapter(settings.azure_speech_key, settings.azure_speech_region)
        )
        registry.register(
            "tts", AzureTTSAdapter(settings.azure_speech_key, settings.azure_speech_region)
        )
        logger.info("Azure Speech adapters registered")

    # Azure Avatar adapter (premium option behind feature toggle)
    if settings.azure_avatar_endpoint and settings.azure_avatar_key:
        from app.services.agents.avatar.azure import AzureAvatarAdapter

        registry.register(
            "avatar",
            AzureAvatarAdapter(settings.azure_avatar_endpoint, settings.azure_avatar_key),
        )
        logger.info("Azure Avatar adapter registered")
