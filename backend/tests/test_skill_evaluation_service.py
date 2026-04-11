"""L2 evaluation staleness detection tests."""

import json
from unittest.mock import MagicMock

from app.services.skill_evaluation_service import is_evaluation_stale
from app.services.skill_validation_service import _compute_content_hash


def _make_skill_with_quality(content: str, evaluated_content: str | None = None) -> MagicMock:
    """Create a mock Skill with quality_details containing a content_hash.

    If evaluated_content is None, uses the same content for the stored hash.
    """
    skill = MagicMock()
    skill.content = content

    if evaluated_content is not None:
        stored_hash = _compute_content_hash(evaluated_content)
    else:
        stored_hash = _compute_content_hash(content)

    skill.quality_details = json.dumps({"content_hash": stored_hash})
    return skill


class TestEvaluationStaleness:
    """Test content hash-based staleness detection."""

    def test_is_evaluation_stale_no_change(self):
        """Same content -> not stale."""
        skill = _make_skill_with_quality("My SOP content v1")
        assert is_evaluation_stale(skill) is False

    def test_is_evaluation_stale_detects_change(self):
        """Content changed since evaluation -> stale."""
        skill = _make_skill_with_quality("My SOP content v2", evaluated_content="My SOP content v1")
        assert is_evaluation_stale(skill) is True

    def test_is_evaluation_stale_no_details(self):
        """No quality_details -> stale (never evaluated)."""
        skill = MagicMock()
        skill.content = "Some content"
        skill.quality_details = "{}"
        assert is_evaluation_stale(skill) is True

    def test_is_evaluation_stale_invalid_json(self):
        """Invalid JSON in quality_details -> stale."""
        skill = MagicMock()
        skill.content = "Some content"
        skill.quality_details = "not-json"
        assert is_evaluation_stale(skill) is True

    def test_is_evaluation_stale_empty_hash(self):
        """Empty content_hash in details -> stale."""
        skill = MagicMock()
        skill.content = "Some content"
        skill.quality_details = json.dumps({"content_hash": ""})
        assert is_evaluation_stale(skill) is True
