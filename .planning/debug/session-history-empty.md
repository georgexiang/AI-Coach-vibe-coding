---
status: awaiting_human_verify
trigger: "After ending two training sessions, the user history page at /user/history shows NO records at all."
created: 2026-05-08T00:00:00Z
updated: 2026-05-08T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two bugs prevent voice sessions from being scored
test: trace full lifecycle from session creation to history display
expecting: URL mismatch causes 405, sessions never reach "scored" status
next_action: implement fix - add backend transcript persistence endpoint + fix frontend URL

## Symptoms

expected: After completing training sessions (clicking end session), the /user/history page should show completed sessions with their scores, timestamps, and links to detailed scoring/improvement plans.
actual: /user/history shows empty - no training records appear even after completing 2 sessions
errors: No visible error messages (405 swallowed by frontend catch)
reproduction: 1. Start a training session on /user/training 2. Click end session 3. Navigate to /user/history 4. No records shown
started: The sessions were just completed. The end session flow navigates to /user/scoring/{id} on success or /user/training on failure.

## Eliminated

- hypothesis: History page queries wrong endpoint
  evidence: Frontend calls GET /api/v1/scoring/history, backend has matching route at /scoring/history
  timestamp: 2026-05-08T00:00:30Z

- hypothesis: Scoring page useEffect infinite loop prevents scoring
  evidence: Even if effect fires multiple times, server-side scoring still executes; though onSuccess may not fire, this is secondary to the session never reaching "completed" state
  timestamp: 2026-05-08T00:00:45Z

## Evidence

- timestamp: 2026-05-08T00:00:10Z
  checked: session-history.tsx data source
  found: Uses useScoreHistory(50) -> GET /scoring/history which filters by status=="scored"
  implication: Sessions must be "scored" to appear in history

- timestamp: 2026-05-08T00:00:20Z
  checked: Session lifecycle: end_session requires status "in_progress"
  found: end_session raises 409 if session.status != "in_progress"
  implication: Session must transition from "created" to "in_progress" before it can be ended

- timestamp: 2026-05-08T00:00:30Z
  checked: How sessions transition to "in_progress"
  found: Only save_message transitions created->in_progress (on first user message, message_index==0)
  implication: At least one message must be saved via save_message for session to progress

- timestamp: 2026-05-08T00:00:40Z
  checked: persistTranscriptMessage URL in frontend/src/api/voice-live.ts
  found: Calls POST /sessions/${sessionId}/messages (PLURAL)
  implication: URL mismatch with backend

- timestamp: 2026-05-08T00:00:45Z
  checked: Backend routes in sessions.py
  found: POST /{session_id}/message (SINGULAR) exists, GET /{session_id}/messages (PLURAL) exists, NO POST /{session_id}/messages
  implication: persistTranscriptMessage gets 405 Method Not Allowed - transcripts never saved

- timestamp: 2026-05-08T00:00:50Z
  checked: unified-session.tsx confirmEndSession
  found: Promise.all(pendingFlushesRef) runs BEFORE try/catch for endSession. If pending flushes already settled via .finally(), array is empty and Promise.all resolves. End session then runs but fails with 409 because session is still "created".
  implication: End session fails silently (catches error, navigates to /user/training)

- timestamp: 2026-05-08T00:00:55Z
  checked: Voice live WebSocket handler
  found: Does NOT persist messages to database - relies entirely on frontend persistTranscriptMessage
  implication: Without a working persistence endpoint, voice sessions have no messages and never transition

## Resolution

root_cause: Two-part failure chain:
  1. Frontend persistTranscriptMessage calls POST /sessions/{id}/messages (PLURAL) but backend only has POST /sessions/{id}/message (SINGULAR) and GET /sessions/{id}/messages (PLURAL). The POST gets 405 Method Not Allowed.
  2. Without messages being persisted, save_message is never called, session never transitions from "created" to "in_progress". When user clicks end session, end_session rejects with 409 (wrong status). The catch block navigates to /user/training silently.
  3. Sessions stay "created" forever, never get scored, never appear in history.

fix: |
  1. Added POST /sessions/{id}/transcript backend endpoint (TranscriptMessageRequest schema with role field) that persists messages and transitions session status without triggering LLM/SSE.
  2. Fixed frontend persistTranscriptMessage to call /sessions/{id}/transcript instead of /sessions/{id}/messages.
  3. Fixed scoring-feedback useEffect dependency to remove unstable triggerScoring object (prevents re-fire loops).
verification: |
  - Backend ruff check passes on modified files
  - Frontend TypeScript compiles cleanly (npx tsc --noEmit)
  - voice-live.test.ts: 24/24 pass
  - scoring-feedback.test.tsx: 20/20 pass
  - unified-session.test.tsx: 13/13 pass
  - Backend session tests: 232 pass (5 failures are pre-existing Azure/suggestion tests)
  - Requires end-to-end verification: start voice session, end it, check /user/history
files_changed:
  - backend/app/api/sessions.py
  - backend/app/schemas/session.py
  - frontend/src/api/voice-live.ts
  - frontend/src/pages/user/scoring-feedback.tsx
  - frontend/src/api/voice-live.test.ts
