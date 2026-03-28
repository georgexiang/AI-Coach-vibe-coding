"""Azure service configuration API: CRUD backed by DB with dynamic adapter registration."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_db, require_role
from app.models.user import User
from app.schemas.azure_config import (
    ConnectionTestResult,
    ServiceConfigResponse,
    ServiceConfigUpdate,
)
from app.services import config_service
from app.services.connection_tester import test_service_connection
from app.services.region_capabilities import get_region_capabilities
from app.utils.exceptions import AppException

router = APIRouter(prefix="/azure-config", tags=["azure-config"])

settings = get_settings()

# Valid service names and their display labels
SERVICE_DISPLAY_NAMES = {
    "azure_openai": "Azure OpenAI",
    "azure_speech_stt": "Azure Speech (STT)",
    "azure_speech_tts": "Azure Speech (TTS)",
    "azure_avatar": "Azure AI Avatar",
    "azure_content": "Azure Content Understanding",
    "azure_voice_live": "Azure Voice Live API",
    "azure_openai_realtime": "Azure OpenAI Realtime",
}


async def register_adapter_from_config(
    service_name: str,
    endpoint: str,
    api_key: str,
    deployment: str,
    region: str,
) -> None:
    """Dynamically register an adapter in the ServiceRegistry based on saved config."""
    from app.services.agents.registry import registry

    if service_name == "azure_openai" and api_key:
        from app.services.agents.adapters.azure_openai import AzureOpenAIAdapter

        adapter = AzureOpenAIAdapter(endpoint=endpoint, api_key=api_key, deployment=deployment)
        registry.register("llm", adapter)
        settings.default_llm_provider = "azure_openai"

    elif service_name == "azure_speech_stt" and api_key:
        from app.services.agents.stt.azure import AzureSTTAdapter

        registry.register("stt", AzureSTTAdapter(api_key, region))
        settings.default_stt_provider = "azure"

    elif service_name == "azure_speech_tts" and api_key:
        from app.services.agents.tts.azure import AzureTTSAdapter

        registry.register("tts", AzureTTSAdapter(api_key, region))
        settings.default_tts_provider = "azure"

    elif service_name == "azure_avatar" and api_key:
        from app.services.agents.avatar.azure import AzureAvatarAdapter

        registry.register("avatar", AzureAvatarAdapter(endpoint, api_key, region=region))

    elif service_name == "azure_openai_realtime" and api_key:
        from app.services.agents.adapters.azure_realtime import AzureRealtimeAdapter

        adapter = AzureRealtimeAdapter(endpoint=endpoint, api_key=api_key, deployment=deployment)
        registry.register("realtime", adapter)

    elif service_name == "azure_content" and api_key:
        from app.services.agents.adapters.azure_content import AzureContentUnderstandingAdapter

        adapter = AzureContentUnderstandingAdapter(endpoint=endpoint, api_key=api_key)
        registry.register("content_understanding", adapter)

    elif service_name == "azure_voice_live" and api_key:
        from app.services.agents.adapters.azure_voice_live import AzureVoiceLiveAdapter

        adapter = AzureVoiceLiveAdapter(
            endpoint=endpoint,
            api_key=api_key,
            model_or_deployment=deployment,
            region=region,
        )
        registry.register("voice_live", adapter)


@router.get("/region-capabilities/{region}")
async def get_capabilities(
    region: str,
    _admin: User = Depends(require_role("admin")),
) -> dict:
    """Return which Azure AI services are available in the given region."""
    return get_region_capabilities(region)


@router.get("/services", response_model=list[ServiceConfigResponse])
async def list_services(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> list[ServiceConfigResponse]:
    """List all Azure services with their current configuration from the database."""
    return await config_service.get_all_configs(db)


@router.put("/services/{service_name}", response_model=ServiceConfigResponse, status_code=200)
async def update_service(
    service_name: str,
    update: ServiceConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role("admin")),
) -> ServiceConfigResponse:
    """Create or update an Azure service configuration."""
    if service_name not in SERVICE_DISPLAY_NAMES:
        raise AppException(
            status_code=400,
            code="INVALID_SERVICE",
            message=f"Unknown service: {service_name}. Valid: {list(SERVICE_DISPLAY_NAMES.keys())}",
        )

    config = await config_service.upsert_config(
        db, service_name, SERVICE_DISPLAY_NAMES[service_name], update, admin.id
    )

    # Determine the API key for adapter registration
    api_key = update.api_key or await config_service.get_decrypted_key(db, service_name)

    await register_adapter_from_config(
        service_name, config.endpoint, api_key, config.model_or_deployment, config.region
    )

    # Return the saved config with masked key
    all_configs = await config_service.get_all_configs(db)
    for cfg in all_configs:
        if cfg.service_name == service_name:
            return cfg

    # Fallback (should not happen after upsert)
    return ServiceConfigResponse(
        service_name=service_name,
        display_name=SERVICE_DISPLAY_NAMES[service_name],
        endpoint=config.endpoint,
        masked_key="****",
        model_or_deployment=config.model_or_deployment,
        region=config.region,
        is_active=config.is_active,
        updated_at=config.updated_at,
    )


@router.post("/services/{service_name}/test", response_model=ConnectionTestResult)
async def test_service(
    service_name: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> ConnectionTestResult:
    """Test connection to a specific Azure service using saved credentials."""
    config = await config_service.get_config(db, service_name)

    if config is None:
        return ConnectionTestResult(
            service_name=service_name,
            success=False,
            message="Service not configured",
        )

    api_key = await config_service.get_decrypted_key(db, service_name)

    success, message = await test_service_connection(
        service_name, config.endpoint, api_key, config.model_or_deployment, config.region
    )

    return ConnectionTestResult(
        service_name=service_name,
        success=success,
        message=message,
    )
