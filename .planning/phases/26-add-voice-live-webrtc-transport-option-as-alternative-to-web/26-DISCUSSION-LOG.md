# Phase 26: Add voice-live-webrtc transport option - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 26-add-voice-live-webrtc-transport-option-as-alternative-to-web
**Areas discussed:** Transport selector placement & UI, WebRTC connection architecture, Fallback & error handling, Backend API changes

---

## Transport Selector Placement & UI

| Option | Description | Selected |
|--------|-------------|----------|
| Admin VL instance config only | Admin sets transport per VL instance in config panel | |
| Session start UI (user choice) | User picks transport when starting a voice session | ✓ |
| Both admin default + user override | Admin sets default, user can override | |

**User's choice:** Session start UI (user choice)
**Notes:** User wants direct user-facing control

---

| Option | Description | Selected |
|--------|-------------|----------|
| Badge/tag next to option | Show 'Preview' badge with tooltip | |
| Separate section with warning | Visually distinct 'Experimental' section | |
| Simple text suffix | Append '(Preview)' to label | ✓ |

**User's choice:** Simple text suffix
**Notes:** Minimal visual treatment

---

| Option | Description | Selected |
|--------|-------------|----------|
| All voice modes (voice + digital_human) | WebRTC for all audio session modes | ✓ |
| Voice-only modes first | Only voice_realtime, not digital_human | |
| You decide | Claude determines based on constraints | |

**User's choice:** All voice modes (voice + digital_human)

---

## WebRTC Connection Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Direct browser-to-Azure WebRTC | Audio bypasses backend, lower latency | ✓ |
| Backend-mediated signaling | Backend handles SDP but audio goes direct | |
| Follow Azure SDK reference pattern | Claude researches exact pattern | |

**User's choice:** Direct browser-to-Azure WebRTC

---

| Option | Description | Selected |
|--------|-------------|----------|
| Backend provides short-lived STS token | Mint short-lived token via REST | |
| Backend provides ICE config + session token | Session-scoped token, similar to avatar pattern | ✓ |
| You decide based on Azure docs | Claude determines best auth approach | |

**User's choice:** Backend provides ICE config + session token

---

| Option | Description | Selected |
|--------|-------------|----------|
| New separate hook (use-voice-live-webrtc.ts) | Parallel hook, wrapper switches between | ✓ |
| Extend existing hook with transport param | Single hook with branching logic | |
| You decide | Claude determines best approach | |

**User's choice:** New separate hook

---

## Fallback & Error Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-fallback to WebSocket | Automatic switch on failure with toast | |
| Show error, let user retry or switch | Error message with options | |
| Fail without fallback | Clear error, user manually switches | ✓ |

**User's choice:** Fail without fallback
**Notes:** Keep it simple for preview feature

---

| Option | Description | Selected |
|--------|-------------|----------|
| No auto-reconnect for preview | End session on disconnect | |
| Basic reconnect (same as WebSocket) | 3 attempts with backoff | ✓ |
| You decide | Claude determines strategy | |

**User's choice:** Basic reconnect (same as WebSocket)

---

## Backend API Changes

| Option | Description | Selected |
|--------|-------------|----------|
| New REST endpoint for WebRTC session | POST /api/v1/voice-live/webrtc/session | ✓ |
| Extend existing token endpoint | Single endpoint serves both modes | |
| You decide based on Azure SDK | Claude determines best API design | |

**User's choice:** New REST endpoint

---

| Option | Description | Selected |
|--------|-------------|----------|
| Use azure-ai-voicelive SDK if supports WebRTC | Check SDK, use if available | ✓ |
| Direct Azure REST API calls | No SDK dependency for WebRTC | |
| You decide during research | Claude investigates and picks | |

**User's choice:** Use SDK if it supports WebRTC

---

## Claude's Discretion

- Dropdown component implementation details
- WebRTC peer connection config (codecs, bandwidth)
- Error message copy
- State management between transport modes
- Session recording integration with WebRTC

## Deferred Ideas

None
