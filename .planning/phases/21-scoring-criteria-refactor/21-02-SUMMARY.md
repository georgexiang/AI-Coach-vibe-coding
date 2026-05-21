---
phase: 21-scoring-criteria-refactor
plan: 02
subsystem: ui
tags: [react, typescript, i18n, rubric, scenario, scoring]

# Dependency graph
requires:
  - phase: 21-scoring-criteria-refactor/01
    provides: Backend Scenario model with rubric_id FK, Alembic migration
provides:
  - Scenario TypeScript types with rubric_id (required, NOT NULL)
  - getDimensionDisplayName utility for backward-compatible historical score rendering
  - ScenarioEditor with rubric selector dropdown and dimension preview
  - i18n keys for rubric selector in en-US and zh-CN
affects: [21-scoring-criteria-refactor/03, scoring, session-history]

# Tech tracking
tech-stack:
  added: []
  patterns: [rubric-selector-dropdown, dimension-preview-card, legacy-dimension-i18n-map]

key-files:
  created:
    - frontend/src/lib/dimension-display.ts
  modified:
    - frontend/src/types/scenario.ts
    - frontend/src/components/admin/scenario-editor.tsx
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json

key-decisions:
  - "getDimensionDisplayName uses legacy map for snake_case keys, passes through human-readable rubric dimension names as-is"
  - "Rubric selector sorted by is_default first for discoverability"
  - "ScenarioPanel scoring criteria replaced with simplified rubric-based label (full rubric display deferred to session detail)"

patterns-established:
  - "Dimension display utility: legacy snake_case -> i18n lookup -> Title Case fallback; new names pass through"
  - "Rubric selector pattern: Controller + Select with dimension count in options, read-only preview card below"

requirements-completed: [SCORE-03, SCORE-05]

# Metrics
duration: 6min
completed: 2026-04-27
---

# Phase 21 Plan 02: Frontend Types and ScenarioEditor Rubric Selector Summary

**Scenario types refactored to rubric_id with dropdown selector, dimension preview, and getDimensionDisplayName utility for backward-compatible scoring display**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-27T14:57:20Z
- **Completed:** 2026-04-27T15:03:13Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Removed ScoringWeights interface and all weight_* fields from Scenario/ScenarioCreate types, replaced with rubric_id: string (required, NOT NULL per D-05)
- Created getDimensionDisplayName utility with legacy i18n map and Title Case fallback for backward-compatible historical score rendering
- Replaced ScoringWeights component in ScenarioEditor with rubric selector dropdown (sorted by default) and read-only dimension preview card
- Added 7 i18n keys for rubric selector in both en-US and zh-CN admin locales

## Task Commits

Each task was committed atomically:

1. **Task 1: TypeScript types + dimension display utility + i18n keys** - `9436306` (feat)
2. **Task 2: ScenarioEditor rubric selector replacing ScoringWeights** - `0988c40` (feat)

## Files Created/Modified
- `frontend/src/types/scenario.ts` - Removed ScoringWeights interface, replaced weight_* with rubric_id: string
- `frontend/src/lib/dimension-display.ts` - New utility for dimension display name resolution (legacy + new)
- `frontend/src/components/admin/scenario-editor.tsx` - Rubric selector dropdown with dimension preview, removed ScoringWeights
- `frontend/public/locales/en-US/admin.json` - Added 7 rubric selector i18n keys
- `frontend/public/locales/zh-CN/admin.json` - Added 7 rubric selector i18n keys (Chinese)
- `frontend/src/components/coach/scenario-panel.tsx` - Removed weight_* references, simplified scoring criteria card
- `frontend/src/components/voice/voice-session.tsx` - Updated default scenario to use rubric_id
- `frontend/src/pages/user/training-session.tsx` - Updated default scenario to use rubric_id
- `frontend/src/components/coach/scenario-panel.test.tsx` - Updated mock to use rubric_id
- `frontend/src/components/coach/scenario-card.test.tsx` - Updated mock to use rubric_id
- `frontend/src/components/admin/scenario-table.test.tsx` - Updated mock to use rubric_id
- `frontend/src/components/admin/scenario-editor.test.tsx` - Updated mock to use rubric_id
- `frontend/src/components/voice/voice-session.test.tsx` - Updated mock to use rubric_id
- `frontend/src/pages/user/training-session.test.tsx` - Updated mock to use rubric_id
- `frontend/src/pages/user/voice-session.test.tsx` - Updated two mocks to use rubric_id
- `frontend/src/api/api-clients.test.ts` - Added rubric_id to ScenarioCreate test data
- `frontend/src/hooks/use-scenarios.test.tsx` - Added rubric_id to mutation test data

## Decisions Made
- getDimensionDisplayName uses a legacy map (snake_case -> i18n key) for backward compat, and passes through human-readable rubric dimension names as-is
- Rubric selector sorted by is_default first to surface the default rubric at top
- ScenarioPanel scoring criteria card replaced with a simplified "rubric-based scoring" label since the full rubric dimension display requires fetching rubric data (deferred to session detail view)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed 13 downstream files referencing removed weight_* fields**
- **Found during:** Task 1 (TypeScript type changes)
- **Issue:** Removing weight_* from Scenario type caused 19 TypeScript errors across 10 files (production code + tests) that still referenced the old fields
- **Fix:** Updated all Scenario object literals and references from weight_* fields to rubric_id: string in production code (scenario-panel.tsx, voice-session.tsx, training-session.tsx) and test files (6 test files)
- **Files modified:** 12 additional files beyond plan scope
- **Verification:** npx tsc --noEmit passes with 0 errors after all fixes
- **Committed in:** 9436306 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary to maintain TypeScript compilation. All changes are mechanical replacements of removed fields. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Frontend types and ScenarioEditor are fully rubric-aware
- Plan 03 (scoring engine + API wiring) can proceed with confidence that frontend types match backend schema
- getDimensionDisplayName utility is ready for use in scoring result display components

## Self-Check: PASSED

---
*Phase: 21-scoring-criteria-refactor*
*Completed: 2026-04-27*
