---
phase: "22"
plan: "03"
subsystem: scenarios
tags: [schema-migration, tags, backend, frontend, tests]
dependency_graph:
  requires: [22-01, 22-02]
  provides: [flexible-tagging, tag-filter-api]
  affects: [scenario-editor, scenario-table, training-page, coaching-session, voice-session]
tech_stack:
  added: []
  patterns: [json-array-column, tag-category-value-format]
key_files:
  created:
    - backend/alembic/versions/s22b_scenario_tags_migration.py
  modified:
    - backend/app/models/scenario.py
    - backend/app/schemas/scenario.py
    - backend/app/api/scenarios.py
    - backend/app/services/scenario_service.py
    - frontend/src/types/scenario.ts
    - frontend/src/components/admin/scenario-table.tsx
    - frontend/src/components/admin/scenario-editor.tsx
    - frontend/src/components/coach/scenario-panel.tsx
    - frontend/src/components/coach/scenario-card.tsx
    - frontend/src/pages/user/training.tsx
    - frontend/src/pages/user/training-session.tsx
    - frontend/src/components/voice/voice-session.tsx
    - frontend/src/pages/admin/reports.tsx
    - frontend/src/api/scenarios.ts
    - frontend/src/hooks/use-scenarios.ts
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json
    - backend/tests/test_scenario_service.py
    - backend/tests/test_scenarios_api.py
    - backend/tests/test_sessions_api.py
    - backend/tests/test_coverage_gaps.py
    - backend/tests/test_no_trailing_slash_redirect.py
    - backend/tests/test_scoring_service.py
    - frontend/src/components/admin/scenario-table.test.tsx
    - frontend/src/components/coach/scenario-panel.test.tsx
    - frontend/e2e/admin-scenarios.spec.ts
    - frontend/e2e/coaching-session.spec.ts
decisions:
  - Tags stored as JSON Text column (consistent with key_messages pattern)
  - Tag format is "category:value" strings (e.g., "product:Brukinsa")
  - Predefined tag categories: product, therapeutic_area with custom tag support
  - Tag filtering via JSON string contains query
metrics:
  duration: ~45min
  completed: "2026-05-06"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 30
---

# Phase 22 Plan 03: Scenario Tags Migration Summary

Replace fixed product/therapeutic_area columns with flexible tags JSON array supporting category:value format and multi-tag filtering.

## One-liner

Migrated Scenario model from rigid product+therapeutic_area columns to flexible JSON tags array with category:value format, full-stack UI, and tag-based filtering API.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 8e504c3 | feat | Backend schema migration, model, service, and API updates for tags |
| bdff59e | fix | Restore planning files after soft reset side-effect |
| 35fc8f4 | feat | Frontend types, table, editor, panel, card, pages updated for tags |
| e031817 | test | All backend + frontend tests updated to use tags |

## Task Breakdown

### Task 1: Backend Schema Migration + Model + Service

- Created Alembic migration `s22b_scenario_tags_migration.py` that adds `tags` column, migrates existing product/therapeutic_area data to JSON tags array, then drops old columns
- Updated `Scenario` model: removed `product` and `therapeutic_area`, added `tags: Mapped[str]` (JSON Text column, default `"[]"`)
- Updated `ScenarioCreate` / `ScenarioUpdate` schemas to use `tags: list[str]`
- Updated `ScenarioOut` response model with field_validator parsing tags JSON
- Added `tag` query parameter to list endpoint for tag-based filtering
- Updated `create_scenario`, `update_scenario`, `clone_scenario`, `get_scenarios` service functions

### Task 2: Frontend Types + Table + Editor

- Updated `Scenario` type: replaced `product: string` + `therapeutic_area: string` with `tags: string[]`
- Rewrote `scenario-table.tsx`: replaced Product column with Tags column showing color-coded badges by category
- Rewrote `scenario-editor.tsx`: replaced product/area select dropdowns with multi-tag picker (predefined + custom tags)
- Updated `scenario-panel.tsx`, `scenario-card.tsx`, `training.tsx`, `training-session.tsx`, `voice-session.tsx`, `reports.tsx`
- Added `tag` parameter support to API client and TanStack Query hook
- Added i18n keys for both en-US and zh-CN locales

### Task 3: Test Updates

- Rewrote `test_scenario_service.py` with tag serialization, filtering, and clone tests
- Updated `test_scenarios_api.py` -- all POST payloads use `tags` array instead of `product`
- Updated `test_sessions_api.py`, `test_coverage_gaps.py`, `test_no_trailing_slash_redirect.py`, `test_scoring_service.py`
- Fixed `scenario-table.test.tsx` (sort header text uses i18n key)
- Fixed `scenario-panel.test.tsx` (scoring weights replaced by rubric-based info)
- Updated E2E specs (`admin-scenarios.spec.ts`, `coaching-session.spec.ts`)
- Fixed TypeScript strict mode error in `getTagStyle` return type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed tests in adjacent files that create scenarios via API**
- **Found during:** Task 3
- **Issue:** `test_sessions_api.py`, `test_coverage_gaps.py`, `test_no_trailing_slash_redirect.py`, `test_scoring_service.py` all create scenarios with the old `product` field, which would fail Pydantic validation
- **Fix:** Updated all scenario creation payloads across these test files to use `tags` instead
- **Files modified:** 4 additional test files beyond what was planned

**2. [Rule 1 - Bug] Fixed TypeScript strict mode error in scenario-table.tsx**
- **Found during:** Task 3 verification
- **Issue:** `TAG_CATEGORY_STYLES[category]` returns `string | undefined` with `noUncheckedIndexedAccess`, causing TS2322
- **Fix:** Used string literal fallback instead of indexing the Record again
- **Files modified:** `frontend/src/components/admin/scenario-table.tsx`

**3. [Rule 1 - Bug] Fixed scenario-panel test expecting removed scoring weights**
- **Found during:** Task 3 verification
- **Issue:** Test expected "Key Message" / "30%" text that was removed when panel switched to rubric-based display
- **Fix:** Updated test to check for rubric-based scoring text
- **Files modified:** `frontend/src/components/coach/scenario-panel.test.tsx`

**4. [Rule 1 - Bug] Fixed scenario-table test using hardcoded "Name" text**
- **Found during:** Task 3 verification
- **Issue:** Test used `screen.getByText("Name")` but mocked i18n returns the key `"scenarios.colName"`
- **Fix:** Changed to `screen.getByText("scenarios.colName")`
- **Files modified:** `frontend/src/components/admin/scenario-table.test.tsx`

## Verification

- Backend: `pytest tests/test_scenario_service.py tests/test_scenarios_api.py` -- 34 passed
- Frontend: `npx tsc -b --noEmit` -- 0 errors in modified files
- Frontend: `npx vitest run scenario-table.test.tsx scenario-panel.test.tsx` -- 26 passed

## Known Stubs

None -- all tag data flows are fully wired from API through to UI rendering.

## Self-Check: PASSED

- All key files verified present on disk
- All 4 commits verified in git log
- Backend tests: 34 passed
- Frontend component tests: 26 passed
- TypeScript: 0 errors in modified files
