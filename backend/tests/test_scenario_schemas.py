"""Tests for Scenario Pydantic schemas: validation, defaults, and serialization."""

import pytest
from pydantic import ValidationError

from app.schemas.scenario import ScenarioCreate, ScenarioResponse, ScenarioUpdate


class TestScenarioCreate:
    """Tests for ScenarioCreate schema validation."""

    def test_requires_name(self):
        with pytest.raises(ValidationError):
            ScenarioCreate(
                hcp_profile_id="hcp-1",
                rubric_id="rubric-1",
                skill_id="skill-1",
            )

    def test_requires_hcp_profile_id(self):
        with pytest.raises(ValidationError):
            ScenarioCreate(
                name="S",
                rubric_id="rubric-1",
                skill_id="skill-1",
            )

    def test_requires_rubric_id(self):
        with pytest.raises(ValidationError):
            ScenarioCreate(
                name="S",
                hcp_profile_id="hcp-1",
                skill_id="skill-1",
            )

    def test_requires_skill_id(self):
        with pytest.raises(ValidationError):
            ScenarioCreate(
                name="S",
                hcp_profile_id="hcp-1",
                rubric_id="rubric-1",
            )

    def test_minimal_valid_create(self):
        data = ScenarioCreate(
            name="Test",
            hcp_profile_id="hcp-1",
            rubric_id="rubric-1",
            skill_id="skill-1",
        )
        assert data.name == "Test"
        assert data.skill_id == "skill-1"
        assert data.tags == []
        assert data.key_messages == []
        assert data.mode == "f2f"
        assert data.difficulty == "medium"
        assert data.pass_threshold == 70
        assert data.description == ""

    def test_full_create(self):
        data = ScenarioCreate(
            name="Full",
            hcp_profile_id="hcp-1",
            rubric_id="rubric-1",
            skill_id="skill-1",
            description="A full scenario",
            tags=["product:Drug", "area:Oncology"],
            mode="conference",
            difficulty="hard",
            key_messages=["KM1", "KM2"],
            pass_threshold=80,
        )
        assert data.tags == ["product:Drug", "area:Oncology"]
        assert data.mode == "conference"
        assert data.difficulty == "hard"
        assert data.pass_threshold == 80

    def test_no_product_field(self):
        """ScenarioCreate should NOT have product field."""
        data = ScenarioCreate(
            name="S",
            hcp_profile_id="hcp-1",
            rubric_id="rubric-1",
            skill_id="skill-1",
        )
        assert not hasattr(data, "product")

    def test_no_status_field(self):
        """ScenarioCreate should NOT have status field."""
        data = ScenarioCreate(
            name="S",
            hcp_profile_id="hcp-1",
            rubric_id="rubric-1",
            skill_id="skill-1",
        )
        # status should not be a field in the schema
        assert "status" not in data.model_fields


class TestScenarioUpdate:
    """Tests for ScenarioUpdate schema validation."""

    def test_all_fields_optional(self):
        data = ScenarioUpdate()
        assert data.name is None
        assert data.tags is None
        assert data.skill_id is None

    def test_partial_update(self):
        data = ScenarioUpdate(name="New", tags=["tag1"])
        assert data.name == "New"
        assert data.tags == ["tag1"]
        assert data.mode is None

    def test_no_status_field(self):
        """ScenarioUpdate should NOT have status field (transitions via API only)."""
        assert "status" not in ScenarioUpdate.model_fields

    def test_no_product_field(self):
        """ScenarioUpdate should NOT have product field."""
        assert "product" not in ScenarioUpdate.model_fields

    def test_exclude_unset(self):
        data = ScenarioUpdate(name="X")
        dumped = data.model_dump(exclude_unset=True)
        assert dumped == {"name": "X"}


class TestScenarioResponse:
    """Tests for ScenarioResponse schema serialization."""

    def test_from_attributes(self):
        """Verify from_attributes is configured for ORM model mapping."""
        assert ScenarioResponse.model_config.get("from_attributes") is True

    def test_required_fields(self):
        """Verify required fields in response."""
        fields = ScenarioResponse.model_fields
        assert "id" in fields
        assert "name" in fields
        assert "tags" in fields
        assert "skill_id" in fields
        assert "status" in fields

    def test_no_product_field(self):
        """ScenarioResponse should NOT have product field."""
        assert "product" not in ScenarioResponse.model_fields

    def test_skill_id_not_optional(self):
        """skill_id should be required (str, not Optional)."""
        field = ScenarioResponse.model_fields["skill_id"]
        # The annotation should be str, not str | None
        assert field.annotation is str

    def test_skill_version_id_optional(self):
        """skill_version_id should be optional."""
        field = ScenarioResponse.model_fields["skill_version_id"]
        # Should have a default of None
        assert field.default is None
