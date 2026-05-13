"""Tests for CU Evaluation Service — analyzer schema building and scoring pipeline."""

from app.services.cu_evaluation_service import (
    build_content_analyzer_schema,
    build_voice_analyzer_schema,
    DEFAULT_VOICE_DIMENSIONS,
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
        fields = schema["fields"]
        assert "knowledge" in fields
        assert "communication" in fields
        assert "feedback_summary" in fields

    def test_field_structure(self):
        dims = [{"name": "Empathy", "weight": 50, "criteria": ["Shows empathy"], "max_score": 80}]
        schema = build_content_analyzer_schema(dims)

        field = schema["fields"]["empathy"]
        assert field["type"] == "object"
        assert field["method"] == "generate"
        assert "score" in field["properties"]
        assert "strengths" in field["properties"]
        assert "weaknesses" in field["properties"]
        assert "suggestions" in field["properties"]

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

    def test_voice_field_has_score_and_feedback(self):
        schema = build_voice_analyzer_schema(DEFAULT_VOICE_DIMENSIONS)

        fluency = schema["fields"]["fluency"]
        assert "score" in fluency["properties"]
        assert "feedback" in fluency["properties"]

    def test_always_includes_transcript(self):
        dims = [{"name": "Test", "weight": 100, "max_score": 100}]
        schema = build_voice_analyzer_schema(dims)
        assert "transcript" in schema["fields"]
        assert "D-16" in schema["fields"]["transcript"]["description"]
