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


class _ApiKeyTokenCredential:
    """Minimal TokenCredential stub so AIProjectClient constructor doesn't fail.

    The actual authentication is handled by AzureKeyCredentialPolicy which
    sends the key as the 'api-key' HTTP header. This stub is only needed
    because the SDK constructor type-checks for TokenCredential.
    """

    def __init__(self, api_key: str):
        self._key = api_key

    def get_token(self, *scopes, **kwargs):
        import time

        from azure.core.credentials import AccessToken

        return AccessToken(self._key, int(time.time()) + 86400)


def _get_project_client(endpoint: str, api_key: str = ""):
    """Create an AIProjectClient with API key or DefaultAzureCredential fallback.

    For API key auth, we use AzureKeyCredentialPolicy to send the key
    via the 'api-key' HTTP header (not as a Bearer token). This is how
    Azure AI services expect API key authentication.
    """
    from azure.ai.projects import AIProjectClient

    if api_key:
        from azure.core.credentials import AzureKeyCredential
        from azure.core.pipeline.policies import AzureKeyCredentialPolicy

        logger.info("Creating AIProjectClient with api-key header for endpoint: %s", endpoint)
        return AIProjectClient(
            endpoint=endpoint,
            credential=_ApiKeyTokenCredential(api_key),
            authentication_policy=AzureKeyCredentialPolicy(
                credential=AzureKeyCredential(api_key),
                name="api-key",
            ),
        )

    from azure.identity import DefaultAzureCredential

    logger.info("Creating AIProjectClient with DefaultAzureCredential for endpoint: %s", endpoint)
    return AIProjectClient(
        endpoint=endpoint,
        credential=DefaultAzureCredential(),
    )


async def get_project_endpoint(db: AsyncSession) -> tuple[str, str]:
    """Derive AI Foundry project endpoint and API key from config.

    Resolution order for project_name:
      1. voice_live config model_or_deployment (agent mode JSON)
      2. AZURE_FOUNDRY_DEFAULT_PROJECT env var (Settings)
      3. Bare endpoint (no /api/projects/ suffix — will likely 404)

    Returns:
        Tuple of (project_endpoint, api_key).
    """
    from app.config import get_settings

    base_endpoint = await config_service.get_effective_endpoint(db, "azure_voice_live")
    api_key = await config_service.get_effective_key(db, "azure_voice_live")

    voice_config = await config_service.get_config(db, "azure_voice_live")
    project_name = ""
    if voice_config and voice_config.model_or_deployment:
        mode_info = parse_voice_live_mode(voice_config.model_or_deployment)
        project_name = mode_info.get("project_name", "")

    # Fallback: env var AZURE_FOUNDRY_DEFAULT_PROJECT
    if not project_name:
        settings = get_settings()
        project_name = settings.azure_foundry_default_project

    base = base_endpoint.rstrip("/")
    if "/api/projects/" in base:
        project_endpoint = base
    elif project_name:
        project_endpoint = f"{base}/api/projects/{project_name}"
    else:
        logger.warning(
            "No project name configured for AI Foundry agent sync. "
            "Set AZURE_FOUNDRY_DEFAULT_PROJECT env var or configure voice_live "
            "in agent mode with a project_name."
        )
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

    project_endpoint, api_key = await get_project_endpoint(db)
    logger.info("create_agent: endpoint=%s, has_key=%s", project_endpoint, bool(api_key))
    client = _get_project_client(project_endpoint, api_key)

    agent_name = _sanitize_agent_name(name)
    definition = PromptAgentDefinition(model=model, instructions=instructions)

    try:
        result = client.agents.create_version(
            agent_name=agent_name,
            definition=definition,
            description=f"HCP Agent: {name}",
        )
    except Exception as e:
        logger.error(
            "create_agent failed: endpoint=%s, agent_name=%s, error=%s",
            project_endpoint,
            agent_name,
            e,
        )
        raise RuntimeError(f"Agent creation failed (endpoint: {project_endpoint}): {e}") from e
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

    project_endpoint, api_key = await get_project_endpoint(db)
    logger.info("update_agent: endpoint=%s, agent_id=%s", project_endpoint, agent_id)
    client = _get_project_client(project_endpoint, api_key)

    definition = PromptAgentDefinition(model=model, instructions=instructions)

    try:
        result = client.agents.create_version(
            agent_name=agent_id,
            definition=definition,
            description=f"HCP Agent: {name}",
        )
    except Exception as e:
        logger.error(
            "update_agent failed: endpoint=%s, agent_id=%s, error=%s",
            project_endpoint,
            agent_id,
            e,
        )
        raise RuntimeError(f"Agent update failed (endpoint: {project_endpoint}): {e}") from e
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
    project_endpoint, api_key = await get_project_endpoint(db)
    client = _get_project_client(project_endpoint, api_key)

    try:
        client.agents.delete(agent_name=agent_id)
        return True
    except Exception as e:
        logger.warning("Failed to delete agent %s: %s", agent_id, e)
        return False


async def prefetch_sync_config(db: AsyncSession) -> tuple[str, str]:
    """Pre-fetch config values needed for agent sync (endpoint + model).

    Call this BEFORE flushing DB writes so the config reads happen before
    any write locks are held (avoids SQLite "database is locked" errors).
    """
    endpoint, _ = await get_project_endpoint(db)
    master = await config_service.get_master_config(db)
    model = master.model_or_deployment if master else "gpt-4o"
    return endpoint, model


async def sync_agent_for_profile(
    db: AsyncSession,
    profile: object,
    template: str | None = None,
    *,
    prefetched_endpoint: str | None = None,
    prefetched_model: str | None = None,
) -> dict:
    """High-level helper: create or update an AI Foundry agent for an HCP profile.

    If profile.agent_id is truthy, updates the existing agent (creates new version).
    Otherwise, creates a new agent.

    Pass prefetched_endpoint/prefetched_model (from prefetch_sync_config) to avoid
    DB reads during an active write transaction (prevents SQLite locking).
    """
    profile_data = profile.to_prompt_dict()
    instructions = build_agent_instructions(profile_data, template)

    # Use prefetched values or fetch now (fallback for backward compat)
    if prefetched_model is None:
        master = await config_service.get_master_config(db)
        prefetched_model = master.model_or_deployment if master else "gpt-4o"

    if profile.agent_id:
        return await update_agent(
            db, profile.agent_id, profile.name, instructions, prefetched_model
        )
    else:
        return await create_agent(db, profile.name, instructions, prefetched_model)


# ---------------------------------------------------------------------------
# Portal URL discovery — derive from connections API, no extra env vars needed
# ---------------------------------------------------------------------------

_portal_url_cache: dict | None = None


async def get_portal_url_components(db: AsyncSession) -> dict:
    """Discover Azure Portal URL components from the connections API.

    Parses the ARM resource ID from any connection to extract:
    - subscription_hash (base64url of subscription UUID bytes)
    - resource_group
    - resource_name
    - project_name

    Results are cached for the lifetime of the process.
    """
    import base64
    import re
    import uuid

    global _portal_url_cache
    if _portal_url_cache is not None:
        return _portal_url_cache

    try:
        project_endpoint, api_key = await get_project_endpoint(db)
        client = _get_project_client(project_endpoint, api_key)

        # List connections — we only need one to extract the ARM resource ID
        connections = client.connections.list()
        for conn in connections:
            conn_id = conn.get("id", "")
            # ARM ID format:
            # /subscriptions/{sub}/resourceGroups/{rg}/providers/
            # .../accounts/{name}/projects/{proj}/...
            match = re.search(
                r"/subscriptions/([^/]+)/resourceGroups/([^/]+)"
                r"/providers/[^/]+/[^/]+/([^/]+)/projects/([^/]+)",
                conn_id,
            )
            if match:
                sub_id, rg, resource_name, project_name = match.groups()
                # Convert subscription UUID to base64url hash (no padding)
                sub_uuid = uuid.UUID(sub_id)
                sub_hash = base64.urlsafe_b64encode(sub_uuid.bytes).rstrip(b"=").decode()

                _portal_url_cache = {
                    "subscription_hash": sub_hash,
                    "resource_group": rg,
                    "resource_name": resource_name,
                    "project_name": project_name,
                }
                logger.info("Portal URL components discovered from connections API")
                return _portal_url_cache

        logger.warning("No connection with ARM resource ID found")
    except Exception as e:
        logger.warning("Failed to discover portal URL components: %s", e)

    _portal_url_cache = {}
    return _portal_url_cache


async def get_agent_latest_version(db: AsyncSession, agent_name: str) -> str:
    """Query Azure for the latest version of an agent.

    Returns the latest version string, or "1" as fallback.
    """
    try:
        project_endpoint, api_key = await get_project_endpoint(db)
        client = _get_project_client(project_endpoint, api_key)

        agent = client.agents.get(agent_name=agent_name)
        latest = agent.versions.get("latest", {})
        version = str(latest.get("version", "1"))
        logger.info("Agent %s latest version: %s", agent_name, version)
        return version
    except Exception as e:
        logger.warning("Failed to get latest version for agent %s: %s", agent_name, e)
        return "1"
