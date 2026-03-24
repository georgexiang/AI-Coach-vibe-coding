from app.services.agents.avatar.base import BaseAvatarAdapter


class MockAvatarAdapter(BaseAvatarAdapter):
    """Mock Avatar adapter for development and testing without Azure credentials."""

    name = "mock"

    async def create_session(self, avatar_id: str = "default") -> dict:
        """Return a mock avatar session."""
        return {"session_id": "mock-avatar-session-001", "status": "active"}

    async def send_text(self, session_id: str, text: str) -> dict:
        """Return mock animation info."""
        return {"status": "speaking", "duration_ms": 1500}

    async def close_session(self, session_id: str) -> None:
        """No-op for mock adapter."""
        pass

    async def is_available(self) -> bool:
        return True
