"""Azure Speech-to-Text adapter using Cognitive Services SDK."""

import asyncio
from pathlib import Path
from tempfile import NamedTemporaryFile

from app.services.agents.stt.base import BaseSTTAdapter


class AzureSTTAdapter(BaseSTTAdapter):
    """Azure Speech-to-Text adapter wrapping the Cognitive Services SDK.

    Uses asyncio.to_thread() to avoid blocking the event loop since the
    Azure Speech SDK is synchronous by default (per RESEARCH Pitfall 2).
    """

    name = "azure"

    def __init__(self, key: str, region: str) -> None:
        self._key = key
        self._region = region

    async def transcribe(self, audio_data: bytes, language: str = "zh-CN") -> str:
        """Transcribe audio bytes to text using Azure Speech SDK.

        Uses PushAudioInputStream and recognize_once wrapped in asyncio.to_thread.
        """
        try:
            import azure.cognitiveservices.speech as speechsdk
        except ImportError:
            raise RuntimeError(
                "azure-cognitiveservices-speech not installed. "
                "Install with: pip install 'azure-cognitiveservices-speech>=1.48.0'"
            ) from None

        speech_config = speechsdk.SpeechConfig(subscription=self._key, region=self._region)
        speech_config.speech_recognition_language = language

        audio_config, cleanup_path = _audio_config_from_bytes(speechsdk, audio_data)

        recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config, audio_config=audio_config
        )

        # Use asyncio.to_thread to avoid blocking event loop
        try:
            result = await asyncio.to_thread(recognizer.recognize_once)
        finally:
            if cleanup_path is not None:
                cleanup_path.unlink(missing_ok=True)

        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            return result.text
        elif result.reason == speechsdk.ResultReason.NoMatch:
            return ""
        else:
            raise RuntimeError(f"STT error: {result.reason}")

    async def is_available(self) -> bool:
        """Check if Azure Speech key and region are configured."""
        return bool(self._key and self._region)


def _audio_config_from_bytes(speechsdk, audio_data: bytes):
    if audio_data.startswith(b"RIFF") and audio_data[8:12] == b"WAVE":
        temp_file = NamedTemporaryFile(suffix=".wav", delete=False)
        temp_file.write(audio_data)
        temp_file.close()
        path = Path(temp_file.name)
        return speechsdk.audio.AudioConfig(filename=str(path)), path

    push_stream = speechsdk.audio.PushAudioInputStream()
    push_stream.write(audio_data)
    push_stream.close()
    return speechsdk.audio.AudioConfig(stream=push_stream), None
