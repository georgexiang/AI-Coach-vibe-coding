"""Unit tests for stream_conference, _now_iso, and _serialize_queue in conference API.

Follows the same direct-call mocking pattern as test_conference_api_unit.py.
"""

import json
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.api.conference import _now_iso, _serialize_queue, stream_conference
from app.models.session import CoachingSession
from app.models.user import User
from app.schemas.conference import ConferenceMessageSend
from app.services.turn_manager import QueuedQuestion
from app.utils.exceptions import AppException, NotFoundException


def _make_user(user_id: str = "user-1") -> User:
    """Create a mock User."""
    user = MagicMock(spec=User)
    user.id = user_id
    return user


def _make_session(
    session_id: str = "sess-1",
    user_id: str = "user-1",
    status: str = "in_progress",
) -> CoachingSession:
    """Create a mock CoachingSession."""
    session = MagicMock(spec=CoachingSession)
    session.id = session_id
    session.user_id = user_id
    session.status = status
    session.session_type = "conference"
    session.sub_state = "presenting"
    return session


class TestNowIso:
    """Tests for _now_iso helper."""

    def test_returns_iso_string(self):
        """Returns a valid ISO-format UTC timestamp string."""
        result = _now_iso()
        # Should be parseable as ISO datetime
        parsed = datetime.fromisoformat(result)
        assert parsed is not None

    def test_returns_string_type(self):
        """Return type is str."""
        assert isinstance(_now_iso(), str)


class TestSerializeQueue:
    """Tests for _serialize_queue helper."""

    def test_empty_queue(self):
        """Empty list returns empty list."""
        assert _serialize_queue([]) == []

    def test_serializes_queued_question_fields(self):
        """Extracts correct fields from QueuedQuestion objects."""
        q = QueuedQuestion(
            hcp_profile_id="hcp-1",
            hcp_name="Dr. Li",
            question="What about PFS?",
            relevance_score=0.85,
            queued_at=datetime.now(),
            status="waiting",
        )
        result = _serialize_queue([q])
        assert len(result) == 1
        assert result[0] == {
            "hcp_profile_id": "hcp-1",
            "hcp_name": "Dr. Li",
            "question": "What about PFS?",
            "relevance_score": 0.85,
            "status": "waiting",
        }

    def test_multiple_questions(self):
        """Serializes multiple questions correctly."""
        questions = [
            QueuedQuestion(
                hcp_profile_id=f"hcp-{i}",
                hcp_name=f"Dr. {i}",
                question=f"Q{i}",
                relevance_score=0.5 + i * 0.1,
                queued_at=datetime.now(),
                status="waiting",
            )
            for i in range(3)
        ]
        result = _serialize_queue(questions)
        assert len(result) == 3
        assert result[0]["hcp_profile_id"] == "hcp-0"
        assert result[2]["hcp_profile_id"] == "hcp-2"


class TestStreamConferenceNotFound:
    """Tests for stream_conference session lookup failures."""

    async def test_session_not_found_raises(self):
        """Non-existent session raises 404."""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)
        user = _make_user()
        request = ConferenceMessageSend(action="present", message="Hello")

        with pytest.raises(NotFoundException):
            await stream_conference("no-id", request, db, user)

    async def test_session_forbidden_raises(self):
        """Session owned by another user raises 403."""
        db = AsyncMock()
        session = _make_session(user_id="other-user")
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = session
        db.execute = AsyncMock(return_value=mock_result)
        user = _make_user(user_id="user-1")
        request = ConferenceMessageSend(action="present", message="Hello")

        with pytest.raises(AppException) as exc:
            await stream_conference("sess-1", request, db, user)
        assert exc.value.status_code == 403

    async def test_completed_session_raises(self):
        """Completed session raises 409."""
        db = AsyncMock()
        session = _make_session(status="completed")
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = session
        db.execute = AsyncMock(return_value=mock_result)
        user = _make_user()
        request = ConferenceMessageSend(action="present", message="Hello")

        with pytest.raises(AppException) as exc:
            await stream_conference("sess-1", request, db, user)
        assert exc.value.status_code == 409


class TestStreamConferenceReturnsSSE:
    """Tests for stream_conference returning EventSourceResponse."""

    @patch("app.api.conference.conference_service")
    @patch("app.api.conference.turn_manager")
    async def test_present_returns_event_source_response(
        self, mock_tm, mock_service
    ):
        """Present action returns an EventSourceResponse object."""
        from sse_starlette.sse import EventSourceResponse

        db = AsyncMock()
        session = _make_session(status="in_progress")
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = session
        db.execute = AsyncMock(return_value=mock_result)
        user = _make_user()
        request = ConferenceMessageSend(action="present", message="Hello conference")

        mock_service._save_conference_message = AsyncMock()
        mock_service.generate_hcp_questions = AsyncMock(return_value=[])

        # detect_key_messages is imported inside event_generator at runtime
        with patch(
            "app.services.session_service.detect_key_messages", new_callable=AsyncMock
        ) as mock_km:
            mock_km.return_value = []
            result = await stream_conference("sess-1", request, db, user)

        assert isinstance(result, EventSourceResponse)

    @patch("app.api.conference.conference_service")
    async def test_respond_returns_event_source_response(self, mock_service):
        """Respond action returns an EventSourceResponse object."""
        from sse_starlette.sse import EventSourceResponse

        db = AsyncMock()
        session = _make_session(status="in_progress")
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = session
        db.execute = AsyncMock(return_value=mock_result)
        user = _make_user()
        request = ConferenceMessageSend(
            action="respond", message="Good question", target_hcp_id="hcp-1"
        )

        async def mock_respond(*args, **kwargs):
            yield {"event": "turn_change", "data": "{}"}

        mock_service.handle_respond = mock_respond

        result = await stream_conference("sess-1", request, db, user)
        assert isinstance(result, EventSourceResponse)
