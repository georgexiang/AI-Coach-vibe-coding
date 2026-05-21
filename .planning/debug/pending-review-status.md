---
status: awaiting_human_verify
trigger: "All sessions in History page show 'Pending Review' status regardless of actual state"
created: 2026-05-17T00:00:00Z
updated: 2026-05-17T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - Frontend session-history.tsx only includes sessions with status==="completed" in the unified rows (line 98), excluding "created" and "in_progress" sessions. All completed sessions display as "Pending Review" because none have been scored yet.
test: Verified by reading code + querying DB
expecting: N/A - root cause found
next_action: Fix the frontend to show all session statuses with appropriate badges

## Symptoms

expected: Sessions in history should show their real status - some should be "completed", "scored", etc. based on their lifecycle state
actual: Every single session shows "Pending Review" status (yellow badge) with a "Submit for Scoring" button
errors: No visible errors in the UI
reproduction: Navigate to http://localhost:5173/user/history - all 5 sessions show "Pending Review"
started: Unknown - user discovered this on the history page

## Eliminated

## Evidence

- timestamp: 2026-05-17T00:01:00Z
  checked: Frontend session-history.tsx line 98
  found: Only sessions with session.status === "completed" are added to unified rows. "created" and "in_progress" sessions are excluded entirely.
  implication: History page only shows "completed" sessions as "Pending Review", ignoring other lifecycle states

- timestamp: 2026-05-17T00:02:00Z
  checked: Database coaching_sessions table
  found: 5 completed sessions, 1 in_progress, many created, 0 scored. No session_scores records exist.
  implication: All visible sessions (the 5 completed ones) correctly show as "Pending Review" because none have scores. But other sessions are hidden.

- timestamp: 2026-05-17T00:03:00Z
  checked: UnifiedHistoryRow type definition (line 39)
  found: Status type is limited to "completed" | "scoring" | "scored" - missing "created" and "in_progress"
  implication: The component was designed to only show post-completion sessions, not the full lifecycle

- timestamp: 2026-05-17T00:04:00Z
  checked: renderStatusBadge function (line 237-258)
  found: Only handles "completed" (Pending Review), "scoring", and "scored" cases. No handling for "created" or "in_progress"
  implication: Even if those sessions were included, they wouldn't render properly

## Resolution

root_cause: The session-history.tsx component filters sessions to only include status==="completed" (line 98) and the UnifiedHistoryRow type only supports "completed"|"scoring"|"scored" statuses. Sessions with "created" or "in_progress" status are completely excluded from the history view. Combined with zero scored sessions in the database, ALL visible sessions display as "Pending Review".
fix: Expanded UnifiedHistoryRow status type to include "created"|"in_progress", updated row construction to include all sessions regardless of status, added badge rendering for new states (gray for Created, purple for In Progress), updated score cell to show "--" for non-completed sessions, added status filter dropdown options, added created_at field for proper sorting of sessions without completed_at, added i18n keys for both en-US and zh-CN.
verification: TypeScript check passes, frontend build succeeds, all 41 unit tests pass (35 existing + 6 new tests for the new statuses).
files_changed:
  - frontend/src/pages/user/session-history.tsx
  - frontend/src/pages/user/session-history.test.tsx
  - frontend/public/locales/en-US/scoring.json
  - frontend/public/locales/zh-CN/scoring.json
