"""Azure Speech-to-Text adapter using Cognitive Services SDK."""

import asyncio

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

        # Use push stream for audio bytes
        push_stream = speechsdk.audio.PushAudioInputStream()
        push_stream.write(audio_data)
        push_stream.close()
        audio_config = speechsdk.audio.AudioConfig(stream=push_stream)

        recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config, audio_config=audio_config
        )

        # Use asyncio.to_thread to avoid blocking event loop
        result = await asyncio.to_thread(recognizer.recognize_once)

        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            return result.text
        elif result.reason == speechsdk.ResultReason.NoMatch:
            return ""
        else:
            raise RuntimeError(f"STT error: {result.reason}")

    async def is_available(self) -> bool:
        """Check if Azure Speech key and region are configured."""
        return bool(self._key and self._region)
