"""Agent chat service: send messages to AI Foundry Agents and get responses.

Uses the OpenAI-compatible client from azure-ai-projects SDK to chat with
agents via the Responses API. Chat sessions appear in Azure Portal's agent
playground under the agent's session list.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import agent_sync_service

logger = logging.getLogger(__name__)


async def chat_with_agent(
    db: AsyncSession,
    agent_name: str,
    agent_version: str,
    message: str,
    previous_response_id: str | None = None,
) -> dict:
    """Send a message to an AI Foundry Agent and return the response.

    Uses project_client.get_openai_client() + responses.create() with
    agent_reference, matching Azure AI Foundry's agent chat pattern.

    The model parameter must match an actual deployment in the Azure project.
    We read it from the master config (model_or_deployment field).

    Args:
        db: Database session for config lookup.
        agent_name: The agent name (agent_id from HcpProfile).
        agent_version: The agent version string.
        message: User message to send.
        previous_response_id: Optional response ID for multi-turn conversation.

    Returns:
        Dict with response_text, response_id (for multi-turn), and agent info.
    """
    from app.services import config_service

    project_endpoint, api_key = await agent_sync_service.get_project_endpoint(db)
    client = agent_sync_service._get_project_client(project_endpoint, api_key)

    # Get the deployed model name from master config
    master = await config_service.get_master_config(db)
    model = master.model_or_deployment if master else "gpt-4o"

    openai_client = client.get_openai_client()

    # Build input — for multi-turn, pass previous_response_id
    input_messages = [{"role": "user", "content": message}]

    extra_body = {
        "agent_reference": {
            "name": agent_name,
            "version": agent_version or "1",
            "type": "agent_reference",
        }
    }

    kwargs: dict = {
        "model": model,
        "input": input_messages,
        "extra_body": extra_body,
    }

    # Multi-turn: pass previous response ID for conversation continuity
    if previous_response_id:
        kwargs["previous_response_id"] = previous_response_id

    logger.info(
        "chat_with_agent: endpoint=%s, agent=%s, version=%s, model=%s",
        project_endpoint,
        agent_name,
        agent_version,
        model,
    )

    try:
        response = openai_client.responses.create(**kwargs)
    except Exception as e:
        logger.error("chat_with_agent failed: agent=%s, error=%s", agent_name, e)
        raise RuntimeError(f"Agent chat failed: {e}") from e

    return {
        "response_text": response.output_text,
        "response_id": response.id,
        "agent_name": agent_name,
        "agent_version": agent_version,
    }
