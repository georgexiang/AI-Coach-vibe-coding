---
phase: 08-voice-avatar-demo-integration
plan: 04
subsystem: api, ui
tags: [fastapi, react, feature-flags, session-mode, voice-live, literal-type, pydantic, i18n]

# Dependency graph
requires:
  - phase: 08-voice-avatar-demo-integration
    provides: Voice session page components (plans 01-03), voice route, ConfigContext
provides:
  - Voice tab in scenario selection page (gated by voice_live_enabled feature flag)
  - Session mode passed end-to-end from frontend to backend database
  - Backend Literal type validation for session mode (text/voice/avatar)
  - Backend feature flag enforcement (409 for voice/avatar when disabled)
  - voice_live_enabled exposed in feature flags API
affects: [08-05-tests, voice-session-flow, config-api-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Literal type for enum-like validation in Pydantic schemas"
    - "Server-side feature flag enforcement with AppException(409)"
    - "Feature flag gated UI tabs with safe defaultValue fallback"
    - "Per-tab handler pattern (handleStartTraining/Conference/VoiceSession)"

key-files:
  created: []
  modified:
    - backend/app/schemas/session.py
    - backend/app/services/session_service.py
    - backend/app/api/sessions.py
    - backend/app/api/config.py
    - frontend/src/types/config.ts
    - frontend/src/contexts/config-context.tsx
    - frontend/src/api/sessions.ts
    - frontend/src/hooks/use-session.ts
    - frontend/src/pages/user/training.tsx
    - frontend/public/locales/en-US/coach.json
    - frontend/public/locales/zh-CN/coach.json

key-decisions:
  - "Used Literal type instead of custom validator for mode validation -- Pydantic auto-returns 422"
  - "Feature flag enforcement returns 409 VOICE_MODE_DISABLED with descriptive message"
  - "Tabs defaultValue=f2f ensures safe config load behavior (no tab flicker)"
  - "Per-tab onStart handlers for separate navigation targets (session/conference/voice)"
  - "Voice mode auto-selects avatar vs voice based on avatar_enabled config"

patterns-established:
  - "Literal type for strict enum validation in Pydantic schemas"
  - "Feature flag gated TabsTrigger with conditional rendering"

requirements-completed: [COACH-04, COACH-05, COACH-07, EXT-04, PLAT-05]

# Metrics
duration: 9min
completed: 2026-03-27
---

# Phase 08 Plan 04: Voice Session Entry Flow Summary

**End-to-end voice session wiring: Voice tab in scenario selection (feature flag gated), Literal mode validation, server-side feature flag enforcement, session mode passed through full stack**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-27T22:10:31Z
- **Completed:** 2026-03-27T22:19:28Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Backend validates session mode via Literal["text", "voice", "avatar"] type, automatically returning 422 for invalid values
- Backend enforces feature flag server-side: rejects voice/avatar modes with 409 when voice_live_enabled is false
- voice_live_enabled exposed in feature flags API for frontend consumption
- Voice tab conditionally appears in scenario selection when voice_live_enabled is true
- Session creation passes mode through full stack: frontend API -> backend API -> session service -> database
- Separate handlers per tab: F2F navigates to /session, Conference to /conference, Voice to /voice
- i18n keys added for Voice tab in both en-US and zh-CN

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend mode validation, feature flag enforcement, voice_live_enabled exposure** - `3e2db4f` (feat)
2. **Task 2: Frontend session mode wiring, Voice tab, i18n keys** - `b8bb3b0` (feat)

## Files Created/Modified
- `backend/app/schemas/session.py` - Added Literal type import, changed mode from str to Literal["text", "voice", "avatar"]
- `backend/app/services/session_service.py` - Added mode parameter to create_session, passes to CoachingSession constructor
- `backend/app/api/sessions.py` - Added feature flag enforcement (409 for voice/avatar when disabled), passes mode to service
- `backend/app/api/config.py` - Added voice_live_enabled to FeatureFlags model and API response
- `frontend/src/types/config.ts` - Added voice_live_enabled to FeatureFlags interface
- `frontend/src/contexts/config-context.tsx` - Added voice_live_enabled: false to defaultFlags
- `frontend/src/api/sessions.ts` - Added mode parameter to createSession function
- `frontend/src/hooks/use-session.ts` - Changed useCreateSession mutationFn to accept {scenarioId, mode} object
- `frontend/src/pages/user/training.tsx` - Added Voice tab, useConfig hook, per-tab handlers
- `frontend/public/locales/en-US/coach.json` - Added tabVoice: "Voice"
- `frontend/public/locales/zh-CN/coach.json` - Added tabVoice: "语音"

## Decisions Made
- Used Literal type for mode validation instead of custom Pydantic validator -- cleaner, Pydantic handles 422 automatically
- Feature flag enforcement returns AppException(409, "VOICE_MODE_DISABLED") matching project's structured error pattern
- Tabs defaultValue="f2f" provides safe behavior during async config load (F2F always visible)
- Voice mode auto-selects "avatar" when avatar_enabled is true, otherwise "voice"
- Updated test files alongside feature code to maintain TypeScript strict compliance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test files for new mutation API shape**
- **Found during:** Task 2 (TypeScript type check)
- **Issue:** use-session.test.tsx passed string to mutate(), but hook now expects {scenarioId, mode} object; use-config.test.tsx and training.test.tsx missing voice_live_enabled in mock data; user-pages.test.tsx missing config-context mock
- **Fix:** Updated test files to match new API: object param for mutation, voice_live_enabled in FeatureFlags mocks, added useConfig mock
- **Files modified:** frontend/src/hooks/use-session.test.tsx, frontend/src/hooks/use-config.test.tsx, frontend/src/pages/user/training.test.tsx, frontend/src/pages/user/user-pages.test.tsx
- **Verification:** npx tsc -b --noEmit exits 0
- **Committed in:** b8bb3b0 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for TypeScript strict compliance. No scope creep.

## Known Pre-existing Issues

- `npm run build` fails due to unresolvable `rt-client` import in `use-voice-live.ts` -- pre-existing from Plan 08-03, not caused by this plan's changes. TypeScript type check passes cleanly.

## Issues Encountered
None beyond the test file updates documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Voice session entry flow is fully wired end-to-end
- Ready for Plan 08-05 comprehensive tests to validate all flows
- voice_live_enabled feature flag can be toggled via backend .env or admin config

## Self-Check: PASSED

- All 11 modified files verified present on disk
- Commit 3e2db4f (Task 1) verified in git log
- Commit b8bb3b0 (Task 2) verified in git log

---
*Phase: 08-voice-avatar-demo-integration*
*Completed: 2026-03-27*
