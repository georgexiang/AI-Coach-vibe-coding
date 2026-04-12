"""L2 evaluation service tests — staleness, verdict, parsing, OpenAI call, full flow."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.skill import Skill, SkillResource
from app.models.user import User
from app.services.auth import get_password_hash
from app.services.skill_evaluation_service import (
    EVALUATION_DIMENSIONS,
    SkillEvaluationResult,
    _AICallResult,
    _call_openai_for_evaluation,
    _compute_verdict,
    _parse_evaluation_result,
    evaluate_skill_quality,
    is_evaluation_stale,
)
from app.services.skill_validation_service import _compute_content_hash
from tests.conftest import TestSessionLocal


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


# ---------------------------------------------------------------------------
# _compute_verdict tests
# ---------------------------------------------------------------------------


class TestComputeVerdict:
    """Test verdict thresholds: PASS >= 70, NEEDS_REVIEW 50-69, FAIL < 50."""

    def test_score_100_pass(self):
        assert _compute_verdict(100) == "PASS"

    def test_score_70_pass(self):
        assert _compute_verdict(70) == "PASS"

    def test_score_85_pass(self):
        assert _compute_verdict(85) == "PASS"

    def test_score_69_needs_review(self):
        assert _compute_verdict(69) == "NEEDS_REVIEW"

    def test_score_50_needs_review(self):
        assert _compute_verdict(50) == "NEEDS_REVIEW"

    def test_score_55_needs_review(self):
        assert _compute_verdict(55) == "NEEDS_REVIEW"

    def test_score_49_fail(self):
        assert _compute_verdict(49) == "FAIL"

    def test_score_0_fail(self):
        assert _compute_verdict(0) == "FAIL"

    def test_score_1_fail(self):
        assert _compute_verdict(1) == "FAIL"


# ---------------------------------------------------------------------------
# _parse_evaluation_result tests
# ---------------------------------------------------------------------------


def _make_full_ai_response(scores: dict[str, int] | None = None) -> dict:
    """Build a valid AI response dict with all 6 dimensions."""
    if scores is None:
        scores = {dim: 75 for dim in EVALUATION_DIMENSIONS}
    dims = []
    for dim_name in EVALUATION_DIMENSIONS:
        dims.append(
            {
                "name": dim_name,
                "score": scores.get(dim_name, 75),
                "strengths": [f"{dim_name} is good"],
                "improvements": [f"improve {dim_name}"],
                "critical_issues": [],
                "rationale": f"Rationale for {dim_name}",
            }
        )
    avg = round(sum(scores.get(d, 75) for d in EVALUATION_DIMENSIONS) / 6)
    return {
        "overall_score": avg,
        "overall_verdict": _compute_verdict(avg),
        "dimensions": dims,
        "summary": "Overall good skill.",
        "top_3_improvements": ["improve A", "improve B", "improve C"],
    }


class TestParseEvaluationResult:
    """Test _parse_evaluation_result with various AI response shapes."""

    def test_valid_full_response(self):
        """All 6 dimensions present with valid scores."""
        ai_result = _make_full_ai_response()
        result = _parse_evaluation_result(ai_result, "hash123", "2025-01-01T00:00:00")

        assert isinstance(result, SkillEvaluationResult)
        assert result.overall_score == 75
        assert result.overall_verdict == "PASS"
        assert len(result.dimensions) == 6
        assert result.content_hash == "hash123"
        assert result.evaluated_at == "2025-01-01T00:00:00"
        assert result.summary == "Overall good skill."
        assert result.top_improvements == ["improve A", "improve B", "improve C"]

        for dim in result.dimensions:
            assert dim.score == 75
            assert dim.verdict == "PASS"
            assert len(dim.strengths) == 1
            assert len(dim.improvements) == 1
            assert dim.critical_issues == []
            assert dim.rationale != ""

    def test_missing_some_dimensions(self):
        """AI response missing 3 dimensions -> those get score=0, verdict=FAIL."""
        partial_dims = [
            {"name": "sop_completeness", "score": 80, "rationale": "Good"},
            {"name": "assessment_coverage", "score": 70, "rationale": "OK"},
            {"name": "knowledge_accuracy", "score": 60, "rationale": "Acceptable"},
        ]
        ai_result = {
            "dimensions": partial_dims,
            "summary": "Partial evaluation.",
            "top_3_improvements": [],
        }
        result = _parse_evaluation_result(ai_result, "hash_partial", "2025-01-02T00:00:00")

        assert len(result.dimensions) == 6
        # Present dimensions have their scores
        dim_map = {d.name: d for d in result.dimensions}
        assert dim_map["sop_completeness"].score == 80
        assert dim_map["sop_completeness"].verdict == "PASS"
        assert dim_map["assessment_coverage"].score == 70
        assert dim_map["assessment_coverage"].verdict == "PASS"
        assert dim_map["knowledge_accuracy"].score == 60
        assert dim_map["knowledge_accuracy"].verdict == "NEEDS_REVIEW"

        # Missing dimensions get score=0 and FAIL
        assert dim_map["difficulty_calibration"].score == 0
        assert dim_map["difficulty_calibration"].verdict == "FAIL"
        assert dim_map["conversation_logic"].score == 0
        assert dim_map["executability"].score == 0

        # Overall average: (80 + 70 + 60 + 0 + 0 + 0) / 6 = 35
        assert result.overall_score == 35
        assert result.overall_verdict == "FAIL"

    def test_out_of_range_scores_clamped(self):
        """Scores outside 0-100 are clamped."""
        ai_result = {
            "dimensions": [
                {"name": "sop_completeness", "score": 150},
                {"name": "assessment_coverage", "score": -20},
                {"name": "knowledge_accuracy", "score": 200},
                {"name": "difficulty_calibration", "score": -50},
                {"name": "conversation_logic", "score": 75},
                {"name": "executability", "score": 100},
            ],
            "summary": "Out of range.",
            "top_3_improvements": [],
        }
        result = _parse_evaluation_result(ai_result, "hash_clamp", "2025-01-03T00:00:00")

        dim_map = {d.name: d for d in result.dimensions}
        assert dim_map["sop_completeness"].score == 100  # clamped from 150
        assert dim_map["assessment_coverage"].score == 0  # clamped from -20
        assert dim_map["knowledge_accuracy"].score == 100  # clamped from 200
        assert dim_map["difficulty_calibration"].score == 0  # clamped from -50
        assert dim_map["conversation_logic"].score == 75
        assert dim_map["executability"].score == 100

    def test_empty_dimensions_list(self):
        """Empty dimensions list -> all 6 get score=0, overall=0."""
        ai_result = {"dimensions": [], "summary": "Empty.", "top_3_improvements": []}
        result = _parse_evaluation_result(ai_result, "hash_empty", "2025-01-04T00:00:00")

        assert len(result.dimensions) == 6
        for dim in result.dimensions:
            assert dim.score == 0
            assert dim.verdict == "FAIL"
        assert result.overall_score == 0
        assert result.overall_verdict == "FAIL"

    def test_top_3_improvements_truncated(self):
        """top_3_improvements with >3 items is truncated to 3."""
        ai_result = _make_full_ai_response()
        ai_result["top_3_improvements"] = ["a", "b", "c", "d", "e"]
        result = _parse_evaluation_result(ai_result, "hash_trunc", "2025-01-05T00:00:00")

        assert len(result.top_improvements) == 3
        assert result.top_improvements == ["a", "b", "c"]

    def test_no_dimensions_key(self):
        """AI response with no 'dimensions' key -> all 6 get score=0."""
        ai_result = {"summary": "No dims.", "top_3_improvements": []}
        result = _parse_evaluation_result(ai_result, "hash_nodims", "2025-01-06T00:00:00")

        assert len(result.dimensions) == 6
        for dim in result.dimensions:
            assert dim.score == 0
            assert dim.verdict == "FAIL"
        assert result.overall_score == 0

    def test_dimension_missing_score_key_defaults_to_0(self):
        """Dimension dict without 'score' key defaults to 0."""
        ai_result = {
            "dimensions": [{"name": "sop_completeness"}],
            "summary": "Missing score.",
            "top_3_improvements": [],
        }
        result = _parse_evaluation_result(ai_result, "hash_noscore", "2025-01-07T00:00:00")
        dim_map = {d.name: d for d in result.dimensions}
        assert dim_map["sop_completeness"].score == 0
        assert dim_map["sop_completeness"].verdict == "FAIL"

    def test_mixed_score_verdicts(self):
        """Different scores produce correct per-dimension verdicts."""
        scores = {
            "sop_completeness": 90,
            "assessment_coverage": 65,
            "knowledge_accuracy": 45,
            "difficulty_calibration": 70,
            "conversation_logic": 50,
            "executability": 30,
        }
        ai_result = _make_full_ai_response(scores)
        result = _parse_evaluation_result(ai_result, "hash_mixed", "2025-01-08T00:00:00")

        dim_map = {d.name: d for d in result.dimensions}
        assert dim_map["sop_completeness"].verdict == "PASS"  # 90
        assert dim_map["assessment_coverage"].verdict == "NEEDS_REVIEW"  # 65
        assert dim_map["knowledge_accuracy"].verdict == "FAIL"  # 45
        assert dim_map["difficulty_calibration"].verdict == "PASS"  # 70
        assert dim_map["conversation_logic"].verdict == "NEEDS_REVIEW"  # 50
        assert dim_map["executability"].verdict == "FAIL"  # 30

        # Average: (90 + 65 + 45 + 70 + 50 + 30) / 6 = 58.33 -> 58
        assert result.overall_score == 58
        assert result.overall_verdict == "NEEDS_REVIEW"

    def test_summary_and_improvements_defaults(self):
        """Missing summary and top_3_improvements use defaults."""
        ai_result = {
            "dimensions": [{"name": d, "score": 50} for d in EVALUATION_DIMENSIONS],
        }
        result = _parse_evaluation_result(ai_result, "hash_def", "2025-01-09T00:00:00")
        assert result.summary == ""
        assert result.top_improvements == []


# ---------------------------------------------------------------------------
# _call_openai_for_evaluation tests
# ---------------------------------------------------------------------------


class TestCallOpenaiForEvaluation:
    """Test the Azure OpenAI call wrapper with various failure/success modes."""

    @patch("app.services.skill_evaluation_service.config_service")
    async def test_no_endpoint_returns_unavailable(self, mock_config):
        """No endpoint configured -> returns _AICallResult with data=None."""
        mock_config.get_effective_endpoint = AsyncMock(return_value="")
        mock_config.get_effective_key = AsyncMock(return_value="some-key")
        db = AsyncMock()

        result = await _call_openai_for_evaluation(db, "test prompt")
        assert isinstance(result, _AICallResult)
        assert result.data is None
        assert result.status == "ai_unavailable"

    @patch("app.services.skill_evaluation_service.config_service")
    async def test_no_api_key_returns_unavailable(self, mock_config):
        """No API key configured -> returns _AICallResult with data=None."""
        mock_config.get_effective_endpoint = AsyncMock(
            return_value="https://example.openai.azure.com"
        )
        mock_config.get_effective_key = AsyncMock(return_value="")
        db = AsyncMock()

        result = await _call_openai_for_evaluation(db, "test prompt")
        assert isinstance(result, _AICallResult)
        assert result.data is None
        assert result.status == "ai_unavailable"

    @patch("app.services.skill_evaluation_service.config_service")
    async def test_no_endpoint_and_no_key_returns_unavailable(self, mock_config):
        """Neither endpoint nor key -> returns _AICallResult with data=None."""
        mock_config.get_effective_endpoint = AsyncMock(return_value="")
        mock_config.get_effective_key = AsyncMock(return_value="")
        db = AsyncMock()

        result = await _call_openai_for_evaluation(db, "test prompt")
        assert isinstance(result, _AICallResult)
        assert result.data is None
        assert result.status == "ai_unavailable"

    @patch("app.services.skill_evaluation_service.config_service")
    async def test_successful_api_call(self, mock_config):
        """Successful API call returns _AICallResult with parsed JSON data."""
        mock_config.get_effective_endpoint = AsyncMock(
            return_value="https://example.openai.azure.com"
        )
        mock_config.get_effective_key = AsyncMock(return_value="test-key-123")
        mock_cfg = MagicMock()
        mock_cfg.model_or_deployment = "gpt-4o"
        mock_config.get_config = AsyncMock(return_value=mock_cfg)

        expected_json = {"overall_score": 80, "dimensions": []}
        mock_message = MagicMock()
        mock_message.content = json.dumps(expected_json)
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        db = AsyncMock()

        mock_openai_module = MagicMock()
        mock_openai_module.AsyncAzureOpenAI = MagicMock(return_value=mock_client)

        with patch.dict("sys.modules", {"openai": mock_openai_module}):
            result = await _call_openai_for_evaluation(db, "test prompt")

        assert isinstance(result, _AICallResult)
        assert result.data == expected_json
        assert result.status == "ai_success"
        assert result.model_used == "gpt-4o"

    @patch("app.services.skill_evaluation_service.config_service")
    async def test_openai_import_error_returns_none(self, mock_config):
        """openai package not installed (ImportError) -> returns None."""
        mock_config.get_effective_endpoint = AsyncMock(
            return_value="https://example.openai.azure.com"
        )
        mock_config.get_effective_key = AsyncMock(return_value="test-key-123")
        mock_cfg = MagicMock()
        mock_cfg.model_or_deployment = "gpt-4o"
        mock_config.get_config = AsyncMock(return_value=mock_cfg)

        db = AsyncMock()

        # Setting module to None causes ImportError on 'from openai import ...'
        import sys

        original = sys.modules.get("openai")
        sys.modules["openai"] = None  # type: ignore[assignment]
        try:
            result = await _call_openai_for_evaluation(db, "test prompt")
        finally:
            if original is not None:
                sys.modules["openai"] = original
            else:
                sys.modules.pop("openai", None)

        assert isinstance(result, _AICallResult)
        assert result.data is None
        assert result.status == "ai_unavailable"

    @patch("app.services.skill_evaluation_service.config_service")
    async def test_api_call_raises_exception_returns_none(self, mock_config):
        """API call raises exception -> returns None."""
        mock_config.get_effective_endpoint = AsyncMock(
            return_value="https://example.openai.azure.com"
        )
        mock_config.get_effective_key = AsyncMock(return_value="test-key-123")
        mock_cfg = MagicMock()
        mock_cfg.model_or_deployment = "gpt-4o"
        mock_config.get_config = AsyncMock(return_value=mock_cfg)

        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=RuntimeError("API failed"))

        db = AsyncMock()

        mock_openai_module = MagicMock()
        mock_openai_module.AsyncAzureOpenAI = MagicMock(return_value=mock_client)
        with patch.dict("sys.modules", {"openai": mock_openai_module}):
            result = await _call_openai_for_evaluation(db, "test prompt")

        assert isinstance(result, _AICallResult)
        assert result.data is None
        assert result.status == "ai_error"

    @patch("app.services.skill_evaluation_service.config_service")
    async def test_api_returns_empty_content_returns_error(self, mock_config):
        """API returns empty content string -> returns None."""
        mock_config.get_effective_endpoint = AsyncMock(
            return_value="https://example.openai.azure.com"
        )
        mock_config.get_effective_key = AsyncMock(return_value="test-key-123")
        mock_cfg = MagicMock()
        mock_cfg.model_or_deployment = "gpt-4o"
        mock_config.get_config = AsyncMock(return_value=mock_cfg)

        mock_message = MagicMock()
        mock_message.content = ""
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        db = AsyncMock()

        mock_openai_module = MagicMock()
        mock_openai_module.AsyncAzureOpenAI = MagicMock(return_value=mock_client)
        with patch.dict("sys.modules", {"openai": mock_openai_module}):
            result = await _call_openai_for_evaluation(db, "test prompt")

        assert isinstance(result, _AICallResult)
        assert result.data is None

    @patch("app.services.skill_evaluation_service.config_service")
    async def test_api_returns_none_content_returns_error(self, mock_config):
        """API returns None content -> returns _AICallResult with data=None."""
        mock_config.get_effective_endpoint = AsyncMock(
            return_value="https://example.openai.azure.com"
        )
        mock_config.get_effective_key = AsyncMock(return_value="test-key-123")
        mock_cfg = MagicMock()
        mock_cfg.model_or_deployment = "gpt-4o"
        mock_config.get_config = AsyncMock(return_value=mock_cfg)

        mock_message = MagicMock()
        mock_message.content = None
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        db = AsyncMock()

        mock_openai_module = MagicMock()
        mock_openai_module.AsyncAzureOpenAI = MagicMock(return_value=mock_client)
        with patch.dict("sys.modules", {"openai": mock_openai_module}):
            result = await _call_openai_for_evaluation(db, "test prompt")

        assert isinstance(result, _AICallResult)
        assert result.data is None

    @patch("app.services.skill_evaluation_service.config_service")
    async def test_config_none_uses_default_deployment(self, mock_config):
        """When config returns None for model, falls back to settings default."""
        mock_config.get_effective_endpoint = AsyncMock(
            return_value="https://example.openai.azure.com"
        )
        mock_config.get_effective_key = AsyncMock(return_value="test-key-123")
        mock_config.get_config = AsyncMock(return_value=None)

        expected_json = {"overall_score": 60, "dimensions": []}
        mock_message = MagicMock()
        mock_message.content = json.dumps(expected_json)
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        db = AsyncMock()

        mock_openai_module = MagicMock()
        mock_openai_module.AsyncAzureOpenAI = MagicMock(return_value=mock_client)
        with patch.dict("sys.modules", {"openai": mock_openai_module}):
            result = await _call_openai_for_evaluation(db, "test prompt")

        assert isinstance(result, _AICallResult)
        assert result.data == expected_json
        assert result.status == "ai_success"

    @patch("app.services.skill_evaluation_service.config_service")
    async def test_config_empty_deployment_uses_default(self, mock_config):
        """When config.model_or_deployment is empty, falls back to settings default."""
        mock_config.get_effective_endpoint = AsyncMock(
            return_value="https://example.openai.azure.com"
        )
        mock_config.get_effective_key = AsyncMock(return_value="test-key-123")
        mock_cfg = MagicMock()
        mock_cfg.model_or_deployment = ""
        mock_config.get_config = AsyncMock(return_value=mock_cfg)

        expected_json = {"overall_score": 55}
        mock_message = MagicMock()
        mock_message.content = json.dumps(expected_json)
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        db = AsyncMock()

        mock_openai_module = MagicMock()
        mock_openai_module.AsyncAzureOpenAI = MagicMock(return_value=mock_client)
        with patch.dict("sys.modules", {"openai": mock_openai_module}):
            result = await _call_openai_for_evaluation(db, "test prompt")

        assert isinstance(result, _AICallResult)
        assert result.data == expected_json
        assert result.status == "ai_success"


# ---------------------------------------------------------------------------
# evaluate_skill_quality integration tests (with DB)
# ---------------------------------------------------------------------------


async def _create_user_and_skill(
    db,
    content: str = "SOP content here",
    add_reference: bool = False,
    skill_name: str = "Test Skill",
) -> str:
    """Helper to create a User + Skill in the DB and return skill_id."""
    user = User(
        username="testadmin",
        email="admin@test.com",
        hashed_password=get_password_hash("password123"),
        role="admin",
    )
    db.add(user)
    await db.flush()

    skill = Skill(
        name=skill_name,
        description="A test skill for evaluation.",
        product="TestProduct",
        therapeutic_area="Oncology",
        content=content,
        status="draft",
        created_by=user.id,
    )
    db.add(skill)
    await db.flush()

    if add_reference:
        resource = SkillResource(
            skill_id=skill.id,
            resource_type="reference",
            filename="ref_doc.pdf",
            storage_path="/storage/ref_doc.pdf",
            content_type="application/pdf",
            text_content="Reference material text content for evaluation.",
        )
        db.add(resource)
        await db.flush()

    return skill.id


class TestEvaluateSkillQuality:
    """Integration tests for the main evaluate_skill_quality function."""

    async def test_skill_not_found_raises_value_error(self):
        """Non-existent skill_id raises ValueError."""
        async with TestSessionLocal() as db:
            with pytest.raises(ValueError, match="not found"):
                await evaluate_skill_quality(db, "nonexistent-id-999")

    @patch("app.services.skill_evaluation_service._call_openai_for_evaluation")
    async def test_ai_unavailable_returns_fallback(self, mock_call):
        """When AI returns None, fallback result has all 0 scores and FAIL verdict."""
        mock_call.return_value = _AICallResult(
            data=None, status="ai_unavailable", error_detail="not configured"
        )

        async with TestSessionLocal() as db:
            skill_id = await _create_user_and_skill(db)

            result = await evaluate_skill_quality(db, skill_id)

            assert result.overall_score == 0
            assert result.overall_verdict == "FAIL"
            assert len(result.dimensions) == 6
            for dim in result.dimensions:
                assert dim.score == 0
                assert dim.verdict == "FAIL"
                assert dim.rationale == "AI evaluation service unavailable"
            assert "not configured or unavailable" in result.summary
            assert result.content_hash != ""
            assert result.evaluated_at != ""

            # Verify stored on skill object
            from sqlalchemy import select

            stmt = select(Skill).where(Skill.id == skill_id)
            row = (await db.execute(stmt)).scalar_one()
            assert row.quality_score == 0
            assert row.quality_verdict == "FAIL"
            details = json.loads(row.quality_details)
            assert "content_hash" in details
            assert "evaluated_at" in details

    @patch("app.services.skill_evaluation_service._call_openai_for_evaluation")
    async def test_ai_returns_valid_result(self, mock_call):
        """Successful AI evaluation stores scores on skill object."""
        ai_response = _make_full_ai_response(
            {
                "sop_completeness": 80,
                "assessment_coverage": 85,
                "knowledge_accuracy": 90,
                "difficulty_calibration": 75,
                "conversation_logic": 70,
                "executability": 80,
            }
        )
        mock_call.return_value = _AICallResult(
            data=ai_response, status="ai_success", model_used="gpt-4o"
        )

        async with TestSessionLocal() as db:
            skill_id = await _create_user_and_skill(db)

            result = await evaluate_skill_quality(db, skill_id)

            assert result.overall_score == 80
            assert result.overall_verdict == "PASS"
            assert len(result.dimensions) == 6

            # Verify stored on skill object
            from sqlalchemy import select

            stmt = select(Skill).where(Skill.id == skill_id)
            row = (await db.execute(stmt)).scalar_one()
            assert row.quality_score == 80
            assert row.quality_verdict == "PASS"
            details = json.loads(row.quality_details)
            assert details["overall_score"] == 80
            assert details["content_hash"] != ""

    @patch("app.services.skill_evaluation_service._call_openai_for_evaluation")
    async def test_content_truncated_at_50000(self, mock_call):
        """Content longer than 50000 chars is truncated in the prompt."""
        mock_call.return_value = _AICallResult(data=None, status="ai_unavailable")  # We just need to verify truncation

        long_content = "A" * 60000

        async with TestSessionLocal() as db:
            skill_id = await _create_user_and_skill(db, content=long_content)

            await evaluate_skill_quality(db, skill_id)

            # Verify the prompt passed to _call_openai_for_evaluation
            call_args = mock_call.call_args
            prompt = call_args[0][1]  # Second positional arg is prompt
            assert "... (content truncated for evaluation)" in prompt
            # The original content of 60000 chars should be truncated
            assert len(prompt) < 60000 + 5000  # prompt overhead

    @patch("app.services.skill_evaluation_service._call_openai_for_evaluation")
    async def test_reference_resources_in_prompt(self, mock_call):
        """Reference resources are included in the prompt."""
        mock_call.return_value = _AICallResult(data=None, status="ai_unavailable")

        async with TestSessionLocal() as db:
            skill_id = await _create_user_and_skill(db, add_reference=True)

            await evaluate_skill_quality(db, skill_id)

            call_args = mock_call.call_args
            prompt = call_args[0][1]
            assert "ref_doc.pdf" in prompt
            assert "Reference material text content" in prompt

    @patch("app.services.skill_evaluation_service._call_openai_for_evaluation")
    async def test_no_reference_resources_message(self, mock_call):
        """No reference resources -> 'No reference materials.' in prompt."""
        mock_call.return_value = _AICallResult(data=None, status="ai_unavailable")

        async with TestSessionLocal() as db:
            skill_id = await _create_user_and_skill(db, add_reference=False)

            await evaluate_skill_quality(db, skill_id)

            call_args = mock_call.call_args
            prompt = call_args[0][1]
            assert "No reference materials." in prompt

    @patch("app.services.skill_evaluation_service._call_openai_for_evaluation")
    async def test_skill_with_empty_content(self, mock_call):
        """Skill with empty content still runs evaluation."""
        mock_call.return_value = _AICallResult(data=None, status="ai_unavailable")

        async with TestSessionLocal() as db:
            skill_id = await _create_user_and_skill(db, content="")

            result = await evaluate_skill_quality(db, skill_id)

            assert result.overall_score == 0
            assert result.content_hash != ""

    @patch("app.services.skill_evaluation_service._call_openai_for_evaluation")
    async def test_skill_metadata_in_prompt(self, mock_call):
        """Skill metadata (name, description, product, area) appears in prompt."""
        mock_call.return_value = _AICallResult(data=None, status="ai_unavailable")

        async with TestSessionLocal() as db:
            skill_id = await _create_user_and_skill(db, skill_name="Oncology Sales Skill")

            await evaluate_skill_quality(db, skill_id)

            call_args = mock_call.call_args
            prompt = call_args[0][1]
            assert "Oncology Sales Skill" in prompt
            assert "A test skill for evaluation." in prompt
            assert "TestProduct" in prompt
            assert "Oncology" in prompt

    @patch("app.services.skill_evaluation_service._call_openai_for_evaluation")
    async def test_skill_with_empty_fields_uses_defaults_in_prompt(self, mock_call):
        """Skill with empty/None optional fields uses defaults in prompt."""
        mock_call.return_value = _AICallResult(data=None, status="ai_unavailable")

        async with TestSessionLocal() as db:
            user = User(
                username="testadmin2",
                email="admin2@test.com",
                hashed_password=get_password_hash("password123"),
                role="admin",
            )
            db.add(user)
            await db.flush()

            skill = Skill(
                name="placeholder",
                description="",
                product="",
                therapeutic_area="",
                content="Some content",
                status="draft",
                created_by=user.id,
            )
            db.add(skill)
            await db.flush()

            real_skill_id = skill.id

            # Empty strings are falsy, so `skill.description or "No description"`
            # triggers the fallback defaults in the prompt
            await evaluate_skill_quality(db, real_skill_id)

            call_args = mock_call.call_args
            prompt = call_args[0][1]
            # Empty string is falsy, so `skill.description or "No description"` gives default
            assert "No description" in prompt
            assert "Not specified" in prompt  # product and therapeutic_area defaults

    @patch("app.services.skill_evaluation_service._call_openai_for_evaluation")
    async def test_non_reference_resources_excluded(self, mock_call):
        """Resources that are not 'reference' type are excluded from prompt."""
        mock_call.return_value = _AICallResult(data=None, status="ai_unavailable")

        async with TestSessionLocal() as db:
            user = User(
                username="testadmin3",
                email="admin3@test.com",
                hashed_password=get_password_hash("password123"),
                role="admin",
            )
            db.add(user)
            await db.flush()

            skill = Skill(
                name="Test",
                content="Content",
                status="draft",
                created_by=user.id,
            )
            db.add(skill)
            await db.flush()

            # Add a non-reference resource (script type)
            resource = SkillResource(
                skill_id=skill.id,
                resource_type="script",
                filename="script.py",
                storage_path="/storage/script.py",
                text_content="Script content should not appear.",
            )
            db.add(resource)
            await db.flush()

            await evaluate_skill_quality(db, skill.id)

            call_args = mock_call.call_args
            prompt = call_args[0][1]
            assert "script.py" not in prompt
            assert "Script content should not appear" not in prompt
            assert "No reference materials." in prompt
