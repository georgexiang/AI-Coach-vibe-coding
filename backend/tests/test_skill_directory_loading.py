"""Tests for skill directory loading (SKILL.md + references/ composition)."""

import pytest

from app.services.meta_skill_service import (
    _load_default_template,
    _load_skill_directory,
    _parse_skill_md,
    get_validation_script_path,
)


class TestLoadCreatorDirectory:
    """Tests for loading the skill-creator directory."""

    def test_load_creator_directory_en(self):
        """Creator directory loads in English with frontmatter name and references."""
        result = _load_skill_directory("creator", "en")
        assert result != ""
        assert "== Skill: skill-creator ==" in result
        assert "Reference Materials" in result

    def test_load_creator_directory_contains_sop_guide(self):
        """Creator references include the SOP structure guide."""
        result = _load_skill_directory("creator", "en")
        assert "sop-structure-guide.md" in result
        assert "Opening" in result  # SOP stage name

    def test_load_creator_directory_contains_output_schema(self):
        """Creator references include the output schema."""
        result = _load_skill_directory("creator", "en")
        assert "output-schema.json" in result

    def test_load_creator_directory_contains_scoring_rubric(self):
        """Creator references include the scoring rubric."""
        result = _load_skill_directory("creator", "en")
        assert "scoring-rubric.md" in result


class TestLoadEvaluatorDirectory:
    """Tests for loading the skill-evaluator directory."""

    def test_load_evaluator_directory_en(self):
        """Evaluator directory loads in English with frontmatter name."""
        result = _load_skill_directory("evaluator", "en")
        assert result != ""
        assert "== Skill: skill-evaluator ==" in result

    def test_load_evaluator_directory_contains_dimensions(self):
        """Evaluator references include the evaluation dimensions."""
        result = _load_skill_directory("evaluator", "en")
        assert "evaluation-dimensions.md" in result
        assert "sop_completeness" in result
        assert "knowledge_accuracy" in result

    def test_load_evaluator_directory_contains_quality_standards(self):
        """Evaluator references include quality standards."""
        result = _load_skill_directory("evaluator", "en")
        assert "quality-standards.md" in result
        assert "PASS" in result
        assert "NEEDS_REVIEW" in result

    def test_load_evaluator_directory_contains_output_schema(self):
        """Evaluator references include the output schema."""
        result = _load_skill_directory("evaluator", "en")
        assert "output-schema.json" in result


class TestLoadZhVersion:
    """Tests for Chinese language fallback."""

    def test_load_creator_zh_uses_chinese_skill(self):
        """Chinese version loads SKILL_zh.md when available."""
        result = _load_skill_directory("creator", "zh")
        assert result != ""
        # Chinese SKILL.md should contain Chinese text
        assert "技能" in result or "skill-creator" in result.lower()

    def test_load_evaluator_zh_uses_chinese_skill(self):
        """Chinese evaluator loads SKILL_zh.md."""
        result = _load_skill_directory("evaluator", "zh")
        assert result != ""
        assert "评估" in result or "skill-evaluator" in result.lower()


class TestEdgeCases:
    """Edge cases for skill directory loading."""

    def test_unknown_type_returns_empty(self):
        """Unknown skill type returns empty string."""
        result = _load_skill_directory("nonexistent", "en")
        assert result == ""

    def test_composed_instructions_contain_reference_header(self):
        """Composed instructions contain the Reference Materials section header."""
        result = _load_skill_directory("creator", "en")
        assert "== Reference Materials ==" in result

    def test_token_estimate_reasonable(self):
        """Composed instructions are within a reasonable token range."""
        for skill_type in ("creator", "evaluator"):
            result = _load_skill_directory(skill_type, "en")
            token_estimate = len(result) // 4
            assert token_estimate > 100, f"{skill_type} instructions too small"
            assert token_estimate < 30000, f"{skill_type} instructions too large"


class TestParseSkillMd:
    """Tests for YAML frontmatter parsing."""

    def test_parse_with_frontmatter(self, tmp_path):
        """Parses YAML frontmatter correctly."""
        md = tmp_path / "SKILL.md"
        md.write_text("---\nname: test-skill\ndescription: A test\n---\nBody content here.")
        name, desc, body = _parse_skill_md(md)
        assert name == "test-skill"
        assert desc == "A test"
        assert body == "Body content here."

    def test_parse_without_frontmatter(self, tmp_path):
        """File without frontmatter returns empty name/desc and full body."""
        md = tmp_path / "SKILL.md"
        md.write_text("Just plain body content.")
        name, desc, body = _parse_skill_md(md)
        assert name == ""
        assert desc == ""
        assert body == "Just plain body content."


class TestGetValidationScriptPath:
    """Tests for get_validation_script_path."""

    def test_creator_script_exists(self):
        """Creator validation script path is returned."""
        path = get_validation_script_path("creator")
        assert path is not None
        assert path.exists()
        assert path.name == "validate_creator_output.py"

    def test_evaluator_script_exists(self):
        """Evaluator validation script path is returned."""
        path = get_validation_script_path("evaluator")
        assert path is not None
        assert path.exists()
        assert path.name == "validate_evaluator_output.py"

    def test_unknown_type_returns_none(self):
        """Unknown type returns None."""
        assert get_validation_script_path("nonexistent") is None


class TestLoadDefaultTemplate:
    """Tests for _load_default_template (skill dir → flat file fallback)."""

    def test_creator_loads_via_directory(self):
        """Creator uses skill directory (not flat file)."""
        result = _load_default_template("creator", "en")
        assert "== Skill: skill-creator ==" in result
        assert "Reference Materials" in result

    def test_evaluator_loads_via_directory(self):
        """Evaluator uses skill directory (not flat file)."""
        result = _load_default_template("evaluator", "en")
        assert "== Skill: skill-evaluator ==" in result
