---
phase: 24-session-skill-focus-cu-evaluation
plan: 01
subsystem: backend-schema
tags: [database, alembic, pydantic, schema-extension]
dependency_graph:
  requires: []
  provides: [focus_instruction-column, sop_current_step-column, content_weight-column, voice_weight-column, cu_content_analyzer_id-column, cu_voice_analyzer_id-column]
  affects: [session-api, rubric-api, cu-evaluation-pipeline]
tech_stack:
  added: []
  patterns: [batch_alter_table, model_validator-weight-sum]
key_files:
  created:
    - backend/alembic/versions/u24a_add_focus_and_cu_fields.py
  modified:
    - backend/app/models/session.py
    - backend/app/models/scoring_rubric.py
    - backend/app/schemas/scoring_rubric.py
    - backend/app/schemas/session.py
decisions:
  - "batch_alter_table for all columns (SQLite compat, Gotcha #1)"
  - "model_validator(mode='after') for content_weight + voice_weight == 100 enforcement"
  - "server_default on migration columns for existing row compatibility"
metrics:
  duration: 3min
  completed: 2026-05-13
  tasks: 2
  files: 5
---

# Phase 24 Plan 01: Schema Extensions for Skill Focus and CU Evaluation Summary

Database schema foundation for both Skill Focus (D-03) and CU Evaluation (D-09/D-12): 6 new columns across 2 tables with Alembic migration, ORM updates, and Pydantic schema exposure with weight validation.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Alembic migration + ORM model extensions | cff1eb9 | u24a_add_focus_and_cu_fields.py, session.py, scoring_rubric.py |
| 2 | Pydantic schema extensions for new fields | 092c6ef | schemas/scoring_rubric.py, schemas/session.py |

## Changes Made

### Task 1: Alembic Migration + ORM Model Extensions
- Created migration `u24a_focus_cu_fields` adding 6 columns across 2 tables
- `coaching_sessions`: `focus_instruction` (Text, nullable) and `sop_current_step` (Integer, server_default="0")
- `scoring_rubrics`: `content_weight` (Integer, server_default="60"), `voice_weight` (Integer, server_default="40"), `cu_content_analyzer_id` (String 255, nullable), `cu_voice_analyzer_id` (String 255, nullable)
- All operations use `batch_alter_table` for SQLite compatibility
- Updated both ORM models with corresponding `Mapped` column definitions

### Task 2: Pydantic Schema Extensions
- `RubricCreate`: Added `content_weight: int = 60` and `voice_weight: int = 40` with `model_validator` ensuring sum equals 100
- `RubricUpdate`: Added optional `content_weight` and `voice_weight` fields
- `RubricResponse`: Added all 4 new fields (weights + CU analyzer IDs) with defaults
- `SessionResponse`: Added `focus_instruction: str | None` and `sop_current_step: int | None`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- Alembic migration applies cleanly on SQLite
- All 6 ORM fields present and importable
- Pydantic weight validator rejects invalid sums (content_weight + voice_weight != 100)
- Ruff lint passes on all modified files

## Self-Check: PASSED

All 5 files confirmed present on disk. Both commit hashes (cff1eb9, 092c6ef) confirmed in git history.
