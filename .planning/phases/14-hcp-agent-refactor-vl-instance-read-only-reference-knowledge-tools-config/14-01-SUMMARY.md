---
phase: 14-hcp-agent-refactor-vl-instance-read-only-reference-knowledge-tools-config
plan: 01
subsystem: api, ui
tags: [fastapi, pydantic, tanstack-query, i18n, voice-live, unassign]

# Dependency graph
requires:
  - phase: 13-voice-live-instance-agent-voice-management
    provides: VoiceLiveInstance CRUD, assign endpoint, instance service
provides:
  - POST /voice-live/instances/unassign endpoint
  - VoiceLiveInstanceUnassign backend schema
  - unassignVoiceLiveInstance frontend API function
  - useUnassignVoiceLiveInstance TanStack mutation hook
  - VoiceLiveInstanceUnassign TypeScript interface
  - 30+ i18n keys in en-US and zh-CN for Phase 14 UI
affects: [14-02-PLAN, 14-03-PLAN, 14-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [unassign mutation with dual cache invalidation]

key-files:
  created: []
  modified:
    - backend/app/api/voice_live.py
    - backend/app/schemas/voice_live_instance.py
    - frontend/src/api/voice-live.ts
    - frontend/src/hooks/use-voice-live-instances.ts
    - frontend/src/types/voice-live.ts
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json

key-decisions:
  - "Placed /instances/unassign route before /{instance_id} parameterized routes per CLAUDE.md Gotcha #3"
  - "Added new i18n keys alongside existing keys rather than replacing (some keys like vlDialogModelSection already existed with different values)"

patterns-established:
  - "Unassign pattern: POST with hcp_profile_id body, returns cleared association"

requirements-completed: [HCP-14-01, HCP-14-06]

# Metrics
duration: 3min
completed: 2026-04-06
---

# Phase 14 Plan 01: Data Layer and i18n Foundation Summary

**Backend unassign endpoint, frontend API/hook/types for VL instance removal, and 30+ i18n keys for Phase 14 HCP Voice Tab and VL Management UI**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-06T00:04:52Z
- **Completed:** 2026-04-06T00:07:52Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Backend POST /voice-live/instances/unassign endpoint calls existing unassign_from_hcp service and returns cleared association
- Frontend unassignVoiceLiveInstance API function and useUnassignVoiceLiveInstance hook with dual cache invalidation (instances + hcp-profiles)
- VoiceLiveInstanceUnassign type/schema added to both backend (Pydantic) and frontend (TypeScript)
- 30+ i18n keys added in both en-US and zh-CN covering read-only config preview, VL dialog sections, knowledge/tools tabs, and assignment management

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend unassign endpoint + schema** - `ff83509` (feat)
2. **Task 2: Frontend API/hook extension + i18n keys** - `8471390` (feat)

## Files Created/Modified
- `backend/app/api/voice_live.py` - Added POST /instances/unassign endpoint with VoiceLiveInstanceUnassign import
- `backend/app/schemas/voice_live_instance.py` - Added VoiceLiveInstanceUnassign Pydantic schema
- `frontend/src/api/voice-live.ts` - Added unassignVoiceLiveInstance API function
- `frontend/src/hooks/use-voice-live-instances.ts` - Added useUnassignVoiceLiveInstance mutation hook
- `frontend/src/types/voice-live.ts` - Added VoiceLiveInstanceUnassign interface
- `frontend/public/locales/en-US/admin.json` - Added 30+ Phase 14 i18n keys in voiceLive section
- `frontend/public/locales/zh-CN/admin.json` - Added matching zh-CN translations for all new keys

## Decisions Made
- Placed /instances/unassign route before /{instance_id} parameterized routes per CLAUDE.md Gotcha #3 (static routes before parameterized)
- Added new i18n keys alongside existing ones rather than replacing -- some keys like vlDialogModelSection were already present from Phase 13 with slightly different labels

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all code is fully wired to existing backend services and frontend query infrastructure.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data layer (unassign endpoint + API/hook) ready for Plans 02 and 03 to consume
- All i18n keys ready for Phase 14 UI components (VL Management rewrite, HCP Voice Tab simplification)
- Plans 02-04 can proceed with UI implementation

---
*Phase: 14-hcp-agent-refactor-vl-instance-read-only-reference-knowledge-tools-config*
*Completed: 2026-04-06*
