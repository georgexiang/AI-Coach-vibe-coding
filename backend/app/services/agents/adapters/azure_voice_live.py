"""Azure Voice Live API config adapter with Agent/Model mode support.

Backend stores config and tests connectivity.
Frontend connects directly to Azure Voice Live via WebSocket.
Supports both Agent mode (Azure AI Agent) and Model mode (direct model deployment).
"""

import json
from collections.abc import AsyncIterator

from app.services.agents.base import (
    BaseCoachingAdapter,
    CoachEvent,
    CoachEventType,
    CoachRequest,
)


def parse_voice_live_mode(model_or_deployment: str) -> dict:
    """Parse voice live mode from structured JSON or legacy colon-encoded format.

    Preferred format (JSON):
        {"mode": "agent", "agent_id": "xxx", "project_name": "yyy"}
        {"mode": "model", "model": "gpt-realtime"}

    Legacy format (colon-encoded, backward compatible):
        "agent:abc123:my-project" -> agent mode
        "gpt-realtime" -> model mode
        "" -> model mode with default

    Returns:
        dict with 'mode' key and mode-specific fields.
    """
    # First, try JSON parse
    try:
        parsed = json.loads(model_or_deployment)
        if isinstance(parsed, dict) and "mode" in parsed:
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass

    # Fall back to legacy colon encoding
    if model_or_deployment.startswith("agent:"):
        parts = model_or_deployment.split(":", 2)
        return {
            "mode": "agent",
            "agent_id": parts[1] if len(parts) > 1 else "",
            "project_name": parts[2] if len(parts) > 2 else "",
        }

    # Default: model mode
    return {
        "mode": "model",
        "model": model_or_deployment or "gpt-4o-realtime-preview",
    }


def encode_voice_live_mode(
    mode: str,
    model: str = "",
    agent_id: str = "",
    project_name: str = "",
) -> str:
    """Encode voice live mode configuration to a storable string.

    Agent mode: returns JSON string with mode, agent_id, project_name.
    Model mode: returns plain model string (backward compatible).

    Args:
        mode: Either "agent" or "model".
        model: Model deployment name (for model mode).
        agent_id: Azure AI Agent ID (for agent mode).
        project_name: Azure AI project name (for agent mode).

    Returns:
        Encoded string suitable for storage in model_or_deployment field.
    """
    if mode == "agent":
        return json.dumps({
            "mode": "agent",
            "agent_id": agent_id,
            "project_name": project_name,
        })
    return model or "gpt-4o-realtime-preview"


class AzureVoiceLiveAdapter(BaseCoachingAdapter):
    """Azure Voice Live API config adapter.

    This is a frontend-primary service. The backend stores configuration,
    tests connectivity, and provides tokens. The frontend connects directly
    to Azure Voice Live via WebSocket.

    Supports two modes:
    - Agent mode: connects to an Azure AI Agent for conversation
    - Model mode: connects directly to a model deployment (e.g. gpt-4o-realtime)
    """

    name = "azure_voice_live"

    def __init__(
        self,
        endpoint: str,
        api_key: str,
        model_or_deployment: str = "",
        region: str = "",
    ) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._model_or_deployment = model_or_deployment
        self._region = region

    async def execute(self, request: CoachRequest) -> AsyncIterator[CoachEvent]:
        """Not used -- frontend connects directly to Azure Voice Live API."""
        yield CoachEvent(
            type=CoachEventType.ERROR,
            content="Voice Live API is frontend-direct; use token broker endpoint",
        )
        yield CoachEvent(type=CoachEventType.DONE, content="")

    async def is_available(self) -> bool:
        """Check if Voice Live endpoint and API key are configured."""
        return bool(self._endpoint and self._api_key)

    async def get_version(self) -> str | None:
        """Get adapter version info including mode."""
        mode_info = parse_voice_live_mode(self._model_or_deployment)
        return f"azure-voice-live-{mode_info.get('mode', 'unknown')}"
