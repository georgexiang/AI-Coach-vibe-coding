"""Knowledge base service: Foundry IQ Knowledge Base integration for HCP Agents.

Lists available search connections and knowledge bases from the AI Foundry project,
manages per-HCP knowledge base configurations, and builds MCPTool definitions
that appear in the Portal 'Knowledge' section (not 'Tools').
"""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hcp_knowledge_config import HcpKnowledgeConfig
from app.schemas.knowledge_base import KnowledgeConfigCreate

logger = logging.getLogger(__name__)


async def list_search_connections(db: AsyncSession) -> list[dict]:
    """List Azure AI Search connections from the Foundry project.

    Returns list of dicts with name, target, is_default keys.
    Returns empty list if Foundry SDK is not installed or not configured.
    """
    try:
        from app.services.agent_sync_service import _get_project_client, get_project_endpoint

        project_endpoint, api_key = await get_project_endpoint(db)
        client = _get_project_client(project_endpoint, api_key)

        import asyncio

        from azure.ai.projects.models import ConnectionType

        connections = await asyncio.to_thread(
            client.connections.list, connection_type=ConnectionType.AZURE_AI_SEARCH
        )

        result = []
        for conn in connections:
            name = getattr(conn, "name", "")
            if not name and hasattr(conn, "get"):
                name = conn.get("name", "")
            target = getattr(conn, "target", "")
            if not target and hasattr(conn, "get"):
                target = conn.get("target", "")
            is_default = getattr(conn, "is_default", False)
            if hasattr(conn, "get") and not is_default:
                is_default = conn.get("is_default", False)
            result.append({"name": name, "target": target, "is_default": bool(is_default)})
        return result
    except ImportError:
        logger.info("Azure AI Projects SDK not installed, returning empty connections list")
        return []
    except Exception as e:
        logger.warning("Failed to list search connections: %s", e)
        return []


async def list_indexes(db: AsyncSession, connection_name: str = "") -> list[dict]:
    """List indexes from an AI Search connection via direct REST API.

    AI Foundry's client.indexes.list() requires workspace-level permissions (403).
    Instead, we get the connection's API key via connections.get(include_credentials=True)
    and call the AI Search REST API directly — matching how AI Foundry portal works.

    If connection_name is empty, uses the default AI Search connection.

    Returns list of dicts with name and optional description keys.
    Returns empty list if SDK not installed or connection unavailable.
    """
    try:
        import asyncio

        from app.services.agent_sync_service import _get_project_client, get_project_endpoint

        project_endpoint, api_key = await get_project_endpoint(db)
        client = _get_project_client(project_endpoint, api_key)

        # Resolve connection: specific name or default AI Search connection
        if connection_name:
            conn = await asyncio.to_thread(
                client.connections.get, name=connection_name, include_credentials=True
            )
        else:
            from azure.ai.projects.models import ConnectionType

            conns = await asyncio.to_thread(
                client.connections.list, connection_type=ConnectionType.AZURE_AI_SEARCH
            )
            conn_list = list(conns)
            if not conn_list:
                return []
            # Pick default or first
            conn = next((c for c in conn_list if getattr(c, "is_default", False)), conn_list[0])
            conn_name = getattr(conn, "name", "")
            conn = await asyncio.to_thread(
                client.connections.get, name=conn_name, include_credentials=True
            )

        search_endpoint = getattr(conn, "target", "").rstrip("/")
        creds = getattr(conn, "credentials", None)
        search_key = getattr(creds, "api_key", "") if creds else ""

        if not search_endpoint or not search_key:
            logger.warning("AI Search connection missing endpoint or key")
            return []

        # Call Foundry IQ knowledgebases API (same as AI Foundry portal)
        import httpx

        async with httpx.AsyncClient(timeout=15) as http:
            resp = await http.get(
                f"{search_endpoint}/knowledgebases",
                params={"api-version": "2025-11-01-preview"},
                headers={"api-key": search_key},
            )
            if resp.status_code != 200:
                logger.warning(
                    "Foundry IQ knowledgebases API returned %d: %s",
                    resp.status_code,
                    resp.text,
                )
                return []
            data = resp.json()
            return [
                {
                    "name": kb.get("name", ""),
                    "version": kb.get("version", None),
                    "type": kb.get("type", None),
                    "description": kb.get("description", kb.get("name", "")),
                }
                for kb in data.get("value", [])
            ]
    except ImportError:
        logger.info("Azure AI Projects SDK not installed, returning empty indexes list")
        return []
    except Exception as e:
        logger.warning("Failed to list indexes: %s", e)
        return []


async def get_knowledge_configs(db: AsyncSession, hcp_profile_id: str) -> list[HcpKnowledgeConfig]:
    """Query all knowledge base configs for an HCP profile."""
    result = await db.execute(
        select(HcpKnowledgeConfig)
        .where(HcpKnowledgeConfig.hcp_profile_id == hcp_profile_id)
        .order_by(HcpKnowledgeConfig.created_at)
    )
    return list(result.scalars().all())


async def add_knowledge_config(
    db: AsyncSession,
    hcp_profile_id: str,
    config: KnowledgeConfigCreate,
) -> HcpKnowledgeConfig:
    """Create an HcpKnowledgeConfig record and trigger agent re-sync."""
    server_label = f"knowledge-base-{config.index_name}"
    record = HcpKnowledgeConfig(
        id=str(uuid.uuid4()),
        hcp_profile_id=hcp_profile_id,
        connection_name=config.connection_name,
        connection_target=config.connection_target,
        index_name=config.index_name,
        server_label=server_label,
        is_enabled=True,
    )
    db.add(record)
    await db.flush()

    # Trigger agent re-sync in background (best effort)
    await _trigger_agent_resync(db, hcp_profile_id)

    return record


async def remove_knowledge_config(db: AsyncSession, config_id: str) -> None:
    """Delete a knowledge base config and trigger agent re-sync."""
    result = await db.execute(select(HcpKnowledgeConfig).where(HcpKnowledgeConfig.id == config_id))
    record = result.scalar_one_or_none()
    if record is None:
        from app.utils.exceptions import not_found

        not_found("Knowledge config not found")

    hcp_profile_id = record.hcp_profile_id
    await db.delete(record)
    await db.flush()

    # Trigger agent re-sync in background (best effort)
    await _trigger_agent_resync(db, hcp_profile_id)


async def resolve_kb_remote_tool_connections(db: AsyncSession) -> dict[str, str]:
    """Look up RemoteTool connections for Knowledge Bases from the Foundry project.

    Portal auto-creates RemoteTool connections when a KB is added via the UI.
    These connections have metadata.knowledgeBaseName matching the KB index name
    and credentials type=CustomKeys (required for MCP endpoint auth).

    Returns a dict mapping KB index_name -> RemoteTool connection name.
    Returns empty dict if SDK not installed, not configured, or no RemoteTool connections exist.
    """
    try:
        import asyncio

        from app.services.agent_sync_service import _get_project_client, get_project_endpoint

        project_endpoint, api_key = await get_project_endpoint(db)
        client = _get_project_client(project_endpoint, api_key)

        connections = await asyncio.to_thread(client.connections.list)

        result: dict[str, str] = {}
        for conn in connections:
            conn_type = conn.get("type", "") if hasattr(conn, "get") else getattr(conn, "type", "")
            if conn_type != "RemoteTool":
                continue
            metadata = (
                conn.get("metadata", {}) if hasattr(conn, "get") else getattr(conn, "metadata", {})
            )
            kb_name = metadata.get("knowledgeBaseName", "") if metadata else ""
            conn_name = conn.get("name", "") if hasattr(conn, "get") else getattr(conn, "name", "")
            if kb_name and conn_name:
                result[kb_name] = conn_name

        logger.info(
            "resolve_kb_remote_tool_connections: found %d RemoteTool KB connections", len(result)
        )
        return result
    except ImportError:
        logger.info("Azure AI Projects SDK not installed, cannot resolve RemoteTool connections")
        return {}
    except Exception as e:
        logger.warning("Failed to resolve RemoteTool connections: %s", e)
        return {}


def build_search_tools(
    configs: list[HcpKnowledgeConfig],
    remote_tool_map: dict[str, str] | None = None,
) -> list:
    """Build MCPTool list from KB configs for agent definition.

    Each enabled config creates an MCPTool pointing to the KB's MCP endpoint.
    This matches how AI Foundry Portal connects Knowledge Bases to agents
    via the 'Knowledge' section (Preview), using the knowledgebases MCP protocol.

    The key difference from AzureAISearchTool (which shows under 'Tools'):
    - MCPTool with server_url pointing to /knowledgebases/{name}/mcp
    - allowed_tools = {"tool_names": ["knowledge_base_retrieve"]}
    - Shows in Portal 'Knowledge' section, not 'Tools' section.

    Authentication: MCPTool requires project_connection_id pointing to a RemoteTool
    connection (credentials type=CustomKeys), NOT a CognitiveSearch connection
    (credentials type=ApiKey). Portal auto-creates RemoteTool connections when KBs
    are added. Pass remote_tool_map (from resolve_kb_remote_tool_connections) to
    look up the correct connection name for each KB. If no match found, omit
    project_connection_id to rely on Portal's auto-URL-matching.

    Returns empty list if SDK is not installed or no enabled configs exist.
    """
    enabled = [c for c in configs if c.is_enabled]
    if not enabled:
        return []

    try:
        from azure.ai.projects.models import MCPTool, MCPToolFilter
    except ImportError:
        logger.info("Azure AI Projects SDK not installed, cannot build search tools")
        return []

    rt_map = remote_tool_map or {}

    tools = []
    for cfg in enabled:
        search_endpoint = cfg.connection_target.rstrip("/")
        mcp_url = (
            f"{search_endpoint}/knowledgebases/{cfg.index_name}/mcp?api-version=2025-11-01-preview"
        )

        # Use RemoteTool connection (CustomKeys) for MCP auth, NOT CognitiveSearch (ApiKey).
        # CognitiveSearch connection causes 403 because its ApiKey credential type is
        # handled differently by the runtime than RemoteTool's CustomKeys type.
        rt_connection_name = rt_map.get(cfg.index_name)
        if rt_connection_name:
            logger.info(
                "build_search_tools: KB '%s' -> RemoteTool connection '%s'",
                cfg.index_name,
                rt_connection_name,
            )
        else:
            logger.warning(
                "build_search_tools: no RemoteTool connection found for KB '%s'. "
                "MCP auth will rely on Portal auto-URL-matching. "
                "Add the KB via AI Foundry Portal to create the required RemoteTool connection.",
                cfg.index_name,
            )

        tool = MCPTool(
            server_label=cfg.server_label or f"knowledge-base-{cfg.index_name}",
            server_url=mcp_url,
            require_approval="never",
            allowed_tools=MCPToolFilter(tool_names=["knowledge_base_retrieve"]),
            project_connection_id=rt_connection_name,
        )
        tools.append(tool)
    return tools


async def _trigger_agent_resync(db: AsyncSession, hcp_profile_id: str) -> None:
    """Best-effort agent re-sync after KB config change."""
    try:
        from sqlalchemy import select as sa_select

        from app.models.hcp_profile import HcpProfile
        from app.services import agent_sync_service

        result = await db.execute(sa_select(HcpProfile).where(HcpProfile.id == hcp_profile_id))
        profile = result.scalar_one_or_none()
        if profile and profile.agent_id:
            await agent_sync_service.sync_agent_for_profile(db, profile)
            logger.info("KB change triggered agent re-sync for profile %s", hcp_profile_id)
    except Exception as e:
        logger.warning(
            "Failed to re-sync agent after KB change for profile %s: %s",
            hcp_profile_id,
            e,
        )
