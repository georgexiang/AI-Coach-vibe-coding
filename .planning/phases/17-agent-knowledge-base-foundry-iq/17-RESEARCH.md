# Phase 17 Research: Agent Knowledge Base (Foundry IQ) Configuration

> Research date: 2026-04-10
> SDK version: `azure-ai-projects==2.0.1`
> All outputs verified against the installed SDK in `backend/.venv`

---

## 1. SDK API Inventory

### 1.1 AIProjectClient Top-Level Attributes

```
AIProjectClient attributes: ['close', 'get_openai_client', 'send_request']
```

The client does NOT expose `.connections` or `.indexes` as direct properties.
Access pattern is through operations — need to verify runtime access (e.g., `client.connections.list()`
may still work via dynamic attribute resolution at instance level).

### 1.2 ConnectionsOperations

```python
from azure.ai.projects.operations import ConnectionsOperations
# Methods: ['get', 'get_default', 'list']
```

**Signatures:**

```python
ConnectionsOperations.list(
    self,
    *,
    connection_type: Union[str, ConnectionType, None] = None,
    default_connection: Optional[bool] = None,
    **kwargs
) -> ItemPaged['Connection']

ConnectionsOperations.get(
    self,
    name: str,
    *,
    include_credentials: Optional[bool] = False,
    **kwargs
) -> Connection
```

**Connection model attributes:**

| Attribute | Description |
|-----------|-------------|
| `id` | Connection resource ID |
| `name` | Connection name |
| `type` | ConnectionType enum value |
| `target` | Endpoint URL for the connected resource |
| `is_default` | Whether it is the default connection for its type |
| `credentials` | Credential info (key, token, etc.) |
| `metadata` | Dict of metadata |

**Usage to list AI Search connections:**

```python
connections = client.connections.list(
    connection_type=ConnectionType.AZURE_AI_SEARCH
)
for conn in connections:
    print(conn.name, conn.target)  # name and search endpoint
```

### 1.3 ConnectionType Enum

```python
ConnectionType values:
  AZURE_OPEN_AI         = 'AzureOpenAI'
  AZURE_BLOB_STORAGE    = 'AzureBlob'
  AZURE_STORAGE_ACCOUNT = 'AzureStorageAccount'
  AZURE_AI_SEARCH       = 'CognitiveSearch'     # <-- THIS ONE
  COSMOS_DB             = 'CosmosDB'
  API_KEY               = 'ApiKey'
  APPLICATION_CONFIGURATION = 'AppConfig'
  APPLICATION_INSIGHTS  = 'AppInsights'
  CUSTOM                = 'CustomKeys'
  REMOTE_TOOL           = 'RemoteTool_Preview'
```

### 1.4 IndexesOperations

```python
from azure.ai.projects.operations import IndexesOperations
# Methods: ['create_or_update', 'delete', 'get', 'list', 'list_versions']
```

**Signatures:**

```python
IndexesOperations.list(self, **kwargs) -> ItemPaged['Index']
IndexesOperations.get(self, name: str, version: str, **kwargs) -> Index
IndexesOperations.list_versions(self, name: str, **kwargs) -> ItemPaged['Index']
```

**Index model attributes:**

| Attribute | Description |
|-----------|-------------|
| `id` | Index resource ID |
| `name` | Index name |
| `version` | Version string |
| `type` | Index type |
| `description` | Description |
| `tags` | Tags dict |

**Usage to list knowledge base indexes:**

```python
indexes = client.indexes.list()
for idx in indexes:
    print(idx.name, idx.version, idx.type)
```

---

## 2. Tool Types for Agents

### 2.1 Available Tool Classes (59 total, key ones below)

| Class | Purpose |
|-------|---------|
| `AzureAISearchTool` | Attach Azure AI Search index as grounding tool |
| `MCPTool` | Attach an MCP server (Foundry IQ, external tools) |
| `FileSearchTool` | File-based search |
| `CodeInterpreterTool` | Code interpreter |
| `FunctionTool` | Custom function calling |
| `BingGroundingTool` | Bing web grounding |
| `OpenApiTool` | OpenAPI spec-based tool |
| `WebSearchTool` | Web search |

### 2.2 AzureAISearchTool (Recommended Path for Knowledge Base)

```python
from azure.ai.projects.models import (
    AzureAISearchTool,
    AzureAISearchToolResource,
    AISearchIndexResource,
    AzureAISearchQueryType,
)

tool = AzureAISearchTool(
    azure_ai_search=AzureAISearchToolResource(
        indexes=[
            AISearchIndexResource(
                project_connection_id="<connection-name-or-id>",
                index_name="<index-name>",
                query_type=AzureAISearchQueryType.VECTOR_SEMANTIC_HYBRID,
                top_k=5,
                filter=None,
                index_asset_id=None,
            )
        ]
    )
)
```

**AISearchIndexResource attributes:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `project_connection_id` | str | Connection name or ID for the AI Search resource |
| `index_name` | str | Name of the search index |
| `query_type` | AzureAISearchQueryType | Query strategy |
| `top_k` | int | Number of documents to retrieve |
| `filter` | str | OData filter expression |
| `index_asset_id` | str | Optional asset ID |

**AzureAISearchQueryType enum:**

```
SIMPLE                = 'simple'
SEMANTIC              = 'semantic'
VECTOR                = 'vector'
VECTOR_SIMPLE_HYBRID  = 'vector_simple_hybrid'
VECTOR_SEMANTIC_HYBRID = 'vector_semantic_hybrid'
```

**Constraint:** Maximum 1 index resource per agent (per SDK docs).

### 2.3 MCPTool (Alternative Path for Foundry IQ)

```python
from azure.ai.projects.models import MCPTool

tool = MCPTool(
    server_label="foundry-iq",                    # Required: label for tool calls
    server_url="https://<endpoint>/mcp",           # One of server_url or connector_id
    connector_id=None,                             # Pre-built connector (Dropbox, Gmail, etc.)
    authorization="Bearer <token>",                # OAuth token if needed
    server_description="Foundry IQ knowledge base",
    headers={"x-custom": "value"},                 # Optional headers
    allowed_tools=["search", "retrieve"],           # Filter which tools to expose
    require_approval="never",                      # "always" | "never" | MCPToolRequireApproval
    project_connection_id="<connection-id>",        # Connection storing auth details
)
```

**MCPTool attributes:**

| Attribute | Required | Description |
|-----------|----------|-------------|
| `server_label` | Yes | Label identifying the MCP server in tool calls |
| `server_url` | One of url/connector | MCP server URL |
| `connector_id` | One of url/connector | Pre-built service connector ID |
| `authorization` | No | OAuth access token |
| `server_description` | No | Description for context |
| `headers` | No | Custom HTTP headers |
| `allowed_tools` | No | Filter to specific tools (list or MCPToolFilter) |
| `require_approval` | No | Approval mode for tool use |
| `project_connection_id` | No | Connection ID storing auth details |

---

## 3. PromptAgentDefinition (Tools Integration)

```python
from azure.ai.projects.models import PromptAgentDefinition
```

**Confirmed attributes:**

| Attribute | Description |
|-----------|-------------|
| `instructions` | Agent system prompt |
| `model` | Model deployment name |
| `tools` | **List of Tool objects** (AzureAISearchTool, MCPTool, etc.) |
| `tool_choice` | Tool selection strategy |
| `temperature` | Sampling temperature |
| `top_p` | Top-p sampling |
| `reasoning` | Reasoning configuration |
| `structured_inputs` | Structured input config |
| `rai_config` | Responsible AI config |
| `text` | Text output config |
| `kind` | Definition kind |

**Usage with tools:**

```python
definition = PromptAgentDefinition(
    model="gpt-4o",
    instructions="You are an HCP...",
    tools=[
        AzureAISearchTool(
            azure_ai_search=AzureAISearchToolResource(
                indexes=[
                    AISearchIndexResource(
                        project_connection_id="my-search-connection",
                        index_name="product-knowledge-base",
                        query_type=AzureAISearchQueryType.VECTOR_SEMANTIC_HYBRID,
                        top_k=5,
                    )
                ]
            )
        )
    ],
)
```

---

## 4. Current agent_sync_service.py Pattern

**File:** `backend/app/services/agent_sync_service.py`

### 4.1 create_agent() (line ~435)

```python
async def create_agent(
    db: AsyncSession,
    name: str,
    instructions: str,
    model: str | None = None,
    *,
    metadata: dict[str, str] | None = None,
    endpoint_override: str = "",
    key_override: str = "",
) -> dict:
    definition = PromptAgentDefinition(model=model, instructions=instructions)
    result = await asyncio.to_thread(
        client.agents.create_version,
        agent_name=agent_name,
        definition=definition,
        description=f"HCP Agent: {name}",
        metadata=metadata,
    )
```

### 4.2 update_agent() (line ~495)

Same pattern — creates `PromptAgentDefinition(model=model, instructions=instructions)` with NO tools parameter.

### 4.3 What Needs to Change

Both `create_agent()` and `update_agent()` must accept an optional `tools` parameter:

```python
async def create_agent(
    db, name, instructions, model=None, *,
    metadata=None,
    tools: list | None = None,    # NEW
    endpoint_override="", key_override="",
) -> dict:
    definition = PromptAgentDefinition(
        model=model,
        instructions=instructions,
        tools=tools or [],         # NEW — pass tools list
    )
```

---

## 5. Current HCP Profile Model

**File:** `backend/app/models/hcp_profile.py`

No knowledge base fields exist. Current fields relevant to agent sync:

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | String(100) | Foundry Agent name/ID |
| `agent_version` | String(50) | Current agent version |
| `agent_sync_status` | String(20) | none/pending/synced/failed |
| `agent_sync_error` | Text | Error message |

### 5.1 DB Migration Plan

**Option A: New columns on hcp_profiles (Recommended for MVP)**

Add to `hcp_profiles` table:

```python
# Knowledge base configuration
kb_connection_id: Mapped[str] = mapped_column(String(255), default="")
kb_index_name: Mapped[str] = mapped_column(String(255), default="")
kb_query_type: Mapped[str] = mapped_column(String(50), default="vector_semantic_hybrid")
kb_top_k: Mapped[int] = mapped_column(default=5)
kb_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
```

**Option B: Separate hcp_knowledge_configs table (Better for multi-index future)**

```python
class HcpKnowledgeConfig(Base, TimestampMixin):
    __tablename__ = "hcp_knowledge_configs"
    hcp_profile_id: FK -> hcp_profiles.id (unique, 1:1)
    connection_id: String(255)   # AI Search connection name
    index_name: String(255)      # Index name
    query_type: String(50)       # AzureAISearchQueryType value
    top_k: int                   # default 5
    filter_expression: Text      # OData filter (optional)
    is_enabled: bool             # default False
```

**Recommendation:** Option A (columns on hcp_profiles) for simplicity. The SDK limits agents to 1 index anyway. A separate table adds join complexity without current benefit.

### 5.2 Alembic Migration

Latest migration: `o18a_rename_vl_model_instruction.py`

New migration needed: `p19a_add_kb_fields_to_hcp_profiles.py`

---

## 6. Backend API Plan

### 6.1 New Endpoints

```
GET  /api/v1/knowledge-base/connections
  -> List AI Search connections from Foundry
  -> Returns: [{ name, target, is_default }]

GET  /api/v1/knowledge-base/indexes
  -> List indexes from Foundry project
  -> Returns: [{ name, version, type, description }]

GET  /api/v1/knowledge-base/indexes/{connection_name}
  -> List indexes within a specific AI Search connection
  -> (May require direct Azure Search REST call, not SDK)

PUT  /api/v1/hcp-profiles/{id}/knowledge-base
  -> Configure KB for an HCP profile
  -> Body: { connection_id, index_name, query_type, top_k, enabled }
  -> Triggers agent re-sync with tools parameter

GET  /api/v1/hcp-profiles/{id}/knowledge-base
  -> Get current KB config for an HCP profile
```

### 6.2 New Service: knowledge_base_service.py

```python
async def list_search_connections(db: AsyncSession) -> list[dict]:
    """List Azure AI Search connections from Foundry project."""
    endpoint, key = await get_project_endpoint(db)
    client = _get_project_client(endpoint, key)
    connections = await asyncio.to_thread(
        client.connections.list,
        connection_type=ConnectionType.AZURE_AI_SEARCH,
    )
    return [{"name": c.name, "target": c.target, "is_default": c.is_default} for c in connections]

async def list_indexes(db: AsyncSession) -> list[dict]:
    """List all indexes in the Foundry project."""
    endpoint, key = await get_project_endpoint(db)
    client = _get_project_client(endpoint, key)
    indexes = await asyncio.to_thread(client.indexes.list)
    return [{"name": i.name, "version": i.version, "type": i.type} for i in indexes]

def build_search_tool(connection_id: str, index_name: str, query_type: str, top_k: int):
    """Build AzureAISearchTool from config."""
    return AzureAISearchTool(
        azure_ai_search=AzureAISearchToolResource(
            indexes=[AISearchIndexResource(
                project_connection_id=connection_id,
                index_name=index_name,
                query_type=query_type,
                top_k=top_k,
            )]
        )
    )
```

---

## 7. Frontend Component Plan

### 7.1 Knowledge Tab in HCP Profile Editor

Location: `frontend/src/components/coach/HcpKnowledgeTab.tsx`

**Structure:**

```
KnowledgeTab
  +-- EnableToggle (kb_enabled on/off)
  +-- ConnectionSelector (dropdown, fetched from GET /knowledge-base/connections)
  +-- IndexSelector (dropdown, fetched from GET /knowledge-base/indexes)
  +-- QueryTypeSelector (dropdown: simple, semantic, vector, hybrid variants)
  +-- TopKSlider (1-20, default 5)
  +-- SaveButton (PUT /hcp-profiles/{id}/knowledge-base)
  +-- SyncStatusBadge (shows if agent re-sync succeeded)
```

### 7.2 New TanStack Query Hooks

```typescript
// frontend/src/hooks/useKnowledgeBase.ts
useSearchConnections()      // GET /knowledge-base/connections
useIndexes()                // GET /knowledge-base/indexes
useHcpKnowledgeConfig(id)   // GET /hcp-profiles/{id}/knowledge-base
useUpdateKnowledgeConfig()  // PUT /hcp-profiles/{id}/knowledge-base (mutation)
```

### 7.3 New TypeScript Types

```typescript
// frontend/src/types/knowledgeBase.ts
interface SearchConnection {
  name: string;
  target: string;
  is_default: boolean;
}

interface SearchIndex {
  name: string;
  version: string;
  type: string;
  description: string;
}

interface KnowledgeBaseConfig {
  connection_id: string;
  index_name: string;
  query_type: 'simple' | 'semantic' | 'vector' | 'vector_simple_hybrid' | 'vector_semantic_hybrid';
  top_k: number;
  enabled: boolean;
}
```

---

## 8. Key Decisions and Risks

### 8.1 AzureAISearchTool vs MCPTool

| Criterion | AzureAISearchTool | MCPTool |
|-----------|-------------------|---------|
| Simplicity | Simpler, purpose-built | More flexible, more config |
| SDK support | First-class, well-documented | Newer, `server_url` construction unclear |
| Index limit | 1 per agent | Depends on MCP server |
| Auth | Via connection_id | Needs OAuth or headers |
| Foundry IQ alignment | Native integration | Would need Foundry IQ MCP endpoint URL |

**Recommendation:** Use `AzureAISearchTool` for Phase 17. It is the natural fit for connecting agents to Azure AI Search indexes. MCPTool is better suited for external MCP servers (Foundry IQ's MCP endpoint is not yet well-documented for direct construction).

### 8.2 Risks

1. **`client.connections` runtime access** — `AIProjectClient` doesn't show `connections` in `dir()`. Need to verify at runtime with a real endpoint that `client.connections.list()` works. (It should via dynamic binding, but must test.)

2. **`client.indexes` runtime access** — Same concern. `IndexesOperations` class exists but client attribute is not statically visible.

3. **Index listing within a specific AI Search connection** — The SDK `IndexesOperations.list()` lists project-level indexes, NOT indexes within a specific AI Search service. To list indexes within a specific Azure AI Search connection, a direct REST call to the Search service endpoint (from `connection.target`) may be needed: `GET https://<search-endpoint>/indexes?api-version=2024-07-01`.

4. **Agent re-sync on KB change** — Changing KB config must trigger a full agent version bump via `create_version`. This is already the pattern for updates, but the tools parameter is new.

5. **1 index limit** — SDK doc says max 1 index per `AzureAISearchToolResource.indexes`. This is fine for MVP but constrains multi-index scenarios.

---

## 9. Implementation Sequence

1. **DB migration** — Add KB columns to `hcp_profiles`
2. **Pydantic schemas** — Add `KnowledgeBaseConfig` request/response schemas
3. **knowledge_base_service.py** — List connections, list indexes, build_search_tool()
4. **Modify agent_sync_service.py** — Add `tools` param to create/update_agent, build tools from KB config
5. **API router** — `/knowledge-base/connections`, `/knowledge-base/indexes`, HCP KB endpoints
6. **Frontend types + hooks** — TypeScript types, TanStack Query hooks
7. **Frontend KnowledgeTab component** — UI for configuring KB per HCP
8. **Integration into HCP editor** — Add Knowledge tab to existing HCP profile editor
9. **Tests** — Unit tests for service, API integration tests, E2E for UI flow
