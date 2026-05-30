---
status: diagnosed
trigger: "scenario-list-empty-after-save: User creates scenario, gets success toast, but list page shows no records"
created: 2026-05-06T00:00:00Z
updated: 2026-05-06T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED — Database migrations s22b (tags column) and s22c (skill_id NOT NULL) have not been applied to the actual SQLite database
test: Queried actual database — alembic_version is ed6e59a95958, scenarios table still has product/therapeutic_area columns, no tags column
expecting: n/a — root cause confirmed
next_action: Return diagnosis

## Symptoms

expected: After saving a scenario, navigating to or being redirected to the scenarios list page should show the newly created record in the table.
actual: The list page shows no data rows (table headers visible, but zero items).
errors: None visible — save reports success toast.
reproduction: Go to /admin/scenarios/new, fill form, save. Then go to /admin/scenarios — empty table.
started: Likely after Phase 22 changes (types rewrite, removal of product/therapeutic_area, addition of tags + skill_id).

## Eliminated

## Evidence

- timestamp: 2026-05-06T00:00:30Z
  checked: Database alembic_version table
  found: Current migration is ed6e59a95958; migrations s22b00000001 and s22c_skill_id_not_null have NOT been applied
  implication: DB schema is outdated relative to the ORM model

- timestamp: 2026-05-06T00:00:40Z
  checked: PRAGMA table_info(scenarios) on actual SQLite DB
  found: Table still has columns product, therapeutic_area; does NOT have tags column. skill_id is nullable.
  implication: Code references a column that does not exist in the database

- timestamp: 2026-05-06T00:00:50Z
  checked: SELECT from scenarios table via SQLAlchemy ORM
  found: OperationalError "no such column: scenarios.tags" on both SELECT and INSERT
  implication: Both list and create endpoints return 500 Internal Server Error

- timestamp: 2026-05-06T00:01:00Z
  checked: Frontend error handling in scenario-editor.tsx onError handler
  found: onError uses t("scenarios.save") which resolves to same text "Scenario saved" as onSuccess — misleading user into thinking creation succeeded
  implication: The "success toast" user sees is actually an error toast with identical text

## Resolution

root_cause: Database migrations s22b (add tags column, remove product/therapeutic_area) and s22c (make skill_id NOT NULL) have not been applied to the running SQLite database (ai_coach.db). The ORM Scenario model references a `tags` column that does not exist, causing SQLAlchemy OperationalError on all queries. The backend returns 500, TanStack Query yields undefined data, and `scenariosData?.items ?? []` renders an empty table. Additionally, the create endpoint also fails (INSERT references tags column), but the error toast misleadingly shows "Scenario saved" text due to using the same i18n key in onError.
fix: 
verification: 
files_changed: []
