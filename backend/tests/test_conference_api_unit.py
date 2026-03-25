"""Direct unit tests for conference API router functions.

Bypasses ASGI transport to cover return statement lines that
coverage.py does not track through httpx ASGITransport.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.api.conference import (
    create_conference_session,
    end_conference_session,
    get_conference_session,
    get_scenario_audience,
    set_scenario_audience,
    update_sub_state,
)
from app.models.session import CoachingSession
from app.models.user import User
from app.schemas.conference import (
    AudienceHcpCreate,
    ConferenceSessionCreate,
    ConferenceSubStateUpdate,
)
from app.utils.exceptions import AppException, NotFoundException


def _make_user(user_id: str = "user-1", role: str = "user") -> User:
    """Create a mock User object."""
    user = MagicMock(spec=User)
    user.id = user_id
    user.role = role
    return user


def _make_session(
    session_id: str = "sess-1",
    user_id: str = "user-1",
    status: str = "created",
) -> CoachingSession:
    """Create a mock CoachingSession object."""
    session = MagicMock(spec=CoachingSession)
    session.id = session_id
    session.user_id = user_id
    session.status = status
    session.session_type = "conference"
    session.sub_state = "presenting"
    return session


class TestCreateConferenceSessionDirect:
    """Direct tests for create_conference_session route function."""

    @patch("app.api.conference.conference_service")
    async def test_create_calls_service(self, mock_service):
        """Route function delegates to conference_service."""
        mock_session = _make_session()
        mock_service.create_conference_session = AsyncMock(return_value=mock_session)
        request = ConferenceSessionCreate(scenario_id="scen-1")
        user = _make_user()
        db = AsyncMock()

        result = await create_conference_session(request, db, user)
        assert result == mock_session
        mock_service.create_conference_session.assert_called_once_with(db, "scen-1", "user-1")


class TestGetConferenceSessionDirect:
    """Direct tests for get_conference_session route function."""

    async def test_not_found(self):
        """Non-existent session raises 404."""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)
        user = _make_user()

        with pytest.raises(NotFoundException):
            await get_conference_session("no-id", db, user)

    async def test_forbidden(self):
        """Session owned by another user raises 403."""
        db = AsyncMock()
        session = _make_session(user_id="other-user")
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = session
        db.execute = AsyncMock(return_value=mock_result)
        user = _make_user(user_id="user-1")

        with pytest.raises(AppException) as exc:
            await get_conference_session("sess-1", db, user)
        assert exc.value.status_code == 403

    async def test_success(self):
        """Returns session when found and owned by user."""
        db = AsyncMock()
        session = _make_session(user_id="user-1")
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = session
        db.execute = AsyncMock(return_value=mock_result)
        user = _make_user(user_id="user-1")

        result = await get_conference_session("sess-1", db, user)
        assert result == session


class TestUpdateSubStateDirect:
    """Direct tests for update_sub_state route function."""

    async def test_not_found(self):
        """Non-existent session raises 404."""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)
        user = _make_user()
        request = ConferenceSubStateUpdate(sub_state="qa")

        with pytest.raises(NotFoundException):
            await update_sub_state("no-id", request, db, user)

    async def test_forbidden(self):
        """Session owned by another user raises 403."""
        db = AsyncMock()
        session = _make_session(user_id="other")
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = session
        db.execute = AsyncMock(return_value=mock_result)
        user = _make_user(user_id="user-1")
        request = ConferenceSubStateUpdate(sub_state="qa")

        with pytest.raises(AppException) as exc:
            await update_sub_state("sess-1", request, db, user)
        assert exc.value.status_code == 403

    @patch("app.api.conference.conference_service")
    async def test_success(self, mock_service):
        """Returns updated sub_state."""
        db = AsyncMock()
        session = _make_session(user_id="user-1")
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = session
        db.execute = AsyncMock(return_value=mock_result)
        mock_service.transition_sub_state = AsyncMock()
        user = _make_user(user_id="user-1")
        request = ConferenceSubStateUpdate(sub_state="qa")

        result = await update_sub_state("sess-1", request, db, user)
        assert result == {"sub_state": "qa"}


class TestEndConferenceSessionDirect:
    """Direct tests for end_conference_session route function."""

    @patch("app.api.conference.conference_service")
    async def test_calls_service(self, mock_service):
        """Route function delegates to conference_service.end."""
        mock_session = _make_session(status="completed")
        mock_service.end_conference_session = AsyncMock(return_value=mock_session)
        db = AsyncMock()
        user = _make_user()

        result = await end_conference_session("sess-1", db, user)
        assert result == mock_session


class TestGetScenarioAudienceDirect:
    """Direct tests for get_scenario_audience route function."""

    async def test_returns_list(self):
        """Returns list of audience HCP responses."""
        db = AsyncMock()
        # Create mock audience HCP with profile
        ah = MagicMock()
        ah.id = "ah-1"
        ah.scenario_id = "scen-1"
        ah.hcp_profile_id = "hcp-1"
        ah.role_in_conference = "audience"
        ah.voice_id = "voice-1"
        ah.sort_order = 0
        ah.hcp_profile = MagicMock()
        ah.hcp_profile.name = "Dr. Test"
        ah.hcp_profile.specialty = "Oncology"

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [ah]
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)
        user = _make_user()

        result = await get_scenario_audience("scen-1", db, user)
        assert len(result) == 1
        assert result[0].hcp_name == "Dr. Test"

    async def test_empty_audience(self):
        """Returns empty list when no audience configured."""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)
        user = _make_user()

        result = await get_scenario_audience("scen-1", db, user)
        assert result == []


class TestSetScenarioAudienceDirect:
    """Direct tests for set_scenario_audience route function."""

    async def test_replaces_audience(self):
        """Replaces existing audience and returns new list."""
        db = AsyncMock()

        # Mock existing audience query (for delete)
        existing_mock = MagicMock()
        existing_scalars = MagicMock()
        existing_scalars.all.return_value = []
        existing_mock.scalars.return_value = existing_scalars

        # Mock reload query with profile info
        reload_ah = MagicMock()
        reload_ah.id = "new-ah"
        reload_ah.scenario_id = "scen-1"
        reload_ah.hcp_profile_id = "hcp-1"
        reload_ah.role_in_conference = "audience"
        reload_ah.voice_id = ""
        reload_ah.sort_order = 0
        reload_ah.hcp_profile = MagicMock()
        reload_ah.hcp_profile.name = "Dr. New"
        reload_ah.hcp_profile.specialty = "Cardiology"

        reload_mock = MagicMock()
        reload_scalars = MagicMock()
        reload_scalars.all.return_value = [reload_ah]
        reload_mock.scalars.return_value = reload_scalars

        # execute returns different results for delete vs reload
        db.execute = AsyncMock(side_effect=[existing_mock, reload_mock])
        db.flush = AsyncMock()
        db.add = MagicMock()
        db.delete = AsyncMock()

        audience = [AudienceHcpCreate(hcp_profile_id="hcp-1")]
        user = _make_user(role="admin")

        result = await set_scenario_audience("scen-1", audience, db, user)
        assert len(result) == 1
        assert result[0].hcp_name == "Dr. New"
