"""Azure OpenAI adapter for streaming LLM chat completions."""

from collections.abc import AsyncIterator

from app.services.agents.base import (
    BaseCoachingAdapter,
    CoachEvent,
    CoachEventType,
    CoachRequest,
)


class AzureOpenAIAdapter(BaseCoachingAdapter):
    """Azure OpenAI adapter wrapping AsyncAzureOpenAI for streaming chat completions.

    Uses the openai SDK with Azure configuration to provide real AI-powered
    coaching conversations. Supports multi-turn dialogue via conversation_history
    and streams responses as TEXT events.
    """

    name = "azure_openai"

    def __init__(
        self,
        endpoint: str,
        api_key: str,
        deployment: str,
        api_version: str = "2024-06-01",
    ) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._deployment = deployment
        self._api_version = api_version
        self._client = None

        # Conditional import inside constructor to avoid ImportError
        # when openai is not installed (follows project convention from stt/azure.py)
        try:
            from openai import AsyncAzureOpenAI

            self._client = AsyncAzureOpenAI(
                azure_endpoint=endpoint,
                api_key=api_key,
                api_version=api_version,
            )
        except ImportError:
            pass  # is_available() will return False

    async def execute(self, request: CoachRequest) -> AsyncIterator[CoachEvent]:
        """Execute a coaching interaction via Azure OpenAI streaming chat completion."""
        if self._client is None:
            yield CoachEvent(
                type=CoachEventType.ERROR,
                content="Azure OpenAI error: openai package not installed",
            )
            yield CoachEvent(type=CoachEventType.DONE, content="")
            return

        try:
            # Build messages array
            messages: list[dict[str, str]] = []

            # System prompt from scenario context
            if request.scenario_context:
                messages.append({"role": "system", "content": request.scenario_context})

            # Include conversation history for multi-turn dialogue
            if request.conversation_history:
                messages.extend(request.conversation_history)

            # Current user message
            messages.append({"role": "user", "content": request.message})

            # Stream chat completion
            stream = await self._client.chat.completions.create(
                model=self._deployment,
                messages=messages,
                stream=True,
                temperature=0.7,
                max_completion_tokens=1024,
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield CoachEvent(
                        type=CoachEventType.TEXT,
                        content=chunk.choices[0].delta.content,
                    )

            yield CoachEvent(type=CoachEventType.DONE, content="")

        except Exception as e:
            yield CoachEvent(
                type=CoachEventType.ERROR,
                content=f"Azure OpenAI error: {e!s}",
            )
            yield CoachEvent(type=CoachEventType.DONE, content="")

    async def is_available(self) -> bool:
        """Check if Azure OpenAI endpoint, key, and deployment are configured."""
        return bool(self._endpoint and self._api_key and self._deployment and self._client)

    async def get_version(self) -> str | None:
        """Get adapter version info."""
        return f"azure-openai-{self._api_version}"
