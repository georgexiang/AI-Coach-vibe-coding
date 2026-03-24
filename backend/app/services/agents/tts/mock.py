from app.services.agents.tts.base import BaseTTSAdapter


class MockTTSAdapter(BaseTTSAdapter):
    """Mock TTS adapter for development and testing without Azure credentials."""

    name = "mock"

    async def synthesize(
        self, text: str, language: str = "zh-CN", voice: str | None = None
    ) -> bytes:
        """Return fake audio bytes."""
        return b"[mock-audio-bytes]"

    async def is_available(self) -> bool:
        return True

    async def list_voices(self, language: str = "zh-CN") -> list[dict]:
        """Return mock voice list."""
        return [{"id": "mock-voice", "name": "Mock Voice", "language": language}]
