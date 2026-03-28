"""Integration tests for Azure OpenAI adapter with real credentials.

Tests validate:
1. Connection tester returns success
2. Adapter reports available
3. Streaming response produces TEXT + DONE events
4. First-token latency < 3 seconds (D-17 performance threshold)
5. Chinese language input/output works
6. Conversation history parameter works
"""

import os
import time

import pytest

from app.services.agents.adapters.azure_openai import AzureOpenAIAdapter
from app.services.agents.base import CoachEventType, CoachRequest
from app.services.connection_tester import test_azure_openai as check_azure_openai

from .conftest import skip_no_openai

pytestmark = [pytest.mark.integration]


def _make_adapter() -> AzureOpenAIAdapter:
    """Instantiate AzureOpenAIAdapter from environment credentials."""
    return AzureOpenAIAdapter(
        endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        deployment=os.environ["AZURE_OPENAI_DEPLOYMENT"],
    )


@skip_no_openai
@pytest.mark.timeout(30)
async def test_connection_tester_succeeds():
    """Validate connection tester returns success with real credentials."""
    success, message = await check_azure_openai(
        endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        deployment=os.environ["AZURE_OPENAI_DEPLOYMENT"],
    )
    assert success is True, f"Connection test failed: {message}"


@skip_no_openai
@pytest.mark.timeout(30)
async def test_adapter_is_available():
    """Validate adapter.is_available() returns True with real credentials."""
    adapter = _make_adapter()
    available = await adapter.is_available()
    assert available is True


@skip_no_openai
@pytest.mark.timeout(30)
async def test_streaming_response():
    """Validate adapter returns TEXT events followed by DONE."""
    adapter = _make_adapter()
    request = CoachRequest(
        session_id="test-integration-001",
        message="Say hello in one word.",
        scenario_context="You are a helpful assistant. Respond very briefly.",
    )

    events = []
    async for event in adapter.execute(request):
        events.append(event)

    # Must have at least one TEXT event and exactly one DONE event
    text_events = [e for e in events if e.type == CoachEventType.TEXT]
    done_events = [e for e in events if e.type == CoachEventType.DONE]
    error_events = [e for e in events if e.type == CoachEventType.ERROR]

    assert len(error_events) == 0, f"Unexpected errors: {[e.content for e in error_events]}"
    assert len(text_events) >= 1, "Expected at least one TEXT event"
    assert len(done_events) == 1, "Expected exactly one DONE event"
    assert done_events[0] == events[-1], "DONE event should be the last event"


@skip_no_openai
@pytest.mark.timeout(30)
async def test_first_token_latency():
    """Validate first token arrives in < 3 seconds (D-17 performance threshold)."""
    adapter = _make_adapter()
    request = CoachRequest(
        session_id="test-latency-001",
        message="Hello",
        scenario_context="Respond with a single word.",
    )

    start = time.perf_counter()
    first_token_time = None

    async for event in adapter.execute(request):
        if event.type == CoachEventType.TEXT and first_token_time is None:
            first_token_time = time.perf_counter() - start
        if event.type == CoachEventType.DONE:
            break

    assert first_token_time is not None, "No TEXT event received"
    assert first_token_time < 3.0, (
        f"First token latency {first_token_time:.2f}s exceeds 3s threshold"
    )


@skip_no_openai
@pytest.mark.timeout(30)
async def test_chinese_language_response():
    """Validate Chinese language input/output works."""
    adapter = _make_adapter()
    request = CoachRequest(
        session_id="test-chinese-001",
        message="你好医生，我想讨论一下治疗方案。",
        scenario_context="You are Dr. Wang (王医生), a cardiologist. Respond in Chinese.",
    )

    full_response = ""
    async for event in adapter.execute(request):
        if event.type == CoachEventType.TEXT:
            full_response += event.content
        if event.type == CoachEventType.ERROR:
            pytest.fail(f"Error event: {event.content}")

    assert len(full_response) > 0, "Expected non-empty Chinese response"
    # Verify response contains Chinese characters (Unicode CJK range)
    has_chinese = any("\u4e00" <= char <= "\u9fff" for char in full_response)
    assert has_chinese, f"Expected Chinese characters in response: {full_response[:200]}"


@skip_no_openai
@pytest.mark.timeout(30)
async def test_conversation_history():
    """Validate conversation_history parameter works for multi-turn dialogue."""
    adapter = _make_adapter()
    request = CoachRequest(
        session_id="test-history-001",
        message="What drug did I just ask about?",
        scenario_context="You are a helpful medical assistant. Answer briefly.",
        conversation_history=[
            {"role": "user", "content": "Tell me about aspirin."},
            {"role": "assistant", "content": "Aspirin is a common anti-inflammatory medication."},
        ],
    )

    full_response = ""
    async for event in adapter.execute(request):
        if event.type == CoachEventType.TEXT:
            full_response += event.content
        if event.type == CoachEventType.ERROR:
            pytest.fail(f"Error event: {event.content}")

    assert len(full_response) > 0, "Expected non-empty response"
    # The model should reference aspirin from conversation history
    assert "aspirin" in full_response.lower(), (
        f"Expected 'aspirin' in response referencing history: {full_response[:200]}"
    )
