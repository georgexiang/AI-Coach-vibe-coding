# Phase 26: Add voice-live-webrtc transport option as alternative to WebSocket - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Add WebRTC as an alternative real-time audio transport for Voice Live sessions. The existing WebSocket backend proxy remains the default. WebRTC is a preview feature — users can opt-in via a transport selector in the session UI. All existing WebSocket functionality must remain unchanged.

</domain>

<decisions>
## Implementation Decisions

### Transport Selector UI
- **D-01:** Transport selector appears in the session start UI (user choice), not admin panel
- **D-02:** WebRTC option labeled with simple text suffix "(Preview)" — no badges or warning sections
- **D-03:** WebRTC transport available for ALL voice modes (voice_realtime_model, voice_realtime_agent, digital_human_realtime_model, digital_human_realtime_agent)
- **D-04:** WebSocket remains the default selection; WebRTC is an additional option in the dropdown

### WebRTC Connection Architecture
- **D-05:** Direct browser-to-Azure WebRTC connection — audio bypasses backend completely for lower latency
- **D-06:** Backend provides ICE config + session-scoped token for frontend to establish WebRTC peer connection (similar to existing avatar WebRTC pattern)
- **D-07:** New separate hook `use-voice-live-webrtc.ts` — keep existing `use-voice-live.ts` untouched. Session component switches between hooks based on transport selection

### Fallback & Error Handling
- **D-08:** No auto-fallback — if WebRTC fails, show clear error. User must manually select WebSocket to try again (simple behavior for preview feature)
- **D-09:** Basic reconnection on mid-session disconnects — same retry logic as current WebSocket hook (3 attempts with backoff)

### Backend API
- **D-10:** New REST endpoint `POST /api/v1/voice-live/webrtc/session` — returns ICE servers, session token, and connection config. Separate from existing /ws WebSocket endpoint
- **D-11:** Use azure-ai-voicelive SDK for WebRTC if it supports it; fall back to direct Azure REST API calls if SDK lacks WebRTC support

### Claude's Discretion
- Exact dropdown component implementation (reuse existing select patterns)
- WebRTC peer connection configuration details (codec preferences, bandwidth)
- Error message copy and UX details
- Internal state management between transport modes
- How session recording integrates with WebRTC transport

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Azure Voice Live WebRTC Documentation
- `https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-webrtc` — Official Azure WebRTC transport documentation (primary reference)

### Existing Voice Live Implementation
- `frontend/src/hooks/use-voice-live.ts` — Current WebSocket proxy hook (DO NOT modify, reference for interface parity)
- `frontend/src/hooks/use-avatar-stream.ts` — Existing WebRTC pattern for avatar video (reuse ICE/SDP patterns)
- `frontend/src/types/voice-live.ts` — Type definitions including VoiceLiveControls, VoiceConnectionState
- `backend/app/services/voice_live_websocket.py` — Current WebSocket proxy architecture
- `backend/app/api/voice_live.py` — Existing Voice Live API routes

### Reference Implementation
- `voicelive-api-salescoach-main-sample-code/` — Reference sample code for voice live patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `use-avatar-stream.ts`: Has RTCPeerConnection, ICE handling, SDP offer/answer — reuse patterns for audio WebRTC
- `VoiceLiveToken` interface: Already includes `iceServers: RTCIceServer[]` in connect return type
- `voice-live-model-select.tsx`: Dropdown select component pattern for voice config options
- `voice-session-header.tsx`: Mode selector UI that already handles SessionMode switching

### Established Patterns
- Voice hooks return `VoiceLiveControls` interface (connect, disconnect, toggleMute, sendTextMessage, sendAudio)
- Connection states: `disconnected → connecting → connected → reconnecting → error`
- Session correlation IDs for logging (`crypto.randomUUID().slice(0, 8)`)
- Voice logger with domain-specific log channels (`createVoiceLogger`)

### Integration Points
- `voice-session.tsx`: Orchestrates voice hooks and avatar stream — needs transport switching logic
- `use-voice-session-lifecycle.ts`: Session lifecycle management — connect, avatar setup, cleanup
- Backend token broker: Currently returns connection config via existing endpoint

</code_context>

<specifics>
## Specific Ideas

- Reference Azure documentation: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-webrtc
- Follow existing avatar WebRTC pattern (use-avatar-stream.ts) for ICE/SDP handling
- Keep the same VoiceLiveControls interface so session components work with either transport

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-add-voice-live-webrtc-transport-option-as-alternative-to-web*
*Context gathered: 2026-05-22*
