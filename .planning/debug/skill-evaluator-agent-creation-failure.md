---
status: awaiting_human_verify
trigger: "skill-evaluator agent fails to save/create with RemoteDisconnected error"
created: 2026-04-24T00:00:00Z
updated: 2026-04-24T13:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - Azure AI Foundry backend returns 500 for ALL new agent creation via Agent Registry API
test: Fix applied - bootstrap fallback + actionable error message + 502 HTTP response
expecting: User to verify in real workflow
next_action: Await human verification

## Symptoms

expected: skill-evaluator agent should save/create successfully, just like skill-creator agent does
actual: Agent creation fails with connection abort / RemoteDisconnected error
errors: RuntimeError: Agent creation failed (endpoint: https://ai-foundary-hu-sweden-central2.services.ai.azure.com/api/projects/avarda-demo-prj): ('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))
reproduction: Try to save/create a skill-evaluator agent through the platform
started: Ongoing issue

## Eliminated

- hypothesis: Instructions too large for evaluator
  evidence: Evaluator is 14,164 chars vs creator 21,384 chars - evaluator is actually SMALLER
  timestamp: 2026-04-24T13:00:00Z

- hypothesis: Non-ASCII characters in evaluator template causing issues
  evidence: Only 24 standard Unicode chars (em-dashes, arrows, >= signs) - all valid
  timestamp: 2026-04-24T13:00:00Z

- hypothesis: Model not deployed/available
  evidence: gpt-5.4-mini IS deployed in the Foundry project (verified via deployments API)
  timestamp: 2026-04-24T13:01:00Z

- hypothesis: Issue specific to agent name "skill-evaluator"
  evidence: Tried "skill-quality-evaluator", "test-agent-hello", "test-new-agent", "test-raw-agent" - ALL fail
  timestamp: 2026-04-24T13:02:00Z

- hypothesis: Model-specific issue
  evidence: Tried gpt-5.4-mini, gpt-4o, gpt-4o-mini, gpt-4.1-mini - ALL fail for new agents
  timestamp: 2026-04-24T13:05:00Z

- hypothesis: API version issue
  evidence: Tried v1, 2025-05-15-preview, 2025-11-15-preview - ALL return 500
  timestamp: 2026-04-24T13:10:00Z

- hypothesis: Missing Foundry-Features header
  evidence: Adding HostedAgents=V1Preview,WorkflowAgents=V1Preview header makes no difference
  timestamp: 2026-04-24T13:15:00Z

## Evidence

- timestamp: 2026-04-24T13:00:00Z
  checked: Database state of meta_skills table
  found: creator has agent_id='skill-creator', version='3', last_synced=2026-04-23. evaluator has agent_id='', version='', never synced.
  implication: Creator exists in Foundry and uses update path. Evaluator needs create path which is failing.

- timestamp: 2026-04-24T13:01:00Z
  checked: Reproduced the error via sync_meta_skill_agent('evaluator')
  found: HTTP 500 server_error from Foundry API - NOT the RemoteDisconnected originally reported (SDK retries mask it)
  implication: The real error is HTTP 500 from the Foundry backend, not a connection issue

- timestamp: 2026-04-24T13:02:00Z
  checked: Created test agent with minimal instructions (179 bytes) using name 'skill-evaluator'
  found: Still HTTP 500 - content size is irrelevant
  implication: The problem is not about payload size

- timestamp: 2026-04-24T13:03:00Z
  checked: Updated EXISTING skill-creator agent with create_version
  found: SUCCESS - version 4 created
  implication: create_version works for EXISTING agents, fails for NEW agents

- timestamp: 2026-04-24T13:05:00Z
  checked: Only 2 agents exist in project: skill-creator and Dr-Wang-Fang
  found: Agent limit not reached (2 agents is very low)
  implication: Not a quota issue

- timestamp: 2026-04-24T13:10:00Z
  checked: Project connections
  found: Only CognitiveSearch and AppInsights connections. No Azure Storage connection.
  implication: Missing storage backend may be the root cause of 500s for new agent creation

- timestamp: 2026-04-24T13:15:00Z
  checked: Raw REST API call revealed actual error for malformed request
  found: API returns proper 400 for validation errors (e.g. missing 'kind' field) but 500 for valid new agent creation
  implication: Server-side infrastructure issue, not a request format problem

## Resolution

root_cause: Azure AI Foundry project backend returns HTTP 500 for ALL new agent creation via the Agent Registry API (POST /agents/{name}/versions). This affects any new agent name, any model, any API version. The create_version endpoint works correctly for EXISTING agents (creating new versions). The skill-creator agent was created earlier when the Foundry backend was functioning, so it can be updated. The skill-evaluator was never created, so it consistently fails. Likely caused by missing/broken storage backend in the Foundry project (only CognitiveSearch and AppInsights connections exist, no Azure Storage).
fix: |
  1. Added _bootstrap_agent_via_assistants_api() fallback in agent_sync_service.py that tries
     to create agent via OpenAI Assistants API when Agent Registry returns 500, then retries
     registry adoption. Cleans up OAI assistant if adoption fails.
  2. Improved create_agent() to catch HttpResponseError with status 500, attempt bootstrap
     fallback, and raise a clear actionable RuntimeError with guidance (create agent in Portal,
     platform uses direct OpenAI as fallback meanwhile).
  3. Updated sync_meta_skill_agent API endpoint to catch RuntimeError with Foundry 500 errors
     and return HTTP 502 with FOUNDRY_AGENT_CREATION_FAILED error code and actionable message.
  4. Note: The skill evaluation and creation services already have _call_direct_openai /
     _call_openai_for_evaluation fallbacks that work when agent_id is empty, so the platform
     continues to function without the synced agent.
verification: |
  - All 78 unit tests pass (test_agent_sync_service.py, excluding live integration tests)
  - All 46 meta-skill tests pass (test_meta_skill_service.py + test_meta_skill_api.py)
  - Reproduced the error and confirmed actionable error message with Portal guidance
  - ruff check and format pass on both modified files
files_changed:
  - backend/app/services/agent_sync_service.py
  - backend/app/api/meta_skills.py
