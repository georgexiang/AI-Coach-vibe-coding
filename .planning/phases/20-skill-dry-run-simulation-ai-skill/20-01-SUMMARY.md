---
phase: 20-skill-dry-run-simulation-ai-skill
plan: 01
subsystem: backend
tags: [dry-run, orm, api, schemas, migration]
dependency_graph:
  requires: []
  provides: [DryRun-model, DryRunMessage-model, dry-run-schemas, dry-run-service, dry-run-api]
  affects: [backend/app/models/__init__.py, backend/app/api/__init__.py, backend/app/main.py]
tech_stack:
  added: []
  patterns: [async-service-layer, pydantic-v2-schemas, json-text-columns]
key_files:
  created:
    - backend/app/models/dry_run.py
    - backend/app/schemas/dry_run.py
    - backend/app/services/dry_run_service.py
    - backend/app/api/dry_runs.py
    - backend/alembic/versions/q20a_add_dry_run_tables.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/api/__init__.py
    - backend/app/main.py
decisions:
  - Used JSON text columns (issues_json, sop_coverage_json) for flexible schema-less data within SQLite constraints
  - Error messages truncated to 500 chars in service layer per threat model T-20-04
  - Route prefix nested under /skills/{skill_id}/dry-runs for RESTful hierarchy
metrics:
  duration: 275s
  completed: 2026-04-26T16:06:46Z
  tasks_completed: 2
  tasks_total: 2
---

# Phase 20 Plan 01: Dry Run Data Foundation Summary

DryRun and DryRunMessage ORM models with Alembic migration, Pydantic v2 schemas, async CRUD service, and REST API router registered under /skills/{skill_id}/dry-runs.

## What Was Built

### Task 1: ORM Models + Alembic Migration

Created `backend/app/models/dry_run.py` with two ORM models:

- **DryRun** (`dry_runs` table): Tracks simulation runs per skill with status lifecycle (pending -> running -> completed/failed/cancelled), SOP coverage metrics (total/covered/partial steps, coverage percent), executability scoring (0-100), issues tracking via JSON text column, and duration metadata. Has ForeignKey to `skills.id` (CASCADE) and optional `skill_versions.id` (SET NULL). Composite indexes on (skill_id, status) and (created_at).

- **DryRunMessage** (`dry_run_messages` table): Stores individual conversation turns with role (mr/hcp), sequence number for ordering, content text, and optional SOP step linkage (step_id, step_name). Has ForeignKey to `dry_runs.id` (CASCADE).

Created Alembic migration `q20a_add_dry_run_tables.py` chaining from `p19a00000001` with explicit `op.create_table` calls and `server_default` values for SQLite compatibility.

Registered both models in `backend/app/models/__init__.py`.

### Task 2: Schemas, Service, and API Router

**Schemas** (`backend/app/schemas/dry_run.py`):
- `DryRunMessageOut` - message response with from_attributes
- `SopStepCoverage` - per-step coverage status
- `DryRunIssue` - warning/error issues found during simulation
- `DryRunListOut` - list view with key metrics
- `DryRunOut` - full detail view with parsed JSON fields and messages

**Service** (`backend/app/services/dry_run_service.py`):
- `create_dry_run` - validates skill exists with content, computes sequential run_number
- `get_dry_run` / `get_dry_run_or_404` - load with selectinload messages
- `list_dry_runs` - paginated listing ordered by run_number DESC
- `cancel_dry_run` - status transition guard (only pending/running)
- `dry_run_to_out` - JSON parsing helper for sop_coverage and issues fields

**API Router** (`backend/app/api/dry_runs.py`):
- `POST /skills/{skill_id}/dry-runs` (201) - create new dry run
- `GET /skills/{skill_id}/dry-runs` - paginated list
- `GET /skills/{skill_id}/dry-runs/{run_id}` - full detail with messages
- `POST /skills/{skill_id}/dry-runs/{run_id}/cancel` - cancel pending/running

All endpoints require `require_role("admin")` per threat model T-20-01. Router registered in `main.py` after skills_router.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- All files pass `ruff check` with zero errors
- `from app.models import DryRun, DryRunMessage` succeeds
- `from app.api.dry_runs import router` shows correct prefix `/skills/{skill_id}/dry-runs`
- Router has 4 Plan-01 routes (5 total with status endpoint added by Plan 02)
- All service functions importable and have correct signatures

## Self-Check: PASSED
