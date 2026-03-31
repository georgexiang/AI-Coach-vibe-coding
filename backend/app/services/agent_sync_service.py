"""Agent sync service: bidirectional sync between HCP profiles and AI Foundry Agents.

Creates, updates, and deletes AI Foundry Agents when HCP profiles change.
Uses the official azure-ai-projects SDK with DefaultAzureCredential for Entra
ID authentication (supports Azure CLI locally, Managed Identity in production).
"""

import logging
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import config_service
from app.services.agents.adapters.azure_voice_live import parse_voice_live_mode

logger = logging.getLogger(__name__)

AI_FOUNDRY_API_VERSION = "2025-05-01"

DEFAULT_AGENT_TEMPLATE = """You are {name}, a {specialty} specialist.

Personality: {personality_type}
Communication Style: {communication_style_desc} (level: {communication_style}/100)
Emotional State: {emotional_state_desc} (level: {emotional_state}/100)

Background:
- Hospital: {hospital}
- Title: {title}
- Expertise: {expertise_areas}
- Prescribing Habits: {prescribing_habits}
- Key Concerns: {concerns}

Common Objections:
{objections}

Topics You Probe About:
{probe_topics}

Stay in character throughout the conversation. \
Respond as this HCP would in a real face-to-face interaction with a Medical Representative."""


def build_agent_instructions(profile_data: dict, template: str | None = None) -> str:
    """Build agent instructions from HCP profile data.

    Converts list fields to comma-separated strings, adds computed descriptor
    fields (communication_style_desc, emotional_state_desc), and formats
    using the provided template or DEFAULT_AGENT_TEMPLATE.

    Uses str.format_map with defaultdict for safe missing-key handling.
    """
    data = dict(profile_data)

    # Convert list fields to comma-separated strings
    for field in ("expertise_areas", "objections", "probe_topics"):
        value = data.get(field)
        if isinstance(value, list):
            data[field] = ", ".join(str(item) for item in value)

    # Add computed descriptor fields
    comm_style = data.get("communication_style", 50)
    if isinstance(comm_style, (int, float)):
        data["communication_style_desc"] = "direct" if comm_style < 50 else "indirect"
    else:
        data["communication_style_desc"] = "moderate"

    emotional = data.get("emotional_state", 50)
    if isinstance(emotional, (int, float)):
        if emotional < 30:
            data["emotional_state_desc"] = "calm and open"
        elif emotional < 70:
            data["emotional_state_desc"] = "neutral"
        else:
            data["emotional_state_desc"] = "resistant"
    else:
        data["emotional_state_desc"] = "neutral"

    safe_data = defaultdict(lambda: "", data)
    use_template = template or DEFAULT_AGENT_TEMPLATE
    return use_template.format_map(safe_data)


def _get_project_client(endpoint: str):
    """Create an AIProjectClient with DefaultAzureCredential.

    Supports Azure CLI (local dev) and Managed Identity (production).
    """
    from azure.ai.projects import AIProjectClient
    from azure.identity import DefaultAzureCredential

    return AIProjectClient(
        endpoint=endpoint,
        credential=DefaultAzureCredential(),
    )


async def get_project_endpoint(db: AsyncSession) -> tuple[str, str]:
    """Derive AI Foundry project endpoint and API key from config.

    Returns:
        Tuple of (project_endpoint, api_key).
    """
    base_endpoint = await config_service.get_effective_endpoint(db, "azure_voice_live")
    api_key = await config_service.get_effective_key(db, "azure_voice_live")

    voice_config = await config_service.get_config(db, "azure_voice_live")
    project_name = ""
    if voice_config and voice_config.model_or_deployment:
        mode_info = parse_voice_live_mode(voice_config.model_or_deployment)
        project_name = mode_info.get("project_name", "")

    base = base_endpoint.rstrip("/")
    if "/api/projects/" in base:
        project_endpoint = base
    elif project_name:
        project_endpoint = f"{base}/api/projects/{project_name}"
    else:
        project_endpoint = base

    return (project_endpoint, api_key)


def _sanitize_agent_name(name: str) -> str:
    """Sanitize HCP name into a valid agent name (alphanumeric, hyphens, underscores)."""
    import re

    sanitized = re.sub(r"[^a-zA-Z0-9_-]", "-", name.strip())
    sanitized = re.sub(r"-+", "-", sanitized).strip("-")
    return sanitized[:64] or "hcp-agent"


async def create_agent(
    db: AsyncSession,
    name: str,
    instructions: str,
    model: str = "gpt-4o",
) -> dict:
    """Create an AI Foundry Agent via azure-ai-projects SDK.

    Uses the Agent Registry API (client.agents.create_version) with
    PromptAgentDefinition. Returns dict with agent name, version, and id.
    """
    from azure.ai.projects.models import PromptAgentDefinition

    project_endpoint, _ = await get_project_endpoint(db)
    client = _get_project_client(project_endpoint)

    agent_name = _sanitize_agent_name(name)
    definition = PromptAgentDefinition(model=model, instructions=instructions)

    result = client.agents.create_version(
        agent_name=agent_name,
        definition=definition,
        description=f"HCP Agent: {name}",
    )
    return {
        "id": result.name,
        "name": result.name,
        "version": result.version,
        "model": model,
    }


async def update_agent(
    db: AsyncSession,
    agent_id: str,
    name: str,
    instructions: str,
    model: str = "gpt-4o",
) -> dict:
    """Update an existing AI Foundry Agent by creating a new version.

    AI Foundry agents are immutable — updates create new versions.
    Returns dict with updated agent metadata.
    """
    from azure.ai.projects.models import PromptAgentDefinition

    project_endpoint, _ = await get_project_endpoint(db)
    client = _get_project_client(project_endpoint)

    definition = PromptAgentDefinition(model=model, instructions=instructions)

    result = client.agents.create_version(
        agent_name=agent_id,
        definition=definition,
        description=f"HCP Agent: {name}",
    )
    return {
        "id": result.name,
        "name": result.name,
        "version": result.version,
        "model": model,
    }


async def delete_agent(db: AsyncSession, agent_id: str) -> bool:
    """Delete an AI Foundry Agent via azure-ai-projects SDK.

    Returns True if deletion was successful.
    """
    project_endpoint, _ = await get_project_endpoint(db)
    client = _get_project_client(project_endpoint)

    try:
        client.agents.delete(agent_name=agent_id)
        return True
    except Exception as e:
        logger.warning("Failed to delete agent %s: %s", agent_id, e)
        return False


async def sync_agent_for_profile(
    db: AsyncSession,
    profile: object,
    template: str | None = None,
) -> dict:
    """High-level helper: create or update an AI Foundry agent for an HCP profile.

    If profile.agent_id is truthy, updates the existing agent (creates new version).
    Otherwise, creates a new agent.
    """
    profile_data = profile.to_prompt_dict()
    instructions = build_agent_instructions(profile_data, template)

    master = await config_service.get_master_config(db)
    model = master.model_or_deployment if master else "gpt-4o"

    if profile.agent_id:
        return await update_agent(db, profile.agent_id, profile.name, instructions, model)
    else:
        return await create_agent(db, profile.name, instructions, model)
