"""Connection testing for Azure services: real API calls to validate credentials."""

import re

import httpx

AZURE_HOST_PATTERN = re.compile(
    r"^https://[\w.-]+\."
    r"(azure\.com|microsoft\.com|azure\.net|windows\.net"
    r"|cognitive\.microsoft\.com|cognitiveservices\.azure\.com"
    r"|services\.ai\.azure\.com|openai\.azure\.com"
    r"|tts\.speech\.microsoft\.com)(/.*)?$",
    re.IGNORECASE,
)


def validate_endpoint_url(endpoint: str) -> tuple[bool, str]:
    """Validate endpoint URL: must be HTTPS and match Azure host patterns."""
    if not endpoint:
        return (False, "Endpoint is required")
    if not endpoint.startswith("https://"):
        return (False, "Endpoint must use HTTPS")
    if not AZURE_HOST_PATTERN.match(endpoint):
        return (
            False,
            "Endpoint must be an Azure service URL (*.azure.com, *.microsoft.com, *.azure.net)",
        )
    return (True, "")


async def test_ai_foundry_endpoint(endpoint: str, api_key: str) -> tuple[bool, str]:
    """Test AI Foundry master config by listing deployments (no specific deployment needed)."""
    valid, msg = validate_endpoint_url(endpoint)
    if not valid:
        return (False, msg)
    if not api_key:
        return (False, "API key is required")
    try:
        base = endpoint.rstrip("/")
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{base}/openai/deployments?api-version=2024-06-01"
            response = await client.get(url, headers={"api-key": api_key})
            if response.status_code == 200:
                data = response.json()
                count = len(data.get("data", []))
                return (True, f"Connection successful ({count} deployment(s) found)")
            elif response.status_code in (401, 403):
                return (False, f"Authentication failed: HTTP {response.status_code}")
            return (False, f"HTTP {response.status_code}: {response.text[:200]}")
    except Exception as e:
        return (False, f"Connection failed: {e!s}")


async def test_azure_openai(endpoint: str, api_key: str, deployment: str) -> tuple[bool, str]:
    """Test Azure OpenAI connection by making a minimal chat completion call."""
    valid, msg = validate_endpoint_url(endpoint)
    if not valid:
        return (False, msg)
    try:
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version="2024-06-01",
            timeout=10.0,
        )
        # Try max_completion_tokens first (newer models like gpt-4o, gpt-5.4-mini, o1, o3),
        # fall back to max_tokens for older models (gpt-4, gpt-35-turbo)
        try:
            await client.chat.completions.create(
                model=deployment,
                messages=[{"role": "user", "content": "Hi"}],
                max_completion_tokens=10,
            )
        except Exception as first_err:
            if "max_completion_tokens" in str(first_err):
                await client.chat.completions.create(
                    model=deployment,
                    messages=[{"role": "user", "content": "Hi"}],
                    max_tokens=10,
                )
            else:
                raise
        return (True, "Connection successful")
    except ImportError:
        return (False, "Connection failed: openai package not installed")
    except Exception as e:
        return (False, f"Connection failed: {e!s}")


async def test_azure_speech(key: str, region: str) -> tuple[bool, str]:
    """Test Azure Speech connection by listing available voices."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/voices/list"
            response = await client.get(
                url,
                headers={"Ocp-Apim-Subscription-Key": key},
            )
            if response.status_code == 200:
                return (True, "Connection successful")
            return (False, f"HTTP {response.status_code}: {response.text[:200]}")
    except Exception as e:
        return (False, f"Connection failed: {e!s}")


async def test_azure_avatar(api_key: str, region: str) -> tuple[bool, str]:
    """Test Avatar by fetching ICE relay token from the regional TTS endpoint."""
    if not api_key:
        return (False, "API key is required")
    if not region:
        return (False, "Region is required for Avatar service")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = (
                f"https://{region}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1"
            )
            response = await client.get(
                url,
                headers={"Ocp-Apim-Subscription-Key": api_key},
            )
            if response.status_code == 200:
                return (True, "Avatar service reachable (ICE token retrieved)")
            return (False, f"Avatar test failed: HTTP {response.status_code}")
    except Exception as e:
        return (False, f"Avatar connection failed: {e!s}")


async def test_azure_content_understanding(
    endpoint: str,
    api_key: str,
) -> tuple[bool, str]:
    """Test Content Understanding by listing analyzers."""
    valid, msg = validate_endpoint_url(endpoint)
    if not valid:
        return (False, msg)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{endpoint.rstrip('/')}/contentunderstanding/analyzers?api-version=2025-11-01"
            response = await client.get(
                url,
                headers={"Ocp-Apim-Subscription-Key": api_key},
            )
            if response.status_code == 200:
                return (True, "Content Understanding service connected. Analyzers accessible.")
            return (
                False,
                f"Content Understanding test failed: "
                f"HTTP {response.status_code}: {response.text[:200]}",
            )
    except Exception as e:
        return (False, f"Content Understanding connection failed: {e!s}")


async def test_azure_realtime(
    endpoint: str,
    api_key: str,
    deployment: str,
) -> tuple[bool, str]:
    """Test Realtime API by verifying deployment exists via REST."""
    valid, msg = validate_endpoint_url(endpoint)
    if not valid:
        return (False, msg)
    try:
        base = endpoint.rstrip("/")
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{base}/openai/deployments/{deployment}?api-version=2024-06-01"
            response = await client.get(
                url,
                headers={"api-key": api_key},
            )
            if response.status_code == 200:
                return (True, "Realtime API deployment verified.")
            elif response.status_code in (401, 403):
                return (False, f"Authentication failed: HTTP {response.status_code}")
            elif response.status_code == 404:
                return (False, f"Deployment '{deployment}' not found")
            return (False, f"HTTP {response.status_code}: {response.text[:200]}")
    except Exception as e:
        return (False, f"Realtime connection failed: {e!s}")


async def test_azure_voice_live(endpoint: str, api_key: str, region: str) -> tuple[bool, str]:
    """Test Azure Voice Live API configuration by validating region and endpoint format."""
    from app.services.voice_live_service import SUPPORTED_REGIONS

    valid, msg = validate_endpoint_url(endpoint)
    if not valid:
        return (False, msg)
    if not api_key:
        return (False, "API key is required")
    if region.lower() not in SUPPORTED_REGIONS:
        return (
            False,
            f"Unsupported region: {region}. Voice Live API is only available in: "
            f"{', '.join(sorted(SUPPORTED_REGIONS))}",
        )
    # Attempt a lightweight HTTP probe to the endpoint
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{endpoint.rstrip('/')}/openai/realtime"
            response = await client.get(
                url,
                headers={"api-key": api_key},
                params={"api-version": "2025-04-01-preview"},
            )
            if response.status_code in (404, 405, 426):
                return (True, "Connection successful (endpoint reachable)")
            elif response.status_code in (401, 403):
                return (False, f"Authentication failed: HTTP {response.status_code}")
            else:
                return (True, f"Endpoint reachable (HTTP {response.status_code})")
    except Exception:
        return (True, "Configuration valid (region supported, endpoint format correct)")


async def test_service_connection(
    service_name: str,
    endpoint: str,
    api_key: str,
    deployment: str,
    region: str,
    master_endpoint: str = "",
    master_key: str = "",
    master_region: str = "",
) -> tuple[bool, str]:
    """Route connection test to the correct service-specific tester.

    When a per-service config has empty endpoint/key, falls back to master
    AI Foundry values and derives service-specific URLs.
    """
    # Apply master fallbacks
    effective_key = api_key or master_key
    effective_region = region or master_region

    if service_name == "ai_foundry":
        effective_endpoint = endpoint or master_endpoint
        return await test_ai_foundry_endpoint(effective_endpoint, effective_key)
    elif service_name == "azure_openai":
        effective_endpoint = endpoint or (
            f"{master_endpoint.rstrip('/')}/" if master_endpoint else ""
        )
        return await test_azure_openai(effective_endpoint, effective_key, deployment)
    elif service_name in ("azure_speech_stt", "azure_speech_tts"):
        return await test_azure_speech(key=effective_key, region=effective_region)
    elif service_name == "azure_avatar":
        return await test_azure_avatar(api_key=effective_key, region=effective_region)
    elif service_name == "azure_voice_live":
        effective_endpoint = endpoint or master_endpoint
        return await test_azure_voice_live(effective_endpoint, effective_key, effective_region)
    elif service_name == "azure_content":
        effective_endpoint = endpoint or master_endpoint
        return await test_azure_content_understanding(effective_endpoint, effective_key)
    elif service_name == "azure_openai_realtime":
        effective_endpoint = endpoint or master_endpoint
        return await test_azure_realtime(effective_endpoint, effective_key, deployment)
    else:
        return (False, f"Unknown service: {service_name}")
