from abc import ABC, abstractmethod


class BaseSTTAdapter(ABC):
    """Abstract base for Speech-to-Text adapters."""

    name: str = ""

    @abstractmethod
    async def transcribe(self, audio_data: bytes, language: str = "zh-CN") -> str:
        """Transcribe audio bytes to text."""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if this STT adapter is available."""
        ...

    async def get_supported_languages(self) -> list[str]:
        """Return list of supported language codes."""
        return ["zh-CN", "en-US"]
