---
phase: 11-hcp-profile-agent-integration
plan: 01
subsystem: api
tags: [hcp-profile, ai-foundry, agent-sync, alembic, httpx, rest-api]

# Dependency graph
requires:
  - phase: 09-unified-ai-foundry-config
    provides: "config_service with get_effective_key/get_effective_endpoint, parse_voice_live_mode"
provides:
  - "HcpProfile model with agent_id, agent_sync_status, agent_sync_error columns"
  - "Alembic migration g11a adding agent columns to hcp_profiles table"
  - "agent_sync_service module with instruction builder and REST API wrapper"
  - "Updated HcpProfileResponse and HcpProfileOut schemas with agent fields"
affects: [11-02-PLAN, 11-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Template-based instruction builder using str.format_map with defaultdict for safe missing keys"
    - "httpx AsyncClient with api-key header auth for AI Foundry REST API"
    - "High-level sync_agent_for_profile dispatch: create vs update based on agent_id"

key-files:
  created:
    - backend/app/services/agent_sync_service.py
    - backend/alembic/versions/g11a_add_agent_fields_to_hcp_profile.py
    - backend/tests/test_agent_sync_service.py
  modified:
    - backend/app/models/hcp_profile.py
    - backend/app/schemas/hcp_profile.py
    - backend/app/api/hcp_profiles.py

key-decisions:
  - "agent fields are read-only in API (not in Create/Update schemas) -- agent sync is automatic"
  - "server_default on all migration columns for SQLite compatibility with existing rows"
  - "communication_style_desc computed as direct (<50) vs indirect (>=50)"
  - "emotional_state_desc computed as calm and open (<30), neutral (30-69), resistant (>=70)"

patterns-established:
  - "Agent sync pattern: config_service provides endpoint/key, service builds instructions from HCP profile, REST API creates/updates agent"

requirements-completed: [HCP-01, COACH-06, COACH-07]

# Metrics
duration: 10min
completed: 2026-03-31
---

# Phase 11 Plan 01: Backend Foundation Summary

**HcpProfile agent columns + Alembic migration + agent_sync_service with instruction builder and AI Foundry REST API wrapper (create/update/delete agents via httpx)**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-31T07:43:09Z
- **Completed:** 2026-03-31T07:53:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- HcpProfile model extended with agent_id, agent_sync_status, agent_sync_error columns
- Alembic migration g11a applies cleanly on existing database with server_default for all columns
- agent_sync_service provides build_agent_instructions, create_agent, update_agent, delete_agent, sync_agent_for_profile
- Updated HcpProfileResponse and HcpProfileOut schemas expose agent fields (read-only)
- 11 comprehensive unit tests passing covering instruction builder, REST API calls, error handling, and sync dispatch

## Task Commits

Each task was committed atomically:

1. **Task 1: HcpProfile model + migration + schemas + API response model** - `6f185ec` (feat)
2. **Task 2 RED: Failing tests for agent sync service** - `193c103` (test)
3. **Task 2 GREEN: Agent sync service implementation + tests passing** - `93ca725` (feat)

## Files Created/Modified
- `backend/app/models/hcp_profile.py` - Added agent_id, agent_sync_status, agent_sync_error columns
- `backend/alembic/versions/g11a_add_agent_fields_to_hcp_profile.py` - Migration adding 3 agent columns with server_default
- `backend/app/schemas/hcp_profile.py` - HcpProfileResponse with agent fields (read-only defaults)
- `backend/app/api/hcp_profiles.py` - HcpProfileOut with agent_id, agent_sync_status, agent_sync_error
- `backend/app/services/agent_sync_service.py` - Instruction builder + AI Foundry REST API wrapper
- `backend/tests/test_agent_sync_service.py` - 11 unit tests with mocked httpx and config_service

## Decisions Made
- Agent fields are read-only in API responses (not in HcpProfileCreate/HcpProfileUpdate) because agent sync is automatic per D-02
- Used server_default on all migration columns for SQLite compatibility with existing rows (project Gotcha #1)
- communication_style_desc: "direct" if value < 50, "indirect" otherwise
- emotional_state_desc: "calm and open" (<30), "neutral" (30-69), "resistant" (>=70)
- Used str.format_map with defaultdict for safe missing-key handling in template

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Model and service layer ready for Plan 02 to wire CRUD hooks (auto-sync on create/update/delete)
- agent_sync_service exports all functions needed by Plan 02's router modifications
- Schema and API response already include agent fields, so frontend will see them immediately

## Self-Check: PASSED

All 6 files verified present. All 3 commits (6f185ec, 193c103, 93ca725) found in git log.

---
*Phase: 11-hcp-profile-agent-integration*
*Completed: 2026-03-31*
