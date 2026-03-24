---
phase: 02-f2f-text-coaching-and-scoring
plan: 03
subsystem: api
tags: [fastapi, crud, hcp-profiles, scenarios, seed-data, pydantic, sqlalchemy]

# Dependency graph
requires:
  - phase: 02-01
    provides: ORM models (HcpProfile, Scenario) and Pydantic schemas (Create/Update/Response)
provides:
  - HCP profile CRUD API router (admin-only)
  - Scenario CRUD API router (admin-only + /active for users)
  - HCP profile service layer with full CRUD
  - Scenario service layer with full CRUD and clone
  - Seed script with 3 demo HCP profiles and 2 training scenarios
affects: [02-04, 02-05, 02-06, 02-07, 02-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Service layer pattern for CRUD (async functions, JSON field serialization)
    - Pydantic field_validator for JSON text -> list parsing in response models
    - Idempotent seed scripts with name-based dedup

key-files:
  created:
    - backend/app/services/hcp_profile_service.py
    - backend/app/services/scenario_service.py
    - backend/app/api/hcp_profiles.py
    - backend/app/api/scenarios.py
    - backend/scripts/seed_phase2.py
  modified:
    - backend/app/api/__init__.py
    - backend/app/main.py

key-decisions:
  - "Used local response models (HcpProfileOut, ScenarioOut) with field_validator for JSON list parsing instead of modifying 02-01 response schemas"
  - "Seed script uses name-based dedup for idempotency across re-runs"
  - "Clone scenario resets status to draft and appends (Copy) suffix"

patterns-established:
  - "Service layer functions use db.flush() instead of db.commit() to let the session middleware handle transactions"
  - "Router-local Pydantic Out models extend base schemas with JSON field validators for API serialization"
  - "Static routes (/active) placed before parameterized routes (/{id}) per Gotcha #3"

requirements-completed: [HCP-01, HCP-02, HCP-03, HCP-04, HCP-05, SCORE-05]

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 02 Plan 03: HCP Profile & Scenario CRUD API Summary

**Admin CRUD API for HCP profiles and scenarios with service layers, router registration, and demo seed data**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-24T11:43:16Z
- **Completed:** 2026-03-24T11:48:30Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- HCP profile and scenario service layers with full async CRUD operations, search/filter, JSON serialization, and clone
- Two API routers registered in FastAPI app with admin-only access (except /active for authenticated users)
- Idempotent seed script creating 3 demo HCP profiles (oncologist, cardiologist, neurologist) and 2 training scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Create HCP profile and scenario service layers** - `4224acc` (feat)
2. **Task 2: Create API routers, register in main.py, and create seed script** - `ae478b4` (feat)

## Files Created/Modified
- `backend/app/services/hcp_profile_service.py` - Async CRUD service for HCP profiles with search/filter
- `backend/app/services/scenario_service.py` - Async CRUD service for scenarios with clone and selectinload
- `backend/app/api/hcp_profiles.py` - Admin-only CRUD router with JSON list parsing in response
- `backend/app/api/scenarios.py` - Admin CRUD router plus /active endpoint for users, clone endpoint
- `backend/app/api/__init__.py` - Added hcp_profiles_router and scenarios_router exports
- `backend/app/main.py` - Registered new routers with api_prefix
- `backend/scripts/seed_phase2.py` - Seed script with 3 HCP profiles and 2 scenarios

## Decisions Made
- Used local Pydantic Out models (HcpProfileOut, ScenarioOut) with field_validator to parse JSON text columns into Python lists, rather than modifying the 02-01 response schemas which store them as raw strings
- Seed script resolves HCP profile references by name to support dynamic ID assignment
- Service functions use db.flush() instead of db.commit() to work with the session middleware's commit/rollback pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Worktree was based on older commit without 02-01 models/schemas; resolved by merging latest main (fast-forward)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- HCP profile and scenario CRUD APIs fully operational for admin management
- /active endpoint available for user-facing scenario selection
- Seed data ready for demo and integration testing in subsequent plans
- Service layers ready for use by coaching session management (02-04, 02-05)

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (4224acc, ae478b4) verified in git log.

---
*Phase: 02-f2f-text-coaching-and-scoring*
*Completed: 2026-03-24*
