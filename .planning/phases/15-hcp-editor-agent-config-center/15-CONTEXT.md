# Phase 15: HCP Editor Agent Config Center - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Source:** PRD Express Path (/Users/huqianghui/.claude/plans/deep-foraging-hammock.md)

<domain>
## Phase Boundary

重构 HCP 编辑器页面为 Agent 配置中心，对齐 Azure AI Foundry Agent 编辑体验：
1. 移除空 Knowledge 和 Tools tab（Phase 14-03 添加的占位符）
2. Voice & Avatar tab 升级为完整 Agent 配置中心布局
3. 左侧面板：Model Deployment + Voice Mode 开关 + Instructions + Knowledge & Tools 配置
4. 右侧面板：Playground 预览（数字人/音波球 + Start 测试 + Transcript）

**前提：Phase 14 已完成 VL Instance CRUD、HCP Voice Tab 只读预览、unassign endpoint 等基础设施。**

</domain>

<decisions>
## Implementation Decisions

### Tab 结构调整
- 移除 Knowledge 和 Tools 两个空 tab（从 hcp-profile-editor.tsx 删除 tab trigger + content）
- 保留 Profile tab（HCP 基本信息）
- Voice & Avatar tab 重构为 Agent 配置中心

### Voice & Avatar tab 左侧面板
- **Model Deployment 选择器**: 下拉 + 自定义输入（类似 Azure Foundry 截图 Image #3 gpt-5.4-mini 风格）
- **Voice Mode 开关**: "Switch the agent to a voice-first experience"
  - 开启时显示 VL Instance 选择器（复用已有 hooks）
  - 关闭时隐藏 voice 配置
- **Instructions 区域**:
  - 自动生成的 instructions（基于 profile 数据调用 build_agent_instructions）
  - 可编辑 override（agent_instructions_override 字段）
  - 魔法棒按钮重新生成
- **Knowledge & Tools 配置**:
  - Knowledge: 文件上传 / 知识库配置（内联在 tab 中，不是独立 tab）
  - Tools: 工具配置（内联在 tab 中，不是独立 tab）

### Voice & Avatar tab 右侧面板（Playground）
- 根据 avatar_enabled 显示数字人形象或音波球
- Start 测试按钮（复用 VL Instance Editor 的测试逻辑）
- 对话 transcript 区域

### Backend: agent_instructions_override 数据流修复
- `to_prompt_dict()` 需要包含 `agent_instructions_override`
- 确保 build_agent_instructions 正确读取 override
- 新增 GET endpoint 获取 auto-generated instructions preview

### i18n
- 添加 model deployment、voice mode 开关、instructions 等新 keys
- 中英文双语（en-US + zh-CN）

### Claude's Discretion
- Knowledge & Tools 内联区域的具体 UI 组件实现细节
- Playground 预览面板的音波球动画效果
- Instructions 自动生成的 API 调用时机（实时 vs 按需）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 前端 — HCP 编辑器（主要重构目标）
- `frontend/src/pages/admin/hcp-profile-editor.tsx` — 主编辑页面（572行，当前 4 tab）
- `frontend/src/components/admin/voice-avatar-tab.tsx` — 当前 Voice & Avatar tab（Phase 14 已简化为只读预览）
- `frontend/src/components/admin/agent-status-section.tsx` — Agent 状态显示

### 前端 — 类型和 Hooks
- `frontend/src/types/hcp.ts` — HCP TypeScript 类型定义
- `frontend/src/hooks/use-hcp-profiles.ts` — HCP Query hooks
- `frontend/src/hooks/use-voice-live.ts` — Voice Live WebSocket hook
- `frontend/src/hooks/use-voice-live-instances.ts` — VL Instance CRUD hooks

### 后端 — Agent Instructions
- `backend/app/services/agent_sync_service.py` — build_agent_instructions()
- `backend/app/models/hcp_profile.py` — HCP ORM 模型（含 agent_instructions_override）
- `backend/app/schemas/hcp_profile.py` — Pydantic schemas
- `backend/app/services/voice_live_websocket.py` — WebSocket 代理

### i18n
- `frontend/public/locales/en-US/admin.json`
- `frontend/public/locales/zh-CN/admin.json`

### 参考截图（用户提供）
- Image #3: Model deployment 选择器（gpt-5.4-mini）
- Image #4: Instructions 区域（自动生成 + 可编辑）
- Image #5: 数字人形象 + Start 测试按钮（Azure Foundry 风格）

</canonical_refs>

<specifics>
## Specific Ideas

1. **对齐 Azure AI Foundry Agent 编辑体验** — Model Deployment + Instructions + Playground 三栏布局
2. **Voice Mode 开关模式** — 参考 Azure Foundry "Switch to voice-first experience" toggle
3. **Instructions 魔法棒** — 调用 build_agent_instructions 实时预览 auto-generated instructions
4. **Knowledge & Tools 内联** — 不作为独立 tab，而是 Voice & Avatar tab 内的折叠区域

</specifics>

<deferred>
## Deferred Ideas

- Knowledge 区域的完整文件上传功能（可先做 UI 框架，后端集成后续 phase）
- Tools 区域的完整 Function Call 配置（可先做 UI 框架）
- Playground 的完整实时对话功能（先做 UI 结构 + Start 按钮）

</deferred>

---

*Phase: 15-hcp-editor-agent-config-center*
*Context gathered: 2026-04-07 via PRD Express Path*
