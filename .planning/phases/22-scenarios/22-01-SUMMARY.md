---
phase: 22-scenarios
plan: 01
subsystem: scenarios
tags: [state-machine, backend, frontend, i18n, tests]
dependency_graph:
  requires: []
  provides: [scenario-archived-status, transition-endpoint]
  affects: [scenario-service, scenario-api, scenario-table, scenario-page]
tech_stack:
  added: []
  patterns: [state-machine-validation, transition-endpoint, archived-row-styling]
key_files:
  created: []
  modified:
    - backend/app/services/scenario_service.py
    - backend/app/api/scenarios.py
    - backend/app/schemas/scenario.py
    - frontend/src/types/scenario.ts
    - frontend/src/api/scenarios.ts
    - frontend/src/hooks/use-scenarios.ts
    - frontend/src/pages/admin/scenarios.tsx
    - frontend/src/components/admin/scenario-table.tsx
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json
    - frontend/public/locales/en-US/common.json
    - frontend/public/locales/zh-CN/common.json
    - backend/tests/test_scenario_service.py
    - backend/tests/test_scenarios_api.py
    - frontend/e2e/admin-scenarios.spec.ts
decisions:
  - "VALID_TRANSITIONS dict as sole state machine source of truth (same pattern as Skill model)"
  - "Status removed from ScenarioUpdate — only transition endpoint can change status"
  - "bad_request() returns 422 per existing project convention (not 400)"
  - "Archived rows use opacity-60 + outline badge for visual distinction"
metrics:
  duration: 7min
  completed: "2026-05-06T07:15:00Z"
  tasks: 3
  files: 15
---

# Phase 22 Plan 01: State Machine (draft -> active -> archived) Summary

Linear state machine enforcing draft->active->archived transitions via VALID_TRANSITIONS dict and dedicated POST /transition endpoint, with archived scenarios becoming read-only (clone available).

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Backend state machine validation + transition endpoint | b9188e1 | scenario_service.py, scenarios.py (api), scenario.py (schema) |
| 2 | Frontend archived status support + archive action | 850b158 | scenario.ts, scenarios.ts (api), use-scenarios.ts, scenarios.tsx, scenario-table.tsx, admin.json x2, common.json x2 |
| 3 | Tests: backend unit + E2E | 2124236 | test_scenario_service.py, test_scenarios_api.py, admin-scenarios.spec.ts |

## Implementation Details

### Backend Changes

1. **VALID_TRANSITIONS dict** in `scenario_service.py` — single source of truth for allowed status flows:
   - `draft -> active`
   - `active -> archived`
   - archived has no outgoing transitions (terminal state)

2. **transition_status()** service function validates transitions and raises `ValidationException` on invalid attempts

3. **POST /scenarios/{id}/transition** endpoint — admin-only, accepts `{"status": "..."}` body

4. **update_scenario() guard** — returns 422 if scenario is archived

5. **ScenarioUpdate schema** — `status` field removed; status changes only via transition endpoint

### Frontend Changes

1. **Status type** updated: `"draft" | "active" | "archived"`
2. **transitionScenarioStatus** API function + **useTransitionScenarioStatus** hook
3. **Archived filter** in status dropdown
4. **Archive confirmation dialog** with i18n strings
5. **Conditional actions** in table dropdown:
   - Draft: Edit, Activate, Clone, Delete
   - Active: Edit, Archive, Clone, Delete
   - Archived: Clone only (no Edit/Delete)
6. **Archived row styling**: `opacity-60` + `variant="outline"` badge
7. **i18n keys** added to both en-US and zh-CN locale files

### Tests

- 7 new service-level tests (TestTransitionStatus class)
- 5 new API-level tests (TestTransitionEndpoint class)
- 3 new E2E tests (archived filter, activate+archive flow, archived styling)
- 2 existing tests fixed (removed status from ScenarioUpdate usage)
- **All 41 backend tests pass**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed existing test using removed status field**
- **Found during:** Task 3
- **Issue:** `TestUpdateScenario.test_updates_partial_fields` and `TestUpdateScenarioEndpoint.test_updates_scenario` passed `status="active"` via ScenarioUpdate which no longer has a status field
- **Fix:** Removed status from update body, updated assertions to expect "draft" (unchanged)
- **Files modified:** test_scenario_service.py, test_scenarios_api.py
- **Commit:** 2124236

## Known Stubs

None - all functionality is fully wired.

## Self-Check: PASSED
