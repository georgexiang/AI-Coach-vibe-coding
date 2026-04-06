---
status: resolved
trigger: "Edit Voice Live Instance playground: 1) user voice input text not displayed, 2) content does not auto-scroll"
created: 2026-04-06T12:00:00Z
updated: 2026-04-06T18:30:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED - Three root causes addressed
test: Live session verified — user speech ("你好", "多说几句", "欢迎你的专业", etc.) displayed with "You:" prefix, AI responses displayed with "AI:" prefix, auto-scroll working on long AI responses
expecting: N/A — resolved
next_action: None — all fixes verified and pushed to GitHub (commit e4c43b2)

## Symptoms

expected: |
  1. Voice Live playground should display BOTH user speech transcripts AND AI responses
  2. As new messages appear, the conversation area should auto-scroll to show the latest content
actual: |
  1. Only AI responses are displayed (prefixed with "AI:"). User's voice input transcripts never shown.
  2. When conversation grows beyond visible area, user must manually scroll to see new content.
errors: No error messages - the feature silently doesn't work
reproduction: |
  1. Open http://localhost:5173/admin/voice-live/{id}/edit
  2. Click "Start" to begin a Voice Live session
  3. Speak to the AI via microphone
  4. Observe that only "AI: ..." text appears, no "You: ..." text
  5. Continue conversation until content exceeds visible area - no auto-scroll
started: Current state - features may never have been fully implemented

## Eliminated

## Evidence

- timestamp: 2026-04-06T12:01:00Z
  checked: Previous debug session (.planning/debug/voice-transcript-sync.md)
  found: A prior session identified the same backend root cause (missing input_audio_transcription) and fixed it, but the fix was NEVER committed (status: awaiting_human_verify, git diff shows no changes)
  implication: The backend fix needs to be re-applied

- timestamp: 2026-04-06T12:02:00Z
  checked: Backend voice_live_websocket.py lines 289-299
  found: RequestSession does NOT include input_audio_transcription. Comment says "intentionally NOT set." Without this, Azure never sends conversation.item.input_audio_transcription.completed events.
  implication: ROOT CAUSE #1 - User speech is never transcribed by Azure

- timestamp: 2026-04-06T12:03:00Z
  checked: VL Instance Editor onTranscript callback (vl-instance-editor.tsx lines 263-273)
  found: When segment with existing ID arrives, it REPLACES content entirely (next[idx] = seg). Delta events contain incremental text, not cumulative. Voice-session.tsx already has the accumulation fix but vl-instance-editor.tsx does not.
  implication: ROOT CAUSE #2 - Streaming AI text only shows last delta chunk, not accumulated text

- timestamp: 2026-04-06T12:04:00Z
  checked: VL Instance Editor transcript panel (vl-instance-editor.tsx lines 927-951)
  found: Transcript is rendered in a plain div with max-h-32 overflow-y-auto, but NO auto-scroll logic (no useEffect, no scrollRef). The VoiceTranscript component has auto-scroll but is NOT used here.
  implication: ROOT CAUSE #3 - No auto-scroll implementation in VL Instance Editor playground

- timestamp: 2026-04-06T12:08:00Z
  checked: Pre-existing test failures (5 in test_voice_live_websocket.py)
  found: Tests were already failing before changes because VideoParams mock was missing from the test SDK mock setup
  implication: Fixed by adding VideoParams mock - now all 26 tests pass

- timestamp: 2026-04-06T12:09:00Z
  checked: Full verification of all changes
  found: Backend ruff lint passes, 26/26 websocket tests pass. Frontend TypeScript build passes, npm build passes, 20/20 voice live hook tests pass, 10/10 voice transcript tests pass.
  implication: All changes are correct and don't introduce regressions

## Resolution

root_cause: THREE issues preventing proper transcript display in VL Instance Editor playground:
  1. BACKEND: voice_live_websocket.py does not include input_audio_transcription in Azure session config. Without it, Azure never transcribes user speech, so no user transcript events are sent.
  2. FRONTEND (delta): onTranscript callback in vl-instance-editor.tsx replaces segment content on update instead of accumulating delta text. Streaming assistant text only shows last chunk.
  3. FRONTEND (scroll): Transcript panel in vl-instance-editor.tsx uses plain overflow div with no auto-scroll logic. New messages are not scrolled into view.

fix: |
  1. Backend: Added AudioInputTranscriptionOptions(model='azure-fast-transcription') to RequestSession in voice_live_websocket.py, enabling Azure to transcribe user speech and send transcript events
  2. Frontend: Fixed onTranscript in vl-instance-editor.tsx to accumulate delta content when both existing and incoming segments are non-final (matching the pattern already used in voice-session.tsx)
  3. Frontend: Added transcriptPanelRef + useEffect to auto-scroll transcript div to bottom whenever transcripts change
  4. Test: Added missing VideoParams mock to test_voice_live_websocket.py, fixing 5 pre-existing test failures

verification: |
  - Backend ruff lint: passes
  - Backend tests: 26/26 pass (including 5 previously failing)
  - Frontend TypeScript: passes
  - Frontend build: passes
  - Frontend voice live hook tests: 20/20 pass
  - Frontend voice transcript tests: 10/10 pass

files_changed:
  - backend/app/services/voice_live_websocket.py
  - backend/tests/test_voice_live_websocket.py
  - frontend/src/pages/admin/vl-instance-editor.tsx
