---
status: awaiting_human_verify
trigger: "Bug 2: During voice live conversation, user speech and AI response should display as real-time text transcription on screen"
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED
test: TypeScript build, npm build, 174 unit tests all pass
expecting: User speech and AI response will now display as real-time text transcript
next_action: Awaiting human verification in live voice session

## Symptoms

expected: During voice conversation, both user's speech and AI's response should appear as text on screen in real-time, like a live chat transcript with timestamps
actual: Voice conversation works but there's no real-time text transcript displayed (per user report)
errors: No errors - feature needs to be properly integrated into the UI
reproduction: Start a voice live session in model mode, speak - observe no text appears
started: Transcript data may already be available from the WebSocket but not displayed properly

## Eliminated

## Evidence

- timestamp: 2026-04-04T00:01:00Z
  checked: use-voice-live.ts onTranscript callback dispatch
  found: Hook dispatches onTranscript for 5 event types including user and assistant transcripts
  implication: Backend DOES forward transcript events from Azure and the hook DOES parse them

- timestamp: 2026-04-04T00:02:00Z
  checked: voice-session.tsx handleTranscript and VoiceTranscript rendering
  found: handleTranscript accumulates segments by ID. VoiceTranscript renders at h-[200px] but without timestamps
  implication: UI rendering chain IS implemented but missing timestamps

- timestamp: 2026-04-04T00:03:00Z
  checked: Delta ID construction and content handling
  found: Delta events use same ID (correct for update-in-place) but only contain incremental text. handleTranscript REPLACES content entirely so only the last chunk is visible
  implication: Streaming text flickers - only last delta chunk shown, not accumulated

- timestamp: 2026-04-04T00:04:00Z
  checked: Backend session config (voice_live_websocket.py) vs Azure requirements
  found: RequestSession does NOT include input_audio_transcription config. Azure Voice Live requires this to send user speech transcription events. SDK has AudioInputTranscriptionOptions(model='azure-fast-transcription')
  implication: PRIMARY root cause - user speech is never transcribed

- timestamp: 2026-04-04T00:05:00Z
  checked: Reference implementation (voicelive-api-salescoach-main-sample-code)
  found: Reference impl only handles .done events, not .delta for streaming. Uses crypto.randomUUID() per message
  implication: Delta accumulation approach in our code needed fixing

- timestamp: 2026-04-04T00:06:00Z
  checked: Azure SDK AudioInputTranscriptionOptions availability
  found: Confirmed AudioInputTranscriptionOptions exists in azure-ai-voicelive SDK and accepts model='azure-fast-transcription'. RequestSession accepts input_audio_transcription field.
  implication: Fix is SDK-compatible

## Resolution

root_cause: TWO issues preventing real-time transcript display:
  1. BACKEND (PRIMARY): voice_live_websocket.py did not include input_audio_transcription in the Azure session config. Without this, Azure never sends conversation.item.input_audio_transcription.completed events, so user speech-to-text never happens.
  2. FRONTEND: handleTranscript in voice-session.tsx replaced segment content entirely on update. Since response.audio_transcript.delta sends incremental text chunks (not cumulative), each delta overwrote the previous, showing only the last chunk instead of building up the full assistant response during streaming.

fix: Three changes applied:
  1. Backend: Added AudioInputTranscriptionOptions(model='azure-fast-transcription') to the RequestSession in voice_live_websocket.py, enabling Azure to transcribe user speech
  2. Frontend: Modified handleTranscript in voice-session.tsx to ACCUMULATE delta content when both existing and incoming segments are non-final, instead of replacing. Final events still replace with complete content.
  3. Frontend: Added timestamp display (HH:MM:SS) to each transcript message in voice-transcript.tsx, with proper alignment (right for user, left for assistant)

verification: TypeScript build passes, npm build passes, 174/174 unit tests pass (10 test files), 3 new timestamp tests added, ruff lint passes on backend

files_changed:
  - backend/app/services/voice_live_websocket.py
  - frontend/src/components/voice/voice-session.tsx
  - frontend/src/components/voice/voice-transcript.tsx
  - frontend/src/components/voice/voice-transcript.test.tsx
