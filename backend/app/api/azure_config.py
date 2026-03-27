"""Azure service configuration API endpoints (PLAT-03)."""

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.config import get_settings
from app.dependencies import require_role
from app.models.user import User

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
}


class ServiceStatus(BaseModel):
    """Status of a single Azure service."""

    name: str
    display_name: str
    status: str  # "connected" | "not_configured"
    endpoint: str
    masked_key: str


class ServiceUpdateRequest(BaseModel):
    """Request to update service configuration."""

    endpoint: str = ""
    api_key: str = ""
    model: str = ""
    region: str = ""


class TestResult(BaseModel):
    """Result of a service connection test."""

    service: str
    success: bool
    message: str


def _mask_key(key: str) -> str:
    """Mask API key, showing only last 4 characters."""
    if not key or len(key) < 4:
        return "****" if key else ""
    return f"****{key[-4:]}"


def _get_service_configs() -> list[dict[str, Any]]:
    """Build list of Azure services from current settings."""
    return [
        {
            "name": "azure_openai",
            "display_name": "Azure OpenAI",
            "endpoint": settings.azure_openai_endpoint,
            "key": settings.azure_openai_api_key,
            "model": settings.azure_openai_deployment,
        },
        {
            "name": "azure_speech",
            "display_name": "Azure Speech Services",
            "endpoint": f"https://{settings.azure_speech_region}.api.cognitive.microsoft.com"
            if settings.azure_speech_region
            else "",
            "key": settings.azure_speech_key,
            "model": "",
        },
        {
            "name": "azure_avatar",
            "display_name": "Azure AI Avatar",
            "endpoint": settings.azure_avatar_endpoint,
            "key": settings.azure_avatar_key,
            "model": "",
        },
        {
            "name": "azure_content",
            "display_name": "Azure Content Understanding",
            "endpoint": settings.azure_content_endpoint,
            "key": settings.azure_content_key,
            "model": "",
        },
    ]


@router.get("/services", response_model=list[ServiceStatus])
async def list_services(
    _admin: User = Depends(require_role("admin")),
) -> list[ServiceStatus]:
    """List all Azure services with their current configuration status."""
    services = _get_service_configs()
    result = []
    for svc in services:
        has_endpoint = bool(svc["endpoint"])
        has_key = bool(svc["key"])
        status = "connected" if (has_endpoint and has_key) else "not_configured"
        result.append(
            ServiceStatus(
                name=svc["name"],
                display_name=svc["display_name"],
                status=status,
                endpoint=svc["endpoint"],
                masked_key=_mask_key(svc["key"]),
            )
        )
    return result


@router.post("/services/{service_name}/test", response_model=TestResult)
async def test_service(
    service_name: str,
    _admin: User = Depends(require_role("admin")),
) -> TestResult:
    """Test connection to a specific Azure service.

    For MVP: validates that endpoint is a valid URL and key is non-empty.
    """
    services = {svc["name"]: svc for svc in _get_service_configs()}

    if service_name not in services:
        return TestResult(
            service=service_name,
            success=False,
            message=f"Unknown service: {service_name}",
        )

    svc = services[service_name]
    endpoint = svc["endpoint"]
    key = svc["key"]

    if not endpoint or not key:
        return TestResult(
            service=service_name,
            success=False,
            message="Service not configured: missing endpoint or API key",
        )

    if not endpoint.startswith("https://"):
        return TestResult(
            service=service_name,
            success=False,
            message="Invalid endpoint: must start with https://",
        )

    # MVP: format validation passes = success
    return TestResult(
        service=service_name,
        success=True,
        message="Configuration valid. Service endpoint and key are properly formatted.",
    )
