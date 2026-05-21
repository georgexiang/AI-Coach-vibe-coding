# Phase 26 — Scoring Architecture: LLM Content + CU Voice

## Goal

Refactor the scoring system from "CU does everything (content + voice) with LLM/mock fallbacks" to a clean separation:
- **LLM (GPT-4o)** = primary content scoring engine (5 dimensions)
- **CU (audioAnalyzer)** = voice-only scoring (4 dimensions)
- **No mock fallback** — failures return HTTP 503

## Why

The current CU-based content scoring is fundamentally inaccurate because CU:
1. Cannot receive external context (no system prompt, 1024 char field description limit)
2. Cannot distinguish MR vs HCP roles
3. Cannot evaluate against key messages, product knowledge, or HCP profile
4. Results in sessions with irrelevant content scoring 76+ (passing)

The LLM scoring engine already has a complete context-rich prompt but is relegated to fallback status. The mock fallback generates fake passing scores (base 65+), masking real failures.

## Analysis

Full analysis documented in `/docs/cu-analyzer-scoring/`:
- `01-cu-capability-analysis.md` — CU limitations for content evaluation
- `02-cost-comparison.md` — CU ($0.03) vs LLM ($0.024) per content scoring
- `03-dimension-suitability-matrix.md` — per-dimension engine recommendation
- `04-recommended-architecture.md` — hybrid architecture design

## Scope

| Change | Files |
|--------|-------|
| Add 503 exception | `backend/app/utils/exceptions.py` |
| Promote LLM engine | `backend/app/services/scoring_engine.py` |
| Remove CU content scoring | `backend/app/services/cu_evaluation_service.py` |
| New orchestration flow | `backend/app/services/scoring_service.py` |
| CU-only voice service | `backend/app/services/voice_scoring_service.py` |
| Update tests | `backend/tests/test_scoring_*.py`, `test_cu_evaluation_service.py`, `test_voice_scoring*.py` |

## Non-Goals

- No frontend changes in this phase
- No database migrations (existing schema supports this)
- No changes to rubric CRUD API
- No changes to session lifecycle
