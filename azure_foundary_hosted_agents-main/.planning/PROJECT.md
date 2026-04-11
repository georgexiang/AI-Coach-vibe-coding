# PROJECT: Azure AI Foundry Hosted Agents — Skillable Agent Extension

## Vision
在现有 Azure AI Foundry Hosted Agent 示例集合中，新增一个支持安装外部标准 Skill 的代理子项目。遵循 Agent Skills 标准规范 (agentskills.io/specification)，兼容 ClawHub 生态。

## Problem
当前项目有 12 个代理示例，覆盖了工具集成、RAG、多代理工作流、HITL 等场景，但缺少 **Skill 可组合架构** 的示例。用户无法通过声明式配置加载外部知识/能力包（Skill），每次修改代理行为都需要改代码。

## Solution
创建 `agent-framework/agent-with-skills/` 子项目：
- 遵循 Agent Skills 标准规范 (agentskills.io/specification) 的 SKILL.md 格式
- 支持四种来源：本地目录、Git 仓库（如 `git@github.com:kepano/obsidian-skills.git`）、ClawHub API、直接 URL
- 通过环境变量 `AGENT_SKILLS` 声明式配置 Skill 组合
- 使用 Agent Framework (ChatAgent) 构建，部署到 Azure AI Foundry

## Skill Format (agentskills.io spec)
```
skill-name/
├── SKILL.md          # Required: YAML frontmatter (name, description, license, compatibility, metadata, allowed-tools) + Markdown body
├── scripts/          # Optional: executable code
├── references/       # Optional: additional documentation
├── assets/           # Optional: templates, resources
```

Git 仓库结构（如 obsidian-skills）：
```
repo-root/
├── skills/
│   ├── obsidian-markdown/SKILL.md
│   ├── defuddle/SKILL.md
│   └── json-canvas/SKILL.md
```

## Tech Stack
- Python 3.12
- `azure-ai-agentserver-agentframework==1.0.0b10`
- `python-frontmatter>=1.1.0` (SKILL.md 解析)
- `httpx>=0.27.0` (ClawHub/URL 下载)
- `git` (Git 仓库克隆)
- Docker + Azure AI Foundry Hosted Agent

## Success Criteria
- Agent 能从 `skills/` 目录加载内置 SKILL.md（agentskills.io 标准格式）
- Agent 能从 Git 仓库克隆并加载 Skill（如 kepano/obsidian-skills）
- Agent 能从 ClawHub API 下载并加载外部 Skill
- 修改 `AGENT_SKILLS` 环境变量即可切换 Skill 组合（无需重建镜像）
- 代理响应能体现已加载 Skill 的知识/行为
