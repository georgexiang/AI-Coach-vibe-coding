---
status: awaiting_human_verify
trigger: "Session History detail page (View Details) shows no message/conversation history"
created: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - The scoring-feedback.tsx page (View Details target) never calls useSessionMessages hook, so no conversation transcript is rendered
test: Verified by reading scoring-feedback.tsx - it uses useSessionScore, useSessionReport, useCombinedScore but NOT useSessionMessages
expecting: Need to add a conversation transcript section to scoring-feedback.tsx
next_action: Implement conversation history section in scoring-feedback.tsx using existing useSessionMessages hook

## Symptoms

expected: When viewing session details, users should see the full conversation history - all messages exchanged between the MR and AI HCP during training
actual: Detail page shows scoring information but NOT the message history. History list shows "14 messages" or "3 messages" but detail view doesn't display them
errors: No error messages - missing feature/display issue
reproduction: Go to History page, click "View Details" on a scored session, observe no conversation messages
started: Feature gap - conversation history was never rendered in the detail view

## Eliminated

## Evidence

- timestamp: 2026-05-18T00:01:00Z
  checked: frontend/src/pages/user/session-history.tsx navigation target
  found: "View Details" navigates to /user/scoring/${session_id} which renders scoring-feedback.tsx
  implication: scoring-feedback.tsx is the detail page

- timestamp: 2026-05-18T00:02:00Z
  checked: scoring-feedback.tsx imports and hooks used
  found: Uses useSessionScore, useSessionReport, useCombinedScore, useSession but NOT useSessionMessages
  implication: Messages are never fetched or rendered on the detail page

- timestamp: 2026-05-18T00:03:00Z
  checked: Backend API endpoint GET /sessions/{session_id}/messages
  found: Endpoint exists at line 261-274 of backend/app/api/sessions.py, returns list[MessageResponse]
  implication: Backend already supports fetching messages - only frontend rendering is missing

- timestamp: 2026-05-18T00:04:00Z
  checked: Frontend API layer (api/sessions.ts and hooks/use-session.ts)
  found: getSessionMessages() function and useSessionMessages() hook already exist and are functional
  implication: Only the UI rendering in scoring-feedback.tsx needs to be added

## Resolution

root_cause: The scoring-feedback.tsx page (session detail "View Details" target) never calls useSessionMessages and has no UI section to display conversation history. All the plumbing exists (backend endpoint, frontend API function, TanStack Query hook) but the component simply never uses them.
fix: Added collapsible "Conversation History" section to scoring-feedback.tsx using existing useSessionMessages hook and ChatBubble component. Messages display with role labels (MR/HCP), timestamps, and proper chat bubble styling. Section is collapsible for users who want to focus on scoring. Added i18n keys for both en-US and zh-CN.
verification: TypeScript compiles cleanly. Frontend build succeeds. All 27 tests pass (22 existing + 5 new conversation history tests).
files_changed:
  - frontend/src/pages/user/scoring-feedback.tsx
  - frontend/src/pages/user/scoring-feedback.test.tsx
  - frontend/public/locales/en-US/scoring.json
  - frontend/public/locales/zh-CN/scoring.json
