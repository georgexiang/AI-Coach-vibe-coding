"""Speech API request/response schemas for STT and TTS."""

from pydantic import BaseModel


class TranscribeResponse(BaseModel):
    """Response from STT transcription."""

    text: str
    language: str


class SynthesizeRequest(BaseModel):
    """Request for TTS synthesis."""

    text: str
    language: str = "zh-CN"
    voice: str | None = None


class SpeechStatusResponse(BaseModel):
    """STT/TTS service availability status."""

    stt_available: bool
    tts_available: bool
    stt_provider: str
    tts_provider: str
