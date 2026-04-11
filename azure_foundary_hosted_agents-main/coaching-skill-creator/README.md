# Coaching Skill Creator

A meta-agent that transforms source documents (PDF, Word, PPT) into standardized **coaching skills** (SKILL.md files) following the [agentskills.io](https://agentskills.io) specification.

## What It Does

The Coaching Skill Creator guides you through a **5-phase pipeline**:

| Phase | Name | What Happens |
|-------|------|--------------|
| 1 | 📥 Document Intake | You provide source materials; the agent extracts and inventories content |
| 2 | 🔍 Content Extraction | Raw content is structured into 3–8 knowledge modules |
| 3 | 🎯 Learning Design | Learning objectives, quiz questions, and scoring rubrics are created |
| 4 | 🏗️ Skill Assembly | A complete SKILL.md is generated |
| 5 | ✅ Validation | The skill is verified and installation instructions provided |

## Output

A self-contained `SKILL.md` file that, when installed on any compatible agent, enables it to:

- **Teach** — Explain concepts module-by-module
- **Quiz** — Run assessments and score answers
- **Track** — Maintain per-module progress
- **Feedback** — Provide specific, constructive coaching
- **Recommend** — Suggest what to study next

## Quick Start

### Local Development

```bash
# Set required environment variables
export AZURE_OPENAI_ENDPOINT="https://your-endpoint.openai.azure.com/"
export AZURE_OPENAI_CHAT_DEPLOYMENT_NAME="gpt-4o"

# Install dependencies
pip install -r requirements.txt

# Run
python main.py
```

### Deploy to Azure Foundry

```bash
az ml agent deploy --file agent.yaml
```

### Docker

```bash
docker build -t coaching-skill-creator .
docker run -p 8088:8088 \
  -e AZURE_OPENAI_ENDPOINT="..." \
  -e AZURE_OPENAI_CHAT_DEPLOYMENT_NAME="..." \
  coaching-skill-creator
```

## Usage Example

1. Start a conversation with the agent
2. Paste or upload your training document (e.g., "Company Onboarding Guide.pdf")
3. Walk through the 5 phases — the agent guides each step
4. Receive a complete SKILL.md at the end
5. Install the generated skill into any `agent-with-skills` deployment:

```bash
mkdir -p ../agent-framework/agent-with-skills/skills/your-new-skill/
cp generated-SKILL.md ../agent-framework/agent-with-skills/skills/your-new-skill/SKILL.md
```

## Project Structure

```
coaching-skill-creator/
├── main.py              # Agent entry point
├── skill_manager.py     # Skill loading engine (shared module)
├── agent.yaml           # Azure Foundry deployment config
├── Dockerfile           # Container build
├── requirements.txt     # Python dependencies
├── README.md            # This file
└── skills/
    └── coaching-skill-creator/
        └── SKILL.md     # The meta-skill that drives the pipeline
```

## How the Generated Skills Work

The output SKILL.md follows this structure:

```yaml
---
name: your-topic-coaching
description: >
  Coaching skill for [topic]. Teaches N modules covering [scope].
---
```

```markdown
# Your Topic — Coaching Skill

## Coaching Protocol
[How the agent should teach, quiz, and track progress]

## Knowledge Base
### Module 1: [Topic]
[Content, objectives, assessments]

### Module 2: [Topic]
...
```

The generated coaching skill is **fully self-contained** — no external tools, databases, or APIs required. Any agent that loads the SKILL.md can immediately start coaching learners.
