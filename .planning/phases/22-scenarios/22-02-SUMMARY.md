---
phase: 22-scenarios
plan: 02
subsystem: system-enums
tags: [backend, frontend, database, admin, i18n, config]
dependency_graph:
  requires: [22-01]
  provides: [system-enums-api, system-enums-hooks, admin-enum-page]
  affects: [scenario-editor, hcp-profile-editor, reports]
tech_stack:
  added: []
  patterns: [query-key-factory, useEnumLabel-locale-hook, admin-crud-page]
key_files:
  created:
    - backend/app/models/system_enum.py
    - backend/app/schemas/system_enum.py
    - backend/app/services/system_enum_service.py
    - backend/app/api/system_enums.py
    - backend/alembic/versions/r22a_create_system_enums_table.py
    - frontend/src/types/system-enum.ts
    - frontend/src/api/system-enums.ts
    - frontend/src/hooks/use-system-enums.ts
    - frontend/src/pages/admin/system-enums.tsx
    - backend/tests/test_system_enum_service.py
    - backend/tests/test_system_enums_api.py
    - frontend/e2e/admin-system-enums.spec.ts
  modified:
    - backend/app/models/__init__.py
    - backend/app/api/__init__.py
    - backend/app/main.py
    - backend/alembic/env.py
    - frontend/src/router/index.tsx
    - frontend/src/components/layouts/admin-layout.tsx
    - frontend/src/components/admin/scenario-editor.tsx
    - frontend/src/pages/admin/hcp-profile-editor.tsx
    - frontend/src/pages/admin/reports.tsx
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json
    - frontend/public/locales/en-US/nav.json
    - frontend/public/locales/zh-CN/nav.json
    - frontend/public/locales/en-US/common.json
    - frontend/public/locales/zh-CN/common.json
decisions:
  - "ValidationException (422) used for duplicate enum check per project exception hierarchy convention"
  - "difficulty schema widened from z.enum to z.string to support DB-driven values"
  - "Button-based category selector instead of Select dropdown for visual clarity"
metrics:
  duration: 15min
  completed: "2026-05-06T07:35:00Z"
  tasks: 3
  files: 27
---

# Phase 22 Plan 02: System Enums Table (Hardcoded -> DB-driven Config) Summary

Database-backed configurable enum table replacing all hardcoded frontend constants with dynamic API-driven values, admin CRUD page, and full test coverage.

## Tasks Completed

| # | Task | Commit | Key Change |
|---|------|--------|-----------|
| 1 | Backend model, migration, service, API | 9dd74f1 | SystemEnum model + CRUD service + admin-only API + Alembic migration with seed data |
| 2 | Frontend types, API client, hooks, admin UI | 6183f42 | TypeScript types, axios client, TanStack Query hooks, admin page with category tabs |
| 3 | Replace hardcoded arrays + tests | 8de378e | Replaced PRODUCTS/THERAPEUTIC_AREAS/SPECIALTIES/DIFFICULTIES with useSystemEnums hooks |

## Decisions Made

1. **ValidationException (422) for duplicates**: Project convention uses `bad_request()` which raises `ValidationException(422)`, not HTTP 400. Tests adjusted accordingly.
2. **Difficulty schema widened**: Changed `z.enum(["easy","medium","hard"])` to `z.string().min(1)` in hcp-profile-editor to accept any DB-driven difficulty value.
3. **Button-based category selector**: Used clickable Button pills instead of a Select dropdown for the category navigation — provides better visual scanning of available categories.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ValidationException is 422 not 400**
- **Found during:** Task 3 test execution
- **Issue:** Tests expected 400 for duplicate enum, but `bad_request()` raises ValidationException which is 422
- **Fix:** Updated test assertions to expect 422
- **Files modified:** test_system_enum_service.py, test_system_enums_api.py
- **Commit:** 8de378e

**2. [Rule 1 - Bug] TypeScript type mismatch on difficulty field**
- **Found during:** Task 3 TypeScript compilation
- **Issue:** `form.setValue("difficulty", d.value)` failed because d.value is `string` but schema expected literal union
- **Fix:** Changed schema from `z.enum(["easy","medium","hard"])` to `z.string().min(1)`
- **Files modified:** hcp-profile-editor.tsx
- **Commit:** 8de378e

## Verification

- [x] Backend: ruff check + ruff format -- all pass
- [x] Backend: pytest 23/23 tests pass (10 service + 13 API)
- [x] Frontend: tsc -b -- no errors in source files
- [x] Frontend: npm run build -- succeeds
- [x] Seeded data: products (5), therapeutic_areas (4), specialties (9), difficulties (3), modes (2)
- [x] Admin page: route registered, sidebar link added, i18n keys for en-US and zh-CN

## Known Stubs

None - all data is wired from backend through hooks to UI.

## Self-Check: PASSED
