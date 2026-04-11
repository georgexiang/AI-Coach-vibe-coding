"""
Coaching Skill Creator Agent — Transforms documents into coaching SKILL.md files.

Loads the coaching-skill-creator skill at startup and serves an agent
that guides users through the 5-phase coaching skill creation pipeline.
Supports file uploads (PDF, DOCX, PPTX) via the file_search tool.
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

    # 2. Load the coaching-skill-creator skill
    sm = SkillManager()
    skills_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skills")
    skills = sm.load_from_directory(skills_dir)

    base_instructions = (
        "You are a Coaching Skill Creator agent. "
        "Your primary function is to help users transform their documents "
        "(PDF, Word, PPT) into standardized coaching skills (SKILL.md files) "
        "that can be installed on other AI agents. "
        "Follow the skill instructions precisely through all 5 phases."
    )
    max_skill_tokens = int(os.environ.get("AGENT_MAX_SKILL_TOKENS", "8000"))

    instructions = sm.compose_instructions(
        base_instructions, skills, max_tokens=max_skill_tokens
    )

    logger.info(
        "Loaded %d skill(s): %s",
        len(skills),
        ", ".join(s.name for s in skills) if skills else "(none)",
    )

    # 3. Configure tools
    tools = []
    if os.environ.get("ENABLE_WEB_SEARCH", "").lower() == "true":
        tools.append({"type": "web_search_preview"})
    if conn_id := os.environ.get("AZURE_AI_PROJECT_TOOL_CONNECTION_ID"):
        tools.append({"type": "mcp", "project_connection_id": conn_id})

    # 4. Create Agent
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
        name="CoachingSkillCreator",
        instructions=instructions,
        context_providers=context_providers if context_providers else None,
    )

    # 5. Configure session persistence (enabled by default for multi-turn)
    session_repo = None
    enable_persistence = os.environ.get(
        "ENABLE_SESSION_PERSISTENCE", "true"
    ).lower()
    if enable_persistence == "true":
        storage_path = os.environ.get("SESSION_STORAGE_PATH", "./thread_storage")
        session_repo = JsonLocalFileAgentSessionRepository(storage_path=storage_path)
        logger.info("Session persistence enabled: %s", storage_path)

    # 6. Start HTTP service
    logger.info("Starting CoachingSkillCreator on http://localhost:8088")
    app = from_agent_framework(agent, session_repository=session_repo)
    asyncio.run(app.run_async())


if __name__ == "__main__":
    main()
