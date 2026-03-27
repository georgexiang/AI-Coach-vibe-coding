"""Azure AI Avatar adapter -- premium configurable option (COACH-07).

Real implementation will wrap Azure AI Avatar service for digital human rendering.
Activated when feature_avatar_enabled is True and Azure Avatar credentials are configured.
"""

from app.services.agents.avatar.base import BaseAvatarAdapter


class AzureAvatarAdapter(BaseAvatarAdapter):
    """Azure AI Avatar adapter for digital human rendering.

    Wraps the Azure AI Avatar service. Requires endpoint, key, and region.
    The avatar toggle in the conference UI uses feature_avatar_enabled.
    """

    name = "azure"

    def __init__(self, endpoint: str = "", key: str = "", region: str = "") -> None:
        self._endpoint = endpoint
        self._key = key
        self._region = region

    async def create_session(self, avatar_id: str = "default") -> dict:
        """Create avatar session -- not yet implemented."""
        return {"session_id": "not-implemented", "status": "unavailable"}

    async def send_text(self, session_id: str, text: str) -> dict:
        """Send text to avatar -- not yet implemented."""
        return {"status": "unavailable", "duration_ms": 0}

    async def close_session(self, session_id: str) -> None:
        """Close avatar session -- not yet implemented."""
        pass

    async def is_available(self) -> bool:
        """Avatar is available when endpoint and key are configured."""
        return bool(self._endpoint and self._key)
