---
phase: 12-voice-realtime-api-agent
plan: 01
subsystem: api
tags: [voice-live, hcp-profile, alembic, pydantic, sqlalchemy, avatar, digital-persona]

# Dependency graph
requires:
  - phase: 11-hcp-profile-agent-integration
    provides: HCP profile model with agent_id/agent_sync fields, agent_sync_service
provides:
  - 13 voice/avatar/conversation columns on hcp_profiles table
  - Per-HCP digital persona configuration via extended Pydantic schemas
  - Token broker per-HCP wiring returning all voice/avatar settings
  - API endpoint hcp_profile_id query parameter
  - Agent instructions override (D-02) in build_agent_instructions
affects: [12-02, 12-03, 12-04, frontend voice config UI]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-HCP digital persona configuration, token broker per-profile settings sourcing]

key-files:
  created:
    - backend/alembic/versions/i12b_add_voice_avatar_fields_to_hcp_profile.py
  modified:
    - backend/app/models/hcp_profile.py
    - backend/app/schemas/hcp_profile.py
    - backend/app/schemas/voice_live.py
    - backend/app/services/voice_live_service.py
    - backend/app/services/agent_sync_service.py
    - backend/app/api/voice_live.py

key-decisions:
  - "server_default on all 13 new columns for SQLite compat with existing rows"
  - "agent_instructions_override checked first in build_agent_instructions (D-02 priority)"
  - "Token broker falls back to global defaults when no hcp_profile_id or on exception"

patterns-established:
  - "Per-HCP digital persona: voice/avatar/conversation params stored directly on HcpProfile model"
  - "Token broker per-profile sourcing: lazy import hcp_profile_service, fallback to defaults on error"

requirements-completed: [VOICE-12-01, VOICE-12-02]

# Metrics
duration: 3min
completed: 2026-04-02
---

# Phase 12 Plan 01: Per-HCP Digital Persona Summary

**Alembic migration adding 13 voice/avatar/conversation columns to hcp_profiles, extended ORM/Pydantic schemas, token broker per-HCP wiring, and agent instructions override (D-02)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-02T08:43:24Z
- **Completed:** 2026-04-02T08:46:50Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Alembic migration i12b adds 13 columns (voice_name, voice_type, voice_temperature, voice_custom, avatar_character, avatar_style, avatar_customized, turn_detection_type, noise_suppression, echo_cancellation, eou_detection, recognition_language, agent_instructions_override) with server_default on all
- HcpProfile ORM model, HcpProfileCreate/Update/Response, and VoiceLiveTokenResponse schemas all extended with per-HCP voice/avatar fields
- Token broker sources all settings from HCP profile when hcp_profile_id provided, with robust fallback to global defaults
- API /token endpoint accepts hcp_profile_id query parameter for per-HCP configuration
- Agent instructions override (D-02): non-empty override text returned as-is, bypassing template

## Task Commits

Each task was committed atomically:

1. **Task 1: Alembic migration + ORM model + Pydantic schema extension** - `296fbd4` (feat)
2. **Task 2: Token broker per-HCP wiring + API endpoint + agent instructions override** - `9bad1e1` (feat)

## Files Created/Modified
- `backend/alembic/versions/i12b_add_voice_avatar_fields_to_hcp_profile.py` - Migration adding 13 voice/avatar/conversation columns
- `backend/app/models/hcp_profile.py` - ORM model with 13 new mapped_columns (Float import added)
- `backend/app/schemas/hcp_profile.py` - HcpProfileCreate/Update/Response with voice/avatar fields
- `backend/app/schemas/voice_live.py` - VoiceLiveTokenResponse with per-HCP D-08 fields
- `backend/app/services/voice_live_service.py` - Token broker per-HCP settings sourcing
- `backend/app/services/agent_sync_service.py` - build_agent_instructions override check (D-02)
- `backend/app/api/voice_live.py` - /token endpoint with hcp_profile_id query param

## Decisions Made
- server_default on all 13 new columns for SQLite compatibility with existing rows (follows project convention)
- agent_instructions_override checked first in build_agent_instructions, returning override text as-is when non-empty (D-02 priority)
- Token broker falls back to global defaults when no hcp_profile_id provided or when profile lookup fails (robust error handling)
- Whitespace-only override treated as empty (template-based instructions generated)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all fields are wired to real data sources (HCP profile model columns with server defaults).

## Next Phase Readiness
- Backend fully supports per-HCP voice/avatar configuration
- Plans 12-02/03/04 can build on these schemas and service wiring
- Frontend can read all per-HCP fields from VoiceLiveTokenResponse to auto-configure WebSocket and Avatar connections

## Self-Check: PASSED

---
*Phase: 12-voice-realtime-api-agent*
*Completed: 2026-04-02*
