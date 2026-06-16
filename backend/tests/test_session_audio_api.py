"""Unit tests for session audio upload and voice score API endpoints."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.dependencies import get_current_user
from app.main import app
from app.models.session import CoachingSession
from app.models.user import User
from tests.conftest import override_get_db


@pytest.fixture
def test_user():
    """Create a test user instance."""
    return User(
        id=str(uuid.uuid4()),
        username="audiotest",
        email="audio@test.com",
        hashed_password="hashed",
        role="mr",
    )


@pytest.fixture
async def seeded_session(db_session, test_user):
    """Create a session in DB for testing."""
    session_id = str(uuid.uuid4())
    db_session.add(test_user)
    await db_session.flush()

    session = CoachingSession(
        id=session_id,
        user_id=test_user.id,
        scenario_id="fake-scenario-id",
        status="completed",
    )
    db_session.add(session)
    await db_session.commit()
    return session_id


@pytest.fixture
async def auth_client(test_user):
    """Async client with auth overrides."""
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: test_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


class TestUploadSessionAudioEndpoint:
    """Tests for POST /api/v1/sessions/{id}/audio endpoint."""

    async def test_upload_returns_201(self, auth_client, seeded_session):
        """Successful upload returns 201 with audio_url."""
        with patch(
            "app.api.sessions.session_service.get_session",
            new_callable=AsyncMock,
        ) as mock_get:
            mock_session = AsyncMock()
            mock_session.user_id = app.dependency_overrides[get_current_user]().id
            mock_session.audio_url = None
            mock_session.voice_score_status = "none"
            mock_get.return_value = mock_session

            with patch(
                "app.services.audio_storage_service.upload_session_audio",
                new_callable=AsyncMock,
                return_value="audio/sessions/test/recording.webm",
            ):
                with patch(
                    "app.services.voice_scoring_service.trigger_voice_scoring",
                    new_callable=AsyncMock,
                ):
                    response = await auth_client.post(
                        f"/api/v1/sessions/{seeded_session}/audio",
                        files={"file": ("recording.webm", b"fake-audio", "audio/webm")},
                    )

        assert response.status_code == 201
        data = response.json()
        assert "audio_url" in data
        assert data["voice_score_status"] == "pending"

    async def test_upload_rejects_oversized_file(self, auth_client, seeded_session):
        """Upload rejects files over 50MB."""
        with patch(
            "app.api.sessions.session_service.get_session",
            new_callable=AsyncMock,
        ) as mock_get:
            mock_session = AsyncMock()
            mock_session.user_id = app.dependency_overrides[get_current_user]().id
            mock_get.return_value = mock_session

            # 51MB file
            big_data = b"x" * (51 * 1024 * 1024)
            response = await auth_client.post(
                f"/api/v1/sessions/{seeded_session}/audio",
                files={"file": ("big.webm", big_data, "audio/webm")},
            )

        assert response.status_code == 413

    async def test_upload_rejects_other_users_session(self, auth_client, seeded_session):
        """Upload returns 403 for sessions owned by another user."""
        with patch(
            "app.api.sessions.session_service.get_session",
            new_callable=AsyncMock,
        ) as mock_get:
            mock_session = AsyncMock()
            mock_session.user_id = "other-user-id"
            mock_get.return_value = mock_session

            response = await auth_client.post(
                f"/api/v1/sessions/{seeded_session}/audio",
                files={"file": ("recording.webm", b"audio", "audio/webm")},
            )

        assert response.status_code == 403


class TestGetVoiceScoreStatusEndpoint:
    """Tests for GET /api/v1/sessions/{id}/voice-score endpoint."""

    async def test_returns_score_status(self, auth_client, seeded_session):
        """Returns voice score status for a session."""
        with patch(
            "app.api.sessions.session_service.get_session",
            new_callable=AsyncMock,
        ) as mock_get:
            mock_session = AsyncMock()
            mock_session.user_id = app.dependency_overrides[get_current_user]().id
            mock_session.voice_score_status = "completed"
            mock_session.audio_url = "audio/sessions/test/recording.webm"
            mock_get.return_value = mock_session

            response = await auth_client.get(f"/api/v1/sessions/{seeded_session}/voice-score")

        assert response.status_code == 200
        data = response.json()
        assert data["voice_score_status"] == "completed"
        assert data["audio_url"] == "audio/sessions/test/recording.webm"
        assert data["session_id"] == seeded_session

    async def test_returns_none_status_when_no_audio(self, auth_client, seeded_session):
        """Returns 'none' status when no audio uploaded."""
        with patch(
            "app.api.sessions.session_service.get_session",
            new_callable=AsyncMock,
        ) as mock_get:
            mock_session = AsyncMock()
            mock_session.user_id = app.dependency_overrides[get_current_user]().id
            mock_session.voice_score_status = "none"
            mock_session.audio_url = None
            mock_get.return_value = mock_session

            response = await auth_client.get(f"/api/v1/sessions/{seeded_session}/voice-score")

        assert response.status_code == 200
        data = response.json()
        assert data["voice_score_status"] == "none"
        assert data["audio_url"] is None

    async def test_rejects_other_users_session(self, auth_client, seeded_session):
        """Returns 403 for sessions owned by another user."""
        with patch(
            "app.api.sessions.session_service.get_session",
            new_callable=AsyncMock,
        ) as mock_get:
            mock_session = AsyncMock()
            mock_session.user_id = "other-user-id"
            mock_get.return_value = mock_session

            response = await auth_client.get(f"/api/v1/sessions/{seeded_session}/voice-score")

        assert response.status_code == 403


class TestDownloadSessionAudioEndpoint:
    """Tests for GET /api/v1/sessions/{id}/audio endpoint."""

    async def test_streams_audio_for_session_owner(self, auth_client, seeded_session):
        """Download streams audio bytes through backend-owned storage access."""
        with patch(
            "app.api.sessions.session_service.get_session",
            new_callable=AsyncMock,
        ) as mock_get:
            mock_session = AsyncMock()
            mock_session.user_id = app.dependency_overrides[get_current_user]().id
            mock_session.audio_url = "audio/sessions/test/recording.webm"
            mock_get.return_value = mock_session

            mock_storage = AsyncMock()
            mock_storage.read.return_value = b"fake-audio"
            with patch("app.services.storage.get_storage", return_value=mock_storage):
                response = await auth_client.get(f"/api/v1/sessions/{seeded_session}/audio")

        assert response.status_code == 200
        assert response.content == b"fake-audio"
        assert response.headers["content-type"] == "audio/webm"
        mock_storage.read.assert_awaited_once_with("audio/sessions/test/recording.webm")

    async def test_returns_404_when_session_has_no_audio(self, auth_client, seeded_session):
        """Download returns 404 when no recording is attached."""
        with patch(
            "app.api.sessions.session_service.get_session",
            new_callable=AsyncMock,
        ) as mock_get:
            mock_session = AsyncMock()
            mock_session.user_id = app.dependency_overrides[get_current_user]().id
            mock_session.audio_url = None
            mock_get.return_value = mock_session

            response = await auth_client.get(f"/api/v1/sessions/{seeded_session}/audio")

        assert response.status_code == 404

    async def test_rejects_other_users_session_audio(self, auth_client, seeded_session):
        """Download returns 403 for sessions owned by another user."""
        with patch(
            "app.api.sessions.session_service.get_session",
            new_callable=AsyncMock,
        ) as mock_get:
            mock_session = AsyncMock()
            mock_session.user_id = "other-user-id"
            mock_session.audio_url = "audio/sessions/test/recording.webm"
            mock_get.return_value = mock_session

            response = await auth_client.get(f"/api/v1/sessions/{seeded_session}/audio")

        assert response.status_code == 403
