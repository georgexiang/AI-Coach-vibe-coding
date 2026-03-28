"""Unit tests for Content Understanding, Realtime, and Voice Live adapters."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.agents.adapters.azure_content import AzureContentUnderstandingAdapter
from app.services.agents.adapters.azure_realtime import AzureRealtimeAdapter
from app.services.agents.adapters.azure_voice_live import (
    AzureVoiceLiveAdapter,
    encode_voice_live_mode,
    parse_voice_live_mode,
)
from app.services.agents.base import CoachEventType, CoachRequest

# --- Content Understanding Adapter Tests ---


class TestContentUnderstandingAvailability:
    """Tests for AzureContentUnderstandingAdapter.is_available."""

    async def test_content_understanding_is_available_true(self):
        adapter = AzureContentUnderstandingAdapter(
            endpoint="https://test.cognitiveservices.azure.com",
            api_key="test-key",
        )
        assert await adapter.is_available() is True

    async def test_content_understanding_is_available_false(self):
        adapter = AzureContentUnderstandingAdapter(endpoint="", api_key="")
        assert await adapter.is_available() is False


class TestContentUnderstandingExecute:
    """Tests for AzureContentUnderstandingAdapter.execute with mocked HTTP."""

    async def test_content_understanding_execute_success(self):
        """Mock httpx: POST returns 202 with Operation-Location, poll returns Succeeded."""
        adapter = AzureContentUnderstandingAdapter(
            endpoint="https://test.cognitiveservices.azure.com",
            api_key="test-key",
        )
        request = CoachRequest(session_id="s1", message="https://example.com/doc.pdf")

        mock_post_response = MagicMock()
        mock_post_response.status_code = 202
        mock_post_response.headers = {
            "Operation-Location": "https://test.cognitiveservices.azure.com/operations/op1"
        }

        mock_poll_response = MagicMock()
        mock_poll_response.json.return_value = {
            "status": "Succeeded",
            "result": {"data": "invoice-result"},
        }

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_post_response)
        mock_client.get = AsyncMock(return_value=mock_poll_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with (
            patch(
                "app.services.agents.adapters.azure_content.httpx.AsyncClient",
                return_value=mock_client,
            ),
            patch(
                "app.services.agents.adapters.azure_content.asyncio.sleep",
                new_callable=AsyncMock,
            ),
        ):
            events = []
            async for event in adapter.execute(request):
                events.append(event)

        assert len(events) == 2
        assert events[0].type == CoachEventType.TEXT
        assert "invoice-result" in events[0].content
        assert events[1].type == CoachEventType.DONE

    async def test_content_understanding_execute_poll_failure(self):
        """Mock httpx: POST returns 202, poll returns Failed status."""
        adapter = AzureContentUnderstandingAdapter(
            endpoint="https://test.cognitiveservices.azure.com",
            api_key="test-key",
        )
        request = CoachRequest(session_id="s1", message="https://example.com/doc.pdf")

        mock_post_response = MagicMock()
        mock_post_response.status_code = 202
        mock_post_response.headers = {
            "Operation-Location": "https://test.cognitiveservices.azure.com/operations/op1"
        }

        mock_poll_response = MagicMock()
        mock_poll_response.json.return_value = {
            "status": "Failed",
            "error": {"message": "bad input"},
        }

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_post_response)
        mock_client.get = AsyncMock(return_value=mock_poll_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with (
            patch(
                "app.services.agents.adapters.azure_content.httpx.AsyncClient",
                return_value=mock_client,
            ),
            patch(
                "app.services.agents.adapters.azure_content.asyncio.sleep",
                new_callable=AsyncMock,
            ),
        ):
            events = []
            async for event in adapter.execute(request):
                events.append(event)

        assert len(events) == 2
        assert events[0].type == CoachEventType.ERROR
        assert "Failed" in events[0].content
        assert "bad input" in events[0].content
        assert events[1].type == CoachEventType.DONE

    async def test_content_understanding_execute_http_error(self):
        """Mock httpx: POST raises ConnectionError."""
        adapter = AzureContentUnderstandingAdapter(
            endpoint="https://test.cognitiveservices.azure.com",
            api_key="test-key",
        )
        request = CoachRequest(session_id="s1", message="https://example.com/doc.pdf")

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=ConnectionError("Connection refused"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch(
            "app.services.agents.adapters.azure_content.httpx.AsyncClient",
            return_value=mock_client,
        ):
            events = []
            async for event in adapter.execute(request):
                events.append(event)

        assert len(events) == 2
        assert events[0].type == CoachEventType.ERROR
        assert "Connection refused" in events[0].content
        assert events[1].type == CoachEventType.DONE


# --- Realtime Adapter Tests ---


class TestRealtimeAvailability:
    """Tests for AzureRealtimeAdapter.is_available."""

    async def test_realtime_is_available_true(self):
        adapter = AzureRealtimeAdapter(
            endpoint="https://test.openai.azure.com",
            api_key="test-key",
            deployment="gpt-4o-realtime-preview",
        )
        assert await adapter.is_available() is True

    async def test_realtime_is_available_false_no_deployment(self):
        adapter = AzureRealtimeAdapter(
            endpoint="https://test.openai.azure.com",
            api_key="test-key",
            deployment="",
        )
        assert await adapter.is_available() is False


class TestRealtimeExecute:
    """Tests for AzureRealtimeAdapter.execute."""

    async def test_realtime_execute_returns_error_done(self):
        """Realtime adapter yields ERROR (frontend-direct) then DONE."""
        adapter = AzureRealtimeAdapter(
            endpoint="https://test.openai.azure.com",
            api_key="test-key",
            deployment="gpt-4o-realtime-preview",
        )
        request = CoachRequest(session_id="s1", message="test")

        events = []
        async for event in adapter.execute(request):
            events.append(event)

        assert len(events) == 2
        assert events[0].type == CoachEventType.ERROR
        assert "frontend-direct" in events[0].content
        assert events[1].type == CoachEventType.DONE


# --- Voice Live Adapter Tests ---


class TestVoiceLiveAvailability:
    """Tests for AzureVoiceLiveAdapter.is_available."""

    async def test_voice_live_is_available_true(self):
        adapter = AzureVoiceLiveAdapter(
            endpoint="https://test.openai.azure.com",
            api_key="test-key",
        )
        assert await adapter.is_available() is True

    async def test_voice_live_is_available_false(self):
        adapter = AzureVoiceLiveAdapter(endpoint="", api_key="")
        assert await adapter.is_available() is False


class TestVoiceLiveExecute:
    """Tests for AzureVoiceLiveAdapter.execute."""

    async def test_voice_live_execute_returns_error_done(self):
        """Voice Live adapter yields ERROR (frontend-direct) then DONE."""
        adapter = AzureVoiceLiveAdapter(
            endpoint="https://test.openai.azure.com",
            api_key="test-key",
        )
        request = CoachRequest(session_id="s1", message="test")

        events = []
        async for event in adapter.execute(request):
            events.append(event)

        assert len(events) == 2
        assert events[0].type == CoachEventType.ERROR
        assert "frontend-direct" in events[0].content
        assert events[1].type == CoachEventType.DONE


# --- Voice Live Mode Parsing Tests ---


class TestParseVoiceLiveMode:
    """Tests for parse_voice_live_mode function."""

    def test_parse_voice_live_mode_json_agent(self):
        """JSON agent config returns mode=agent."""
        config = json.dumps(
            {
                "mode": "agent",
                "agent_id": "abc",
                "project_name": "proj",
            }
        )
        result = parse_voice_live_mode(config)
        assert result["mode"] == "agent"
        assert result["agent_id"] == "abc"
        assert result["project_name"] == "proj"

    def test_parse_voice_live_mode_legacy_colon(self):
        """Legacy colon encoding returns agent mode (backward compat)."""
        result = parse_voice_live_mode("agent:abc:proj")
        assert result["mode"] == "agent"
        assert result["agent_id"] == "abc"
        assert result["project_name"] == "proj"

    def test_parse_voice_live_mode_model(self):
        """Plain model string returns model mode."""
        result = parse_voice_live_mode("gpt-realtime")
        assert result["mode"] == "model"
        assert result["model"] == "gpt-realtime"

    def test_parse_voice_live_mode_empty(self):
        """Empty string returns model mode with default."""
        result = parse_voice_live_mode("")
        assert result["mode"] == "model"
        assert result["model"] == "gpt-4o-realtime-preview"


class TestEncodeVoiceLiveMode:
    """Tests for encode_voice_live_mode function."""

    def test_encode_voice_live_mode_agent(self):
        """Agent mode encodes to JSON string with mode key."""
        encoded = encode_voice_live_mode(mode="agent", agent_id="abc", project_name="proj")
        parsed = json.loads(encoded)
        assert parsed["mode"] == "agent"
        assert parsed["agent_id"] == "abc"
        assert parsed["project_name"] == "proj"

    def test_encode_voice_live_mode_model(self):
        """Model mode returns plain model string."""
        encoded = encode_voice_live_mode(mode="model", model="gpt-realtime")
        assert encoded == "gpt-realtime"

    def test_encode_voice_live_mode_model_default(self):
        """Model mode with empty model returns default."""
        encoded = encode_voice_live_mode(mode="model", model="")
        assert encoded == "gpt-4o-realtime-preview"
