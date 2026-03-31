"""Unit tests for agent_sync_service: instruction builder + AI Foundry REST API wrapper."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
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
    # Should not raise KeyError


# --- Test 5: get_project_endpoint derives correct URL ---
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


# --- Test 6: create_agent calls correct URL and returns agent id ---
@pytest.mark.asyncio
async def test_create_agent():
    """create_agent calls POST with api-key header and returns agent id."""
    from app.services.agent_sync_service import create_agent

    mock_db = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "id": "asst_new_123",
        "name": "Test Agent",
    }
    mock_response.raise_for_status = MagicMock()

    proj_url = (
        "https://my-foundry.services.ai.azure.com"
        "/api/projects/my-proj"
    )
    with (
        patch(
            "app.services.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            return_value=(proj_url, "key123"),
        ),
        patch(
            "app.services.agent_sync_service.httpx.AsyncClient",
        ) as mock_client_cls,
    ):
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_cls.return_value = mock_client

        result = await create_agent(
            mock_db, "Test Agent", "You are a test agent", "gpt-4o"
        )

    assert result["id"] == "asst_new_123"
    mock_client.post.assert_called_once()
    call_args = mock_client.post.call_args
    assert "assistants" in call_args[0][0]
    assert call_args[1]["headers"]["api-key"] == "key123"


# --- Test 7: update_agent calls POST to /assistants/{agent_id} ---
@pytest.mark.asyncio
async def test_update_agent():
    """update_agent calls POST to /assistants/{agent_id}."""
    from app.services.agent_sync_service import update_agent

    mock_db = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "id": "asst_existing_456",
        "name": "Updated Agent",
    }
    mock_response.raise_for_status = MagicMock()

    proj_url = (
        "https://my-foundry.services.ai.azure.com"
        "/api/projects/my-proj"
    )
    with (
        patch(
            "app.services.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            return_value=(proj_url, "key456"),
        ),
        patch(
            "app.services.agent_sync_service.httpx.AsyncClient",
        ) as mock_client_cls,
    ):
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_cls.return_value = mock_client

        result = await update_agent(
            mock_db, "asst_existing_456",
            "Updated Agent", "New instructions",
        )

    assert result["id"] == "asst_existing_456"
    call_url = mock_client.post.call_args[0][0]
    assert "asst_existing_456" in call_url


# --- Test 8: delete_agent calls DELETE and returns True on 200 ---
@pytest.mark.asyncio
async def test_delete_agent():
    """delete_agent calls DELETE and returns True on 200."""
    from app.services.agent_sync_service import delete_agent

    mock_db = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200

    proj_url = (
        "https://my-foundry.services.ai.azure.com"
        "/api/projects/my-proj"
    )
    with (
        patch(
            "app.services.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            return_value=(proj_url, "key789"),
        ),
        patch(
            "app.services.agent_sync_service.httpx.AsyncClient",
        ) as mock_client_cls,
    ):
        mock_client = AsyncMock()
        mock_client.delete = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_cls.return_value = mock_client

        result = await delete_agent(mock_db, "asst_to_delete")

    assert result is True
    call_url = mock_client.delete.call_args[0][0]
    assert "asst_to_delete" in call_url


# --- Test 9: create_agent raises on 401/404 ---
@pytest.mark.asyncio
async def test_create_agent_raises_on_error():
    """create_agent raises httpx.HTTPStatusError on 401/404."""
    from app.services.agent_sync_service import create_agent

    mock_db = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_response.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError(
            "Unauthorized",
            request=httpx.Request(
                "POST", "https://example.com/assistants"
            ),
            response=mock_response,
        )
    )

    proj_url = (
        "https://my-foundry.services.ai.azure.com"
        "/api/projects/my-proj"
    )
    with (
        patch(
            "app.services.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            return_value=(proj_url, "bad-key"),
        ),
        patch(
            "app.services.agent_sync_service.httpx.AsyncClient",
        ) as mock_client_cls,
    ):
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_cls.return_value = mock_client

        with pytest.raises(httpx.HTTPStatusError):
            await create_agent(mock_db, "Test", "instructions")


# --- Test 10: sync_agent_for_profile creates/updates based on agent_id ---
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
            return_value={"id": "asst_created", "name": "Dr. New"},
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
            },
        ) as mock_update,
    ):
        result = await sync_agent_for_profile(mock_db, mock_profile)

    assert result["id"] == "asst_existing"
    mock_update.assert_called_once()
    mock_create.assert_not_called()
