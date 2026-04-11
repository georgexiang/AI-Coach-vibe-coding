"""L1 structure validation service tests."""

from unittest.mock import MagicMock

from app.services.skill_validation_service import (
    MIN_ASSESSMENT_ITEMS,
    MIN_SOP_STEPS,
    StructureCheckResult,
    _compute_content_hash,
    check_skill_structure,
)


def _make_mock_skill(
    name: str = "Test Skill",
    description: str = "A detailed test skill for validation",
    content: str = "",
) -> MagicMock:
    """Create a mock Skill object for validation testing."""
    skill = MagicMock()
    skill.name = name
    skill.description = description
    skill.content = content
    return skill


WELL_FORMED_CONTENT = """
# Sales Coaching SOP

## Opening
Welcome the HCP and introduce yourself.

## Step 1: Product Introduction
Introduce the product and key benefits.

## Step 2: Clinical Data Discussion
Present clinical trial data and efficacy results.

## Step 3: Closing and Next Steps
Summarize the discussion and schedule follow-up.

## Product
Key product information and positioning.

## Closing
Thank the HCP and confirm next steps.

## Assessment
- Criterion 1: Communication clarity
- Criterion 2: Product knowledge accuracy
- Criterion 3: Objection handling

## Knowledge
- Key product mechanism of action
- Clinical trial results
- Safety profile
"""


class TestStructureCheckPasses:
    """Test that well-formed content passes L1 validation."""

    async def test_structure_check_passes_well_formed(self):
        skill = _make_mock_skill(content=WELL_FORMED_CONTENT)
        result = await check_skill_structure(skill)

        assert isinstance(result, StructureCheckResult)
        assert result.passed is True
        assert result.score >= 70

    async def test_structure_check_has_content_hash(self):
        skill = _make_mock_skill(content=WELL_FORMED_CONTENT)
        result = await check_skill_structure(skill)

        assert result.content_hash != ""
        assert len(result.content_hash) == 16  # SHA256[:16]


class TestStructureCheckFails:
    """Test that poorly-formed content fails L1 validation."""

    async def test_structure_check_fails_no_steps(self):
        skill = _make_mock_skill(content="Hello world. This is minimal content.")
        result = await check_skill_structure(skill)

        assert result.passed is False
        error_messages = [i.message for i in result.issues if i.severity == "error"]
        assert any("step" in m.lower() for m in error_messages)

    async def test_structure_check_fails_short_content(self):
        skill = _make_mock_skill(content="Too short")
        result = await check_skill_structure(skill)

        assert result.passed is False
        assert any(i.dimension == "basic_info" for i in result.issues)

    async def test_structure_check_fails_no_assessment(self):
        content = """
## Step 1: Opening
Greet HCP.

## Step 2: Discussion
Discuss product.

## Step 3: Closing
Thank HCP.

## Knowledge
- Product info
"""
        skill = _make_mock_skill(content=content)
        result = await check_skill_structure(skill)

        # Should have an error about missing assessment
        assert any(i.dimension == "assessment_coverage" for i in result.issues)


class TestContentHash:
    """Test content hash computation for staleness detection."""

    def test_content_hash_is_stable(self):
        hash1 = _compute_content_hash("test content")
        hash2 = _compute_content_hash("test content")
        assert hash1 == hash2

    def test_content_hash_changes_with_content(self):
        hash1 = _compute_content_hash("version 1")
        hash2 = _compute_content_hash("version 2")
        assert hash1 != hash2

    def test_content_hash_length(self):
        h = _compute_content_hash("any content")
        assert len(h) == 16  # SHA256 truncated to 16 hex chars


class TestConfigurableThresholds:
    """Test that L1 thresholds are accessible and configurable."""

    def test_min_sop_steps_is_accessible(self):
        assert MIN_SOP_STEPS == 3

    def test_min_assessment_items_is_accessible(self):
        assert MIN_ASSESSMENT_ITEMS == 2
