---
phase: 01-skillable-agent
plan: 02
subsystem: agent-integration
tags: [agent-framework, deployment, dockerfile, foundry]
dependency_graph:
  requires: [skill_manager.py]
  provides: [main.py, agent.yaml, Dockerfile, requirements.txt, README.md]
  affects: []
tech_stack:
  added: [azure-ai-agentserver-agentframework]
  patterns: [deferred-import, env-var-config, foundry-hosted]
key_files:
  created:
    - agent-framework/agent-with-skills/main.py
    - agent-framework/agent-with-skills/agent.yaml
    - agent-framework/agent-with-skills/Dockerfile
    - agent-framework/agent-with-skills/requirements.txt
    - agent-framework/agent-with-skills/README.md
decisions:
  - Deferred SDK imports to avoid early init failures (per Pitfall 7)
  - Added git to Dockerfile for git: source support
  - Default behavior loads all built-in skills when AGENT_SKILLS not set
metrics:
  duration: ~2min
  completed: 2026-04-08
---

# Phase 01 Plan 02: Agent Integration + Deployment Summary

**One-liner:** Agent entry point with declarative skill loading via AGENT_SKILLS env var, complete Foundry deployment config including git-enabled Dockerfile.

## What Was Built

- `main.py` (95 lines): Agent entry point — reads AGENT_SKILLS, loads skills, composes instructions, creates ChatAgent, starts HTTP service
- `agent.yaml`: Foundry hosted agent config with AGENT_SKILLS, AGENT_MAX_SKILL_TOKENS
- `Dockerfile`: python:3.12-slim + git (for git: source), EXPOSE 8088
- `requirements.txt`: 3 dependencies (agentserver SDK, frontmatter, httpx)
- `README.md` (131 lines): Full documentation covering all 4 source types, env vars, deployment

## Key Implementation Details

### main.py Flow
1. Validate env vars (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_CHAT_DEPLOYMENT_NAME)
2. Read AGENT_SKILLS env var → parse comma-separated specs
3. Load skills via SkillManager (or default to built-in skills/ dir)
4. Compose instructions (base + skills)
5. Optional Foundry tools (web_search, MCP)
6. Create AzureOpenAIChatClient + ChatAgent
7. Start HTTP service via from_agent_framework()

### AGENT_SKILLS Format Examples
```
local:travel-advisor
git:git@github.com:kepano/obsidian-skills.git
git:git@github.com:kepano/obsidian-skills.git#obsidian-markdown,defuddle
clawhub:couple-coach
url:https://example.com/SKILL.md
```

## Commits

- `1b85150`: feat(01-02): create main.py agent entry point
- `07cfa8d`: chore(01-02): add deployment config and documentation

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
- main.py: FOUND
- agent.yaml: FOUND
- Dockerfile: FOUND
- requirements.txt: FOUND
- README.md: FOUND
- Commit 1b85150: FOUND
- Commit 07cfa8d: FOUND
