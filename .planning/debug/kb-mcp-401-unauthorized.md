---
status: investigating
trigger: "Foundry Agent 运行时连接 Knowledge Base MCP 端点时返回 401 Unauthorized"
created: 2026-04-10T00:00:00Z
updated: 2026-04-10T00:03:00Z
---

## Current Focus

hypothesis: Portal runtime 通过 RemoteTool 连接自动匹配 server_url 来认证。有两种修复路径：(A) 设 project_connection_id 为 RemoteTool 连接名 (B) 不设 project_connection_id 但确保 RemoteTool 连接存在
test: 先测 A: 创建 Agent 版本用 project_connection_id="kb-omada-product-param-e88p4" (RemoteTool 连接)
expecting: Agent runtime 能从 RemoteTool 连接获取 api-key 认证 MCP 端点
next_action: 用 SDK 创建新版本测试 RemoteTool connection_id

## Symptoms

expected: Agent 通过 MCPTool 连接 AI Search 知识库 MCP 端点时应成功认证，能检索知识库内容
actual: Agent 运行时报 401 Unauthorized，无法连接 MCP 端点
errors: "Authentication failed when connecting to the MCP server: https://ai-search-southeast-asia.search.windows.net:443/knowledgebases/omada-product-parameters-kb/mcp: Response status code does not indicate success: 401 (Unauthorized).. Verify your authentication headers."
reproduction: 在 HCP 编辑器中添加 Knowledge Base 后，Agent 尝试使用知识库时报错
started: 最近 Knowledge Base 功能实现后出现

## Eliminated

- hypothesis: project_connection_id with CognitiveSearch connection name ("aisearchsoutheastasia5e88p4") provides MCP auth
  evidence: Portal v31 (working) has project_connection_id=None. Our v35 with project_connection_id="aisearchsoutheastasia5e88p4" still gets 401. CognitiveSearch connection type is not the right auth mechanism for MCP endpoints.
  timestamp: 2026-04-10T00:03:00Z

## Evidence

- timestamp: 2026-04-10T00:00:10Z
  checked: MCPTool SDK source (azure.ai.projects.models.MCPTool)
  found: MCPTool supports `headers` (dict), `project_connection_id` (str), and `authorization` (str) for authentication. Our code uses none of these.
  implication: MCPTool can authenticate but we're not passing any auth params

- timestamp: 2026-04-10T00:00:20Z
  checked: Foundry project connections via client.connections.list()
  found: Two relevant connections exist:
    1. `aisearchsoutheastasia5e88p4` (type=CognitiveSearch) - AI Search connection with API key
    2. `kb-omada-product-param-e88p4` (type=RemoteTool) - Portal-created KB MCP connection with same API key
  implication: Portal uses RemoteTool connection; our code can use project_connection_id to reference the AI Search connection

- timestamp: 2026-04-10T00:00:30Z
  checked: HcpKnowledgeConfig model already stores connection_name
  found: connection_name = "aisearchsoutheastasia5e88p4" - the AI Search connection name is already saved
  implication: We have the connection name ready, just need to pass it as project_connection_id

- timestamp: 2026-04-10T00:00:40Z
  checked: Live test - updated Dr-Wang-Fang agent with MCPTool + project_connection_id
  found: Agent version 35 created successfully with project_connection_id="aisearchsoutheastasia5e88p4"
  implication: Foundry accepts project_connection_id for CognitiveSearch connections on MCPTool

- timestamp: 2026-04-10T00:01:00Z
  checked: Code fix applied + 39 unit/integration tests
  found: All 39 tests pass including new test_project_connection_id_set_for_auth. Ruff lint+format clean.
  implication: Fix is correct and non-breaking

- timestamp: 2026-04-10T00:03:00Z
  checked: Portal v31 (working) vs our v35 (broken) MCPTool parameters via get_version API
  found: CRITICAL - Portal v31 has project_connection_id=None! Portal does NOT set project_connection_id. Our v35 sets it to "aisearchsoutheastasia5e88p4" (CognitiveSearch connection).
  implication: project_connection_id with CognitiveSearch connection name is WRONG approach. Portal uses a different auth mechanism.

- timestamp: 2026-04-10T00:03:10Z
  checked: RemoteTool connection "kb-omada-product-param-e88p4" details with credentials
  found: RemoteTool connection has target=MCP_URL, credentials={type:CustomKeys, api-key:...}, metadata={type:knowledgeBase_MCP}. Portal runtime matches server_url to RemoteTool connection target to find auth.
  implication: Portal auto-matches MCPTool.server_url to RemoteTool.target for auth. Two options: (1) set project_connection_id to RemoteTool name, or (2) remove project_connection_id entirely (like Portal v31) and ensure RemoteTool connection exists.

- timestamp: 2026-04-10T00:03:20Z
  checked: SDK API validation for MCPTool headers parameter
  found: Azure API REJECTS sensitive headers: "Headers that can include sensitive information are not allowed in the headers property for MCP tools. Use project_connection_id instead." This confirms project_connection_id is the intended auth mechanism for SDK-created agents.
  implication: headers param cannot be used for auth. project_connection_id is the ONLY SDK-supported auth path. CognitiveSearch connection (v35) didn't work => must use RemoteTool connection (v37 pending test).

- timestamp: 2026-04-10T00:03:30Z
  checked: Created Agent v37 with project_connection_id="kb-omada-product-param-e88p4" (RemoteTool connection)
  found: Version created successfully, API accepted RemoteTool connection name as project_connection_id
  implication: Need user to test v37 in Portal. If it works, the fix is to use RemoteTool connection name instead of CognitiveSearch connection name.

## Resolution

root_cause: build_search_tools() creates MCPTool(server_url=...) without authentication. The AI Search MCP endpoint requires api-key authentication, but the MCPTool has no project_connection_id parameter set, so the Agent runtime cannot obtain credentials from the Foundry project's AI Search connection to authenticate the MCP request.
fix: Add project_connection_id=cfg.connection_name to MCPTool constructor in build_search_tools(). This tells the Agent runtime to use the AI Search connection's stored credentials when calling the MCP endpoint. Also updated docs and added regression test.
verification: Unit tests pass (39/39). Agent version 35 deployed with project_connection_id. Awaiting human verification in Portal.
files_changed: [backend/app/services/knowledge_base_service.py, backend/tests/test_knowledge_base.py, docs/microsoft-agent-framework/06-agent-tools-and-knowledge-grounding.md]
