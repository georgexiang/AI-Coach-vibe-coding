# Project State

## Current Position
- **Milestone:** v1 — Skillable Agent MVP
- **Phase:** 02-conversation-support (COMPLETE)
- **Status:** Executed and verified locally

## Decisions
- D-01: 使用 Agent Framework (ChatAgent)，不用 LangGraph
- D-02: Skill = SKILL.md prompt 扩展（不是 function tool）
- D-03: 使用 `python-frontmatter` 解析 YAML frontmatter
- D-04: 使用 `httpx` 做 HTTP 下载
- D-05: 通过 `AGENT_SKILLS` 环境变量声明式配置
- D-06: 遵循 Agent Skills 标准规范 (agentskills.io/specification)，兼容 ClawHub
- D-07: 支持 Git 仓库安装 (git clone)，扫描 skills/ 子目录中的 SKILL.md
- D-08: Skill 目录结构遵循规范：skill-name/SKILL.md + 可选 scripts/, references/, assets/
- D-09: 本地 session 持久化使用 JsonLocalFileAgentSessionRepository，通过 ENABLE_SESSION_PERSISTENCE 控制
- D-10: 云端自动使用 FoundryConversationSessionRepository（SDK 内置行为，无需额外代码）

## Blockers
None

## Pending Todos
None
