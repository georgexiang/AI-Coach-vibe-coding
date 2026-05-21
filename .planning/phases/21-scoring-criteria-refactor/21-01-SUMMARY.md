---
phase: 21-scoring-criteria-refactor
plan: 01
subsystem: api
tags: [sqlalchemy, alembic, scoring, rubric, pydantic, fastapi]

# Dependency graph
requires:
  - phase: 02
    provides: Scenario model with weight_* columns, scoring engine, scoring service
  - phase: 03
    provides: ScoringRubric model and rubric_service CRUD
provides:
  - Scenario model with rubric_id NOT NULL FK (weight_* columns removed)
  - Alembic data migration preserving existing scenario weights as rubric records
  - Dynamic scoring engine reading dimensions from rubric (no hardcoded dim_names)
  - Dynamic mock score generator looping over arbitrary rubric dimensions
  - Analytics recommendation using rubric-based dimension lookup
  - resolve_rubric_dimensions() direct lookup (no fallback chain per D-05)
affects: [21-02, 21-03, frontend-scoring, frontend-scenario-editor]

# Tech tracking
tech-stack:
  added: []
  patterns: [rubric-driven scoring, dynamic dimension loop, data-migrating alembic]

key-files:
  created:
    - backend/alembic/versions/h21a_add_rubric_id_remove_weight_columns.py
  modified:
    - backend/app/models/scenario.py
    - backend/app/schemas/scenario.py
    - backend/app/services/scoring_engine.py
    - backend/app/services/scoring_service.py
    - backend/app/services/analytics_service.py
    - backend/app/services/scenario_service.py
    - backend/app/startup_seed.py
    - backend/scripts/seed_phase2.py
    - backend/app/api/scenarios.py

key-decisions:
  - "rubric_id is NOT NULL FK on Scenario -- every scenario must have an explicit rubric (D-05)"
  - "No fallback chain in scoring path -- resolve_rubric_dimensions does direct lookup only"
  - "Migration creates rubric per unique weight combo, grouping scenarios with identical weights"
  - "Admin user ID used for created_by in migrated rubrics (falls back to 'system' string)"

patterns-established:
  - "Rubric-driven scoring: all scoring paths read dimensions from rubric via resolve_rubric_dimensions()"
  - "Dynamic mock scorer: _generate_mock_scores loops over rubric_dimensions list, not hardcoded blocks"
  - "Data-migrating Alembic: 3-step pattern (add nullable, migrate data, enforce NOT NULL + drop old)"

requirements-completed: [SCORE-01, SCORE-02, SCORE-04, SCORE-05]

# Metrics
duration: 9min
completed: 2026-04-27
---

# Phase 21 Plan 01: Backend Scoring Refactor Summary

**Scenario model gains rubric_id NOT NULL FK, scoring engine/service/analytics refactored to read all dimensions dynamically from ScoringRubric, Alembic data migration preserves existing weight configurations as rubric records**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-27T14:57:07Z
- **Completed:** 2026-04-27T15:06:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Scenario model uses rubric_id NOT NULL FK instead of 5 weight_* columns, with ORM relationship to ScoringRubric
- Alembic migration h21a includes 3-step data migration: add nullable rubric_id, create rubric per unique weight combo and link scenarios, enforce NOT NULL and drop weight columns
- Scoring engine builds prompt dynamically from rubric dimensions via build_dimensions_instructions()
- Mock score generator handles arbitrary dimension counts via single loop over rubric_dimensions
- Analytics recommendation service uses rubric-based dimension weight lookup instead of Scenario column access
- Seed data creates scenarios with explicit rubric_id references

## Task Commits

Each task was committed atomically:

1. **Task 1: Scenario model + schema refactor + Alembic migration** - `867370a` (feat)
2. **Task 2: Scoring engine + service + analytics + seed data refactor** - `c8f1682` (feat)

## Files Created/Modified
- `backend/alembic/versions/h21a_add_rubric_id_remove_weight_columns.py` - 3-step data migration with weight-to-rubric conversion
- `backend/app/models/scenario.py` - rubric_id NOT NULL FK, weight_* columns and get_scoring_weights() removed
- `backend/app/schemas/scenario.py` - ScenarioCreate/Update/Response with rubric_id, weight fields removed
- `backend/app/services/scoring_engine.py` - build_dimensions_instructions(), rubric_dimensions param on build_scoring_prompt and score_with_llm
- `backend/app/services/scoring_service.py` - resolve_rubric_dimensions(), dynamic _generate_mock_scores()
- `backend/app/services/analytics_service.py` - rubric-based get_recommended_scenarios() replacing weight_map column lookup
- `backend/app/services/scenario_service.py` - clone_scenario uses rubric_id instead of weight_* fields
- `backend/app/startup_seed.py` - scenario creation includes rubric_id from default rubric
- `backend/scripts/seed_phase2.py` - SEED_SCENARIOS without weight_* fields, seed function resolves default rubric
- `backend/app/api/scenarios.py` - ScenarioOut uses rubric_id instead of weight_* fields

## Decisions Made
- rubric_id is NOT NULL FK on Scenario per D-05 -- no fallback chain needed in scoring path
- Migration groups scenarios by unique weight combination, creating one rubric per combo to avoid duplicates
- Admin user ID from DB used for created_by on migrated rubrics; falls back to "system" string literal
- get_default_rubric() retained in rubric_service.py as UI convenience only, not used in scoring path

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed scenarios API router ScenarioOut model**
- **Found during:** Task 2 (service refactor)
- **Issue:** backend/app/api/scenarios.py had a local ScenarioOut Pydantic model still referencing weight_* fields that no longer exist on the Scenario model
- **Fix:** Replaced 5 weight_* fields with rubric_id: str in ScenarioOut
- **Files modified:** backend/app/api/scenarios.py
- **Verification:** ruff check passes, model aligns with updated Scenario ORM
- **Committed in:** c8f1682

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for API correctness -- ScenarioOut must match the updated Scenario model. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend scoring refactor complete -- all scoring paths read from rubric
- Ready for Plan 02 (frontend scoring weights dynamic refactor) and Plan 03 (tests)
- Frontend scenario editor will need rubric_id selector (covered in Plan 02)

## Self-Check: PASSED

All 10 files verified present. Both task commits (867370a, c8f1682) verified in git log.

---
*Phase: 21-scoring-criteria-refactor*
*Completed: 2026-04-27*
