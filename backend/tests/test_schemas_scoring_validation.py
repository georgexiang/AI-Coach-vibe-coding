"""Tests for scoring and session schema validation edge cases."""

from datetime import datetime

from pydantic import ValidationError

from app.schemas.score import ScoreDetailResponse, SessionScoreResponse
from app.schemas.session import (
    MessageResponse,
    SendMessageRequest,
    SessionCreate,
    SessionResponse,
)


class TestSessionScoreResponseSchema:
    """Tests for SessionScoreResponse Pydantic schema."""

    def test_valid_score_response(self):
        """Valid score response should parse correctly."""
        data = {
            "id": "score-1",
            "session_id": "sess-1",
            "overall_score": 85.5,
            "passed": True,
            "feedback_summary": "Good performance",
            "details": [],
            "created_at": datetime.now(),
        }
        score = SessionScoreResponse(**data)
        assert score.overall_score == 85.5
        assert score.passed is True
        assert score.session_id == "sess-1"

    def test_score_response_with_details(self):
        """Score response with detail items should parse correctly."""
        detail_data = {
            "id": "detail-1",
            "dimension": "key_message",
            "score": 90.0,
            "weight": 30,
            "strengths": '["good delivery"]',
            "weaknesses": '["missed one"]',
            "suggestions": '["practice more"]',
            "created_at": datetime.now(),
        }
        data = {
            "id": "score-2",
            "session_id": "sess-2",
            "overall_score": 78.0,
            "passed": True,
            "feedback_summary": "Needs improvement",
            "details": [detail_data],
            "created_at": datetime.now(),
        }
        score = SessionScoreResponse(**data)
        assert len(score.details) == 1
        assert score.details[0].dimension == "key_message"
        assert score.details[0].weight == 30

    def test_score_response_missing_required_field(self):
        """Missing required fields should raise ValidationError."""
        try:
            SessionScoreResponse(
                id="score-3",
                session_id="sess-3",
                # missing overall_score
                passed=True,
                feedback_summary="Test",
                details=[],
                created_at=datetime.now(),
            )
            assert False, "Should have raised ValidationError"
        except ValidationError:
            pass


class TestScoreDetailResponseSchema:
    """Tests for ScoreDetailResponse Pydantic schema."""

    def test_valid_detail(self):
        detail = ScoreDetailResponse(
            id="d-1",
            dimension="communication",
            score=85.0,
            weight=20,
            strengths='[{"text": "clear", "quote": null}]',
            weaknesses="[]",
            suggestions='["improve pacing"]',
            created_at=datetime.now(),
        )
        assert detail.dimension == "communication"
        assert detail.score == 85.0

    def test_detail_from_attributes_config(self):
        """Verify from_attributes is set for ORM model compatibility."""
        assert ScoreDetailResponse.model_config.get("from_attributes") is True

    def test_score_response_from_attributes_config(self):
        """Verify from_attributes is set for ORM model compatibility."""
        assert SessionScoreResponse.model_config.get("from_attributes") is True


class TestSessionSchemas:
    """Tests for session-related Pydantic schemas."""

    def test_session_create_valid(self):
        req = SessionCreate(scenario_id="sc-1")
        assert req.scenario_id == "sc-1"

    def test_session_create_missing_field(self):
        try:
            SessionCreate()
            assert False, "Should have raised ValidationError"
        except ValidationError:
            pass

    def test_send_message_request_valid(self):
        req = SendMessageRequest(message="Hello doctor")
        assert req.message == "Hello doctor"

    def test_send_message_request_empty(self):
        # Empty string is technically valid for Pydantic str
        req = SendMessageRequest(message="")
        assert req.message == ""

    def test_message_response_valid(self):
        msg = MessageResponse(
            id="msg-1",
            session_id="sess-1",
            role="user",
            content="Hello",
            message_index=0,
            created_at=datetime.now(),
        )
        assert msg.role == "user"
        assert msg.message_index == 0

    def test_session_response_full(self):
        resp = SessionResponse(
            id="sess-1",
            user_id="user-1",
            scenario_id="sc-1",
            status="in_progress",
            started_at=datetime.now(),
            completed_at=None,
            duration_seconds=None,
            key_messages_status="[]",
            overall_score=None,
            passed=None,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert resp.status == "in_progress"
        assert resp.completed_at is None

    def test_session_response_scored(self):
        resp = SessionResponse(
            id="sess-2",
            user_id="user-1",
            scenario_id="sc-1",
            status="scored",
            started_at=datetime.now(),
            completed_at=datetime.now(),
            duration_seconds=300,
            key_messages_status='[{"message":"PFS","delivered":true}]',
            overall_score=85.0,
            passed=True,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert resp.overall_score == 85.0
        assert resp.passed is True
        assert resp.duration_seconds == 300

    def test_message_response_from_attributes(self):
        """Verify from_attributes is set for ORM model compatibility."""
        assert MessageResponse.model_config.get("from_attributes") is True

    def test_session_response_from_attributes(self):
        """Verify from_attributes is set for ORM model compatibility."""
        assert SessionResponse.model_config.get("from_attributes") is True
