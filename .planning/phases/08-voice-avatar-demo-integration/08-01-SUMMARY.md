---
phase: 08-voice-avatar-demo-integration
plan: 01
subsystem: api
tags: [fastapi, azure-voice-live, pydantic, alembic, connection-tester, token-broker]

# Dependency graph
requires:
  - phase: 07-azure-service-integration
    provides: config_service CRUD, ServiceConfig model, encryption utils, connection tester dispatch
provides:
  - Voice Live token broker endpoint (POST /api/v1/voice-live/token)
  - Voice Live status endpoint (GET /api/v1/voice-live/status)
  - Session mode field (text/voice/avatar) in coaching_sessions table
  - VoiceLiveTokenResponse and VoiceLiveConfigStatus Pydantic schemas
  - voice_live_service with token generation and region validation
  - Connection tester azure_voice_live handler with region validation
  - SERVICE_DISPLAY_NAMES includes azure_voice_live
  - feature_voice_live_enabled toggle in Settings
affects: [08-02, 08-03, 08-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [token-broker-pattern, region-validation, config-service-backed-endpoints]

key-files:
  created:
    - backend/app/api/voice_live.py
    - backend/app/schemas/voice_live.py
    - backend/app/services/voice_live_service.py
    - backend/alembic/versions/a1b2c3d4e5f6_add_session_mode.py
    - backend/tests/test_voice_live.py
  modified:
    - backend/app/models/session.py
    - backend/app/schemas/session.py
    - backend/app/config.py
    - backend/app/api/__init__.py
    - backend/app/main.py
    - backend/app/api/azure_config.py
    - backend/app/services/connection_tester.py

key-decisions:
  - "Token broker returns raw API key (not SAS token) for Voice Live API -- frontend connects directly to Azure"
  - "SUPPORTED_REGIONS limited to eastus2 and swedencentral per Azure Voice Live API availability"
  - "Session mode field uses server_default='text' for SQLite compatibility with existing rows"
  - "Connection tester falls back to format validation when HTTP probe fails"

patterns-established:
  - "Token broker pattern: authenticated backend endpoint issues credentials for direct frontend-to-Azure connection"
  - "Import aliasing in tests: use _test_* prefix to prevent pytest collecting imported functions as test cases"

requirements-completed: [COACH-04, COACH-05, EXT-04, PLAT-05]

# Metrics
duration: 19min
completed: 2026-03-27
---

# Phase 08 Plan 01: Voice Live Backend Foundation Summary

**Token broker endpoint for Azure Voice Live API with session mode tracking, connection tester, and 22 passing tests**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-27T07:14:50Z
- **Completed:** 2026-03-27T07:33:21Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Token broker endpoint at POST /api/v1/voice-live/token returns Azure credentials for authenticated users
- Status endpoint at GET /api/v1/voice-live/status reports Voice Live and Avatar availability
- Alembic migration adds mode column (text/voice/avatar) to coaching_sessions with server_default
- Connection tester validates azure_voice_live with region restriction (eastus2, swedencentral only)
- 22 tests covering schemas, region validation, connection testing, and API endpoints

## Task Commits

Each task was committed atomically:

1. **Task 1: Alembic migration, model extension, schemas, and voice_live service** - `b773577` (feat)
2. **Task 2: Token broker API endpoint, connection tester, router registration, and tests** - `99a5f68` (feat)

## Files Created/Modified
- `backend/app/api/voice_live.py` - Token broker and status API router
- `backend/app/schemas/voice_live.py` - VoiceLiveTokenResponse and VoiceLiveConfigStatus schemas
- `backend/app/services/voice_live_service.py` - Token generation, status check, region validation
- `backend/app/services/connection_tester.py` - Extended with azure_voice_live handler
- `backend/app/api/azure_config.py` - Added azure_voice_live to SERVICE_DISPLAY_NAMES
- `backend/app/models/session.py` - Added mode field to CoachingSession
- `backend/app/schemas/session.py` - Added mode to SessionCreate and SessionResponse
- `backend/app/config.py` - Added feature_voice_live_enabled toggle and encryption_key
- `backend/alembic/versions/a1b2c3d4e5f6_add_session_mode.py` - Migration for mode column
- `backend/app/api/__init__.py` - Added voice_live_router export
- `backend/app/main.py` - Registered voice_live_router
- `backend/tests/test_voice_live.py` - 22 tests for voice_live functionality
- `backend/app/models/service_config.py` - ServiceConfig model (Phase 07 prerequisite)
- `backend/app/utils/encryption.py` - Fernet encryption helpers (Phase 07 prerequisite)
- `backend/app/schemas/azure_config.py` - Azure config schemas (Phase 07 prerequisite)
- `backend/app/services/config_service.py` - Config service CRUD (Phase 07 prerequisite)

## Decisions Made
- Token broker returns raw API key for Voice Live API -- frontend connects directly to Azure with these credentials
- SUPPORTED_REGIONS restricted to eastus2 and swedencentral per Azure Voice Live API regional availability
- Session mode field uses server_default='text' for SQLite compatibility with existing rows (consistent with Phase 06/07 pattern)
- Connection tester falls back to format validation when HTTP probe to Azure endpoint fails (graceful degradation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Phase 07 prerequisite files to worktree**
- **Found during:** Task 2 (API endpoint creation)
- **Issue:** Worktree was at an older commit missing Phase 07 files (config_service.py, ServiceConfig model, encryption.py, azure_config schemas, connection_tester.py) that voice_live_service depends on
- **Fix:** Copied Phase 07 files from main repo to worktree: ServiceConfig model, encryption utils, config_service, azure_config schemas, service_config migration
- **Files added:** backend/app/models/service_config.py, backend/app/utils/encryption.py, backend/app/services/config_service.py, backend/app/schemas/azure_config.py, backend/alembic/versions/35e15f5ae427_add_service_config_table.py
- **Verification:** All imports resolve, tests pass, ruff clean
- **Committed in:** 99a5f68 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed pytest collection of imported test functions**
- **Found during:** Task 2 (test writing)
- **Issue:** Importing `test_azure_voice_live` and `test_service_connection` from connection_tester.py caused pytest to try collecting them as test functions (they start with `test_` prefix)
- **Fix:** Used import aliasing: `test_azure_voice_live as _test_azure_voice_live`
- **Files modified:** backend/tests/test_voice_live.py
- **Verification:** pytest runs cleanly with 22 passed, 0 errors
- **Committed in:** 99a5f68 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for tests to run in the parallel worktree context. No scope creep.

## Issues Encountered
- None beyond the deviations noted above.

## Known Stubs
None - all endpoints wire to real service logic via config_service. Token generation returns actual credentials from DB.

## User Setup Required
None - no external service configuration required for this plan.

## Next Phase Readiness
- Backend API surface complete for Voice Live integration
- Frontend plans (08-02, 08-03) can now consume the token broker and status endpoints
- Connection tester ready for admin UI integration

## Self-Check: PASSED

- All 7 key files verified present on disk
- Commits b773577 and 99a5f68 verified in git log
- 22/22 tests passing
- All plan files lint and format clean

---
*Phase: 08-voice-avatar-demo-integration*
*Completed: 2026-03-27*
