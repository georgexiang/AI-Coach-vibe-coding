---
phase: 11-hcp-profile-agent-integration
plan: 02
subsystem: api
tags: [hcp-profile, agent-sync, voice-live, token-broker, integration-tests, tdd]

# Dependency graph
requires:
  - phase: 11-hcp-profile-agent-integration
    plan: 01
    provides: "agent_sync_service module, HcpProfile agent columns, HcpProfileOut with agent fields"
provides:
  - "HCP CRUD lifecycle auto-syncs AI Foundry agents (create/update/delete)"
  - "retry-sync API endpoint for failed agent sync recovery"
  - "Token broker sources agent_id from HCP profile for Realtime Agent mode"
  - "8 integration tests covering full agent sync lifecycle"
affects: [11-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-save agent sync hook with try/except safety (failure does not block CRUD)"
    - "Token broker hcp_profile_id parameter for per-HCP agent routing"
    - "Lazy import in service to avoid circular dependency (hcp_profile_service in voice_live_service)"

key-files:
  created:
    - backend/tests/test_hcp_agent_sync_integration.py
  modified:
    - backend/app/services/hcp_profile_service.py
    - backend/app/api/hcp_profiles.py
    - backend/app/services/voice_live_service.py

key-decisions:
  - "Agent sync hooks use try/except so CRUD operations succeed even when AI Foundry is unavailable"
  - "Lazy import of hcp_profile_service inside voice_live_service to avoid circular dependency"
  - "retry-sync endpoint placed before DELETE route in router for logical grouping"
  - "Token broker falls back to config-level agent_id when profile has no agent_id"

patterns-established:
  - "Post-save sync hook pattern: flush -> set pending -> try sync -> set synced/failed -> flush again"
  - "Token broker per-HCP routing: optional hcp_profile_id parameter overrides config-level agent_id"

requirements-completed: [HCP-01, HCP-02, COACH-06, PLAT-03]

# Metrics
duration: 8min
completed: 2026-03-31
---

# Phase 11 Plan 02: CRUD Agent Sync Lifecycle Summary

**HCP CRUD auto-syncs AI Foundry agents with try/except safety, retry-sync endpoint, and token broker per-HCP agent_id routing**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-31T09:04:25Z
- **Completed:** 2026-03-31T09:13:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- HCP profile create/update/delete automatically triggers AI Foundry agent sync with failure-safe try/except
- Retry-sync endpoint at POST /{profile_id}/retry-sync for recovering failed agent syncs
- Token broker extended with hcp_profile_id parameter to source per-HCP agent_id for Realtime Agent mode
- 8 integration tests covering all CRUD sync paths, retry, failure handling, and token broker extension

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire agent sync into HCP profile service CRUD + retry-sync API endpoint** - `c45402d` (feat)
2. **Task 2 RED: Failing integration tests for agent sync lifecycle** - `e8dbcd0` (test)
3. **Task 2 GREEN: Token broker extension + all integration tests passing** - `b389ae9` (feat)

## Files Created/Modified
- `backend/app/services/hcp_profile_service.py` - Added agent_sync_service import, sync hooks in create/update/delete, retry_agent_sync function
- `backend/app/api/hcp_profiles.py` - Added POST /{profile_id}/retry-sync endpoint (admin only)
- `backend/app/services/voice_live_service.py` - Extended get_voice_live_token with hcp_profile_id parameter for per-HCP agent routing
- `backend/tests/test_hcp_agent_sync_integration.py` - 8 integration tests: 3 token broker + 4 CRUD sync + 1 failure handling

## Decisions Made
- Agent sync hooks use try/except so CRUD operations succeed even when AI Foundry API is unavailable (per D-02, D-10)
- Lazy import of hcp_profile_service inside voice_live_service to avoid circular dependency between services
- retry-sync endpoint placed after PUT but before DELETE for logical grouping
- Token broker falls back to config-level agent_id when HCP profile has no agent_id (empty string)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Agent sync lifecycle fully wired: create/update/delete + retry
- Token broker ready for frontend to pass hcp_profile_id when starting voice sessions
- Plan 03 can build the frontend UI for agent sync status display and retry button

## Self-Check: PASSED

All 4 files verified present. All 3 commits (c45402d, e8dbcd0, b389ae9) found in git log.

---
*Phase: 11-hcp-profile-agent-integration*
*Completed: 2026-03-31*
