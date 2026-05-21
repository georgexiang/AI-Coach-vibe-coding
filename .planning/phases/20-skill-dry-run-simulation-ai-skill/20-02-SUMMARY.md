---
phase: 20-skill-dry-run-simulation-ai-skill
plan: 02
subsystem: api
tags: [azure-openai, dry-run, simulation, sop-coverage, background-task, asyncio]

# Dependency graph
requires:
  - phase: 20-skill-dry-run-simulation-ai-skill/01
    provides: DryRun and DryRunMessage ORM models, dry_run_service CRUD, dry_runs API router
provides:
  - Dry Run simulation engine (run_dry_run_simulation background task)
  - SOP step extraction from markdown content
  - Multi-turn MR/HCP conversation orchestration via Azure OpenAI
  - SOP coverage tracking with keyword-overlap matching
  - Executability scoring algorithm
  - Lightweight status polling endpoint for frontend
affects: [20-03, 20-04, 20-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [durable-background-task-with-own-session, chat-completions-api, keyword-overlap-matching]

key-files:
  created:
    - backend/app/services/dry_run_engine.py
  modified:
    - backend/app/api/dry_runs.py

key-decisions:
  - "Used chat.completions.create (not Responses API) for simulation flexibility and model compatibility"
  - "Pre-fetch AI endpoint before conversation loop to avoid DB reads during simulation"
  - "Keyword overlap with threshold >= 2 meaningful words for SOP step matching"
  - "Response truncation to 500 chars per T-20-08 threat mitigation"

patterns-established:
  - "Durable background task pattern: asyncio.create_task + AsyncSessionLocal for independent DB session"
  - "Lightweight status polling endpoint for long-running background operations"

requirements-completed: [DR-02, DR-03]

# Metrics
duration: 5min
completed: 2026-04-26
---

# Phase 20 Plan 02: Dry Run Simulation Engine Summary

**Multi-turn MR/HCP conversation engine with SOP step extraction, keyword-overlap coverage tracking, and executability scoring via Azure OpenAI chat completions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-26T16:02:05Z
- **Completed:** 2026-04-26T16:06:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Built complete dry run simulation engine (546 lines) with SOP extraction, MR/HCP agent orchestration, step matching, coverage computation, issue identification, and executability scoring
- Wired engine as asyncio.create_task background task in POST create endpoint
- Added GET /{run_id}/status lightweight polling endpoint for frontend 3-second interval polling

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the Dry Run simulation engine** - `c51c1ca` (feat)
2. **Task 2: Wire engine into API create endpoint as background task** - `aaebce9` (feat)

## Files Created/Modified
- `backend/app/services/dry_run_engine.py` - Core simulation engine: SOP extraction, LLM calls, MR/HCP turn-taking, keyword matching, coverage computation, scoring
- `backend/app/api/dry_runs.py` - Added asyncio.create_task wiring in POST handler, added GET status polling endpoint

## Decisions Made
- Used `chat.completions.create` instead of Responses API for the simulation -- chat completions is more flexible for multi-turn conversation and works with standard gpt-4o model without agent registration
- Pre-fetched AI project endpoint before entering the simulation loop to avoid DB reads during the tight message exchange cycle
- Used simple keyword-overlap scoring (threshold >= 2 meaningful words > 3 chars) for SOP step matching -- fast, interpretable, and sufficient for coverage detection
- Truncated LLM responses to 500 characters per T-20-08 threat mitigation (tamper-proof storage)
- Status endpoint does direct `db.get(DryRun, run_id)` without joining messages for minimal DB load during polling

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Plan 01 (backend models) was running in parallel -- engine file used deferred imports (`from app.models.dry_run import ...` inside function body) so it imports cleanly regardless of model file existence at module load time
- Linter reverted working directory changes to dry_runs.py after git commit, but the committed content was correct; re-applied via Write tool

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Simulation engine is ready for Plans 03-05 (frontend integration, cancel/re-run, polish)
- Frontend can poll GET `/{run_id}/status` at 3-second intervals for progress updates
- Full dry run detail (with messages) available via existing GET `/{run_id}` endpoint

---
*Phase: 20-skill-dry-run-simulation-ai-skill*
*Completed: 2026-04-26*
