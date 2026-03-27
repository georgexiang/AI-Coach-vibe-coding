"""Azure OpenAI Realtime API config adapter.

Backend stores config and tests connectivity.
Frontend connects directly to Azure via WebSocket.
"""

from collections.abc import AsyncIterator

from app.services.agents.base import (
    BaseCoachingAdapter,
    CoachEvent,
    CoachEventType,
    CoachRequest,
)


class AzureRealtimeAdapter(BaseCoachingAdapter):
    """Azure OpenAI Realtime API config adapter.

    This is a frontend-primary service. The backend stores configuration,
    tests connectivity, and provides tokens. The frontend connects directly
    to Azure via WebSocket for sub-1s conversational latency.
    """

    name = "azure_openai_realtime"

    def __init__(
        self,
        endpoint: str,
        api_key: str,
        deployment: str = "gpt-4o-realtime-preview",
    ) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._deployment = deployment

    async def execute(self, request: CoachRequest) -> AsyncIterator[CoachEvent]:
        """Not used -- frontend connects directly to Azure Realtime API."""
        yield CoachEvent(
            type=CoachEventType.ERROR,
            content="Realtime API is frontend-direct; use token broker endpoint",
        )
        yield CoachEvent(type=CoachEventType.DONE, content="")

    async def is_available(self) -> bool:
        """Check if Realtime endpoint, key, and deployment are configured."""
        return bool(self._endpoint and self._api_key and self._deployment)

    async def get_version(self) -> str | None:
        """Get adapter version info."""
        return f"azure-realtime-{self._deployment}"
