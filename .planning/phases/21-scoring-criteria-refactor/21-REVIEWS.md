---
phase: 21
reviewers: [claude-sonnet-independent]
reviewed_at: 2026-04-30T15:00:00Z
plans_reviewed: [21-01-PLAN.md, 21-02-PLAN.md, 21-03-PLAN.md]
note: "Codex CLI failed (403 - key-based auth disabled on Azure OpenAI endpoint), OpenCode CLI failed (SDK compatibility error). Review performed by independent Claude Sonnet agent with full codebase access."
---

# Cross-AI Plan Review -- Phase 21

> **Note:** External CLI reviews (Codex, OpenCode) failed due to authentication/SDK issues. This review was performed by an independent Claude Sonnet agent with full codebase read access, analyzing the executed code against the original plans.

---

## Claude Sonnet Independent Review

### Plan 21-01: Backend Refactoring

#### Summary

The backend refactor is well-executed. The Scenario model no longer has weight columns -- just a `rubric_id` FK with `nullable=False`. The scoring engine uses `build_dimensions_instructions()` to dynamically construct prompts from rubric dimensions. The scoring service has a clean `resolve_rubric_dimensions()` with direct lookup (no fallback chain per D-05). The mock scorer loops over `rubric_dimensions` correctly. The 3-step Alembic migration is properly structured.

#### Strengths

- Clean separation: `resolve_rubric_dimensions()` encapsulates rubric resolution in one place, called by both LLM and mock paths
- 3-step migration well-structured: add nullable column, migrate data, enforce NOT NULL + drop columns. Uses `batch_alter_table` for SQLite
- Migration handles edge cases: empty DB, null rubric_id rows, admin user fallback
- `build_dimensions_instructions()` includes criteria from rubric, making LLM prompt richer than old hardcoded `dim_names`
- Weight validation in LLM response prevents hallucinated weights

#### Concerns

- **HIGH: Rubric deletion not guarded against in-use references.** `delete_rubric` endpoint has no check for scenarios referencing the rubric via FK. Deleting a referenced rubric causes DB integrity error (500) instead of clean 409. Real production risk.
- **HIGH: `suggestion_service.py` still accepts `scoring_weights: dict` parameter.** Dead code that creates false impression weights are consumed. Callers in `sessions.py` construct and pass `scoring_weights` from rubric dimensions unnecessarily.
- **MEDIUM: Migration default weight combo check may not match actual seed data.** Migration checks for `(30, 25, 20, 15, 10)` but startup seed may use different defaults. Could create duplicate/conflicting default rubrics.
- **MEDIUM: `startup_seed.py` can create duplicate rubrics across runs.** Idempotency check only queries `(scenario_type='f2f', is_default=True)` -- no DB-level uniqueness constraint on `is_default` per scenario_type.
- **MEDIUM: `ScoreDetail.dimension` stores raw dimension names.** If admin renames a dimension after scoring, historical records have old name, breaking trend comparisons silently.
- **LOW: `dimension` column is `String(50)`.** Custom dimension names may exceed 50 characters.

#### Suggestions

- Add guard in `delete_rubric` to check for referencing scenarios before deletion. Return 409 with scenario count.
- Remove unused `scoring_weights` parameter from `suggestion_service.generate_suggestions()` and clean up 6+ test files that pass empty dicts.
- Fix migration's default combo to match actual seed data, or don't hardcode a "default" check -- let startup seed handle it.
- Consider increasing `dimension` column to 100 characters.

#### Risk Assessment: **MEDIUM**

Rubric deletion integrity gap is a real production risk. Dead code in suggestion_service is confusing but harmless. Migration default mismatch only relevant for pre-existing data.

---

### Plan 21-02: Frontend Refactoring

#### Summary

The frontend refactor is clean. `Scenario` TypeScript type has `rubric_id: string` with no weight fields. `ScenarioEditor` has a rubric selector with dimension preview, zod validation requiring `rubric_id`, and "Manage Rubrics" link. The old `scoring-weights.tsx` component exists but is no longer used.

#### Strengths

- Rubric selector sorts defaults first, shows dimension count, uses `useRubrics()` hook, has clear validation
- Dimension preview card gives visual weight bars + criteria in compact read-only format -- good UX
- Zod schema correctly enforces non-empty rubric_id selection
- TypeScript types match backend schema well
- `useRubrics()` hook accepts optional `scenario_type` filter

#### Concerns

- **HIGH: `scoring-weights.tsx` and test still exist and are exported.** `components/admin/index.ts` still exports `ScoringWeights` and `adjustWeights`. 133 lines of dead code + 109 line test file. Orphaned artifacts that confuse developers.
- **MEDIUM: `scenarios.tsx` UI text still says "scoring weights".** Description at line 117 should say "scoring rubric".
- **MEDIUM: `scenario-editor.test.tsx` still asserts old "scoring weights" text.** Test expects "Configure scenario details and scoring weights" but component says "scoring rubric" -- test would FAIL.
- **LOW: No loading/error state for rubrics fetch.** If rubrics fail to load, selector is empty with no feedback.
- **LOW: Dimension preview doesn't show `max_score`.** Fine if always 100, but invisible if variable.

#### Suggestions

- Delete `scoring-weights.tsx`, its test, and remove barrel export from `index.ts`
- Update i18n key `scenarios.description` to reference "scoring rubric"
- Fix `scenario-editor.test.tsx` assertion to match actual component text
- Add loading skeleton when rubrics are loading

#### Risk Assessment: **MEDIUM**

Dead code and stale test assertion are main concerns. Stale test will cause CI failures.

---

### Plan 21-03: Integration & Verification

#### Summary

The integration wave bridges backend and frontend changes. Migration written, seed data updated, API contract aligned. However, several integration gaps remain in test coverage and cleanup.

#### Strengths

- Seed data pipeline properly updated: `startup_seed.py` resolves default rubric and assigns `rubric_id` to all scenarios
- `sessions.py` API correctly resolves rubric dimensions via `resolve_rubric_dimensions()`
- `clone_scenario` correctly copies `rubric_id` from original
- Analytics queries (`get_skill_gap_matrix`, `get_user_dimension_trends`) are already fully dynamic

#### Concerns

- **HIGH: No E2E tests for the scoring rubric flow.** Full rubric-selection-to-scoring pipeline is not tested end-to-end.
- **HIGH: `get_recommended_scenarios` in analytics_service.py makes N+1 rubric queries.** For each active scenario, individually calls `get_rubric(db, s.rubric_id)`. With 50+ scenarios, this is 50+ individual DB queries.
- **MEDIUM: `ondelete` behavior not specified on `rubric_id` FK.** Unlike `skill_id` which uses `ondelete="SET NULL"`, rubric_id FK has no explicit delete behavior. DB rejects delete, but error handling is raw 500.
- **MEDIUM: `is_default` flag has no unique constraint.** Multiple rubrics can have `is_default=True` for the same `scenario_type`. Race conditions possible.
- **LOW: Migration revision chain had branch point.** Merge migration file exists, indicating chain complexity.

#### Suggestions

- Add E2E tests: create rubric, assign to scenario, score session, verify dimensions in report
- Batch rubric lookups in `get_recommended_scenarios` using `ScoringRubric.id.in_()`
- Add `ondelete="RESTRICT"` on rubric_id FK and service-level guard returning 409
- Add unique partial index on `(scenario_type, is_default)` where `is_default=True`

#### Risk Assessment: **MEDIUM-HIGH**

Missing E2E coverage and unprotected rubric deletion are biggest risks. N+1 query is a performance concern for larger deployments.

---

## Consensus Summary

### Agreed Strengths (across all plans)

- Solid 3-step migration strategy with data preservation before column removal
- Clean `resolve_rubric_dimensions()` with no fallback chain (per D-05)
- Dynamic prompt building from rubric criteria improves scoring guidance quality
- Frontend rubric selector with dimension preview is good UX
- Correct scope boundary: only Session Scoring refactored (Dry Run and Skill Quality untouched)

### Agreed Concerns (priority order)

1. **Rubric deletion is unprotected** -- deleting a referenced rubric causes 500 instead of 409. No `ondelete` behavior specified on FK. (HIGH)
2. **Dead code not cleaned up** -- `scoring-weights.tsx`, `suggestion_service.scoring_weights` parameter, barrel export all still exist (HIGH)
3. **Stale test assertions** -- `scenario-editor.test.tsx` still checks for "scoring weights" text (MEDIUM)
4. **N+1 rubric queries in analytics** -- `get_recommended_scenarios` individually loads each scenario's rubric (MEDIUM)
5. **No E2E tests for rubric flow** -- full pipeline untested end-to-end (MEDIUM-HIGH)
6. **`is_default` uniqueness not enforced at DB level** -- possible duplicate defaults (MEDIUM)

### Divergent Views

- Migration default weight combo check: may or may not match actual seed data depending on environment state. Worth verifying but not blocking.
- `ScoreDetail.dimension` column at 50 chars: sufficient for current use but potentially limiting for very long custom dimension names.

---

## Action Items

| # | Priority | Item | Effort |
|---|----------|------|--------|
| 1 | HIGH | Add rubric delete protection (check for referencing scenarios, return 409) | Small |
| 2 | HIGH | Remove dead `scoring-weights.tsx`, test, barrel export | Small |
| 3 | HIGH | Remove unused `scoring_weights` param from `suggestion_service.py` | Small |
| 4 | MEDIUM | Fix stale test assertion in `scenario-editor.test.tsx` | Trivial |
| 5 | MEDIUM | Batch rubric queries in `get_recommended_scenarios` | Small |
| 6 | MEDIUM | Add E2E tests for rubric selection + scoring flow | Medium |
| 7 | LOW | Add unique constraint for `(scenario_type, is_default=True)` | Small |
