---
status: awaiting_human_verify
trigger: "On History page, 'Submit for Scoring' button shows 'Scoring...' briefly then reverts. Scoring never completes."
created: 2026-05-17T00:00:00Z
updated: 2026-05-17T14:52:00Z
---

## Current Focus

hypothesis: CONFIRMED - CU evaluation service returns dict missing 'passed' key and uses 'name' instead of 'dimension' for dimension keys. scoring_service.py accesses scores["passed"] and dim_data["dimension"] causing KeyError.
test: Direct invocation of score_session confirmed KeyError: 'passed' at line 127
expecting: Fix the integration mismatch between cu_evaluation_service return format and scoring_service expectations
next_action: Fix scoring_service.py to derive 'passed' from overall_score >= pass_threshold, and handle both 'name' and 'dimension' keys for dimensions

## Symptoms

expected: Clicking "Submit for Scoring" should trigger scoring API, process conversation, generate scores, update session status to "scored", display scores
actual: Button shows "Scoring..." briefly then reverts to "Submit for Scoring" - scoring never completes, no score appears, no status change
errors: No visible error in UI (silent failure). Need to check console/backend logs.
reproduction: Go to http://localhost:5173/user/history, click "Submit for Scoring" on any session with "Pending Review" status
started: Current behavior - scoring has never worked (all sessions remain "Pending Review")

## Eliminated

## Evidence

- timestamp: 2026-05-17T14:38:00Z
  checked: Direct invocation of score_session('4a1a0833-...') on a completed session
  found: KeyError: 'passed' at scoring_service.py line 127. CU scoring succeeded but returned dict without 'passed' key.
  implication: The cu_evaluation_service.merge_scores() returns {overall_score, content_total, voice_total, dimensions, feedback_summary} - no 'passed' field.

- timestamp: 2026-05-17T14:38:00Z
  checked: CU _parse_cu_content_result and _mock_scores return format
  found: Dimensions use key "name" not "dimension". scoring_service.py line 136 accesses dim_data["dimension"] causing another KeyError after the first is fixed.
  implication: Two field name mismatches between CU results and scoring_service consumer code.

## Resolution

root_cause: Three integration bugs between cu_evaluation_service.py and scoring_service.py: (1) CU results (merge_scores and _mock_scores) omit 'passed' key but scoring_service accesses scores["passed"] causing KeyError crash; (2) CU dimensions use "name" key but scoring_service accesses dim_data["dimension"]; (3) CU returns field values wrapped in {"type":"string","valueString":"..."} format that _parse_cu_content_result didn't unwrap, causing all scores to be 0.
fix: (1) scoring_service.py: derive 'passed' from overall_score >= pass_threshold using scores.get("passed", ...) (2) scoring_service.py: use dim_data.get("dimension") or dim_data.get("name") for dimension name lookup (3) cu_evaluation_service.py: added _extract_cu_field_value() to parse CU's {"type":"string","valueString":"..."} response format (4) cu_evaluation_service.py: changed _mock_scores() fallbacks to return None so proper rubric-aware mock is used
verification: All 51 scoring tests pass (test_scoring_service.py + test_cu_evaluation_service.py + test_scoring_api.py). HTTP API endpoint POST /scoring/sessions/{id}/score returns 201 with proper response. Session status correctly updated to "scored".
files_changed: [backend/app/services/scoring_service.py, backend/app/services/cu_evaluation_service.py]
