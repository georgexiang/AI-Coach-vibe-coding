# Phase 17 Context — Agent Knowledge Base (Foundry IQ Integration)

## Phase Goal

HCP Agent 知识库管理，对齐 Azure AI Foundry Knowledge 配置体验。Admin 可在 HCP 编辑器中连接 Azure AI Search 资源的 Knowledge Base (Foundry IQ)，将知识库绑定到 HCP Agent。Agent 在对话中自动使用 RAG 检索知识。

## Decisions

### D-01: Knowledge Base 接入方式 — MCPTool (Foundry IQ)

**Decision:** 使用 `MCPTool`（MCP 协议）连接 AI Search Knowledge Base，对齐 AI Foundry portal 的 "Connect to Foundry IQ" 流程。

**Why:** 我们的 HCP Agent 就是 Foundry Agent（通过 agent_sync_service 同步），应保持与 portal 一致的行为。MCPTool 是 Foundry 内部实现 "Connect to Foundry IQ" 的方式。

**Rejected alternatives:**
- `AzureAISearchTool`（GA 但不是 portal 默认方式）
- `FileSearchTool`（自动向量化但灵活性低）

**SDK pattern:**
```python
from azure.ai.projects.models import MCPTool

mcp_tool = MCPTool(
    server_label="knowledge-base-{kb_name}",
    server_url=f"{search_endpoint}/knowledgebases/{kb_name}/mcp?api-version=2025-11-01-preview",
    require_approval="never",
    allowed_tools=["knowledge_base_retrieve"],
)
```

### D-02: Agent 可绑定多个 Knowledge Base

**Decision:** 每个 HCP Agent 可连接多个 Knowledge Base，每个作为单独的 MCPTool 加入 Agent 的 `tools` 列表。

**Why:** HCP 可能需要产品知识库 + 医学文献知识库等多个来源。

**Impact:** Agent sync 时需合并已有 tools（如 Voice Live metadata）和新增的 KB tools。

### D-03: MVP 只连接已有 KB，不做创建

**Decision:** 平台只做"列出 + 选择 + 连接"。Knowledge Base 的创建和文档上传在 AI Foundry portal 中完成。

**Why:** 这属于 Agent 能力配置范畴。KB 的创建和维护是其他模块（知识管理模块）的职责，不在 Agent 配置的范围内。Agent 配置只负责"选择并连接已有 KB"。

**Impact:** Admin 需要先在 AI Foundry portal 或知识管理模块中创建好 KB，然后在 HCP Agent 配置中选择连接。

### D-04: 只读 + 连接操作范围（Agent 能力定义边界）

**Decision:** 平台通过 `client.connections.list()` 列出 AI Search Connections，通过 AI Search API 列出 Knowledge Bases，admin 选择后绑定到 Agent。不做创建/删除 KB。

**Why:** 职责分离 — Agent 配置模块定义"Agent 用哪些知识库"，知识库本身的创建/维护/文档上传是知识管理模块的职责。Connections 是 project 级资源，SDK 只支持读取。

### D-05: Knowledge Tab 恢复到 HCP Editor

**Decision:** 在 HCP 编辑器中恢复 Knowledge tab（Phase 14 添加后 Phase 15 移除的 tab），但这次填充真实功能而非占位符。

**Layout:** 参照 AI Foundry portal Knowledge 面板：
- "Add" 按钮下拉：Connect to Foundry IQ
- 已连接 KB 列表（名称、connection、状态）
- 解绑按钮

### D-06: Agent Sync 扩展 — tools 参数

**Decision:** 扩展 `agent_sync_service.sync_agent_for_profile()` 在 `PromptAgentDefinition` 中加入 `tools` 参数，传入 KB 的 MCPTool 列表。

**Current state:** `create_version()` 只传 `model` + `instructions` + `metadata`。需要新增 `tools` 参数。

**Merge strategy:** Agent 可能同时有 Voice Live metadata + Knowledge MCPTools，tools 列表需要合并来自不同来源的 tools。

## Prior Context Applied

- Phase 11: Agent sync service (`agent_sync_service.py`) 完整的 CRUD + version 管理
- Phase 14: Knowledge/Tools tab 曾存在于 HCP editor，后在 Phase 15 移除
- Phase 16: Agent sync 包含 Voice Live metadata，需要与 KB tools 共存
- Phase 05: Training Material 管理已存在但不在本 phase scope（MVP 不做自动索引）

## Reusable Assets

| Asset | Location | Reuse |
|-------|----------|-------|
| AIProjectClient factory | `agent_sync_service._get_project_client()` | 复用 client.connections API |
| Agent sync flow | `sync_agent_for_profile()` | 扩展 tools 参数 |
| i18n KB keys | `admin.json` (hcp.tabKnowledge etc.) | 已存在，扩展 |
| HCP Editor VALID_TABS | `hcp-profile-editor.tsx` | 添加 "knowledge" |
| HCP Profile model | `hcp_profile.py` | 新增 KB 关联字段 |

## New Dependencies

- **可能不需要 `azure-search-documents`** — 如果 `client.connections` + `client.indexes` 已足够列出 KB
- **需要验证：** `AIProjectClient` 是否有列出 Knowledge Bases 的 API（不是 indexes，是 KB）
- 如果没有，可能需要 REST API 调用 AI Search 的 `/knowledgebases` endpoint

## Scope Boundaries

**In scope:**
- HCP Editor Knowledge tab UI（列出/连接/解绑 KB）
- Backend API：list connections, list KBs, bind/unbind KB to HCP
- Agent sync 扩展（tools 参数含 MCPTool）
- DB migration（HCP profile KB 关联表）
- 测试 + i18n

**Out of scope（其他模块职责）:**
- KB 创建/维护/文档上传 — 知识管理模块职责（可在 AI Foundry portal 或后续知识管理模块完成）
- Phase 05 材料自动索引到 AI Search — 知识管理模块职责
- Azure Blob Storage 集成 — 知识管理模块职责
- Tools tab（Function Call 配置）— 后续 Agent 工具配置 phase

## Open Questions for Research Phase

1. `AIProjectClient.indexes.list()` 是否返回 Foundry IQ Knowledge Bases？还是需要直接调用 AI Search REST API `/knowledgebases`？
2. MCPTool 的 `server_url` 构建需要 AI Search endpoint — 这个从 connection.target 获取还是另外配置？
3. 现有 `create_version()` 调用加入 `tools` 参数后是否需要同时保留 `metadata`（Voice Live config）？
4. HCP Profile 和 KB 的关联关系：多对多（一个 KB 可被多个 HCP 使用）还是一对多？
