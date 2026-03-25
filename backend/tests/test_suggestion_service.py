"""Unit tests for suggestion_service covering all branches."""

from app.services.suggestion_service import generate_suggestions, parse_key_messages_status


class TestGenerateSuggestions:
    """Tests for generate_suggestions function."""

    async def test_empty_messages_returns_start_tip(self):
        result = await generate_suggestions(
            messages=[],
            key_messages_status=[],
            scoring_weights={},
        )
        assert len(result) == 1
        assert result[0].type.value == "tip"
        assert result[0].trigger == "session_start"

    async def test_key_message_progress_achievement(self):
        result = await generate_suggestions(
            messages=[
                {"role": "user", "content": "Hello, let me discuss our product."},
                {"role": "assistant", "content": "Please go on."},
            ],
            key_messages_status=[
                {"message": "Efficacy", "delivered": True},
                {"message": "Safety", "delivered": False},
            ],
            scoring_weights={},
        )
        types = {s.type.value for s in result}
        assert "achievement" in types

    async def test_undelivered_reminder_after_exchanges(self):
        msgs = [
            {"role": "user", "content": "msg1"},
            {"role": "assistant", "content": "reply1"},
            {"role": "user", "content": "msg2"},
            {"role": "assistant", "content": "reply2"},
        ]
        result = await generate_suggestions(
            messages=msgs,
            key_messages_status=[
                {"message": "Efficacy", "delivered": False},
                {"message": "Safety", "delivered": False},
            ],
            scoring_weights={},
        )
        triggers = {s.trigger for s in result}
        assert "undelivered_key_message" in triggers

    async def test_low_coverage_warning(self):
        msgs = [
            {"role": "user" if i % 2 == 0 else "assistant", "content": f"msg{i}"} for i in range(8)
        ]
        result = await generate_suggestions(
            messages=msgs,
            key_messages_status=[
                {"message": "A", "delivered": False},
                {"message": "B", "delivered": False},
                {"message": "C", "delivered": False},
                {"message": "D", "delivered": False},
            ],
            scoring_weights={},
        )
        triggers = {s.trigger for s in result}
        assert "low_coverage_warning" in triggers

    async def test_objection_detected(self):
        result = await generate_suggestions(
            messages=[
                {"role": "user", "content": "I have a concern about the cost of the drug"},
            ],
            key_messages_status=[],
            scoring_weights={},
        )
        triggers = {s.trigger for s in result}
        assert "objection_detected" in triggers

    async def test_short_response_tip(self):
        result = await generate_suggestions(
            messages=[
                {"role": "user", "content": "Yes ok"},
            ],
            key_messages_status=[],
            scoring_weights={},
        )
        triggers = {s.trigger for s in result}
        assert "short_response" in triggers


class TestParseKeyMessagesStatus:
    """Tests for parse_key_messages_status."""

    def test_valid_json(self):
        result = parse_key_messages_status('[{"message": "A", "delivered": true}]')
        assert len(result) == 1
        assert result[0]["delivered"] is True

    def test_invalid_json_returns_empty(self):
        result = parse_key_messages_status("not json")
        assert result == []

    def test_none_returns_empty(self):
        result = parse_key_messages_status(None)
        assert result == []
