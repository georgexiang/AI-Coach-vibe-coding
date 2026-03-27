# Phase 08: Voice & Avatar Demo Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 08-voice-avatar-demo-integration
**Areas discussed:** Voice architecture, Avatar rendering, Session integration, Admin configuration

---

## Voice Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Voice Live API (unified) | Single WebSocket: mic → Azure STT+LLM+TTS. Lowest latency. Needs backend token proxy. Region-limited. | ✓ |
| Separate STT+LLM+TTS | Keep current adapter pattern. More regions, higher latency. | |
| Both modes (configurable) | Voice Live as premium + fallback to separate adapters. Max flexibility, more code. | |

**User's choice:** Voice Live API (unified, like demo repo)

| Option | Description | Selected |
|--------|-------------|----------|
| Backend token broker | Backend issues short-lived Entra ID tokens, frontend connects to Azure. Simpler, no keys in browser. | ✓ |
| Full backend relay | Backend proxies all WebSocket traffic. Maximum control but adds latency. | |
| Direct connection | Browser connects with API key like demo. Fast but not production-safe. | |

**User's choice:** Backend token broker (Recommended)

---

## Avatar Rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Embedded in coaching page | Avatar replaces HCP profile area in existing page. | |
| Full-screen immersive | Dedicated full-screen with large avatar, floating transcript. | |
| Toggleable (both modes) | Switch between embedded and full-screen. Best UX, more work. | ✓ |

**User's choice:** Toggleable (both modes)

| Option | Description | Selected |
|--------|-------------|----------|
| Audio-only with HCP profile image | Static profile card + audio waveform. Clean fallback. | |
| Audio-only with animated waveform | Dynamic audio visualization. More engaging. | ✓ |
| Fall back to text mode | Switch to text if avatar unavailable. Simplest. | |

**User's choice:** Audio-only with animated waveform

---

## Session Integration

| Option | Description | Selected |
|--------|-------------|----------|
| New session mode (text/voice/avatar) | Mode field on sessions. Shared model, scoring, reports. | ✓ |
| Separate voice session type | Distinct type alongside F2F and conference. | |
| Upgrade within session | Start text, upgrade to voice mid-session. | |

**User's choice:** New session mode (voice/avatar/text)

| Option | Description | Selected |
|--------|-------------|----------|
| Full transcript | All speech transcribed, stored as messages. Enables scoring/review. | ✓ |
| Summary only | AI-generated summary post-session. Saves storage. | |
| Audio + transcript | Both audio recording and transcript. Maximum fidelity. | |

**User's choice:** Full transcript (Recommended)

---

## Admin Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing Azure Config page | Add Voice Live and Avatar sections. Consistent with Phase 07. | ✓ |
| Dedicated Voice & Avatar page | New admin page for voice/avatar. More space but adds complexity. | |
| Extend + advanced toggle | Extend page with 'Show advanced' for power settings. | |

**User's choice:** Extend existing Azure Config page

---

## Claude's Discretion

- Audio format details (follow rt-client defaults)
- Waveform visualization implementation
- Component decomposition strategy
- WebRTC reconnection strategy
- UI layout proportions

## Deferred Ideas

- GPT Realtime API as non-Azure alternative
- Voice recording export
- Multi-language mid-session switching
- Proactive event manager (from demo repo)
