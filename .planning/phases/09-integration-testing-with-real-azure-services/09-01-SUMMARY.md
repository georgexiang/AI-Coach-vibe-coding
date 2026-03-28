---
phase: 09-integration-testing-with-real-azure-services
plan: 01
subsystem: api
tags: [azure, ai-foundry, config, schema, alembic, pydantic, voice-live, agent-mode]

# Dependency graph
requires:
  - phase: 07-azure-service-integration
    provides: ServiceConfig model, config_service CRUD, connection_tester, register_adapter_from_config
  - phase: 08-voice-live-and-avatar
    provides: Voice Live token broker, VoiceLiveTokenResponse schema, session mode field
provides:
  - Unified AI Foundry master config pattern (single endpoint/key for all services)
  - 7 interaction mode session schema (text, voice_pipeline, digital_human_pipeline, voice_realtime_model, digital_human_realtime_model, voice_realtime_agent, digital_human_realtime_agent)
  - Agent mode token broker returning agent_id and project_name
  - GET/PUT /azure-config/ai-foundry admin API endpoints
  - Master fallback for per-service endpoint, key, and region
affects: [09-02, 09-03, 09-04, 09-05, frontend-admin-config-ui, frontend-mode-selector]

# Tech tracking
tech-stack:
  added: []
  patterns: [unified-config-master-fallback, 7-mode-session-enum, agent-mode-token-broker]

key-files:
  created:
    - backend/alembic/versions/f09a_unified_ai_foundry_config.py
  modified:
    - backend/app/models/service_config.py
    - backend/app/models/session.py
    - backend/app/schemas/session.py
    - backend/app/schemas/azure_config.py
    - backend/app/schemas/voice_live.py
    - backend/app/services/config_service.py
    - backend/app/services/connection_tester.py
    - backend/app/services/voice_live_service.py
    - backend/app/api/azure_config.py
    - backend/app/api/sessions.py
    - backend/app/main.py
    - backend/tests/test_sessions_api.py
    - backend/tests/test_voice_live.py

key-decisions:
  - "Unified AI Foundry config: single master row (is_master=True) with shared endpoint/region/key; per-service rows inherit via get_effective_key/get_effective_endpoint"
  - "Session mode expanded from 3 to 7 Literal values; model column widened from String(20) to String(40)"
  - "Feature flag check simplified from mode in (voice, avatar) to mode != text for all non-text modes"
  - "Agent mode token broker uses parse_voice_live_mode to return agent_id/project_name in VoiceLiveTokenResponse"

patterns-established:
  - "Master-fallback pattern: get_effective_key/get_effective_endpoint check per-service first, then master AI Foundry row"
  - "Lifespan loads master config first, passes master_endpoint/master_key/master_region to per-service adapter registration"

requirements-completed: [PLAT-03, PLAT-05, COACH-04, COACH-05, COACH-06, COACH-07]

# Metrics
duration: 16min
completed: 2026-03-28
---

# Phase 09 Plan 01: Unified AI Foundry Config Summary

**Single master config row with is_master flag replaces 8 separate endpoint/key pairs; session mode expanded to 7 interaction modes; agent mode token broker returns agent_id and project_name**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-28T13:26:52Z
- **Completed:** 2026-03-28T13:43:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- ServiceConfig model extended with is_master boolean to distinguish AI Foundry master row from per-service toggles
- Session mode schema expanded from 3 values (text/voice/avatar) to 7 interaction modes matching D-06 spec
- Config service gains get_master_config, upsert_master_config, get_effective_key, get_effective_endpoint for unified config pattern
- Token broker returns agent_id and project_name for agent mode sessions via parse_voice_live_mode
- API gains GET/PUT /azure-config/ai-foundry endpoints for master config management
- Connection tester and adapter registration use master fallback for empty per-service credentials
- All 921 existing tests pass (14 skipped)

## Task Commits

Each task was committed atomically:

1. **Task 1: Alembic migration + model/schema changes** - `5e60625` (feat)
2. **Task 2: Config service, connection tester, token broker, API routes** - `e804220` (feat)

## Files Created/Modified
- `backend/alembic/versions/f09a_unified_ai_foundry_config.py` - Migration: add is_master column, expand mode String(20)->String(40)
- `backend/app/models/service_config.py` - Added is_master: Mapped[bool] column
- `backend/app/models/session.py` - Expanded mode column to String(40)
- `backend/app/schemas/session.py` - 7-mode Literal type for SessionCreate.mode
- `backend/app/schemas/azure_config.py` - Added AIFoundryConfigUpdate schema and is_master to ServiceConfigResponse
- `backend/app/schemas/voice_live.py` - Added agent_id and project_name optional fields
- `backend/app/services/config_service.py` - Added master config functions and effective key/endpoint fallback
- `backend/app/services/connection_tester.py` - Added master_endpoint/master_key/master_region params
- `backend/app/services/voice_live_service.py` - Unified config fallback and agent mode parsing
- `backend/app/api/azure_config.py` - AI Foundry GET/PUT endpoints, master fallback in adapter registration
- `backend/app/api/sessions.py` - Updated feature flag check for 7-mode compatibility
- `backend/app/main.py` - Lifespan loads master config first, passes to per-service registration
- `backend/tests/test_sessions_api.py` - Updated mode values from voice/avatar to new 7-mode values
- `backend/tests/test_voice_live.py` - Updated schema tests and mock signatures for new service interface

## Decisions Made
- Unified AI Foundry config uses is_master boolean flag (not separate table) for backward compatibility
- Session mode String(40) accommodates "digital_human_realtime_agent" (28 chars) with room for growth
- Feature flag check simplified: any non-text mode requires voice_live_enabled (not just "voice" and "avatar")
- Agent mode detection via parse_voice_live_mode from azure_voice_live adapter (existing utility reused)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated session mode feature flag check in sessions API**
- **Found during:** Task 2 (API route updates)
- **Issue:** sessions.py checked mode in ("voice", "avatar") but those values no longer exist in the 7-mode Literal type
- **Fix:** Changed to mode != "text" to gate all non-text modes behind feature_voice_live_enabled
- **Files modified:** backend/app/api/sessions.py
- **Verification:** Tests pass with new mode values
- **Committed in:** e804220 (Task 2 commit)

**2. [Rule 1 - Bug] Updated tests for new mode values and service mock signatures**
- **Found during:** Task 2 (verification)
- **Issue:** Existing tests used old mode values "voice" and "avatar" and old mock signatures (get_decrypted_key instead of get_effective_key)
- **Fix:** Updated test_sessions_api.py and test_voice_live.py to use new 7-mode values and updated mock signatures
- **Files modified:** backend/tests/test_sessions_api.py, backend/tests/test_voice_live.py
- **Verification:** All 921 tests pass
- **Committed in:** e804220 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes necessary for correctness after schema changes. No scope creep.

## Issues Encountered
None - all changes applied cleanly.

## Known Stubs
None - all functionality is fully wired.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Unified AI Foundry config backend is complete, ready for frontend admin UI redesign (Plan 09-02)
- 7-mode session schema ready for frontend mode selector two-level UI (Plan 09-03/04)
- Agent mode token broker ready for frontend voice-live hook agent path (Plan 09-03)

---
*Phase: 09-integration-testing-with-real-azure-services*
*Completed: 2026-03-28*
