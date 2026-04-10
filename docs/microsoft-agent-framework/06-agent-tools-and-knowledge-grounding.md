# 06 — Agent Tools & Knowledge Grounding：工具类型与知识库集成

> **目标读者**：后端开发、Vibe Coding Agent
>
> **前置知识**：已阅读 01-05，了解 Agent Registry API、Metadata 约束

---

## 1. Agent Tools 体系概览

Azure AI Foundry Agent 通过 `PromptAgentDefinition.tools` 参数接收工具列表。
Portal UI 将工具分为两个区域：

| Portal 区域 | 对应 SDK 工具类型 | 用途 |
|-------------|------------------|------|
| **Tools** | `MCPTool`, `FunctionTool`, `CodeInterpreterTool`, `OpenApiTool`, `BingGroundingTool` 等 | 外部工具调用 |
| **Knowledge** | `AzureAISearchTool` | RAG 知识库 grounding |

所有工具类型均通过同一个 `tools: list[Tool]` 参数传入 `PromptAgentDefinition`。

### 1.1 SDK 可用工具类型（azure-ai-projects >= 2.0.1）

```python
from azure.ai.projects import models

# 完整列表（2026-04 实测）
tool_types = [
    "AzureAISearchTool",         # Knowledge grounding（Foundry IQ）
    "MCPTool",                   # MCP 协议工具（外部 RAG、自定义服务）
    "FunctionTool",              # 自定义函数调用
    "CodeInterpreterTool",       # 代码解释器
    "FileSearchTool",            # 文件搜索
    "OpenApiTool",               # OpenAPI 规范工具
    "BingGroundingTool",         # Bing 搜索 grounding
    "BingCustomSearchPreviewTool",
    "WebSearchTool",
    "WebSearchPreviewTool",
    "AzureFunctionTool",         # Azure Functions
    "SharepointPreviewTool",     # SharePoint grounding
    "ImageGenTool",              # 图像生成
    "ComputerUsePreviewTool",
    "BrowserAutomationPreviewTool",
    "A2APreviewTool",            # Agent-to-Agent
    "MicrosoftFabricPreviewTool",
    "MemorySearchPreviewTool",
    "CaptureStructuredOutputsTool",
]
```

---

## 2. Knowledge Grounding：AzureAISearchTool（Foundry IQ）

### 2.1 概念关系

```
Foundry IQ Knowledge Base
  └── 基于 Azure AI Search Index 构建
        └── 通过 AzureAISearchTool 连接到 Agent
              └── Portal "Knowledge" 区域显示
```

- **Foundry IQ 知识库**：高级抽象，包含描述、查询示例等元数据
- **AI Search 索引**：底层存储，Foundry IQ KB 自动创建和管理
- **AzureAISearchTool**：SDK 层面连接 KB 到 Agent 的唯一方式

### 2.2 列举可用知识库

Foundry IQ 知识库通过 AI Search 连接的 REST API 获取：

```python
# ❌ 错误：调用 /indexes 返回原始索引（低级别，Portal 不显示这些）
GET {search_endpoint}/indexes?api-version=2024-07-01

# ✅ 正确：调用 /knowledgebases 返回 Foundry IQ 知识库
GET {search_endpoint}/knowledgebases?api-version=2025-11-01-preview
Headers: api-key: {search_api_key}
```

**注意**：`client.indexes.list()` SDK 方法需要 workspace-level RBAC 权限（403）。
正确做法是通过 `client.connections.get(name=conn, include_credentials=True)`
获取 AI Search API Key，再直接调用 REST API。

响应示例：
```json
{
  "value": [
    {
      "name": "omada-product-parameters-kb",
      "description": "# Omada Product Parameters Data Source\n\n**Description:** ...",
      "version": "1",
      "type": "azure_ai_search"
    }
  ]
}
```

### 2.3 连接知识库到 Agent

```python
from azure.ai.projects.models import (
    AISearchIndexResource,
    AzureAISearchTool,
    AzureAISearchToolResource,
    PromptAgentDefinition,
)

# 构建 index resource（每个 KB 一个）
idx = AISearchIndexResource(
    project_connection_id="aisearchsoutheastasia5e88p4",  # AI Search 连接名
    index_name="omada-product-parameters-kb",              # 知识库名称
)

# 包装为 tool resource
resource = AzureAISearchToolResource(indexes=[idx])

# 创建工具并设置 resource
tool = AzureAISearchTool()
tool.azure_ai_search = resource

# 传入 Agent definition
definition = PromptAgentDefinition(
    model="gpt-4o",
    instructions="...",
    tools=[tool],  # Knowledge 工具
)

# 创建/更新 Agent
client.agents.create_version(
    agent_name="Dr-Wang-Fang",
    definition=definition,
    metadata=metadata,
)
```

### 2.4 AISearchIndexResource 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `project_connection_id` | str | 是 | AI Search 连接名（非 ARM ID，是 Foundry 中的连接名称） |
| `index_name` | str | 是 | 知识库/索引名称 |
| `query_type` | str | 否 | 查询类型：`simple`, `semantic`, `vector`, `vector_simple_hybrid`, `vector_semantic_hybrid` |
| `top_k` | int | 否 | 检索文档数量 |
| `filter` | str | 否 | OData 过滤表达式 |
| `index_asset_id` | str | 否 | 索引资产 ID |

### 2.5 多知识库支持

一个 Agent 可以连接多个知识库（通过多个 `AISearchIndexResource`）：

```python
indexes = [
    AISearchIndexResource(
        project_connection_id="search-conn-1",
        index_name="product-kb",
    ),
    AISearchIndexResource(
        project_connection_id="search-conn-1",
        index_name="clinical-trials-kb",
    ),
]
resource = AzureAISearchToolResource(indexes=indexes)
tool = AzureAISearchTool()
tool.azure_ai_search = resource
# tools 列表中只有一个 AzureAISearchTool，但包含多个 index
```

> **限制**：SDK 文档标注 "maximum of 1 index resource"，但实测可传多个。
> 如遇限制，改为每个 KB 一个 `AzureAISearchTool` 实例。

---

## 3. MCP Tools：外部 RAG 与自定义服务

### 3.1 概述

`MCPTool` 通过 [Model Context Protocol](https://modelcontextprotocol.io/) 连接外部服务。
适用于客户自建的 RAG 服务、第三方知识库、或任何暴露 MCP 端点的服务。

### 3.2 MCPTool 构造

```python
from azure.ai.projects.models import MCPTool

tool = MCPTool(
    server_label="customer-rag-service",           # 显示标签
    server_url="https://rag.customer.com/mcp",     # MCP 端点 URL
    require_approval="never",                       # "never" | "always"
    allowed_tools=["search", "retrieve"],           # 允许调用的工具名
)

definition = PromptAgentDefinition(
    model="gpt-4o",
    instructions="...",
    tools=[tool],
)
```

### 3.3 MCPTool 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `server_label` | str | 是 | Portal 中显示的工具名称 |
| `server_url` | str | 是 | MCP 服务端点 URL |
| `require_approval` | str | 否 | 是否需要人工审批：`"never"` / `"always"` |
| `allowed_tools` | list[str] | 否 | 允许调用的工具名称白名单 |

### 3.4 AzureAISearchTool vs MCPTool 选择指南

| 场景 | 推荐工具 | 原因 |
|------|---------|------|
| Foundry IQ 知识库 | `AzureAISearchTool` | Portal Knowledge 区域可见，原生集成 |
| 客户自建 MCP RAG 服务 | `MCPTool` | 标准 MCP 协议，灵活对接 |
| 第三方 AI Search 索引 | `AzureAISearchTool` | 只要有连接配置即可 |
| 自定义 API 端点 | `MCPTool` 或 `OpenApiTool` | 取决于协议类型 |
| 混合使用 | 同时传入 `tools` 列表 | 一个 Agent 可以同时有多种工具 |

### 3.5 混合工具示例

```python
# Foundry IQ Knowledge Base + 客户 MCP RAG
tools = [
    azure_search_tool,   # AzureAISearchTool（内部知识库）
    MCPTool(             # 客户外部 RAG
        server_label="customer-product-rag",
        server_url="https://rag.customer.com/mcp",
        require_approval="never",
    ),
]

definition = PromptAgentDefinition(
    model="gpt-4o",
    instructions="...",
    tools=tools,
)
```

---

## 4. 平台实现：AI Coach Knowledge Base 流程

### 4.1 数据模型

```
HcpProfile
  └── HcpKnowledgeConfig (1:N)
        ├── connection_name      # AI Search 连接名
        ├── connection_target    # AI Search 端点 URL
        ├── index_name           # 知识库名称
        ├── server_label         # 工具标签
        └── is_enabled           # 启用/禁用
```

### 4.2 同步流程

```
用户在 UI 添加/删除 KB
  → add_knowledge_config() / remove_knowledge_config()
    → _trigger_agent_resync()
      → sync_agent_for_profile()
        → get_knowledge_configs(db, profile.id)
        → build_search_tools(configs)
          → AzureAISearchTool + AISearchIndexResource
        → create_agent() / update_agent()
          → PromptAgentDefinition(tools=[...])
          → client.agents.create_version()
```

### 4.3 Portal 验证

同步后在 AI Foundry Portal 验证：
1. 打开 Agent → **Knowledge** 区域应显示已连接的知识库
2. **Tools** 区域不会显示 Knowledge（它们是分开展示的）
3. **YAML** tab 可查看完整的 tools 定义

---

## 5. 常见陷阱

| # | 陷阱 | 解决方案 |
|---|------|---------|
| 1 | 用 MCPTool 连接 Foundry IQ KB | Portal Knowledge 区域不显示。改用 `AzureAISearchTool` |
| 2 | 调用 `/indexes` 列举知识库 | 返回原始索引，无描述。改用 `/knowledgebases` API |
| 3 | `client.indexes.list()` 返回 403 | 需要 workspace-level RBAC。改用 REST API + API Key |
| 4 | `project_connection_id` 填 ARM ID | 应填 Foundry 连接名（如 `aisearchsoutheastasia5e88p4`） |
| 5 | KB 下拉框显示超长描述 | 只显示 KB `name`，描述另行展示或省略 |
| 6 | 混用 Knowledge 和 Tools 工具类型 | 同一 `tools` 列表可混合，Portal 自动分区显示 |

---

## 6. 未来扩展：客户 MCP RAG 支持

客户明确需要支持其对外提供的 MCP 协议 RAG 知识库。实施计划：

### 6.1 需求

- 客户通过 MCP 协议暴露自有 RAG 服务
- Agent 需要同时使用 Foundry IQ KB（`AzureAISearchTool`）和客户 MCP RAG（`MCPTool`）
- UI 需区分两种知识库来源

### 6.2 数据模型扩展

```sql
ALTER TABLE hcp_knowledge_configs ADD COLUMN tool_type VARCHAR(50) DEFAULT 'azure_ai_search';
-- tool_type: 'azure_ai_search' | 'mcp'

ALTER TABLE hcp_knowledge_configs ADD COLUMN mcp_server_url VARCHAR(500) DEFAULT '';
-- MCP 端点 URL（仅 tool_type='mcp' 时使用）
```

### 6.3 build_search_tools 扩展

```python
def build_agent_tools(configs: list[HcpKnowledgeConfig]) -> list:
    """Build tool list from KB configs, supporting both AzureAISearch and MCP types."""
    tools = []

    # Group by tool_type
    search_configs = [c for c in configs if c.is_enabled and c.tool_type == "azure_ai_search"]
    mcp_configs = [c for c in configs if c.is_enabled and c.tool_type == "mcp"]

    # AzureAISearchTool for Foundry IQ KBs
    if search_configs:
        indexes = [
            AISearchIndexResource(
                project_connection_id=cfg.connection_name,
                index_name=cfg.index_name,
            )
            for cfg in search_configs
        ]
        resource = AzureAISearchToolResource(indexes=indexes)
        tool = AzureAISearchTool()
        tool.azure_ai_search = resource
        tools.append(tool)

    # MCPTool for customer RAG services
    for cfg in mcp_configs:
        tool = MCPTool(
            server_label=cfg.server_label,
            server_url=cfg.mcp_server_url,
            require_approval="never",
        )
        tools.append(tool)

    return tools
```

### 6.4 UI 扩展

"添加知识库" 按钮的下拉菜单增加选项：
- **Connect to Foundry IQ** — 现有流程（AzureAISearchTool）
- **Connect MCP RAG Service** — 新增：输入 MCP 端点 URL（MCPTool）

---

## 附录 A：相关代码文件

| 文件 | 作用 |
|------|------|
| `backend/app/services/knowledge_base_service.py` | KB 列表、CRUD、`build_search_tools()` |
| `backend/app/services/agent_sync_service.py` | Agent 同步，调用 `build_search_tools()` |
| `backend/app/models/hcp_knowledge_config.py` | KB 配置 ORM 模型 |
| `backend/app/api/knowledge_base.py` | KB REST API 路由 |
| `backend/tests/test_knowledge_base.py` | 38 个测试覆盖全流程 |
| `frontend/src/components/admin/agent-config-left-panel.tsx` | KB UI（折叠面板） |
| `frontend/src/components/admin/connect-kb-dialog.tsx` | 连接知识库对话框 |
