"""Unit tests for audio storage service."""

import pytest

from app.services.audio_storage_service import (
    AUDIO_BASE_PATH,
    get_audio_content,
    get_audio_url,
    upload_session_audio,
)
from app.services.storage.local import LocalStorageBackend


@pytest.fixture
def mock_storage(tmp_path, monkeypatch):
    """Patch get_storage to return a temp-backed LocalStorageBackend."""
    storage = LocalStorageBackend(base_path=str(tmp_path))
    monkeypatch.setattr("app.services.audio_storage_service.get_storage", lambda: storage)
    return storage


class TestUploadSessionAudio:
    """Tests for upload_session_audio function."""

    async def test_upload_returns_storage_path(self, mock_storage):
        """upload_session_audio returns the saved file path."""
        result = await upload_session_audio("session-123", b"audio-data")
        assert "session-123" in result
        assert "recording.webm" in result

    async def test_upload_stores_content(self, mock_storage):
        """upload_session_audio saves the actual audio bytes."""
        await upload_session_audio("session-456", b"test-audio-bytes")
        content = await mock_storage.read(f"{AUDIO_BASE_PATH}/session-456/recording.webm")
        assert content == b"test-audio-bytes"

    async def test_upload_custom_filename(self, mock_storage):
        """upload_session_audio respects custom filename."""
        result = await upload_session_audio("session-789", b"data", "custom.ogg")
        assert "custom.ogg" in result

    async def test_upload_creates_directory_structure(self, mock_storage):
        """upload_session_audio creates nested directories."""
        await upload_session_audio("new-session", b"data")
        assert await mock_storage.exists(f"{AUDIO_BASE_PATH}/new-session/recording.webm")


class TestGetAudioUrl:
    """Tests for get_audio_url function."""

    async def test_returns_path_when_exists(self, mock_storage):
        """get_audio_url returns path when audio file exists."""
        await upload_session_audio("session-abc", b"audio")
        url = await get_audio_url("session-abc")
        assert url == f"{AUDIO_BASE_PATH}/session-abc/recording.webm"

    async def test_returns_none_when_not_exists(self, mock_storage):
        """get_audio_url returns None when no audio file."""
        url = await get_audio_url("nonexistent-session")
        assert url is None

    async def test_custom_filename(self, mock_storage):
        """get_audio_url respects custom filename."""
        await upload_session_audio("session-x", b"data", "voice.ogg")
        url = await get_audio_url("session-x", "voice.ogg")
        assert url is not None
        assert "voice.ogg" in url


class TestGetAudioContent:
    """Tests for get_audio_content function."""

    async def test_returns_content_when_exists(self, mock_storage):
        """get_audio_content returns audio bytes."""
        await upload_session_audio("session-def", b"my-audio-content")
        content = await get_audio_content("session-def")
        assert content == b"my-audio-content"

    async def test_returns_none_when_not_exists(self, mock_storage):
        """get_audio_content returns None when no audio file."""
        content = await get_audio_content("no-such-session")
        assert content is None

    async def test_custom_filename(self, mock_storage):
        """get_audio_content respects custom filename."""
        await upload_session_audio("session-y", b"custom-data", "test.wav")
        content = await get_audio_content("session-y", "test.wav")
        assert content == b"custom-data"
