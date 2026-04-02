"""Unit tests for agent_sync_service: instruction builder + AI Foundry SDK wrapper."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# --- Test 1: build_agent_instructions with complete profile data ---
def test_build_agent_instructions_complete_profile():
    """build_agent_instructions returns formatted string with profile fields."""
    from app.services.agent_sync_service import build_agent_instructions

    profile_data = {
        "name": "Dr. Chen Wei",
        "specialty": "Oncology",
        "hospital": "Beijing Hospital",
        "title": "Chief Physician",
        "personality_type": "analytical",
        "emotional_state": 50,
        "communication_style": 30,
        "expertise_areas": ["lung cancer", "immunotherapy"],
        "prescribing_habits": "Evidence-based, prefers clinical trials",
        "concerns": "Drug efficacy and safety data",
        "objections": ["cost concerns", "limited data"],
        "probe_topics": ["clinical trial results", "mechanism of action"],
        "difficulty": "hard",
    }

    result = build_agent_instructions(profile_data)

    assert "Dr. Chen Wei" in result
    assert "Oncology" in result
    assert "analytical" in result
    assert "Beijing Hospital" in result
    assert "Chief Physician" in result


# --- Test 2: build_agent_instructions joins list fields ---
def test_build_agent_instructions_joins_list_fields():
    """build_agent_instructions converts lists to comma-separated strings."""
    from app.services.agent_sync_service import build_agent_instructions

    profile_data = {
        "name": "Dr. Li",
        "specialty": "Cardiology",
        "hospital": "",
        "title": "",
        "personality_type": "friendly",
        "emotional_state": 20,
        "communication_style": 80,
        "expertise_areas": ["heart failure", "arrhythmia", "valvular disease"],
        "prescribing_habits": "",
        "concerns": "",
        "objections": ["price", "side effects"],
        "probe_topics": ["dosing", "interactions"],
        "difficulty": "medium",
    }

    result = build_agent_instructions(profile_data)

    assert "heart failure, arrhythmia, valvular disease" in result
    assert "price, side effects" in result
    assert "dosing, interactions" in result


# --- Test 3: build_agent_instructions with custom template ---
def test_build_agent_instructions_custom_template():
    """build_agent_instructions uses provided custom template."""
    from app.services.agent_sync_service import build_agent_instructions

    custom_template = "Hello, I am {name} from {specialty}. Style: {communication_style_desc}."
    profile_data = {
        "name": "Dr. Wang",
        "specialty": "Neurology",
        "communication_style": 30,
        "emotional_state": 50,
    }

    result = build_agent_instructions(profile_data, template=custom_template)

    assert "Dr. Wang" in result
    assert "Neurology" in result
    assert "direct" in result


# --- Test 4: build_agent_instructions with missing optional fields ---
def test_build_agent_instructions_missing_fields():
    """build_agent_instructions uses safe defaults for missing fields."""
    from app.services.agent_sync_service import build_agent_instructions

    profile_data = {
        "name": "Dr. Minimal",
        "specialty": "General",
    }

    result = build_agent_instructions(profile_data)

    assert "Dr. Minimal" in result
    assert "General" in result


# --- Test 5: build_agent_instructions emotional state descriptors ---
def test_build_agent_instructions_emotional_descriptors():
    """build_agent_instructions sets correct emotional descriptors."""
    from app.services.agent_sync_service import build_agent_instructions

    # Calm
    r1 = build_agent_instructions({"name": "A", "specialty": "B", "emotional_state": 10})
    assert "calm and open" in r1

    # Neutral
    r2 = build_agent_instructions({"name": "A", "specialty": "B", "emotional_state": 50})
    assert "neutral" in r2

    # Resistant
    r3 = build_agent_instructions({"name": "A", "specialty": "B", "emotional_state": 80})
    assert "resistant" in r3

    # Non-numeric
    r4 = build_agent_instructions({"name": "A", "specialty": "B", "emotional_state": "high"})
    assert "neutral" in r4

    # Non-numeric comm style
    r5 = build_agent_instructions({"name": "A", "specialty": "B", "communication_style": "auto"})
    assert "moderate" in r5


# --- Test 6: get_project_endpoint derives correct URL ---
@pytest.mark.asyncio
async def test_get_project_endpoint():
    """get_project_endpoint derives URL from master config default_project."""
    from app.services.agent_sync_service import get_project_endpoint

    mock_db = AsyncMock()

    mock_master = MagicMock()
    mock_master.default_project = "my-project"

    with (
        patch(
            "app.services.agent_sync_service.config_service.get_effective_endpoint",
            new_callable=AsyncMock,
            return_value="https://my-foundry.services.ai.azure.com",
        ),
        patch(
            "app.services.agent_sync_service.config_service.get_effective_key",
            new_callable=AsyncMock,
            return_value="test-api-key-123",
        ),
        patch(
            "app.services.agent_sync_service.config_service.get_master_config",
            new_callable=AsyncMock,
            return_value=mock_master,
        ),
    ):
        endpoint, key = await get_project_endpoint(mock_db)

    assert "my-project" in endpoint
    assert "api/projects" in endpoint
    assert key == "test-api-key-123"


# --- Test 7: get_project_endpoint with existing project path ---
@pytest.mark.asyncio
async def test_get_project_endpoint_existing_path():
    """get_project_endpoint preserves existing /api/projects/ path."""
    from app.services.agent_sync_service import get_project_endpoint

    mock_db = AsyncMock()
    mock_master = MagicMock()
    mock_master.default_project = ""

    with (
        patch(
            "app.services.agent_sync_service.config_service.get_effective_endpoint",
            new_callable=AsyncMock,
            return_value="https://foundry.azure.com/api/projects/existing-proj",
        ),
        patch(
            "app.services.agent_sync_service.config_service.get_effective_key",
            new_callable=AsyncMock,
            return_value="key",
        ),
        patch(
            "app.services.agent_sync_service.config_service.get_master_config",
            new_callable=AsyncMock,
            return_value=mock_master,
        ),
        patch(
            "app.services.agent_sync_service.config_service.get_config",
            new_callable=AsyncMock,
            return_value=None,
        ),
    ):
        endpoint, _ = await get_project_endpoint(mock_db)

    assert endpoint == "https://foundry.azure.com/api/projects/existing-proj"


# --- Test 8: get_project_endpoint env var fallback ---
@pytest.mark.asyncio
async def test_get_project_endpoint_env_var_fallback():
    """get_project_endpoint uses AZURE_FOUNDRY_DEFAULT_PROJECT env var as fallback."""
    from app.services.agent_sync_service import get_project_endpoint

    mock_db = AsyncMock()
    mock_master = MagicMock()
    mock_master.default_project = ""  # no DB project → fall through to voice_live then env

    mock_config = MagicMock()
    mock_config.model_or_deployment = "gpt-4o-realtime"  # model mode, no project

    mock_settings = MagicMock()
    mock_settings.azure_foundry_default_project = "avarda-demo-prj"

    with (
        patch(
            "app.services.agent_sync_service.config_service.get_effective_endpoint",
            new_callable=AsyncMock,
            return_value="https://foundry.azure.com",
        ),
        patch(
            "app.services.agent_sync_service.config_service.get_effective_key",
            new_callable=AsyncMock,
            return_value="key",
        ),
        patch(
            "app.services.agent_sync_service.config_service.get_master_config",
            new_callable=AsyncMock,
            return_value=mock_master,
        ),
        patch(
            "app.services.agent_sync_service.config_service.get_config",
            new_callable=AsyncMock,
            return_value=mock_config,
        ),
        patch(
            "app.config.get_settings",
            return_value=mock_settings,
        ),
    ):
        endpoint, _ = await get_project_endpoint(mock_db)

    assert endpoint == "https://foundry.azure.com/api/projects/avarda-demo-prj"


# --- Test 8b: get_project_endpoint bare fallback when no env var ---
@pytest.mark.asyncio
async def test_get_project_endpoint_no_project_no_env():
    """get_project_endpoint falls back to bare endpoint when no project at all."""
    from app.services.agent_sync_service import get_project_endpoint

    mock_db = AsyncMock()
    mock_master = MagicMock()
    mock_master.default_project = ""

    mock_config = MagicMock()
    mock_config.model_or_deployment = "gpt-4o-realtime"

    mock_settings = MagicMock()
    mock_settings.azure_foundry_default_project = ""

    with (
        patch(
            "app.services.agent_sync_service.config_service.get_effective_endpoint",
            new_callable=AsyncMock,
            return_value="https://foundry.azure.com",
        ),
        patch(
            "app.services.agent_sync_service.config_service.get_effective_key",
            new_callable=AsyncMock,
            return_value="key",
        ),
        patch(
            "app.services.agent_sync_service.config_service.get_master_config",
            new_callable=AsyncMock,
            return_value=mock_master,
        ),
        patch(
            "app.services.agent_sync_service.config_service.get_config",
            new_callable=AsyncMock,
            return_value=mock_config,
        ),
        patch(
            "app.config.get_settings",
            return_value=mock_settings,
        ),
    ):
        endpoint, _ = await get_project_endpoint(mock_db)

    assert endpoint == "https://foundry.azure.com"


# --- Test 9: create_agent calls SDK create_version and returns agent name ---
@pytest.mark.asyncio
async def test_create_agent():
    """create_agent calls SDK agents.create_version and returns agent name as id."""
    from app.services.agent_sync_service import create_agent

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.name = "Test-Agent"
    mock_result.version = "1"

    mock_client = MagicMock()
    mock_client.agents.create_version.return_value = mock_result

    with (
        patch(
            "app.services.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            return_value=("https://foundry/api/projects/proj", "key"),
        ),
        patch(
            "app.services.agent_sync_service._get_project_client",
            return_value=mock_client,
        ),
    ):
        result = await create_agent(mock_db, "Test Agent", "Instructions", "gpt-4o")

    assert result["id"] == "Test-Agent"
    assert result["name"] == "Test-Agent"
    assert result["version"] == "1"
    mock_client.agents.create_version.assert_called_once()


# --- Test 10: update_agent calls SDK create_version (new version) ---
@pytest.mark.asyncio
async def test_update_agent():
    """update_agent calls SDK agents.create_version with existing agent_name."""
    from app.services.agent_sync_service import update_agent

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.name = "existing-agent"
    mock_result.version = "2"

    mock_client = MagicMock()
    mock_client.agents.create_version.return_value = mock_result

    with (
        patch(
            "app.services.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            return_value=("https://foundry/api/projects/proj", "key"),
        ),
        patch(
            "app.services.agent_sync_service._get_project_client",
            return_value=mock_client,
        ),
    ):
        result = await update_agent(mock_db, "existing-agent", "Updated", "New instructions")

    assert result["id"] == "existing-agent"
    assert result["version"] == "2"
    mock_client.agents.create_version.assert_called_once()
    call_kwargs = mock_client.agents.create_version.call_args
    assert call_kwargs[1]["agent_name"] == "existing-agent"


# --- Test 11: delete_agent calls SDK agents.delete and returns True ---
@pytest.mark.asyncio
async def test_delete_agent():
    """delete_agent calls SDK agents.delete and returns True."""
    from app.services.agent_sync_service import delete_agent

    mock_db = AsyncMock()
    mock_client = MagicMock()
    mock_client.agents.delete.return_value = None  # success

    with (
        patch(
            "app.services.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            return_value=("https://foundry/api/projects/proj", "key"),
        ),
        patch(
            "app.services.agent_sync_service._get_project_client",
            return_value=mock_client,
        ),
    ):
        result = await delete_agent(mock_db, "agent-to-delete")

    assert result is True
    mock_client.agents.delete.assert_called_once_with(agent_name="agent-to-delete")


# --- Test 12: delete_agent returns False on error ---
@pytest.mark.asyncio
async def test_delete_agent_returns_false_on_error():
    """delete_agent returns False when SDK raises exception."""
    from app.services.agent_sync_service import delete_agent

    mock_db = AsyncMock()
    mock_client = MagicMock()
    mock_client.agents.delete.side_effect = Exception("Not found")

    with (
        patch(
            "app.services.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            return_value=("https://foundry/api/projects/proj", "key"),
        ),
        patch(
            "app.services.agent_sync_service._get_project_client",
            return_value=mock_client,
        ),
    ):
        result = await delete_agent(mock_db, "nonexistent-agent")

    assert result is False


# --- Test 13: sync_agent_for_profile creates when no agent_id ---
@pytest.mark.asyncio
async def test_sync_agent_for_profile_creates_when_no_agent_id():
    """sync_agent_for_profile creates agent when agent_id is empty."""
    from app.services.agent_sync_service import sync_agent_for_profile

    mock_db = AsyncMock()
    mock_profile = MagicMock()
    mock_profile.agent_id = ""
    mock_profile.name = "Dr. New"
    mock_profile.to_prompt_dict.return_value = {
        "name": "Dr. New",
        "specialty": "Oncology",
    }

    mock_master = MagicMock()
    mock_master.model_or_deployment = "gpt-4o"

    with (
        patch(
            "app.services.agent_sync_service.config_service.get_master_config",
            new_callable=AsyncMock,
            return_value=mock_master,
        ),
        patch(
            "app.services.agent_sync_service.create_agent",
            new_callable=AsyncMock,
            return_value={"id": "asst_created", "name": "Dr. New", "model": "gpt-4o"},
        ) as mock_create,
        patch(
            "app.services.agent_sync_service.update_agent",
            new_callable=AsyncMock,
        ) as mock_update,
    ):
        result = await sync_agent_for_profile(mock_db, mock_profile)

    assert result["id"] == "asst_created"
    mock_create.assert_called_once()
    mock_update.assert_not_called()


# --- Test 14: sync_agent_for_profile updates when agent_id exists ---
@pytest.mark.asyncio
async def test_sync_agent_for_profile_updates_when_agent_id_exists():
    """sync_agent_for_profile updates agent when agent_id is set."""
    from app.services.agent_sync_service import sync_agent_for_profile

    mock_db = AsyncMock()
    mock_profile = MagicMock()
    mock_profile.agent_id = "asst_existing"
    mock_profile.name = "Dr. Existing"
    mock_profile.to_prompt_dict.return_value = {
        "name": "Dr. Existing",
        "specialty": "Cardiology",
    }

    mock_master = MagicMock()
    mock_master.model_or_deployment = "gpt-4o"

    with (
        patch(
            "app.services.agent_sync_service.config_service.get_master_config",
            new_callable=AsyncMock,
            return_value=mock_master,
        ),
        patch(
            "app.services.agent_sync_service.create_agent",
            new_callable=AsyncMock,
        ) as mock_create,
        patch(
            "app.services.agent_sync_service.update_agent",
            new_callable=AsyncMock,
            return_value={
                "id": "asst_existing",
                "name": "Dr. Existing",
                "model": "gpt-4o",
            },
        ) as mock_update,
    ):
        result = await sync_agent_for_profile(mock_db, mock_profile)

    assert result["id"] == "asst_existing"
    mock_update.assert_called_once()
    mock_create.assert_not_called()


# --- Test 15: sync_agent_for_profile with no master config ---
@pytest.mark.asyncio
async def test_sync_agent_for_profile_no_master_config():
    """sync_agent_for_profile defaults to gpt-4o when no master config."""
    from app.services.agent_sync_service import sync_agent_for_profile

    mock_db = AsyncMock()
    mock_profile = MagicMock()
    mock_profile.agent_id = ""
    mock_profile.name = "Dr. Default"
    mock_profile.to_prompt_dict.return_value = {"name": "Dr. Default", "specialty": "GP"}

    with (
        patch(
            "app.services.agent_sync_service.config_service.get_master_config",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "app.services.agent_sync_service.create_agent",
            new_callable=AsyncMock,
            return_value={"id": "asst_default", "name": "Dr. Default", "model": "gpt-4o"},
        ) as mock_create,
    ):
        result = await sync_agent_for_profile(mock_db, mock_profile)

    assert result["id"] == "asst_default"
    # Verify model defaults to gpt-4o
    call_args = mock_create.call_args
    assert call_args[1].get("model", call_args[0][3] if len(call_args[0]) > 3 else None) == "gpt-4o"


# --- Test 16: three HCP profiles sync to agents end-to-end ---
@pytest.mark.asyncio
async def test_three_profiles_sync_to_agents():
    """Three HCP profiles each create an agent via sync_agent_for_profile.

    This is the critical end-to-end scenario: every HCP profile must have
    a corresponding AI Foundry agent after sync.
    """
    from app.services.agent_sync_service import sync_agent_for_profile

    hcp_profiles = [
        {
            "agent_id": "",
            "name": "Dr. Chen Wei",
            "prompt_data": {
                "name": "Dr. Chen Wei",
                "specialty": "Oncology",
                "hospital": "Beijing Hospital",
                "title": "Chief Physician",
                "personality_type": "analytical",
                "emotional_state": 50,
                "communication_style": 30,
                "expertise_areas": ["lung cancer", "immunotherapy"],
                "prescribing_habits": "Evidence-based",
                "concerns": "Drug efficacy",
                "objections": ["cost concerns"],
                "probe_topics": ["clinical trial results"],
            },
        },
        {
            "agent_id": "",
            "name": "Dr. Li Ming",
            "prompt_data": {
                "name": "Dr. Li Ming",
                "specialty": "Cardiology",
                "hospital": "Shanghai Heart Center",
                "title": "Senior Physician",
                "personality_type": "friendly",
                "emotional_state": 20,
                "communication_style": 80,
                "expertise_areas": ["heart failure", "arrhythmia"],
                "prescribing_habits": "Conservative",
                "concerns": "Patient safety",
                "objections": ["side effects"],
                "probe_topics": ["dosing"],
            },
        },
        {
            "agent_id": "",
            "name": "Dr. Wang Fang",
            "prompt_data": {
                "name": "Dr. Wang Fang",
                "specialty": "Neurology",
                "hospital": "Guangzhou Medical",
                "title": "Attending Physician",
                "personality_type": "skeptical",
                "emotional_state": 80,
                "communication_style": 40,
                "expertise_areas": ["stroke", "epilepsy"],
                "prescribing_habits": "Guideline-based",
                "concerns": "Long-term outcomes",
                "objections": ["limited data", "compliance"],
                "probe_topics": ["mechanism of action", "safety profile"],
            },
        },
    ]

    agent_counter = 0

    def make_create_agent_side_effect():
        nonlocal agent_counter

        async def _create(*args, **kwargs):
            nonlocal agent_counter
            agent_counter += 1
            name = args[1] if len(args) > 1 else kwargs.get("name", "agent")
            return {
                "id": f"agent-{agent_counter}",
                "name": name,
                "version": "1",
                "model": "gpt-4o",
            }

        return _create

    results = []
    mock_db = AsyncMock()

    for profile_data in hcp_profiles:
        mock_profile = MagicMock()
        mock_profile.agent_id = profile_data["agent_id"]
        mock_profile.name = profile_data["name"]
        mock_profile.to_prompt_dict.return_value = profile_data["prompt_data"]

        with patch(
            "app.services.agent_sync_service.create_agent",
            new_callable=AsyncMock,
            side_effect=make_create_agent_side_effect(),
        ):
            result = await sync_agent_for_profile(
                mock_db,
                mock_profile,
                prefetched_model="gpt-4o",
            )
            results.append(result)

    # All three must have unique agent IDs
    assert len(results) == 3
    agent_ids = [r["id"] for r in results]
    assert len(set(agent_ids)) == 3, f"Expected 3 unique agent IDs, got: {agent_ids}"
    for r in results:
        assert r["id"], f"Agent ID must not be empty: {r}"
        assert r["model"] == "gpt-4o"


# --- Test 17: three profiles batch sync (create + update + retry) ---
@pytest.mark.asyncio
async def test_three_profiles_mixed_sync_scenarios():
    """Three profiles: one new (create), one existing (update), one failed (retry).

    Verifies that sync_agent_for_profile correctly routes to create vs update
    based on agent_id presence, and all three succeed.
    """
    from app.services.agent_sync_service import sync_agent_for_profile

    mock_db = AsyncMock()

    # Profile 1: new (no agent_id)
    p1 = MagicMock()
    p1.agent_id = ""
    p1.name = "Dr. New"
    p1.to_prompt_dict.return_value = {"name": "Dr. New", "specialty": "GP"}

    # Profile 2: existing (has agent_id, should update)
    p2 = MagicMock()
    p2.agent_id = "existing-agent-002"
    p2.name = "Dr. Update"
    p2.to_prompt_dict.return_value = {"name": "Dr. Update", "specialty": "Dermatology"}

    # Profile 3: retry (had agent_id but sync_status was failed, treat as update)
    p3 = MagicMock()
    p3.agent_id = "failed-agent-003"
    p3.name = "Dr. Retry"
    p3.to_prompt_dict.return_value = {"name": "Dr. Retry", "specialty": "Pediatrics"}

    with (
        patch(
            "app.services.agent_sync_service.create_agent",
            new_callable=AsyncMock,
            return_value={
                "id": "new-agent-001",
                "name": "Dr-New",
                "version": "1",
                "model": "gpt-4o",
            },
        ) as mock_create,
        patch(
            "app.services.agent_sync_service.update_agent",
            new_callable=AsyncMock,
            side_effect=[
                {
                    "id": "existing-agent-002",
                    "name": "Dr-Update",
                    "version": "2",
                    "model": "gpt-4o",
                },
                {
                    "id": "failed-agent-003",
                    "name": "Dr-Retry",
                    "version": "2",
                    "model": "gpt-4o",
                },
            ],
        ) as mock_update,
    ):
        r1 = await sync_agent_for_profile(mock_db, p1, prefetched_model="gpt-4o")
        r2 = await sync_agent_for_profile(mock_db, p2, prefetched_model="gpt-4o")
        r3 = await sync_agent_for_profile(mock_db, p3, prefetched_model="gpt-4o")

    # Verify create called once for new profile
    mock_create.assert_called_once()
    assert r1["id"] == "new-agent-001"

    # Verify update called twice (existing + retry)
    assert mock_update.call_count == 2
    assert r2["id"] == "existing-agent-002"
    assert r3["id"] == "failed-agent-003"

    # All three synced successfully
    all_ids = {r1["id"], r2["id"], r3["id"]}
    assert len(all_ids) == 3


# --- Test 18: create_agent builds correct endpoint with env var project ---
@pytest.mark.asyncio
async def test_create_agent_uses_project_endpoint():
    """create_agent uses full project endpoint including /api/projects/."""
    from app.services.agent_sync_service import create_agent

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.name = "Dr-Chen-Wei"
    mock_result.version = "1"

    mock_client = MagicMock()
    mock_client.agents.create_version.return_value = mock_result

    with (
        patch(
            "app.services.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            return_value=(
                "https://foundry.azure.com/api/projects/avarda-demo-prj",
                "test-key",
            ),
        ),
        patch(
            "app.services.agent_sync_service._get_project_client",
            return_value=mock_client,
        ) as mock_get_client,
    ):
        result = await create_agent(mock_db, "Dr. Chen Wei", "Instructions", "gpt-4o")

    assert result["id"] == "Dr-Chen-Wei"
    # Verify _get_project_client received the full project endpoint and key
    mock_get_client.assert_called_once_with(
        "https://foundry.azure.com/api/projects/avarda-demo-prj",
        "test-key",
    )


# ===========================================================================
# Real Azure integration tests — use actual .env credentials when available
# ===========================================================================


def _get_real_azure_config() -> tuple[str, str, str]:
    """Read Azure AI Foundry config from .env. Returns (endpoint, api_key, project)."""
    import os

    from dotenv import load_dotenv

    load_dotenv()
    endpoint = os.getenv("AZURE_FOUNDRY_ENDPOINT", "").rstrip("/")
    api_key = os.getenv("AZURE_FOUNDRY_API_KEY", "")
    project = os.getenv("AZURE_FOUNDRY_DEFAULT_PROJECT", "")
    return endpoint, api_key, project


def _has_real_azure_config() -> bool:
    """Check if real Azure credentials are configured in .env."""
    endpoint, api_key, project = _get_real_azure_config()
    return bool(endpoint and api_key and project)


_skip_no_creds = pytest.mark.skipif(
    not _has_real_azure_config(),
    reason="No Azure AI Foundry credentials in .env",
)

# Agent names created during tests, for cleanup
_created_agents: list[str] = []


@_skip_no_creds
@pytest.mark.asyncio
async def test_real_create_agent():
    """[REAL] Create a single agent on Azure AI Foundry using .env credentials."""
    from app.services.agent_sync_service import (
        _get_project_client,
        _sanitize_agent_name,
        build_agent_instructions,
    )

    endpoint, api_key, project = _get_real_azure_config()
    project_endpoint = f"{endpoint}/api/projects/{project}"
    client = _get_project_client(project_endpoint, api_key)

    from azure.ai.projects.models import PromptAgentDefinition

    instructions = build_agent_instructions(
        {
            "name": "Dr. Test-Chen",
            "specialty": "Oncology",
            "hospital": "Test Hospital",
            "title": "Physician",
            "personality_type": "analytical",
            "emotional_state": 50,
            "communication_style": 30,
            "expertise_areas": ["testing"],
            "prescribing_habits": "N/A",
            "concerns": "test",
            "objections": ["none"],
            "probe_topics": ["test"],
        }
    )

    agent_name = _sanitize_agent_name("Test-Dr-Chen-UT")
    definition = PromptAgentDefinition(model="gpt-4o", instructions=instructions)

    result = client.agents.create_version(
        agent_name=agent_name,
        definition=definition,
        description="Unit test agent — safe to delete",
    )

    _created_agents.append(result.name)

    assert result.name == agent_name
    assert result.version
    print(f"  Created real agent: name={result.name}, version={result.version}")


@_skip_no_creds
@pytest.mark.asyncio
async def test_real_three_profiles_sync():
    """[REAL] Three HCP profiles create three agents on Azure AI Foundry.

    This is the primary acceptance test: 3 HCPs → 3 real agents.
    """
    from app.services.agent_sync_service import (
        _get_project_client,
        _sanitize_agent_name,
        build_agent_instructions,
    )

    endpoint, api_key, project = _get_real_azure_config()
    project_endpoint = f"{endpoint}/api/projects/{project}"
    client = _get_project_client(project_endpoint, api_key)

    from azure.ai.projects.models import PromptAgentDefinition

    profiles = [
        {
            "name": "UT-Dr-Chen-Wei",
            "specialty": "Oncology",
            "hospital": "Beijing Hospital",
            "title": "Chief Physician",
            "personality_type": "analytical",
            "emotional_state": 50,
            "communication_style": 30,
            "expertise_areas": ["lung cancer", "immunotherapy"],
            "prescribing_habits": "Evidence-based",
            "concerns": "Drug efficacy",
            "objections": ["cost concerns"],
            "probe_topics": ["clinical trial results"],
        },
        {
            "name": "UT-Dr-Li-Ming",
            "specialty": "Cardiology",
            "hospital": "Shanghai Heart Center",
            "title": "Senior Physician",
            "personality_type": "friendly",
            "emotional_state": 20,
            "communication_style": 80,
            "expertise_areas": ["heart failure", "arrhythmia"],
            "prescribing_habits": "Conservative",
            "concerns": "Patient safety",
            "objections": ["side effects"],
            "probe_topics": ["dosing"],
        },
        {
            "name": "UT-Dr-Wang-Fang",
            "specialty": "Neurology",
            "hospital": "Guangzhou Medical",
            "title": "Attending Physician",
            "personality_type": "skeptical",
            "emotional_state": 80,
            "communication_style": 40,
            "expertise_areas": ["stroke", "epilepsy"],
            "prescribing_habits": "Guideline-based",
            "concerns": "Long-term outcomes",
            "objections": ["limited data"],
            "probe_topics": ["mechanism of action"],
        },
    ]

    results = []
    for profile_data in profiles:
        instructions = build_agent_instructions(profile_data)
        agent_name = _sanitize_agent_name(profile_data["name"])
        definition = PromptAgentDefinition(model="gpt-4o", instructions=instructions)

        result = client.agents.create_version(
            agent_name=agent_name,
            definition=definition,
            description="Unit test agent — safe to delete",
        )
        _created_agents.append(result.name)
        results.append({"name": result.name, "version": result.version})

    # All 3 must succeed
    assert len(results) == 3
    agent_names = [r["name"] for r in results]
    assert len(set(agent_names)) == 3, f"Expected 3 unique agents, got: {agent_names}"

    for r in results:
        assert r["name"], f"Agent name must not be empty: {r}"
        assert r["version"], f"Agent version must not be empty: {r}"
        print(f"  Created real agent: name={r['name']}, version={r['version']}")


@_skip_no_creds
@pytest.mark.asyncio
async def test_real_cleanup_test_agents():
    """[REAL] Cleanup: delete any agents created by tests."""
    from app.services.agent_sync_service import _get_project_client

    endpoint, api_key, project = _get_real_azure_config()
    project_endpoint = f"{endpoint}/api/projects/{project}"
    client = _get_project_client(project_endpoint, api_key)

    deleted = 0
    for agent_name in _created_agents:
        try:
            client.agents.delete(agent_name=agent_name)
            deleted += 1
        except Exception as e:
            print(f"  Cleanup: could not delete {agent_name}: {e}")

    print(f"  Cleanup: deleted {deleted}/{len(_created_agents)} test agents")
    _created_agents.clear()


# ===========================================================================
# Phase 12: Agent instruction override tests (D-02)
# ===========================================================================


def test_build_agent_instructions_with_override():
    """build_agent_instructions returns override when non-empty (D-02)."""
    from app.services.agent_sync_service import build_agent_instructions

    data = {
        "name": "Dr. Zhang",
        "specialty": "Oncology",
        "agent_instructions_override": "Custom override instructions for Dr. Zhang",
    }
    result = build_agent_instructions(data)
    assert result == "Custom override instructions for Dr. Zhang"


def test_build_agent_instructions_empty_override():
    """build_agent_instructions returns template when override is empty string."""
    from app.services.agent_sync_service import build_agent_instructions

    data = {
        "name": "Dr. Zhang",
        "specialty": "Oncology",
        "agent_instructions_override": "",
    }
    result = build_agent_instructions(data)
    assert "Dr. Zhang" in result
    assert "Oncology" in result


def test_build_agent_instructions_whitespace_override():
    """build_agent_instructions returns template when override is whitespace-only."""
    from app.services.agent_sync_service import build_agent_instructions

    data = {
        "name": "Dr. Li",
        "specialty": "Hematology",
        "agent_instructions_override": "   ",
    }
    result = build_agent_instructions(data)
    assert "Dr. Li" in result
    assert "Hematology" in result


def test_build_agent_instructions_no_override_key():
    """build_agent_instructions returns template when no override key present."""
    from app.services.agent_sync_service import build_agent_instructions

    data = {
        "name": "Dr. Wang",
        "specialty": "Cardiology",
    }
    result = build_agent_instructions(data)
    assert "Dr. Wang" in result
    assert "Cardiology" in result


def test_build_agent_instructions_override_with_whitespace_stripped():
    """build_agent_instructions strips leading/trailing whitespace from override."""
    from app.services.agent_sync_service import build_agent_instructions

    data = {
        "name": "Dr. Pad",
        "specialty": "GP",
        "agent_instructions_override": "  Custom padded instructions  ",
    }
    result = build_agent_instructions(data)
    assert result == "Custom padded instructions"
