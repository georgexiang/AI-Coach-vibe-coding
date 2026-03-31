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

    custom_template = (
        "Hello, I am {name} from {specialty}. "
        "Style: {communication_style_desc}."
    )
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
    r5 = build_agent_instructions(
        {"name": "A", "specialty": "B", "communication_style": "auto"}
    )
    assert "moderate" in r5


# --- Test 6: get_project_endpoint derives correct URL ---
@pytest.mark.asyncio
async def test_get_project_endpoint():
    """get_project_endpoint derives URL from master config + project_name."""
    from app.services.agent_sync_service import get_project_endpoint

    mock_db = AsyncMock()

    mock_voice_config = MagicMock()
    mock_voice_config.model_or_deployment = (
        '{"mode": "agent", "agent_id": "asst_abc",'
        ' "project_name": "my-project"}'
    )

    with (
        patch(
            "app.services.agent_sync_service.config_service"
            ".get_effective_endpoint",
            new_callable=AsyncMock,
            return_value="https://my-foundry.services.ai.azure.com",
        ),
        patch(
            "app.services.agent_sync_service.config_service"
            ".get_effective_key",
            new_callable=AsyncMock,
            return_value="test-api-key-123",
        ),
        patch(
            "app.services.agent_sync_service.config_service.get_config",
            new_callable=AsyncMock,
            return_value=mock_voice_config,
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

    with (
        patch(
            "app.services.agent_sync_service.config_service"
            ".get_effective_endpoint",
            new_callable=AsyncMock,
            return_value="https://foundry.azure.com/api/projects/existing-proj",
        ),
        patch(
            "app.services.agent_sync_service.config_service"
            ".get_effective_key",
            new_callable=AsyncMock,
            return_value="key",
        ),
        patch(
            "app.services.agent_sync_service.config_service.get_config",
            new_callable=AsyncMock,
            return_value=None,
        ),
    ):
        endpoint, _ = await get_project_endpoint(mock_db)

    assert endpoint == "https://foundry.azure.com/api/projects/existing-proj"


# --- Test 8: get_project_endpoint no project_name fallback ---
@pytest.mark.asyncio
async def test_get_project_endpoint_no_project():
    """get_project_endpoint falls back to base endpoint when no project_name."""
    from app.services.agent_sync_service import get_project_endpoint

    mock_db = AsyncMock()
    mock_config = MagicMock()
    mock_config.model_or_deployment = "gpt-4o-realtime"  # model mode, no project

    with (
        patch(
            "app.services.agent_sync_service.config_service"
            ".get_effective_endpoint",
            new_callable=AsyncMock,
            return_value="https://foundry.azure.com",
        ),
        patch(
            "app.services.agent_sync_service.config_service"
            ".get_effective_key",
            new_callable=AsyncMock,
            return_value="key",
        ),
        patch(
            "app.services.agent_sync_service.config_service.get_config",
            new_callable=AsyncMock,
            return_value=mock_config,
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
        result = await update_agent(
            mock_db, "existing-agent", "Updated", "New instructions"
        )

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
            "app.services.agent_sync_service.config_service"
            ".get_master_config",
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
            "app.services.agent_sync_service.config_service"
            ".get_master_config",
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
            "app.services.agent_sync_service.config_service"
            ".get_master_config",
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
