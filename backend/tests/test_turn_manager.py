"""Unit tests for TurnManager: in-memory conference Q&A question queue management."""

from datetime import UTC, datetime

import pytest

from app.services.turn_manager import QueuedQuestion, TurnManager


@pytest.fixture
def tm():
    """Create a fresh TurnManager for each test (not the module-level singleton)."""
    return TurnManager()


def _make_question(
    hcp_id: str = "hcp-1",
    hcp_name: str = "Dr. Wang",
    question: str = "What about safety data?",
    relevance_score: float = 0.8,
    status: str = "waiting",
) -> QueuedQuestion:
    """Helper to build a QueuedQuestion with defaults."""
    return QueuedQuestion(
        hcp_profile_id=hcp_id,
        hcp_name=hcp_name,
        question=question,
        relevance_score=relevance_score,
        queued_at=datetime.now(UTC),
        status=status,
    )


class TestTurnManagerAddQuestion:
    """Tests for TurnManager.add_question."""

    def test_add_question_to_empty_session(self, tm: TurnManager):
        """First question can be added and retrieved."""
        q = _make_question()
        tm.add_question("sess-1", q)
        queue = tm.get_queue("sess-1")
        assert len(queue) == 1
        assert queue[0].hcp_profile_id == "hcp-1"

    def test_add_question_sorts_by_relevance(self, tm: TurnManager):
        """Questions are sorted descending by relevance_score after each add."""
        q_low = _make_question(hcp_id="low", relevance_score=0.3)
        q_mid = _make_question(hcp_id="mid", relevance_score=0.6)
        q_high = _make_question(hcp_id="high", relevance_score=0.9)

        tm.add_question("sess-1", q_low)
        tm.add_question("sess-1", q_mid)
        tm.add_question("sess-1", q_high)

        queue = tm.get_queue("sess-1")
        assert len(queue) == 3
        assert queue[0].hcp_profile_id == "high"
        assert queue[1].hcp_profile_id == "mid"
        assert queue[2].hcp_profile_id == "low"


class TestTurnManagerGetQueue:
    """Tests for TurnManager.get_queue."""

    def test_get_queue_returns_only_waiting(self, tm: TurnManager):
        """Active and answered questions are excluded from the queue."""
        q_waiting = _make_question(hcp_id="w", relevance_score=0.5)
        q_active = _make_question(hcp_id="a", relevance_score=0.7, status="active")
        q_answered = _make_question(hcp_id="d", relevance_score=0.9, status="answered")

        tm.add_question("sess-1", q_waiting)
        tm.add_question("sess-1", q_active)
        tm.add_question("sess-1", q_answered)

        queue = tm.get_queue("sess-1")
        assert len(queue) == 1
        assert queue[0].hcp_profile_id == "w"

    def test_get_queue_for_nonexistent_session(self, tm: TurnManager):
        """Getting queue for unknown session returns empty list."""
        assert tm.get_queue("no-such-session") == []


class TestTurnManagerActivate:
    """Tests for TurnManager.activate_question."""

    def test_activate_question_sets_status(self, tm: TurnManager):
        """Activating by hcp_profile_id sets status to 'active'."""
        q = _make_question(hcp_id="hcp-99")
        tm.add_question("sess-1", q)

        activated = tm.activate_question("sess-1", "hcp-99")
        assert activated is not None
        assert activated.status == "active"
        assert activated.hcp_profile_id == "hcp-99"

    def test_activate_question_returns_none_for_unknown(self, tm: TurnManager):
        """Activating a non-existent hcp_id returns None."""
        q = _make_question(hcp_id="hcp-1")
        tm.add_question("sess-1", q)
        assert tm.activate_question("sess-1", "hcp-unknown") is None

    def test_activate_question_returns_none_for_empty_session(self, tm: TurnManager):
        """Activating in a session with no questions returns None."""
        assert tm.activate_question("empty", "hcp-1") is None


class TestTurnManagerMarkAnswered:
    """Tests for TurnManager.mark_answered."""

    def test_mark_answered_sets_status(self, tm: TurnManager):
        """Marking active question sets it to 'answered'."""
        q = _make_question(hcp_id="hcp-1")
        tm.add_question("sess-1", q)
        tm.activate_question("sess-1", "hcp-1")

        tm.mark_answered("sess-1", "hcp-1")
        # Now the question should not appear in queue (not waiting)
        assert tm.get_queue("sess-1") == []
        # And should not be the active speaker
        assert tm.get_active_speaker("sess-1") is None

    def test_mark_answered_noop_for_nonexistent(self, tm: TurnManager):
        """Marking answered on a session with no questions does not raise."""
        tm.mark_answered("no-session", "hcp-1")  # should not raise


class TestTurnManagerGetActiveSpeaker:
    """Tests for TurnManager.get_active_speaker."""

    def test_get_active_speaker_returns_active_question(self, tm: TurnManager):
        """When a question is activated, get_active_speaker returns it."""
        q = _make_question(hcp_id="hcp-1", question="What about efficacy?")
        tm.add_question("sess-1", q)
        tm.activate_question("sess-1", "hcp-1")

        speaker = tm.get_active_speaker("sess-1")
        assert speaker is not None
        assert speaker.hcp_profile_id == "hcp-1"
        assert speaker.question == "What about efficacy?"

    def test_get_active_speaker_returns_none_when_no_active(self, tm: TurnManager):
        """Returns None when no question is active."""
        q = _make_question(hcp_id="hcp-1")
        tm.add_question("sess-1", q)
        # Not activated, still waiting
        assert tm.get_active_speaker("sess-1") is None

    def test_get_active_speaker_none_for_empty_session(self, tm: TurnManager):
        """Returns None for a session with no questions at all."""
        assert tm.get_active_speaker("empty-session") is None


class TestTurnManagerCleanup:
    """Tests for TurnManager.cleanup_session."""

    def test_cleanup_session_removes_queue(self, tm: TurnManager):
        """After cleanup, the session queue is empty."""
        tm.add_question("sess-1", _make_question(hcp_id="a"))
        tm.add_question("sess-1", _make_question(hcp_id="b"))
        assert len(tm.get_queue("sess-1")) == 2

        tm.cleanup_session("sess-1")
        assert tm.get_queue("sess-1") == []

    def test_cleanup_nonexistent_session(self, tm: TurnManager):
        """Cleaning up a non-existent session does not raise."""
        tm.cleanup_session("no-such-session")  # should not raise


class TestTurnManagerSessionIsolation:
    """Tests for session isolation between different sessions."""

    def test_multiple_sessions_isolated(self, tm: TurnManager):
        """Questions for session A do not appear in session B queue."""
        qa = _make_question(hcp_id="hcp-a", question="Session A question")
        qb = _make_question(hcp_id="hcp-b", question="Session B question")

        tm.add_question("sess-a", qa)
        tm.add_question("sess-b", qb)

        queue_a = tm.get_queue("sess-a")
        queue_b = tm.get_queue("sess-b")
        assert len(queue_a) == 1
        assert len(queue_b) == 1
        assert queue_a[0].hcp_profile_id == "hcp-a"
        assert queue_b[0].hcp_profile_id == "hcp-b"

    def test_cleanup_does_not_affect_other_sessions(self, tm: TurnManager):
        """Cleaning session A does not remove session B's queue."""
        tm.add_question("sess-a", _make_question(hcp_id="a"))
        tm.add_question("sess-b", _make_question(hcp_id="b"))

        tm.cleanup_session("sess-a")
        assert tm.get_queue("sess-a") == []
        assert len(tm.get_queue("sess-b")) == 1
