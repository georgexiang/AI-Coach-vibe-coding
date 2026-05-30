---
plan: 23-04
phase: 23
status: complete
started: 2026-05-13T23:30:00+08:00
completed: 2026-05-14T00:00:00+08:00
---

# Plan 23-04 Summary: Dual-Dimension Scoring (Content + Voice)

## Objective
Extend the scoring system to support dual-dimension scoring with voice score persistence and combined reports.

## What Was Built

### Task 1: ScoreDetail Category + Voice Score Integration
- **ScoreDetail model** (`backend/app/models/score.py`): Added `category` column (String(20), server_default="content") to distinguish content vs voice dimensions
- **Alembic migration** (`backend/alembic/versions/t23b_add_score_detail_category.py`): Adds category column with batch_alter_table
- **Voice score persistence** (`backend/app/services/voice_scoring_service.py`): `save_voice_score_details` creates ScoreDetail records with category="voice", resolves language from scenario config (D-12)

### Task 2: Combined Scoring Service + Schemas + API
- **Scoring schemas** (`backend/app/schemas/score.py`): Added `VoiceScoreSummary` and `CombinedScoreReport` Pydantic models with voice_dimensions, audio_url
- **Scoring service** (`backend/app/services/scoring_service.py`): `get_combined_score_report` separates dimensions by category, computes combined score (70% content + 30% voice)
- **API endpoint** (`backend/app/api/scoring.py`): GET `/sessions/{session_id}/combined-report` with ownership validation

## Key Files Modified/Created
- `backend/app/models/score.py` (modified)
- `backend/app/services/voice_scoring_service.py` (modified)
- `backend/app/services/scoring_service.py` (modified)
- `backend/app/schemas/score.py` (modified)
- `backend/app/api/scoring.py` (modified)
- `backend/alembic/versions/t23b_add_score_detail_category.py` (created)

## Test Results
- Backend tests passing
- Ruff lint clean on Phase 23 files

## Self-Check: PASSED
