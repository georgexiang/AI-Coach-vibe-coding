# Agent with Skills

An AI agent that supports installing and composing external standard skills following the [Agent Skills specification](https://agentskills.io/specification). Built with Microsoft Agent Framework and deployable to Azure AI Foundry.

## Features

- **agentskills.io compliant** — Parses SKILL.md files following the standard specification
- **Multiple skill sources** — Load from local directory, git repos, ClawHub marketplace, or direct URL
- **Declarative configuration** — Switch skills via `AGENT_SKILLS` environment variable (no image rebuild)
- **Token-aware** — Estimates token consumption and warns when exceeding limits
- **Foundry-ready** — Includes agent.yaml, Dockerfile, and deployment configuration

## Skill Format

Skills follow the [agentskills.io specification](https://agentskills.io/specification):

```
skill-name/
├── SKILL.md          # Required: YAML frontmatter + Markdown instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: additional documentation
└── assets/           # Optional: templates, resources
```

SKILL.md structure:

```yaml
---
name: skill-name
description: What this skill does and when to use it.
license: MIT                    # optional
compatibility: Python 3.12      # optional
metadata:                       # optional
  author: example-org
allowed-tools: Bash(git:*) Read # optional
---

## Instructions

Markdown body with instructions for the agent...
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME` | Yes | Model deployment name |
| `AGENT_SKILLS` | No | Comma-separated list of skills to load (see format below) |
| `AGENT_BASE_INSTRUCTIONS` | No | Override base system prompt |
| `AGENT_MAX_SKILL_TOKENS` | No | Max token budget for skills (default: 4000) |
| `ENABLE_WEB_SEARCH` | No | Set to `true` to enable web search tool |
| `AZURE_AI_PROJECT_TOOL_CONNECTION_ID` | No | MCP tool connection ID |

## AGENT_SKILLS Format

```
source:identifier[,source:identifier,...]
```

### Sources

| Source | Format | Example |
|--------|--------|---------|
| **local** | `local:<skill-name>` | `local:travel-advisor` |
| **git** | `git:<repo-url>` | `git:git@github.com:kepano/obsidian-skills.git` |
| **git** (specific) | `git:<repo-url>#<skill1>,<skill2>` | `git:git@github.com:kepano/obsidian-skills.git#obsidian-markdown` |
| **clawhub** | `clawhub:<slug>` | `clawhub:couple-coach` |
| **url** | `url:<url>` | `url:https://example.com/SKILL.md` |

### Examples

```bash
# Load built-in skills only
AGENT_SKILLS="local:travel-advisor,local:code-reviewer"

# Install all skills from a git repo
AGENT_SKILLS="git:git@github.com:kepano/obsidian-skills.git"

# Install specific skills from a git repo
AGENT_SKILLS="git:git@github.com:kepano/obsidian-skills.git#obsidian-markdown,defuddle"

# Mix sources
AGENT_SKILLS="local:travel-advisor,git:git@github.com:kepano/obsidian-skills.git#obsidian-markdown,clawhub:couple-coach"
```

When `AGENT_SKILLS` is not set, all skills from the built-in `skills/` directory are loaded automatically.

## Built-in Skills

| Skill | Description |
|-------|-------------|
| `travel-advisor` | Travel planning and hotel recommendation specialist |
| `code-reviewer` | Code review with security and best practices focus |

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
export AZURE_OPENAI_CHAT_DEPLOYMENT_NAME="gpt-4o"
export AGENT_SKILLS="local:travel-advisor"

# Run
python main.py
```

## Deploy to Azure AI Foundry

```bash
# Initialize and deploy
azd ai agent init
azd up
```

## Adding Custom Skills

1. Create a directory under `skills/` matching the skill name
2. Add a `SKILL.md` file with YAML frontmatter and instructions
3. The `name` field must match the directory name
4. Rebuild the container image and redeploy

Or install from a git repo without rebuilding:

```bash
# Set AGENT_SKILLS to include your repo
AGENT_SKILLS="git:git@github.com:your-org/your-skills.git"
```
