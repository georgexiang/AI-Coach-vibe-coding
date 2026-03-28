"""Integration tests for Azure AI Avatar service with real credentials.

Tests validate:
1. ICE relay token retrieval from regional TTS endpoint
2. Connection tester returns success
3. Connection test fails with invalid region

Avatar uses the same credentials as Azure Speech (key + region).
"""

import os

import httpx
import pytest

from app.services.connection_tester import test_azure_avatar as check_azure_avatar

pytestmark = [pytest.mark.integration]

skip_no_avatar = pytest.mark.skipif(
    not bool(os.environ.get("AZURE_SPEECH_KEY") and os.environ.get("AZURE_SPEECH_REGION")),
    reason="Avatar credentials not set (uses Speech key+region)",
)


@skip_no_avatar
@pytest.mark.timeout(15)
async def test_avatar_ice_token_retrieval():
    """Validate ICE relay token can be fetched from the regional TTS endpoint."""
    region = os.environ["AZURE_SPEECH_REGION"]
    key = os.environ["AZURE_SPEECH_KEY"]

    url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1"

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            url,
            headers={"Ocp-Apim-Subscription-Key": key},
        )

    assert response.status_code == 200, f"ICE token retrieval failed: HTTP {response.status_code}"
    # Response should be non-empty JSON with ICE server URLs
    body = response.json()
    assert body, "ICE token response body is empty"
    assert isinstance(body, dict), f"Expected dict response, got {type(body)}"
    assert "Urls" in body or "urls" in body or len(body) > 0, (
        f"Expected ICE server URLs in response: {body}"
    )


@skip_no_avatar
@pytest.mark.timeout(15)
async def test_avatar_connection_test_succeeds():
    """Validate connection tester returns success with real credentials."""
    success, message = await check_azure_avatar(
        api_key=os.environ["AZURE_SPEECH_KEY"],
        region=os.environ["AZURE_SPEECH_REGION"],
    )
    assert success is True, f"Avatar connection test failed: {message}"


@skip_no_avatar
@pytest.mark.timeout(15)
async def test_avatar_invalid_region_fails():
    """Validate connection test fails with invalid region."""
    success, _message = await check_azure_avatar(
        api_key=os.environ["AZURE_SPEECH_KEY"],
        region="invalidregion",
    )
    assert success is False, "Expected failure for invalid region"
