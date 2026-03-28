"""Extended connection tester tests: validate_endpoint_url, service dispatch, and edge cases.

Covers all branches of backend/app/services/connection_tester.py.
"""

from unittest.mock import AsyncMock, patch

from app.services.connection_tester import (
    test_azure_avatar as _test_azure_avatar,
    test_azure_content_understanding as _test_azure_content_understanding,
    test_azure_realtime as _test_azure_realtime,
    test_service_connection as _test_service_connection,
    validate_endpoint_url,
)


class TestValidateEndpointUrl:
    """Tests for validate_endpoint_url helper."""

    async def test_empty_endpoint(self):
        valid, msg = validate_endpoint_url("")
        assert valid is False
        assert "Endpoint is required" in msg

    async def test_http_not_https(self):
        valid, msg = validate_endpoint_url("http://example.azure.com")
        assert valid is False
        assert "Endpoint must use HTTPS" in msg

    async def test_non_azure_host(self):
        valid, msg = validate_endpoint_url("https://example.com")
        assert valid is False
        assert "Azure service URL" in msg

    async def test_valid_openai_azure_com(self):
        valid, msg = validate_endpoint_url("https://myresource.openai.azure.com")
        assert valid is True
        assert msg == ""

    async def test_valid_cognitiveservices_azure_com(self):
        valid, msg = validate_endpoint_url("https://myresource.cognitiveservices.azure.com")
        assert valid is True

    async def test_valid_services_ai_azure_com(self):
        valid, msg = validate_endpoint_url("https://myresource.services.ai.azure.com")
        assert valid is True

    async def test_valid_tts_speech_microsoft_com(self):
        valid, msg = validate_endpoint_url("https://swedencentral.tts.speech.microsoft.com")
        assert valid is True


class TestAzureAvatarTester:
    """Tests for test_azure_avatar."""

    async def test_avatar_no_key(self):
        success, msg = await _test_azure_avatar(api_key="", region="eastus2")
        assert success is False
        assert "API key is required" in msg

    async def test_avatar_no_region(self):
        success, msg = await _test_azure_avatar(api_key="test-key", region="")
        assert success is False
        assert "Region is required" in msg

    @patch("app.services.connection_tester.httpx.AsyncClient")
    async def test_avatar_success(self, mock_client_cls):
        mock_resp = AsyncMock()
        mock_resp.status_code = 200
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        success, msg = await _test_azure_avatar(api_key="key", region="eastus2")
        assert success is True
        assert "reachable" in msg.lower()

    @patch("app.services.connection_tester.httpx.AsyncClient")
    async def test_avatar_http_error(self, mock_client_cls):
        mock_resp = AsyncMock()
        mock_resp.status_code = 403
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        success, msg = await _test_azure_avatar(api_key="key", region="eastus2")
        assert success is False
        assert "403" in msg

    @patch("app.services.connection_tester.httpx.AsyncClient")
    async def test_avatar_exception(self, mock_client_cls):
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=Exception("timeout"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        success, msg = await _test_azure_avatar(api_key="key", region="eastus2")
        assert success is False
        assert "connection failed" in msg.lower()


class TestAzureContentUnderstanding:
    """Tests for test_azure_content_understanding."""

    async def test_content_bad_endpoint(self):
        success, msg = await _test_azure_content_understanding(
            endpoint="http://bad.com", api_key="key"
        )
        assert success is False
        assert "HTTPS" in msg

    @patch("app.services.connection_tester.httpx.AsyncClient")
    async def test_content_success(self, mock_client_cls):
        mock_resp = AsyncMock()
        mock_resp.status_code = 200
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        success, msg = await _test_azure_content_understanding(
            endpoint="https://test.services.ai.azure.com", api_key="key"
        )
        assert success is True
        assert "connected" in msg.lower()

    @patch("app.services.connection_tester.httpx.AsyncClient")
    async def test_content_http_failure(self, mock_client_cls):
        mock_resp = AsyncMock()
        mock_resp.status_code = 401
        mock_resp.text = "Unauthorized"
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        success, msg = await _test_azure_content_understanding(
            endpoint="https://test.services.ai.azure.com", api_key="key"
        )
        assert success is False
        assert "401" in msg


class TestAzureRealtimeTester:
    """Tests for test_azure_realtime."""

    async def test_realtime_bad_endpoint(self):
        success, msg = await _test_azure_realtime(
            endpoint="http://bad.com", api_key="key", deployment="gpt-4o"
        )
        assert success is False

    @patch("app.services.connection_tester.httpx.AsyncClient")
    async def test_realtime_success(self, mock_client_cls):
        mock_resp = AsyncMock()
        mock_resp.status_code = 200
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        success, msg = await _test_azure_realtime(
            endpoint="https://test.openai.azure.com", api_key="key", deployment="gpt-4o"
        )
        assert success is True
        assert "verified" in msg.lower()

    @patch("app.services.connection_tester.httpx.AsyncClient")
    async def test_realtime_auth_failure(self, mock_client_cls):
        mock_resp = AsyncMock()
        mock_resp.status_code = 401
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        success, msg = await _test_azure_realtime(
            endpoint="https://test.openai.azure.com", api_key="bad", deployment="gpt-4o"
        )
        assert success is False
        assert "Authentication failed" in msg

    @patch("app.services.connection_tester.httpx.AsyncClient")
    async def test_realtime_deployment_not_found(self, mock_client_cls):
        mock_resp = AsyncMock()
        mock_resp.status_code = 404
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        success, msg = await _test_azure_realtime(
            endpoint="https://test.openai.azure.com", api_key="key", deployment="missing"
        )
        assert success is False
        assert "not found" in msg.lower()

    @patch("app.services.connection_tester.httpx.AsyncClient")
    async def test_realtime_other_http_status(self, mock_client_cls):
        mock_resp = AsyncMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        success, msg = await _test_azure_realtime(
            endpoint="https://test.openai.azure.com", api_key="key", deployment="gpt-4o"
        )
        assert success is False
        assert "500" in msg


class TestServiceConnectionDispatch:
    """Tests for test_service_connection dispatch routing."""

    async def test_dispatch_azure_speech_stt(self):
        with patch("app.services.connection_tester.test_azure_speech") as mock_fn:
            mock_fn.return_value = (True, "OK")
            success, msg = await _test_service_connection(
                "azure_speech_stt", "", "key123", "", "eastus2"
            )
            assert success is True
            mock_fn.assert_called_once_with(key="key123", region="eastus2")

    async def test_dispatch_azure_speech_tts(self):
        with patch("app.services.connection_tester.test_azure_speech") as mock_fn:
            mock_fn.return_value = (True, "OK")
            success, msg = await _test_service_connection(
                "azure_speech_tts", "", "key123", "", "swedencentral"
            )
            assert success is True

    async def test_dispatch_azure_avatar(self):
        with patch("app.services.connection_tester.test_azure_avatar") as mock_fn:
            mock_fn.return_value = (True, "Avatar OK")
            success, msg = await _test_service_connection(
                "azure_avatar", "", "key123", "", "eastus2"
            )
            assert success is True
            mock_fn.assert_called_once_with(api_key="key123", region="eastus2")

    async def test_dispatch_azure_content(self):
        with patch("app.services.connection_tester.test_azure_content_understanding") as mock_fn:
            mock_fn.return_value = (True, "Content OK")
            success, msg = await _test_service_connection(
                "azure_content", "https://test.services.ai.azure.com", "key123", "", ""
            )
            assert success is True

    async def test_dispatch_azure_openai_realtime(self):
        with patch("app.services.connection_tester.test_azure_realtime") as mock_fn:
            mock_fn.return_value = (True, "Realtime OK")
            success, msg = await _test_service_connection(
                "azure_openai_realtime",
                "https://test.openai.azure.com",
                "key123",
                "gpt-4o",
                "",
            )
            assert success is True
