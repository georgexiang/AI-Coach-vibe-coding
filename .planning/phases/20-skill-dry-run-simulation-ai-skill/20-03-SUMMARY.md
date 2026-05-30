---
phase: 20-skill-dry-run-simulation-ai-skill
plan: 03
subsystem: ui
tags: [typescript, tanstack-query, react, i18n, axios, dry-run]

# Dependency graph
requires:
  - phase: 19-ai-coach-skill-module
    provides: skillKeys query-key factory, Skill types, API client pattern
provides:
  - DryRun TypeScript interfaces matching backend schemas
  - API client functions for all 5 dry-run endpoints
  - TanStack Query hooks with dryRunKeys factory and 3s polling
  - Complete i18n coverage (46 keys) in en-US and zh-CN
affects: [20-04-dry-run-report-page, 20-05-editor-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [dryRunKeys factory extending skillKeys, polling query with refetchInterval]

key-files:
  created:
    - frontend/src/types/dry-run.ts
    - frontend/src/api/dry-runs.ts
    - frontend/src/hooks/use-dry-runs.ts
  modified:
    - frontend/public/locales/en-US/skill.json
    - frontend/public/locales/zh-CN/skill.json

key-decisions:
  - "dryRunKeys factory nests under skillKeys.detail(id) for automatic cache invalidation when parent skill changes"
  - "useDryRunStatus uses refetchInterval: 3000 for real-time polling per UI-SPEC requirement"

patterns-established:
  - "dryRunKeys extends skillKeys: [...skillKeys.detail(skillId), 'dry-runs'] for nested resource cache hierarchy"
  - "Status polling hook pattern: enabled flag + refetchInterval for conditional auto-refresh"

requirements-completed: [DR-08]

# Metrics
duration: 2min
completed: 2026-04-26
---

# Phase 20 Plan 03: Frontend Data Layer Summary

**Typed DryRun data layer with API client, TanStack Query hooks (3s polling), and 46-key i18n in en-US/zh-CN**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-26T16:02:02Z
- **Completed:** 2026-04-26T16:03:43Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- TypeScript types with 7 interfaces and 3 union types matching backend DryRun schemas exactly
- API client wrapping all 5 dry-run endpoints (create, list, detail, status, cancel) with full typing
- TanStack Query hooks with dryRunKeys factory extending skillKeys pattern for hierarchical cache invalidation
- Complete i18n with 46 keys per locale covering all UI-SPEC copywriting in both English and Chinese

## Task Commits

Each task was committed atomically:

1. **Task 1+2: TypeScript types, API client, hooks, and i18n** - `49a1ad6` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `frontend/src/types/dry-run.ts` - 7 interfaces (DryRun, DryRunListItem, DryRunMessage, SopStepCoverage, DryRunIssue, DryRunStatusResponse, PaginatedDryRuns) and 3 union types
- `frontend/src/api/dry-runs.ts` - 5 async API functions using apiClient pattern from skills.ts
- `frontend/src/hooks/use-dry-runs.ts` - dryRunKeys factory + 5 hooks (useDryRuns, useDryRun, useDryRunStatus, useCreateDryRun, useCancelDryRun)
- `frontend/public/locales/en-US/skill.json` - Added dryRun key with 46 English translation entries
- `frontend/public/locales/zh-CN/skill.json` - Added dryRun key with 46 Chinese translation entries

## Decisions Made
- dryRunKeys factory nests under skillKeys.detail(id) so invalidating a skill automatically invalidates its dry runs
- useDryRunStatus uses refetchInterval: 3000 (3 seconds) for real-time progress polling per UI-SPEC requirement
- DryRunListItem unused import removed from API client (only used in PaginatedDryRuns which imports it internally via the type file)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data layer complete and ready for Plan 04 (Dry Run Report Page) and Plan 05 (Editor Integration)
- All hooks exported and importable, all i18n keys available in skill namespace
- TypeScript compilation verified with zero errors

## Self-Check: PASSED

- All 6 files exist on disk
- Commit 49a1ad6 verified in git log
- TypeScript compilation: zero errors
- JSON validation: both locale files parse successfully
- dryRun key count: 46 keys in both en-US and zh-CN

---
*Phase: 20-skill-dry-run-simulation-ai-skill*
*Completed: 2026-04-26*
