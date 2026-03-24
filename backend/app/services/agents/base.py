from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from enum import StrEnum


class CoachEventType(StrEnum):
    TEXT = "text"
    AUDIO = "audio"
    SCORE = "score"
    SUGGESTION = "suggestion"
    ERROR = "error"
    DONE = "done"


@dataclass
class CoachEvent:
    type: CoachEventType
    content: str
    metadata: dict | None = None


@dataclass
class CoachRequest:
    session_id: str
    message: str
    mode: str = "text"  # "text" or "audio"
    scenario_context: str = ""
    hcp_profile: dict | None = None
    scoring_criteria: dict | None = None


class BaseCoachingAdapter(ABC):
    """Abstract base for AI coaching adapters."""

    name: str = ""

    @abstractmethod
    async def execute(self, request: CoachRequest) -> AsyncIterator[CoachEvent]:
        """Execute a coaching interaction, yielding events."""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if this adapter is available."""
        ...

    async def get_version(self) -> str | None:
        """Get adapter version info."""
        return None
