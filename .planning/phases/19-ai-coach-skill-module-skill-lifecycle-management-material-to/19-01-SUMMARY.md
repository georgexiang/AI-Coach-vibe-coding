---
phase: 19-ai-coach-skill-module
plan: 01
subsystem: api, database
tags: [sqlalchemy, pydantic-v2, alembic, fastapi, skill-lifecycle, state-machine]

# Dependency graph
requires: []
provides:
  - Skill, SkillVersion, SkillResource ORM models with strict lifecycle state machine
  - Pydantic v2 schemas for Skill CRUD
  - skill_service.py with CRUD, lifecycle management, file security
  - REST API routes for /api/v1/skills/* (14 endpoints)
  - Alembic migration creating 3 tables with composite indexes
  - python-pptx and pdfplumber dependencies installed
affects: [19-02, 19-03, 19-04, 19-05, 19-06, 19-07, 19-08]

# Tech tracking
tech-stack:
  added: [python-pptx, pdfplumber]
  patterns: [VALID_TRANSITIONS state machine, single-published-version invariant, file upload security]

key-files:
  created:
    - backend/app/models/skill.py
    - backend/app/schemas/skill.py
    - backend/app/services/skill_service.py
    - backend/app/api/skills.py
    - backend/alembic/versions/2e84ae1adc8d_add_skill_tables.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/api/__init__.py
    - backend/app/main.py
    - backend/alembic/env.py
    - backend/pyproject.toml

key-decisions:
  - "VALID_TRANSITIONS dict as sole state machine source of truth — no ad-hoc transition logic"
  - "is_published flag on SkillVersion for single-published-version invariant instead of status field"
  - "Removed index-rename noise from Alembic migration — kept only skill table creation"
  - "Added server_default for all columns with defaults for SQLite compatibility"
  - "File security: extension whitelist, 50MB limit, filename sanitization via PurePosixPath, 100 resource cap"

patterns-established:
  - "State machine pattern: module-level VALID_TRANSITIONS dict + validate_status_transition() function"
  - "File upload security: sanitize_filename() + validate_file_upload() + resource count limits"
  - "Skill versioning: immutable SkillVersion snapshots, single published version invariant"

requirements-completed: [D-01, D-02, D-03, D-18, D-19, D-20, D-24, D-26]

# Metrics
duration: 12min
completed: 2026-04-11
---

# Phase 19 Plan 01: Skill Data Foundation Summary

**Skill ORM models with strict 5-state lifecycle machine, versioned snapshots with single-published invariant, Pydantic v2 schemas, service layer with file security, and 14-endpoint REST API**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-11T06:55:16Z
- **Completed:** 2026-04-11T07:07:16Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Created 3 ORM models (Skill, SkillVersion, SkillResource) with strict VALID_TRANSITIONS state machine
- Built skill_service.py with CRUD, publish with quality gates (L1 pass + L2 >= 50), file security (extension whitelist, size limit, path sanitization)
- Created 14 REST API endpoints for skills management under /api/v1/skills/*
- Generated and applied Alembic migration with composite indexes and server_default values

## Task Commits

Each task was committed atomically:

1. **Task 1: Skill data models, schemas, Alembic migration, deps** - `43ac79a` (feat)
2. **Task 2: Skill service with lifecycle + API routes** - `1add253` (feat)

## Files Created/Modified
- `backend/app/models/skill.py` - Skill, SkillVersion, SkillResource ORM models with VALID_TRANSITIONS
- `backend/app/schemas/skill.py` - Pydantic v2 schemas (SkillCreate, SkillUpdate, SkillOut, SkillListOut, etc.)
- `backend/app/services/skill_service.py` - CRUD + lifecycle + file security service
- `backend/app/api/skills.py` - 14-endpoint REST API router
- `backend/alembic/versions/2e84ae1adc8d_add_skill_tables.py` - Migration for 3 tables
- `backend/app/models/__init__.py` - Added Skill model imports and __all__ entries
- `backend/app/api/__init__.py` - Added skills_router export
- `backend/app/main.py` - Registered skills_router
- `backend/alembic/env.py` - Added Skill model imports for autogenerate
- `backend/pyproject.toml` - Added python-pptx and pdfplumber dependencies

## Decisions Made
- Used VALID_TRANSITIONS dict as the sole source of truth for state transitions, with a single validate_status_transition() function as the enforcement point
- Used is_published boolean flag on SkillVersion instead of a separate status field — simpler to enforce single-published-version invariant
- Cleaned Alembic migration to remove unrelated index-rename noise and added explicit server_default on all defaulted columns for SQLite compat
- File security follows defense-in-depth: extension whitelist + size limit + filename sanitization + resource count cap + storage path never exposed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cleaned Alembic autogenerate migration**
- **Found during:** Task 1 (migration generation)
- **Issue:** First autogenerate run detected only index renames (skill tables already existed from init_tables). Second run after dropping tables included unrelated index rename noise.
- **Fix:** Dropped pre-existing skill tables, regenerated migration, manually cleaned to keep only skill table creation with proper server_default values.
- **Files modified:** backend/alembic/versions/2e84ae1adc8d_add_skill_tables.py
- **Verification:** alembic upgrade head runs successfully
- **Committed in:** 43ac79a

**2. [Rule 1 - Bug] Removed unused SkillResource import from service**
- **Found during:** Task 2 (ruff check)
- **Issue:** SkillResource was imported in skill_service.py but not used (used in api/skills.py directly)
- **Fix:** Removed unused import
- **Files modified:** backend/app/services/skill_service.py
- **Verification:** ruff check passes
- **Committed in:** 1add253

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Alembic autogenerate initially failed to detect new tables because init_tables() had already created them in SQLite. Resolved by dropping the tables first, then regenerating.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Skill data foundation complete with models, schemas, service, and API routes
- Plans 02-08 can now build on this foundation for material conversion, quality gates, Skill Hub UI, etc.
- All quality gate checks (L1 structure, L2 AI) are stub fields ready for wiring in Plan 03

## Self-Check: PASSED

---
*Phase: 19-ai-coach-skill-module*
*Completed: 2026-04-11*
