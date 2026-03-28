---
phase: 09-integration-testing-with-real-azure-services
plan: 05
subsystem: testing
tags: [playwright, e2e, smoke-test, demo, azure]

# Dependency graph
requires:
  - phase: 09-03
    provides: "Backend integration tests for Azure services"
  - phase: 09-04
    provides: "Performance validation tests"
provides:
  - "Full demo pipeline E2E test (admin config -> text session -> scoring)"
  - "Pre-demo smoke test checklist with 84 checkpoint items"
  - "Screenshot capture at each demo stage for visual verification"
affects: [demo-preparation, qa-process]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "E2E demo flow test with 120s extended timeout for voice/avatar WebRTC"
    - "Smoke test checklist with recovery steps for common demo failures"

key-files:
  created:
    - frontend/e2e/demo-flow.spec.ts
    - docs/SMOKE_TEST_CHECKLIST.md
  modified: []

key-decisions:
  - "Used direct API session creation (createSessionViaApi) for reliable E2E test setup instead of UI-only flow"
  - "Screenshots captured at each demo stage for visual verification records"
  - "Smoke test includes 84 checkbox items across 8 sections for comprehensive pre-demo validation"

patterns-established:
  - "Demo E2E pattern: API-based session setup + UI interaction + screenshot capture"
  - "Smoke test checklist format: sections with checkbox items + recovery table"

requirements-completed: [COACH-04, COACH-05, COACH-06, COACH-07, PLAT-03, PLAT-05]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 09 Plan 05: E2E Demo Flow Test and Smoke Test Checklist Summary

**Playwright E2E test exercising full demo pipeline (admin config, text session, mode selector, scoring) plus 84-item pre-demo smoke test checklist with recovery steps**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T14:05:26Z
- **Completed:** 2026-03-28T14:09:01Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Created comprehensive Playwright E2E demo-flow test with 4 test cases covering admin Azure config, text coaching session, mode selector verification, and scoring report rendering
- Created pre-demo smoke test checklist with 84 checkbox items across 8 sections (Azure health, text/voice/avatar modes, fallback chain, mode selector, scoring parity, performance)
- Included quick recovery table for 8 common demo failure scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Playwright E2E demo-flow test for full pipeline** - `fea8c6e` (test)
2. **Task 2: Pre-demo smoke test checklist document** - `a654aba` (docs)

## Files Created/Modified

- `frontend/e2e/demo-flow.spec.ts` - Full demo pipeline E2E test with 4 test cases: admin config, text session, mode selector, scoring report
- `docs/SMOKE_TEST_CHECKLIST.md` - Manual pre-demo smoke test checklist with 84 checkbox items, 8 sections, and quick recovery table

## Decisions Made

- Used `createSessionViaApi` helper pattern (reused from voice-session.spec.ts) for reliable session creation in E2E tests rather than depending on full UI flow
- Imported from `@playwright/test` directly (not coverage-helper) since demo-flow tests focus on integration rather than code coverage
- Used generous timeouts (10-15s) for API-dependent waits to accommodate both mock and real Azure backends
- Smoke test checklist structured with checkbox format per D-16 requirement, including sections for all 7 interaction modes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript issue: e2e/tsconfig.json references `@types/node` but the package is not installed in frontend. This affects all e2e specs equally and is not caused by this plan's changes. The main frontend tsconfig only includes `src/` so `tsc -b` from frontend root does not check e2e directory.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Demo flow E2E test ready for execution against both mock and real Azure backends
- Smoke test checklist ready for use by demo operators before customer presentations
- All Phase 09 plans complete

## Self-Check: PASSED

- frontend/e2e/demo-flow.spec.ts: FOUND
- docs/SMOKE_TEST_CHECKLIST.md: FOUND
- 09-05-SUMMARY.md: FOUND
- Commit fea8c6e: FOUND
- Commit a654aba: FOUND

---
*Phase: 09-integration-testing-with-real-azure-services*
*Completed: 2026-03-28*
