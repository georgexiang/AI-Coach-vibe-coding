---
phase: 02-f2f-text-coaching-and-scoring
plan: 01
subsystem: database
tags: [sqlalchemy, alembic, pydantic, orm, hcp-profile, scenario, coaching-session, scoring, sse-starlette]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: User model, Base, TimestampMixin, async SQLAlchemy engine, Alembic setup
provides:
  - HcpProfile ORM model with personality/knowledge fields and to_prompt_dict()
  - Scenario ORM model with scoring weights and get_scoring_weights()
  - CoachingSession ORM model with lifecycle status tracking
  - SessionMessage ORM model for conversation history
  - SessionScore + ScoreDetail ORM models for multi-dimensional scoring
  - Pydantic v2 schemas for all CRUD operations
  - Alembic migration for 6 new tables
  - sse-starlette dependency for future streaming endpoints
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, 02-08]

# Tech tracking
tech-stack:
  added: [sse-starlette>=2.0.0]
  patterns: [model_validator for cross-field validation, JSON-in-Text columns for flexible arrays, relationship back_populates for bidirectional FK navigation]

key-files:
  created:
    - backend/app/models/hcp_profile.py
    - backend/app/models/scenario.py
    - backend/app/models/session.py
    - backend/app/models/message.py
    - backend/app/models/score.py
    - backend/app/schemas/hcp_profile.py
    - backend/app/schemas/scenario.py
    - backend/app/schemas/session.py
    - backend/app/schemas/score.py
    - backend/alembic/versions/10e15911bf3a_add_phase2_models_hcp_scenario_session_.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/schemas/__init__.py
    - backend/alembic/env.py
    - backend/pyproject.toml

key-decisions:
  - "Used model_validator(mode='after') instead of field_validator for weight sum validation -- field_validator does not fire on default values in Pydantic v2"
  - "Stored JSON arrays as Text columns (expertise_areas, objections, key_messages, strengths/weaknesses) for SQLite compatibility"
  - "ScenarioUpdate only validates weight sum when all 5 weights are provided (partial update flexibility)"

patterns-established:
  - "ORM model pattern: Base + TimestampMixin, Mapped[T] with mapped_column(), relationship with back_populates"
  - "Schema pattern: Create (required + defaults), Update (all Optional), Response (ConfigDict from_attributes=True)"
  - "Cross-field validation: model_validator(mode='after') with Self return type"

requirements-completed: [HCP-01, HCP-02, HCP-03, HCP-04, HCP-05, COACH-09, SCORE-01, SCORE-05]

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 02 Plan 01: Data Models and Schemas Summary

**6 ORM models (HcpProfile, Scenario, CoachingSession, SessionMessage, SessionScore, ScoreDetail) with Pydantic v2 schemas, Alembic migration, and sse-starlette dependency**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-24T11:33:20Z
- **Completed:** 2026-03-24T11:39:04Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Created 6 ORM models covering HCP profiles, scenarios, coaching sessions, messages, and multi-dimensional scoring
- Created 4 Pydantic v2 schema modules with Create/Update/Response patterns and weight sum validation
- Generated and applied Alembic migration creating 6 new database tables
- Added sse-starlette dependency for future SSE streaming endpoints

## Task Commits

Each task was committed atomically:

1. **Task 1: Create all Phase 2 ORM models and Pydantic schemas** - `8892e81` (feat)
2. **Task 2: Create Alembic migration, update dependencies, and update env.py** - `7366b13` (chore)

## Files Created/Modified
- `backend/app/models/hcp_profile.py` - HcpProfile ORM with personality, expertise, objections, to_prompt_dict()
- `backend/app/models/scenario.py` - Scenario ORM with scoring weights, key_messages, get_scoring_weights()
- `backend/app/models/session.py` - CoachingSession ORM with lifecycle status and relationships
- `backend/app/models/message.py` - SessionMessage ORM with role and message_index ordering
- `backend/app/models/score.py` - SessionScore + ScoreDetail ORM for multi-dimensional scoring
- `backend/app/models/__init__.py` - Updated with all 9 model re-exports
- `backend/app/schemas/hcp_profile.py` - Create/Update/Response/ListResponse schemas
- `backend/app/schemas/scenario.py` - Create/Update/Response schemas with weight validation
- `backend/app/schemas/session.py` - SessionCreate, SendMessageRequest, SessionResponse, MessageResponse
- `backend/app/schemas/score.py` - ScoreDetailResponse, SessionScoreResponse
- `backend/app/schemas/__init__.py` - Updated with all schema re-exports
- `backend/alembic/env.py` - Updated imports for all Phase 2 models
- `backend/pyproject.toml` - Added sse-starlette>=2.0.0
- `backend/alembic/versions/10e15911bf3a_...py` - Migration for 6 new tables

## Decisions Made
- Used `model_validator(mode='after')` instead of `field_validator` for weight sum validation because Pydantic v2 field validators do not fire on default values
- Stored JSON arrays as Text columns (expertise_areas, objections, key_messages, strengths/weaknesses) for SQLite compatibility
- ScenarioUpdate only validates weight sum when all 5 weights are explicitly provided to support partial updates

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed weight validator not firing on default values**
- **Found during:** Task 1 (ORM models and schemas)
- **Issue:** Plan specified `@field_validator` on `weight_scientific_info`, but Pydantic v2 field validators do not fire when a field uses its default value, allowing invalid weight sums to pass silently
- **Fix:** Changed to `@model_validator(mode='after')` which always fires after all fields are set, using `Self` return type per Pydantic v2 convention
- **Files modified:** backend/app/schemas/scenario.py
- **Verification:** Tested that ScenarioCreate(weight_key_message=50) correctly raises ValueError for sum=120
- **Committed in:** 8892e81 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for correctness. The validator was the plan's Pitfall 3 safeguard -- without this fix, invalid scoring weights would be accepted silently.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 ORM models and 4 schema modules ready for API routers (Plan 02-02, 02-03)
- Alembic migration applied, database schema up to date
- sse-starlette installed for streaming endpoints (Plan 02-04)
- Models provide helper methods (to_prompt_dict, get_scoring_weights) for service layer

## Known Stubs
None - all models and schemas are fully implemented with no placeholder data.

## Self-Check: PASSED

- All 10 created files verified present on disk
- Commit 8892e81 (Task 1) verified in git log
- Commit 7366b13 (Task 2) verified in git log

---
*Phase: 02-f2f-text-coaching-and-scoring*
*Completed: 2026-03-24*
