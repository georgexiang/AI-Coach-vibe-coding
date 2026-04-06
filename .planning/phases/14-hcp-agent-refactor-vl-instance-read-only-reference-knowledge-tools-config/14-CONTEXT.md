# Phase 14: HCP Agent Refactor — VL Instance Read-Only Reference + Knowledge/Tools Config - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** Conversation context + plan mode plan + infrastructure audit

<domain>
## Phase Boundary

重构 HCP 编辑器对齐 AI Foundry Agent 页面设计：
1. Voice Live 配置从 HCP 编辑器移至只读引用（来自 VL Instance）
2. VL Management 页成为语音/数字人配置的**唯一编辑入口**
3. HCP 编辑器聚焦 Agent 属性（Instructions/Prompt、Knowledge、Tools）
4. Avatar 缩略图使用 Azure CDN 真人图片（已在 Phase 13 实现）

**关键前提：VL Instance 后端基础设施已完全构建**（Model, Schema, Service, API, Migration, Frontend hooks 全部就绪）。Phase 14 主要是**前端重构**。

</domain>

<decisions>
## Implementation Decisions

### VL Management 页面重构
- VL Management 页改为 VL Instance CRUD 管理页（不再是 HCP 卡片仪表盘）
- 每个实例卡片显示: 名称, 模型, 语音, 数字人角色缩略图, 引用 HCP 数
- 创建/编辑 Dialog 包含完整配置表单：模型选择、语音设置、数字人选择、对话参数、Agent 指令覆盖
- Avatar 选择器复用 voice-avatar-tab.tsx 的 Standard/Custom tabs + Photo/Video filter
- 实例可以分配给多个 HCP（一对多关系）
- 删除有 HCP 引用的实例 → 409 Conflict

### HCP 编辑器 Voice Tab 简化
- 从 950 行完整配置编辑器 → 简化为只读预览 + VL Instance 下拉选择器
- 下拉选择器显示实例名称 + 模型 + 数字人角色缩略图
- 只读展示选中实例的关键配置（不可在 HCP 中编辑 VL 配置）
- "新建配置" 按钮跳转到 VL Management 页
- 保留实时测试面板（使用选中实例的配置）

### Backend: unassign endpoint
- 需要新增 `POST /voice-live/instances/unassign` 端点（从 HCP 取消 VL 关联）
- 现有 assign 端点: `POST /voice-live/instances/{id}/assign`

### Avatar 缩略图
- HCP-14-04 已在 Phase 13 的 voice-avatar-tab 改进中基本完成（使用 CDN 真人图片替代字母圆圈）
- VL Management 实例卡片也需要显示数字人缩略图

### Claude's Discretion
- VL Instance 创建/编辑 Dialog 的具体布局和分区
- Knowledge/Tools 区域的具体 UI 组件（Phase 14 scope 可能推迟到后续）
- 实时测试面板的复用策略

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — VL Instance 基础设施（已构建）
- `backend/app/models/voice_live_instance.py` — ORM model with all 15 voice config fields
- `backend/app/schemas/voice_live_instance.py` — 5 Pydantic schemas (Create, Update, Response, Summary, List, Assign)
- `backend/app/services/voice_live_instance_service.py` — Full CRUD + assign + resolve_voice_config
- `backend/app/api/voice_live.py` — 6 instance endpoints (POST/GET/PUT/DELETE + list + assign)
- `backend/alembic/versions/m16a_create_voice_live_instances.py` — Migration creating table + FK + data migration

### Backend — 现有配置解析
- `backend/app/services/voice_live_service.py` — Token broker with resolve_voice_config
- `backend/app/services/voice_live_websocket.py` — WebSocket config loading
- `backend/app/models/hcp_profile.py` — HcpProfile with voice_live_instance_id FK

### Frontend — VL Management 基础设施（已部分构建）
- `frontend/src/hooks/use-voice-live-instances.ts` — TanStack Query hooks for all CRUD
- `frontend/src/pages/admin/voice-live-management.tsx` — Basic management page (needs major rework)
- `frontend/src/components/admin/voice-live-chain-card.tsx` — Instance display card (needs rework)
- `frontend/src/types/voice-live.ts` — TypeScript types for VL Instance

### Frontend — Avatar 选择器（复用源）
- `frontend/src/components/admin/voice-avatar-tab.tsx` — 完整 avatar 选择器（Standard/Custom tabs, Photo/Video filter, CDN 缩略图）

### i18n
- `frontend/public/locales/en-US/admin.json`
- `frontend/public/locales/zh-CN/admin.json`

</canonical_refs>

<specifics>
## Specific Ideas

1. **VL Management 页面参考 AI Foundry Voice Live Playground** — admin 定义 voice live 实例，配置模型、avatar/voice、对话参数，然后 assign 给 HCP
2. **Avatar 选择器从 voice-avatar-tab.tsx 提取** — 当前在 HCP 编辑器中的 avatar 选择器需要提取为独立组件，在 VL Management 和 HCP Voice Tab 中复用
3. **实例卡片显示数字人缩略图** — 使用 CDN URL，不是字母圆圈
4. **配置解析优先级**: VoiceLiveInstance → HcpProfile 旧字段（回退兼容）

</specifics>

<deferred>
## Deferred Ideas

- Knowledge 区域（HCP-14-02）— 添加/移除知识库功能可能推迟到后续 phase
- Tools 区域（HCP-14-03）— Function Call 配置可能推迟到后续 phase
- 上述两项的后端 API 和模型尚未设计

</deferred>

---

*Phase: 14-hcp-agent-refactor-vl-instance-read-only-reference-knowledge-tools-config*
*Context gathered: 2026-04-06 via conversation context + plan mode*
