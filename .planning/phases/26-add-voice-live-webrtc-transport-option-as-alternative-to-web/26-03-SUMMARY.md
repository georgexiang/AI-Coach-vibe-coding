---
plan: 03
phase: 26-add-voice-live-webrtc-transport-option-as-alternative-to-web
status: complete
started: 2026-05-22T20:30:00Z
completed: 2026-05-22T20:45:00Z
tasks_completed: 2
tasks_total: 2
commits:
  - 8efe266
---

# Plan 26-03 Summary: UI Transport Selector Integration

## What Was Done

### Task 1: VoiceTransportSelect component and i18n keys
- Created `frontend/src/components/voice/voice-transport-select.tsx` — Select dropdown with WebSocket (default) and WebRTC (Preview) options
- Added barrel export in `frontend/src/components/voice/index.ts`
- Added `transport` i18n section to both `en-US/voice.json` and `zh-CN/voice.json` with keys: label, websocket, webrtc, avatarUnavailable, connectionFailed, reconnecting

### Task 2: Wire transport into voice-session and lifecycle
- Added `useState<VoiceTransport>("websocket")` transport state
- Instantiated both `useVoiceLive` (renamed to `voiceLiveWs`) and `useVoiceLiveWebRTC` (`voiceLiveWebRtc`) unconditionally (React hooks rules)
- Added conditional selection: `const voiceLive = transport === "webrtc" ? voiceLiveWebRtc : voiceLiveWs`
- Added `VoiceTransportSelect` to start overlay (disabled after session starts)
- Added avatar warning toast for `digital_human` + WebRTC combination
- Fixed WebRTC hook's `connect()` return type to include `mode` field (type compatibility with lifecycle hook)

## Verification

- `npx tsc --noEmit` — passes (0 errors)
- `npm run build` — succeeds (3.95s)
- All acceptance criteria met:
  - Transport selector visible before session starts ✓
  - WebRTC labeled "(Preview)" ✓
  - WebSocket is default ✓
  - Dual hook instantiation with conditional selection ✓
  - Avatar warning for digital_human + WebRTC ✓
  - i18n complete in en-US and zh-CN ✓

## Files Modified
- `frontend/src/components/voice/voice-transport-select.tsx` (new)
- `frontend/src/components/voice/voice-session.tsx` (modified)
- `frontend/src/components/voice/index.ts` (modified)
- `frontend/src/hooks/use-voice-live-webrtc.ts` (modified — added `mode` to connect return)
- `frontend/public/locales/en-US/voice.json` (modified)
- `frontend/public/locales/zh-CN/voice.json` (modified)
