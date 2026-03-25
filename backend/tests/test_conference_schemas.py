"""Tests for conference presentation module Pydantic schemas."""

import pytest
from pydantic import ValidationError

from app.schemas.conference import (
    AudienceHcpCreate,
    AudienceHcpResponse,
    ConferenceMessageSend,
    ConferenceSessionCreate,
    ConferenceSubStateUpdate,
    QueuedQuestionResponse,
)


class TestConferenceSessionCreate:
    """Tests for ConferenceSessionCreate schema."""

    def test_valid_create(self):
        """Valid scenario_id creates successfully."""
        schema = ConferenceSessionCreate(scenario_id="scen-123")
        assert schema.scenario_id == "scen-123"

    def test_missing_scenario_id(self):
        """Missing scenario_id raises ValidationError."""
        with pytest.raises(ValidationError):
            ConferenceSessionCreate()  # type: ignore[call-arg]


class TestAudienceHcpCreate:
    """Tests for AudienceHcpCreate schema."""

    def test_defaults(self):
        """Default values: role_in_conference='audience', voice_id='', sort_order=0."""
        schema = AudienceHcpCreate(hcp_profile_id="hcp-1")
        assert schema.hcp_profile_id == "hcp-1"
        assert schema.role_in_conference == "audience"
        assert schema.voice_id == ""
        assert schema.sort_order == 0

    def test_custom_values(self):
        """Custom values override defaults."""
        schema = AudienceHcpCreate(
            hcp_profile_id="hcp-2",
            role_in_conference="moderator",
            voice_id="zh-CN-XiaoxiaoNeural",
            sort_order=3,
        )
        assert schema.role_in_conference == "moderator"
        assert schema.voice_id == "zh-CN-XiaoxiaoNeural"
        assert schema.sort_order == 3

    def test_missing_hcp_profile_id(self):
        """Missing hcp_profile_id raises ValidationError."""
        with pytest.raises(ValidationError):
            AudienceHcpCreate()  # type: ignore[call-arg]


class TestConferenceSubStateUpdate:
    """Tests for ConferenceSubStateUpdate schema with regex validation."""

    def test_presenting_valid(self):
        """'presenting' is a valid sub_state."""
        schema = ConferenceSubStateUpdate(sub_state="presenting")
        assert schema.sub_state == "presenting"

    def test_qa_valid(self):
        """'qa' is a valid sub_state."""
        schema = ConferenceSubStateUpdate(sub_state="qa")
        assert schema.sub_state == "qa"

    def test_invalid_sub_state(self):
        """Invalid sub_state values raise ValidationError."""
        with pytest.raises(ValidationError):
            ConferenceSubStateUpdate(sub_state="scoring")

    def test_empty_sub_state(self):
        """Empty sub_state raises ValidationError."""
        with pytest.raises(ValidationError):
            ConferenceSubStateUpdate(sub_state="")


class TestConferenceMessageSend:
    """Tests for ConferenceMessageSend schema."""

    def test_defaults(self):
        """target_hcp_id defaults to None."""
        schema = ConferenceMessageSend(action="present", message="Hello doctors")
        assert schema.action == "present"
        assert schema.message == "Hello doctors"
        assert schema.target_hcp_id is None

    def test_with_target_hcp(self):
        """target_hcp_id can be set for respond action."""
        schema = ConferenceMessageSend(
            action="respond",
            message="Let me address that concern",
            target_hcp_id="hcp-42",
        )
        assert schema.target_hcp_id == "hcp-42"

    def test_missing_message(self):
        """Missing message raises ValidationError."""
        with pytest.raises(ValidationError):
            ConferenceMessageSend(action="present")  # type: ignore[call-arg]


class TestQueuedQuestionResponse:
    """Tests for QueuedQuestionResponse schema."""

    def test_all_fields_present(self):
        """All fields are present and correctly typed."""
        schema = QueuedQuestionResponse(
            hcp_profile_id="hcp-1",
            hcp_name="Dr. Wang",
            question="What about side effects?",
            relevance_score=0.85,
            status="waiting",
        )
        assert schema.hcp_profile_id == "hcp-1"
        assert schema.hcp_name == "Dr. Wang"
        assert schema.question == "What about side effects?"
        assert schema.relevance_score == 0.85
        assert schema.status == "waiting"

    def test_missing_field_raises(self):
        """Missing required fields raise ValidationError."""
        with pytest.raises(ValidationError):
            QueuedQuestionResponse(
                hcp_profile_id="hcp-1",
                hcp_name="Dr. Wang",
                # missing question, relevance_score, status
            )  # type: ignore[call-arg]


class TestAudienceHcpResponse:
    """Tests for AudienceHcpResponse schema."""

    def test_from_attributes_config(self):
        """ConfigDict(from_attributes=True) is set for ORM compatibility."""
        assert AudienceHcpResponse.model_config.get("from_attributes") is True

    def test_all_fields(self):
        """All response fields are populated correctly."""
        schema = AudienceHcpResponse(
            id="ah-1",
            scenario_id="scen-1",
            hcp_profile_id="hcp-1",
            role_in_conference="audience",
            voice_id="zh-CN-XiaoxiaoNeural",
            sort_order=0,
            hcp_name="Dr. Wang",
            hcp_specialty="Oncology",
        )
        assert schema.id == "ah-1"
        assert schema.hcp_name == "Dr. Wang"
        assert schema.hcp_specialty == "Oncology"

    def test_defaults_for_name_and_specialty(self):
        """hcp_name and hcp_specialty default to empty string."""
        schema = AudienceHcpResponse(
            id="ah-1",
            scenario_id="scen-1",
            hcp_profile_id="hcp-1",
            role_in_conference="audience",
            voice_id="",
            sort_order=0,
        )
        assert schema.hcp_name == ""
        assert schema.hcp_specialty == ""
