"""Tests for voice scoring service (Plan 06)."""

import pytest
from unittest.mock import patch, AsyncMock

from app.services.voice_scoring_service import (
    MockVoiceScoringBackend,
    VOICE_DIMENSIONS,
    get_voice_scoring_backend,
)
from app.services.audio_storage_service import upload_session_audio, get_audio_url


class TestMockVoiceScoringBackend:
    """Tests for MockVoiceScoringBackend."""

    async def test_returns_4_dimensions(self):
        """Mock backend returns scores for all 4 voice dimensions."""
        backend = MockVoiceScoringBackend()
        result = await backend.analyze("test/audio.webm", "zh-CN")
        assert "dimensions" in result
        assert len(result["dimensions"]) == 4
        assert "overall_voice_score" in result

    async def test_dimension_scores_in_valid_range(self):
        """All dimension scores are between 0 and 100."""
        backend = MockVoiceScoringBackend()
        result = await backend.analyze("test/audio.webm", "zh-CN")
        for dim in result["dimensions"]:
            assert "name" in dim
            assert "score" in dim
            assert 0 <= dim["score"] <= 100
            assert dim["name"] in [d["name"] for d in VOICE_DIMENSIONS]

    async def test_overall_score_is_weighted_average(self):
        """Overall score is weighted average of dimension scores."""
        backend = MockVoiceScoringBackend()
        result = await backend.analyze("test/audio.webm", "en-US")
        expected = round(
            sum(d["score"] * d["weight"] for d in result["dimensions"]) / 100, 1
        )
        assert result["overall_voice_score"] == expected

    async def test_dimensions_have_required_fields(self):
        """Each dimension has name, score, weight, max_score, feedback."""
        backend = MockVoiceScoringBackend()
        result = await backend.analyze("test/audio.webm", "zh-CN")
        for dim in result["dimensions"]:
            assert "name" in dim
            assert "score" in dim
            assert "weight" in dim
            assert "max_score" in dim
            assert "feedback" in dim


class TestVoiceDimensions:
    """Tests for VOICE_DIMENSIONS constant."""

    def test_covers_required_set(self):
        """Voice dimensions include fluency, tone, pace, pronunciation (D-09)."""
        dim_names = {d["name"] for d in VOICE_DIMENSIONS}
        assert "fluency" in dim_names
        assert "tone" in dim_names
        assert "pace" in dim_names
        assert "pronunciation" in dim_names

    def test_weights_sum_to_100(self):
        """Dimension weights sum to 100."""
        total = sum(d["weight"] for d in VOICE_DIMENSIONS)
        assert total == 100

    def test_all_have_max_score_100(self):
        """All dimensions have max_score of 100."""
        for dim in VOICE_DIMENSIONS:
            assert dim["max_score"] == 100


class TestGetVoiceScoringBackend:
    """Tests for factory function."""

    def test_returns_mock_backend(self):
        """Factory returns mock backend by default."""
        backend = get_voice_scoring_backend()
        assert isinstance(backend, MockVoiceScoringBackend)


class TestAudioStorageService:
    """Tests for audio storage service functions."""

    async def test_upload_session_audio(self):
        """Audio storage service saves files via storage backend."""
        with patch(
            "app.services.audio_storage_service.get_storage"
        ) as mock_get_storage:
            mock_backend = AsyncMock()
            mock_backend.save.return_value = "audio/sessions/test-id/recording.webm"
            mock_get_storage.return_value = mock_backend

            url = await upload_session_audio("test-id", b"audio-data", "recording.webm")
            assert "test-id" in url
            mock_backend.save.assert_called_once_with(
                "audio/sessions/test-id/recording.webm", b"audio-data"
            )

    async def test_get_audio_url_when_exists(self):
        """get_audio_url returns path when file exists."""
        with patch(
            "app.services.audio_storage_service.get_storage"
        ) as mock_get_storage:
            mock_backend = AsyncMock()
            mock_backend.exists.return_value = True
            mock_get_storage.return_value = mock_backend

            url = await get_audio_url("test-id")
            assert url == "audio/sessions/test-id/recording.webm"

    async def test_get_audio_url_returns_none_when_not_exists(self):
        """get_audio_url returns None when file doesn't exist."""
        with patch(
            "app.services.audio_storage_service.get_storage"
        ) as mock_get_storage:
            mock_backend = AsyncMock()
            mock_backend.exists.return_value = False
            mock_get_storage.return_value = mock_backend

            url = await get_audio_url("nonexistent-session")
            assert url is None
