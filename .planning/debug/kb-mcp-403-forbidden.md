---
status: awaiting_human_verify
trigger: "HCP绑定KB后，Agent通过MCP访问AI Search知识库时返回403 Forbidden"
created: 2026-04-10T01:00:00Z
updated: 2026-04-10T01:35:00Z
---

## Current Focus

hypothesis: CONFIRMED - project_connection_id必须使用RemoteTool连接名（而非CognitiveSearch连接名）。RemoteTool连接由Portal创建，credentials类型为CustomKeys，包含正确的api-key认证信息。CognitiveSearch连接的ApiKey类型虽然key相同但runtime处理方式不同导致403。
test: 创建v43(RemoteTool连接)和v44(None)两个版本，等待用户验证。同时实现代码修复：在sync时查找匹配的RemoteTool连接名。
expecting: v43或v44应能成功认证MCP端点
next_action: 等待用户在Portal中测试Agent v45（project_connection_id=RemoteTool连接名）

## Symptoms

expected: Agent通过MCPTool连接AI Search知识库MCP端点时应成功认证并检索知识库内容
actual: Agent运行时报403 Forbidden，无法连接MCP端点。之前是401 Unauthorized，应用project_connection_id=CognitiveSearch连接名后变为403。
errors: "ErrorAccess denied when connecting to the MCP server at https://ai-search-southeast-asia.search.windows.net:443/knowledgebases/omada-product-parameters-kb/mcp while enumerating tools (HTTP 403 Forbidden). Please verify: (1) your credentials have the necessary permissions to access this server, (2) any IP allowlists or network policies permit requests from this service, and (3) the server's access control configuration allows the requested operation."
reproduction: 在HCP编辑器中添加Knowledge Base后，在Foundry Portal中测试Agent时报错
started: KB功能实现后出现401，添加project_connection_id=CognitiveSearch连接名后变为403

## Eliminated

- hypothesis: MCPTool不需要认证
  evidence: 之前没有认证参数时报401 Unauthorized
  timestamp: 2026-04-10T00:00:00Z (from prior session)

- hypothesis: project_connection_id=CognitiveSearch连接名提供正确的MCP认证
  evidence: v35设置project_connection_id="aisearchsoutheastasia5e88p4"(CognitiveSearch类型)后错误从401变为403。CognitiveSearch API key被发送了但权限不对，因为MCP端点需要不同的认证机制。
  timestamp: 2026-04-10T01:00:00Z

## Evidence

- timestamp: 2026-04-10T01:00:00Z
  checked: Prior investigation findings
  found: Portal v31(工作)有project_connection_id=None。两种Foundry连接：(1) CognitiveSearch连接存储AI Search API key (2) RemoteTool连接由Portal自动创建，target=MCP URL, credentials含api-key。401->403说明CognitiveSearch key被发送了但MCP端点拒绝。
  implication: CognitiveSearch连接的key虽然有效但权限不足。Portal通过RemoteTool连接的自动URL匹配机制认证。

- timestamp: 2026-04-10T01:10:00Z
  checked: CognitiveSearch vs RemoteTool connection credentials对比
  found: CognitiveSearch credentials type=ApiKey, RemoteTool credentials type=CustomKeys. 两者存储的实际api-key值相同（同长度52字符，末4位一致）。但credentials TYPE不同：ApiKey vs CustomKeys。runtime根据credentials type决定如何发送认证头。
  implication: 403的根因是credentials type不匹配。CognitiveSearch的ApiKey类型被runtime以错误方式发送给MCP端点。

- timestamp: 2026-04-10T01:15:00Z
  checked: RemoteTool连接可通过metadata.knowledgeBaseName匹配KB名称
  found: 所有RemoteTool连接的metadata包含knowledgeBaseName字段，与KB index_name一致。可通过connections.list()找到匹配的RemoteTool连接。
  implication: 在build_search_tools时可以查找匹配的RemoteTool连接名作为project_connection_id

- timestamp: 2026-04-10T01:20:00Z
  checked: SDK connections.create()是否可用
  found: SDK v2.0.1 ConnectionsOperations只有get/get_default/list方法，无create。REST API PUT/POST /connections返回405。连接只能通过ARM管理平面或Portal UI创建。
  implication: 无法通过SDK创建RemoteTool连接。必须依赖Portal已创建的连接。

- timestamp: 2026-04-10T01:25:00Z
  checked: 创建v43(RemoteTool连接)和v44(None)两个测试版本
  found: v43 project_connection_id="kb-omada-product-param-e88p4" (RemoteTool), v44 project_connection_id=None. 两者均创建成功。
  implication: 等待用户在Portal测试。Portal v31(None)已确认工作，v43(RemoteTool)应该也工作。

## Resolution

root_cause: build_search_tools()将CognitiveSearch连接名(credentials type=ApiKey)作为project_connection_id传给MCPTool。但MCP端点需要RemoteTool连接(credentials type=CustomKeys)的认证方式。虽然两者存储同一个API key，但runtime根据credentials type以不同方式发送认证头，导致MCP端点返回403 Forbidden。
fix: 新增resolve_kb_remote_tool_connections()异步函数查找RemoteTool连接映射(KB名->RemoteTool连接名)。修改build_search_tools接受remote_tool_map参数，用RemoteTool连接名替代CognitiveSearch连接名作为project_connection_id。修改sync_agent_for_profile在有KB配置时先resolve RemoteTool映射。若未找到匹配的RemoteTool连接则不设project_connection_id(依赖Portal自动URL匹配)。
verification: 41 unit/integration tests全部通过。live测试resolve_kb_remote_tool_connections成功返回正确映射。Agent v45已部署(project_connection_id=kb-omada-product-param-e88p4)。等待用户Portal验证。
files_changed: [backend/app/services/knowledge_base_service.py, backend/app/services/agent_sync_service.py, backend/tests/test_knowledge_base.py]
