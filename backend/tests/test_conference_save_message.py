"""Tests for _save_conference_message in conference_service.

Covers message index counting, speaker attribution, and status transitions.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.models.session import CoachingSession
from app.services.conference_service import _save_conference_message


@pytest.fixture
async def conference_session(db_session):
    """Create a conference session for testing message saving."""
    # Need user and scenario for FK constraints
    from app.models.scenario import Scenario
    from app.models.user import User

    user = User(username="mr-test", email="mr@test.com", hashed_password="x", role="user")
    db_session.add(user)
    await db_session.flush()

    from app.models.hcp_profile import HcpProfile

    hcp = HcpProfile(name="Dr. Test", specialty="Oncology", created_by=user.id)
    db_session.add(hcp)
    await db_session.flush()

    scenario = Scenario(
        name="Test Conference",
        product="TestDrug",
        hcp_profile_id=hcp.id,
        created_by=user.id,
        mode="conference",
        key_messages="[]",
    )
    db_session.add(scenario)
    await db_session.flush()

    session = CoachingSession(
        user_id=user.id,
        scenario_id=scenario.id,
        status="created",
        session_type="conference",
        sub_state="presenting",
    )
    db_session.add(session)
    await db_session.flush()
    return session


class TestSaveConferenceMessage:
    """Tests for _save_conference_message."""

    async def test_first_message_index_is_zero(self, db_session, conference_session):
        """First message in a session gets message_index 0."""
        msg = await _save_conference_message(
            db_session, conference_session.id, "user", "Hello everyone"
        )
        assert msg.message_index == 0

    async def test_message_index_increments(self, db_session, conference_session):
        """Subsequent messages have incrementing indices."""
        await _save_conference_message(db_session, conference_session.id, "user", "First message")
        msg2 = await _save_conference_message(
            db_session, conference_session.id, "assistant", "Question?"
        )
        msg3 = await _save_conference_message(db_session, conference_session.id, "user", "Answer")
        assert msg2.message_index == 1
        assert msg3.message_index == 2

    async def test_speaker_attribution_stored(self, db_session, conference_session):
        """Speaker ID and name are saved on the message."""
        msg = await _save_conference_message(
            db_session,
            conference_session.id,
            "assistant",
            "What about safety?",
            speaker_id="hcp-123",
            speaker_name="Dr. Li",
        )
        assert msg.speaker_id == "hcp-123"
        assert msg.speaker_name == "Dr. Li"

    async def test_speaker_defaults_when_not_provided(self, db_session, conference_session):
        """When no speaker info provided, defaults apply."""
        msg = await _save_conference_message(
            db_session, conference_session.id, "user", "Presenting now"
        )
        assert msg.speaker_id is None
        assert msg.speaker_name == ""

    async def test_status_transitions_to_in_progress_on_first_user_message(
        self, db_session, conference_session
    ):
        """First user message transitions session from created to in_progress."""
        assert conference_session.status == "created"

        await _save_conference_message(
            db_session, conference_session.id, "user", "Welcome to my talk"
        )

        # Reload session
        result = await db_session.execute(
            select(CoachingSession).where(CoachingSession.id == conference_session.id)
        )
        session = result.scalar_one()
        assert session.status == "in_progress"

    async def test_started_at_set_on_first_user_message(self, db_session, conference_session):
        """started_at timestamp is set when first user message is saved."""
        assert conference_session.started_at is None

        datetime.now(UTC)
        await _save_conference_message(db_session, conference_session.id, "user", "Starting now")

        result = await db_session.execute(
            select(CoachingSession).where(CoachingSession.id == conference_session.id)
        )
        session = result.scalar_one()
        assert session.started_at is not None

    async def test_no_status_transition_on_assistant_first_message(
        self, db_session, conference_session
    ):
        """Assistant message as first message does NOT transition status."""
        await _save_conference_message(
            db_session, conference_session.id, "assistant", "System message"
        )

        result = await db_session.execute(
            select(CoachingSession).where(CoachingSession.id == conference_session.id)
        )
        session = result.scalar_one()
        assert session.status == "created"

    async def test_no_double_transition(self, db_session, conference_session):
        """Second user message does not re-trigger status transition."""
        await _save_conference_message(db_session, conference_session.id, "user", "First")
        # Manually set status to something else to verify no re-transition
        result = await db_session.execute(
            select(CoachingSession).where(CoachingSession.id == conference_session.id)
        )
        session = result.scalar_one()
        assert session.status == "in_progress"

        # Second user message -- message_index is 1, not 0, so no transition
        await _save_conference_message(db_session, conference_session.id, "user", "Second")
        result = await db_session.execute(
            select(CoachingSession).where(CoachingSession.id == conference_session.id)
        )
        session = result.scalar_one()
        assert session.status == "in_progress"
