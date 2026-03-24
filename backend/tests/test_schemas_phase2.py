"""Tests for Phase 2 Pydantic schemas: validation rules and serialization."""

from datetime import datetime

import pytest
from pydantic import ValidationError

from app.schemas.hcp_profile import HcpProfileCreate, HcpProfileResponse, HcpProfileUpdate
from app.schemas.scenario import ScenarioCreate, ScenarioResponse, ScenarioUpdate
from app.schemas.score import ScoreDetailResponse, SessionScoreResponse
from app.schemas.session import MessageResponse, SendMessageRequest, SessionCreate, SessionResponse


class TestScenarioCreateSchema:
    """Tests for ScenarioCreate validation, especially validate_weights_sum."""

    async def test_valid_default_weights(self):
        data = ScenarioCreate(
            name="Test",
            product="Drug",
            hcp_profile_id="p1",
            created_by="u1",
        )
        assert data.weight_key_message == 30
        assert data.weight_objection_handling == 25
        assert data.weight_communication == 20
        assert data.weight_product_knowledge == 15
        assert data.weight_scientific_info == 10

    async def test_custom_weights_summing_to_100(self):
        data = ScenarioCreate(
            name="Test",
            product="Drug",
            hcp_profile_id="p1",
            created_by="u1",
            weight_key_message=40,
            weight_objection_handling=20,
            weight_communication=20,
            weight_product_knowledge=10,
            weight_scientific_info=10,
        )
        assert data.weight_key_message == 40

    async def test_weights_not_summing_to_100_raises(self):
        with pytest.raises(ValidationError) as exc_info:
            ScenarioCreate(
                name="Test",
                product="Drug",
                hcp_profile_id="p1",
                created_by="u1",
                weight_key_message=50,
                weight_objection_handling=50,
                weight_communication=50,
                weight_product_knowledge=50,
                weight_scientific_info=50,
            )
        assert "Scoring weights must sum to 100" in str(exc_info.value)

    async def test_default_mode_and_status(self):
        data = ScenarioCreate(
            name="Test",
            product="Drug",
            hcp_profile_id="p1",
            created_by="u1",
        )
        assert data.mode == "f2f"
        assert data.status == "draft"
        assert data.difficulty == "medium"
        assert data.pass_threshold == 70


class TestScenarioUpdateSchema:
    """Tests for ScenarioUpdate validation with optional weights."""

    async def test_partial_update_no_weights(self):
        data = ScenarioUpdate(name="New Name")
        assert data.name == "New Name"
        assert data.weight_key_message is None

    async def test_all_weights_summing_to_100_passes(self):
        data = ScenarioUpdate(
            weight_key_message=40,
            weight_objection_handling=20,
            weight_communication=20,
            weight_product_knowledge=10,
            weight_scientific_info=10,
        )
        assert data.weight_key_message == 40

    async def test_all_weights_not_summing_to_100_raises(self):
        with pytest.raises(ValidationError) as exc_info:
            ScenarioUpdate(
                weight_key_message=50,
                weight_objection_handling=50,
                weight_communication=50,
                weight_product_knowledge=50,
                weight_scientific_info=50,
            )
        assert "Scoring weights must sum to 100" in str(exc_info.value)

    async def test_partial_weights_skips_validation(self):
        # When not all weights are provided, validation is skipped
        data = ScenarioUpdate(
            weight_key_message=50,
        )
        assert data.weight_key_message == 50
        # No error because not all weights are set


class TestScenarioResponseSchema:
    """Tests for ScenarioResponse from_attributes."""

    async def test_from_attributes(self):
        resp = ScenarioResponse(
            id="s1",
            name="Test",
            description="Desc",
            product="Drug",
            therapeutic_area="Onc",
            mode="f2f",
            difficulty="medium",
            status="active",
            hcp_profile_id="p1",
            key_messages='["KM1"]',
            weight_key_message=30,
            weight_objection_handling=25,
            weight_communication=20,
            weight_product_knowledge=15,
            weight_scientific_info=10,
            pass_threshold=70,
            created_by="u1",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert resp.id == "s1"
        assert resp.key_messages == '["KM1"]'


class TestHcpProfileSchemas:
    """Tests for HCP profile schemas."""

    async def test_create_with_defaults(self):
        data = HcpProfileCreate(
            name="Dr. Zhang",
            specialty="Oncology",
            created_by="u1",
        )
        assert data.personality_type == "friendly"
        assert data.emotional_state == 50
        assert data.communication_style == 50
        assert data.is_active is True
        assert data.expertise_areas == []
        assert data.objections == []

    async def test_create_with_all_fields(self):
        data = HcpProfileCreate(
            name="Dr. Li",
            specialty="Cardiology",
            created_by="u1",
            hospital="Beijing Hospital",
            title="Chief Physician",
            personality_type="skeptical",
            emotional_state=80,
            communication_style=30,
            expertise_areas=["intervention", "imaging"],
            objections=["Cost", "Safety"],
            probe_topics=["Outcomes"],
            difficulty="hard",
        )
        assert data.emotional_state == 80
        assert data.expertise_areas == ["intervention", "imaging"]

    async def test_update_partial(self):
        data = HcpProfileUpdate(name="Dr. New Name")
        assert data.name == "Dr. New Name"
        assert data.specialty is None

    async def test_response_from_attributes(self):
        resp = HcpProfileResponse(
            id="p1",
            name="Dr. X",
            specialty="Neuro",
            hospital="H",
            title="T",
            avatar_url="",
            personality_type="friendly",
            emotional_state=50,
            communication_style=50,
            expertise_areas="[]",
            prescribing_habits="",
            concerns="",
            objections="[]",
            probe_topics="[]",
            difficulty="medium",
            is_active=True,
            created_by="u1",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert resp.id == "p1"


class TestSessionSchemas:
    """Tests for session-related schemas."""

    async def test_session_create(self):
        data = SessionCreate(scenario_id="s1")
        assert data.scenario_id == "s1"

    async def test_send_message_request(self):
        data = SendMessageRequest(message="Hello doctor")
        assert data.message == "Hello doctor"

    async def test_message_response(self):
        resp = MessageResponse(
            id="m1",
            session_id="s1",
            role="user",
            content="Hello",
            message_index=0,
            created_at=datetime.now(),
        )
        assert resp.role == "user"

    async def test_session_response_optional_fields(self):
        resp = SessionResponse(
            id="s1",
            user_id="u1",
            scenario_id="sc1",
            status="created",
            started_at=None,
            completed_at=None,
            duration_seconds=None,
            key_messages_status="[]",
            overall_score=None,
            passed=None,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert resp.started_at is None
        assert resp.overall_score is None


class TestScoreSchemas:
    """Tests for score-related schemas."""

    async def test_score_detail_response(self):
        resp = ScoreDetailResponse(
            id="d1",
            dimension="key_message",
            score=85.0,
            weight=30,
            strengths='[{"text": "Good", "quote": null}]',
            weaknesses='[]',
            suggestions='["Improve"]',
            created_at=datetime.now(),
        )
        assert resp.dimension == "key_message"
        assert resp.score == 85.0

    async def test_session_score_response(self):
        resp = SessionScoreResponse(
            id="sc1",
            session_id="s1",
            overall_score=78.5,
            passed=True,
            feedback_summary="Good performance",
            details=[],
            created_at=datetime.now(),
        )
        assert resp.overall_score == 78.5
        assert resp.passed is True
        assert resp.details == []
