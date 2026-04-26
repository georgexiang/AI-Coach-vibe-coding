"""Tests for Dry Run data layer, engine helpers, and API endpoints."""

from unittest.mock import patch

import pytest

from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from app.services.dry_run_engine import (
    _compute_executability_score,
    _compute_sop_coverage,
    _extract_sop_steps,
    _identify_issues,
    _is_conversation_ending,
    _match_sop_step,
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
