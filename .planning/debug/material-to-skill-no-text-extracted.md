---
status: awaiting_human_verify
trigger: "When converting any material to a skill, the error 'No text could be extracted from reference materials' is returned. Affects ALL materials."
created: 2026-04-24T00:00:00Z
updated: 2026-04-24T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED - SQL NULL comparison bug in extract_resource_texts query
test: Fix applied, all 68 tests pass, ruff lint+format clean
expecting: User verifies material-to-skill conversion works in their environment
next_action: Await human verification

## Symptoms

expected: Material should be converted to a skill successfully, with text content extracted from the material's chunks/content
actual: Error message "No text could be extracted from reference materials" is returned for every material conversion attempt
errors: "No text could be extracted from reference materials"
reproduction: Try to convert any material to a skill via the UI
started: Affects all materials - code-level bug in SQL query

## Eliminated

## Evidence

- timestamp: 2026-04-24T00:00:30Z
  checked: Error string location in codebase
  found: Error appears in two files - skill_conversion_service.py:550 and skill_creator_service.py:249
  implication: Two code paths can produce this error

- timestamp: 2026-04-24T00:00:45Z
  checked: SkillResource model defaults
  found: extraction_status defaults to None (NULL in DB), text_content defaults to "" (empty string)
  implication: New resources have NULL extraction_status

- timestamp: 2026-04-24T00:01:00Z
  checked: extract_resource_texts query filter
  found: Filters with `extraction_status != "completed"` which EXCLUDES NULL rows in SQL
  implication: Newly created resources (extraction_status=NULL) are never found by the extraction query

- timestamp: 2026-04-24T00:01:10Z
  checked: SQLAlchemy NULL behavior with SQLite test
  found: Confirmed NULL != 'completed' returns False in SQL - NULL rows excluded from results
  implication: extract_resource_texts finds 0 resources, extracts nothing, text_content stays empty

## Resolution

root_cause: In skill_conversion_service.py extract_resource_texts(), the query filter `SkillResource.extraction_status != "completed"` excludes rows where extraction_status is NULL (the default for all new resources). SQL NULL comparison semantics mean NULL != 'completed' evaluates to NULL (falsy), so new resources are never selected for text extraction. Since text is never extracted, text_content remains empty (""), causing "No text could be extracted" error.
fix: Change the query filter to use `or_(SkillResource.extraction_status.is_(None), SkillResource.extraction_status != "completed")` to properly include NULL rows.
verification: All 68 unit tests pass. SQLAlchemy isolated test confirms NULL rows now included. ruff lint+format clean. Awaiting user end-to-end verification.
files_changed: [backend/app/services/skill_conversion_service.py]
