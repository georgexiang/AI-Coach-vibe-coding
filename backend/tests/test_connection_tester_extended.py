"""Tests for connection tester: URL validation, individual service testers, and dispatch."""

from unittest.mock import AsyncMock, MagicMock, patch

from app.services.connection_tester import (
    test_azure_avatar as _test_azure_avatar,
)
from app.services.connection_tester import (
    test_azure_content_understanding as _test_azure_content_understanding,
)
from app.services.connection_tester import (
    test_azure_realtime as _test_azure_realtime,
)
from app.services.connection_tester import (
    test_service_connection as _test_service_connection,
)
from app.services.connection_tester import (
    validate_endpoint_url,
)

# --- URL Validation Tests ---


class TestValidateEndpointUrl:
    """Tests for validate_endpoint_url function."""

    def test_validate_endpoint_url_valid_azure(self):
        """Valid Azure OpenAI URL accepted."""
        ok, msg = validate_endpoint_url("https://myresource.openai.azure.com")
        assert ok is True
        assert msg == ""

    def test_validate_endpoint_url_valid_cognitive(self):
        """Valid Cognitive Services URL accepted."""
        ok, msg = validate_endpoint_url("https://myresource.cognitiveservices.azure.com")
        assert ok is True
        assert msg == ""

    def test_validate_endpoint_url_valid_with_path(self):
        """Valid Azure URL with path accepted."""
        ok, msg = validate_endpoint_url("https://myresource.openai.azure.com/openai/v1")
        assert ok is True
        assert msg == ""

    def test_validate_endpoint_url_reject_http(self):
        """HTTP (non-HTTPS) URL rejected."""
        ok, msg = validate_endpoint_url("http://evil.com")
        assert ok is False
        assert "HTTPS" in msg

    def test_validate_endpoint_url_reject_non_azure(self):
        """Non-Azure HTTPS URL rejected."""
        ok, msg = validate_endpoint_url("https://evil.com")
        assert ok is False
        assert "Azure service URL" in msg

    def test_validate_endpoint_url_empty(self):
        """Empty string rejected."""
        ok, msg = validate_endpoint_url("")
        assert ok is False
        assert msg == "Endpoint is required"


# --- Individual Service Tester Tests ---


class TestAzureAvatarReal:
    """Tests for test_azure_avatar with real ICE token endpoint."""

    async def test_azure_avatar_real_success(self):
        """Mock 200 for ICE token URL."""
        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connection_tester.httpx.AsyncClient", return_value=mock_client):
            ok, msg = await _test_azure_avatar(api_key="test-key", region="eastus2")

        assert ok is True
        assert "Avatar service reachable" in msg
        assert "ICE token" in msg

        # Verify the correct URL was called
        call_args = mock_client.get.call_args
        assert "eastus2.tts.speech.microsoft.com" in call_args[0][0]
        assert "avatar/relay/token/v1" in call_args[0][0]

    async def test_azure_avatar_real_failure_401(self):
        """Mock 401 for ICE token URL."""
        mock_response = MagicMock()
        mock_response.status_code = 401

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connection_tester.httpx.AsyncClient", return_value=mock_client):
            ok, msg = await _test_azure_avatar(api_key="bad-key", region="eastus2")

        assert ok is False
        assert "HTTP 401" in msg

    async def test_azure_avatar_missing_key(self):
        """Empty API key returns failure."""
        ok, msg = await _test_azure_avatar(api_key="", region="eastus2")
        assert ok is False
        assert "API key is required" in msg

    async def test_azure_avatar_missing_region(self):
        """Empty region returns failure."""
        ok, msg = await _test_azure_avatar(api_key="key", region="")
        assert ok is False
        assert "Region is required" in msg


class TestAzureContentUnderstanding:
    """Tests for test_azure_content_understanding."""

    async def test_azure_content_understanding_success(self):
        """Mock 200 for analyzers URL."""
        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connection_tester.httpx.AsyncClient", return_value=mock_client):
            ok, msg = await _test_azure_content_understanding(
                endpoint="https://test.cognitiveservices.azure.com",
                api_key="test-key",
            )

        assert ok is True
        assert "Content Understanding service connected" in msg
        assert "Analyzers accessible" in msg

    async def test_azure_content_understanding_failure_403(self):
        """Mock 403 for analyzers URL."""
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.text = "Forbidden"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connection_tester.httpx.AsyncClient", return_value=mock_client):
            ok, msg = await _test_azure_content_understanding(
                endpoint="https://test.cognitiveservices.azure.com",
                api_key="bad-key",
            )

        assert ok is False
        assert "HTTP 403" in msg

    async def test_azure_content_understanding_bad_endpoint(self):
        """Non-Azure endpoint rejected by URL validation."""
        ok, msg = await _test_azure_content_understanding(
            endpoint="https://evil.com",
            api_key="key",
        )
        assert ok is False
        assert "Azure service URL" in msg


class TestAzureRealtime:
    """Tests for test_azure_realtime."""

    async def test_azure_realtime_success(self):
        """Mock 200 for deployment verification."""
        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connection_tester.httpx.AsyncClient", return_value=mock_client):
            ok, msg = await _test_azure_realtime(
                endpoint="https://test.openai.azure.com",
                api_key="test-key",
                deployment="gpt-4o-realtime-preview",
            )

        assert ok is True
        assert "Realtime API deployment verified" in msg

    async def test_azure_realtime_not_found(self):
        """Mock 404 for missing deployment."""
        mock_response = MagicMock()
        mock_response.status_code = 404

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.connection_tester.httpx.AsyncClient", return_value=mock_client):
            ok, msg = await _test_azure_realtime(
                endpoint="https://test.openai.azure.com",
                api_key="test-key",
                deployment="gpt-4o-realtime-preview",
            )

        assert ok is False
        assert "Deployment 'gpt-4o-realtime-preview' not found" in msg


# --- Dispatch Tests ---


class TestDispatch:
    """Tests for test_service_connection dispatch routing."""

    async def test_dispatch_azure_openai_realtime(self):
        """azure_openai_realtime dispatches to test_azure_realtime."""
        with patch(
            "app.services.connection_tester.test_azure_realtime",
            new_callable=AsyncMock,
            return_value=(True, "OK"),
        ) as mock_fn:
            ok, msg = await _test_service_connection(
                "azure_openai_realtime",
                "https://test.openai.azure.com",
                "key",
                "gpt-4o-realtime-preview",
                "eastus2",
            )
            mock_fn.assert_called_once_with(
                "https://test.openai.azure.com",
                "key",
                "gpt-4o-realtime-preview",
            )
            assert ok is True

    async def test_dispatch_azure_content(self):
        """azure_content dispatches to test_azure_content_understanding."""
        with patch(
            "app.services.connection_tester.test_azure_content_understanding",
            new_callable=AsyncMock,
            return_value=(True, "OK"),
        ) as mock_fn:
            ok, msg = await _test_service_connection(
                "azure_content",
                "https://test.cognitiveservices.azure.com",
                "key",
                "",
                "",
            )
            mock_fn.assert_called_once_with(
                "https://test.cognitiveservices.azure.com",
                "key",
            )
            assert ok is True

    async def test_dispatch_ai_foundry(self):
        """ai_foundry dispatches to test_ai_foundry_endpoint (list deployments)."""
        with patch(
            "app.services.connection_tester.test_ai_foundry_endpoint",
            new_callable=AsyncMock,
            return_value=(True, "Connection successful (3 deployment(s) found)"),
        ) as mock_fn:
            ok, msg = await _test_service_connection(
                "ai_foundry",
                "https://test.openai.azure.com",
                "key",
                "gpt-4o",
                "eastus2",
            )
            mock_fn.assert_called_once()
            assert ok is True
            assert "Connection successful" in msg

    async def test_dispatch_azure_openai(self):
        """azure_openai dispatches to test_azure_openai."""
        with patch(
            "app.services.connection_tester.test_azure_openai",
            new_callable=AsyncMock,
            return_value=(True, "Connection successful"),
        ) as mock_fn:
            ok, msg = await _test_service_connection(
                "azure_openai",
                "https://test.openai.azure.com",
                "key",
                "gpt-4o",
                "eastus2",
            )
            mock_fn.assert_called_once()
            assert ok is True

    async def test_dispatch_azure_speech_stt(self):
        """azure_speech_stt dispatches to test_azure_speech."""
        with patch(
            "app.services.connection_tester.test_azure_speech",
            new_callable=AsyncMock,
            return_value=(True, "Connection successful"),
        ) as mock_fn:
            ok, msg = await _test_service_connection("azure_speech_stt", "", "key", "", "eastus2")
            mock_fn.assert_called_once()
            assert ok is True

    async def test_dispatch_azure_speech_tts(self):
        """azure_speech_tts dispatches to test_azure_speech."""
        with patch(
            "app.services.connection_tester.test_azure_speech",
            new_callable=AsyncMock,
            return_value=(True, "Connection successful"),
        ) as mock_fn:
            ok, msg = await _test_service_connection("azure_speech_tts", "", "key", "", "westus2")
            mock_fn.assert_called_once()
            assert ok is True

    async def test_dispatch_azure_avatar(self):
        """azure_avatar dispatches to test_azure_avatar."""
        with patch(
            "app.services.connection_tester.test_azure_avatar",
            new_callable=AsyncMock,
            return_value=(True, "Avatar OK"),
        ) as mock_fn:
            ok, msg = await _test_service_connection("azure_avatar", "", "key", "", "eastus2")
            mock_fn.assert_called_once()
            assert ok is True

    async def test_dispatch_azure_voice_live(self):
        """azure_voice_live dispatches to test_azure_voice_live."""
        with patch(
            "app.services.connection_tester.test_azure_voice_live",
            new_callable=AsyncMock,
            return_value=(True, "OK"),
        ) as mock_fn:
            ok, msg = await _test_service_connection(
                "azure_voice_live",
                "https://test.openai.azure.com",
                "key",
                "",
                "eastus2",
            )
            mock_fn.assert_called_once()
            assert ok is True

    async def test_dispatch_master_fallback(self):
        """When per-service key is empty, master key is used as fallback."""
        with patch(
            "app.services.connection_tester.test_azure_openai",
            new_callable=AsyncMock,
            return_value=(True, "OK"),
        ) as mock_fn:
            ok, _ = await _test_service_connection(
                "azure_openai",
                "",
                "",  # empty per-service key
                "gpt-4o",
                "",
                master_endpoint="https://master.openai.azure.com",
                master_key="master-key-123",
                master_region="eastus2",
            )
            # Verify master key was passed through
            call_args = mock_fn.call_args
            assert call_args[0][1] == "master-key-123"  # effective_key
            assert ok is True

    async def test_dispatch_unknown_service(self):
        """Unknown service returns failure."""
        ok, msg = await _test_service_connection("unknown", "", "", "", "")
        assert ok is False
        assert "Unknown service: unknown" in msg
