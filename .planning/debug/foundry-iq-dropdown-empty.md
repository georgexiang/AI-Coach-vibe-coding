---
status: investigating
trigger: "HCP Profile editor 'Connect to Foundry IQ' dialog has empty Connection and Knowledge base dropdowns"
created: 2026-04-13T00:00:00Z
updated: 2026-04-13T09:30:00Z
---

## Current Focus

hypothesis: Previous root cause was WRONG. The API does NOT return empty. connections.list() returns 1 connection, knowledgebases API returns 2 KBs. Need user to reproduce to find real cause.
test: Live-tested all layers: SDK call, service function, FastAPI endpoint, Vite proxy -- all return correct data
expecting: User confirms whether dropdowns are still empty or issue is resolved
next_action: Checkpoint - ask user to reproduce the empty dropdown issue with browser DevTools open

## Symptoms

expected: Foundry IQ dialog should show available connections and knowledge bases in dropdown selects
actual: Both "Connection" and "Knowledge base" dropdowns show only placeholder text, no options to select
errors: No error messages visible in screenshot
reproduction: Open any HCP profile > click Foundry IQ connect button > observe empty dropdowns
started: Unknown -- needs git history investigation

## Eliminated

- hypothesis: Frontend component doesn't call the hooks
  evidence: Code review shows useSearchConnections() and useSearchIndexes() are called correctly in connect-kb-dialog.tsx
  timestamp: 2026-04-13T00:00:30Z

- hypothesis: Backend routes not registered
  evidence: knowledge_base_router is imported in api/__init__.py and included in main.py with api prefix
  timestamp: 2026-04-13T00:00:30Z

- hypothesis: SDK not installed
  evidence: "from azure.ai.projects import AIProjectClient" succeeds
  timestamp: 2026-04-13T00:00:40Z

- hypothesis: Project endpoint misconfigured
  evidence: get_project_endpoint resolves correctly to https://ai-foundary-hu-sweden-central2.services.ai.azure.com/api/projects/avarda-demo-prj
  timestamp: 2026-04-13T00:00:50Z

- hypothesis: API key auth cannot enumerate connections (previous "root cause")
  evidence: DISPROVED. Live test with exact same endpoint and API key auth returns 1 CognitiveSearch connection and 2 knowledgebases. connections.list(connection_type=ConnectionType.AZURE_AI_SEARCH) returns {'name': 'aisearchsoutheastasia5e88p4', 'target': 'https://ai-search-southeast-asia.search.windows.net/', 'isDefault': True}
  timestamp: 2026-04-13T09:20:00Z

- hypothesis: SDK version mismatch (v1 vs v2 API)
  evidence: venv has azure-ai-projects 2.0.1 (same as pyproject.toml requirement). SDK v2.0.1 base class has connections.list() and agents properties. Code is compatible.
  timestamp: 2026-04-13T09:22:00Z

- hypothesis: Backend endpoints don't return data
  evidence: DISPROVED. curl to http://localhost:8000/api/v1/knowledge-base/connections returns [{"name":"aisearchsoutheastasia5e88p4","target":"https://ai-search-southeast-asia.search.windows.net/","is_default":true}]. curl to /indexes returns 2 KB entries. Both via direct backend and Vite proxy.
  timestamp: 2026-04-13T09:24:00Z

- hypothesis: Pydantic schema / TypeScript type mismatch filtering out data
  evidence: ConnectionOut(name, target, is_default) matches service dict keys exactly. SearchConnection TS interface matches. IndexOut(name, version, type, description) matches service dict keys.
  timestamp: 2026-04-13T09:25:00Z

## Evidence

- timestamp: 2026-04-13T09:20:00Z
  checked: Azure AI Foundry connections.list() API with API key auth (live test)
  found: Returns 1 CognitiveSearch connection named 'aisearchsoutheastasia5e88p4' targeting 'https://ai-search-southeast-asia.search.windows.net/'. Raw HTTP response: 200 OK with full JSON data.
  implication: Previous evidence that API returns empty {"value":[]} was WRONG or was from a time when no connection was configured in the Azure project

- timestamp: 2026-04-13T09:21:00Z
  checked: Knowledgebases REST API (via connection credentials)
  found: Returns 2 knowledgebases: 'custom-skill-demo05-kb' and 'omada-product-parameters-kb'
  implication: Backend's list_indexes() function works correctly end-to-end

- timestamp: 2026-04-13T09:22:00Z
  checked: azure-ai-projects SDK version in venv
  found: Version 2.0.1 installed. AIProjectClient base class has connections, agents, indexes attributes set in __init__. ConnectionsOperations.list() accepts connection_type and default_connection params. ConnectionType.AZURE_AI_SEARCH serializes to "CognitiveSearch".
  implication: No SDK compatibility issue

- timestamp: 2026-04-13T09:24:00Z
  checked: Backend API endpoints via curl (both direct and through Vite proxy)
  found: GET /api/v1/knowledge-base/connections returns 200 with 1 connection. GET /api/v1/knowledge-base/indexes returns 200 with 2 indexes. Works with Bearer token auth. Returns 401 without token.
  implication: Full backend stack works correctly

- timestamp: 2026-04-13T09:25:00Z
  checked: Frontend code review (connect-kb-dialog.tsx, use-knowledge-base.ts, knowledge-base.ts API, types)
  found: useSearchConnections() and useSearchIndexes() hooks fire unconditionally when component mounts. API client calls /knowledge-base/connections and /indexes. Select components render connections?.map() and indexes?.map(). Code looks correct.
  implication: No obvious frontend code bug. Issue may be environmental (auth state, stale cache, network) or may already be resolved.

- timestamp: 2026-04-13T09:26:00Z
  checked: Reverted all previous "fix" changes (fallback chain in knowledge_base_service.py, config.py, connect-kb-dialog.tsx, locale files)
  found: Working tree restored to committed state. All backend endpoints still return correct data.
  implication: The fallback chain fix was unnecessary -- the real API works without it

## Resolution

root_cause: UNDER INVESTIGATION -- Previous root cause ("API key auth cannot enumerate connections") was definitively disproved. The Azure connections.list() API returns data correctly. Need to verify whether the issue still reproduces in the browser.
fix:
verification:
files_changed: []
