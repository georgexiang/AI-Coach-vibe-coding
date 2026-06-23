"""Azure Speech Pronunciation Assessment voice scoring service."""

import asyncio
import json
import tempfile
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

SPEECH_STT_SERVICE_NAME = "azure_speech_stt"


@dataclass(frozen=True)
class PronunciationAssessmentResult:
    """Normalized pronunciation assessment result."""

    dimensions: list[dict[str, Any]]
    feedback_summary: str
    raw_result: dict[str, Any]


def map_pronunciation_result(raw_result: dict[str, Any], language: str = "zh-CN") -> dict[str, Any]:
    """Map Azure Speech SDK JSON output into existing voice scoring dimensions."""
    nbest = raw_result.get("NBest") or []
    top = nbest[0] if nbest else {}
    assessment = top.get("PronunciationAssessment") or {}

    accuracy = _score_or_default(assessment.get("AccuracyScore"), assessment.get("PronScore"))
    fluency = _score_or_default(assessment.get("FluencyScore"), accuracy)
    prosody = assessment.get("ProsodyScore")
    tone = _score_or_default(prosody, round((accuracy + fluency) / 2, 1))
    pace_score, speaking_rate = _pace_score(raw_result, top, language)

    feedback_bits = [
        f"accuracy={accuracy}",
        f"fluency={fluency}",
        f"pace={pace_score}",
        f"tone={tone}",
    ]
    if speaking_rate is not None:
        feedback_bits.append(f"speaking_rate={round(speaking_rate, 1)} units/min")
    if prosody is None:
        feedback_bits.append("prosody_unavailable")

    return {
        "dimensions": [
            {
                "name": "pronunciation",
                "score": accuracy,
                "weight": 25,
                "feedback": "Pronunciation accuracy from Azure Speech Pronunciation Assessment.",
            },
            {
                "name": "fluency",
                "score": fluency,
                "weight": 25,
                "feedback": "Fluency score from Azure Speech Pronunciation Assessment.",
            },
            {
                "name": "pace",
                "score": pace_score,
                "weight": 25,
                "feedback": (
                    "Speaking-rate based pace score."
                    if speaking_rate is not None
                    else "Pace score could not be derived from speech duration."
                ),
            },
            {
                "name": "tone",
                "score": tone,
                "weight": 25,
                "feedback": (
                    "Prosody score from Azure Speech Pronunciation Assessment."
                    if prosody is not None
                    else (
                        "Prosody score unavailable for this recognition result; "
                        "estimated from accuracy and fluency."
                    )
                ),
            },
        ],
        "feedback_summary": "Azure Speech Pronunciation Assessment: " + ", ".join(feedback_bits),
        "raw_result": raw_result,
    }


async def assess_pronunciation(
    *,
    speech_key: str = "",
    speech_region: str = "",
    speech_endpoint: str = "",
    audio_data: bytes,
    language: str = "zh-CN",
    reference_text: str = "",
) -> PronunciationAssessmentResult:
    """Run Azure Speech Pronunciation Assessment and return normalized voice scores."""
    if not audio_data:
        raise RuntimeError("Audio data is required for pronunciation assessment")

    speech_endpoint = normalize_speech_endpoint(speech_endpoint)
    raw_result = None
    entra_error: Exception | None = None
    if speech_endpoint:
        try:
            raw_result = await asyncio.to_thread(
                _assess_pronunciation_sync,
                "",
                "",
                speech_endpoint,
                audio_data,
                language,
                reference_text,
            )
        except Exception as exc:
            entra_error = exc

    if raw_result is None:
        if not speech_key:
            if entra_error is not None:
                raise RuntimeError(
                    "Azure Speech Entra ID pronunciation assessment failed and "
                    f"no API key fallback is configured: {entra_error}"
                ) from entra_error
            raise RuntimeError(
                "Azure Speech endpoint or API key is required for pronunciation assessment"
            )
        if not speech_region:
            raise RuntimeError(
                "Azure Speech region is required for API key pronunciation assessment"
            )
        raw_result = await asyncio.to_thread(
            _assess_pronunciation_sync,
            speech_key,
            speech_region,
            "",
            audio_data,
            language,
            reference_text,
        )

    mapped = map_pronunciation_result(raw_result, language=language)
    return PronunciationAssessmentResult(
        dimensions=mapped["dimensions"],
        feedback_summary=mapped["feedback_summary"],
        raw_result=mapped["raw_result"],
    )


def normalize_speech_endpoint(endpoint: str) -> str:
    """Return a Speech SDK compatible custom endpoint from Foundry service endpoints."""
    endpoint = endpoint.strip()
    if not endpoint:
        return ""

    parsed = urlparse(endpoint)
    if not parsed.scheme or not parsed.netloc:
        return endpoint.rstrip("/") + "/"

    host = parsed.netloc
    lower_host = host.lower()
    if lower_host.endswith(".services.ai.azure.com"):
        host = host[: -len(".services.ai.azure.com")] + ".cognitiveservices.azure.com"
    return f"{parsed.scheme}://{host}/"


def _assess_pronunciation_sync(
    speech_key: str,
    speech_region: str,
    speech_endpoint: str,
    audio_data: bytes,
    language: str,
    reference_text: str,
) -> dict[str, Any]:
    try:
        import azure.cognitiveservices.speech as speechsdk
    except ImportError:
        raise RuntimeError(
            "azure-cognitiveservices-speech not installed. "
            "Install with: pip install 'azure-cognitiveservices-speech>=1.48.0'"
        ) from None

    credential = None
    if speech_endpoint:
        try:
            from azure.identity import DefaultAzureCredential
        except ImportError as exc:
            raise RuntimeError("azure-identity is required for Azure Speech Entra ID auth") from exc

        credential = DefaultAzureCredential()
        speech_config = speechsdk.SpeechConfig(
            token_credential=credential,
            endpoint=speech_endpoint,
        )
    else:
        speech_config = speechsdk.SpeechConfig(subscription=speech_key, region=speech_region)

    speech_config.speech_recognition_language = language

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_data)
        tmp_path = tmp.name

    try:
        audio_config = speechsdk.audio.AudioConfig(filename=tmp_path)
        recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config,
            audio_config=audio_config,
            language=language,
        )
        pronunciation_config = speechsdk.PronunciationAssessmentConfig(
            reference_text=reference_text,
            grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
            granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme,
            enable_miscue=False,
        )
        if hasattr(pronunciation_config, "enable_prosody_assessment"):
            pronunciation_config.enable_prosody_assessment()
        pronunciation_config.apply_to(recognizer)

        result = recognizer.recognize_once()
        if result.reason != speechsdk.ResultReason.RecognizedSpeech:
            detail = getattr(result, "reason", "unknown")
            raise RuntimeError(f"Azure Speech pronunciation assessment failed: {detail}")

        raw_json = result.properties.get(speechsdk.PropertyId.SpeechServiceResponse_JsonResult)
        if not raw_json:
            raise RuntimeError("Azure Speech pronunciation assessment returned no JSON result")
        return json.loads(raw_json)
    finally:
        if credential is not None and hasattr(credential, "close"):
            credential.close()
        with suppress(OSError):
            Path(tmp_path).unlink(missing_ok=True)


def _score_or_default(value: Any, default: float) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        score = float(default)
    return round(max(0.0, min(100.0, score)), 1)


def _pace_score(
    raw_result: dict[str, Any],
    top_result: dict[str, Any],
    language: str,
) -> tuple[float, float | None]:
    duration_ticks = raw_result.get("Duration") or top_result.get("Duration")
    words = top_result.get("Words") or []
    if not duration_ticks or not words:
        return 0.0, None

    duration_minutes = float(duration_ticks) / 10_000_000 / 60
    if duration_minutes <= 0:
        return 0.0, None

    units = _speech_units(words, language)
    if units <= 0:
        return 0.0, None

    rate = units / duration_minutes
    target = 180 if language.lower().startswith("zh") else 140
    tolerance = 80 if language.lower().startswith("zh") else 60
    score = 100 - (abs(rate - target) / tolerance * 50)
    return round(max(0.0, min(100.0, score)), 1), rate


def _speech_units(words: list[dict[str, Any]], language: str) -> int:
    if language.lower().startswith("zh"):
        return sum(len(str(word.get("Word", "")).strip()) for word in words)
    return sum(1 for word in words if str(word.get("Word", "")).strip())
