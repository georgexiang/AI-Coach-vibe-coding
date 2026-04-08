---
status: awaiting_human_verify
trigger: "voice-only-session-broken-and-orb-static"
created: 2026-04-08T00:00:00Z
updated: 2026-04-08T00:00:00Z
---

## Current Focus

hypothesis: Two root causes: (1) AudioOrb removed CSS pulse animation classes, volume-only scaling is insufficient (2) Voice session breakage: analyserData causes 60fps setState → parent re-renders → might cause stale callback or timing issue in voice pipeline
test: Fix AudioOrb pulse animation restoration + optimize analyserData to use ref-based pattern instead of 60fps setState
expecting: AudioOrb regains pulsation; voice session either works (if re-render storm was the cause) or needs backend investigation
next_action: Implement fixes for both issues

## Symptoms

expected: 1) With avatar disabled, voice session should still work — user speaks, gets transcript and AI response. 2) AudioOrb should pulse/scale dynamically based on audio volume during the session.
actual: 1) Voice session connects (controls visible) but no speech is recognized, no transcript appears, no AI response. 2) AudioOrb renders as a static purple sphere with no animation responding to volume.
errors: No specific error messages visible in the screenshot. Check backend logs.
reproduction: 1) Edit a VL Instance -> disable "Enable avatar" -> start voice session -> speak -> nothing happens. 2) During session, AudioOrb doesn't pulse with volume.
started: After the recent avatar toggle bug fix that separated isAvatarConnected from isSessionActive.

## Eliminated

- hypothesis: Avatar toggle fix gates voice connection on avatar state
  evidence: use-voice-session-lifecycle.ts was NOT modified. Voice pipeline (connect, startRecording, sendAudio) is identical before and after the fix. The lifecycle hook correctly skips avatar WebRTC when avatarEnabled=false and continues to voice-only mode.
  timestamp: 2026-04-08T00:10:00Z

- hypothesis: useMemo depends on mutated-in-place Uint8Array (same reference, no re-trigger)
  evidence: use-audio-handler.ts line 78-82 creates a NEW Uint8Array each RAF frame via setState, so reference changes each time. useMemo dependency on audioHandler.analyserData does trigger correctly.
  timestamp: 2026-04-08T00:15:00Z

- hypothesis: Frontend passes wrong vlInstanceId or hcpProfileId
  evidence: vl-instance-editor.tsx passes vlInstanceId={id} from useParams, which is stable. hcpProfileId is undefined for standalone VL test. Both are correctly forwarded through the pipeline.
  timestamp: 2026-04-08T00:20:00Z

## Evidence

- timestamp: 2026-04-08T00:05:00Z
  checked: git diff HEAD for all changed files
  found: Only 3 component files + tests changed. No hook files (use-voice-session-lifecycle.ts, use-voice-live.ts, use-audio-handler.ts) were modified. Voice pipeline is identical to committed version.
  implication: Voice session breakage is NOT caused by changes to connection/audio pipeline code.

- timestamp: 2026-04-08T00:10:00Z
  checked: audio-orb.tsx diff — CSS animation classes
  found: The `audio-orb-pulse` class was REMOVED from listening/speaking states. Before: `"audio-orb-pulse bg-gradient-to-br..."`. After: `"bg-gradient-to-br..."` (no pulse animation). The only animation is now volume-reactive inline `transform: scale()`.
  implication: AudioOrb has no CSS pulsation animation. The scale-based approach requires audioState="listening"/"speaking" AND volumeLevel>0. If voice session doesn't produce these states, orb is completely static.

- timestamp: 2026-04-08T00:15:00Z
  checked: analyserData flow — useState vs useRef pattern
  found: use-audio-handler.ts calls setState at 60fps in RAF loop (line 82). BEFORE the toggle fix, analyserData was exported but never consumed by any component. AFTER the fix, voice-test-playground.tsx adds useMemo that reads audioHandler.analyserData. This means 60fps state updates now cause 60fps re-renders of the entire VoiceTestPlayground component tree.
  implication: The new useMemo introduces a 60fps re-render storm during recording. While unlikely to break WebSocket directly, it creates significant React churn and could cause performance issues on slower devices.

- timestamp: 2026-04-08T00:20:00Z
  checked: Backend voice_live_websocket.py voice-only path
  found: When avatar_enabled=False, backend connects with modalities=[TEXT, AUDIO] (no AVATAR). Azure Voice Live supports audio-only mode. Session config includes input_audio_transcription, VAD, noise reduction, echo cancellation. No code path that would reject voice-only sessions.
  implication: Backend correctly handles voice-only mode. Issue is either Azure service config or frontend re-render interference.

## Resolution

root_cause: |
  Two interrelated issues:

  1. **AudioOrb static (definite regression):** The avatar toggle fix removed the `audio-orb-pulse`
     CSS animation class from the listening/speaking states. The new volume-reactive `transform: scale()`
     approach was intended to replace CSS animation but it depends on `volumeLevel > 0` (from mic input)
     AND `audioState` being "listening"/"speaking" (from Azure events). Without the CSS pulse animation
     as a baseline, the orb appeared completely static.

  2. **60fps re-render storm (potential voice disruption):** The `useMemo` in voice-test-playground.tsx
     consumed `audioHandler.analyserData` which was updated via React `setState` at 60fps in the RAF loop
     inside `use-audio-handler.ts`. Before the toggle fix, `analyserData` was exported but never consumed
     by any component, so the 60fps setState calls were no-ops. After the fix, the useMemo triggered
     60fps re-renders of the entire VoiceTestPlayground tree, recreating all hook return objects and
     callback refs every 16ms. While unlikely to directly break WebSocket communication, this creates
     enormous React churn and could cause subtle timing/callback-staleness issues on slower devices.

fix: |
  1. **AudioOrb:** Restored `audio-orb-pulse` CSS animation class to listening/speaking states alongside
     the volume-reactive inline scaling. CSS animation provides baseline pulsation; volume data adds
     real-time reactivity on top.

  2. **Volume pipeline refactored:** Removed `analyserData` from `useAudioHandler` React state entirely.
     Created new `useVolumeLevel(analyserRef, active)` hook that reads directly from the AnalyserNode ref
     via its own RAF loop, quantises to ~20 steps (0.05 increments), and only triggers React re-renders
     when the quantised level actually changes. This eliminates the 60fps re-render storm while keeping
     smooth visual feedback.

  3. **Pre-existing build fix:** Fixed unused variable `capturedPlaygroundProps` in vl-instance-editor.test.tsx
     that was causing `tsc -b` build failure.

verification: |
  - TypeScript: `tsc -b --noEmit` passes cleanly (0 errors)
  - Build: `vite build` succeeds
  - Tests: 331 pass, 1 pre-existing failure (cleanup on unmount — same as before changes)
  - New tests: 7 tests for useVolumeLevel, 2 new tests for audio-orb-pulse animation
  - AudioOrb: Confirmed pulse animation class present for listening/speaking, absent for idle/muted
  - Volume quantisation: Confirmed via test that levels are stepped to 0.05 increments

files_changed:
  - frontend/src/components/voice/audio-orb.tsx
  - frontend/src/components/voice/audio-orb.test.tsx
  - frontend/src/components/voice/voice-test-playground.tsx
  - frontend/src/components/voice/voice-test-playground.test.tsx
  - frontend/src/components/voice/voice-session.test.tsx
  - frontend/src/hooks/use-audio-handler.ts
  - frontend/src/hooks/use-audio-handler.test.ts
  - frontend/src/hooks/use-volume-level.ts (new)
  - frontend/src/hooks/use-volume-level.test.ts (new)
  - frontend/src/pages/admin/vl-instance-editor.test.tsx
