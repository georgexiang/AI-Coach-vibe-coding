"""Azure Content Understanding adapter for document/multimodal analysis."""

import asyncio
import json
from collections.abc import AsyncIterator

import httpx

from app.services.agents.base import (
    BaseCoachingAdapter,
    CoachEvent,
    CoachEventType,
    CoachRequest,
)

MAX_POLL_ATTEMPTS = 30
POLL_INTERVAL_SECONDS = 2.0


class AzureContentUnderstandingAdapter(BaseCoachingAdapter):
    """Azure Content Understanding adapter for document/multimodal analysis.

    Calls the Content Understanding REST API to analyze documents (invoices, etc.)
    via a submit-then-poll pattern. Bounded polling: max 30 attempts at 2s intervals
    (60s total) to prevent runaway waits.
    """

    name = "azure_content"

    def __init__(self, endpoint: str, api_key: str) -> None:
        self._endpoint = endpoint.rstrip("/")
        self._api_key = api_key

    async def execute(self, request: CoachRequest) -> AsyncIterator[CoachEvent]:
        """Analyze content using Azure Content Understanding REST API."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Submit analysis request
                url = (
                    f"{self._endpoint}/contentunderstanding/analyzers"
                    "/prebuilt-invoice:analyze?api-version=2025-11-01"
                )
                headers = {
                    "Ocp-Apim-Subscription-Key": self._api_key,
                    "Content-Type": "application/json",
                }
                body = {"url": request.message}

                response = await client.post(url, headers=headers, json=body)

                if response.status_code != 202:
                    yield CoachEvent(
                        type=CoachEventType.ERROR,
                        content=f"HTTP {response.status_code}: {response.text[:200]}",
                    )
                    yield CoachEvent(type=CoachEventType.DONE, content="")
                    return

                # Extract Operation-Location for polling
                operation_url = response.headers.get("Operation-Location", "")
                if not operation_url:
                    yield CoachEvent(
                        type=CoachEventType.ERROR,
                        content="No Operation-Location header in 202 response",
                    )
                    yield CoachEvent(type=CoachEventType.DONE, content="")
                    return

                # Poll with bounded retry
                poll_headers = {"Ocp-Apim-Subscription-Key": self._api_key}
                poll_data: dict = {}

                for _attempt in range(MAX_POLL_ATTEMPTS):
                    await asyncio.sleep(POLL_INTERVAL_SECONDS)
                    poll_response = await client.get(
                        operation_url,
                        headers=poll_headers,
                    )
                    poll_data = poll_response.json()

                    if poll_data.get("status") == "Succeeded":
                        break
                    if poll_data.get("status") in ("Failed", "Cancelled"):
                        error_msg = (
                            poll_data.get("error", {}).get("message", "Unknown error")
                        )
                        yield CoachEvent(
                            type=CoachEventType.ERROR,
                            content=f"Analysis {poll_data['status']}: {error_msg}",
                        )
                        yield CoachEvent(type=CoachEventType.DONE, content="")
                        return
                else:
                    yield CoachEvent(
                        type=CoachEventType.ERROR,
                        content="Analysis timed out after 60 seconds",
                    )
                    yield CoachEvent(type=CoachEventType.DONE, content="")
                    return

                # Success -- yield result
                result_json = json.dumps(poll_data.get("result", {}))
                yield CoachEvent(type=CoachEventType.TEXT, content=result_json)
                yield CoachEvent(type=CoachEventType.DONE, content="")

        except Exception as e:
            yield CoachEvent(
                type=CoachEventType.ERROR,
                content=f"Content Understanding error: {e!s}",
            )
            yield CoachEvent(type=CoachEventType.DONE, content="")

    async def is_available(self) -> bool:
        """Check if Content Understanding endpoint and API key are configured."""
        return bool(self._endpoint and self._api_key)
