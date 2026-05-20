---
phase: quick
plan: 260520-njr
subsystem: scoring-engine
tags: [bugfix, llm-prompt, post-validation, scoring]
dependency_graph:
  requires: []
  provides: [scoring-post-validation, role-confusion-fix]
  affects: [backend/app/services/scoring_engine.py]
tech_stack:
  added: []
  patterns: [programmatic-post-validation, prompt-engineering-role-labels]
key_files:
  created:
    - backend/tests/test_scoring_engine_postvalidation.py
  modified:
    - backend/app/services/scoring_engine.py
decisions:
  - "Critical scoring rules moved to end of prompt for maximum LLM attention (recency bias)"
  - "Programmatic _enforce_scoring_rules() as safety net independent of LLM compliance"
  - "Role labels use triple-arrow + explicit instruction to prevent role confusion"
metrics:
  duration: 5min
  completed: "2026-05-20T09:05:00Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 2
---

# Quick Task 260520-njr: Fix Scoring Engine LLM Role Confusion and Add Post-Validation

**One-liner:** Programmatic post-validation + strengthened prompt role labels prevent LLM from evaluating HCP instead of MR and enforce score caps when key messages undelivered.

## Changes Made

### 1. Strengthened Prompt Template (scoring_engine.py)

- Changed transcript role labels from plain `MR:` / `HCP:` to prominent `>>> MR (EVALUATE THIS PERSON) <<<:` and `>>> HCP (DO NOT EVALUATE) <<<:` to prevent LLM role confusion
- Moved critical scoring rules from the top (where they were ignored) to a dedicated `## CRITICAL SCORING RULES (MUST FOLLOW)` section immediately before the JSON output format
- Added `REMINDER:` reinforcement line right before JSON structure specification
- Kept brief top-level instruction ("You evaluate ONLY the MR") for context framing

### 2. Post-Validation Logic (_enforce_scoring_rules)

New function `_enforce_scoring_rules(dimensions, key_messages_status, messages)`:
- **Rule 1:** When ALL key_messages have `delivered=false`, caps `key_message` dimension score to max 30
- **Rule 2:** When ALL undelivered AND total MR message content < 100 chars (irrelevant/minimal engagement), caps ALL dimension scores to max 50
- Logs warnings when capping is applied for observability
- Returns early (no-op) when key_messages_status is empty or some messages are delivered

### 3. Integration in score_with_llm()

- Post-validation called after LLM JSON parsing and weight normalization, before computing overall_score
- Ensures programmatic enforcement regardless of LLM compliance with prompt rules

### 4. Comprehensive Unit Tests (12 tests)

- 6 tests for `_enforce_scoring_rules()` covering all edge cases
- 5 tests for `build_scoring_prompt()` verifying role labels and rule placement
- 1 integration test for `score_with_llm()` verifying end-to-end post-validation

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- All 12 new tests pass: `pytest tests/test_scoring_engine_postvalidation.py -v`
- All 17 existing tests still pass: `pytest tests/test_scoring_service.py -v`
- Ruff lint clean: `ruff check app/services/scoring_engine.py`
- Ruff format clean: `ruff format --check app/services/scoring_engine.py`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | d00ca2a | fix(quick-260520-njr): fix scoring engine LLM role confusion and add post-validation |

## Self-Check: PASSED
