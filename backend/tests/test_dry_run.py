"""Tests for Dry Run data layer, engine helpers, and API endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.dry_run import DryRun, DryRunMessage
from app.models.skill import Skill
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from app.services.dry_run_engine import (
    _call_llm,
    _compute_executability_score,
    _compute_sop_coverage,
    _extract_sop_steps,
    _identify_issues,
    _is_conversation_ending,
    _match_sop_step,
    _tokenize,
    run_dry_run_simulation,
)
from app.services.dry_run_service import (
    cancel_dry_run,
    create_dry_run,
    dry_run_to_out,
    get_dry_run,
    get_dry_run_or_404,
    list_dry_runs,
)
from tests.conftest import TestSessionLocal

# ---------------------------------------------------------------------------
# Helper to create admin user + token
# ---------------------------------------------------------------------------


async def _create_admin_and_token(username: str = "dry_run_admin") -> tuple[str, str]:
    """Create an admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Dry Run Admin",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


async def _create_skill_with_content(client, token: str, name: str = "Test Skill") -> str:
    """Create a skill with SOP content via API and return skill_id."""
    sop_content = (
        "## Step 1: Opening Greeting\n"
        "Greet the doctor and introduce yourself.\n\n"
        "## Step 2: Need Identification\n"
        "Identify the doctor's current treatment approach.\n\n"
        "## Step 3: Product Introduction\n"
        "Present the key benefits of the pharmaceutical product.\n\n"
        "## Step 4: Efficacy Data\n"
        "Share clinical trial data and efficacy evidence.\n\n"
        "## Step 5: Closing\n"
        "Summarize key points and schedule follow-up."
    )
    resp = await client.post(
        "/api/v1/skills",
        json={"name": name, "content": sop_content, "product": "TestProd"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


# ===========================================================================
# Unit Tests: Engine Helpers (no DB needed)
# ===========================================================================


class TestExtractSopSteps:
    """Tests for _extract_sop_steps helper."""

    def test_extract_sop_steps_from_markdown(self):
        content = (
            "## Step 1: Opening Greeting\n"
            "Greet the doctor.\n\n"
            "## Step 2: Need Identification\n"
            "Ask about treatment.\n\n"
            "## Step 3: Product Introduction\n"
            "Present the product."
        )
        steps = _extract_sop_steps(content)
        assert len(steps) == 3
        assert steps[0]["step_id"] == "step_1"
        assert steps[0]["step_name"] == "Opening Greeting"
        assert steps[1]["step_id"] == "step_2"
        assert steps[2]["step_id"] == "step_3"

    def test_extract_sop_steps_from_numbered_list(self):
        content = (
            "1. Opening greeting and introduction\n"
            "2. Need identification with doctor\n"
            "3. Product introduction and benefits"
        )
        steps = _extract_sop_steps(content)
        assert len(steps) == 3
        assert steps[0]["step_name"] == "Opening greeting and introduction"
        assert steps[1]["step_id"] == "step_2"
        assert steps[2]["step_id"] == "step_3"

    def test_extract_sop_steps_empty_content(self):
        steps = _extract_sop_steps("")
        assert len(steps) == 1
        assert steps[0]["step_id"] == "step_1"
        assert steps[0]["step_name"] == "Full Content"

    def test_extract_sop_steps_no_structure(self):
        content = "This is just plain text without any step markers."
        steps = _extract_sop_steps(content)
        assert len(steps) == 1
        assert steps[0]["step_name"] == "Full Content"


class TestMatchSopStep:
    """Tests for _match_sop_step helper."""

    def test_match_sop_step_mr_message(self):
        steps = [
            {
                "step_id": "step_1",
                "step_name": "Opening Greeting",
                "step_content": "greet the doctor introduction",
            },
            {
                "step_id": "step_2",
                "step_name": "Efficacy Data",
                "step_content": "clinical trial data efficacy evidence results",
            },
        ]
        message = (
            "Good morning doctor. I want to share the clinical "
            "trial efficacy data and evidence with you."
        )
        result = _match_sop_step(message, steps, "mr")
        assert result is not None
        assert result["step_id"] == "step_2"

    def test_match_sop_step_hcp_message_no_match(self):
        steps = [
            {
                "step_id": "step_1",
                "step_name": "Greeting",
                "step_content": "greet the doctor introduction",
            },
        ]
        message = "What are the side effects and efficacy data?"
        result = _match_sop_step(message, steps, "hcp")
        assert result is None

    def test_match_sop_step_no_overlap(self):
        steps = [
            {
                "step_id": "step_1",
                "step_name": "Closing",
                "step_content": "schedule follow up appointment next time",
            },
        ]
        message = "Hello there"
        result = _match_sop_step(message, steps, "mr")
        assert result is None

    def test_match_sop_step_empty_tokens(self):
        """Message with only short words (len <= 3) returns None (line 177)."""
        steps = [
            {
                "step_id": "step_1",
                "step_name": "Greeting",
                "step_content": "greet the doctor introduction",
            },
        ]
        # All words are 3 chars or less — _tokenize returns empty set
        message = "I am ok to go"
        result = _match_sop_step(message, steps, "mr")
        assert result is None


class TestComputeSopCoverage:
    """Tests for _compute_sop_coverage helper."""

    def test_compute_sop_coverage(self):
        steps = [
            {"step_id": "step_1", "step_name": "Greeting", "step_content": "greet the doctor"},
            {"step_id": "step_2", "step_name": "Data", "step_content": "present data"},
            {"step_id": "step_3", "step_name": "Closing", "step_content": "schedule follow up"},
        ]
        messages = [
            {"role": "mr", "content": "Hello doctor", "sop_step_id": "step_1"},
            {"role": "hcp", "content": "Hello", "sop_step_id": None},
            {"role": "mr", "content": "data results", "sop_step_id": "step_2"},
        ]
        coverage = _compute_sop_coverage(steps, messages)
        assert len(coverage) == 3
        assert coverage[0]["status"] == "covered"
        assert coverage[1]["status"] == "covered"
        # step_3 not covered
        assert coverage[2]["status"] in ("not_covered", "partial")


class TestIdentifyIssues:
    """Tests for _identify_issues helper."""

    def test_identify_issues_uncovered_steps(self):
        coverage = [
            {
                "step_id": "step_1",
                "step_name": "Greeting",
                "status": "covered",
                "matched_message_ids": [0],
                "details": "",
            },
            {
                "step_id": "step_2",
                "step_name": "Data",
                "status": "not_covered",
                "matched_message_ids": [],
                "details": "",
            },
        ]
        steps = [
            {"step_id": "step_1", "step_name": "Greeting"},
            {"step_id": "step_2", "step_name": "Data"},
        ]
        issues = _identify_issues(coverage, steps)
        assert len(issues) == 1
        assert issues[0]["severity"] == "error"
        assert "Data" in issues[0]["description"]

    def test_identify_issues_partial_steps(self):
        coverage = [
            {
                "step_id": "step_1",
                "step_name": "Greeting",
                "status": "partial",
                "matched_message_ids": [],
                "details": "",
            },
        ]
        steps = [
            {"step_id": "step_1", "step_name": "Greeting"},
        ]
        issues = _identify_issues(coverage, steps)
        assert len(issues) == 1
        assert issues[0]["severity"] == "warning"

    def test_identify_issues_all_covered(self):
        coverage = [
            {
                "step_id": "step_1",
                "step_name": "Greeting",
                "status": "covered",
                "matched_message_ids": [0],
                "details": "",
            },
        ]
        steps = [
            {"step_id": "step_1", "step_name": "Greeting"},
        ]
        issues = _identify_issues(coverage, steps)
        assert len(issues) == 0


class TestComputeExecutabilityScore:
    """Tests for _compute_executability_score helper."""

    def test_compute_executability_score_full_coverage(self):
        coverage = [
            {"status": "covered"},
            {"status": "covered"},
            {"status": "covered"},
        ]
        score = _compute_executability_score(coverage, 10)
        assert score >= 100  # 100 base + quality bonus, capped at 100
        assert score == 100

    def test_compute_executability_score_partial(self):
        coverage = [
            {"status": "covered"},
            {"status": "partial"},
            {"status": "not_covered"},
        ]
        score = _compute_executability_score(coverage, 6)
        # Base: (1*100 + 1*50) / 3 = 50
        assert 40 <= score <= 60

    def test_compute_executability_score_empty(self):
        score = _compute_executability_score([], 0)
        assert score == 0

    def test_compute_executability_score_quality_bonus(self):
        coverage = [
            {"status": "covered"},
            {"status": "covered"},
        ]
        score_short = _compute_executability_score(coverage, 4)
        score_long = _compute_executability_score(coverage, 12)
        # Quality bonus kicks in at 8+ messages
        assert score_long >= score_short


class TestIsConversationEnding:
    """Tests for _is_conversation_ending helper."""

    def test_ending_phrase(self):
        assert _is_conversation_ending("Thank you for your time, doctor.", 5) is True

    def test_not_ending(self):
        assert _is_conversation_ending("Let me share the data.", 5) is False

    def test_high_turn_number(self):
        assert _is_conversation_ending("Normal message", 18) is True

    def test_low_turn_no_phrase(self):
        assert _is_conversation_ending("I have a question about dosing", 3) is False


# ===========================================================================
# API Endpoint Tests
# ===========================================================================


async def _noop_simulation(dry_run_id: str) -> None:
    """No-op replacement for run_dry_run_simulation in tests."""
    pass


@pytest.mark.asyncio
class TestDryRunApi:
    """Tests for Dry Run API endpoints."""

    async def test_create_dry_run(self, client):
        _, token = await _create_admin_and_token("create_dr_admin")
        skill_id = await _create_skill_with_content(client, token)

        with patch("app.api.dry_runs.run_dry_run_simulation", side_effect=_noop_simulation):
            resp = await client.post(
                f"/api/v1/skills/{skill_id}/dry-runs",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "pending"
        assert data["run_number"] == 1
        assert data["skill_id"] == skill_id

    async def test_list_dry_runs(self, client):
        _, token = await _create_admin_and_token("list_dr_admin")
        skill_id = await _create_skill_with_content(client, token)

        # Create 2 dry runs
        with patch("app.api.dry_runs.run_dry_run_simulation", side_effect=_noop_simulation):
            await client.post(
                f"/api/v1/skills/{skill_id}/dry-runs",
                headers={"Authorization": f"Bearer {token}"},
            )
            await client.post(
                f"/api/v1/skills/{skill_id}/dry-runs",
                headers={"Authorization": f"Bearer {token}"},
            )

        resp = await client.get(
            f"/api/v1/skills/{skill_id}/dry-runs",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    async def test_get_dry_run_detail(self, client):
        _, token = await _create_admin_and_token("get_dr_admin")
        skill_id = await _create_skill_with_content(client, token)

        with patch("app.api.dry_runs.run_dry_run_simulation", side_effect=_noop_simulation):
            create_resp = await client.post(
                f"/api/v1/skills/{skill_id}/dry-runs",
                headers={"Authorization": f"Bearer {token}"},
            )
        run_id = create_resp.json()["id"]

        resp = await client.get(
            f"/api/v1/skills/{skill_id}/dry-runs/{run_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == run_id
        assert "messages" in data
        assert "sop_coverage" in data

    async def test_get_dry_run_status(self, client):
        _, token = await _create_admin_and_token("status_dr_admin")
        skill_id = await _create_skill_with_content(client, token)

        with patch("app.api.dry_runs.run_dry_run_simulation", side_effect=_noop_simulation):
            create_resp = await client.post(
                f"/api/v1/skills/{skill_id}/dry-runs",
                headers={"Authorization": f"Bearer {token}"},
            )
        run_id = create_resp.json()["id"]

        resp = await client.get(
            f"/api/v1/skills/{skill_id}/dry-runs/{run_id}/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "pending"
        assert "covered_sop_steps" in data
        assert "total_sop_steps" in data
        assert "coverage_percent" in data

    async def test_cancel_dry_run(self, client):
        _, token = await _create_admin_and_token("cancel_dr_admin")
        skill_id = await _create_skill_with_content(client, token)

        with patch("app.api.dry_runs.run_dry_run_simulation", side_effect=_noop_simulation):
            create_resp = await client.post(
                f"/api/v1/skills/{skill_id}/dry-runs",
                headers={"Authorization": f"Bearer {token}"},
            )
        run_id = create_resp.json()["id"]

        resp = await client.post(
            f"/api/v1/skills/{skill_id}/dry-runs/{run_id}/cancel",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "cancelled"

    async def test_create_dry_run_no_content(self, client):
        _, token = await _create_admin_and_token("nocontent_dr_admin")

        # Create a skill without content
        resp = await client.post(
            "/api/v1/skills",
            json={"name": "Empty Skill", "product": "P"},
            headers={"Authorization": f"Bearer {token}"},
        )
        skill_id = resp.json()["id"]

        with patch("app.api.dry_runs.run_dry_run_simulation", side_effect=_noop_simulation):
            resp = await client.post(
                f"/api/v1/skills/{skill_id}/dry-runs",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 422  # ValidationException

    async def test_cancel_completed_dry_run(self, client):
        _, token = await _create_admin_and_token("cancel_comp_admin")
        skill_id = await _create_skill_with_content(client, token)

        with patch("app.api.dry_runs.run_dry_run_simulation", side_effect=_noop_simulation):
            create_resp = await client.post(
                f"/api/v1/skills/{skill_id}/dry-runs",
                headers={"Authorization": f"Bearer {token}"},
            )
        run_id = create_resp.json()["id"]

        # Cancel it first
        await client.post(
            f"/api/v1/skills/{skill_id}/dry-runs/{run_id}/cancel",
            headers={"Authorization": f"Bearer {token}"},
        )

        # Try to cancel again -- should fail
        resp = await client.post(
            f"/api/v1/skills/{skill_id}/dry-runs/{run_id}/cancel",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422  # Already cancelled

    async def test_sequential_run_numbers(self, client):
        _, token = await _create_admin_and_token("seq_dr_admin")
        skill_id = await _create_skill_with_content(client, token)

        with patch("app.api.dry_runs.run_dry_run_simulation", side_effect=_noop_simulation):
            r1 = await client.post(
                f"/api/v1/skills/{skill_id}/dry-runs",
                headers={"Authorization": f"Bearer {token}"},
            )
            r2 = await client.post(
                f"/api/v1/skills/{skill_id}/dry-runs",
                headers={"Authorization": f"Bearer {token}"},
            )
            r3 = await client.post(
                f"/api/v1/skills/{skill_id}/dry-runs",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert r1.json()["run_number"] == 1
        assert r2.json()["run_number"] == 2
        assert r3.json()["run_number"] == 3

    async def test_get_dry_run_wrong_skill_id(self, client):
        """GET detail with mismatched skill_id returns 404."""
        _, token = await _create_admin_and_token("wrong_skill_admin")
        skill_id = await _create_skill_with_content(client, token)

        with patch("app.api.dry_runs.run_dry_run_simulation", side_effect=_noop_simulation):
            create_resp = await client.post(
                f"/api/v1/skills/{skill_id}/dry-runs",
                headers={"Authorization": f"Bearer {token}"},
            )
        run_id = create_resp.json()["id"]

        # Request with a different skill_id
        resp = await client.get(
            f"/api/v1/skills/nonexistent-skill-id/dry-runs/{run_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_cancel_dry_run_wrong_skill_id(self, client):
        """POST cancel with mismatched skill_id returns 404."""
        _, token = await _create_admin_and_token("cancel_wrong_admin")
        skill_id = await _create_skill_with_content(client, token)

        with patch("app.api.dry_runs.run_dry_run_simulation", side_effect=_noop_simulation):
            create_resp = await client.post(
                f"/api/v1/skills/{skill_id}/dry-runs",
                headers={"Authorization": f"Bearer {token}"},
            )
        run_id = create_resp.json()["id"]

        resp = await client.post(
            f"/api/v1/skills/nonexistent-skill-id/dry-runs/{run_id}/cancel",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_get_status_not_found(self, client):
        """GET status for nonexistent run returns 404."""
        _, token = await _create_admin_and_token("status_nf_admin")
        skill_id = await _create_skill_with_content(client, token)

        resp = await client.get(
            f"/api/v1/skills/{skill_id}/dry-runs/nonexistent-id/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_get_status_wrong_skill_id(self, client):
        """GET status with mismatched skill_id returns 404."""
        _, token = await _create_admin_and_token("status_ws_admin")
        skill_id = await _create_skill_with_content(client, token)

        with patch("app.api.dry_runs.run_dry_run_simulation", side_effect=_noop_simulation):
            create_resp = await client.post(
                f"/api/v1/skills/{skill_id}/dry-runs",
                headers={"Authorization": f"Bearer {token}"},
            )
        run_id = create_resp.json()["id"]

        resp = await client.get(
            f"/api/v1/skills/wrong-skill-id/dry-runs/{run_id}/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404


# ===========================================================================
# Unit Tests: _tokenize helper
# ===========================================================================


class TestTokenize:
    """Tests for _tokenize helper."""

    def test_tokenize_basic(self):
        tokens = _tokenize("Hello world clinical trial data")
        assert "hello" in tokens
        assert "world" in tokens
        assert "clinical" in tokens
        # Words with len <= 3 are excluded
        assert "the" not in tokens

    def test_tokenize_filters_short_words(self):
        tokens = _tokenize("I am a dog in the car")
        # "dog", "car" have len == 3, _MIN_WORD_LENGTH = 3, condition is > 3
        assert "dog" not in tokens
        assert "car" not in tokens

    def test_tokenize_empty_string(self):
        tokens = _tokenize("")
        assert tokens == set()

    def test_tokenize_special_characters(self):
        tokens = _tokenize("Hello! What's the efficacy-data?")
        assert "hello" in tokens
        assert "what" in tokens
        assert "efficacy" in tokens
        assert "data" in tokens


# ===========================================================================
# Unit Tests: _call_llm
# ===========================================================================


@pytest.mark.asyncio
class TestCallLlm:
    """Tests for _call_llm helper."""

    async def test_call_llm_success(self):
        """Successful LLM call returns content."""
        mock_choice = MagicMock()
        mock_choice.message.content = "Hello doctor, I am here to present our product."
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        mock_openai_client = MagicMock()
        mock_openai_client.chat.completions.create.return_value = mock_response

        mock_project_client = MagicMock()
        mock_project_client.get_openai_client.return_value = mock_openai_client

        with patch(
            "app.services.agent_sync_service._get_project_client",
            return_value=mock_project_client,
        ):
            result = await _call_llm(
                "You are an MR.",
                [{"role": "mr", "content": "Hello"}],
                "mr",
                project_endpoint="https://test.endpoint",
                api_key="test-key",
            )
        assert result == "Hello doctor, I am here to present our product."

    async def test_call_llm_truncates_long_response(self):
        """Response truncated to 500 chars."""
        long_content = "A" * 600
        mock_choice = MagicMock()
        mock_choice.message.content = long_content
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        mock_openai_client = MagicMock()
        mock_openai_client.chat.completions.create.return_value = mock_response

        mock_project_client = MagicMock()
        mock_project_client.get_openai_client.return_value = mock_openai_client

        with patch(
            "app.services.agent_sync_service._get_project_client",
            return_value=mock_project_client,
        ):
            result = await _call_llm(
                "system", [], "mr",
                project_endpoint="https://test.endpoint",
                api_key="key",
            )
        assert len(result) == 500

    async def test_call_llm_none_content(self):
        """None content returns empty string."""
        mock_choice = MagicMock()
        mock_choice.message.content = None
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        mock_openai_client = MagicMock()
        mock_openai_client.chat.completions.create.return_value = mock_response

        mock_project_client = MagicMock()
        mock_project_client.get_openai_client.return_value = mock_openai_client

        with patch(
            "app.services.agent_sync_service._get_project_client",
            return_value=mock_project_client,
        ):
            result = await _call_llm(
                "system", [], "mr",
                project_endpoint="https://ep",
                api_key="key",
            )
        assert result == ""

    async def test_call_llm_exception_returns_fallback(self):
        """Exception returns fallback message."""
        with patch(
            "app.services.agent_sync_service._get_project_client",
            side_effect=Exception("Connection failed"),
        ):
            result = await _call_llm(
                "system", [], "mr",
                project_endpoint="https://ep",
                api_key="key",
            )
        assert "[mr unavailable" in result.lower()

    async def test_call_llm_mixed_conversation_roles(self):
        """Conversation with both mr and hcp messages maps roles correctly (line 376)."""
        mock_choice = MagicMock()
        mock_choice.message.content = "Response from HCP agent"
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        mock_openai_client = MagicMock()
        mock_openai_client.chat.completions.create.return_value = mock_response

        mock_project_client = MagicMock()
        mock_project_client.get_openai_client.return_value = mock_openai_client

        conversation = [
            {"role": "mr", "content": "Hello doctor"},
            {"role": "hcp", "content": "Hi, tell me about the product"},
            {"role": "mr", "content": "Here are the benefits"},
        ]

        with patch(
            "app.services.agent_sync_service._get_project_client",
            return_value=mock_project_client,
        ):
            # Call as HCP agent — mr messages become "user", hcp messages become "assistant"
            result = await _call_llm(
                "You are an HCP.",
                conversation,
                "hcp",
                project_endpoint="https://test.endpoint",
                api_key="test-key",
            )
        assert result == "Response from HCP agent"

        # Verify the messages were mapped correctly
        call_args = mock_openai_client.chat.completions.create.call_args
        messages = call_args.kwargs["messages"]
        # system + 3 conversation messages
        assert len(messages) == 4
        assert messages[1]["role"] == "user"  # mr -> user (not the agent)
        assert messages[2]["role"] == "assistant"  # hcp -> assistant (is the agent)
        assert messages[3]["role"] == "user"  # mr -> user


# ===========================================================================
# Unit Tests: _compute_sop_coverage partial/not_covered branches
# ===========================================================================


class TestComputeSopCoverageEdgeCases:
    """Edge case tests for _compute_sop_coverage."""

    def test_coverage_partial_match(self):
        """Step with weak keyword overlap (1 match) should be partial."""
        steps = [
            {
                "step_id": "step_1",
                "step_name": "Greeting Introduction",
                "step_content": "greet welcome doctor",
            },
        ]
        # No sop_step_id match, but "greeting" overlaps with step name via 1 token
        messages = [
            {"role": "mr", "content": "Good morning greeting welcome today", "sop_step_id": None},
        ]
        coverage = _compute_sop_coverage(steps, messages)
        assert coverage[0]["status"] in ("partial", "covered")

    def test_coverage_no_mr_messages(self):
        """Only HCP messages — steps should be not_covered."""
        steps = [
            {
                "step_id": "step_1",
                "step_name": "Greeting",
                "step_content": "greet the doctor morning",
            },
        ]
        messages = [
            {"role": "hcp", "content": "Good morning greeting welcome", "sop_step_id": None},
        ]
        coverage = _compute_sop_coverage(steps, messages)
        assert coverage[0]["status"] == "not_covered"


# ===========================================================================
# Unit Tests: dry_run_service functions (direct DB)
# ===========================================================================


@pytest.mark.asyncio
class TestDryRunServiceDirect:
    """Direct service function tests using db_session fixture."""

    async def _create_user(self, session):
        user = User(
            username="svc_test_admin",
            email="svc_admin@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Service Test Admin",
            role="admin",
        )
        session.add(user)
        await session.flush()
        return user.id

    async def _create_skill(
        self, session, user_id, content="## Step 1: Greeting\nGreet the doctor."
    ):
        skill = Skill(
            name="Test Skill",
            product="TestProd",
            content=content,
            created_by=user_id,
        )
        session.add(skill)
        await session.flush()
        return skill.id

    async def test_create_dry_run_service(self, db_session):
        user_id = await self._create_user(db_session)
        skill_id = await self._create_skill(db_session, user_id)

        dry_run = await create_dry_run(db_session, skill_id, user_id)
        assert dry_run.skill_id == skill_id
        assert dry_run.run_number == 1
        assert dry_run.status == "pending"

    async def test_create_dry_run_skill_not_found(self, db_session):
        user_id = await self._create_user(db_session)
        from app.utils.exceptions import NotFoundException

        with pytest.raises(NotFoundException):
            await create_dry_run(db_session, "nonexistent-id", user_id)

    async def test_create_dry_run_no_content(self, db_session):
        user_id = await self._create_user(db_session)
        skill_id = await self._create_skill(db_session, user_id, content="")
        from app.utils.exceptions import ValidationException

        with pytest.raises(ValidationException):
            await create_dry_run(db_session, skill_id, user_id)

    async def test_create_dry_run_whitespace_content(self, db_session):
        user_id = await self._create_user(db_session)
        skill_id = await self._create_skill(db_session, user_id, content="   ")
        from app.utils.exceptions import ValidationException

        with pytest.raises(ValidationException):
            await create_dry_run(db_session, skill_id, user_id)

    async def test_create_dry_run_sequential_numbering(self, db_session):
        user_id = await self._create_user(db_session)
        skill_id = await self._create_skill(db_session, user_id)

        dr1 = await create_dry_run(db_session, skill_id, user_id)
        dr2 = await create_dry_run(db_session, skill_id, user_id)
        assert dr1.run_number == 1
        assert dr2.run_number == 2

    async def test_get_dry_run_service(self, db_session):
        user_id = await self._create_user(db_session)
        skill_id = await self._create_skill(db_session, user_id)
        created = await create_dry_run(db_session, skill_id, user_id)

        loaded = await get_dry_run(db_session, created.id)
        assert loaded is not None
        assert loaded.id == created.id
        assert loaded.messages is not None

    async def test_get_dry_run_not_found(self, db_session):
        result = await get_dry_run(db_session, "nonexistent-id")
        assert result is None

    async def test_get_dry_run_or_404_raises(self, db_session):
        from app.utils.exceptions import NotFoundException

        with pytest.raises(NotFoundException):
            await get_dry_run_or_404(db_session, "nonexistent-id")

    async def test_list_dry_runs_pagination(self, db_session):
        user_id = await self._create_user(db_session)
        skill_id = await self._create_skill(db_session, user_id)

        for _ in range(5):
            await create_dry_run(db_session, skill_id, user_id)

        items, total = await list_dry_runs(db_session, skill_id, page=1, page_size=2)
        assert total == 5
        assert len(items) == 2

        items2, _ = await list_dry_runs(db_session, skill_id, page=2, page_size=2)
        assert len(items2) == 2

    async def test_list_dry_runs_empty(self, db_session):
        items, total = await list_dry_runs(db_session, "nonexistent-id")
        assert total == 0
        assert len(items) == 0

    async def test_cancel_dry_run_service(self, db_session):
        user_id = await self._create_user(db_session)
        skill_id = await self._create_skill(db_session, user_id)
        created = await create_dry_run(db_session, skill_id, user_id)

        cancelled = await cancel_dry_run(db_session, created.id)
        assert cancelled.status == "cancelled"

    async def test_cancel_dry_run_invalid_status(self, db_session):
        user_id = await self._create_user(db_session)
        skill_id = await self._create_skill(db_session, user_id)
        created = await create_dry_run(db_session, skill_id, user_id)

        # Cancel first
        await cancel_dry_run(db_session, created.id)

        # Try to cancel again
        from app.utils.exceptions import ValidationException

        with pytest.raises(ValidationException):
            await cancel_dry_run(db_session, created.id)

    async def test_cancel_dry_run_not_found(self, db_session):
        from app.utils.exceptions import NotFoundException

        with pytest.raises(NotFoundException):
            await cancel_dry_run(db_session, "nonexistent-id")


# ===========================================================================
# Unit Tests: dry_run_to_out
# ===========================================================================


class TestDryRunToOut:
    """Tests for dry_run_to_out helper with various JSON parsing edge cases."""

    def _make_dry_run(self, **overrides):
        """Create a mock DryRun with default values."""
        dr = MagicMock(spec=DryRun)
        dr.id = "test-id"
        dr.skill_id = "skill-id"
        dr.run_number = 1
        dr.status = "completed"
        dr.executability_score = 85
        dr.coverage_percent = 80
        dr.total_sop_steps = 5
        dr.covered_sop_steps = 4
        dr.partial_sop_steps = 1
        dr.issues_count = 1
        dr.duration_seconds = 30
        dr.sop_coverage_json = "[]"
        dr.issues_json = "[]"
        dr.error_message = ""
        dr.created_by = "user-id"
        dr.created_at = "2026-01-01T00:00:00"
        dr.messages = []
        for k, v in overrides.items():
            setattr(dr, k, v)
        return dr

    def test_dry_run_to_out_basic(self):
        dr = self._make_dry_run()
        out = dry_run_to_out(dr)
        assert out["id"] == "test-id"
        assert out["status"] == "completed"
        assert out["sop_coverage"] == []
        assert out["issues"] == []
        assert out["messages"] == []

    def test_dry_run_to_out_with_valid_json(self):
        dr = self._make_dry_run(
            sop_coverage_json='[{"step_id":"step_1","status":"covered"}]',
            issues_json='[{"severity":"error","description":"missing step"}]',
        )
        out = dry_run_to_out(dr)
        assert len(out["sop_coverage"]) == 1
        assert out["sop_coverage"][0]["step_id"] == "step_1"
        assert len(out["issues"]) == 1

    def test_dry_run_to_out_malformed_json(self):
        dr = self._make_dry_run(
            sop_coverage_json="not valid json {{{",
            issues_json="also broken",
        )
        out = dry_run_to_out(dr)
        assert out["sop_coverage"] == []
        assert out["issues"] == []

    def test_dry_run_to_out_none_json(self):
        dr = self._make_dry_run(
            sop_coverage_json=None,
            issues_json=None,
        )
        out = dry_run_to_out(dr)
        assert out["sop_coverage"] == []
        assert out["issues"] == []

    def test_dry_run_to_out_error_truncation(self):
        long_error = "E" * 1000
        dr = self._make_dry_run(error_message=long_error)
        out = dry_run_to_out(dr)
        assert len(out["error_message"]) == 500

    def test_dry_run_to_out_with_messages(self):
        msg = MagicMock(spec=DryRunMessage)
        msg.id = "msg-1"
        msg.dry_run_id = "test-id"
        msg.sequence_number = 0
        msg.role = "mr"
        msg.content = "Hello doctor"
        msg.sop_step_id = "step_1"
        msg.sop_step_name = "Greeting"
        msg.created_at = "2026-01-01T00:00:00"

        dr = self._make_dry_run(messages=[msg])
        out = dry_run_to_out(dr)
        assert len(out["messages"]) == 1
        assert out["messages"][0]["role"] == "mr"
        assert out["messages"][0]["sop_step_id"] == "step_1"

    def test_dry_run_to_out_none_messages(self):
        dr = self._make_dry_run(messages=None)
        out = dry_run_to_out(dr)
        assert out["messages"] == []


# ===========================================================================
# Integration Tests: run_dry_run_simulation
# ===========================================================================


@pytest.mark.asyncio
class TestRunDryRunSimulation:
    """Tests for the full simulation background task with mocked LLM."""

    async def _setup_dry_run(self):
        """Create user + skill + dry_run in the test DB, return dry_run_id."""
        async with TestSessionLocal() as session:
            user = User(
                username="sim_admin",
                email="sim_admin@test.com",
                hashed_password=get_password_hash("pass"),
                full_name="Sim Admin",
                role="admin",
            )
            session.add(user)
            await session.flush()

            skill = Skill(
                name="Sim Skill",
                description="Test product for simulation",
                product="SimProd",
                content=(
                    "## Step 1: Opening Greeting\n"
                    "Greet the doctor and introduce yourself.\n\n"
                    "## Step 2: Product Introduction\n"
                    "Present the key benefits of the product.\n\n"
                    "## Step 3: Closing\n"
                    "Summarize key points and schedule follow-up."
                ),
                created_by=user.id,
            )
            session.add(skill)
            await session.flush()

            dry_run = DryRun(
                skill_id=skill.id,
                status="pending",
                run_number=1,
                created_by=user.id,
            )
            session.add(dry_run)
            await session.commit()
            return dry_run.id

    async def test_simulation_success(self):
        """Full simulation completes with mocked LLM calls."""
        dry_run_id = await self._setup_dry_run()

        turn_counter = {"n": 0}

        async def mock_call_llm(system_prompt, conversation, agent_name, **kwargs):
            turn_counter["n"] += 1
            if agent_name == "mr":
                if turn_counter["n"] <= 2:
                    return "Good morning doctor. Let me introduce myself and greet you."
                elif turn_counter["n"] <= 4:
                    return "I want to present the key benefits of our product introduction."
                else:
                    return (
                        "Thank you for your time. "
                        "Let me summarize key points and schedule follow-up."
                    )
            else:
                return "Tell me more about the clinical data."

        with patch(
            "app.services.dry_run_engine._call_llm",
            side_effect=mock_call_llm,
        ), patch(
            "app.services.dry_run_engine.AsyncSessionLocal",
            TestSessionLocal,
        ), patch(
            "app.services.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            return_value=("https://test.endpoint", "test-key"),
        ):
            await run_dry_run_simulation(dry_run_id)

        # Verify DB state
        async with TestSessionLocal() as session:
            dr = await session.get(DryRun, dry_run_id)
            assert dr is not None
            assert dr.status == "completed"
            assert dr.executability_score is not None
            assert dr.coverage_percent is not None
            assert dr.total_sop_steps == 3
            assert dr.duration_seconds is not None

    async def test_simulation_dry_run_not_found(self):
        """Simulation with nonexistent dry_run_id logs error and returns."""
        with patch(
            "app.services.dry_run_engine.AsyncSessionLocal",
            TestSessionLocal,
        ):
            await run_dry_run_simulation("nonexistent-id")

    async def test_simulation_skill_not_found(self):
        """Simulation where skill is missing marks dry run as failed."""
        async with TestSessionLocal() as session:
            user = User(
                username="sim_noskill_admin",
                email="sim_noskill@test.com",
                hashed_password=get_password_hash("pass"),
                full_name="NoSkill Admin",
                role="admin",
            )
            session.add(user)
            await session.flush()

            # Create dry_run with a fake skill_id (no actual skill)
            dry_run = DryRun(
                skill_id="nonexistent-skill-id",
                status="pending",
                run_number=1,
                created_by=user.id,
            )
            session.add(dry_run)
            await session.commit()
            dry_run_id = dry_run.id

        with patch(
            "app.services.dry_run_engine.AsyncSessionLocal",
            TestSessionLocal,
        ):
            await run_dry_run_simulation(dry_run_id)

        async with TestSessionLocal() as session:
            dr = await session.get(DryRun, dry_run_id)
            assert dr.status == "failed"
            assert "skill not found" in dr.error_message.lower()

    async def test_simulation_llm_exception_marks_failed(self):
        """Exception during simulation marks dry run as failed."""
        dry_run_id = await self._setup_dry_run()

        with patch(
            "app.services.dry_run_engine.AsyncSessionLocal",
            TestSessionLocal,
        ), patch(
            "app.services.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            side_effect=Exception("Azure endpoint unavailable"),
        ):
            await run_dry_run_simulation(dry_run_id)

        async with TestSessionLocal() as session:
            dr = await session.get(DryRun, dry_run_id)
            assert dr.status == "failed"
            assert "Azure endpoint unavailable" in dr.error_message

    async def test_simulation_double_exception(self):
        """Exception handler itself fails — lines 542-543 (double exception)."""
        dry_run_id = await self._setup_dry_run()

        # Make AsyncSessionLocal return a session where commit always fails
        original_session_local = TestSessionLocal

        class FailingSessionLocal:
            """Session factory where commit always raises."""

            def __init__(self):
                self._session = None

            async def __aenter__(self):
                self._session = original_session_local()
                session = await self._session.__aenter__()

                # Every commit fails — including the error-recovery commit
                async def failing_commit():
                    raise RuntimeError("DB commit always fails")

                session.commit = failing_commit
                return session

            async def __aexit__(self, *args):
                return await self._session.__aexit__(*args)

        with patch(
            "app.services.dry_run_engine.AsyncSessionLocal",
            FailingSessionLocal,
        ), patch(
            "app.services.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            side_effect=Exception("Primary failure"),
        ):
            # Should not raise — double exception is caught and logged
            await run_dry_run_simulation(dry_run_id)
