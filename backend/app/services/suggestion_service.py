"""Real-time coaching suggestion service: analyze conversation and generate tips."""

import json

from app.schemas.suggestion import SuggestionResponse, SuggestionType


async def generate_suggestions(
    messages: list[dict],
    key_messages_status: list[dict],
    scoring_weights: dict,
) -> list[SuggestionResponse]:
    """Analyze conversation context and generate coaching suggestions.

    Uses keyword-based analysis for mock/fallback. Real LLM analysis
    deferred to AI adapter wiring.
    """
    suggestions: list[SuggestionResponse] = []

    if not messages:
        suggestions.append(
            SuggestionResponse(
                type=SuggestionType.TIP,
                message="Start by greeting the HCP and introducing your purpose for the visit.",
                relevance_score=0.9,
                trigger="session_start",
            )
        )
        return suggestions

    # Analyze key message delivery progress
    total_km = len(key_messages_status)
    delivered_km = sum(1 for km in key_messages_status if km.get("delivered"))
    undelivered = [km["message"] for km in key_messages_status if not km.get("delivered")]

    mr_messages = [m for m in messages if m.get("role") == "user"]
    last_mr = mr_messages[-1]["content"].lower() if mr_messages else ""
    msg_count = len(messages)

    # Achievement: key message delivered
    if delivered_km > 0 and total_km > 0:
        suggestions.append(
            SuggestionResponse(
                type=SuggestionType.ACHIEVEMENT,
                message=f"Great progress! {delivered_km}/{total_km} key messages delivered.",
                relevance_score=0.85,
                trigger="key_message_progress",
            )
        )

    # Reminder: undelivered key messages after several exchanges
    if undelivered and msg_count >= 4:
        next_km = undelivered[0]
        suggestions.append(
            SuggestionResponse(
                type=SuggestionType.REMINDER,
                message=f"Consider addressing: {next_km}",
                relevance_score=0.9,
                trigger="undelivered_key_message",
            )
        )

    # Warning: conversation too long without covering key messages
    if msg_count >= 8 and delivered_km < total_km / 2:
        suggestions.append(
            SuggestionResponse(
                type=SuggestionType.WARNING,
                message="The conversation is progressing but key messages coverage is low. "
                "Try to steer the discussion towards your key messages.",
                relevance_score=0.95,
                trigger="low_coverage_warning",
            )
        )

    # Tip: objection handling
    objection_words = ["concern", "worry", "side effect", "risk", "expensive", "cost", "doubt"]
    if any(word in last_mr for word in objection_words):
        suggestions.append(
            SuggestionResponse(
                type=SuggestionType.TIP,
                message="The HCP may raise an objection. Acknowledge their concern first, "
                "then provide evidence-based responses.",
                relevance_score=0.88,
                trigger="objection_detected",
            )
        )

    # Tip: communication quality
    if last_mr and len(last_mr.split()) < 5:
        suggestions.append(
            SuggestionResponse(
                type=SuggestionType.TIP,
                message="Try to provide more detailed responses with supporting data.",
                relevance_score=0.75,
                trigger="short_response",
            )
        )

    return suggestions


def parse_key_messages_status(status_json: str) -> list[dict]:
    """Parse key_messages_status JSON string to list of dicts."""
    try:
        return json.loads(status_json)
    except (json.JSONDecodeError, TypeError):
        return []
