---
phase: 13-voice-live-instance-agent-voice-management
plan: 01
subsystem: api, database
tags: [voice-live, azure, gpt-4o, alembic, pydantic, fastapi]

# Dependency graph
requires:
  - phase: 12-voice-realtime-api-agent
    provides: "Voice/avatar fields on HcpProfile, token broker per-HCP settings"
provides:
  - "voice_live_model column on HcpProfile with gpt-4o default"
  - "VOICE_LIVE_MODELS constant with 12 models in 3 tiers"
  - "Token broker per-HCP model resolution for model-mode sessions"
  - "GET /api/v1/voice-live/models endpoint returning supported model list"
affects: [13-02, 13-03, frontend-voice-live-management]

# Tech tracking
tech-stack:
  added: []
  patterns: ["per-HCP model resolution in token broker", "static model list constant"]

key-files:
  created:
    - backend/app/services/voice_live_models.py
    - backend/alembic/versions/k14a_add_voice_live_model_to_hcp_profile.py
    - backend/tests/test_voice_live_model.py
  modified:
    - backend/app/models/hcp_profile.py
    - backend/app/schemas/hcp_profile.py
    - backend/app/schemas/voice_live.py
    - backend/app/services/voice_live_service.py
    - backend/app/api/voice_live.py
    - backend/app/api/hcp_profiles.py

key-decisions:
  - "voice_live_model defaults to gpt-4o matching Azure AI Foundry default"
  - "Agent-mode sessions return empty model string (agent has its own LLM)"
  - "Model list is a static constant, not fetched from Azure at runtime"

patterns-established:
  - "Per-HCP model resolution: profile.voice_live_model overrides config-level model"
  - "Static route ordering: /models before /token and /status"

requirements-completed: [VOICE-13-01, VOICE-13-03, VOICE-13-04]

# Metrics
duration: 3min
completed: 2026-04-03
---

# Phase 13 Plan 01: Voice Live Model Selection Summary

**Per-HCP Voice Live model selection with 12 supported models in 3 tiers, token broker per-HCP resolution, and /models list endpoint**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T08:42:34Z
- **Completed:** 2026-04-03T08:46:29Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- VOICE_LIVE_MODELS constant with 12 models organized in 3 tiers (pro/basic/lite)
- HcpProfile ORM model extended with voice_live_model column (default "gpt-4o")
- Token broker resolves per-HCP voice_live_model for model-mode sessions, empty string for agent-mode
- GET /api/v1/voice-live/models endpoint returns all 12 supported models
- 20 backend tests covering constants, ORM, schemas, and API endpoint

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend data layer -- Alembic migration, ORM model, schemas, VOICE_LIVE_MODELS constant** - `1801d0e` (feat)
2. **Task 2: Token broker per-HCP model resolution, model list API endpoint, HcpProfileOut extension, backend tests** - `1618f93` (feat)

## Files Created/Modified
- `backend/app/services/voice_live_models.py` - VOICE_LIVE_MODELS constant with 12 models in 3 tiers
- `backend/alembic/versions/k14a_add_voice_live_model_to_hcp_profile.py` - Alembic migration adding voice_live_model column
- `backend/app/models/hcp_profile.py` - Added voice_live_model: Mapped[str] column
- `backend/app/schemas/hcp_profile.py` - Extended Create/Update/Response schemas with voice_live_model
- `backend/app/schemas/voice_live.py` - Added VoiceLiveModelInfo and VoiceLiveModelsResponse schemas
- `backend/app/services/voice_live_service.py` - Token broker resolves per-HCP voice_live_model
- `backend/app/api/voice_live.py` - Added GET /models endpoint
- `backend/app/api/hcp_profiles.py` - Added voice_live_model to HcpProfileOut
- `backend/tests/test_voice_live_model.py` - 20 tests for models, schemas, and endpoint

## Decisions Made
- voice_live_model defaults to "gpt-4o" matching Azure AI Foundry default model
- Agent-mode sessions return empty model string because the agent has its own LLM configured
- Model list is a static constant (not fetched from Azure at runtime) for reliability and speed
- server_default uses sa.text("'gpt-4o'") for SQLite compatibility with existing rows

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data sources are wired and functional.

## Next Phase Readiness
- Backend model selection infrastructure complete
- Plan 13-02 (frontend Voice Live management UI) can proceed using the /models endpoint
- Plan 13-03 (Voice Live instance CRUD) can use voice_live_model in HCP profile forms

---
*Phase: 13-voice-live-instance-agent-voice-management*
*Completed: 2026-04-03*
