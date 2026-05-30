---
phase: 20-skill-dry-run-simulation-ai-skill
plan: 05
subsystem: frontend, backend
tags: [dry-run, skill-editor, integration, testing]
dependency_graph:
  requires: [20-01, 20-02, 20-03, 20-04]
  provides: [dry-run-editor-integration, dry-run-backend-tests]
  affects: [skill-editor.tsx, quality-tab]
tech_stack:
  added: []
  patterns: [lazy-import-for-parallel-components, noop-coroutine-mock-pattern]
key_files:
  created:
    - frontend/src/components/shared/dry-run-button.tsx
    - frontend/src/components/shared/dry-run-progress.tsx
    - frontend/src/components/shared/dry-run-history-list.tsx
    - backend/tests/test_dry_run.py
  modified:
    - frontend/src/pages/admin/skill-editor.tsx
decisions:
  - "Used lazy() import for DryRunComparisonChart to handle parallel executor creating it"
  - "Patched run_dry_run_simulation as noop coroutine instead of asyncio.create_task for clean test isolation"
  - "DryRunProgress uses hasNotified state to prevent duplicate toast notifications"
metrics:
  duration: 8min
  completed: "2026-04-26T16:18:00Z"
  tasks: 2
  files: 5
  tests_added: 27
  tests_passing: 27
---

# Phase 20 Plan 05: Skill Editor Dry Run Integration Summary

Integrated DryRunButton, DryRunProgress, and DryRunHistoryList into the Skill Editor and added 27 backend tests covering engine helpers and API endpoints.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 1cc7fb3 | feat(20-05): create DryRunButton, DryRunProgress, DryRunHistoryList components |
| 2 | 5def394 | feat(20-05): integrate dry run into skill editor |
| 3 | 4032f9d | test(20-05): add dry run backend tests |

## Task 1: Create Editor Integration Components

Created three new shared components:

**DryRunButton** (`dry-run-button.tsx`):
- FlaskConical icon with outline variant
- Disabled when: isNew, !hasContent, archived/failed status
- Tooltip on disabled state
- Confirmation dialog with "Go Back" / "Start Simulation" buttons
- Uses `useCreateDryRun()` mutation with toast feedback

**DryRunProgress** (`dry-run-progress.tsx`):
- Polls via `useDryRunStatus()` at 3s intervals
- Shows spinner, step counter, progress bar
- Cancel button with confirmation dialog
- Handles completed/failed/cancelled status transitions
- `aria-live="polite"` on progress container for accessibility

**DryRunHistoryList** (`dry-run-history-list.tsx`):
- Fetches latest 5 runs via `useDryRuns()`
- Score badges color-coded by threshold (70+ green, 40+ default, <40 destructive)
- Lazy-loads DryRunComparisonChart when >= 2 runs exist
- Loading state: 3 Skeleton rows
- Empty state: FlaskConical icon with explanatory text

## Task 2: Editor Integration + Backend Tests

**Frontend Integration** (`skill-editor.tsx`):
- Added `activeDryRunId` state for tracking running simulation
- DryRunButton in header before Save Draft (only shown for existing skills)
- DryRunProgress in Quality tab when activeDryRunId is set
- DryRunHistoryList below L1/L2 results when no active run
- Auto-switches to Quality tab on dry run creation

**Backend Tests** (`test_dry_run.py` - 27 tests):
- 4 tests: `_extract_sop_steps` (markdown, numbered list, empty, no structure)
- 3 tests: `_match_sop_step` (MR match, HCP no-match, no overlap)
- 1 test: `_compute_sop_coverage` (mixed coverage states)
- 3 tests: `_identify_issues` (uncovered, partial, all covered)
- 4 tests: `_compute_executability_score` (full, partial, empty, quality bonus)
- 4 tests: `_is_conversation_ending` (phrase, not ending, high turn, low turn)
- 8 tests: API endpoints (create, list, detail, status, cancel, no-content, cancel-completed, sequential numbers)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed asyncio.create_task mock strategy**
- **Found during:** Task 2 backend tests
- **Issue:** Patching `asyncio.create_task` directly caused TypeError in SQLAlchemy async session cleanup
- **Fix:** Patched `run_dry_run_simulation` with a noop coroutine instead, allowing `asyncio.create_task` to receive a valid coroutine
- **Files modified:** backend/tests/test_dry_run.py

**2. [Rule 3 - Blocking] Lazy import for DryRunComparisonChart**
- **Found during:** Task 1
- **Issue:** `dry-run-comparison-chart.tsx` created by parallel executor-04, not yet available
- **Fix:** Used React.lazy() with Suspense fallback for graceful handling
- **Files modified:** frontend/src/components/shared/dry-run-history-list.tsx

## Verification Results

- Frontend TypeScript: zero errors in plan files (3 errors in parallel executor's comparison-chart file are out of scope)
- Backend ruff: all checks passed
- Backend pytest: 27/27 tests passing

## Self-Check: PASSED

All 4 created files exist. All 3 commits found in git log.
