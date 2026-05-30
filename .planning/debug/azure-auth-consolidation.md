---
status: awaiting_human_verify
trigger: "azure-auth-consolidation: scoring_engine.py only uses API key, bypassing AAD token pattern"
created: 2026-05-20T00:00:00Z
updated: 2026-05-20T00:00:00Z
---

## Current Focus

hypothesis: 5 services create AsyncAzureOpenAI with only api_key, bypassing DefaultAzureCredential auth
test: confirmed by code review - these services only use api_key directly
expecting: creating centralized azure_auth module will fix the 403 errors
next_action: implement centralized azure_auth.py module and refactor all services

## Symptoms

expected: All Azure services should use a single auth module that tries DefaultAzureCredential/AAD token first, then falls back to API key
actual: scoring_engine.py (line 171-194) only uses api_key via config_service.get_effective_key(), bypassing the AAD token pattern. Other services may have similar issues.
errors: 403 AuthenticationTypeDisabled when scoring_engine tries to use API key on a resource that has key-based auth disabled
reproduction: Call POST /api/v1/scoring/sessions/{id}/rescore - fails with 403 because scoring_engine only uses API key
started: Azure resource has key-based auth disabled; other services that use AAD token work fine

## Eliminated

## Evidence

- timestamp: 2026-05-20T00:01:00Z
  checked: All AsyncAzureOpenAI instantiations in the codebase
  found: |
    API-KEY-ONLY (no AAD fallback):
    1. scoring_engine.py:191 - AsyncAzureOpenAI(api_key=api_key)
    2. skill_focus_service.py:171 - AsyncAzureOpenAI(api_key=api_key)
    3. skill_creator_service.py:229 - AsyncAzureOpenAI(api_key=api_key)
    4. skill_conversion_service.py:204 - AsyncAzureOpenAI(api_key=api_key)
    5. connection_tester.py:191 - AsyncAzureOpenAI(api_key=api_key) (test function, receives key as param)
    6. agents/adapters/azure_openai.py:44 - AsyncAzureOpenAI(api_key=api_key)
    
    ALREADY USES AAD-FIRST PATTERN:
    1. cu_evaluation_service.py:44-66 - DefaultAzureCredential -> API key fallback (for HTTP headers)
    2. voice_live_websocket.py:334-346 - AsyncDefaultAzureCredential -> AzureKeyCredential fallback
    3. agent_sync_service.py:355-385 - DefaultAzureCredential -> API key fallback (via _get_project_client)
    4. dry_run_engine.py - uses _get_project_client which has AAD
  implication: 5 service files need refactoring to use centralized AAD-first auth

## Resolution

root_cause: scoring_engine.py and 4 other services create AsyncAzureOpenAI with only api_key parameter, never attempting DefaultAzureCredential/AAD token. When key-based auth is disabled on the Azure resource, these calls fail with 403.
fix: Created centralized azure_auth.py module with get_azure_openai_client() and get_auth_headers() using AAD-first, API-key-fallback pattern. Refactored all 6 services to use it.
verification: 196 related tests pass, ruff lint+format clean, full suite 1422 passed (1 pre-existing unrelated failure in test_session_service)
files_changed:
  - backend/app/services/azure_auth.py (NEW)
  - backend/app/services/scoring_engine.py
  - backend/app/services/skill_conversion_service.py
  - backend/app/services/skill_creator_service.py
  - backend/app/services/skill_focus_service.py
  - backend/app/services/connection_tester.py
  - backend/app/services/cu_evaluation_service.py
  - backend/app/services/agents/adapters/azure_openai.py
  - backend/tests/test_azure_auth.py (NEW)
  - backend/tests/test_azure_openai_adapter.py
  - backend/tests/test_coverage_boost.py
  - backend/tests/test_skill_conversion_service.py
