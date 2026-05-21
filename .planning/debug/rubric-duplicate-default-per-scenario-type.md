---
status: awaiting_human_verify
trigger: "相同的场景类型（face2face/面对面）下有两个 rubric 同时被标记为 Default"
created: 2026-05-06T00:00:00Z
updated: 2026-05-06T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - Phase 21 migration (h21a) creates a "Default Scoring Rubric" with is_default=True without unsetting the existing seed "Default F2F Scoring Rubric" that also has is_default=True
test: Queried the database directly
expecting: Two rows with is_default=1 for scenario_type=f2f
next_action: Implement fix - migration fixup + DB constraint

## Symptoms

expected: 每个场景类型（如 face2face）只能有一个 rubric 被标记为 default，设置新 default 时应自动取消旧的
actual: Scoring Rubrics 列表页面显示 "Default F2F Scoring Rubric" 和 "Default Scoring Rubric" 两个都标记为 "Default"，都是面对面类型
errors: 无报错，但逻辑上不正确 — 系统无法确定使用哪个 default
reproduction: 访问 localhost:5173/admin/scoring-rubrics 页面，观察面对面类型有两个 Default 标记
started: Phase 21 刚完成了 Scoring Criteria Refactor，可能是迁移导致的问题

## Eliminated

## Evidence

- timestamp: 2026-05-06T00:01:00Z
  checked: scoring_rubrics table in ai_coach.db
  found: Two rows with is_default=1 for scenario_type='f2f' — "Default F2F Scoring Rubric" (seed) and "Default Scoring Rubric" (migration h21a)
  implication: Confirms duplicate defaults exist in actual data

- timestamp: 2026-05-06T00:02:00Z
  checked: h21a migration code (line 106)
  found: Migration sets is_default=True when combo==(30,25,20,15,10) but never unsets existing defaults first
  implication: Root cause identified — migration creates new default without clearing old one

- timestamp: 2026-05-06T00:03:00Z
  checked: rubric_service.py _unset_defaults function
  found: Service layer correctly unsets defaults for API operations (create_rubric, update_rubric)
  implication: Bug is data-only from migration, not a runtime API issue

- timestamp: 2026-05-06T00:04:00Z
  checked: scenarios table rubric_id assignments
  found: Most f2f scenarios use 5c32107a (migration-created "Default Scoring Rubric"), one uses a9d408b4 (seed "Default F2F Scoring Rubric")
  implication: The seed rubric (a9d408b4) is the one that should lose its is_default flag — the migration-created one is more appropriate as the "true" default

## Resolution

root_cause: Phase 21 migration (h21a_add_rubric_id_remove_weight_columns.py) creates a "Default Scoring Rubric" with is_default=True from migrated scenario weights, but does NOT unset the pre-existing seed "Default F2F Scoring Rubric" which also has is_default=True. This results in two defaults for scenario_type='f2f'.
fix: 1) Fixed h21a migration to unset existing defaults before inserting its own default rubric (for fresh installs). 2) Added startup deduplication logic in startup_seed.py that detects and resolves duplicate defaults on each app boot (keeps most recently updated, unsets others). 3) Fixed current database directly (unset is_default on seed rubric a9d408b4).
verification: All 44 rubric tests pass. All 153 tests in affected files pass. Database now shows exactly 1 default for f2f. Python verification confirms single default via SQLAlchemy query.
files_changed: [backend/alembic/versions/h21a_add_rubric_id_remove_weight_columns.py, backend/app/startup_seed.py]
