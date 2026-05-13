"""Tests for session audio upload and voice score status API endpoints.

Tests the audio upload endpoint and voice score status polling endpoint
using mocked services to avoid SQLAlchemy async session teardown issues
with selectinload on in-memory SQLite.
"""

from unittest.mock import AsyncMock, MagicMock, patch

from app.models.session import CoachingSession
from app.models.user import User
from app.services.audio_storage_service import get_audio_url, upload_session_audio
from app.services.auth import create_access_token, get_password_hash
from app.services.voice_scoring_service import (
    VOICE_DIMENSIONS,
    MockVoiceScoringBackend,
    get_voice_scoring_backend,
)
from tests.conftest import TestSessionLocal


async def _create_user(username="audio_user", role="user") -> tuple[str, str]:
    """Create a user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash("pass"),
            full_name=f"Test {username}",
            role=role,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


class TestUploadSessionAudio:
    """Tests for POST /api/v1/sessions/{id}/audio endpoint."""

    async def test_upload_audio_success(self, client):
        """Audio upload returns 201 with audio_url and pending status."""
        user_id, user_token = await _create_user()

        # Create a mock session object that get_session will return
        mock_session = MagicMock(spec=CoachingSession)
        mock_session.id = "test-session-id"
        mock_session.user_id = user_id
        mock_session.audio_url = None
        mock_session.voice_score_status = "none"

        mock_get_session = AsyncMock(return_value=mock_session)
        mock_upload = AsyncMock(return_value="audio/sessions/test-session-id/recording.webm")
        mock_trigger = AsyncMock()

        with (
            patch("app.api.sessions.session_service.get_session", mock_get_session),
            patch("app.services.audio_storage_service.upload_session_audio", mock_upload),
            patch("app.services.voice_scoring_service.trigger_voice_scoring", mock_trigger),
        ):
            response = await client.post(
                "/api/v1/sessions/test-session-id/audio",
                files={"file": ("recording.webm", b"fake-audio-data", "audio/webm")},
                headers={"Authorization": f"Bearer {user_token}"},
            )

        assert response.status_code == 201
        data = response.json()
        assert data["audio_url"] == "audio/sessions/test-session-id/recording.webm"
        assert data["voice_score_status"] == "pending"
        mock_upload.assert_called_once()

    async def test_upload_audio_unauthorized(self, client):
        """Audio upload without auth returns 401."""
        response = await client.post(
            "/api/v1/sessions/fake-id/audio",
            files={"file": ("recording.webm", b"data", "audio/webm")},
        )
        assert response.status_code == 401

    async def test_upload_audio_wrong_user(self, client):
        """Cannot upload audio to another user's session."""
        _, user_token = await _create_user("other_user")

        from app.utils.exceptions import AppException

        mock_get_session = AsyncMock(
            side_effect=AppException(
                status_code=403,
                code="FORBIDDEN",
                message="Session does not belong to this user",
            )
        )

        with patch("app.api.sessions.session_service.get_session", mock_get_session):
            response = await client.post(
                "/api/v1/sessions/someone-elses-session/audio",
                files={"file": ("recording.webm", b"data", "audio/webm")},
                headers={"Authorization": f"Bearer {user_token}"},
            )

        assert response.status_code == 403

    async def test_upload_audio_file_too_large(self, client):
        """Audio file over 50MB returns 413."""
        user_id, user_token = await _create_user("large_file_user")

        mock_session = MagicMock(spec=CoachingSession)
        mock_session.id = "test-session-id"
        mock_session.user_id = user_id

        mock_get_session = AsyncMock(return_value=mock_session)
        large_data = b"x" * (50 * 1024 * 1024 + 1)

        with patch("app.api.sessions.session_service.get_session", mock_get_session):
            response = await client.post(
                "/api/v1/sessions/test-session-id/audio",
                files={"file": ("recording.webm", large_data, "audio/webm")},
                headers={"Authorization": f"Bearer {user_token}"},
            )

        assert response.status_code == 413


class TestGetVoiceScoreStatus:
    """Tests for GET /api/v1/sessions/{id}/voice-score endpoint."""

    async def test_get_voice_score_status_none(self, client):
        """Voice score status returns 'none' for fresh session."""
        user_id, user_token = await _create_user("score_user")

        mock_session = MagicMock(spec=CoachingSession)
        mock_session.id = "test-session-id"
        mock_session.user_id = user_id
        mock_session.voice_score_status = "none"
        mock_session.audio_url = None

        mock_get_session = AsyncMock(return_value=mock_session)

        with patch("app.api.sessions.session_service.get_session", mock_get_session):
            response = await client.get(
                "/api/v1/sessions/test-session-id/voice-score",
                headers={"Authorization": f"Bearer {user_token}"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "test-session-id"
        assert data["voice_score_status"] == "none"
        assert data["audio_url"] is None

    async def test_get_voice_score_status_pending(self, client):
        """Voice score status returns 'pending' after audio upload."""
        user_id, user_token = await _create_user("pending_user")

        mock_session = MagicMock(spec=CoachingSession)
        mock_session.id = "test-session-id"
        mock_session.user_id = user_id
        mock_session.voice_score_status = "pending"
        mock_session.audio_url = "audio/sessions/test-session-id/recording.webm"

        mock_get_session = AsyncMock(return_value=mock_session)

        with patch("app.api.sessions.session_service.get_session", mock_get_session):
            response = await client.get(
                "/api/v1/sessions/test-session-id/voice-score",
                headers={"Authorization": f"Bearer {user_token}"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["voice_score_status"] == "pending"
        assert data["audio_url"] == "audio/sessions/test-session-id/recording.webm"

    async def test_voice_score_unauthorized(self, client):
        """Voice score status without auth returns 401."""
        response = await client.get("/api/v1/sessions/fake-id/voice-score")
        assert response.status_code == 401

    async def test_voice_score_wrong_user(self, client):
        """Cannot view another user's voice score status."""
        _, other_token = await _create_user("wrong_user")

        from app.utils.exceptions import AppException

        mock_get_session = AsyncMock(
            side_effect=AppException(
                status_code=403,
                code="FORBIDDEN",
                message="Session does not belong to this user",
            )
        )

        with patch("app.api.sessions.session_service.get_session", mock_get_session):
            response = await client.get(
                "/api/v1/sessions/someone-elses-session/voice-score",
                headers={"Authorization": f"Bearer {other_token}"},
            )

        assert response.status_code == 403


class TestVoiceScoringServiceUnit:
    """Unit tests for voice scoring service functions."""

    async def test_mock_backend_returns_all_dimensions(self):
        """MockVoiceScoringBackend returns 4 voice dimensions with valid scores."""
        backend = MockVoiceScoringBackend()
        result = await backend.analyze("test/audio.webm", "zh-CN")
        assert len(result["dimensions"]) == 4
        assert all(0 <= d["score"] <= 100 for d in result["dimensions"])

    async def test_overall_score_is_weighted_average(self):
        """Overall score is correctly computed as weighted average."""
        backend = MockVoiceScoringBackend()
        result = await backend.analyze("test/audio.webm", "zh-CN")
        expected = round(sum(d["score"] * d["weight"] for d in result["dimensions"]) / 100, 1)
        assert result["overall_voice_score"] == expected

    def test_dimensions_weights_sum_to_100(self):
        """Voice dimension weights sum to 100."""
        assert sum(d["weight"] for d in VOICE_DIMENSIONS) == 100

    def test_factory_returns_mock_backend(self):
        """Factory returns MockVoiceScoringBackend by default."""
        backend = get_voice_scoring_backend()
        assert isinstance(backend, MockVoiceScoringBackend)


class TestAudioStorageServiceUnit:
    """Unit tests for audio storage service functions."""

    async def test_upload_saves_to_storage(self):
        """upload_session_audio saves via storage backend."""
        with patch("app.services.audio_storage_service.get_storage") as mock_get:
            mock_backend = AsyncMock()
            mock_backend.save.return_value = "audio/sessions/s1/recording.webm"
            mock_get.return_value = mock_backend

            url = await upload_session_audio("s1", b"audio-data", "recording.webm")
            assert "s1" in url
            mock_backend.save.assert_called_once()

    async def test_get_audio_url_exists(self):
        """get_audio_url returns path when file exists."""
        with patch("app.services.audio_storage_service.get_storage") as mock_get:
            mock_backend = AsyncMock()
            mock_backend.exists.return_value = True
            mock_get.return_value = mock_backend

            url = await get_audio_url("s1")
            assert url == "audio/sessions/s1/recording.webm"

    async def test_get_audio_url_not_exists(self):
        """get_audio_url returns None when file doesn't exist."""
        with patch("app.services.audio_storage_service.get_storage") as mock_get:
            mock_backend = AsyncMock()
            mock_backend.exists.return_value = False
            mock_get.return_value = mock_backend

            url = await get_audio_url("nonexistent")
            assert url is None
