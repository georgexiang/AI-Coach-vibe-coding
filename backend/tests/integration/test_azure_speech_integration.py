"""Integration tests for Azure Speech STT and TTS adapters with real credentials.

Tests validate:
1. Connection tester returns success
2. TTS produces audio bytes > 1000 bytes
3. Chinese voice synthesis works
4. STT transcribes audio correctly (requires SDK)
5. TTS->STT round-trip produces matching text (requires SDK)
"""

import os

import pytest

from app.services.connection_tester import test_azure_speech as check_azure_speech

from .conftest import skip_no_speech, skip_no_speech_sdk

pytestmark = [pytest.mark.integration]


def _make_tts_adapter():
    """Instantiate AzureTTSAdapter from environment credentials."""
    from app.services.agents.tts.azure import AzureTTSAdapter

    return AzureTTSAdapter(
        key=os.environ["AZURE_SPEECH_KEY"],
        region=os.environ["AZURE_SPEECH_REGION"],
    )


def _make_stt_adapter():
    """Instantiate AzureSTTAdapter from environment credentials."""
    from app.services.agents.stt.azure import AzureSTTAdapter

    return AzureSTTAdapter(
        key=os.environ["AZURE_SPEECH_KEY"],
        region=os.environ["AZURE_SPEECH_REGION"],
    )


@skip_no_speech
@pytest.mark.timeout(30)
async def test_connection_tester_succeeds():
    """Validate connection tester returns success with real credentials."""
    success, message = await check_azure_speech(
        key=os.environ["AZURE_SPEECH_KEY"],
        region=os.environ["AZURE_SPEECH_REGION"],
    )
    assert success is True, f"Connection test failed: {message}"


@skip_no_speech
@skip_no_speech_sdk
@pytest.mark.timeout(30)
async def test_tts_synthesize():
    """Validate TTS produces audio bytes > 1000 bytes."""
    adapter = _make_tts_adapter()
    audio_data = await adapter.synthesize(
        text="Hello, this is a test of the speech synthesis service.",
        language="en-US",
        voice="en-US-JennyNeural",
    )

    assert isinstance(audio_data, bytes)
    assert len(audio_data) > 1000, f"Expected audio data > 1000 bytes, got {len(audio_data)} bytes"


@skip_no_speech
@skip_no_speech_sdk
@pytest.mark.timeout(30)
async def test_tts_chinese_voice():
    """Validate Chinese voice synthesis works."""
    adapter = _make_tts_adapter()
    audio_data = await adapter.synthesize(
        text="你好，这是一个语音合成测试。",
        language="zh-CN",
        voice="zh-CN-XiaoxiaoNeural",
    )

    assert isinstance(audio_data, bytes)
    assert len(audio_data) > 1000, (
        f"Expected Chinese audio data > 1000 bytes, got {len(audio_data)} bytes"
    )


@skip_no_speech
@skip_no_speech_sdk
@pytest.mark.timeout(30)
async def test_stt_transcribe():
    """Validate STT transcribes audio correctly.

    Uses TTS to generate known audio, then transcribes it back.
    """
    tts_adapter = _make_tts_adapter()
    stt_adapter = _make_stt_adapter()

    # Generate audio from known text
    known_text = "Hello world"
    audio_data = await tts_adapter.synthesize(
        text=known_text,
        language="en-US",
        voice="en-US-JennyNeural",
    )

    assert len(audio_data) > 0, "TTS produced empty audio"

    # Transcribe the audio
    transcription = await stt_adapter.transcribe(
        audio_data=audio_data,
        language="en-US",
    )

    assert len(transcription) > 0, "STT returned empty transcription"
    # Check for key words (exact match is unreliable across TTS/STT)
    transcription_lower = transcription.lower()
    assert "hello" in transcription_lower or "world" in transcription_lower, (
        f"Expected 'hello' or 'world' in transcription: {transcription}"
    )


@skip_no_speech
@skip_no_speech_sdk
@pytest.mark.timeout(30)
async def test_tts_then_stt_round_trip():
    """Validate TTS output fed to STT returns similar text.

    Round-trip test: synthesize English text, then transcribe and check for key words.
    """
    tts_adapter = _make_tts_adapter()
    stt_adapter = _make_stt_adapter()

    original_text = "Hello, I would like to discuss treatment options."
    audio_data = await tts_adapter.synthesize(
        text=original_text,
        language="en-US",
        voice="en-US-JennyNeural",
    )

    assert len(audio_data) > 1000, "TTS produced insufficient audio data"

    transcription = await stt_adapter.transcribe(
        audio_data=audio_data,
        language="en-US",
    )

    assert len(transcription) > 0, "STT returned empty transcription for round-trip"
    transcription_lower = transcription.lower()
    # Check for key words from the original text
    assert "treatment" in transcription_lower or "discuss" in transcription_lower, (
        f"Expected 'treatment' or 'discuss' in round-trip transcription: {transcription}"
    )
