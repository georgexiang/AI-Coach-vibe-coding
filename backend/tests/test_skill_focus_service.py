"""Tests for SkillFocusService — SOP parsing and focus instruction composition."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.skill_focus_service import (
    compose_focus_instruction,
    detect_sop_step,
    extract_sop_steps,
)
from app.services.skill_manager import SkillContent


class TestExtractSopSteps:
    """Test SOP step extraction from various formats."""

    def test_numbered_dot_format(self):
        content = "1. Open the product detail page\n2. Present key benefits\n3. Address objections"
        steps = extract_sop_steps(content)
        assert len(steps) == 3
        assert steps[0] == "Open the product detail page"
        assert steps[2] == "Address objections"

    def test_numbered_paren_format(self):
        content = "1) Greet the doctor\n2) Introduce yourself\n3) Present data"
        steps = extract_sop_steps(content)
        assert len(steps) == 3
        assert steps[0] == "Greet the doctor"

    def test_step_colon_format(self):
        content = "Step 1: Introduction\nStep 2: Product overview\nStep 3: Close"
        steps = extract_sop_steps(content)
        assert len(steps) == 3
        assert steps[0] == "Introduction"

    def test_chinese_step_format(self):
        content = "步骤 1：开场白\n步骤 2：产品介绍\n步骤 3：总结"
        steps = extract_sop_steps(content)
        assert len(steps) == 3
        assert steps[0] == "开场白"

    def test_markdown_header_format(self):
        content = "## Step 1 Introduction\n\nSome content\n\n## Step 2 Discussion\n\nMore content"
        steps = extract_sop_steps(content)
        assert len(steps) == 2
        assert steps[0] == "Introduction"
        assert steps[1] == "Discussion"

    def test_fallback_paragraph_split(self):
        content = "First do this thing\n\nThen do another thing\n\nFinally wrap up"
        steps = extract_sop_steps(content)
        assert len(steps) == 3

    def test_empty_content(self):
        steps = extract_sop_steps("")
        assert steps == []

    def test_out_of_order_numbers(self):
        content = "3. Third step\n1. First step\n2. Second step"
        steps = extract_sop_steps(content)
        assert steps[0] == "First step"
        assert steps[2] == "Third step"


class TestComposeFocusInstruction:
    """Test focus instruction composition."""

    def make_skill(self, name="Test Skill", content="SOP content here"):
        return SkillContent(
            name=name,
            description="Test skill description",
            version_id="abc12345-6789",
            content=content,
            token_estimate=100,
        )

    def test_basic_composition(self):
        skill = self.make_skill()
        sop_steps = ["Introduction", "Discussion", "Close"]
        result = compose_focus_instruction(skill, current_step=1, sop_steps=sop_steps)

        assert "== SKILL FOCUS MODE ==" in result
        assert "Test Skill" in result
        assert "步骤 1/3" in result
        assert "Introduction" in result

    def test_not_started(self):
        skill = self.make_skill()
        sop_steps = ["Step A", "Step B"]
        result = compose_focus_instruction(skill, current_step=0, sop_steps=sop_steps)

        assert "Not started" in result

    def test_last_step(self):
        skill = self.make_skill()
        sop_steps = ["One", "Two", "Three"]
        result = compose_focus_instruction(skill, current_step=3, sop_steps=sop_steps)

        assert "步骤 3/3" in result
        assert "Three" in result

    def test_focus_rules_present(self):
        skill = self.make_skill()
        result = compose_focus_instruction(skill, current_step=1, sop_steps=["Step"])

        assert "Focus Rules" in result
        assert "ONLY discuss topics" in result
        assert "Gently redirect" in result

    def test_sop_content_included(self):
        skill = self.make_skill(content="Special SOP instructions here")
        result = compose_focus_instruction(skill, current_step=1, sop_steps=["Step"])

        assert "Special SOP instructions here" in result


class TestDetectSopStep:
    """Test SOP step detection via LLM."""

    @pytest.mark.asyncio
    async def test_empty_steps_returns_zero(self):
        result = await detect_sop_step(
            conversation_history=[{"role": "user", "content": "hello"}],
            sop_steps=[],
            endpoint="https://example.com",
            api_key="test-key",
        )
        assert result == 0

    @pytest.mark.asyncio
    async def test_empty_conversation_returns_zero(self):
        result = await detect_sop_step(
            conversation_history=[],
            sop_steps=["Step 1", "Step 2"],
            endpoint="https://example.com",
            api_key="test-key",
        )
        assert result == 0

    @pytest.mark.asyncio
    async def test_successful_detection(self):
        mock_response = AsyncMock()
        mock_response.choices = [AsyncMock()]
        mock_response.choices[0].message.content = "2"

        with patch("openai.AsyncAzureOpenAI") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await detect_sop_step(
                conversation_history=[
                    {"role": "user", "content": "Let me tell you about the product benefits"},
                    {"role": "assistant", "content": "That sounds great"},
                ],
                sop_steps=["Introduction", "Benefits", "Close"],
                endpoint="https://test.openai.azure.com",
                api_key="test-key",
            )

        assert result == 2

    @pytest.mark.asyncio
    async def test_clamps_to_valid_range(self):
        mock_response = AsyncMock()
        mock_response.choices = [AsyncMock()]
        mock_response.choices[0].message.content = "99"

        with patch("openai.AsyncAzureOpenAI") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await detect_sop_step(
                conversation_history=[{"role": "user", "content": "test"}],
                sop_steps=["A", "B", "C"],
                endpoint="https://test.openai.azure.com",
                api_key="key",
            )

        assert result == 3  # Clamped to max

    @pytest.mark.asyncio
    async def test_handles_parse_error(self):
        mock_response = AsyncMock()
        mock_response.choices = [AsyncMock()]
        mock_response.choices[0].message.content = "not a number"

        with patch("openai.AsyncAzureOpenAI") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await detect_sop_step(
                conversation_history=[{"role": "user", "content": "test"}],
                sop_steps=["A", "B"],
                endpoint="https://test.openai.azure.com",
                api_key="key",
            )

        assert result == 0
