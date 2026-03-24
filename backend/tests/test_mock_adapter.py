"""Tests for the MockCoachingAdapter."""

from app.services.agents.adapters.mock import MockCoachingAdapter
from app.services.agents.base import CoachEventType, CoachRequest


async def test_mock_adapter_is_available():
    adapter = MockCoachingAdapter()
    assert await adapter.is_available() is True


async def test_mock_adapter_version():
    adapter = MockCoachingAdapter()
    version = await adapter.get_version()
    assert version == "mock-1.0"


async def test_mock_adapter_execute():
    adapter = MockCoachingAdapter()
    request = CoachRequest(
        session_id="test-session",
        message="Tell me about the safety profile of this drug.",
    )

    events = []
    async for event in adapter.execute(request):
        events.append(event)

    # Should have TEXT, SUGGESTION, and DONE events
    assert len(events) == 3
    assert events[0].type == CoachEventType.TEXT
    assert events[1].type == CoachEventType.SUGGESTION
    assert events[2].type == CoachEventType.DONE
    assert "Mock HCP Response" in events[0].content
