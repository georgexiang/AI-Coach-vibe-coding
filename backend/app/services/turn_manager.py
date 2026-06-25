"""In-memory turn management for conference Q&A sessions."""

from dataclasses import dataclass
from datetime import datetime


@dataclass
class QueuedQuestion:
    """A question queued by an HCP audience member during a conference Q&A."""

    hcp_profile_id: str
    hcp_name: str
    question: str
    relevance_score: float
    queued_at: datetime
    status: str = "waiting"


class TurnManager:
    """Manages per-session question queues for conference Q&A.

    Each session has its own queue of questions in insertion order.
    Only one question can be active at a time per session.
    """

    def __init__(self) -> None:
        self._queues: dict[str, list[QueuedQuestion]] = {}
        self._followup_counts: dict[tuple[str, str], int] = {}

    def add_question(self, session_id: str, question: QueuedQuestion) -> None:
        """Append a question to the session queue."""
        if session_id not in self._queues:
            self._queues[session_id] = []
        self._queues[session_id].append(question)

    def get_queue(self, session_id: str) -> list[QueuedQuestion]:
        """Return only waiting questions for a session."""
        return [q for q in self._queues.get(session_id, []) if q.status == "waiting"]

    def activate_question(self, session_id: str, hcp_profile_id: str) -> QueuedQuestion | None:
        """Set the first matching waiting question to active."""
        for q in self._queues.get(session_id, []):
            if q.hcp_profile_id == hcp_profile_id and q.status == "waiting":
                q.status = "active"
                self._followup_counts[(session_id, hcp_profile_id)] = 0
                return q
        return None

    def increment_followup_count(self, session_id: str, hcp_profile_id: str) -> int:
        """Increment and return the active HCP's follow-up count."""
        key = (session_id, hcp_profile_id)
        self._followup_counts[key] = self._followup_counts.get(key, 0) + 1
        return self._followup_counts[key]

    def get_followup_count(self, session_id: str, hcp_profile_id: str) -> int:
        """Return the active HCP's follow-up count."""
        return self._followup_counts.get((session_id, hcp_profile_id), 0)

    def mark_answered(self, session_id: str, hcp_profile_id: str) -> None:
        """Set the active question from an HCP to answered."""
        for q in self._queues.get(session_id, []):
            if q.hcp_profile_id == hcp_profile_id and q.status == "active":
                q.status = "answered"
                self._followup_counts.pop((session_id, hcp_profile_id), None)
                return

    def get_active_speaker(self, session_id: str) -> QueuedQuestion | None:
        """Return the currently active question for a session, or None."""
        for q in self._queues.get(session_id, []):
            if q.status == "active":
                return q
        return None

    def cleanup_session(self, session_id: str) -> None:
        """Remove all queue data for a session."""
        self._queues.pop(session_id, None)
        keys_to_remove = [key for key in self._followup_counts if key[0] == session_id]
        for key in keys_to_remove:
            self._followup_counts.pop(key, None)


# Module-level singleton
turn_manager = TurnManager()
