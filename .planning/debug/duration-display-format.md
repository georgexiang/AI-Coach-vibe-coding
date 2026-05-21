---
status: awaiting_human_verify
trigger: "Duration column shows '14288:49' instead of reasonable format like '14:49'"
created: 2026-05-18T00:00:00Z
updated: 2026-05-18T15:35:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two-part problem: (1) Backend calculates duration as wall-clock time from started_at to completed_at, which is wrong for sessions left idle for days; (2) Frontend formatDuration only handles MM:SS, so large second values display as absurd minute counts
test: Database query confirmed session 6ed6b7d6 has duration_seconds=857329 (10 days of wall-clock time), formatDuration(857329) = "14288:49"
expecting: Fix both the formatting and the root cause of inflated durations
next_action: Await human verification

## Symptoms

expected: Duration should display in a reasonable format like "MM:SS" or "HH:MM:SS" (e.g., "14:49" for a ~15 minute session)
actual: Duration displays "14288:49" - an impossibly large number suggesting either wrong unit conversion or raw seconds being displayed incorrectly
errors: No errors visible - just wrong display value
reproduction: Go to Session History page, look at the Duration column for any scored session
started: Likely present since the history page was implemented

## Eliminated

## Evidence

- timestamp: 2026-05-18T15:30:00Z
  checked: Frontend formatDuration function at session-history.tsx:212-217
  found: Function correctly divides seconds by 60 for minutes, mod 60 for remaining seconds. Logic is correct for small values but only produces MM:SS format (no hour handling).
  implication: Not a unit conversion bug -- the function is mathematically correct but doesn't handle large values gracefully.

- timestamp: 2026-05-18T15:31:00Z
  checked: Database values in ai_coach.db
  found: Session 6ed6b7d6 has duration_seconds=857329, started_at=2026-05-08 06:26:21, completed_at=2026-05-18 04:35:11. This is 10 days of wall-clock time.
  implication: The backend correctly calculated (now - started_at).total_seconds() but this is misleading because the session was left idle for days between its last interaction and when it was formally ended.

- timestamp: 2026-05-18T15:32:00Z
  checked: Backend end_session function in session_service.py:258-276
  found: Calculates int((now - started).total_seconds()) without considering whether the session was actually active during that entire period.
  implication: Root cause confirmed - stale sessions get inflated duration values.

- timestamp: 2026-05-18T15:33:00Z
  checked: Session 6ed6b7d6 mode and message count
  found: mode="text", 6 messages. A real session that had activity on May 8 but was only formally ended on May 18.
  implication: The user started a session, interacted, then left it open. When they ended it (or it was cleaned up) 10 days later, duration was calculated as 10 days.

## Resolution

root_cause: Two-part issue. (1) Backend end_session calculates duration as pure wall-clock time (completed_at - started_at), which produces absurdly large values for sessions left idle for days before being ended. (2) Frontend formatDuration only handles MM:SS format, so 857329 seconds displays as "14288:49" instead of using HH:MM:SS or capping at a reasonable maximum.
fix: (1) Frontend - Updated formatDuration to show HH:MM:SS for durations >= 1 hour, and cap display at 24 hours max. (2) Backend - Updated end_session to use the last message timestamp as the effective end time if the session has been idle for > 1 hour, preventing inflated durations for stale/abandoned sessions.
verification: TypeScript compiles clean. Backend tests pass (14/14, excluding 2 pre-existing unrelated failures). Duration test "formats duration correctly" passes (1800s -> "30:00").
files_changed: [frontend/src/pages/user/session-history.tsx, backend/app/services/session_service.py]
