"""Tests for CU Evaluation Service — voice analyzer schema, auth, merge, and voice parsing."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.cu_evaluation_service import (
    DEFAULT_VOICE_DIMENSIONS,
    _get_auth_headers,
    _parse_cu_voice_result,
    _put_analyzer,
    build_voice_analyzer_schema,
    merge_scores,
    score_voice_with_cu,
)


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
        assert "fluency" not in fields

    def test_voice_field_type_is_string(self):
        schema = build_voice_analyzer_schema(DEFAULT_VOICE_DIMENSIONS)

        fluency = schema["fields"]["fluency"]
        assert fluency["type"] == "string"
        assert fluency["method"] == "generate"

    def test_always_includes_transcript(self):
        dims = [{"name": "Test", "weight": 100, "max_score": 100}]
        schema = build_voice_analyzer_schema(dims)
        assert "transcript" in schema["fields"]


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


class TestPutAnalyzer:
    """Test CU analyzer create/update behavior."""

    @pytest.mark.asyncio
    async def test_model_exists_conflict_is_reused(self):
        """Deterministic analyzer IDs can already exist; 409 ModelExists is success."""

        class FakeResponse:
            status_code = 409
            text = '{"error":{"code":"ModelExists"}}'

        class FakeClient:
            def __init__(self, timeout: float) -> None:
                self.timeout = timeout

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return None

            async def put(self, url, headers, json):
                return FakeResponse()

        with (
            patch(
                "app.services.cu_evaluation_service._get_auth_headers",
                AsyncMock(return_value={}),
            ),
            patch("app.services.cu_evaluation_service.httpx.AsyncClient", FakeClient),
        ):
            await _put_analyzer(
                "https://example.cognitiveservices.azure.com",
                "",
                "rubricVoice12345678",
                {"name": "VoiceScoring", "fields": {}},
                "voice",
            )


class TestScoreVoiceWithCu:
    """Test voice scoring submission payloads."""

    @pytest.mark.asyncio
    async def test_audio_data_is_submitted_as_base64(self):
        captured_body = {}

        class FakePostResponse:
            status_code = 202
            headers = {"Operation-Location": "https://example.test/operations/1"}
            text = ""

        class FakeGetResponse:
            def json(self):
                return {
                    "status": "Succeeded",
                    "result": {"contents": [{"fields": {"transcript": {"valueString": "hi"}}}]},
                }

        class FakeClient:
            def __init__(self, timeout: float) -> None:
                self.timeout = timeout

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return None

            async def post(self, url, headers, json):
                captured_body.update(json)
                return FakePostResponse()

            async def get(self, url, headers):
                return FakeGetResponse()

        with (
            patch(
                "app.services.cu_evaluation_service._get_auth_headers",
                AsyncMock(return_value={}),
            ),
            patch("app.services.cu_evaluation_service.httpx.AsyncClient", FakeClient),
            patch("app.services.cu_evaluation_service.asyncio.sleep", AsyncMock()),
        ):
            result = await score_voice_with_cu(
                "https://example.services.ai.azure.com",
                "",
                "rubricVoice12345678",
                "https://storage.blob.core.windows.net/audio.webm",
                audio_data=b"audio-bytes",
            )

        assert captured_body == {"data": "YXVkaW8tYnl0ZXM=", "mimeType": "audio/webm"}
        assert result == {"transcript": {"valueString": "hi"}}

    @pytest.mark.asyncio
    async def test_audio_data_can_be_submitted_with_analyze_binary(self):
        captured = {}

        class FakePostResponse:
            status_code = 202
            headers = {"Operation-Location": "https://example.test/operations/1"}
            text = ""

        class FakeGetResponse:
            def json(self):
                return {
                    "status": "Succeeded",
                    "result": {"contents": [{"fields": {"transcript": {"valueString": "hi"}}}]},
                }

        class FakeClient:
            def __init__(self, timeout: float) -> None:
                self.timeout = timeout

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return None

            async def post(self, url, headers, content):
                captured["url"] = url
                captured["headers"] = headers
                captured["content"] = content
                return FakePostResponse()

            async def get(self, url, headers):
                return FakeGetResponse()

        with (
            patch(
                "app.services.cu_evaluation_service._get_auth_headers",
                AsyncMock(return_value={"Content-Type": "application/json"}),
            ),
            patch("app.services.cu_evaluation_service.httpx.AsyncClient", FakeClient),
            patch("app.services.cu_evaluation_service.asyncio.sleep", AsyncMock()),
        ):
            result = await score_voice_with_cu(
                "https://example.services.ai.azure.com",
                "",
                "rubricVoice12345678",
                "https://storage.blob.core.windows.net/audio.webm",
                audio_data=b"wav-bytes",
                mime_type="audio/wav",
                use_binary_upload=True,
            )

        assert captured["url"].endswith(
            "/contentunderstanding/analyzers/rubricVoice12345678:analyzeBinary"
            "?api-version=2025-05-01-preview"
        )
        assert captured["headers"]["Content-Type"] == "audio/wav"
        assert captured["content"] == b"wav-bytes"
        assert result == {"transcript": {"valueString": "hi"}}


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
        assert result["overall_score"] == 0.0

    def test_empty_dimensions(self):
        content_scores = {"dimensions": [], "feedback_summary": "No data"}
        result = merge_scores(content_scores, None, 60, 40)
        assert result["content_total"] == 0.0
        assert result["overall_score"] == 0.0


class TestParseCuVoiceResult:
    """Test CU voice result parsing."""

    def test_parse_voice_dimensions(self):
        cu_fields = {
            "fluency": {"valueString": '{"score": 90, "feedback": "Smooth"}'},
            "tone": {"valueString": '{"score": 75, "feedback": "Professional"}'},
            "feedback_summary": {"valueString": "Good voice quality"},
            "transcript": {"valueString": "Hello world"},
        }
        result = _parse_cu_voice_result(cu_fields)

        assert len(result["dimensions"]) == 2
        names = [d["name"] for d in result["dimensions"]]
        assert "fluency" in names
        assert "tone" in names
        assert result["feedback_summary"] == "Good voice quality"

    def test_excludes_non_score_fields(self):
        cu_fields = {
            "feedback_summary": {"valueString": "Summary"},
            "transcript": {"valueString": "Some text"},
            "fluency": {"valueString": '{"score": 80, "feedback": "OK"}'},
        }
        result = _parse_cu_voice_result(cu_fields)
        assert len(result["dimensions"]) == 1

    def test_empty_fields(self):
        result = _parse_cu_voice_result({})
        assert result["dimensions"] == []
        assert result["feedback_summary"] == ""

    def test_parse_voice_dimension_from_value_object(self):
        cu_fields = {
            "fluency": {
                "type": "object",
                "valueObject": {
                    "score": {"type": "string", "valueString": "88"},
                    "feedback": {"type": "string", "valueString": "Clear and smooth"},
                },
            },
            "feedback_summary": {"valueString": "Strong voice delivery"},
        }

        result = _parse_cu_voice_result(cu_fields)

        assert result["dimensions"] == [
            {
                "name": "fluency",
                "score": 88.0,
                "weight": 25,
                "feedback": "Clear and smooth",
            }
        ]
        assert result["feedback_summary"] == "Strong voice delivery"

    def test_parse_voice_dimension_from_content_json(self):
        cu_fields = {
            "tone": {
                "type": "string",
                "content": '{"score": 76, "feedback": "Professional tone"}',
            }
        }

        result = _parse_cu_voice_result(cu_fields)

        assert result["dimensions"] == [
            {
                "name": "tone",
                "score": 76,
                "weight": 25,
                "feedback": "Professional tone",
            }
        ]
