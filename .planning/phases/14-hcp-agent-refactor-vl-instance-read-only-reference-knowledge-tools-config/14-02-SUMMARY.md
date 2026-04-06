---
phase: 14-hcp-agent-refactor-vl-instance-read-only-reference-knowledge-tools-config
plan: 02
subsystem: ui
tags: [react, voice-live, dialog, avatar, crud, i18n]

requires:
  - phase: 13-voice-live-instance-agent-voice-management
    provides: VL Instance CRUD hooks, types, and API layer
provides:
  - VlInstanceDialog component with 5-section rich form for VL Instance create/edit
  - Rewritten VL Management page using VlInstanceDialog instead of inline form
  - Enhanced instance card with CDN avatar thumbnails and Assign to HCP button
  - HCP assignment dialog with filtered profile selector
affects: [14-03, 14-04, voice-live-management, hcp-profile-editor]

tech-stack:
  added: []
  patterns:
    - "VlInstanceDialog as reusable dialog component with create/edit modes"
    - "Avatar grid with CDN thumbnails, photo/video filter, and initials fallback"

key-files:
  created:
    - frontend/src/components/admin/vl-instance-dialog.tsx
  modified:
    - frontend/src/pages/admin/voice-live-management.tsx
    - frontend/src/components/admin/voice-live-chain-card.tsx
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json

key-decisions:
  - "VlInstanceDialog uses useState form state (not react-hook-form) for simplicity since all fields have defaults"
  - "Avatar grid expands video avatar styles into individual cards (same pattern as voice-avatar-tab)"
  - "Assign dialog filters out HCPs already assigned to the target instance"

patterns-established:
  - "VlInstanceDialog reusable pattern: open/onOpenChange/instance props for create vs edit"

requirements-completed: [HCP-14-04, HCP-14-05]

duration: 5min
completed: 2026-04-06
---

# Phase 14 Plan 02: VL Instance CRUD Dialog & Management Rewrite Summary

**Rich 5-section VlInstanceDialog (model/voice/avatar/conversation/agent) replaces inline text-input form; management page gains HCP assign dialog; instance cards show CDN avatar thumbnails**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-06T00:04:54Z
- **Completed:** 2026-04-06T00:09:12Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created VlInstanceDialog component with 5 sectioned form areas covering all VL Instance fields
- Replaced the basic text-input dialog in VL Management page with the rich VlInstanceDialog
- Added HCP assignment functionality with filtered dropdown from the management page
- Enhanced instance cards with "Assign to HCP" button and preserved delete-blocked-when-referenced behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Create VlInstanceDialog component with sectioned form** - `756ffb1` (feat)
2. **Task 2: Rewrite VL Management page and enhance instance card** - `501cdf3` (feat)

## Files Created/Modified
- `frontend/src/components/admin/vl-instance-dialog.tsx` - New VlInstanceDialog with model select, voice dropdown + slider, avatar grid with CDN thumbnails, conversation params, agent instructions
- `frontend/src/pages/admin/voice-live-management.tsx` - Rewritten to use VlInstanceDialog, added assign dialog with HCP profile selector
- `frontend/src/components/admin/voice-live-chain-card.tsx` - Added onAssign prop and "Assign to HCP" button with UserPlus icon
- `frontend/public/locales/en-US/admin.json` - Added vlDialog* and assign* i18n keys
- `frontend/public/locales/zh-CN/admin.json` - Added vlDialog* and assign* i18n keys (Chinese)

## Decisions Made
- Used `useState` form state instead of `react-hook-form` in VlInstanceDialog since all fields have defaults and validation is minimal (only name required)
- Avatar grid expands video avatar styles into individual cards (same flat expansion pattern as voice-avatar-tab.tsx)
- Assign dialog filters HCPs by excluding those already assigned to the target instance via `voice_live_instance_id`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added i18n keys for dialog sections and assign flow**
- **Found during:** Task 1 (VlInstanceDialog creation)
- **Issue:** Plan referenced vlDialog* and assign* i18n keys but they did not exist in locale files
- **Fix:** Added all required i18n keys to both en-US and zh-CN admin.json
- **Files modified:** frontend/public/locales/en-US/admin.json, frontend/public/locales/zh-CN/admin.json
- **Verification:** TypeScript compilation passes, all t() calls resolve
- **Committed in:** 756ffb1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** i18n keys were referenced but not yet present. Adding them was essential for the dialog to display text.

## Issues Encountered
None

## Known Stubs
None - all data sources are wired to existing hooks (useCreateVoiceLiveInstance, useUpdateVoiceLiveInstance, useAssignVoiceLiveInstance, useHcpProfiles).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- VlInstanceDialog is ready for use in HCP profile editor (Plan 03/04 reference read-only mode)
- Management page is the sole CRUD entry point for VL Instances per CONTEXT.md decision

## Self-Check: PASSED

All files verified present, all commit hashes found in git log.

---
*Phase: 14-hcp-agent-refactor-vl-instance-read-only-reference-knowledge-tools-config*
*Completed: 2026-04-06*
