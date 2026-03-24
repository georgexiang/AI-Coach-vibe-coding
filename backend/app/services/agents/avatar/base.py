from abc import ABC, abstractmethod


class BaseAvatarAdapter(ABC):
    """Abstract base for AI Avatar adapters."""

    name: str = ""

    @abstractmethod
    async def create_session(self, avatar_id: str = "default") -> dict:
        """Create an avatar rendering session. Returns session info dict."""
        ...

    @abstractmethod
    async def send_text(self, session_id: str, text: str) -> dict:
        """Send text for avatar to speak. Returns animation/video info."""
        ...

    @abstractmethod
    async def close_session(self, session_id: str) -> None:
        """Close an avatar session."""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if this avatar adapter is available."""
        ...
