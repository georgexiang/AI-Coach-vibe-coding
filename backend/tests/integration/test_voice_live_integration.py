"""Integration tests for Azure Voice Live API with real credentials.

Tests validate:
1. Connection tester returns success with real endpoint
2. Configured region is in SUPPORTED_REGIONS
3. HTTP probe to voice live endpoint returns acceptable status
4. Unsupported region returns failure
"""

import os

import httpx
import pytest

from app.services.connection_tester import test_azure_voice_live as check_voice_live
from app.services.voice_live_service import SUPPORTED_REGIONS, validate_region

from .conftest import skip_no_voice_live

pytestmark = [pytest.mark.integration]


@skip_no_voice_live
@pytest.mark.timeout(15)
async def test_connection_tester_succeeds():
    """Validate connection tester returns success with real endpoint."""
    success, message = await check_voice_live(
        endpoint=os.environ["AZURE_VOICE_LIVE_ENDPOINT"],
        api_key=os.environ["AZURE_VOICE_LIVE_API_KEY"],
        region=os.environ["AZURE_VOICE_LIVE_REGION"],
    )
    assert success is True, f"Voice Live connection test failed: {message}"


@skip_no_voice_live
@pytest.mark.timeout(15)
async def test_region_validation():
    """Validate configured region is in SUPPORTED_REGIONS."""
    region = os.environ["AZURE_VOICE_LIVE_REGION"]
    assert validate_region(region) is True, (
        f"Region '{region}' not in SUPPORTED_REGIONS: {', '.join(sorted(SUPPORTED_REGIONS))}"
    )


@skip_no_voice_live
@pytest.mark.timeout(15)
async def test_endpoint_reachable():
    """Validate HTTP probe to voice live endpoint returns acceptable status.

    Any of 200, 404, 405, 426 means the endpoint is reachable.
    """
    endpoint = os.environ["AZURE_VOICE_LIVE_ENDPOINT"]
    api_key = os.environ["AZURE_VOICE_LIVE_API_KEY"]

    async with httpx.AsyncClient(timeout=10.0) as client:
        url = f"{endpoint.rstrip('/')}/openai/realtime"
        response = await client.get(
            url,
            headers={"api-key": api_key},
            params={"api-version": "2025-04-01-preview"},
        )

    acceptable_statuses = (200, 404, 405, 426)
    assert response.status_code in acceptable_statuses or (200 <= response.status_code < 500), (
        f"Unexpected status {response.status_code} from Voice Live endpoint. "
        f"Expected one of {acceptable_statuses} or a non-5xx status."
    )


@skip_no_voice_live
@pytest.mark.timeout(15)
async def test_invalid_region_rejected():
    """Validate unsupported region returns failure."""
    success, message = await check_voice_live(
        endpoint=os.environ["AZURE_VOICE_LIVE_ENDPOINT"],
        api_key=os.environ["AZURE_VOICE_LIVE_API_KEY"],
        region="invalidregion123",
    )
    assert success is False, "Expected failure for invalid region"
    assert "Unsupported region" in message, (
        f"Expected 'Unsupported region' in message, got: {message}"
    )
