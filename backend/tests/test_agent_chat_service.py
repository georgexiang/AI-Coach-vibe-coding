"""Unit + integration tests for agent_chat_service: real Agent chat via OpenAI Responses API."""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# --- Helper: mock master config for all mock tests ---

def _mock_master_config():
    """Return a mock master config with model_or_deployment."""
    cfg = MagicMock()
    cfg.model_or_deployment = "gpt-4o"
    return cfg


def _patch_config_service():
    """Patch config_service.get_master_config in agent_chat_service."""
    return patch(
        "app.services.config_service.get_master_config",
        new_callable=AsyncMock,
        return_value=_mock_master_config(),
    )


# --- Mock tests ---


@pytest.mark.asyncio
async def test_chat_with_agent_mock():
    """chat_with_agent calls openai_client.responses.create with correct params."""
    from app.services.agent_chat_service import chat_with_agent

    mock_response = MagicMock()
    mock_response.output_text = "Hello, I am Dr. Chen Wei."
    mock_response.id = "resp_mock_001"

    mock_openai_client = MagicMock()
    mock_openai_client.responses.create.return_value = mock_response

    mock_project_client = MagicMock()
    mock_project_client.get_openai_client.return_value = mock_openai_client

    mock_db = AsyncMock()

    with (
        patch(
            "app.services.agent_chat_service.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            return_value=("https://foundry.test/api/projects/test-prj", "test-key"),
        ),
        patch(
            "app.services.agent_chat_service.agent_sync_service._get_project_client",
            return_value=mock_project_client,
        ),
        _patch_config_service(),
    ):
        result = await chat_with_agent(
            mock_db,
            agent_name="Dr-Chen-Wei",
            agent_version="1",
            message="Tell me about your practice.",
        )

    assert result["response_text"] == "Hello, I am Dr. Chen Wei."
    assert result["response_id"] == "resp_mock_001"
    assert result["agent_name"] == "Dr-Chen-Wei"
    assert result["agent_version"] == "1"

    # Verify correct API call
    call_kwargs = mock_openai_client.responses.create.call_args[1]
    assert call_kwargs["model"] == "gpt-4o"
    assert call_kwargs["input"] == [{"role": "user", "content": "Tell me about your practice."}]
    assert call_kwargs["extra_body"]["agent_reference"]["name"] == "Dr-Chen-Wei"
    assert call_kwargs["extra_body"]["agent_reference"]["version"] == "1"
    assert call_kwargs["extra_body"]["agent_reference"]["type"] == "agent_reference"


@pytest.mark.asyncio
async def test_chat_with_agent_multiturn_mock():
    """chat_with_agent passes previous_response_id for multi-turn conversation."""
    from app.services.agent_chat_service import chat_with_agent

    mock_response = MagicMock()
    mock_response.output_text = "Follow-up response."
    mock_response.id = "resp_mock_002"

    mock_openai_client = MagicMock()
    mock_openai_client.responses.create.return_value = mock_response

    mock_project_client = MagicMock()
    mock_project_client.get_openai_client.return_value = mock_openai_client

    mock_db = AsyncMock()

    with (
        patch(
            "app.services.agent_chat_service.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            return_value=("https://foundry.test/api/projects/test-prj", "test-key"),
        ),
        patch(
            "app.services.agent_chat_service.agent_sync_service._get_project_client",
            return_value=mock_project_client,
        ),
        _patch_config_service(),
    ):
        result = await chat_with_agent(
            mock_db,
            agent_name="Dr-Li",
            agent_version="2",
            message="What about side effects?",
            previous_response_id="resp_mock_001",
        )

    assert result["response_text"] == "Follow-up response."
    assert result["response_id"] == "resp_mock_002"

    call_kwargs = mock_openai_client.responses.create.call_args[1]
    assert call_kwargs["previous_response_id"] == "resp_mock_001"


@pytest.mark.asyncio
async def test_chat_with_agent_error_mock():
    """chat_with_agent raises RuntimeError when API call fails."""
    from app.services.agent_chat_service import chat_with_agent

    mock_openai_client = MagicMock()
    mock_openai_client.responses.create.side_effect = Exception("API timeout")

    mock_project_client = MagicMock()
    mock_project_client.get_openai_client.return_value = mock_openai_client

    mock_db = AsyncMock()

    with (
        patch(
            "app.services.agent_chat_service.agent_sync_service.get_project_endpoint",
            new_callable=AsyncMock,
            return_value=("https://foundry.test/api/projects/test-prj", "test-key"),
        ),
        patch(
            "app.services.agent_chat_service.agent_sync_service._get_project_client",
            return_value=mock_project_client,
        ),
        _patch_config_service(),
    ):
        with pytest.raises(RuntimeError, match="Agent chat failed"):
            await chat_with_agent(
                mock_db,
                agent_name="Dr-Error",
                agent_version="1",
                message="Hello",
            )


# ===========================================================================
# Real Azure integration tests — use actual .env credentials when available
# ===========================================================================

def _get_real_azure_config() -> tuple[str, str, str]:
    """Read Azure AI Foundry config from .env."""
    from dotenv import load_dotenv

    load_dotenv()
    endpoint = os.getenv("AZURE_FOUNDRY_ENDPOINT", "").rstrip("/")
    api_key = os.getenv("AZURE_FOUNDRY_API_KEY", "")
    project = os.getenv("AZURE_FOUNDRY_DEFAULT_PROJECT", "")
    return endpoint, api_key, project


def _get_real_deployment_model() -> str:
    """Read the actual deployment model name from .env."""
    from dotenv import load_dotenv

    load_dotenv()
    return os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")


def _has_real_azure_config() -> bool:
    endpoint, api_key, project = _get_real_azure_config()
    return bool(endpoint and api_key and project)


_skip_no_creds = pytest.mark.skipif(
    not _has_real_azure_config(),
    reason="No Azure AI Foundry credentials in .env",
)

# Track agents created for cleanup
_created_agents: list[str] = []


@_skip_no_creds
@pytest.mark.asyncio
async def test_real_chat_with_existing_agent():
    """[REAL] Create an agent, then chat with it using the Responses API.

    This verifies the full flow:
    1. Create agent via Agent Registry API
    2. Chat with agent via openai_client.responses.create + agent_reference
    3. Verify response is non-empty
    4. Cleanup: delete the agent
    """
    from app.services.agent_sync_service import (
        _get_project_client,
        _sanitize_agent_name,
        build_agent_instructions,
    )

    endpoint, api_key, project = _get_real_azure_config()
    model = _get_real_deployment_model()
    project_endpoint = f"{endpoint}/api/projects/{project}"
    client = _get_project_client(project_endpoint, api_key)

    # Step 1: Create a test agent with the ACTUAL deployment model
    from azure.ai.projects.models import PromptAgentDefinition

    agent_name = _sanitize_agent_name("UT-Chat-Dr-Chen")
    instructions = build_agent_instructions({
        "name": "UT-Chat-Dr-Chen",
        "specialty": "Oncology",
        "hospital": "Test Hospital",
        "title": "Physician",
        "personality_type": "friendly",
        "emotional_state": 30,
        "communication_style": 60,
        "expertise_areas": ["testing"],
        "prescribing_habits": "N/A",
        "concerns": "test",
        "objections": ["none"],
        "probe_topics": ["test"],
    })

    definition = PromptAgentDefinition(model=model, instructions=instructions)
    create_result = client.agents.create_version(
        agent_name=agent_name,
        definition=definition,
        description="Unit test chat agent — safe to delete",
    )
    _created_agents.append(create_result.name)
    print(f"  Created agent: {create_result.name} v{create_result.version} (model={model})")

    # Step 2: Chat with the agent using OpenAI Responses API
    openai_client = client.get_openai_client()

    response = openai_client.responses.create(
        model=model,
        input=[{"role": "user", "content": "Hello doctor, tell me about your specialty."}],
        extra_body={
            "agent_reference": {
                "name": create_result.name,
                "version": str(create_result.version),
                "type": "agent_reference",
            }
        },
    )

    print(f"  Response ID: {response.id}")
    print(f"  Response text: {response.output_text[:200]}")

    # Verify response
    assert response.id, "Response ID must not be empty"
    assert response.output_text, "Response text must not be empty"
    assert len(response.output_text) > 10, "Response should have substantial content"

    # Step 3: Multi-turn — send a follow-up
    response2 = openai_client.responses.create(
        model=model,
        input=[{"role": "user", "content": "What treatments do you recommend?"}],
        previous_response_id=response.id,
        extra_body={
            "agent_reference": {
                "name": create_result.name,
                "version": str(create_result.version),
                "type": "agent_reference",
            }
        },
    )

    print(f"  Follow-up response: {response2.output_text[:200]}")
    assert response2.output_text, "Follow-up response must not be empty"
    assert response2.id != response.id, "Follow-up should have a different response ID"


@_skip_no_creds
@pytest.mark.asyncio
async def test_real_chat_cleanup():
    """[REAL] Cleanup: delete agents created during chat tests."""
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
