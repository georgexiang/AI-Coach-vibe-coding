---
phase: 19-ai-coach-skill-module
plan: 03
subsystem: api, services
tags: [quality-gates, validation, ai-evaluation, content-hash, staleness-detection]

# Dependency graph
requires: [19-01]
provides:
  - L1 structure validation service with configurable rule thresholds
  - L2 AI quality evaluation service with 6-dimension scoring
  - Quality gate API endpoints (check-structure, evaluate-quality, evaluation)
  - Transactional publish gate with staleness detection
affects: [19-04, 19-05, 19-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [content-hash staleness detection, durable background task, configurable rule engine]

key-files:
  created:
    - backend/app/services/skill_validation_service.py
    - backend/app/services/skill_evaluation_service.py
  modified:
    - backend/app/api/skills.py
    - backend/app/services/skill_service.py

key-decisions:
  - "Content hash (SHA256[:16]) binds evaluations to specific content version for staleness detection"
  - "L1 thresholds as module-level constants for per-locale configurability"
  - "L2 uses durable background task pattern (asyncio.create_task + own DB session)"
  - "Transactional publish gate: L1 PASS + L2 >= 50 + not stale"
  - "L2 average of 6 equal-weight dimensions (not weighted) for simplicity"

patterns-established:
  - "Content hash staleness: _compute_content_hash() + is_evaluation_stale() pattern"
  - "Background evaluation: asyncio.create_task + AsyncSessionLocal for durable async work"

requirements-completed: [D-10, D-11, D-12, D-13]

# Metrics
duration: 7min
completed: 2026-04-11
---

# Phase 19 Plan 03: L1/L2 Quality Gates Summary

**Two-layer quality gate system: L1 instant rule-based structure validation with configurable thresholds, L2 async AI-powered 6-dimension evaluation bound to content hash, transactional publish gate with staleness detection**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-11T07:12:02Z
- **Completed:** 2026-04-11T07:19:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created L1 structure validation service with configurable thresholds (MIN_SOP_STEPS=3, MIN_ASSESSMENT_ITEMS=2, etc.) and bilingual keyword matching
- Created L2 AI quality evaluation service evaluating 6 dimensions: sop_completeness, assessment_coverage, knowledge_accuracy, difficulty_calibration, conversation_logic, executability
- Added content hash (SHA256) binding so evaluations are tied to specific content versions
- Added 3 quality gate API endpoints: POST check-structure (instant), POST evaluate-quality (async 202), GET evaluation (combined results + staleness)
- Updated publish_skill() with transactional staleness check -- rejects publish if content changed since last evaluation

## Task Commits

Each task was committed atomically:

1. **Task 1: L1 structure validation service** - `b1a47a8` (feat)
2. **Task 2: L2 AI evaluation + quality gate endpoints + transactional publish gate** - `f48cd3c` (feat)

## Files Created/Modified
- `backend/app/services/skill_validation_service.py` - L1 rule engine: SOP steps, required stages, assessment criteria, knowledge points, basic info checks with configurable thresholds
- `backend/app/services/skill_evaluation_service.py` - L2 AI evaluation: 6-dimension scoring via Azure OpenAI, content hash binding, staleness detection
- `backend/app/api/skills.py` - Added check-structure, evaluate-quality, evaluation endpoints (3 new routes)
- `backend/app/services/skill_service.py` - Added is_evaluation_stale() transactional check in publish_skill()

## Decisions Made
- Used SHA256[:16] content hash for staleness detection -- short enough to store, collision-resistant enough for version tracking
- L1 thresholds are module-level constants (MIN_SOP_STEPS, MIN_ASSESSMENT_ITEMS, etc.) that can be adjusted per locale/product later without code changes
- L2 evaluation uses durable background task pattern (asyncio.create_task + own AsyncSessionLocal session) to avoid blocking the request and handle failures gracefully
- L2 dimensions are equal-weighted (average) rather than configurable weights -- simpler and sufficient for skill content quality assessment
- Transactional publish gate checks staleness within the same transaction as other quality checks to prevent race conditions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Ruff E501 line-length violations in the evaluation prompt string -- resolved by converting triple-quoted string to parenthesized string concatenation
- Ruff UP017 warning for `timezone.utc` -- resolved by using `datetime.UTC` alias (Python 3.11+)

## User Setup Required
None - no external service configuration required. L2 evaluation gracefully falls back when Azure OpenAI is not configured.

## Next Phase Readiness
- Quality gate services are complete and wired into the API
- Plan 04 (Skill Hub frontend) can display quality scores and staleness indicators
- Plan 05 (SOP editor) can trigger L1 checks inline
- The is_evaluation_stale() function is ready for frontend staleness warnings

## Self-Check: PASSED

---
*Phase: 19-ai-coach-skill-module*
*Completed: 2026-04-11*
