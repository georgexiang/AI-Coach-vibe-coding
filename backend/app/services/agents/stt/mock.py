from app.services.agents.stt.base import BaseSTTAdapter


class MockSTTAdapter(BaseSTTAdapter):
    """Mock STT adapter for development and testing without Azure credentials."""

    name = "mock"

    async def transcribe(self, audio_data: bytes, language: str = "zh-CN") -> str:
        """Return deterministic mock transcription."""
        return f"[Mock STT] Transcribed audio in {language}"

    async def is_available(self) -> bool:
        return True
