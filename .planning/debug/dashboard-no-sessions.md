---
status: awaiting_human_verify
trigger: "Dashboard page shows 'No sessions yet' but History page shows 5 sessions"
created: 2026-05-17T00:00:00Z
updated: 2026-05-17T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - Dashboard only shows "scored" sessions but all 5 sessions are "completed" (not scored). Dashboard needs to also show completed sessions or trigger scoring.
test: Verified DB has 0 scored sessions, 5 completed, dashboard filters on status=="scored" only
expecting: Fix should make dashboard show completed sessions too (like History page does)
next_action: Fix dashboard to show completed sessions in addition to scored sessions, and fix stats to count completed sessions

## Symptoms

expected: Dashboard should show recent training sessions, correct session count (at least 5), and average score
actual: Dashboard shows "No sessions yet", "0 Sessions Completed", "0 Average Score". Only "This Week: 7" has a value.
errors: No visible errors in the UI
reproduction: Navigate to http://localhost:5173/user/dashboard while logged in as Zhang Wei
started: Unknown - History page works fine showing 5 sessions

## Eliminated

## Evidence

- timestamp: 2026-05-17T00:01:00Z
  checked: Database session statuses
  found: 5 sessions with status "completed", 1 "in_progress", 153 "created", 0 "scored". 0 records in session_scores table. All overall_score values are NULL.
  implication: No sessions have been through the scoring workflow yet.

- timestamp: 2026-05-17T00:02:00Z
  checked: Dashboard data sources
  found: Dashboard uses useScoreHistory(5) which calls GET /scoring/history?limit=5 - this queries CoachingSession WHERE status=="scored", returns empty. useDashboardStats() calls GET /analytics/dashboard which also filters on status=="scored" for total_sessions and avg_score.
  implication: Dashboard shows 0 because it only counts scored sessions.

- timestamp: 2026-05-17T00:03:00Z
  checked: History page data sources
  found: History page uses BOTH useScoreHistory(50) AND useUserSessions({page:1, page_size:100}). useUserSessions fetches ALL sessions regardless of status. The unified rows merge both data sources, so completed sessions appear even without scores.
  implication: History page works because it shows all sessions; Dashboard fails because it only shows scored ones.

- timestamp: 2026-05-17T00:04:00Z
  checked: "This Week" stat calculation
  found: In analytics_service.get_user_dashboard_stats, "this_week" counts ANY session created in last 7 days (no status filter). total_sessions and avg_score filter on status=="scored".
  implication: Explains why "This Week: 7" has a value but other stats show 0.

## Resolution

root_cause: Dashboard only queries sessions with status=="scored" (both for stats and recent sessions list), but all 5 user sessions have status "completed" (never been through the scoring workflow). The History page works because it additionally fetches ALL sessions via useUserSessions().
fix: 1) Backend: modify get_user_dashboard_stats to count "completed" + "scored" sessions for total_sessions via status.in_(["completed","scored"]). 2) Frontend: modify Dashboard to also fetch user sessions via useUserSessions and merge completed sessions into the recent list. 3) Update SessionItem component to accept null scores and display "--" placeholder.
verification: TypeScript compiles cleanly. Frontend build succeeds. All existing tests pass (except 1 pre-existing unrelated failure). Backend analytics tests (35 tests) all pass. Direct DB query confirms total_sessions=5 after fix.
files_changed: [backend/app/services/analytics_service.py, frontend/src/pages/user/dashboard.tsx, frontend/src/components/shared/session-item.tsx, frontend/src/pages/user/dashboard.test.tsx]
