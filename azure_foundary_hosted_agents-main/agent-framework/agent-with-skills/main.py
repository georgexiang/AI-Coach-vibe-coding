"""
Skillable Agent — An AI agent that supports installing and composing
external standard skills (agentskills.io specification).

Skills are loaded at startup based on the AGENT_SKILLS environment variable.
Supports: local directory, git repo, ClawHub marketplace, and direct URL.
"""

import logging
import os

from skill_manager import SkillManager

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def main():
    # 1. Validate required environment variables
    required_env_vars = [
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_CHAT_DEPLOYMENT_NAME",
    ]
    for env_var in required_env_vars:
        assert env_var in os.environ and os.environ[env_var], (
            f"{env_var} environment variable must be set."
        )

    # 2. Read skill configuration
    agent_skills_env = os.environ.get("AGENT_SKILLS", "")
    base_instructions = os.environ.get(
        "AGENT_BASE_INSTRUCTIONS",
        "You are a helpful assistant enhanced with specialized skills.",
    )
    max_skill_tokens = int(os.environ.get("AGENT_MAX_SKILL_TOKENS", "4000"))

    # 3. Load skills
    sm = SkillManager()

    if agent_skills_env:
        skill_specs = [s.strip() for s in agent_skills_env.split(",") if s.strip()]
        logger.info("Loading skills from AGENT_SKILLS: %s", skill_specs)
        skills = sm.load_skills(skill_specs)
    else:
        # Default: load all built-in skills from skills/ directory
        skills_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skills")
        if os.path.isdir(skills_dir):
            logger.info("Loading built-in skills from %s", skills_dir)
            skills = sm.load_from_directory(skills_dir)
        else:
            skills = []

    logger.info(
        "Loaded %d skill(s): %s",
        len(skills),
        ", ".join(s.name for s in skills) if skills else "(none)",
    )

    # 4. Compose instructions
    instructions = sm.compose_instructions(
        base_instructions, skills, max_tokens=max_skill_tokens
    )

    # 5. Optional Foundry tools (web_search, MCP)
    tools = []
    if os.environ.get("ENABLE_WEB_SEARCH", "").lower() == "true":
        tools.append({"type": "web_search_preview"})
    if conn_id := os.environ.get("AZURE_AI_PROJECT_TOOL_CONNECTION_ID"):
        tools.append({"type": "mcp", "project_connection_id": conn_id})

    # 6. Create Agent  (imports deferred to avoid early init failures)
    import asyncio

    from agent_framework.azure import AzureOpenAIChatClient
    from azure.ai.agentserver.agentframework import (
        FoundryToolsContextProvider,
        from_agent_framework,
    )
    from azure.ai.agentserver.agentframework.persistence import (
        JsonLocalFileAgentSessionRepository,
    )
    from azure.identity import DefaultAzureCredential

    context_providers = [FoundryToolsContextProvider(tools)] if tools else []
    chat_client = AzureOpenAIChatClient(
        credential=DefaultAzureCredential(),
    )
    agent = chat_client.as_agent(
        name="SkillableAgent",
        instructions=instructions,
        context_providers=context_providers if context_providers else None,
    )

    # 7. Configure session persistence
    session_repo = None
    if os.environ.get("ENABLE_SESSION_PERSISTENCE", "").lower() == "true":
        storage_path = os.environ.get("SESSION_STORAGE_PATH", "./thread_storage")
        session_repo = JsonLocalFileAgentSessionRepository(storage_path=storage_path)
        logger.info("Session persistence enabled: %s", storage_path)

    # 8. Start HTTP service
    logger.info("Starting SkillableAgent on http://localhost:8088")

    # 9. Inject gen_ai.azure_ai_project.id into trace spans
    #    The Foundry Portal Traces page filters by this attribute.
    project_endpoint = os.environ.get("AZURE_AI_PROJECT_ENDPOINT", "")
    if project_endpoint:
        try:
            from azure.ai.agentserver.core.logger import request_context
            from azure.ai.agentserver.core.server.base import AgentRunContextMiddleware

            # Derive CognitiveServices project resource ID
            project_id = os.environ.get("AZURE_AI_FOUNDRY_PROJECT_ID", "")
            if not project_id:
                from urllib.parse import urlparse
                parsed = urlparse(project_endpoint)
                account_name = parsed.hostname.split(".")[0]
                project_name = parsed.path.rstrip("/").split("/")[-1]
                sub = os.environ.get("AZURE_SUBSCRIPTION_ID", "")
                rg = os.environ.get("AZURE_RESOURCE_GROUP", "")
                project_id = (
                    f"/subscriptions/{sub}/resourceGroups/{rg}"
                    f"/providers/Microsoft.CognitiveServices"
                    f"/accounts/{account_name}/projects/{project_name}"
                )

            # Patch middleware to add project ID to request-level context
            _orig_set_ctx = AgentRunContextMiddleware.set_run_context_to_context_var

            def _patched_set_ctx(self, run_context):
                _orig_set_ctx(self, run_context)
                ctx = request_context.get() or {}
                ctx["gen_ai.azure_ai_project.id"] = project_id
                request_context.set(ctx)

            AgentRunContextMiddleware.set_run_context_to_context_var = _patched_set_ctx

            # Also set as OTEL resource attribute so ALL spans (including child
            # dependency spans from agent_framework) carry the project ID.
            os.environ.setdefault(
                "OTEL_RESOURCE_ATTRIBUTES",
                f"gen_ai.azure_ai_project.id={project_id}",
            )
            logger.info("Injected gen_ai.azure_ai_project.id: %s", project_id)
        except Exception as e:
            logger.warning("Failed to inject project ID into traces: %s", e)

    app = from_agent_framework(agent, session_repository=session_repo)
    asyncio.run(app.run_async())


if __name__ == "__main__":
    main()
