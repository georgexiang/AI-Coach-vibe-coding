---
phase: 22-scenarios
plan: 05
subsystem: frontend
tags: [scenario-editor, routing, ui-refactor]
dependency_graph:
  requires: [22-04]
  provides: [full-page-scenario-editor, scenario-routes]
  affects: [frontend/src/pages/admin, frontend/src/router, frontend/src/components/admin]
tech_stack:
  added: []
  patterns: [full-page-editor-pattern, tab-based-form, route-based-crud]
key_files:
  created:
    - frontend/src/pages/admin/scenario-editor.tsx
  modified:
    - frontend/src/router/index.tsx
    - frontend/src/pages/admin/scenarios.tsx
    - frontend/src/components/admin/scenario-table.tsx
    - frontend/src/components/admin/index.ts
    - frontend/src/components/admin/scenario-table.test.tsx
    - frontend/src/pages/admin/scenarios.test.tsx
    - frontend/e2e/admin-scenarios.spec.ts
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json
  deleted:
    - frontend/src/components/admin/scenario-editor.tsx
    - frontend/src/components/admin/scenario-editor.test.tsx
decisions:
  - Followed HCP Profile Editor pattern exactly for consistency
  - Used fieldset disabled for archived read-only mode (simpler than per-field disabled)
  - Kept predefined tags as constants (system_enums API not yet available)
metrics:
  duration: 8m
  completed: 2026-05-06T08:28:00Z
  tasks: 3
  files: 12
---

# Phase 22 Plan 05: Full-Page Editor (Dialog -> Route-based) Summary

Full-page route-based scenario editor with three tabs, replacing the old Dialog-based approach with route navigation matching the HCP Profile Editor pattern.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 19a24a1 | feat(22-05): create full-page scenario editor component |
| 2 | 89f948d | feat(22-05): wire routes, update list page, delete old dialog editor |
| 3 | 72eba6b | test(22-05): update E2E tests for route-based scenario editor |

## What Was Done

### Task 1: Full-Page Scenario Editor Component
Created `frontend/src/pages/admin/scenario-editor.tsx` following the HCP Profile Editor pattern:
- `useParams` for new vs edit mode detection
- `useForm` + `zodResolver` for form validation
- Three tabs: Basic Info (name, description, mode, difficulty, tags, key messages), Linked Config (HCP selector, Skill selector with version/quality badges), Scoring Rules (rubric selector with dimension preview, pass threshold)
- Back button navigates to `/admin/scenarios`
- Save button in header with pending state
- Archived scenarios render form inside disabled `<fieldset>` with info banner
- Loading spinner while fetching existing scenario data

### Task 2: Router + List Page Wiring + Delete Old Editor
- Added routes: `/admin/scenarios/new` and `/admin/scenarios/:id`
- Updated list page: Create button navigates to `/new`, removed all dialog state/handlers
- Updated ScenarioTable: Edit dropdown item uses `useNavigate` instead of `onEdit` callback
- Deleted old `scenario-editor.tsx` Dialog component and its unit test
- Removed `ScenarioEditor` from barrel export
- Added i18n keys for both EN and ZH-CN

### Task 3: E2E Tests
- Rewrote E2E tests to validate route-based navigation
- Tests verify: create navigates to /new, edit navigates to /:id, back returns to list
- Tests verify tabs render (Basic Info, Linked Config, Scoring Rules)
- Tests verify scoring tab has rubric selector and pass threshold
- Kept status filter and delete confirmation dialog tests

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- Vite production build: PASSES (0 errors)
- TypeScript check on source files: PASSES (0 non-test errors)
- No dangling imports to deleted `scenario-editor.tsx`
- All routes registered and lazy-loaded correctly

## Self-Check: PASSED
