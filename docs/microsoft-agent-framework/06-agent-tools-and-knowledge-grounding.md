# 06 — Agent Tools & Knowledge Grounding：工具类型与知识库集成

> **目标读者**：后端开发、Vibe Coding Agent
>
> **前置知识**：已阅读 01-05，了解 Agent Registry API、Metadata 约束

---

## 1. Portal 区域与 SDK 工具类型映射

Azure AI Foundry Portal 将 Agent 工具分为 **三个区域**：

| Portal 区域 | SDK 工具类型 | 说明 |
|-------------|-------------|------|
| **Tools** | `AzureAISearchTool`, `FunctionTool`, `CodeInterpreterTool`, `OpenApiTool`, `BingGroundingTool` 等 | 通用工具（搜索、代码、API） |
| **Knowledge** (Preview) | `MCPTool` + KB MCP 端点 | Foundry IQ 知识库 grounding |
| **Knowledge** (Preview) | `MCPTool` + 客户 MCP 端点 | 客户自建 MCP RAG 服务 |

> **关键发现**：`AzureAISearchTool` 出现在 **Tools** 区域（显示为 "Azure AI Search"），
> 而 **Knowledge** 区域使用 `MCPTool` 指向 KB 的 MCP 端点。
> 这是实测验证的结论（2026-04-10），与直觉相反。

所有工具类型均通过同一个 `tools: list[Tool]` 参数传入 `PromptAgentDefinition`。

---

## 2. Knowledge Grounding：MCPTool + Foundry IQ KB MCP 端点

### 2.1 三层架构

```
Foundry IQ Knowledge Base（AI Search 上的高级抽象）
  └── 暴露 MCP 端点：/knowledgebases/{name}/mcp
        └── MCPTool(server_url=MCP端点) → Portal "Knowledge" 区域
```

- **Foundry IQ 知识库**：包含描述、检索指令、回答指令、模型配置
- **KB MCP 端点**：`{search_endpoint}/knowledgebases/{kb_name}/mcp?api-version=2025-11-01-Preview`
- **MCPTool**：SDK 工具，`server_url` 指向 KB MCP 端点

### 2.2 列举可用知识库

```python
# ❌ 错误：/indexes 返回原始索引（Portal 不显示这些）
GET {search_endpoint}/indexes?api-version=2024-07-01

# ✅ 正确：/knowledgebases 返回 Foundry IQ 知识库
GET {search_endpoint}/knowledgebases?api-version=2025-11-01-preview
Headers: api-key: {search_api_key}
```

获取 API Key 的正确方式：
```python
conn = client.connections.get(name="aisearchsoutheastasia5e88p4", include_credentials=True)
search_endpoint = conn.target.rstrip("/")
search_key = conn.credentials.api_key
```

### 2.3 连接知识库到 Agent（正确方式）

```python
from azure.ai.projects.models import MCPTool, MCPToolFilter, PromptAgentDefinition

# 构建 MCP 端点 URL
search_endpoint = "https://ai-search-southeast-asia.search.windows.net"
kb_name = "omada-product-parameters-kb"
mcp_url = f"{search_endpoint}/knowledgebases/{kb_name}/mcp?api-version=2025-11-01-preview"

# 创建 MCPTool（Portal Knowledge 区域格式）
tool = MCPTool(
    server_label=f"knowledge-base-{kb_name}",
    server_url=mcp_url,
    require_approval="never",
    allowed_tools=MCPToolFilter(tool_names=["knowledge_base_retrieve"]),
)

# 传入 Agent definition
definition = PromptAgentDefinition(
    model="gpt-4o",
    instructions="...",
    tools=[tool],
)

client.agents.create_version(
    agent_name="Dr-Wang-Fang",
    definition=definition,
    metadata=metadata,
)
```

序列化后的 JSON：
```json
{
  "type": "mcp",
  "server_label": "knowledge-base-omada-product-parameters-kb",
  "server_url": "https://...search.windows.net/knowledgebases/omada-product-parameters-kb/mcp?api-version=2025-11-01-preview",
  "allowed_tools": { "tool_names": ["knowledge_base_retrieve"] },
  "require_approval": "never"
}
```

### 2.4 MCPTool 关键参数（Knowledge 模式）

| 参数 | 值 | 说明 |
|------|----|------|
| `server_label` | `"knowledge-base-{kb_name}"` | Portal 中显示的标签 |
| `server_url` | `"{search_endpoint}/knowledgebases/{kb_name}/mcp?api-version=2025-11-01-preview"` | KB MCP 端点 |
| `require_approval` | `"never"` | 无需人工审批 |
| `allowed_tools` | `MCPToolFilter(tool_names=["knowledge_base_retrieve"])` | 仅允许检索工具 |

### 2.5 多知识库支持

每个 KB 一个 MCPTool 实例：

```python
tools = []
for kb_name in ["product-kb", "clinical-trials-kb"]:
    mcp_url = f"{search_endpoint}/knowledgebases/{kb_name}/mcp?api-version=2025-11-01-preview"
    tools.append(MCPTool(
        server_label=f"knowledge-base-{kb_name}",
        server_url=mcp_url,
        require_approval="never",
        allowed_tools=MCPToolFilter(tool_names=["knowledge_base_retrieve"]),
    ))
```

---

## 3. AzureAISearchTool（Tools 区域，非 Knowledge）

> **注意**：`AzureAISearchTool` 出现在 Portal **Tools** 区域，不是 Knowledge 区域。
> 如果只需要 Knowledge 区域显示，请使用上面的 MCPTool 方式。

`AzureAISearchTool` 适用于需要直接查询 AI Search 索引的场景：

```python
from azure.ai.projects.models import (
    AISearchIndexResource, AzureAISearchTool, AzureAISearchToolResource,
)

idx = AISearchIndexResource(
    project_connection_id="aisearchsoutheastasia5e88p4",
    index_name="omada-product-parameters-kb",
)
resource = AzureAISearchToolResource(indexes=[idx])
tool = AzureAISearchTool()
tool.azure_ai_search = resource
# → 出现在 Portal "Tools" 区域，显示为 "Azure AI Search"
```

---

## 4. RemoteTool 连接（Portal 内部机制）

Portal Knowledge 区域的连接还涉及 **RemoteTool 连接**：

```
RemoteTool Connection（Foundry 项目级别）
  ├── name: "kb-omada-product-param-e88p4"
  ├── type: "RemoteTool"
  ├── target: "{search_endpoint}/knowledgebases/{kb_name}/mcp?api-version=2025-11-01-Preview"
  ├── credentials: { "type": "CustomKeys", "api-key": "..." }
  └── metadata: { "type": "knowledgeBase_MCP", "knowledgeBaseName": "..." }
```

Portal 手动添加 KB 时自动创建此连接。通过 SDK 编程可以：
- **读取**：`client.connections.list()` 过滤 `type=RemoteTool`
- **查看详情**：`client.connections.get(name=..., include_credentials=True)`
- **创建**：数据平面 API 不支持 PUT/POST，需通过 ARM API 或 Portal 创建

对于编程集成，直接使用 `MCPTool(server_url=...)` 即可，无需手动创建 RemoteTool 连接。

---

## 5. 平台实现：AI Coach Knowledge Base 流程

### 5.1 数据模型

```
HcpProfile
  └── HcpKnowledgeConfig (1:N)
        ├── connection_name      # AI Search 连接名
        ├── connection_target    # AI Search 端点 URL（用于构建 MCP URL）
        ├── index_name           # 知识库名称
        ├── server_label         # MCPTool 标签
        └── is_enabled           # 启用/禁用
```

### 5.2 同步流程

```
用户在 UI 添加/删除 KB
  → add_knowledge_config() / remove_knowledge_config()
    → _trigger_agent_resync()
      → sync_agent_for_profile()
        → get_knowledge_configs(db, profile.id)
        → build_search_tools(configs)
          → MCPTool(server_url=KB_MCP_URL, allowed_tools=["knowledge_base_retrieve"])
        → create_agent() / update_agent()
          → PromptAgentDefinition(tools=[...])
          → client.agents.create_version()
```

### 5.3 build_search_tools 实现

```python
def build_search_tools(configs: list[HcpKnowledgeConfig]) -> list:
    enabled = [c for c in configs if c.is_enabled]
    if not enabled:
        return []
    from azure.ai.projects.models import MCPTool, MCPToolFilter
    tools = []
    for cfg in enabled:
        search_endpoint = cfg.connection_target.rstrip("/")
        mcp_url = (
            f"{search_endpoint}/knowledgebases/{cfg.index_name}"
            f"/mcp?api-version=2025-11-01-preview"
        )
        tool = MCPTool(
            server_label=cfg.server_label or f"knowledge-base-{cfg.index_name}",
            server_url=mcp_url,
            require_approval="never",
            allowed_tools=MCPToolFilter(tool_names=["knowledge_base_retrieve"]),
        )
        tools.append(tool)
    return tools
```

---

## 6. 常见陷阱

| # | 陷阱 | 解决方案 |
|---|------|---------|
| 1 | 用 `AzureAISearchTool` 连接 KB | 出现在 Tools 区域。改用 `MCPTool` + KB MCP 端点 |
| 2 | 调用 `/indexes` 列举知识库 | 返回原始索引，无描述。改用 `/knowledgebases` API |
| 3 | `client.indexes.list()` 返回 403 | 需要 workspace-level RBAC。改用 REST API + API Key |
| 4 | KB 下拉框显示超长描述 | 只显示 KB `name`，描述另行展示 |
| 5 | MCPTool 缺少 `allowed_tools` | 必须传 `MCPToolFilter(tool_names=["knowledge_base_retrieve"])` |
| 6 | MCP URL api-version 错误 | 必须是 `2025-11-01-preview`（不是 `2024-07-01`） |

---

## 7. 未来扩展：客户 MCP RAG 支持

客户明确需要支持其对外提供的 MCP 协议 RAG 知识库。

### 7.1 需求

- 客户通过 MCP 协议暴露自有 RAG 服务
- Agent 同时使用 Foundry IQ KB 和客户 MCP RAG
- UI 需区分两种知识库来源

### 7.2 实现方案

客户 MCP RAG 与 Foundry IQ KB 的区别仅在于 `server_url` 来源不同：

| 来源 | server_url | allowed_tools |
|------|-----------|---------------|
| Foundry IQ KB | `{search_endpoint}/knowledgebases/{name}/mcp?api-version=...` | `["knowledge_base_retrieve"]` |
| 客户 MCP RAG | `https://rag.customer.com/mcp`（客户自行提供） | 客户定义的工具名 |

数据模型扩展：
```sql
ALTER TABLE hcp_knowledge_configs ADD COLUMN tool_type VARCHAR(50) DEFAULT 'foundry_iq';
-- tool_type: 'foundry_iq' | 'customer_mcp'

ALTER TABLE hcp_knowledge_configs ADD COLUMN mcp_server_url VARCHAR(500) DEFAULT '';
-- 客户 MCP 端点（仅 tool_type='customer_mcp' 时使用）
```

---

## 附录 A：相关代码文件

| 文件 | 作用 |
|------|------|
| `backend/app/services/knowledge_base_service.py` | KB 列表、CRUD、`build_search_tools()` |
| `backend/app/services/agent_sync_service.py` | Agent 同步，调用 `build_search_tools()` |
| `backend/app/models/hcp_knowledge_config.py` | KB 配置 ORM 模型 |
| `backend/app/api/knowledge_base.py` | KB REST API 路由 |
| `backend/tests/test_knowledge_base.py` | 38 个测试覆盖全流程 |

## 附录 B：工具类型与 Portal 区域对照验证（2026-04-10）

通过对比 Agent 版本历史确认的映射关系：

```
Version 31 (Portal Knowledge 区域手动添加):
  type: "mcp"
  server_url: ".../knowledgebases/.../mcp?api-version=2025-11-01-preview"
  allowed_tools: { "tool_names": ["knowledge_base_retrieve"] }
  → 出现在 Knowledge 区域 ✅

Version 32 (SDK AzureAISearchTool):
  type: "azure_ai_search"
  azure_ai_search: { indexes: [{ project_connection_id: "...", index_name: "..." }] }
  → 出现在 Tools 区域 ❌（不是 Knowledge）
```
