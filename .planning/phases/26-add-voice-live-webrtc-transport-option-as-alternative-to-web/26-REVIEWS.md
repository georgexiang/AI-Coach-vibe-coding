---
phase: 26
reviewers: [claude]
reviewed_at: 2026-05-22T19:45:00Z
plans_reviewed: [26-01-PLAN.md, 26-02-PLAN.md, 26-03-PLAN.md]
notes: "Codex CLI binary broken (ENOENT). OpenCode timed out. Claude reviewed via separate session."
---

# Cross-AI Plan Review — Phase 26

## Claude Review

### Overall Assessment

These plans are **well-researched and architecturally sound**. The three-plan wave structure correctly separates concerns (backend auth broker -> frontend WebRTC hook -> UI integration), and the existing codebase patterns are properly leveraged. The research phase clearly identified the key Azure-specific pitfalls (different endpoint path, data channel semantics, avatar limitation). However, there are several technical gaps and a few medium-risk issues that should be addressed before execution.

---

### Plan 01: Backend WebRTC Session Endpoint

**Summary:** A well-contained, low-risk backend plan that creates a token-broker endpoint. It correctly reuses the existing `_exchange_api_key_for_bearer_token` pattern and adds a new service module with proper separation. The threat model is appropriate and the test coverage plan is solid.

**Strengths:**
- Correctly identifies the different endpoint path (`/voice-live/realtime/calls` vs `/voice-live/realtime`)
- API key is never exposed — STS token exchange is the right pattern
- Static route ordering (Gotcha #3) is explicitly addressed
- Test plan covers both happy path and security assertions (key non-exposure)
- Clean separation: new `voice_live_webrtc.py` service, doesn't modify existing WS proxy logic
- Follows existing patterns (same config_service calls, same parse_voice_live_mode)

**Concerns:**
- **MEDIUM — STS token exchange might not work for WebRTC signaling URL auth.** Research indicates browser WebSocket cannot set custom headers, and the plan mentions `api-key` as query parameter. But the plan constructs a bearer token via STS, then the frontend plan (02) says to append `&api-key={auth_token}` to the signaling URL. If the Azure endpoint expects an actual API key (not bearer token) as query param, the STS exchange may be unnecessary or the param name wrong.
- **LOW — `avatar_warning` is always set (hardcoded).** Fine for MVP but means the response always carries a warning string even when the session mode is voice-only.
- **LOW — No rate limiting on the session endpoint.** Creating WebRTC sessions involves STS token exchange (an external call). A burst of requests could exhaust STS quotas.

**Suggestions:**
- Clarify the auth mechanism: verify whether Azure's `/voice-live/realtime/calls` WebSocket accepts the STS bearer token as a query parameter, or if it requires the raw API key.
- Consider making `avatar_warning` conditional on the session mode being a digital_human variant.
- Add a test case for `hcp_profile_id` flow to verify per-HCP voice settings propagate into `session_config`.

**Risk Assessment: LOW-MEDIUM**

---

### Plan 02: Frontend WebRTC Hook

**Summary:** The most complex plan, creating a full WebRTC peer connection lifecycle hook. It's technically ambitious but well-researched, referencing the correct Azure event types and following the three-channel architecture (signaling WS, RTP media, data channel).

**Strengths:**
- Correctly identifies that data channel must be created BEFORE `createOffer` (critical ordering)
- Handles the full SDP exchange flow (`rtc.call.sdp.create` -> `rtc.call.sdp.created`)
- Sends `session.update` via signaling WS after connection (required by Azure)
- `sendAudio` is correctly no-op (audio flows via RTP, not application layer)
- Reconnection logic with exponential backoff [1000, 2000, 4000]ms
- Uses `getUserMedia` for mic — no separate audio capture needed
- Returns `avatarEnabled: false` in connect result (avatar not supported with WebRTC)

**Concerns:**
- **HIGH — ICE gathering wait strategy is fragile.** The plan says "wait for ICE gathering complete or timeout after 5 seconds." In practice, ICE gathering on restrictive networks can take >5s. A trickle-ICE approach or gathering-complete event is more robust than a hard timeout.
- **HIGH — Auth query parameter confusion.** Step 10 says to append `&api-key={auth_token}` to the signaling URL — but `auth_token` from the backend is a bearer token, not an API key. If Azure expects the literal API key value in this param, the frontend would need the raw key (security violation).
- **MEDIUM — Data channel message routing.** The plan routes ALL non-audio events through the data channel, but some events (like `session.update` responses, `error` events) arrive on the signaling WebSocket, not the data channel. The hook needs to handle events from BOTH channels.
- **MEDIUM — No explicit codec negotiation.** WebRTC defaults to Opus, which Azure should accept — but the plan doesn't verify or constrain the codec.
- **MEDIUM — Remote audio playback pattern.** Creating a dynamic `<audio>` element may trigger browser autoplay policies (especially on iOS/Safari). The "connect" button click serves as the gesture, but this should be explicit.
- **LOW — Missing `pc.oniceconnectionstatechange` handling.** In some browsers, `connectionState` doesn't fire reliably — `iceConnectionState` is the safer signal for disconnect detection.
- **LOW — No explicit media stream cleanup on reconnect.**

**Suggestions:**
- Use `pc.onicegatheringstatechange` -> `"complete"` instead of a 5s timeout for ICE gathering. Fallback timeout should be 10s minimum.
- Add dual-channel event handling: signaling WS for session/lifecycle events AND data channel for streaming events (VAD, transcripts).
- Add explicit codec preference via `RTCRtpTransceiver.setCodecPreferences()` if Azure requires a specific audio codec.
- Handle autoplay policy: ensure `audio.play()` is called within the user-gesture callstack.
- For reconnection: stop all existing mic tracks, close the old pc, THEN start fresh.
- Consider monitoring `iceConnectionState` in addition to `connectionState` for broader browser compatibility.

**Risk Assessment: MEDIUM-HIGH**

---

### Plan 03: UI Integration

**Summary:** The cleanest of the three plans. It correctly identifies that React rules of hooks require both hooks to be instantiated unconditionally, and uses a simple ternary to select the active controls.

**Strengths:**
- Correctly handles React hooks rules (unconditional instantiation, conditional selection)
- Validates that `useVoiceSessionLifecycle` is already transport-agnostic
- Transport selector disabled after session starts
- Avatar warning toast for digital_human + WebRTC
- i18n done properly: both en-US and zh-CN with interpolation support
- Simple component: leverages existing Select pattern

**Concerns:**
- **MEDIUM — Dual hook instantiation performance.** Both hooks are instantiated unconditionally. Need to verify that the unused hook is truly inert until `connect()` is called.
- **MEDIUM — `onAudioDelta` set to undefined for WebRTC hook.** Safer to pass a no-op.
- **LOW — Transport state persistence.** Selection lost on page refresh. Acceptable for preview.
- **LOW — Missing unit test for VoiceTransportSelect.** The project requires 100% coverage.

**Suggestions:**
- Verify that `useVoiceLive` does NOT create connections or listeners until `connect()` is explicitly called.
- Pass a no-op `() => {}` for `onAudioDelta` instead of `undefined`.
- Add a vitest unit test for `VoiceTransportSelect`.
- Add a `enabled` flag or lazy initialization to both hooks so the unused one is truly dormant.

**Risk Assessment: LOW-MEDIUM**

---

### Cross-Plan Concerns

| # | Concern | Severity | Affected Plans |
|---|---------|----------|----------------|
| 1 | Auth mechanism ambiguity — STS bearer token vs raw API key for Azure signaling WS query param | HIGH | 01, 02 |
| 2 | Event routing split — Some events arrive on signaling WS, others on data channel | MEDIUM | 02 |
| 3 | No E2E test plan — CLAUDE.md requires Playwright E2E tests for each feature | MEDIUM | All |
| 4 | No frontend unit tests for Plan 02 — WebRTC hook is 200+ lines with no test task | MEDIUM | 02 |
| 5 | Session recording gap — WebRTC audio bypasses backend, recording implications unaddressed | MEDIUM | 01, 02 |
| 6 | Browser compatibility — No explicit browser support matrix | LOW | 02 |
| 7 | Plans 01 and 02 Wave 1 field naming must match (signaling_url consistency) | LOW | 01, 02 |

---

## Consensus Summary

### Agreed Strengths
- Well-separated wave structure (backend -> hook -> UI) with clean dependency graph
- Reuses established codebase patterns (config_service, VoiceLiveControls interface, ICE/SDP from avatar)
- Security threat model addresses key concerns (API key non-exposure, STS token exchange)
- Research findings properly incorporated into plan details (correct Azure endpoint, event types)
- Correct React hooks patterns for conditional transport selection

### Agreed Concerns (Highest Priority)
1. **Auth mechanism uncertainty** — The interaction between STS bearer tokens and Azure's `api-key` query parameter is unclear and could break the security model
2. **ICE gathering timeout** — Hard 5s timeout is too aggressive; should use gathering-complete event
3. **Dual-channel event routing** — Plans assume data channel for all events, but signaling WS also delivers events
4. **Missing test coverage** — No frontend unit tests for the WebRTC hook, no Playwright E2E test

### Divergent Views
- None (single reviewer session — would benefit from additional AI CLI review for adversarial perspectives)

---

*Review completed: 2026-05-22*
*Reviewers: Claude (separate CLI session)*
*Note: Codex CLI binary broken (ENOENT), OpenCode CLI timed out. Consider installing Gemini CLI for adversarial multi-model review.*
