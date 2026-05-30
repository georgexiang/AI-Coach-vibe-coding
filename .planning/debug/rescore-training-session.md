---
status: awaiting_human_verify
trigger: "rescore-training-session: User wants to re-run scoring on an already-scored training session because scoring criteria/mode changed"
created: 2026-05-20T00:00:00Z
updated: 2026-05-20T00:10:00Z
---

## Current Focus

hypothesis: No rescore capability exists - the scoring_service.score_session() explicitly rejects sessions with status="scored" (409 ALREADY_SCORED)
test: Confirmed by reading score_session() at line 56-60 in scoring_service.py
expecting: Need to implement a rescore endpoint that deletes old scores and re-runs scoring
next_action: Implement rescore endpoint and service method

## Symptoms

expected: Ability to re-score an already-completed training session with updated scoring criteria/mode
actual: System rejects scoring on sessions with status="scored" with 409 ALREADY_SCORED
errors: 409 Conflict "Session has already been scored" 
reproduction: POST /api/v1/scoring/sessions/{session_id}/score on a session that has status="scored"
started: By design - scoring was originally one-shot only

## Eliminated

(none - root cause identified on first analysis)

## Evidence

- timestamp: 2026-05-20T00:01:00Z
  checked: scoring_service.py score_session() function
  found: Lines 56-60 explicitly check for status=="scored" and raise 409 ALREADY_SCORED
  implication: This is the blocking guard that prevents re-scoring

- timestamp: 2026-05-20T00:02:00Z
  checked: grep for "rescore", "re_score", "re-score" across entire backend
  found: Zero results - no re-score capability exists anywhere
  implication: This is a new feature that needs implementation

- timestamp: 2026-05-20T00:03:00Z
  checked: SessionScore model (score.py)
  found: session_id has unique=True constraint, meaning one score per session
  implication: Re-scoring must DELETE old SessionScore + ScoreDetails before creating new ones

- timestamp: 2026-05-20T00:04:00Z
  checked: Session model lifecycle (session.py)
  found: Status lifecycle is created -> in_progress -> completed -> scored
  implication: Re-scoring must reset status from "scored" back to "completed", then run scoring again

- timestamp: 2026-05-20T00:05:00Z
  checked: Data model relationships
  found: SessionScore has cascade relationship from session, ScoreDetail has score_id FK to SessionScore
  implication: Deleting SessionScore should cascade or we need to explicitly delete ScoreDetails first

## Resolution

root_cause: The scoring_service.score_session() function has an explicit guard at line 56-60 that rejects sessions already in "scored" status. There is no re-score endpoint or mechanism in the system. The SessionScore model has unique=True on session_id, so only one score record can exist per session.

fix: Implement a rescore_session() service method that:
1. Deletes existing SessionScore and ScoreDetails for the session
2. Resets session status from "scored" to "completed" and clears overall_score/passed
3. Calls the existing scoring pipeline with current rubric dimensions
4. Add a new API endpoint POST /api/v1/scoring/sessions/{session_id}/rescore

verification: All 50 scoring tests pass (12 new rescore tests + 38 existing). Linting clean. Endpoint tested for success, auth, 409, 403, 404, and repeatable rescore.
files_changed: [backend/app/services/scoring_service.py, backend/app/api/scoring.py, backend/tests/test_rescore.py]
