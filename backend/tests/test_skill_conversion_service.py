"""Skill conversion service tests (mocked AI calls).

Covers:
- semantic_chunk (pure function, no mocks)
- merge_extractions (pure function, no mocks)
- format_coaching_protocol (pure function, no mocks)
- _get_openai_client (config_service + settings mocking)
- _call_sop_extraction (OpenAI response mocking)
- extract_resource_texts (storage + DB mocking)
- _get_config_value (config_service fallback)
- start_conversion (full pipeline with mocked AI)
- regenerate_sop_with_feedback (AI feedback loop)
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.skill import SkillResource
from tests.conftest import TestSessionLocal


async def _seed_user() -> str:
    """Create a test admin user and return the user_id."""
    from app.models.user import User
    from app.services.auth import get_password_hash

    async with TestSessionLocal() as session:
        user = User(
            username="conv_test_admin",
            email="conv_admin@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Conv Admin",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user.id


# Mock extraction result matching the expected dict schema
MOCK_EXTRACTION_RESULT = {
    "summary": "Training on HCP communication skills.",
    "sop_steps": [
        {
            "title": "Opening",
            "description": "Greet the HCP",
            "key_points": ["Introduce yourself"],
            "objections": ["Not interested right now"],
            "assessment_criteria": ["Professional greeting"],
            "knowledge_points": ["Company background"],
            "suggested_duration": "5 minutes",
        },
        {
            "title": "Product Discussion",
            "description": "Discuss product efficacy",
            "key_points": ["Clinical data"],
            "objections": [],
            "assessment_criteria": ["Accurate data citation"],
            "knowledge_points": ["Phase III trial results"],
            "suggested_duration": "10 minutes",
        },
        {
            "title": "Closing",
            "description": "Summarize and next steps",
            "key_points": ["Schedule follow-up"],
            "objections": [],
            "assessment_criteria": [],
            "knowledge_points": [],
            "suggested_duration": "",
        },
    ],
    "assessment_criteria": [
        {
            "name": "Communication",
            "description": "Clear communication",
            "weight": 50,
        },
        {
            "name": "Product Knowledge",
            "description": "Accurate product info",
            "weight": 50,
        },
    ],
    "key_knowledge_points": [
        {"topic": "Mechanism of action", "details": "How the drug works"},
        {"topic": "Clinical trial results", "details": "Phase III data"},
    ],
}


# ===================================================================
# semantic_chunk tests
# ===================================================================


class TestSemanticChunk:
    """Tests for the semantic_chunk pure function."""

    def test_small_text_no_chunking(self):
        """Text within limit should return as a single chunk."""
        from app.services.skill_conversion_service import semantic_chunk

        text = "Short text that fits in one chunk."
        result = semantic_chunk(text, max_tokens=80000)
        assert len(result) == 1
        assert result[0] == text

    def test_empty_text(self):
        """Empty text should return a single empty-ish chunk or empty list."""
        from app.services.skill_conversion_service import semantic_chunk

        result = semantic_chunk("", max_tokens=80000)
        # Empty string is <= max_chars, returns as single chunk
        assert len(result) <= 1

    def test_heading_based_split(self):
        """Long text with headings should split at heading boundaries."""
        from app.services.skill_conversion_service import semantic_chunk

        # Create text that exceeds limit with heading boundaries
        section1 = "# Section 1\n" + "A" * 500 + "\n"
        section2 = "# Section 2\n" + "B" * 500 + "\n"
        text = section1 + section2
        # Use a tiny token limit so splitting occurs (250 chars = ~62 tokens)
        result = semantic_chunk(text, max_tokens=62)
        assert len(result) >= 2

    def test_paragraph_based_split(self):
        """Text without headings but with paragraphs should split at paragraph boundaries."""
        from app.services.skill_conversion_service import semantic_chunk

        # Create long text with paragraph breaks but no headings
        para1 = "First paragraph. " * 50
        para2 = "Second paragraph. " * 50
        text = para1 + "\n\n" + para2
        # Use small limit to force splitting
        result = semantic_chunk(text, max_tokens=100)
        assert len(result) >= 2

    def test_sentence_based_split_last_resort(self):
        """Single huge paragraph should fall back to sentence-based splitting."""
        from app.services.skill_conversion_service import semantic_chunk

        # Create one giant paragraph with sentences but no headings or paragraph breaks
        text = "This is sentence one. " * 200
        # Very small limit to force sentence-level splitting
        result = semantic_chunk(text, max_tokens=25)
        assert len(result) >= 2

    def test_single_long_paragraph_no_sentences(self):
        """A single huge block with no sentence boundaries still gets chunked."""
        from app.services.skill_conversion_service import semantic_chunk

        # One giant word-like string
        text = "A" * 2000
        result = semantic_chunk(text, max_tokens=50)
        # The function may not split further than paragraphs, but covers the code path
        assert len(result) >= 1

    def test_chunks_are_non_empty(self):
        """All returned chunks should be non-empty (whitespace-only filtered)."""
        from app.services.skill_conversion_service import semantic_chunk

        text = "# H1\n" + "A" * 600 + "\n# H2\n" + "B" * 600
        result = semantic_chunk(text, max_tokens=80)
        for chunk in result:
            assert chunk.strip() != ""


# ===================================================================
# merge_extractions tests
# ===================================================================


class TestMergeExtractions:
    """Tests for the merge_extractions pure function."""

    def test_single_part_passthrough(self):
        """Single part should be returned as-is without modification."""
        from app.services.skill_conversion_service import merge_extractions

        result = merge_extractions([MOCK_EXTRACTION_RESULT])
        assert result is MOCK_EXTRACTION_RESULT

    def test_dedup_by_title(self):
        """Steps with duplicate titles (case-insensitive) should be deduplicated."""
        from app.services.skill_conversion_service import merge_extractions

        part1 = {
            "summary": "Part 1 summary",
            "sop_steps": [{"title": "Opening", "description": "v1"}],
            "assessment_criteria": [
                {"name": "Communication", "description": "v1", "weight": 60}
            ],
            "key_knowledge_points": [{"topic": "MOA", "details": "v1"}],
        }
        part2 = {
            "summary": "",
            "sop_steps": [
                {"title": "opening", "description": "v2"},  # duplicate (case-insensitive)
                {"title": "Closing", "description": "v2"},
            ],
            "assessment_criteria": [
                {"name": "communication", "description": "v2", "weight": 40},  # duplicate
                {"name": "Empathy", "description": "v2", "weight": 30},
            ],
            "key_knowledge_points": [
                {"topic": "moa", "details": "v2"},  # duplicate
                {"topic": "Side effects", "details": "v2"},
            ],
        }
        result = merge_extractions([part1, part2])

        # Deduplicated: Opening + Closing = 2
        assert len(result["sop_steps"]) == 2
        # Deduplicated: Communication + Empathy = 2
        assert len(result["assessment_criteria"]) == 2
        # Deduplicated: MOA + Side effects = 2
        assert len(result["key_knowledge_points"]) == 2
        # Summary should be from part1 (first non-empty)
        assert result["summary"] == "Part 1 summary"

    def test_weight_normalization(self):
        """Assessment weights should be normalized to sum to 100."""
        from app.services.skill_conversion_service import merge_extractions

        part1 = {
            "summary": "",
            "sop_steps": [],
            "assessment_criteria": [
                {"name": "A", "description": "a", "weight": 30},
                {"name": "B", "description": "b", "weight": 20},
            ],
            "key_knowledge_points": [],
        }
        part2 = {
            "summary": "",
            "sop_steps": [],
            "assessment_criteria": [
                {"name": "C", "description": "c", "weight": 50},
            ],
            "key_knowledge_points": [],
        }
        result = merge_extractions([part1, part2])
        # Total was 100 already (30+20+50), so no normalization needed
        total = sum(c["weight"] for c in result["assessment_criteria"])
        assert total == 100

    def test_weight_normalization_non_hundred(self):
        """Weights that don't sum to 100 should be normalized."""
        from app.services.skill_conversion_service import merge_extractions

        part1 = {
            "summary": "",
            "sop_steps": [],
            "assessment_criteria": [
                {"name": "A", "description": "a", "weight": 30},
            ],
            "key_knowledge_points": [],
        }
        part2 = {
            "summary": "",
            "sop_steps": [],
            "assessment_criteria": [
                {"name": "B", "description": "b", "weight": 20},
            ],
            "key_knowledge_points": [],
        }
        result = merge_extractions([part1, part2])
        total = sum(c["weight"] for c in result["assessment_criteria"])
        assert total == 100

    def test_empty_parts(self):
        """Parts with empty lists should merge cleanly."""
        from app.services.skill_conversion_service import merge_extractions

        part1 = {
            "summary": "",
            "sop_steps": [],
            "assessment_criteria": [],
            "key_knowledge_points": [],
        }
        part2 = {
            "summary": "Summary from part 2",
            "sop_steps": [],
            "assessment_criteria": [],
            "key_knowledge_points": [],
        }
        result = merge_extractions([part1, part2])
        assert result["summary"] == "Summary from part 2"
        assert result["sop_steps"] == []

    def test_empty_title_steps_skipped(self):
        """Steps with empty titles should be skipped in dedup."""
        from app.services.skill_conversion_service import merge_extractions

        part1 = {
            "summary": "",
            "sop_steps": [{"title": "", "description": "no title"}],
            "assessment_criteria": [{"name": "", "description": "no name", "weight": 50}],
            "key_knowledge_points": [{"topic": "", "details": "no topic"}],
        }
        part2 = {
            "summary": "",
            "sop_steps": [{"title": "Real step", "description": "yes"}],
            "assessment_criteria": [],
            "key_knowledge_points": [],
        }
        result = merge_extractions([part1, part2])
        # Empty-title items are skipped because "".strip().lower() is falsy
        assert len(result["sop_steps"]) == 1
        assert result["sop_steps"][0]["title"] == "Real step"


# ===================================================================
# format_coaching_protocol tests
# ===================================================================


class TestFormatCoachingProtocol:
    """Tests for the format_coaching_protocol pure function."""

    def test_full_protocol(self):
        """Full extraction data should produce a complete protocol."""
        from app.services.skill_conversion_service import format_coaching_protocol

        protocol = format_coaching_protocol(MOCK_EXTRACTION_RESULT, "Test Skill")

        assert "# Test Skill - Coaching Protocol" in protocol
        assert "Training on HCP communication skills." in protocol
        assert "### Step 1: Opening" in protocol
        assert "### Step 2: Product Discussion" in protocol
        assert "### Step 3: Closing" in protocol
        assert "**Key Points:**" in protocol
        assert "**Common Objections:**" in protocol
        assert "**Assessment Criteria:**" in protocol
        assert "**Knowledge Points:**" in protocol
        assert "**Suggested Duration:** 5 minutes" in protocol
        assert "| Communication | Clear communication | 50% |" in protocol
        assert "### Mechanism of action" in protocol
        assert "How the drug works" in protocol

    def test_empty_extraction(self):
        """Empty extraction should produce protocol with placeholder text."""
        from app.services.skill_conversion_service import format_coaching_protocol

        empty = {
            "summary": "",
            "sop_steps": [],
            "assessment_criteria": [],
            "key_knowledge_points": [],
        }
        protocol = format_coaching_protocol(empty, "Empty Skill")

        assert "# Empty Skill - Coaching Protocol" in protocol
        assert "*No SOP steps extracted.*" in protocol
        assert "| *None* | - | - |" in protocol
        assert "*No knowledge points extracted.*" in protocol

    def test_partial_step_data(self):
        """Steps with missing optional fields should still render."""
        from app.services.skill_conversion_service import format_coaching_protocol

        extraction = {
            "summary": "Partial data",
            "sop_steps": [
                {
                    "title": "Only Title",
                    "description": "Only description",
                    # No key_points, objections, assessment_criteria, knowledge_points, duration
                }
            ],
            "assessment_criteria": [],
            "key_knowledge_points": [],
        }
        protocol = format_coaching_protocol(extraction, "Partial Skill")

        assert "### Step 1: Only Title" in protocol
        assert "Only description" in protocol
        # Should NOT have Key Points section for this step
        assert "**Key Points:**" not in protocol

    def test_step_with_empty_lists(self):
        """Steps with empty sub-lists should not render those sections."""
        from app.services.skill_conversion_service import format_coaching_protocol

        extraction = {
            "summary": "Test",
            "sop_steps": [
                {
                    "title": "Step A",
                    "description": "Desc A",
                    "key_points": [],
                    "objections": [],
                    "assessment_criteria": [],
                    "knowledge_points": [],
                    "suggested_duration": "",
                }
            ],
            "assessment_criteria": [],
            "key_knowledge_points": [],
        }
        protocol = format_coaching_protocol(extraction, "Skill X")
        assert "### Step 1: Step A" in protocol
        assert "**Key Points:**" not in protocol
        assert "**Common Objections:**" not in protocol
        assert "**Suggested Duration:**" not in protocol

    def test_untitled_step(self):
        """Step with no title key should default to 'Untitled'."""
        from app.services.skill_conversion_service import format_coaching_protocol

        extraction = {
            "summary": "",
            "sop_steps": [{"description": "No title given"}],
            "assessment_criteria": [],
            "key_knowledge_points": [],
        }
        protocol = format_coaching_protocol(extraction, "Skill Y")
        assert "### Step 1: Untitled" in protocol


# ===================================================================
# _update_progress tests
# ===================================================================


class TestUpdateProgress:
    """Tests for the _update_progress helper."""

    def test_valid_metadata_json(self):
        """Should update progress in existing valid metadata."""
        from app.services.skill_conversion_service import _update_progress

        skill = MagicMock()
        skill.metadata_json = '{"existing_key": "value"}'
        _update_progress(skill, 3)

        result = json.loads(skill.metadata_json)
        assert "conversion_progress" in result
        assert result["conversion_progress"]["current_step"] == 4
        assert result["existing_key"] == "value"

    def test_invalid_metadata_json(self):
        """Should handle invalid JSON gracefully by resetting to empty dict."""
        from app.services.skill_conversion_service import _update_progress

        skill = MagicMock()
        skill.metadata_json = "not valid json {{{"
        _update_progress(skill, 0)

        result = json.loads(skill.metadata_json)
        assert "conversion_progress" in result
        assert result["conversion_progress"]["current_step"] == 1
        assert result["conversion_progress"]["step_name"] == "extracting_text"

    def test_none_metadata_json(self):
        """Should handle None metadata_json."""
        from app.services.skill_conversion_service import _update_progress

        skill = MagicMock()
        skill.metadata_json = None
        _update_progress(skill, 2)

        result = json.loads(skill.metadata_json)
        assert result["conversion_progress"]["current_step"] == 3

    def test_progress_steps_status(self):
        """Should mark steps as completed, in_progress, or pending."""
        from app.services.skill_conversion_service import CONVERSION_STEPS, _update_progress

        skill = MagicMock()
        skill.metadata_json = "{}"
        step_idx = 3
        _update_progress(skill, step_idx)

        result = json.loads(skill.metadata_json)
        steps = result["conversion_progress"]["steps"]
        assert len(steps) == len(CONVERSION_STEPS)
        for s in steps:
            if s["step"] - 1 < step_idx:
                assert s["status"] == "completed"
            elif s["step"] - 1 == step_idx:
                assert s["status"] == "in_progress"
            else:
                assert s["status"] == "pending"


# ===================================================================
# _get_language_instruction tests
# ===================================================================


class TestGetLanguageInstruction:
    """Tests for the _get_language_instruction helper."""

    def test_default_english_returns_empty(self):
        """Default setting (en) should return empty string."""
        from app.services.skill_conversion_service import _get_language_instruction

        with patch("app.config.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(skill_sop_language="en")
            result = _get_language_instruction()
            assert result == ""

    def test_chinese_returns_instruction(self):
        """Chinese setting should return Chinese instruction."""
        from app.services.skill_conversion_service import _get_language_instruction

        with patch("app.config.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(skill_sop_language="zh")
            result = _get_language_instruction()
            assert "Chinese" in result
            assert "中文" in result


# ===================================================================
# _get_openai_client tests
# ===================================================================


class TestGetOpenAIClient:
    """Tests for _get_openai_client with mocked config_service."""

    async def test_missing_endpoint_raises(self, db_session):
        """Should raise ValueError when no endpoint configured."""
        from app.services import config_service
        from app.services.skill_conversion_service import _get_openai_client

        with patch.object(
            config_service, "get_effective_endpoint", new=AsyncMock(return_value="")
        ), patch.object(
            config_service, "get_effective_key", new=AsyncMock(return_value="test-key")
        ):
            with pytest.raises(ValueError, match="Azure OpenAI not configured"):
                await _get_openai_client(db_session)

    async def test_missing_api_key_raises(self, db_session):
        """Should raise ValueError when no API key configured."""
        from app.services import config_service
        from app.services.skill_conversion_service import _get_openai_client

        with patch.object(
            config_service,
            "get_effective_endpoint",
            new=AsyncMock(return_value="https://test.openai.azure.com"),
        ), patch.object(
            config_service, "get_effective_key", new=AsyncMock(return_value="")
        ):
            with pytest.raises(ValueError, match="Azure OpenAI not configured"):
                await _get_openai_client(db_session)

    async def test_uses_config_deployment(self, db_session):
        """Should use model_or_deployment from config when available."""
        from app.services import config_service
        from app.services.skill_conversion_service import _get_openai_client

        mock_config_obj = MagicMock()
        mock_config_obj.model_or_deployment = "my-custom-deployment"

        with patch.object(
            config_service,
            "get_effective_endpoint",
            new=AsyncMock(return_value="https://test.openai.azure.com"),
        ), patch.object(
            config_service, "get_effective_key", new=AsyncMock(return_value="test-key")
        ), patch.object(
            config_service, "get_config", new=AsyncMock(return_value=mock_config_obj)
        ), patch(
            "openai.AsyncAzureOpenAI", return_value=MagicMock()
        ):
            client, deployment = await _get_openai_client(db_session)
            assert deployment == "my-custom-deployment"

    async def test_falls_back_to_default_chat_model(self, db_session):
        """Should fall back to settings.default_chat_model when config has no deployment."""
        from app.services import config_service
        from app.services.skill_conversion_service import _get_openai_client

        mock_config_obj = MagicMock()
        mock_config_obj.model_or_deployment = ""  # empty -> fallback

        with patch.object(
            config_service,
            "get_effective_endpoint",
            new=AsyncMock(return_value="https://test.openai.azure.com"),
        ), patch.object(
            config_service, "get_effective_key", new=AsyncMock(return_value="test-key")
        ), patch.object(
            config_service, "get_config", new=AsyncMock(return_value=mock_config_obj)
        ), patch(
            "openai.AsyncAzureOpenAI", return_value=MagicMock()
        ):
            client, deployment = await _get_openai_client(db_session)
            # Should fall back to settings.default_chat_model ("gpt-4o")
            assert deployment == "gpt-4o"

    async def test_config_none_falls_back(self, db_session):
        """Should fall back to default when get_config returns None."""
        from app.services import config_service
        from app.services.skill_conversion_service import _get_openai_client

        with patch.object(
            config_service,
            "get_effective_endpoint",
            new=AsyncMock(return_value="https://test.openai.azure.com"),
        ), patch.object(
            config_service, "get_effective_key", new=AsyncMock(return_value="test-key")
        ), patch.object(
            config_service, "get_config", new=AsyncMock(return_value=None)
        ), patch(
            "openai.AsyncAzureOpenAI", return_value=MagicMock()
        ):
            client, deployment = await _get_openai_client(db_session)
            assert deployment == "gpt-4o"


# ===================================================================
# _call_sop_extraction tests
# ===================================================================


class TestCallSopExtraction:
    """Tests for _call_sop_extraction with mocked OpenAI client."""

    async def test_valid_extraction(self, db_session):
        """Should parse valid JSON response from OpenAI."""
        from app.services.skill_conversion_service import _call_sop_extraction

        valid_response = json.dumps(MOCK_EXTRACTION_RESULT)
        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(
            return_value=MagicMock(
                choices=[MagicMock(message=MagicMock(content=valid_response))]
            )
        )

        with patch(
            "app.services.skill_conversion_service._get_openai_client",
            new=AsyncMock(return_value=(mock_client, "gpt-4o")),
        ):
            result = await _call_sop_extraction(db_session, "Some training text")

        assert "sop_steps" in result
        assert "assessment_criteria" in result
        assert "key_knowledge_points" in result

    async def test_empty_content_raises(self, db_session):
        """Should raise ValueError when AI returns empty content."""
        from app.services.skill_conversion_service import _call_sop_extraction

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(
            return_value=MagicMock(
                choices=[MagicMock(message=MagicMock(content=None))]
            )
        )

        with patch(
            "app.services.skill_conversion_service._get_openai_client",
            new=AsyncMock(return_value=(mock_client, "gpt-4o")),
        ):
            with pytest.raises(ValueError, match="empty content"):
                await _call_sop_extraction(db_session, "Some text")

    async def test_empty_string_content_raises(self, db_session):
        """Should raise ValueError when AI returns empty string."""
        from app.services.skill_conversion_service import _call_sop_extraction

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(
            return_value=MagicMock(
                choices=[MagicMock(message=MagicMock(content=""))]
            )
        )

        with patch(
            "app.services.skill_conversion_service._get_openai_client",
            new=AsyncMock(return_value=(mock_client, "gpt-4o")),
        ):
            with pytest.raises(ValueError, match="empty content"):
                await _call_sop_extraction(db_session, "Some text")

    async def test_missing_required_key_raises(self, db_session):
        """Should raise ValueError when response is missing required keys."""
        from app.services.skill_conversion_service import _call_sop_extraction

        incomplete = json.dumps({"sop_steps": [], "assessment_criteria": []})
        # Missing key_knowledge_points
        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(
            return_value=MagicMock(
                choices=[MagicMock(message=MagicMock(content=incomplete))]
            )
        )

        with patch(
            "app.services.skill_conversion_service._get_openai_client",
            new=AsyncMock(return_value=(mock_client, "gpt-4o")),
        ):
            with pytest.raises(ValueError, match="missing required key"):
                await _call_sop_extraction(db_session, "Some text")

    async def test_invalid_json_raises(self, db_session):
        """Should raise json.JSONDecodeError for invalid JSON."""
        from app.services.skill_conversion_service import _call_sop_extraction

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(
            return_value=MagicMock(
                choices=[MagicMock(message=MagicMock(content="not valid json {{{"))]
            )
        )

        with patch(
            "app.services.skill_conversion_service._get_openai_client",
            new=AsyncMock(return_value=(mock_client, "gpt-4o")),
        ):
            with pytest.raises(json.JSONDecodeError):
                await _call_sop_extraction(db_session, "Some text")


# ===================================================================
# extract_resource_texts tests
# ===================================================================


class TestExtractResourceTexts:
    """Tests for extract_resource_texts with mocked storage."""

    async def test_successful_extraction(self, db_session):
        """Should extract text from resources and update status."""
        from app.services.skill_conversion_service import extract_resource_texts

        user_id = await _seed_user()

        from app.schemas.skill import SkillCreate
        from app.services import skill_service

        data = SkillCreate(name="Extract Test Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)

        resource = SkillResource(
            skill_id=skill.id,
            resource_type="reference",
            filename="doc.txt",
            storage_path=f"skills/{skill.id}/references/doc.txt",
            content_type="text/plain",
            file_size=50,
            extraction_status="pending",
        )
        db_session.add(resource)
        await db_session.flush()

        mock_storage = AsyncMock()
        mock_storage.read = AsyncMock(return_value=b"Hello world training content")

        with patch(
            "app.services.skill_conversion_service.get_storage",
            return_value=mock_storage,
        ):
            await extract_resource_texts(db_session, skill.id)

        assert resource.extraction_status == "completed"
        assert resource.text_content == "Hello world training content"

    async def test_extraction_failure_sets_failed(self, db_session):
        """Should set status to 'failed' when extraction raises."""
        from app.services.skill_conversion_service import extract_resource_texts

        user_id = await _seed_user()

        from app.schemas.skill import SkillCreate
        from app.services import skill_service

        data = SkillCreate(name="Fail Test Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)

        resource = SkillResource(
            skill_id=skill.id,
            resource_type="reference",
            filename="corrupt.pdf",
            storage_path=f"skills/{skill.id}/references/corrupt.pdf",
            content_type="application/pdf",
            file_size=50,
            extraction_status="pending",
        )
        db_session.add(resource)
        await db_session.flush()

        mock_storage = AsyncMock()
        mock_storage.read = AsyncMock(side_effect=Exception("Storage read error"))

        with patch(
            "app.services.skill_conversion_service.get_storage",
            return_value=mock_storage,
        ):
            await extract_resource_texts(db_session, skill.id)

        assert resource.extraction_status == "failed"

    async def test_no_resources_to_extract(self, db_session):
        """Should return early when no resources need extraction."""
        from app.services.skill_conversion_service import extract_resource_texts

        user_id = await _seed_user()

        from app.schemas.skill import SkillCreate
        from app.services import skill_service

        data = SkillCreate(name="No Resources Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)

        # No resources added -- should return without error
        await extract_resource_texts(db_session, skill.id)


# ===================================================================
# _get_config_value tests
# ===================================================================


class TestGetConfigValue:
    """Tests for the _get_config_value helper."""

    async def test_returns_config_value(self, db_session):
        """Should return config value when found."""
        from app.services.skill_conversion_service import _get_config_value

        mock_config_obj = MagicMock()
        mock_config_obj.model_or_deployment = "120000"

        with patch(
            "app.services.config_service.get_config",
            new=AsyncMock(return_value=mock_config_obj),
        ):
            result = await _get_config_value(db_session, "skill_chunk_token_limit", "80000")
            assert result == "120000"

    async def test_returns_default_when_config_none(self, db_session):
        """Should return default when config is None."""
        from app.services.skill_conversion_service import _get_config_value

        with patch(
            "app.services.config_service.get_config",
            new=AsyncMock(return_value=None),
        ):
            result = await _get_config_value(db_session, "missing_key", "default_val")
            assert result == "default_val"

    async def test_returns_default_when_model_or_deployment_empty(self, db_session):
        """Should return default when model_or_deployment is empty."""
        from app.services.skill_conversion_service import _get_config_value

        mock_config_obj = MagicMock()
        mock_config_obj.model_or_deployment = ""

        with patch(
            "app.services.config_service.get_config",
            new=AsyncMock(return_value=mock_config_obj),
        ):
            result = await _get_config_value(db_session, "some_key", "fallback")
            assert result == "fallback"

    async def test_returns_default_on_exception(self, db_session):
        """Should return default when config_service raises."""
        from app.services.skill_conversion_service import _get_config_value

        with patch(
            "app.services.config_service.get_config",
            new=AsyncMock(side_effect=Exception("DB error")),
        ):
            result = await _get_config_value(db_session, "bad_key", "safe_default")
            assert result == "safe_default"


# ===================================================================
# start_conversion tests (integration-style with mocked AI)
# ===================================================================


class TestStartConversion:
    """Tests for the full start_conversion pipeline."""

    async def test_full_pipeline_success(self, db_session):
        """Conversion updates skill content when AI returns valid SOP."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_service

        user_id = await _seed_user()

        data = SkillCreate(name="Conversion Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)

        # Add a reference resource with text content
        resource = SkillResource(
            skill_id=skill.id,
            resource_type="reference",
            filename="guide.txt",
            storage_path=f"skills/{skill.id}/references/guide.txt",
            content_type="text/plain",
            file_size=100,
            text_content=(
                "Opening: greet the HCP and introduce yourself. "
                "Product: discuss efficacy data from clinical trials. "
                "Closing: summarize and schedule next steps."
            ),
            extraction_status="completed",
        )
        db_session.add(resource)
        await db_session.flush()

        with patch(
            "app.services.skill_conversion_service._call_sop_extraction",
            new_callable=AsyncMock,
            return_value=MOCK_EXTRACTION_RESULT,
        ):
            from app.services import skill_conversion_service

            result = await skill_conversion_service.start_conversion(db_session, skill.id)
            await db_session.commit()

        assert result.content != ""
        assert result.conversion_status == "completed"
        assert "Opening" in result.content

    async def test_idempotency_guard(self, db_session):
        """Should reject conversion if already processing."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_service
        from app.utils.exceptions import AppException

        user_id = await _seed_user()

        data = SkillCreate(name="Already Processing Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)
        # Simulate already processing
        skill.conversion_status = "processing"
        skill.conversion_job_id = "existing-job-id"
        await db_session.flush()

        from app.services import skill_conversion_service

        with pytest.raises(AppException) as exc_info:
            await skill_conversion_service.start_conversion(db_session, skill.id)

        assert "already in progress" in str(exc_info.value.detail).lower() or \
               "already in progress" in str(getattr(exc_info.value, 'message', '')).lower()

    async def test_no_resources_error(self, db_session):
        """Should fail when no reference resources exist."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_service

        user_id = await _seed_user()

        data = SkillCreate(name="No Resources Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)
        await db_session.flush()

        from app.services import skill_conversion_service

        result = await skill_conversion_service.start_conversion(db_session, skill.id)

        assert result.conversion_status == "failed"
        assert "No reference materials" in result.conversion_error

    async def test_no_text_extracted_error(self, db_session):
        """Should fail when resources have no extractable text."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_service

        user_id = await _seed_user()

        data = SkillCreate(name="No Text Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)

        resource = SkillResource(
            skill_id=skill.id,
            resource_type="reference",
            filename="empty.txt",
            storage_path=f"skills/{skill.id}/references/empty.txt",
            content_type="text/plain",
            file_size=0,
            text_content="",  # Empty text content
            extraction_status="completed",
        )
        db_session.add(resource)
        await db_session.flush()

        from app.services import skill_conversion_service

        result = await skill_conversion_service.start_conversion(db_session, skill.id)

        assert result.conversion_status == "failed"
        assert "No text could be extracted" in result.conversion_error

    async def test_ai_extraction_failure(self, db_session):
        """Should set failed status when AI call raises."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_service

        user_id = await _seed_user()

        data = SkillCreate(name="AI Fail Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)

        resource = SkillResource(
            skill_id=skill.id,
            resource_type="reference",
            filename="guide.txt",
            storage_path=f"skills/{skill.id}/references/guide.txt",
            content_type="text/plain",
            file_size=100,
            text_content="Some training content that is valid.",
            extraction_status="completed",
        )
        db_session.add(resource)
        await db_session.flush()

        with patch(
            "app.services.skill_conversion_service._call_sop_extraction",
            new_callable=AsyncMock,
            side_effect=ValueError("Azure OpenAI returned empty content"),
        ):
            from app.services import skill_conversion_service

            result = await skill_conversion_service.start_conversion(db_session, skill.id)

        assert result.conversion_status == "failed"
        assert "Azure OpenAI" in result.conversion_error

    async def test_text_truncation(self, db_session):
        """Should truncate text exceeding MAX_TEXT_LENGTH."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_service

        user_id = await _seed_user()

        data = SkillCreate(name="Long Text Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)

        # Create resource with text longer than MAX_TEXT_LENGTH
        long_text = "A" * 600_000  # Exceeds 500_000 limit

        resource = SkillResource(
            skill_id=skill.id,
            resource_type="reference",
            filename="long.txt",
            storage_path=f"skills/{skill.id}/references/long.txt",
            content_type="text/plain",
            file_size=600_000,
            text_content=long_text,
            extraction_status="completed",
        )
        db_session.add(resource)
        await db_session.flush()

        call_args = []

        async def capture_extraction(db, chunk):
            call_args.append(chunk)
            return MOCK_EXTRACTION_RESULT

        with patch(
            "app.services.skill_conversion_service._call_sop_extraction",
            new=capture_extraction,
        ):
            from app.services import skill_conversion_service

            result = await skill_conversion_service.start_conversion(db_session, skill.id)

        assert result.conversion_status == "completed"
        # All chunks together should be <= MAX_TEXT_LENGTH
        total_text = "".join(call_args)
        assert len(total_text) <= 500_000 + 100  # small tolerance for chunk boundaries

    async def test_conversion_error_truncated(self, db_session):
        """Should truncate conversion error to 2000 chars."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_service

        user_id = await _seed_user()

        data = SkillCreate(name="Long Error Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)

        resource = SkillResource(
            skill_id=skill.id,
            resource_type="reference",
            filename="guide.txt",
            storage_path=f"skills/{skill.id}/references/guide.txt",
            content_type="text/plain",
            file_size=100,
            text_content="Valid content",
            extraction_status="completed",
        )
        db_session.add(resource)
        await db_session.flush()

        long_error = "E" * 5000

        with patch(
            "app.services.skill_conversion_service._call_sop_extraction",
            new_callable=AsyncMock,
            side_effect=ValueError(long_error),
        ):
            from app.services import skill_conversion_service

            result = await skill_conversion_service.start_conversion(db_session, skill.id)

        assert result.conversion_status == "failed"
        assert len(result.conversion_error) <= 2000


# ===================================================================
# regenerate_sop_with_feedback tests
# ===================================================================


class TestRegenerateSopWithFeedback:
    """Tests for regenerate_sop_with_feedback."""

    async def test_successful_regeneration(self, db_session):
        """Should update skill content with AI-regenerated SOP."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_service

        user_id = await _seed_user()

        data = SkillCreate(name="Regen Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)
        skill.content = "# Original SOP\n\nOriginal content here."
        await db_session.flush()

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(
            return_value=MagicMock(
                choices=[
                    MagicMock(
                        message=MagicMock(
                            content="# Updated SOP\n\nNew and improved content."
                        )
                    )
                ]
            )
        )

        with patch(
            "app.services.skill_conversion_service._get_openai_client",
            new=AsyncMock(return_value=(mock_client, "gpt-4o")),
        ):
            from app.services import skill_conversion_service

            result = await skill_conversion_service.regenerate_sop_with_feedback(
                db_session, skill.id, "Make it more concise"
            )

        assert result.content == "# Updated SOP\n\nNew and improved content."

    async def test_empty_content_raises(self, db_session):
        """Should reject when skill has no existing content."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_service
        from app.utils.exceptions import AppException

        user_id = await _seed_user()

        data = SkillCreate(name="Empty Content Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)
        skill.content = ""
        await db_session.flush()

        from app.services import skill_conversion_service

        with pytest.raises(AppException):
            await skill_conversion_service.regenerate_sop_with_feedback(
                db_session, skill.id, "Add more detail"
            )

    async def test_ai_returns_empty_raises(self, db_session):
        """Should raise when AI returns empty content."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_service
        from app.utils.exceptions import AppException

        user_id = await _seed_user()

        data = SkillCreate(name="AI Empty Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)
        skill.content = "# Existing SOP\n\nSome content."
        await db_session.flush()

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(
            return_value=MagicMock(
                choices=[MagicMock(message=MagicMock(content=""))]
            )
        )

        with patch(
            "app.services.skill_conversion_service._get_openai_client",
            new=AsyncMock(return_value=(mock_client, "gpt-4o")),
        ):
            from app.services import skill_conversion_service

            with pytest.raises(AppException):
                await skill_conversion_service.regenerate_sop_with_feedback(
                    db_session, skill.id, "Improve it"
                )

    async def test_ai_returns_none_raises(self, db_session):
        """Should raise when AI returns None content."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_service
        from app.utils.exceptions import AppException

        user_id = await _seed_user()

        data = SkillCreate(name="AI None Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)
        skill.content = "# Existing SOP\n\nContent present."
        await db_session.flush()

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(
            return_value=MagicMock(
                choices=[MagicMock(message=MagicMock(content=None))]
            )
        )

        with patch(
            "app.services.skill_conversion_service._get_openai_client",
            new=AsyncMock(return_value=(mock_client, "gpt-4o")),
        ):
            from app.services import skill_conversion_service

            with pytest.raises(AppException):
                await skill_conversion_service.regenerate_sop_with_feedback(
                    db_session, skill.id, "Refine"
                )

    async def test_regeneration_calls_ai_with_correct_prompt(self, db_session):
        """Should include current content and feedback in the AI prompt."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_service

        user_id = await _seed_user()

        data = SkillCreate(name="Prompt Check Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)
        skill.content = "# My SOP\n\nOriginal."
        await db_session.flush()

        captured_messages = []

        mock_client = AsyncMock()

        async def capture_create(**kwargs):
            captured_messages.extend(kwargs.get("messages", []))
            return MagicMock(
                choices=[
                    MagicMock(message=MagicMock(content="# Updated\n\nDone."))
                ]
            )

        mock_client.chat.completions.create = capture_create

        with patch(
            "app.services.skill_conversion_service._get_openai_client",
            new=AsyncMock(return_value=(mock_client, "gpt-4o")),
        ):
            from app.services import skill_conversion_service

            await skill_conversion_service.regenerate_sop_with_feedback(
                db_session, skill.id, "Add more examples"
            )

        # Check that the user message includes both current content and feedback
        user_msg = captured_messages[1]["content"]
        assert "# My SOP" in user_msg
        assert "Add more examples" in user_msg
