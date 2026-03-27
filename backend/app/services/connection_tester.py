"""Connection testing for Azure services: real API calls to validate credentials."""

import httpx


async def test_azure_openai(endpoint: str, api_key: str, deployment: str) -> tuple[bool, str]:
    """Test Azure OpenAI connection by making a minimal chat completion call."""
    try:
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version="2024-06-01",
            timeout=10.0,
        )
        await client.chat.completions.create(
            model=deployment,
            messages=[{"role": "user", "content": "test"}],
            max_tokens=1,
        )
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


async def test_azure_avatar(endpoint: str, api_key: str) -> tuple[bool, str]:
    """Validate Azure Avatar configuration format (no live API call -- requires WebRTC)."""
    if not endpoint or not endpoint.startswith("https://"):
        return (False, "Invalid endpoint: must start with https://")
    if not api_key:
        return (False, "API key is required")
    return (True, "Configuration valid (avatar connectivity requires WebRTC)")


async def test_service_connection(
    service_name: str,
    endpoint: str,
    api_key: str,
    deployment: str,
    region: str,
) -> tuple[bool, str]:
    """Route connection test to the correct service-specific tester."""
    if service_name == "azure_openai":
        return await test_azure_openai(endpoint, api_key, deployment)
    elif service_name in ("azure_speech_stt", "azure_speech_tts"):
        return await test_azure_speech(key=api_key, region=region)
    elif service_name == "azure_avatar":
        return await test_azure_avatar(endpoint, api_key)
    elif service_name == "azure_content":
        # Content Understanding: basic format validation
        if not endpoint or not endpoint.startswith("https://"):
            return (False, "Invalid endpoint: must start with https://")
        if not api_key:
            return (False, "API key is required")
        return (True, "Configuration valid")
    else:
        return (False, f"Unknown service: {service_name}")
