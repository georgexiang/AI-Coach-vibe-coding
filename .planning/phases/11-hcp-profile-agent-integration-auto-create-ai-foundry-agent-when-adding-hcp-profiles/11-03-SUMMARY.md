---
phase: 11-hcp-profile-agent-integration
plan: 03
subsystem: ui
tags: [react, typescript, tanstack-query, i18n, table, agent-status]

# Dependency graph
requires:
  - phase: 11-01
    provides: Backend HCP profile model with agent_id, agent_sync_status, agent_sync_error fields and retry-sync endpoint
provides:
  - HcpProfile TypeScript type with agent sync fields
  - retrySyncHcpProfile API client function
  - useRetrySyncHcpProfile TanStack Query mutation hook
  - HcpTable component with sortable columns, agent status badges, and dropdown actions
  - Rewritten HCP profiles page using table layout with dialog-based editing
  - i18n keys for agent status in en-US and zh-CN
affects: [hcp-profiles, admin-ui, agent-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [table-with-agent-status-badge, dialog-based-edit-pattern, tooltip-error-display]

key-files:
  created:
    - frontend/src/components/admin/hcp-table.tsx
  modified:
    - frontend/src/types/hcp.ts
    - frontend/src/api/hcp-profiles.ts
    - frontend/src/hooks/use-hcp-profiles.ts
    - frontend/src/pages/admin/hcp-profiles.tsx
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json
    - frontend/src/components/admin/hcp-editor.test.tsx
    - frontend/src/components/admin/hcp-list.test.tsx
    - frontend/src/components/admin/scenario-table.test.tsx
    - frontend/src/components/coach/scenario-card.test.tsx
    - frontend/src/components/coach/scenario-panel.test.tsx

key-decisions:
  - "Used Dialog instead of AlertDialog for delete confirmation since AlertDialog component does not exist in the project UI library"
  - "Tooltip component already wraps itself in TooltipProvider, so no extra wrapper needed in AgentStatusBadge"
  - "Used variant='destructive' on DropdownMenuItem matching existing scenario-table.tsx pattern"

patterns-established:
  - "AgentStatusBadge: inline component with color-coded status, pulse animation for pending, error tooltip for failed"
  - "Table + Dialog editing pattern: full-width table with dialog overlay for create/edit, replacing sidebar layout"

requirements-completed: [HCP-01, UI-06, COACH-07, PLAT-01]

# Metrics
duration: 14min
completed: 2026-03-31
---

# Phase 11 Plan 03: Frontend HCP Table with Agent Status Summary

**HcpTable component with sortable columns, agent sync status badges (synced/pending/failed/none), retry sync action, and full page rewrite from list+editor to table+dialog layout with i18n support in en-US and zh-CN**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-31T09:02:29Z
- **Completed:** 2026-03-31T09:16:40Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Added agent_id, agent_sync_status, agent_sync_error fields to HcpProfile TypeScript type
- Created retrySyncHcpProfile API client and useRetrySyncHcpProfile mutation hook
- Built HcpTable component with sortable Name/Specialty columns, personality badge, communication style, agent status badges with tooltips, and dropdown actions (edit, retry sync, delete)
- Rewrote HCP profiles page from list+editor sidebar layout to full-width table with dialog-based editing and delete confirmation
- Added all agent status i18n keys in both en-US and zh-CN locales

## Task Commits

Each task was committed atomically:

1. **Task 1: TypeScript types + API client + TanStack Query hooks + i18n keys** - `f805c92` (feat)
2. **Task 2: HcpTable component + HCP profiles page rewrite** - `2570dbf` (feat)

## Files Created/Modified
- `frontend/src/types/hcp.ts` - Added agent_id, agent_sync_status, agent_sync_error to HcpProfile
- `frontend/src/api/hcp-profiles.ts` - Added retrySyncHcpProfile API function
- `frontend/src/hooks/use-hcp-profiles.ts` - Added useRetrySyncHcpProfile mutation hook
- `frontend/src/components/admin/hcp-table.tsx` - New table component with agent status badges, sorting, pagination, dropdown actions
- `frontend/src/pages/admin/hcp-profiles.tsx` - Rewritten from list+editor to table+dialog layout
- `frontend/public/locales/en-US/admin.json` - Agent status labels, tooltips, retry sync, delete confirmation i18n keys
- `frontend/public/locales/zh-CN/admin.json` - Chinese translations for all new agent status keys
- `frontend/src/components/admin/hcp-editor.test.tsx` - Added agent fields to mock data
- `frontend/src/components/admin/hcp-list.test.tsx` - Added agent fields to mock data
- `frontend/src/components/admin/scenario-table.test.tsx` - Added agent fields to embedded HCP mock
- `frontend/src/components/coach/scenario-card.test.tsx` - Added agent fields to embedded HCP mock
- `frontend/src/components/coach/scenario-panel.test.tsx` - Added agent fields to embedded HCP mock

## Decisions Made
- Used Dialog (not AlertDialog) for delete confirmation since AlertDialog component does not exist in project UI library
- Tooltip component already includes TooltipProvider wrapper, no extra wrapper needed
- Used variant="destructive" on DropdownMenuItem matching existing scenario-table.tsx convention

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed test files missing new HcpProfile agent fields**
- **Found during:** Task 1 (TypeScript type check)
- **Issue:** Adding agent_id, agent_sync_status, agent_sync_error to HcpProfile type caused TypeScript errors in 6 test files that use HcpProfile mock data without the new fields
- **Fix:** Added agent_id: "", agent_sync_status: "none", agent_sync_error: "" to all HcpProfile mock objects in affected test files
- **Files modified:** hcp-editor.test.tsx, hcp-list.test.tsx, scenario-table.test.tsx, scenario-card.test.tsx, scenario-panel.test.tsx
- **Verification:** npx tsc -b --noEmit passes with 0 errors
- **Committed in:** f805c92 (Task 1 commit)

**2. [Rule 3 - Blocking] Used Dialog instead of AlertDialog for delete confirmation**
- **Found during:** Task 2 (HCP profiles page rewrite)
- **Issue:** Plan referenced AlertDialog component which does not exist in frontend/src/components/ui/
- **Fix:** Used existing Dialog component with DialogFooter containing Cancel and Delete buttons, matching existing project delete confirmation patterns
- **Files modified:** frontend/src/pages/admin/hcp-profiles.tsx
- **Verification:** npm run build succeeds
- **Committed in:** 2570dbf (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for compilation and component availability. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Frontend HCP table with agent status badges is complete and ready for integration
- Backend agent sync (Plan 01) provides the data; frontend now displays and manages it
- All i18n externalized for both locales

## Self-Check: PASSED

All 7 created/modified files verified present. Both task commits (f805c92, 2570dbf) verified in git log.

---
*Phase: 11-hcp-profile-agent-integration*
*Completed: 2026-03-31*
