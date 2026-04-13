"""Tests for validation scripts (Creator + Evaluator output validators)."""

import importlib.util
from pathlib import Path

import pytest

from app.services.meta_skill_service import get_validation_script_path


def _load_validator(skill_type: str):
    """Dynamically load the validation module for a skill type."""
    path = get_validation_script_path(skill_type)
    assert path is not None and path.exists(), f"No script for {skill_type}"
    spec = importlib.util.spec_from_file_location(f"validate_{skill_type}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------------------
# Creator validation script tests
# ---------------------------------------------------------------------------


class TestCreatorValidationScript:
    """Tests for validate_creator_output.py."""

    @pytest.fixture(autouse=True)
    def _load(self):
        self.mod = _load_validator("creator")

    def test_script_compiles(self):
        """Script loads and has a validate function."""
        assert hasattr(self.mod, "validate")
        assert callable(self.mod.validate)

    def test_valid_input_passes(self):
        """A well-formed creator output passes validation."""
        data = {
            "name": "test-skill",
            "description": "A test skill",
            "product": "TestProd",
            "therapeutic_area": "Oncology",
            "sop_steps": [
                {
                    "title": f"Step {i}",
                    "description": f"Desc {i}",
                    "key_points": ["point"],
                    "assessment_criteria": ["criteria"],
                }
                for i in range(5)
            ],
            "modules": [
                {"title": f"Module {i}", "objectives": ["obj"], "content": "content"}
                for i in range(3)
            ],
            "scoring": {"pass_threshold": 70, "weights": {}},
            "summary": "A test summary of sufficient length.",
        }
        result = self.mod.validate(data)
        assert result["valid"] is True
        assert result["errors"] == []

    def test_missing_required_fields(self):
        """Empty dict fails on missing fields."""
        result = self.mod.validate({})
        assert result["valid"] is False
        assert len(result["errors"]) > 0
        assert any("Missing required field" in e for e in result["errors"])

    def test_invalid_name_format(self):
        """Name with spaces/special chars fails."""
        data = {"name": "Invalid Name With Spaces!"}
        result = self.mod.validate(data)
        assert result["valid"] is False
        assert any("name" in e.lower() for e in result["errors"])

    def test_empty_input_fails(self):
        """Completely empty input still returns structured result."""
        result = self.mod.validate({})
        assert isinstance(result, dict)
        assert "valid" in result
        assert "errors" in result

    def test_too_few_sop_steps(self):
        """Fewer than 5 SOP steps triggers error."""
        data = {
            "name": "ok-name",
            "description": "desc",
            "product": "prod",
            "therapeutic_area": "area",
            "sop_steps": [{"title": "S1", "description": "D", "key_points": [], "assessment_criteria": []}],
            "modules": [{"title": "M1", "objectives": ["o"], "content": "c"}] * 3,
            "scoring": {"pass_threshold": 70},
            "summary": "Summary text here.",
        }
        result = self.mod.validate(data)
        assert any("sop_steps" in e.lower() or "step" in e.lower() for e in result["errors"])


# ---------------------------------------------------------------------------
# Evaluator validation script tests
# ---------------------------------------------------------------------------


class TestEvaluatorValidationScript:
    """Tests for validate_evaluation_output.py."""

    @pytest.fixture(autouse=True)
    def _load(self):
        self.mod = _load_validator("evaluator")

    def test_script_compiles(self):
        """Script loads and has a validate function."""
        assert hasattr(self.mod, "validate")
        assert callable(self.mod.validate)

    def test_valid_input_passes(self):
        """A well-formed evaluator output passes validation."""
        dimensions = [
            {
                "name": name,
                "score": 75,
                "verdict": "PASS",
                "strengths": ["good"],
                "improvements": ["better"],
                "critical_issues": [],
                "rationale": "Reasonable quality.",
            }
            for name in [
                "sop_completeness",
                "assessment_coverage",
                "knowledge_accuracy",
                "difficulty_calibration",
                "conversation_logic",
                "executability",
            ]
        ]
        data = {
            "overall_score": 75,
            "overall_verdict": "PASS",
            "dimensions": dimensions,
            "summary": "Overall good skill quality.",
            "top_3_improvements": ["improve A", "improve B"],
        }
        result = self.mod.validate(data)
        assert result["valid"] is True
        assert result["errors"] == []

    def test_missing_required_fields(self):
        """Empty dict fails on missing fields."""
        result = self.mod.validate({})
        assert result["valid"] is False
        assert len(result["errors"]) > 0

    def test_wrong_dimension_count(self):
        """Dimensions list with != 6 items triggers error."""
        data = {
            "overall_score": 50,
            "overall_verdict": "NEEDS_REVIEW",
            "dimensions": [{"name": "sop_completeness", "score": 50, "verdict": "NEEDS_REVIEW"}],
            "summary": "Incomplete evaluation.",
            "top_3_improvements": ["fix"],
        }
        result = self.mod.validate(data)
        assert any("dimensions" in e.lower() for e in result["errors"])

    def test_score_out_of_range(self):
        """Score > 100 triggers error."""
        data = {
            "overall_score": 150,
            "overall_verdict": "PASS",
            "dimensions": [],
            "summary": "Bad score.",
            "top_3_improvements": [],
        }
        result = self.mod.validate(data)
        assert result["valid"] is False
        assert any("score" in e.lower() or "range" in e.lower() for e in result["errors"])

    def test_invalid_verdict(self):
        """Invalid verdict string triggers error."""
        data = {
            "overall_score": 80,
            "overall_verdict": "EXCELLENT",
            "dimensions": [],
            "summary": "Invalid verdict.",
            "top_3_improvements": [],
        }
        result = self.mod.validate(data)
        assert result["valid"] is False
        assert any("verdict" in e.lower() for e in result["errors"])

    def test_empty_input_fails(self):
        """Empty input returns structured result."""
        result = self.mod.validate({})
        assert isinstance(result, dict)
        assert "valid" in result
        assert "errors" in result
