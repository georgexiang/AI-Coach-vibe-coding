from abc import ABC, abstractmethod


class BaseTTSAdapter(ABC):
    """Abstract base for Text-to-Speech adapters."""

    name: str = ""

    @abstractmethod
    async def synthesize(
        self, text: str, language: str = "zh-CN", voice: str | None = None
    ) -> bytes:
        """Convert text to audio bytes."""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if this TTS adapter is available."""
        ...

    async def list_voices(self, language: str = "zh-CN") -> list[dict]:
        """Return available voices for a language."""
        return []
