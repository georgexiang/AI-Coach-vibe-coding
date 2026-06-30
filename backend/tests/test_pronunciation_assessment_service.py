"""Tests for Azure Speech Pronunciation Assessment mapping."""

from unittest.mock import patch

import pytest

from app.services.pronunciation_assessment_service import (
    assess_pronunciation,
    map_pronunciation_result,
    normalize_speech_endpoint,
)


def test_maps_azure_speech_scores_to_voice_dimensions():
    raw = {
        "Duration": 30 * 10_000_000,
        "NBest": [
            {
                "PronunciationAssessment": {
                    "AccuracyScore": 91,
                    "FluencyScore": 82,
                    "ProsodyScore": 77,
                    "PronScore": 88,
                },
                "Words": [{"Word": f"word{i}"} for i in range(70)],
            }
        ],
    }

    mapped = map_pronunciation_result(raw, language="en-US")

    by_name = {dim["name"]: dim for dim in mapped["dimensions"]}
    assert set(by_name) == {"pronunciation", "fluency", "pace", "tone"}
    assert by_name["pronunciation"]["score"] == 91
    assert by_name["fluency"]["score"] == 82
    assert by_name["tone"]["score"] == 77
    assert by_name["pace"]["score"] > 0
    assert "Azure Speech Pronunciation Assessment" in mapped["feedback_summary"]


def test_maps_missing_prosody_to_estimated_tone():
    raw = {
        "Duration": 10 * 10_000_000,
        "NBest": [
            {
                "PronunciationAssessment": {
                    "AccuracyScore": 80,
                    "FluencyScore": 70,
                },
                "Words": [{"Word": "你好"}, {"Word": "医生"}],
            }
        ],
    }

    mapped = map_pronunciation_result(raw, language="zh-CN")
    by_name = {dim["name"]: dim for dim in mapped["dimensions"]}
    assert by_name["tone"]["score"] == 75
    assert "prosody_unavailable" in mapped["feedback_summary"]


def test_normalizes_foundry_services_endpoint_to_cognitive_services_endpoint():
    endpoint = normalize_speech_endpoint("https://aicoach-public-foundry.services.ai.azure.com")
    assert endpoint == "https://aicoach-public-foundry.cognitiveservices.azure.com/"


async def test_assess_pronunciation_requires_endpoint_or_key_region_and_audio():
    with pytest.raises(RuntimeError, match="endpoint or API key"):
        await assess_pronunciation(
            speech_key="",
            speech_region="",
            audio_data=b"audio",
        )
    with pytest.raises(RuntimeError, match="region"):
        await assess_pronunciation(
            speech_key="key",
            speech_region="",
            audio_data=b"audio",
        )
    with pytest.raises(RuntimeError, match="Audio data"):
        await assess_pronunciation(
            speech_key="key",
            speech_region="eastus2",
            audio_data=b"",
        )


async def test_assess_pronunciation_prefers_entra_endpoint():
    raw = {
        "Duration": 10 * 10_000_000,
        "NBest": [{"PronunciationAssessment": {"AccuracyScore": 90}, "Words": [{"Word": "hi"}]}],
    }

    with patch(
        "app.services.pronunciation_assessment_service._assess_pronunciation_sync",
        return_value=raw,
    ) as assess_sync:
        result = await assess_pronunciation(
            speech_endpoint="https://aicoach-public-foundry.services.ai.azure.com",
            speech_key="fallback-key",
            speech_region="eastus2",
            audio_data=b"audio",
        )

    assert result.dimensions[0]["name"] == "pronunciation"
    args = assess_sync.call_args.args
    assert args[0] == ""
    assert args[1] == ""
    assert args[2] == "https://aicoach-public-foundry.cognitiveservices.azure.com/"


async def test_assess_pronunciation_falls_back_to_key_when_entra_fails():
    raw = {
        "Duration": 10 * 10_000_000,
        "NBest": [{"PronunciationAssessment": {"AccuracyScore": 88}, "Words": [{"Word": "hi"}]}],
    }

    with patch(
        "app.services.pronunciation_assessment_service._assess_pronunciation_sync",
        side_effect=[RuntimeError("entra failed"), raw],
    ) as assess_sync:
        result = await assess_pronunciation(
            speech_endpoint="https://aicoach-public-foundry.cognitiveservices.azure.com",
            speech_key="fallback-key",
            speech_region="eastus2",
            audio_data=b"audio",
        )

    assert result.dimensions[0]["score"] == 88
    assert assess_sync.call_count == 2
    fallback_args = assess_sync.call_args_list[1].args
    assert fallback_args[0] == "fallback-key"
    assert fallback_args[1] == "eastus2"
    assert fallback_args[2] == ""
