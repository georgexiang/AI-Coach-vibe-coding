"""Azure AI Avatar adapter stub -- premium configurable option (COACH-07).

Real implementation will wrap Azure AI Avatar service for digital human rendering.
Currently a stub that returns is_available() = False, activated only when
feature_avatar_enabled is True and Azure Avatar credentials are configured.
"""

from app.services.agents.avatar.base import BaseAvatarAdapter


class AzureAvatarAdapter(BaseAvatarAdapter):
    """Stub Azure AI Avatar adapter -- real implementation deferred.

    TODO: Implement with Azure AI Avatar service when credentials available.
    The avatar toggle in the conference UI will use feature_avatar_enabled.
    """

    name = "azure"

    def __init__(self, endpoint: str = "", key: str = "") -> None:
        self._endpoint = endpoint
        self._key = key

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
        """Azure Avatar adapter is not yet available."""
        return False
