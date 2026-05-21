"""Tests for voice scoring dimensions and audio storage (Plan 06)."""

from unittest.mock import AsyncMock, patch

from app.services.audio_storage_service import get_audio_url, upload_session_audio
from app.services.voice_scoring_service import VOICE_DIMENSIONS


class TestVoiceDimensions:
    """Tests for VOICE_DIMENSIONS constant."""

    def test_covers_required_set(self):
        dim_names = {d["name"] for d in VOICE_DIMENSIONS}
        assert "fluency" in dim_names
        assert "tone" in dim_names
        assert "pace" in dim_names
        assert "pronunciation" in dim_names

    def test_weights_sum_to_100(self):
        total = sum(d["weight"] for d in VOICE_DIMENSIONS)
        assert total == 100

    def test_all_have_max_score_100(self):
        for dim in VOICE_DIMENSIONS:
            assert dim["max_score"] == 100


class TestAudioStorageService:
    """Tests for audio storage service functions."""

    async def test_upload_session_audio(self):
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
        with patch(
            "app.services.audio_storage_service.get_storage"
        ) as mock_get_storage:
            mock_backend = AsyncMock()
            mock_backend.exists.return_value = True
            mock_get_storage.return_value = mock_backend

            url = await get_audio_url("test-id")
            assert url == "audio/sessions/test-id/recording.webm"

    async def test_get_audio_url_returns_none_when_not_exists(self):
        with patch(
            "app.services.audio_storage_service.get_storage"
        ) as mock_get_storage:
            mock_backend = AsyncMock()
            mock_backend.exists.return_value = False
            mock_get_storage.return_value = mock_backend

            url = await get_audio_url("nonexistent-session")
            assert url is None
