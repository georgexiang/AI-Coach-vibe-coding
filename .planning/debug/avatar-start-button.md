---
status: awaiting_human_verify
trigger: "Avatar mode: add Start button before session begins, matching AI Foundry UX"
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:01Z
---

## Current Focus

hypothesis: Feature implemented - Start button overlay gates voice session initialization
test: TypeScript build clean, all 189 voice tests pass (including 4 new start button tests)
expecting: User confirms the Start button appears and works correctly in their environment
next_action: Await human verification

## Symptoms

expected: When avatar enabled, show centered Start button (with audio wave icon) before session starts. Click initiates voice + avatar. Matches AI Foundry UX.
actual: Session auto-starts on mount with no user-initiated start action
errors: N/A - new feature
reproduction: N/A
started: New feature request

## Eliminated

(none)

## Evidence

- timestamp: 2026-04-04T00:00:00Z
  checked: voice-session.tsx line 155-229
  found: useEffect on mount auto-calls initVoice() which connects WebSocket, audio, and avatar
  implication: Need to wrap initVoice in a callback triggered by Start button click

- timestamp: 2026-04-04T00:00:00Z
  checked: avatar-view.tsx
  found: Shows skeleton during connecting, AudioOrb when not connected, video when avatar connected
  implication: Before session starts, we need a new visual state showing Start button overlay

- timestamp: 2026-04-04T00:00:00Z
  checked: voice-controls.tsx
  found: Controls already handle disabled state when not connected
  implication: Controls will naturally show disabled state before Start is clicked

- timestamp: 2026-04-04T00:00:00Z
  checked: i18n files (en-US/zh-CN voice.json)
  found: Already has "startSession" key in both languages
  implication: Can reuse existing i18n key, may need additional keys for Start button

## Resolution

root_cause: Feature gap - session auto-connected on mount via useEffect without user-initiated Start action
fix: Added sessionStarted state gating voice initialization behind Start button click. Extracted initVoice to reusable callback, useEffect only triggers when sessionStarted=true. Start button overlay with AudioLines icon and i18n text shown before session begins, disappears once clicked.
verification: TypeScript build clean (tsc -b + vite build), all 189 voice tests pass including 4 new start button tests
files_changed:
  - frontend/src/components/voice/voice-session.tsx
  - frontend/src/components/voice/voice-session.test.tsx
  - frontend/public/locales/en-US/voice.json
  - frontend/public/locales/zh-CN/voice.json
