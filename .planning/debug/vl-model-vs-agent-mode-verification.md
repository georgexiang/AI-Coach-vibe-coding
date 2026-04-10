---
status: awaiting_human_verify
trigger: "User needs to verify whether Voice Live sessions use Model mode vs Agent mode. No UI indicator or log to confirm which mode is active."
created: 2026-04-08T00:00:00Z
updated: 2026-04-08T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED — Mode now flows from backend proxy.connected through all layers to UI.
test: TypeScript compiles cleanly; 100 voice-related tests pass (1 pre-existing failure unrelated to this fix).
expecting: User verifies mode badge appears correctly in VoiceTestPlayground and VoiceSession shows correct agent/model mode.
next_action: Await human verification

## Symptoms

expected: When using Voice Live from VL Instance editor page, it should clearly indicate Model mode is in use. When using Voice Live from HCP profile page (with Agent configured), it should clearly indicate Agent mode is in use.
actual: No clear verification mechanism exists — user cannot confirm which mode the backend is actually using for a Voice Live session.
errors: No errors — this is about missing observability/verification
reproduction: Start a Voice Live session from either VL Instance page or HCP page — no UI indicator shows which mode (Model vs Agent) is being used
started: Always — no verification was ever built

## Eliminated

## Evidence

- timestamp: 2026-04-08T00:00:10Z
  checked: Backend voice_live_websocket.py — _load_connection_config (lines 40-239)
  found: Backend clearly differentiates Model vs Agent mode. Agent mode is used when ALL three conditions are met: (1) settings.voice_live_agent_mode_enabled is True, (2) HCP profile.agent_id exists, (3) profile.agent_sync_status == "synced". VL Instance path (line 184-237) always uses Model mode — no agent check. The result dict sets use_agent_mode=True/False accordingly.
  implication: Mode differentiation logic is correct and well-defined in the backend.

- timestamp: 2026-04-08T00:00:20Z
  checked: Backend voice_live_websocket.py — handle_voice_live_websocket (lines 409-525)
  found: Backend DOES send the mode field to the frontend in the proxy.connected message. Agent mode sends {"mode": "agent", "agent_name": ..., "model": ""} (line 454). Model mode sends {"mode": "model", "model": modelName} (line 512). Backend also logs which mode it uses: session_log.info("Voice Live connecting (agent mode)...") or "(model mode)".
  implication: The backend already provides sufficient signals — both in logs and in the WebSocket message.

- timestamp: 2026-04-08T00:00:30Z
  checked: Frontend use-voice-live.ts — proxy.connected handler (lines 140-150)
  found: The frontend hook receives proxy.connected and extracts avatarEnabled and model, but IGNORES the "mode" field entirely. Line 141-144: sessionResult = { avatarEnabled: msg.avatar_enabled, model: msg.model }. The msg.mode field (which is "agent" or "model") is never read or stored.
  implication: This is the primary gap — the mode information is available but discarded by the frontend.

- timestamp: 2026-04-08T00:00:40Z
  checked: Frontend use-voice-session-lifecycle.ts — StartSessionResult (lines 35-38)
  found: StartSessionResult only includes { avatarEnabled: boolean; model: string }. There is no "mode" field in the return type. The result propagated back to callers cannot convey whether it was agent or model mode.
  implication: The data type needs to be extended to include the mode.

- timestamp: 2026-04-08T00:00:50Z
  checked: Frontend voice-test-playground.tsx (VL Instance + HCP admin pages)
  found: VoiceTestPlayground has ZERO mode indicator in its UI. It shows Start button, AvatarView, transcript panel, and VoiceControls — no badge, no text, nothing showing which mode is active. The component doesn't even receive or track the mode.
  implication: Admin users using VL Instance editor or HCP profile editor cannot see what mode was used.

- timestamp: 2026-04-08T00:01:00Z
  checked: Frontend voice-session.tsx + mode-status-indicator.tsx (user-facing session)
  found: VoiceSession has a ModeStatusIndicator via VoiceSessionHeader that shows currentMode (a SessionMode type). However, the mode is hardcoded to "digital_human_realtime_model" (line 82) and only switches to "voice_realtime_model" if avatar fails (line 210). It never considers agent mode variants ("digital_human_realtime_agent" / "voice_realtime_agent") even though the SessionMode type defines them. The initVoice callback never reads the actual mode from the backend connection result.
  implication: Even in the user-facing session where a mode indicator exists, it always shows "realtime_model" regardless of whether agent mode is actually used.

- timestamp: 2026-04-08T00:01:10Z
  checked: Frontend types/voice-live.ts — SessionMode type
  found: SessionMode defines 7 modes including "voice_realtime_agent" and "digital_human_realtime_agent". These agent mode variants exist in the type system but are never selected by any runtime code path.
  implication: The type infrastructure for agent mode display is already in place but unused.

## Resolution

root_cause: The backend correctly differentiates Model vs Agent mode and sends a "mode" field ("agent" or "model") in the proxy.connected WebSocket message. However, the frontend discards this field in three places: (1) use-voice-live.ts ignores msg.mode when processing proxy.connected, only extracting avatarEnabled and model; (2) use-voice-session-lifecycle.ts StartSessionResult type lacks a mode field; (3) voice-session.tsx hardcodes currentMode to "digital_human_realtime_model" and never considers agent variants. Additionally, VoiceTestPlayground (used in admin pages) has no mode indicator at all.
fix: Wired the backend "mode" field through 4 frontend layers. (1) use-voice-live.ts now extracts msg.mode from proxy.connected into sessionResult. (2) use-voice-session-lifecycle.ts StartSessionResult now includes mode field and passes it through. (3) voice-session.tsx uses result.mode to select the correct SessionMode variant (agent vs model, with/without avatar). The onAvatarFailed fallback also preserves the agent/model distinction. (4) voice-test-playground.tsx now shows a colored "Agent Mode" or "Model Mode" badge in the header when a session is connected.
verification: TypeScript compiles cleanly. 100 voice-related tests pass including 6 new tests: 2 in voice-session.test.tsx (agent mode in header, digital_human_realtime_agent), 4 in voice-test-playground.test.tsx (no badge before connection, model mode badge, agent mode badge, badge cleared on stop). 1 pre-existing test failure in voice-test-playground "cleans up on unmount" is unrelated (confirmed by running against the original code).
files_changed:
  - frontend/src/hooks/use-voice-live.ts
  - frontend/src/hooks/use-voice-session-lifecycle.ts
  - frontend/src/components/voice/voice-session.tsx
  - frontend/src/components/voice/voice-test-playground.tsx
  - frontend/src/components/voice/voice-session.test.tsx
  - frontend/src/components/voice/voice-test-playground.test.tsx
  - frontend/src/hooks/use-voice-live.test.ts
