from collections.abc import AsyncIterator

from app.services.agents.base import BaseCoachingAdapter, CoachEvent, CoachEventType, CoachRequest


class MockCoachingAdapter(BaseCoachingAdapter):
    """Mock adapter for development and testing without AI credentials."""

    name = "mock"

    async def execute(self, request: CoachRequest) -> AsyncIterator[CoachEvent]:
        yield CoachEvent(
            type=CoachEventType.TEXT,
            content=(
                f"[Mock HCP Response] Thank you for your presentation about "
                f"the treatment. I have some concerns about the side effects "
                f"you mentioned. Could you elaborate on the long-term safety data?"
            ),
        )
        yield CoachEvent(
            type=CoachEventType.SUGGESTION,
            content="Try to address safety concerns with specific clinical trial data.",
            metadata={"dimension": "objection_handling"},
        )
        yield CoachEvent(type=CoachEventType.DONE, content="")

    async def is_available(self) -> bool:
        return True

    async def get_version(self) -> str | None:
        return "mock-1.0"
