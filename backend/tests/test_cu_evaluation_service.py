"""Tests for CU Evaluation Service — analyzer schema building, auth, scoring, and merge."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.cu_evaluation_service import (
    DEFAULT_VOICE_DIMENSIONS,
    _get_auth_headers,
    _parse_cu_content_result,
    _parse_cu_voice_result,
    build_content_analyzer_schema,
    build_voice_analyzer_schema,
    merge_scores,
)


class TestBuildContentAnalyzerSchema:
    """Test content analyzer schema generation from rubric dimensions."""

    def test_basic_dimensions(self):
        dims = [
            {"name": "Knowledge", "weight": 40, "criteria": ["Accurate info"], "max_score": 100},
            {"name": "Communication", "weight": 60, "criteria": ["Clear speech"], "max_score": 100},
        ]
        schema = build_content_analyzer_schema(dims)

        assert "fields" in schema
        assert "name" in schema
        assert schema["name"] == "ContentScoring"
        fields = schema["fields"]
        assert "knowledge" in fields
        assert "communication" in fields
        assert "feedback_summary" in fields

    def test_field_structure(self):
        dims = [{"name": "Empathy", "weight": 50, "criteria": ["Shows empathy"], "max_score": 80}]
        schema = build_content_analyzer_schema(dims)

        field = schema["fields"]["empathy"]
        assert field["type"] == "string"
        assert field["method"] == "generate"
        assert "0-80" in field["description"]

    def test_description_includes_criteria(self):
        dims = [
            {
                "name": "Product Knowledge",
                "weight": 30,
                "criteria": ["Correct dosage", "Side effects"],
                "max_score": 100,
            }
        ]
        schema = build_content_analyzer_schema(dims)

        field = schema["fields"]["product_knowledge"]
        assert "Correct dosage" in field["description"]
        assert "weight: 30%" in field["description"]

    def test_empty_dimensions(self):
        schema = build_content_analyzer_schema([])
        assert "feedback_summary" in schema["fields"]
        assert len(schema["fields"]) == 1

    def test_name_normalization(self):
        dims = [{"name": "Active Listening", "weight": 25, "criteria": [], "max_score": 100}]
        schema = build_content_analyzer_schema(dims)
        assert "active_listening" in schema["fields"]


class TestBuildVoiceAnalyzerSchema:
    """Test voice analyzer schema generation."""

    def test_uses_defaults_when_empty(self):
        schema = build_voice_analyzer_schema([])

        assert schema["name"] == "VoiceScoring"
        fields = schema["fields"]
        assert "fluency" in fields
        assert "tone" in fields
        assert "pace" in fields
        assert "pronunciation" in fields
        assert "feedback_summary" in fields
        assert "transcript" in fields

    def test_custom_voice_dimensions(self):
        dims = [
            {"name": "Clarity", "weight": 50, "max_score": 100},
            {"name": "Energy", "weight": 50, "max_score": 100},
        ]
        schema = build_voice_analyzer_schema(dims)

        fields = schema["fields"]
        assert "clarity" in fields
        assert "energy" in fields
        assert "fluency" not in fields  # No defaults when custom provided

    def test_voice_field_type_is_string(self):
        schema = build_voice_analyzer_schema(DEFAULT_VOICE_DIMENSIONS)

        fluency = schema["fields"]["fluency"]
        assert fluency["type"] == "string"
        assert fluency["method"] == "generate"

    def test_always_includes_transcript(self):
        dims = [{"name": "Test", "weight": 100, "max_score": 100}]
        schema = build_voice_analyzer_schema(dims)
        assert "transcript" in schema["fields"]
        assert "D-16" in schema["fields"]["transcript"]["description"]


class TestGetAuthHeaders:
    """Test authentication header resolution."""

    @pytest.mark.asyncio
    async def test_entra_id_preferred(self):
        mock_credential = AsyncMock()
        mock_token = MagicMock()
        mock_token.token = "fake-bearer-token"
        mock_credential.get_token = AsyncMock(return_value=mock_token)
        mock_credential.close = AsyncMock()

        mock_module = MagicMock()
        mock_module.DefaultAzureCredential = MagicMock(return_value=mock_credential)

        with patch.dict("sys.modules", {"azure.identity.aio": mock_module}):
            headers = await _get_auth_headers("some-api-key")

        assert "Authorization" in headers
        assert headers["Authorization"] == "Bearer fake-bearer-token"
        assert "Content-Type" in headers

    @pytest.mark.asyncio
    async def test_api_key_fallback(self):
        # When azure.identity.aio import fails, should fall back to API Key
        mock_module = MagicMock()
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(side_effect=Exception("Token fetch failed"))
        mock_credential.close = AsyncMock()
        mock_module.DefaultAzureCredential = MagicMock(return_value=mock_credential)

        with patch.dict("sys.modules", {"azure.identity.aio": mock_module}):
            result = await _get_auth_headers("test-key-123")

        assert result["Ocp-Apim-Subscription-Key"] == "test-key-123"
        assert result["Content-Type"] == "application/json"

    @pytest.mark.asyncio
    async def test_no_credentials_raises(self):
        with patch.dict("sys.modules", {"azure.identity.aio": None}):
            with pytest.raises((RuntimeError, TypeError, ModuleNotFoundError)):
                await _get_auth_headers("")


class TestMergeScores:
    """Test score merging logic (D-11)."""

    def test_text_only_session(self):
        content_scores = {
            "dimensions": [
                {"name": "Knowledge", "score": 80, "weight": 50},
                {"name": "Communication", "score": 70, "weight": 50},
            ],
            "feedback_summary": "Good performance",
        }
        result = merge_scores(content_scores, None, 60, 40)

        assert result["voice_total"] is None
        assert result["content_total"] == 75.0
        assert result["overall_score"] == 75.0
        assert result["feedback_summary"] == "Good performance"

    def test_voice_session_weighted_merge(self):
        content_scores = {
            "dimensions": [
                {"name": "Knowledge", "score": 80, "weight": 60},
                {"name": "Communication", "score": 60, "weight": 40},
            ],
            "feedback_summary": "Content feedback",
        }
        voice_scores = {
            "dimensions": [
                {"name": "Fluency", "score": 90, "weight": 50},
                {"name": "Tone", "score": 70, "weight": 50},
            ],
            "feedback_summary": "Voice feedback",
        }
        result = merge_scores(content_scores, voice_scores, 60, 40)

        # content_total = (80*60 + 60*40) / 100 = 72
        # voice_total = (90*50 + 70*50) / 100 = 80
        # overall = 72 * 0.6 + 80 * 0.4 = 43.2 + 32 = 75.2
        assert result["content_total"] == 72.0
        assert result["voice_total"] == 80.0
        assert result["overall_score"] == 75.2
        assert "Voice: Voice feedback" in result["feedback_summary"]

    def test_zero_weights_fallback(self):
        content_scores = {
            "dimensions": [{"name": "X", "score": 50, "weight": 100}],
            "feedback_summary": "",
        }
        voice_scores = {
            "dimensions": [{"name": "Y", "score": 80, "weight": 100}],
            "feedback_summary": "",
        }
        result = merge_scores(content_scores, voice_scores, 0, 0)
        # total_weight fallback to 100, each gets 0/100 ratio
        # Actually 0+0=0 so fallback makes total_weight=100
        # content_ratio = 0/100 = 0, voice_ratio = 0/100 = 0
        assert result["overall_score"] == 0.0

    def test_empty_dimensions(self):
        content_scores = {"dimensions": [], "feedback_summary": "No data"}
        result = merge_scores(content_scores, None, 60, 40)
        assert result["content_total"] == 0.0
        assert result["overall_score"] == 0.0


class TestParseCuContentResult:
    """Test CU content result parsing."""

    def test_parse_matching_dimensions(self):
        cu_fields = {
            "knowledge": {
                "score": 85,
                "strengths": ["Good recall"],
                "weaknesses": ["Missing detail"],
                "suggestions": ["Study more"],
            },
            "feedback_summary": "Overall good",
        }
        dims = [{"name": "Knowledge", "weight": 100, "max_score": 100}]
        result = _parse_cu_content_result(cu_fields, dims)

        assert len(result["dimensions"]) == 1
        assert result["dimensions"][0]["score"] == 85
        assert result["dimensions"][0]["strengths"] == ["Good recall"]
        assert result["feedback_summary"] == "Overall good"

    def test_parse_missing_dimension(self):
        cu_fields = {"feedback_summary": "N/A"}
        dims = [{"name": "Unknown Dim", "weight": 50, "max_score": 100}]
        result = _parse_cu_content_result(cu_fields, dims)

        assert result["dimensions"][0]["score"] == 0
        assert result["dimensions"][0]["strengths"] == []

    def test_feedback_summary_as_dict(self):
        cu_fields = {"feedback_summary": {"value": "Wrapped feedback"}}
        result = _parse_cu_content_result(cu_fields, [])
        assert result["feedback_summary"] == "Wrapped feedback"


class TestParseCuVoiceResult:
    """Test CU voice result parsing."""

    def test_parse_voice_dimensions(self):
        cu_fields = {
            "fluency": {"score": 90, "feedback": "Smooth"},
            "tone": {"score": 75, "feedback": "Professional"},
            "feedback_summary": "Good voice quality",
            "transcript": "Hello world",
        }
        result = _parse_cu_voice_result(cu_fields)

        assert len(result["dimensions"]) == 2
        names = [d["name"] for d in result["dimensions"]]
        assert "Fluency" in names
        assert "Tone" in names
        assert result["feedback_summary"] == "Good voice quality"

    def test_excludes_non_score_fields(self):
        cu_fields = {
            "feedback_summary": "Summary",
            "transcript": "Some text",
            "fluency": {"score": 80, "feedback": "OK"},
        }
        result = _parse_cu_voice_result(cu_fields)
        assert len(result["dimensions"]) == 1

    def test_empty_fields(self):
        result = _parse_cu_voice_result({})
        assert result["dimensions"] == []
        assert result["feedback_summary"] == ""
