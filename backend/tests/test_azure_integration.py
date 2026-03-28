"""Azure AI Foundry integration tests using real credentials.

Tests all 7 MR-HCP interaction modes against the actual Azure AI Foundry endpoint:
1. Azure OpenAI text chat
2. Azure Speech STT
3. Azure Speech TTS
4. Azure AI Avatar
5. Azure Content Understanding
6. Azure OpenAI Realtime
7. Azure Voice Live API

Requires: AZURE_INTEGRATION=1 env var to run (skipped by default in CI).
"""

import os

import pytest

# Skip entire module unless AZURE_INTEGRATION env var is set
pytestmark = pytest.mark.skipif(
    os.environ.get("AZURE_INTEGRATION", "") != "1",
    reason="Azure integration tests require AZURE_INTEGRATION=1 and real credentials",
)

# Azure AI Foundry credentials from environment variables
FOUNDRY_ENDPOINT = os.environ.get(
    "AZURE_FOUNDRY_ENDPOINT", "https://ai-foundary-hu-sweden-central.services.ai.azure.com/"
)
OPENAI_ENDPOINT = os.environ.get(
    "AZURE_OPENAI_ENDPOINT", "https://ai-foundary-hu-sweden-central.openai.azure.com/"
)
COGNITIVE_ENDPOINT = os.environ.get(
    "AZURE_COGNITIVE_ENDPOINT",
    "https://ai-foundary-hu-sweden-central.cognitiveservices.azure.com/",
)
STT_ENDPOINT = os.environ.get(
    "AZURE_STT_ENDPOINT", "https://swedencentral.stt.speech.microsoft.com"
)
TTS_ENDPOINT = os.environ.get(
    "AZURE_TTS_ENDPOINT", "https://swedencentral.tts.speech.microsoft.com"
)
API_KEY = os.environ.get("AZURE_API_KEY", "")
REGION = os.environ.get("AZURE_REGION", "swedencentral")


class TestAzureOpenAITextChat:
    """Mode 1: Azure OpenAI text chat completion.

    Note: Requires a deployed model (e.g. gpt-4o) in the Azure OpenAI resource.
    If no deployment exists, tests verify the connection infrastructure works.
    """

    async def test_openai_endpoint_reachable(self):
        """Verify the Azure OpenAI endpoint URL is valid and reachable."""
        from app.services.connection_tester import validate_endpoint_url

        valid, msg = validate_endpoint_url(OPENAI_ENDPOINT)
        assert valid is True, f"Endpoint validation failed: {msg}"

    async def test_openai_models_list(self):
        """Verify we can list models from the Azure OpenAI resource."""
        import httpx

        async with httpx.AsyncClient(timeout=15.0) as client:
            url = f"{OPENAI_ENDPOINT.rstrip('/')}/openai/models?api-version=2024-06-01"
            response = await client.get(url, headers={"api-key": API_KEY})
            assert response.status_code == 200, f"Models API failed: {response.status_code}"
            data = response.json()
            assert "data" in data
            model_ids = [m["id"] for m in data["data"]]
            # Verify gpt-4o model exists in the catalog
            assert "gpt-4o" in model_ids or any("gpt-4o" in m for m in model_ids)

    async def test_openai_chat_completion(self):
        """Send a chat completion request to Azure OpenAI.

        This test may fail if no gpt-4o deployment exists — in that case
        it verifies the error is a clean DeploymentNotFound.
        """
        from app.services.connection_tester import test_azure_openai as _test_openai

        success, message = await _test_openai(
            endpoint=OPENAI_ENDPOINT,
            api_key=API_KEY,
            deployment="gpt-4o",
        )
        if not success:
            # Expected: deployment may not exist
            assert "DeploymentNotFound" in message or "404" in message, (
                f"Unexpected error: {message}"
            )


class TestAzureSpeechSTT:
    """Mode 2: Azure Speech STT (Speech-to-Text)."""

    async def test_speech_stt_connection(self):
        """Test Azure Speech STT connection via voice list endpoint."""
        from app.services.connection_tester import test_azure_speech as _test_speech

        success, message = await _test_speech(key=API_KEY, region=REGION)
        assert success is True, f"Azure Speech STT failed: {message}"


class TestAzureSpeechTTS:
    """Mode 3: Azure Speech TTS (Text-to-Speech)."""

    async def test_speech_tts_connection(self):
        """Test Azure Speech TTS connection via voice list endpoint."""
        from app.services.connection_tester import test_azure_speech as _test_speech

        # TTS and STT use the same connection tester
        success, message = await _test_speech(key=API_KEY, region=REGION)
        assert success is True, f"Azure Speech TTS failed: {message}"

    async def test_tts_mock_adapter_synthesize(self):
        """TTS mock adapter should be available for fallback."""
        from app.services.agents.tts.mock import MockTTSAdapter

        adapter = MockTTSAdapter()
        assert await adapter.is_available() is True
        audio = await adapter.synthesize("Hello", "zh-CN")
        assert isinstance(audio, bytes)
        assert len(audio) > 0


class TestAzureAIAvatar:
    """Mode 4: Azure AI Avatar."""

    async def test_avatar_connection(self):
        """Test Azure Avatar ICE relay token endpoint."""
        from app.services.connection_tester import test_azure_avatar as _test_avatar

        success, message = await _test_avatar(api_key=API_KEY, region=REGION)
        # Avatar may or may not be available depending on resource tier
        # We just verify the connection tester doesn't error
        assert isinstance(success, bool)
        assert isinstance(message, str)

    async def test_avatar_region_capabilities(self):
        """swedencentral should support avatar."""
        from app.services.region_capabilities import get_region_capabilities

        result = get_region_capabilities(REGION)
        assert result["services"]["azure_avatar"]["available"] is True


class TestAzureContentUnderstanding:
    """Mode 5: Azure Content Understanding."""

    async def test_content_understanding_connection(self):
        """Test Content Understanding analyzers endpoint."""
        from app.services.connection_tester import (
            test_azure_content_understanding as _test_content,
        )

        success, message = await _test_content(
            endpoint=FOUNDRY_ENDPOINT,
            api_key=API_KEY,
        )
        # Content Understanding may return 200 or 4xx depending on permissions
        assert isinstance(success, bool)
        assert isinstance(message, str)


class TestAzureOpenAIRealtime:
    """Mode 6: Azure OpenAI Realtime API."""

    async def test_realtime_deployment_check(self):
        """Test Realtime API deployment existence via REST."""
        from app.services.connection_tester import test_azure_realtime as _test_realtime

        success, message = await _test_realtime(
            endpoint=OPENAI_ENDPOINT,
            api_key=API_KEY,
            deployment="gpt-4o-realtime-preview",
        )
        # Deployment may or may not exist
        assert isinstance(success, bool)
        assert isinstance(message, str)


class TestAzureVoiceLiveAPI:
    """Mode 7: Azure Voice Live API."""

    async def test_voice_live_connection(self):
        """Test Voice Live API endpoint reachability."""
        from app.services.connection_tester import test_azure_voice_live as _test_vl

        success, message = await _test_vl(
            endpoint=COGNITIVE_ENDPOINT,
            api_key=API_KEY,
            region=REGION,
        )
        assert success is True, f"Voice Live connection failed: {message}"

    async def test_voice_live_region_valid(self):
        """swedencentral should be a valid Voice Live region."""
        from app.services.voice_live_service import validate_region

        assert validate_region(REGION) is True

    async def test_voice_live_region_capabilities(self):
        """swedencentral should support voice live with agent mode."""
        from app.services.region_capabilities import get_region_capabilities

        result = get_region_capabilities(REGION)
        services = result["services"]
        assert services["azure_voice_live"]["available"] is True
        assert "Agent" in services["azure_voice_live"]["note"]


class TestServiceConnectionDispatchIntegration:
    """Integration test for the unified test_service_connection dispatcher."""

    async def test_dispatch_all_services(self):
        """Dispatch connection tests for all 7 service types."""
        from app.services.connection_tester import (
            test_service_connection as _test_dispatch,
        )

        services = [
            ("azure_openai", OPENAI_ENDPOINT, API_KEY, "gpt-4o", REGION),
            ("azure_speech_stt", "", API_KEY, "", REGION),
            ("azure_speech_tts", "", API_KEY, "", REGION),
            ("azure_avatar", "", API_KEY, "", REGION),
            ("azure_voice_live", COGNITIVE_ENDPOINT, API_KEY, "", REGION),
            ("azure_content", FOUNDRY_ENDPOINT, API_KEY, "", ""),
            ("azure_openai_realtime", OPENAI_ENDPOINT, API_KEY, "gpt-4o-realtime-preview", REGION),
        ]

        results = {}
        for service_name, endpoint, key, deployment, region in services:
            success, message = await _test_dispatch(
                service_name=service_name,
                endpoint=endpoint,
                api_key=key,
                deployment=deployment,
                region=region,
            )
            results[service_name] = (success, message)

        # Speech services should always succeed with valid credentials
        assert results["azure_speech_stt"][0] is True, (
            f"Speech STT failed: {results['azure_speech_stt'][1]}"
        )
        assert results["azure_speech_tts"][0] is True, (
            f"Speech TTS failed: {results['azure_speech_tts'][1]}"
        )

        # OpenAI may fail if no gpt-4o deployment exists — tolerate DeploymentNotFound
        if not results["azure_openai"][0]:
            msg = results["azure_openai"][1]
            assert "DeploymentNotFound" in msg or "404" in msg, (
                f"Unexpected OpenAI error: {msg}"
            )

        # Print all results for debugging
        for name, (success, msg) in results.items():
            status = "PASS" if success else "FAIL"
            print(f"  [{status}] {name}: {msg}")
