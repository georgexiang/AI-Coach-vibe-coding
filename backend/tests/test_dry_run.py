"""Tests for Dry Run data layer, engine helpers, and API endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.dry_run import DryRun, DryRunMessage
from app.models.skill import Skill
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from app.services.dry_run_engine import (
    _call_dry_run_agent,
    _extract_sop_steps,
    _is_conversation_ending,
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


# ---------------------------------------------------------------------------
# Helper to create a mock MetaSkill object
# ---------------------------------------------------------------------------


def _make_mock_meta_skill(
    skill_type: str,
    agent_id: str = "test-agent-id",
    agent_version: str = "1",
    model: str = "gpt-4o",
):
    """Create a mock MetaSkill with the given config."""
    meta = MagicMock()
    meta.skill_type = skill_type
    meta.agent_id = agent_id
    meta.agent_version = agent_version
    meta.model = model
    meta.is_active = True
    return meta


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
# Unit Tests: _call_dry_run_agent
# ===========================================================================


@pytest.mark.asyncio
class TestCallDryRunAgent:
    """Tests for _call_dry_run_agent helper."""

    async def test_call_agent_success(self):
        """Successful agent call returns (content, response_id)."""
        mock_response = MagicMock()
        mock_response.output_text = "Hello doctor, I am here to present our product."
        mock_response.id = "resp-001"

        mock_openai_client = MagicMock()
        mock_openai_client.responses.create.return_value = mock_response

        mock_project_client = MagicMock()
        mock_project_client.get_openai_client.return_value = mock_openai_client

        with patch(
            "app.services.agent_sync_service._get_project_client",
            return_value=mock_project_client,
        ):
            text, resp_id = await _call_dry_run_agent(
                message="Begin the conversation",
                agent_id="test-mr-agent",
                agent_version="1",
                model="gpt-4o",
                previous_response_id=None,
                project_endpoint="https://test.endpoint",
                api_key="test-key",
            )
        assert text == "Hello doctor, I am here to present our product."
        assert resp_id == "resp-001"

        # Verify agent_reference was passed
        call_kwargs = mock_openai_client.responses.create.call_args.kwargs
        assert "extra_body" in call_kwargs
        assert call_kwargs["extra_body"]["agent_reference"]["name"] == "test-mr-agent"

    async def test_call_agent_with_previous_response_id(self):
        """Previous response ID is passed for multi-turn."""
        mock_response = MagicMock()
        mock_response.output_text = "Continuation response"
        mock_response.id = "resp-002"

        mock_openai_client = MagicMock()
        mock_openai_client.responses.create.return_value = mock_response

        mock_project_client = MagicMock()
        mock_project_client.get_openai_client.return_value = mock_openai_client

        with patch(
            "app.services.agent_sync_service._get_project_client",
            return_value=mock_project_client,
        ):
            text, resp_id = await _call_dry_run_agent(
                message="Next message",
                agent_id="test-mr-agent",
                agent_version="1",
                model="gpt-4o",
                previous_response_id="resp-001",
                project_endpoint="https://test.endpoint",
                api_key="test-key",
            )
        assert text == "Continuation response"
        assert resp_id == "resp-002"

        # Verify previous_response_id was passed
        call_kwargs = mock_openai_client.responses.create.call_args.kwargs
        assert call_kwargs["previous_response_id"] == "resp-001"

    async def test_call_agent_truncates_long_response(self):
        """Response truncated to 500 chars."""
        mock_response = MagicMock()
        mock_response.output_text = "A" * 600
        mock_response.id = "resp-003"

        mock_openai_client = MagicMock()
        mock_openai_client.responses.create.return_value = mock_response

        mock_project_client = MagicMock()
        mock_project_client.get_openai_client.return_value = mock_openai_client

        with patch(
            "app.services.agent_sync_service._get_project_client",
            return_value=mock_project_client,
        ):
            text, _ = await _call_dry_run_agent(
                message="test",
                agent_id="agent",
                agent_version="1",
                model="gpt-4o",
                previous_response_id=None,
                project_endpoint="https://ep",
                api_key="key",
            )
        assert len(text) == 500

    async def test_call_agent_none_content(self):
        """None content returns empty string."""
        mock_response = MagicMock()
        mock_response.output_text = None
        mock_response.id = "resp-004"

        mock_openai_client = MagicMock()
        mock_openai_client.responses.create.return_value = mock_response

        mock_project_client = MagicMock()
        mock_project_client.get_openai_client.return_value = mock_openai_client

        with patch(
            "app.services.agent_sync_service._get_project_client",
            return_value=mock_project_client,
        ):
            text, _ = await _call_dry_run_agent(
                message="test",
                agent_id="agent",
                agent_version="1",
                model="gpt-4o",
                previous_response_id=None,
                project_endpoint="https://ep",
                api_key="key",
            )
        assert text == ""

    async def test_call_agent_retries_transient_failure(self):
        """Transient Responses API failure is retried before returning success."""
        mock_response = MagicMock()
        mock_response.output_text = "Recovered response"
        mock_response.id = "resp-recovered"

        mock_openai_client = MagicMock()
        mock_openai_client.responses.create.side_effect = [
            RuntimeError("temporary timeout"),
            mock_response,
        ]

        mock_project_client = MagicMock()
        mock_project_client.get_openai_client.return_value = mock_openai_client

        with (
            patch(
                "app.services.agent_sync_service._get_project_client",
                return_value=mock_project_client,
            ),
            patch("app.services.dry_run_engine.asyncio.sleep", new_callable=AsyncMock),
        ):
            text, resp_id = await _call_dry_run_agent(
                message="test",
                agent_id="agent",
                agent_version="1",
                model="gpt-4o",
                previous_response_id=None,
                project_endpoint="https://ep",
                api_key="key",
            )

        assert text == "Recovered response"
        assert resp_id == "resp-recovered"
        assert mock_openai_client.responses.create.call_count == 2

    async def test_call_agent_exception_returns_fallback(self):
        """Exception returns fallback message with empty response_id."""
        with (
            patch(
                "app.services.agent_sync_service._get_project_client",
                side_effect=Exception("Connection failed"),
            ),
            patch("app.services.dry_run_engine.asyncio.sleep", new_callable=AsyncMock),
        ):
            text, resp_id = await _call_dry_run_agent(
                message="test",
                agent_id="mr-agent",
                agent_version="1",
                model="gpt-4o",
                previous_response_id=None,
                project_endpoint="https://ep",
                api_key="key",
            )
        assert "unavailable" in text.lower()
        assert "Connection failed" in text
        assert resp_id == ""


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
        # Agent audit fields should be present
        assert "mr_agent_id" in data
        assert "hcp_agent_id" in data

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
        dr.mr_agent_id = "mr-agent-test"
        dr.mr_agent_version = "1"
        dr.hcp_agent_id = "hcp-agent-test"
        dr.hcp_agent_version = "1"
        dr.evaluator_agent_id = "eval-agent-test"
        dr.evaluator_agent_version = "1"
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


def _mock_get_meta_skill(skill_type):
    """Factory for mock get_meta_skill returning appropriate agent config."""
    configs = {
        "dry-run-mr": _make_mock_meta_skill("dry-run-mr", "dr-mr-agent", "1"),
        "dry-run-hcp": _make_mock_meta_skill("dry-run-hcp", "dr-hcp-agent", "1"),
        "evaluator": _make_mock_meta_skill("evaluator", "eval-agent", "1"),
    }

    async def _get(db, st):
        return configs.get(st)

    return _get


@pytest.mark.asyncio
class TestRunDryRunSimulation:
    """Tests for the full simulation background task with mocked agents."""

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
        """Full simulation completes with mocked agent calls and evaluator."""
        dry_run_id = await self._setup_dry_run()

        turn_counter = {"n": 0}

        async def mock_call_agent(
            message, agent_id, agent_version, model, previous_response_id, **kwargs
        ):
            turn_counter["n"] += 1
            resp_id = f"resp-{turn_counter['n']:03d}"
            if "mr" in agent_id:
                if turn_counter["n"] <= 2:
                    return ("Good morning doctor. Let me introduce myself.", resp_id)
                elif turn_counter["n"] <= 4:
                    return ("Let me present the key benefits of our product.", resp_id)
                else:
                    return ("Thank you for your time. Let me summarize.", resp_id)
            else:
                return ("Tell me more about the clinical data.", resp_id)

        # Mock evaluator to return coverage results
        mock_eval_result = (
            [
                {
                    "step_id": "step_1",
                    "step_name": "Opening Greeting",
                    "status": "covered",
                    "matched_message_ids": [0],
                    "details": "Covered",
                },
                {
                    "step_id": "step_2",
                    "step_name": "Product Introduction",
                    "status": "covered",
                    "matched_message_ids": [2],
                    "details": "Covered",
                },
                {
                    "step_id": "step_3",
                    "step_name": "Closing",
                    "status": "partial",
                    "matched_message_ids": [],
                    "details": "Weak",
                },
            ],
            [
                {
                    "severity": "warning",
                    "step_id": "step_3",
                    "description": "Closing partially covered",
                    "suggestion": "Improve",
                }
            ],
            75,
        )

        with (
            patch(
                "app.services.dry_run_engine._call_dry_run_agent",
                side_effect=mock_call_agent,
            ),
            patch(
                "app.services.dry_run_engine._evaluate_sop_coverage_with_agent",
                new_callable=AsyncMock,
                return_value=mock_eval_result,
            ),
            patch(
                "app.services.dry_run_engine.AsyncSessionLocal",
                TestSessionLocal,
            ),
            patch(
                "app.services.agent_sync_service.get_project_endpoint",
                new_callable=AsyncMock,
                return_value=("https://test.endpoint", "test-key"),
            ),
            patch(
                "app.services.meta_skill_service.get_meta_skill",
                side_effect=_mock_get_meta_skill("all"),
            ),
        ):
            await run_dry_run_simulation(dry_run_id)

        # Verify DB state
        async with TestSessionLocal() as session:
            dr = await session.get(DryRun, dry_run_id)
            assert dr is not None
            assert dr.status == "completed"
            assert dr.executability_score == 75
            assert dr.coverage_percent is not None
            assert dr.total_sop_steps == 3
            assert dr.duration_seconds is not None
            # Agent audit fields populated
            assert dr.mr_agent_id == "dr-mr-agent"
            assert dr.hcp_agent_id == "dr-hcp-agent"
            assert dr.evaluator_agent_id == "eval-agent"

    async def test_simulation_fails_when_mr_agent_not_synced(self):
        """Simulation fails fast if MR agent is not synced to Foundry."""
        dry_run_id = await self._setup_dry_run()

        # MR agent has no agent_id (not synced)
        mr_meta = _make_mock_meta_skill("dry-run-mr", agent_id="")

        async def mock_get_meta(db, st):
            if st == "dry-run-mr":
                return mr_meta
            if st == "dry-run-hcp":
                return _make_mock_meta_skill("dry-run-hcp")
            if st == "evaluator":
                return _make_mock_meta_skill("evaluator")
            return None

        with (
            patch("app.services.dry_run_engine.AsyncSessionLocal", TestSessionLocal),
            patch("app.services.meta_skill_service.get_meta_skill", side_effect=mock_get_meta),
        ):
            await run_dry_run_simulation(dry_run_id)

        async with TestSessionLocal() as session:
            dr = await session.get(DryRun, dry_run_id)
            assert dr.status == "failed"
            assert "dry run mr agent not synced" in dr.error_message.lower()

    async def test_simulation_fails_when_hcp_agent_not_synced(self):
        """Simulation fails fast if HCP agent is not synced to Foundry."""
        dry_run_id = await self._setup_dry_run()

        hcp_meta = _make_mock_meta_skill("dry-run-hcp", agent_id="")

        async def mock_get_meta(db, st):
            if st == "dry-run-mr":
                return _make_mock_meta_skill("dry-run-mr")
            if st == "dry-run-hcp":
                return hcp_meta
            if st == "evaluator":
                return _make_mock_meta_skill("evaluator")
            return None

        with (
            patch("app.services.dry_run_engine.AsyncSessionLocal", TestSessionLocal),
            patch("app.services.meta_skill_service.get_meta_skill", side_effect=mock_get_meta),
        ):
            await run_dry_run_simulation(dry_run_id)

        async with TestSessionLocal() as session:
            dr = await session.get(DryRun, dry_run_id)
            assert dr.status == "failed"
            assert "dry run hcp agent not synced" in dr.error_message.lower()

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

    async def test_simulation_early_abort_on_ai_unavailable(self):
        """First MR turn returning fallback aborts simulation as failed."""
        dry_run_id = await self._setup_dry_run()

        async def mock_call_agent_fallback(
            message, agent_id, agent_version, model, previous_response_id, **kwargs
        ):
            return (f"[{agent_id} unavailable -- simulation continues]", "")

        with (
            patch(
                "app.services.dry_run_engine._call_dry_run_agent",
                side_effect=mock_call_agent_fallback,
            ),
            patch(
                "app.services.dry_run_engine.AsyncSessionLocal",
                TestSessionLocal,
            ),
            patch(
                "app.services.agent_sync_service.get_project_endpoint",
                new_callable=AsyncMock,
                return_value=("https://test.endpoint", "test-key"),
            ),
            patch(
                "app.services.meta_skill_service.get_meta_skill",
                side_effect=_mock_get_meta_skill("all"),
            ),
        ):
            await run_dry_run_simulation(dry_run_id)

        async with TestSessionLocal() as session:
            dr = await session.get(DryRun, dry_run_id)
            assert dr.status == "failed"
            assert "ai service unavailable" in dr.error_message.lower()

    async def test_simulation_mid_abort_on_consecutive_failures(self):
        """Consecutive agent failures mid-simulation abort as failed."""
        dry_run_id = await self._setup_dry_run()

        turn_counter = {"n": 0}

        async def mock_call_agent_partial(
            message, agent_id, agent_version, model, previous_response_id, **kwargs
        ):
            turn_counter["n"] += 1
            resp_id = f"resp-{turn_counter['n']:03d}"
            # Turn 0 (MR) succeeds, then all subsequent turns fail
            if turn_counter["n"] == 1:
                return ("Hello doctor, I am here to present.", resp_id)
            return (f"[{agent_id} unavailable -- simulation continues]", "")

        with (
            patch(
                "app.services.dry_run_engine._call_dry_run_agent",
                side_effect=mock_call_agent_partial,
            ),
            patch(
                "app.services.dry_run_engine.AsyncSessionLocal",
                TestSessionLocal,
            ),
            patch(
                "app.services.agent_sync_service.get_project_endpoint",
                new_callable=AsyncMock,
                return_value=("https://test.endpoint", "test-key"),
            ),
            patch(
                "app.services.meta_skill_service.get_meta_skill",
                side_effect=_mock_get_meta_skill("all"),
            ),
        ):
            await run_dry_run_simulation(dry_run_id)

        async with TestSessionLocal() as session:
            dr = await session.get(DryRun, dry_run_id)
            assert dr.status == "failed"
            assert "consecutive failures" in dr.error_message.lower()
            assert dr.issues_count == 1
            assert "consecutive failures" in dr.issues_json.lower()
            assert dr.duration_seconds is not None

    async def test_simulation_llm_exception_marks_failed(self):
        """Exception during simulation marks dry run as failed."""
        dry_run_id = await self._setup_dry_run()

        with (
            patch(
                "app.services.dry_run_engine.AsyncSessionLocal",
                TestSessionLocal,
            ),
            patch(
                "app.services.agent_sync_service.get_project_endpoint",
                new_callable=AsyncMock,
                side_effect=Exception("Azure endpoint unavailable"),
            ),
            patch(
                "app.services.meta_skill_service.get_meta_skill",
                side_effect=_mock_get_meta_skill("all"),
            ),
        ):
            await run_dry_run_simulation(dry_run_id)

        async with TestSessionLocal() as session:
            dr = await session.get(DryRun, dry_run_id)
            assert dr.status == "failed"
            assert "Azure endpoint unavailable" in dr.error_message
            assert dr.issues_count == 1

    async def test_simulation_without_evaluator(self):
        """Simulation completes but with empty coverage when evaluator not synced."""
        dry_run_id = await self._setup_dry_run()

        turn_counter = {"n": 0}

        async def mock_call_agent(
            message, agent_id, agent_version, model, previous_response_id, **kwargs
        ):
            turn_counter["n"] += 1
            resp_id = f"resp-{turn_counter['n']:03d}"
            if "mr" in agent_id:
                if turn_counter["n"] <= 4:
                    return ("Hello doctor, let me present.", resp_id)
                return ("Thank you for your time.", resp_id)
            return ("Interesting, tell me more.", resp_id)

        # Evaluator has no agent_id
        async def mock_get_meta(db, st):
            if st == "dry-run-mr":
                return _make_mock_meta_skill("dry-run-mr", "dr-mr-agent")
            if st == "dry-run-hcp":
                return _make_mock_meta_skill("dry-run-hcp", "dr-hcp-agent")
            if st == "evaluator":
                return _make_mock_meta_skill("evaluator", agent_id="")
            return None

        with (
            patch("app.services.dry_run_engine._call_dry_run_agent", side_effect=mock_call_agent),
            patch("app.services.dry_run_engine.AsyncSessionLocal", TestSessionLocal),
            patch(
                "app.services.agent_sync_service.get_project_endpoint",
                new_callable=AsyncMock,
                return_value=("https://test.endpoint", "test-key"),
            ),
            patch("app.services.meta_skill_service.get_meta_skill", side_effect=mock_get_meta),
        ):
            await run_dry_run_simulation(dry_run_id)

        async with TestSessionLocal() as session:
            dr = await session.get(DryRun, dry_run_id)
            assert dr.status == "completed"
            # Score is 0 when evaluator not available
            assert dr.executability_score == 0
