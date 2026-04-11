# Roadmap — v1 Skillable Agent MVP

## Milestone: v1 — Skillable Agent

**Goal:** 构建可安装外部标准 Skill 的 Agent Framework 代理，部署到 Azure AI Foundry

**Requirements:**
- SKILL-01: 解析 SKILL.md 格式（遵循 agentskills.io 规范：name, description, license, compatibility, metadata, allowed-tools）
- SKILL-02: 从本地目录加载 Skill（扫描 skill-name/SKILL.md 子目录结构）
- SKILL-03: 从 ClawHub API 下载并加载 Skill
- SKILL-04: 从直接 URL 下载并加载 Skill
- SKILL-05: 组合多个 Skill 到 agent instructions，支持 token 统计和 progressive disclosure
- SKILL-06: 通过环境变量 AGENT_SKILLS 声明式配置 Skill 列表
- SKILL-07: 使用 Agent Framework ChatAgent 集成
- SKILL-08: Azure AI Foundry 部署就绪（agent.yaml, Dockerfile, requirements.txt）
- SKILL-09: 从 Git 仓库安装 Skill（git clone → 扫描 skills/ 目录 → 加载各子目录的 SKILL.md）

---

### Phase 01: skillable-agent

**Goal:** 完整实现 agent-with-skills 子项目（Skill 解析 + 多来源加载 + Agent 集成 + 部署配置）
**Requirements:** [SKILL-01, SKILL-02, SKILL-03, SKILL-04, SKILL-05, SKILL-06, SKILL-07, SKILL-08, SKILL-09]
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Skill Manager 核心实现（含 Git 仓库支持）+ 示例 Skill 文件
- [x] 01-02-PLAN.md — Agent 入口集成 + 部署配置 + 文档

---

### Phase 02: conversation-support

**Goal:** 为 agent-with-skills 添加 Conversation 持久化支持，实现多用户多轮对话历史保存，本地用 JSON 文件存储，云端自动使用 Foundry Conversations API
**Requirements:** [CONV-01, CONV-02, CONV-03]
**Plans:** 1 plan

Requirements:
- CONV-01: 集成 AgentSessionRepository，本地使用 JsonLocalFileAgentSessionRepository 持久化对话历史
- CONV-02: 云端部署时自动使用 FoundryConversationSessionRepository（SDK 内置行为，无需额外代码）
- CONV-03: 通过 ENABLE_SESSION_PERSISTENCE 环境变量控制是否开启本地持久化

Plans:
- [x] 02-01-PLAN.md — 集成 session_repository + 环境变量控制 + 本地验证
