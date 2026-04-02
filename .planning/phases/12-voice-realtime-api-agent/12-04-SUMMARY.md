---
phase: 12-voice-realtime-api-agent
plan: 04
subsystem: testing
tags: [pytest, voice-live, hcp-profile, agent-sync, seed-data, per-hcp]

# Dependency graph
requires:
  - phase: 12-01
    provides: "13 voice/avatar columns on HcpProfile, token broker per-HCP wiring"
  - phase: 12-02
    provides: "Frontend tabbed HCP editor with VoiceAvatarTab"
  - phase: 12-03
    provides: "VoiceSession auto-mode + fallback chain + per-HCP config"
provides:
  - "23 backend tests verifying per-HCP token broker, HCP CRUD voice fields, agent instruction override"
  - "5 HCP profiles with distinct voice/avatar digital persona configurations in seed data"
  - "HcpProfileOut API response model with 13 voice/avatar fields (bug fix)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mock-based per-HCP token broker testing with config_service + hcp_profile_service patches"

key-files:
  created:
    - "backend/tests/test_voice_live_per_hcp.py"
    - "backend/tests/test_hcp_profile_voice.py"
  modified:
    - "backend/tests/test_agent_sync_service.py"
    - "backend/scripts/seed_phase2.py"
    - "backend/app/api/hcp_profiles.py"

key-decisions:
  - "Added voice/avatar fields to HcpProfileOut API response model (was missing, Rule 1 bug fix)"
  - "Voice live per-HCP tests use service-level mock patching to avoid DB/config dependency"
  - "Seed data gives each HCP a distinct voice+avatar combination for demo variety"

patterns-established:
  - "Per-HCP token broker test pattern: mock config_service + hcp_profile_service to verify field sourcing"

requirements-completed: [VOICE-12-01, VOICE-12-02, VOICE-12-03, VOICE-12-04, VOICE-12-05, VOICE-12-06]

# Metrics
duration: 10min
completed: 2026-04-02
---

# Phase 12 Plan 04: Backend Tests and Seed Data Summary

**23 backend tests for per-HCP voice/avatar token broker, HCP CRUD with voice fields, agent instruction override + 5 HCP profiles with distinct digital persona configs in seed data**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-02T09:08:54Z
- **Completed:** 2026-04-02T09:19:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- 8 tests for per-HCP voice/avatar token broker settings (per-HCP sourcing, defaults fallback, exception handling, agent mode)
- 10 tests for HCP profile CRUD with voice/avatar fields (schema validation, API create/update/get with D-04 defaults)
- 5 tests for agent instruction override D-02 logic (override, empty, whitespace, missing key, whitespace stripping)
- 5 HCP seed profiles with distinct voice_name, avatar_character, avatar_style, turn_detection_type, and recognition_language
- Fixed HcpProfileOut missing 13 voice/avatar fields in API router response model

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend tests for per-HCP token broker, HCP CRUD voice fields, agent instruction override** - `b6d19fe` (test)
2. **Task 2: Seed data update with per-HCP digital persona configurations** - `ae68620` (feat)

## Files Created/Modified
- `backend/tests/test_voice_live_per_hcp.py` - 8 tests for per-HCP voice/avatar token broker settings
- `backend/tests/test_hcp_profile_voice.py` - 10 tests for HCP profile CRUD with voice/avatar fields
- `backend/tests/test_agent_sync_service.py` - 5 new tests for agent instruction override (D-02)
- `backend/scripts/seed_phase2.py` - Added 13 voice/avatar fields to all 5 HCP profiles
- `backend/app/api/hcp_profiles.py` - Added 13 voice/avatar fields to HcpProfileOut response model

## Decisions Made
- Used service-level mock patching (config_service + hcp_profile_service) for token broker tests rather than full ASGI integration to keep tests fast and focused
- Each seed HCP profile gets a distinct voice+avatar combination: 4 different voice_name values, 4 different avatar_character values, 2 different avatar_style values, 2 different turn_detection_type values
- Added voice/avatar fields to HcpProfileOut (the API router's local Pydantic model) since it was missing them despite the HcpProfile ORM model and HcpProfileResponse schema both having them

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] HcpProfileOut missing 13 voice/avatar fields**
- **Found during:** Task 1 (test creation)
- **Issue:** The HcpProfileOut Pydantic model in `backend/app/api/hcp_profiles.py` did not include the 13 voice/avatar fields that were added to the ORM model and schemas in Phase 12-01. API endpoints would silently drop these fields from responses.
- **Fix:** Added all 13 voice/avatar fields to HcpProfileOut with matching defaults
- **Files modified:** `backend/app/api/hcp_profiles.py`
- **Verification:** HCP profile API tests confirm voice fields are returned in create/update/get responses
- **Committed in:** b6d19fe (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for voice/avatar fields to be visible in API responses. Without this, the frontend admin UI would not receive per-HCP voice/avatar settings.

## Issues Encountered
- Frontend `npm run build` (tsc -b) fails on pre-existing test file type errors in `voice-session.test.tsx` where `mode` prop was removed from VoiceSessionProps in 12-03. Vite production build succeeds. This is out-of-scope (pre-existing from Phase 12-03, not caused by 12-04 changes).

## Known Stubs
None - all test files contain real assertions and the seed data contains real values.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 12 is fully complete: per-HCP digital persona (12-01), frontend admin UI (12-02), auto-mode + fallback (12-03), tests + seed data (12-04)
- All 1019 backend tests pass, ruff check clean
- Frontend Vite build succeeds
- Pre-existing tsc test file errors in voice-session.test.tsx should be addressed in a future quick fix

---
*Phase: 12-voice-realtime-api-agent*
*Completed: 2026-04-02*
