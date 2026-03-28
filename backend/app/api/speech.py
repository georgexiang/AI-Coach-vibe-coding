"""Speech API: STT transcription and TTS synthesis endpoints."""

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response

from app.config import get_settings
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.speech import SpeechStatusResponse, SynthesizeRequest, TranscribeResponse
from app.services.agents.registry import registry
from app.utils.exceptions import AppException

settings = get_settings()

router = APIRouter(prefix="/speech", tags=["speech"])


@router.get("/status", response_model=SpeechStatusResponse)
async def get_speech_status(
    user: User = Depends(get_current_user),
) -> SpeechStatusResponse:
    """Check STT and TTS service availability."""
    stt_adapter = registry.get("stt", settings.default_stt_provider)
    tts_adapter = registry.get("tts", settings.default_tts_provider)
    stt_available = await stt_adapter.is_available() if stt_adapter else False
    tts_available = await tts_adapter.is_available() if tts_adapter else False
    return SpeechStatusResponse(
        stt_available=stt_available,
        tts_available=tts_available,
        stt_provider=settings.default_stt_provider,
        tts_provider=settings.default_tts_provider,
    )


@router.post("/transcribe", response_model=TranscribeResponse, status_code=200)
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Query("zh-CN"),
    user: User = Depends(get_current_user),
) -> TranscribeResponse:
    """Transcribe uploaded audio to text using the configured STT adapter.

    Accepts audio file via multipart form data.
    Requires feature_voice_enabled to be true.
    """
    if not settings.feature_voice_enabled:
        raise AppException(
            status_code=409,
            code="VOICE_NOT_ENABLED",
            message="Voice features are not enabled by the administrator.",
        )

    stt_adapter = registry.get("stt", settings.default_stt_provider)
    if stt_adapter is None:
        raise AppException(
            status_code=503,
            code="STT_NOT_AVAILABLE",
            message="No STT adapter is available.",
        )

    audio_data = await audio.read()
    if not audio_data:
        raise AppException(
            status_code=422,
            code="EMPTY_AUDIO",
            message="Audio file is empty.",
        )

    text = await stt_adapter.transcribe(audio_data, language)
    return TranscribeResponse(text=text, language=language)


@router.post("/synthesize", status_code=200)
async def synthesize_speech(
    request: SynthesizeRequest,
    user: User = Depends(get_current_user),
) -> Response:
    """Synthesize text to speech audio using the configured TTS adapter.

    Returns audio bytes with audio/wav content type.
    Requires feature_voice_enabled to be true.
    """
    if not settings.feature_voice_enabled:
        raise AppException(
            status_code=409,
            code="VOICE_NOT_ENABLED",
            message="Voice features are not enabled by the administrator.",
        )

    tts_adapter = registry.get("tts", settings.default_tts_provider)
    if tts_adapter is None:
        raise AppException(
            status_code=503,
            code="TTS_NOT_AVAILABLE",
            message="No TTS adapter is available.",
        )

    if not request.text.strip():
        raise AppException(
            status_code=422,
            code="EMPTY_TEXT",
            message="Text to synthesize is empty.",
        )

    audio_bytes = await tts_adapter.synthesize(request.text, request.language, request.voice)
    return Response(
        content=audio_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": "inline; filename=speech.wav"},
    )
