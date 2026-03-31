"""Agent sync service: bidirectional sync between HCP profiles and AI Foundry Agents.

Creates, updates, and deletes AI Foundry Agents via REST API (/assistants endpoint)
when HCP profiles are created, updated, or deleted. Uses httpx for async HTTP calls
with api-key header auth (matching project convention from connection_tester.py).
"""

from collections import defaultdict

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import config_service
from app.services.agents.adapters.azure_voice_live import parse_voice_live_mode

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
    # Create a copy so we don't mutate the original
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

    # Use defaultdict for safe missing-key handling
    safe_data = defaultdict(lambda: "", data)

    use_template = template or DEFAULT_AGENT_TEMPLATE
    return use_template.format_map(safe_data)


async def get_project_endpoint(db: AsyncSession) -> tuple[str, str]:
    """Derive AI Foundry project endpoint and API key from config.

    Gets the base endpoint from voice_live config (falls back to master),
    parses project_name from voice_live mode config, and constructs the
    full project endpoint URL.

    Returns:
        Tuple of (project_endpoint, api_key).
    """
    base_endpoint = await config_service.get_effective_endpoint(db, "azure_voice_live")
    api_key = await config_service.get_effective_key(db, "azure_voice_live")

    # Get project_name from voice_live config's model_or_deployment
    voice_config = await config_service.get_config(db, "azure_voice_live")
    project_name = ""
    if voice_config and voice_config.model_or_deployment:
        mode_info = parse_voice_live_mode(voice_config.model_or_deployment)
        project_name = mode_info.get("project_name", "")

    # Construct project endpoint
    base = base_endpoint.rstrip("/")
    if "/api/projects/" in base:
        # Already contains project path — use as-is
        project_endpoint = base
    elif project_name:
        project_endpoint = f"{base}/api/projects/{project_name}"
    else:
        # No project_name available — use base endpoint directly
        project_endpoint = base

    return (project_endpoint, api_key)


async def create_agent(
    db: AsyncSession,
    name: str,
    instructions: str,
    model: str = "gpt-4o",
) -> dict:
    """Create an AI Foundry Agent via REST API.

    POST to {project_endpoint}/assistants?api-version={API_VERSION}
    with api-key header auth.

    Returns the response JSON containing the agent 'id'.
    """
    project_endpoint, api_key = await get_project_endpoint(db)
    url = f"{project_endpoint}/assistants?api-version={AI_FOUNDRY_API_VERSION}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            headers={"api-key": api_key, "Content-Type": "application/json"},
            json={"model": model, "name": name, "instructions": instructions},
        )
        response.raise_for_status()
        return response.json()


async def update_agent(
    db: AsyncSession,
    agent_id: str,
    name: str,
    instructions: str,
) -> dict:
    """Update an existing AI Foundry Agent via REST API.

    POST to {project_endpoint}/assistants/{agent_id}?api-version={API_VERSION}
    with updated name and instructions.

    Returns the response JSON.
    """
    project_endpoint, api_key = await get_project_endpoint(db)
    url = (
        f"{project_endpoint}/assistants/{agent_id}"
        f"?api-version={AI_FOUNDRY_API_VERSION}"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            headers={"api-key": api_key, "Content-Type": "application/json"},
            json={"name": name, "instructions": instructions},
        )
        response.raise_for_status()
        return response.json()


async def delete_agent(db: AsyncSession, agent_id: str) -> bool:
    """Delete an AI Foundry Agent via REST API.

    DELETE to {project_endpoint}/assistants/{agent_id}?api-version={API_VERSION}

    Returns True if the deletion was successful (HTTP 200).
    """
    project_endpoint, api_key = await get_project_endpoint(db)
    url = (
        f"{project_endpoint}/assistants/{agent_id}"
        f"?api-version={AI_FOUNDRY_API_VERSION}"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.delete(
            url,
            headers={"api-key": api_key},
        )
        return response.status_code == 200


async def sync_agent_for_profile(
    db: AsyncSession,
    profile: object,
    template: str | None = None,
) -> dict:
    """High-level helper: create or update an AI Foundry agent for an HCP profile.

    If profile.agent_id is truthy, updates the existing agent.
    Otherwise, creates a new agent.

    Args:
        db: Async database session.
        profile: HcpProfile ORM instance with to_prompt_dict() and agent_id.
        template: Optional custom instruction template.

    Returns:
        The API response dict from create or update.
    """
    profile_data = profile.to_prompt_dict()
    instructions = build_agent_instructions(profile_data, template)

    # Get model from master config
    master = await config_service.get_master_config(db)
    model = master.model_or_deployment if master else "gpt-4o"

    if profile.agent_id:
        return await update_agent(db, profile.agent_id, profile.name, instructions)
    else:
        return await create_agent(db, profile.name, instructions, model)
