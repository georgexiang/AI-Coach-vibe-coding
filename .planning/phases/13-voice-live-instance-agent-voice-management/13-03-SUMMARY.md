---
phase: 13-voice-live-instance-agent-voice-management
plan: 03
subsystem: ui
tags: [react, tanstack-query, voice-live, admin, i18n, chain-status, management-page]

# Dependency graph
requires:
  - phase: 13-01
    provides: VOICE_LIVE_MODELS constant, voice_live_model field on HcpProfile, GET /voice-live/models endpoint
  - phase: 13-02
    provides: voice_live_model field in HCP editor form, VoiceLiveModelSelect component, voice_live_model in frontend HcpProfile type
provides:
  - VoiceLiveChainCard component showing 4-step pipeline status per HCP
  - VoiceLiveManagementPage with summary stats grid and chain card grid
  - Admin route /admin/voice-live with sidebar navigation
  - Backend integration tests for model list API and batch sync endpoint
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chain status visualization with colored dots and vertical connectors"
    - "Summary stat cards computed via useMemo from TanStack Query data"
    - "Reuse existing hooks (useBatchSyncAgents, useRetrySyncHcpProfile) from use-hcp-profiles.ts"

key-files:
  created:
    - frontend/src/components/admin/voice-live-chain-card.tsx
    - frontend/src/pages/admin/voice-live-management.tsx
    - frontend/src/hooks/use-voice-live-management.ts
    - backend/tests/test_voice_live_management.py
  modified:
    - frontend/src/api/voice-live.ts
    - frontend/src/router/index.tsx
    - frontend/src/components/layouts/admin-layout.tsx
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json

key-decisions:
  - "Reused existing POST /hcp-profiles/batch-sync endpoint instead of creating new /voice-live/batch-resync"
  - "Created useBatchResyncAgents as thin wrapper in use-voice-live-management.ts for page-specific naming"
  - "Added pageDescription i18n key to avoid conflicting with existing voiceLive.description used elsewhere"
  - "Added retrySync/retrySyncSuccess/retrySyncError i18n keys for chain card individual re-sync"

patterns-established:
  - "Chain status card pattern: 4-step vertical chain with colored dots, connectors, and per-step status"
  - "Management overview page pattern: summary stat cards + filterable card grid + batch action"

requirements-completed: [VOICE-13-02, VOICE-13-04, VOICE-13-05]

# Metrics
duration: 4min
completed: 2026-04-03
---

# Phase 13 Plan 03: Voice Live Management Page Summary

**Voice Live Management admin page with 4-step chain status cards per HCP, summary statistics, batch re-sync, sidebar navigation, and backend integration tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-03T09:37:13Z
- **Completed:** 2026-04-03T09:41:38Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Built VoiceLiveChainCard showing 4-step chain (HCP Profile -> Agent Sync -> Voice Live Config -> Speech & Avatar) with colored status dots, vertical connectors, individual re-sync, and Edit HCP link
- Built VoiceLiveManagementPage with 4 summary stat cards (total HCPs, agents synced, Voice Live enabled, fully configured), responsive chain card grid, batch re-sync button with toast feedback
- Registered /admin/voice-live route and added Voice Live sidebar nav entry (Radio icon) in Configuration group
- Added 10 backend integration tests covering GET /voice-live/models and POST /hcp-profiles/batch-sync

## Task Commits

Not committed per user instructions (DO NOT commit).

## Files Created/Modified
- `frontend/src/components/admin/voice-live-chain-card.tsx` - VoiceLiveChainCard component with 4-step chain visualization
- `frontend/src/pages/admin/voice-live-management.tsx` - Voice Live Management admin page with stats and grid
- `frontend/src/hooks/use-voice-live-management.ts` - useBatchResyncAgents hook (wrapper around existing batch sync)
- `frontend/src/api/voice-live.ts` - Added fetchVoiceLiveModels function
- `frontend/src/router/index.tsx` - Added voice-live route under admin children
- `frontend/src/components/layouts/admin-layout.tsx` - Added Radio icon import and Voice Live sidebar nav item
- `frontend/public/locales/en-US/admin.json` - Added pageDescription, retrySync, retrySyncSuccess, retrySyncError keys
- `frontend/public/locales/zh-CN/admin.json` - Added corresponding Chinese locale keys
- `backend/tests/test_voice_live_management.py` - 10 integration tests for model list API and batch sync

## Decisions Made
- Reused existing `POST /hcp-profiles/batch-sync` endpoint instead of creating a new `/voice-live/batch-resync` endpoint (same operation, no duplication needed)
- Created `useBatchResyncAgents` as a thin alias wrapper in a new hook file for semantic clarity on the management page
- Added `pageDescription` i18n key separate from existing `description` to avoid breaking azure-config usage
- Added `retrySync`, `retrySyncSuccess`, `retrySyncError` i18n keys for chain card individual re-sync toasts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added i18n keys for individual re-sync toasts**
- **Found during:** Task 1 (VoiceLiveChainCard implementation)
- **Issue:** Plan specifies re-sync with toast.success/error but no i18n keys existed for `voiceLive.retrySync`, `voiceLive.retrySyncSuccess`, `voiceLive.retrySyncError`
- **Fix:** Added 3 new i18n keys to both en-US and zh-CN admin.json
- **Files modified:** frontend/public/locales/en-US/admin.json, frontend/public/locales/zh-CN/admin.json
- **Verification:** TypeScript compiles clean, keys used in VoiceLiveChainCard

**2. [Rule 2 - Missing Critical] Added pageDescription i18n key**
- **Found during:** Task 1 (VoiceLiveManagementPage implementation)
- **Issue:** Existing `voiceLive.description` is a short service description ("Real-time voice coaching..."), but the management page needs a longer page description per UI-SPEC
- **Fix:** Added `voiceLive.pageDescription` key to both locale files
- **Files modified:** frontend/public/locales/en-US/admin.json, frontend/public/locales/zh-CN/admin.json
- **Verification:** Page renders correct description text

---

**Total deviations:** 2 auto-fixed (2 missing critical i18n keys)
**Impact on plan:** Both auto-fixes necessary for complete i18n coverage. No scope creep.

## Issues Encountered
None

## Known Stubs
None - all data flows are wired through existing useHcpProfiles() hook and existing batch sync API.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 13 is now complete with all 3 plans delivered
- Voice Live Management page provides admin overview of the full HCP -> Agent -> Voice Live -> Speech/Avatar pipeline
- All frontend builds clean (tsc + vite), all backend tests pass (ruff + pytest)

## Self-Check: PASSED

All 8 files verified present. Frontend tsc + vite build clean. Backend ruff + 30 pytest tests pass.

---
*Phase: 13-voice-live-instance-agent-voice-management*
*Completed: 2026-04-03*
