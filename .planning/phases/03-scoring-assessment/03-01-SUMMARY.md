---
phase: 03-scoring-assessment
plan: 01
subsystem: api
tags: [fastapi, crud, sse, scoring, rubric, pydantic, sqlalchemy]

# Dependency graph
requires:
  - phase: 02-f2f-coaching
    provides: "Session lifecycle, scoring_service, SSE streaming, session_service"
provides:
  - "Rubric CRUD service + API (admin-only)"
  - "Session report GET endpoint"
  - "Session suggestions GET endpoint"
  - "SSE hint events from suggestion_service"
  - "Score history endpoint with dimension trends"
  - "Scoring service rubric integration"
affects: [03-scoring-assessment, 04-dashboards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin-only CRUD router via require_role('admin') dependency"
    - "JSON dimension serialization in rubric_service with db.flush()"
    - "Score history with trend calculation (improvement_pct per dimension)"
    - "SSE suggestion wiring: hint events emitted after DONE in event_generator"

key-files:
  created:
    - backend/app/services/rubric_service.py
    - backend/app/api/rubrics.py
    - backend/tests/test_rubric_service.py
    - backend/tests/test_rubrics_api.py
    - backend/tests/test_report_api.py
    - backend/tests/test_suggestion_wiring.py
    - backend/tests/test_scoring_history.py
  modified:
    - backend/app/services/scoring_service.py
    - backend/app/api/sessions.py
    - backend/app/api/scoring.py
    - backend/app/api/__init__.py
    - backend/app/main.py
    - backend/app/models/__init__.py

key-decisions:
  - "Rubric service uses db.flush() not db.commit() for session middleware compatibility"
  - "Rubric update adds db.refresh() after flush to prevent MissingGreenlet on serialization"
  - "Score history computes improvement_pct by comparing adjacent scored sessions per dimension"
  - "SSE hint events injected after key_messages detection and before done event"
  - "SuggestionType changed from str+Enum to StrEnum per ruff UP042"

patterns-established:
  - "Admin CRUD router: require_role('admin') on all endpoints, 201 on POST, 204 on DELETE"
  - "Score trend: compare dimension scores of consecutive sessions ordered by completed_at desc"
  - "SSE wiring: inject coaching hints from suggestion_service in event_generator DONE handler"

requirements-completed: [SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, COACH-08, COACH-09]

# Metrics
duration: 9min
completed: 2026-03-24
---

# Phase 03 Plan 01: Scoring API Wiring Summary

**Rubric CRUD with admin access, session report/suggestions endpoints, SSE coaching hints, and score history with dimension trends**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-24T22:17:18Z
- **Completed:** 2026-03-24T22:26:18Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- Rubric CRUD service with 7 functions + admin-only API router (5 endpoints)
- Session report and suggestions GET endpoints wired to existing services
- SSE event_generator enhanced to emit "hint" events from suggestion_service after HCP response
- Score history endpoint with per-dimension trend calculation (improvement_pct)
- Scoring service integrates rubric dimensions when default rubric exists for scenario type
- 34 tests pass across 5 new test files

## Task Commits

Each task was committed atomically:

1. **Task 1: rubric_service CRUD + scoring integration + score history** (TDD)
   - RED: `a861e51` (test: add failing tests for rubric CRUD, score history)
   - GREEN: `8e07e96` (feat: rubric CRUD service + scoring rubric integration + score history)
2. **Task 2: API endpoints + SSE wiring** (TDD)
   - RED: `9d05eda` (test: add failing tests for rubric API, report, suggestion endpoints)
   - GREEN: `b15c936` (feat: wire rubric CRUD + report/suggestions endpoints + SSE hints + score history API)

## Files Created/Modified
- `backend/app/services/rubric_service.py` - Full CRUD + get_default_rubric with JSON dimension serialization
- `backend/app/services/scoring_service.py` - Added rubric weight integration and get_score_history with trends
- `backend/app/api/rubrics.py` - Admin-only CRUD router (POST 201, GET, PUT, DELETE 204)
- `backend/app/api/sessions.py` - Added /report, /suggestions endpoints and SSE hint wiring
- `backend/app/api/scoring.py` - Added GET /history endpoint with limit parameter
- `backend/app/api/__init__.py` - Registered rubrics_router
- `backend/app/main.py` - Included rubrics_router
- `backend/app/models/__init__.py` - Added ScoringRubric to model exports
- `backend/app/models/scoring_rubric.py` - ScoringRubric ORM model (from parallel agent)
- `backend/app/schemas/scoring_rubric.py` - Rubric request/response schemas (from parallel agent)
- `backend/app/schemas/report.py` - Session report schemas (from parallel agent)
- `backend/app/schemas/suggestion.py` - Suggestion schemas, fixed StrEnum (from parallel agent)
- `backend/app/services/report_service.py` - Report generation service (from parallel agent)
- `backend/app/services/suggestion_service.py` - Suggestion generation service (from parallel agent)
- `backend/tests/test_rubric_service.py` - 13 unit tests for rubric CRUD
- `backend/tests/test_rubrics_api.py` - 11 integration tests for rubric API endpoints
- `backend/tests/test_report_api.py` - 2 tests for session report endpoint
- `backend/tests/test_suggestion_wiring.py` - 2 tests for suggestion endpoint
- `backend/tests/test_scoring_history.py` - 6 tests for score history with trends

## Decisions Made
- Rubric service uses db.flush() (not db.commit()) per project convention for session middleware compatibility
- Added db.refresh() after rubric update flush to prevent MissingGreenlet when serializing response
- Score history computes improvement_pct by comparing each session's dimension scores with the previous session
- SSE hint events are injected between key_messages and done events in the event_generator
- Changed SuggestionType from str+Enum to StrEnum per ruff UP042 rule

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Copied dependency files from parallel agent worktree**
- **Found during:** Task 1 setup
- **Issue:** scoring_rubric model, schemas (report, scoring_rubric, suggestion), services (report_service, suggestion_service), and alembic migration were created by a parallel agent but not yet committed to the shared branch
- **Fix:** Copied files from main repo working directory to this worktree
- **Files copied:** 6 files + 1 migration
- **Verification:** All imports resolve, tests pass

**2. [Rule 1 - Bug] Fixed MissingGreenlet on rubric update response serialization**
- **Found during:** Task 2 (rubric API tests)
- **Issue:** update_rubric returned rubric without refreshing, causing SQLAlchemy lazy-load error on updated_at when FastAPI serialized the response
- **Fix:** Added `await db.refresh(rubric)` after flush in rubric_service.update_rubric
- **Files modified:** backend/app/services/rubric_service.py
- **Verification:** test_updates_rubric_fields passes

**3. [Rule 1 - Bug] Fixed SuggestionType enum inheritance**
- **Found during:** Task 2 (ruff check)
- **Issue:** SuggestionType(str, Enum) flagged by ruff UP042 as deprecated pattern
- **Fix:** Changed to SuggestionType(StrEnum) using enum.StrEnum
- **Files modified:** backend/app/schemas/suggestion.py
- **Verification:** ruff check passes

**4. [Rule 1 - Bug] Fixed report test seed function missing commit**
- **Found during:** Task 2 (test_report_api)
- **Issue:** score_session() uses flush internally but seed function didn't commit after, causing scored status to not persist for HTTP endpoint
- **Fix:** Added `await db.commit()` after `score_session()` in test seed function
- **Files modified:** backend/tests/test_report_api.py
- **Verification:** test_returns_report_for_scored_session passes

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 blocking)
**Impact on plan:** All fixes were necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## Known Stubs
None -- all endpoints wire to real service implementations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All scoring API endpoints are operational and tested
- Rubric CRUD ready for admin UI integration in dashboards phase
- Score history with trends ready for frontend dashboard consumption
- SSE hints wired for real-time coaching feedback

---
*Phase: 03-scoring-assessment*
*Completed: 2026-03-24*
