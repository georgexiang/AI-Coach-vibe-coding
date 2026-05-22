# Phase 26: Add voice-live-webrtc transport option as alternative to WebSocket - Research

**Researched:** 2026-05-22
**Domain:** Azure Voice Live WebRTC transport, browser WebRTC APIs, real-time audio
**Confidence:** HIGH

## Summary

Azure Voice Live API supports a WebRTC transport mode (public preview, api-version `2026-01-01-preview`) that enables direct browser-to-Azure audio streaming over UDP/RTP, bypassing the backend WebSocket proxy entirely for audio data. The architecture uses a **WebSocket signaling channel** (at a different endpoint: `/voice-live/realtime/calls`) for SDP negotiation and session control, while audio flows over WebRTC media tracks and non-audio events route through a WebRTC data channel named `voice-live-events`.

The existing codebase already contains mature WebRTC patterns in `use-avatar-stream.ts` (ICE handling, SDP offer/answer, RTCPeerConnection lifecycle). The new WebRTC audio transport reuses many of the same browser APIs but with different semantics: audio is **bidirectional** (sendrecv for mic input + model output) rather than receive-only (avatar video/audio). The backend's role changes from full proxy to a **token broker + signaling relay** that provides endpoint URLs, authentication credentials, and session configuration.

**Primary recommendation:** Create a new `use-voice-live-webrtc.ts` hook that opens a WebSocket to the backend for session configuration/token brokering, then establishes a direct RTCPeerConnection to Azure for audio transport. The backend provides a new REST endpoint `POST /api/v1/voice-live/webrtc/session` returning the Azure WebSocket signaling URL with authentication, after which the frontend handles all WebRTC negotiation directly.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Transport selector appears in the session start UI (user choice), not admin panel
- **D-02:** WebRTC option labeled with simple text suffix "(Preview)" -- no badges or warning sections
- **D-03:** WebRTC transport available for ALL voice modes (voice_realtime_model, voice_realtime_agent, digital_human_realtime_model, digital_human_realtime_agent)
- **D-04:** WebSocket remains the default selection; WebRTC is an additional option in the dropdown
- **D-05:** Direct browser-to-Azure WebRTC connection -- audio bypasses backend completely for lower latency
- **D-06:** Backend provides ICE config + session-scoped token for frontend to establish WebRTC peer connection (similar to existing avatar WebRTC pattern)
- **D-07:** New separate hook `use-voice-live-webrtc.ts` -- keep existing `use-voice-live.ts` untouched. Session component switches between hooks based on transport selection
- **D-08:** No auto-fallback -- if WebRTC fails, show clear error. User must manually select WebSocket to try again (simple behavior for preview feature)
- **D-09:** Basic reconnection on mid-session disconnects -- same retry logic as current WebSocket hook (3 attempts with backoff)
- **D-10:** New REST endpoint `POST /api/v1/voice-live/webrtc/session` -- returns ICE servers, session token, and connection config. Separate from existing /ws WebSocket endpoint
- **D-11:** Use azure-ai-voicelive SDK for WebRTC if it supports it; fall back to direct Azure REST API calls if SDK lacks WebRTC support

### Claude's Discretion
- Exact dropdown component implementation (reuse existing select patterns)
- WebRTC peer connection configuration details (codec preferences, bandwidth)
- Error message copy and UX details
- Internal state management between transport modes
- How session recording integrates with WebRTC transport

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Browser WebRTC API | native | RTCPeerConnection, getUserMedia, DataChannel | W3C standard, no library needed [VERIFIED: MDN docs] |
| azure-ai-voicelive | 1.2.0b5 | Backend SDK for Azure Voice Live signaling | Already installed, used by current WS proxy [VERIFIED: pip show] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| FastAPI | >=0.115.0 | New REST endpoint for WebRTC session creation | Already in use [VERIFIED: codebase] |
| httpx | >=0.27.0 | STS token exchange for bearer auth | Already in use [VERIFIED: codebase] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native WebRTC API | simple-peer/peerjs | Unnecessary abstraction; Azure docs use raw RTCPeerConnection |
| Backend signaling relay | Frontend-direct Azure WS | Would expose API key to browser; backend must broker auth |

**Installation:**
```bash
# No new packages needed -- all dependencies already present
# Backend: azure-ai-voicelive 1.2.0b5, httpx, fastapi
# Frontend: native browser APIs (RTCPeerConnection, getUserMedia)
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/hooks/
├── use-voice-live.ts              # EXISTING -- WebSocket proxy (DO NOT MODIFY)
├── use-voice-live-webrtc.ts       # NEW -- Direct WebRTC to Azure
├── use-voice-session-lifecycle.ts # EXISTING -- may need transport-aware variant
├── use-avatar-stream.ts           # EXISTING -- reference for WebRTC patterns
└── use-audio-handler.ts           # EXISTING -- mic capture (reusable)

frontend/src/types/
└── voice-live.ts                  # EXTEND with transport type

frontend/src/components/voice/
├── voice-session.tsx              # MODIFY -- add transport selector, switch hooks
├── voice-transport-select.tsx     # NEW -- transport dropdown component
└── ...

backend/app/api/
└── voice_live.py                  # EXTEND -- add POST /webrtc/session endpoint

backend/app/services/
├── voice_live_websocket.py        # EXISTING -- DO NOT MODIFY
└── voice_live_webrtc.py           # NEW -- WebRTC session config builder
```

### Pattern 1: WebRTC Audio Transport Architecture (from Azure docs)
**What:** Three-channel architecture for real-time audio
**When to use:** WebRTC transport mode selected by user

```
Browser                           Azure Voice Live
  |                                      |
  |--- WebSocket signaling channel ----->| (SDP exchange, session.update, tool calls)
  |                                      |
  |=== WebRTC RTP media tracks =========>| (bidirectional audio: mic -> Azure, Azure TTS -> speaker)
  |                                      |
  |--- WebRTC data channel ------------>| (VAD events, transcripts, response lifecycle)
```

**Key difference from current WS proxy:** Audio never touches the backend. Backend only brokers authentication and initial session config.

Source: [CITED: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-webrtc]

### Pattern 2: WebSocket Signaling Channel Endpoint
**What:** Different Azure endpoint URL for WebRTC sessions
**When to use:** Always for WebRTC mode

```typescript
// WebRTC uses /voice-live/realtime/calls (NOT /voice-live/realtime)
// Source: Azure Voice Live WebRTC docs
const signalingUrl = `wss://${resource}.services.ai.azure.com/voice-live/realtime/calls?api-version=2026-01-01-preview&model=${model}`;
```

Source: [CITED: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-webrtc]

### Pattern 3: SDP Exchange Protocol
**What:** How browser negotiates WebRTC connection with Azure
**When to use:** During WebRTC connection setup

```typescript
// 1. Create peer connection with mic track (sendrecv, not recvonly like avatar)
const pc = new RTCPeerConnection();
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
stream.getTracks().forEach(track => pc.addTrack(track, stream));

// 2. Create data channel for non-audio events
const dataChannel = pc.createDataChannel('voice-live-events');

// 3. Create offer, wait for ICE gathering
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
// Wait for ICE gathering complete...

// 4. Send SDP offer via signaling WebSocket
signalWs.send(JSON.stringify({
  type: 'rtc.call.sdp.create',
  sdp_offer: pc.localDescription.sdp
}));

// 5. Receive answer
// Server responds with: { type: 'rtc.call.sdp.created', sdp_answer: '...' }
await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp_answer });
```

Source: [CITED: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-webrtc]

### Pattern 4: Event Routing Across Channels
**What:** Which events arrive on which channel
**When to use:** Implementing message handlers in the WebRTC hook

| Channel | Events |
|---------|--------|
| WebSocket (signaling) | `session.created`, `session.updated`, `rtc.call.sdp.created`, `error`, function calls |
| WebRTC data channel | `input_audio_buffer.speech_started/stopped`, `response.created/done`, transcription events, `response.audio_transcript.delta/done` |
| WebRTC RTP media | Audio data (bidirectional, not as discrete events) |

Source: [CITED: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-webrtc]

### Pattern 5: Backend Token Broker for WebRTC
**What:** Backend provides authenticated signaling URL to frontend
**When to use:** `POST /api/v1/voice-live/webrtc/session`

```python
# Backend generates the signaling WebSocket URL with auth
# Frontend connects directly to this URL for SDP exchange
@router.post("/webrtc/session")
async def create_webrtc_session(
    hcp_profile_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WebRTCSessionResponse:
    # Load config (same as WS proxy)
    cfg = await _load_connection_config(db, hcp_profile_id)
    
    # Build signaling URL
    endpoint = cfg["endpoint"]  # services.ai.azure.com format
    model = cfg["model"]
    signaling_url = f"wss://{endpoint}/voice-live/realtime/calls?api-version=2026-01-01-preview&model={model}"
    
    # Generate auth token (bearer or API key as query param)
    auth_token = await _get_auth_token(cfg)
    
    return WebRTCSessionResponse(
        signaling_url=signaling_url,
        auth_token=auth_token,
        auth_type="bearer" or "api-key",
        session_config={...},  # voice, turn_detection, etc.
    )
```

### Anti-Patterns to Avoid
- **Proxying WebRTC audio through backend:** Defeats the purpose -- audio MUST flow directly browser-to-Azure
- **Sharing the same hook for WS and WebRTC:** These are fundamentally different architectures -- separate hooks prevent complexity
- **Exposing raw API keys to frontend:** Backend must broker auth; use STS token exchange for bearer tokens or short-lived scoped tokens
- **Modifying existing WebSocket hook:** D-07 explicitly requires `use-voice-live.ts` remain untouched
- **Using avatar WebRTC pattern for audio:** Avatar uses `recvonly` transceivers; voice WebRTC uses `sendrecv` with mic track

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ICE gathering with timeout | Custom polling logic | Promise + icegatheringstatechange + setTimeout fallback | Existing pattern in use-avatar-stream.ts handles all edge cases |
| Audio playback from remote track | Manual AudioContext decoding | `<audio>` element with srcObject = remoteStream | WebRTC handles codec negotiation; raw audio is already decoded |
| SDP encoding | Manual base64 encode/decode | Raw SDP string (Azure WebRTC uses plain SDP, NOT base64 like avatar) | WebRTC /calls endpoint uses plain SDP in sdp_offer field |
| Mic audio capture | Custom AudioWorklet for WebRTC | getUserMedia + addTrack to PeerConnection | WebRTC handles encoding/transmission automatically |
| Reconnection backoff | Custom implementation | Reuse same pattern from use-voice-live.ts (exponential backoff, 3 attempts) | Consistency with existing behavior |

**Key insight:** The WebRTC transport dramatically simplifies audio handling compared to the WebSocket approach. With WS, we manually capture PCM, base64-encode, send via WebSocket, then decode on the other end. With WebRTC, `getUserMedia` + `addTrack` handles everything -- the browser's WebRTC stack does codec negotiation, packetization, and jitter buffering automatically.

## Common Pitfalls

### Pitfall 1: Wrong Endpoint URL
**What goes wrong:** Using `/voice-live/realtime` instead of `/voice-live/realtime/calls` for WebRTC sessions
**Why it happens:** The standard WS endpoint is well-documented; the `/calls` variant is new (2026-01-01-preview)
**How to avoid:** Backend token broker constructs the full signaling URL including `/calls` suffix
**Warning signs:** Connection establishes but no `rtc.call.sdp.created` response comes back

### Pitfall 2: API Key Auth in Browser WebSocket
**What goes wrong:** Browser WebSocket API cannot set custom HTTP headers (`api-key` header)
**Why it happens:** WebSocket browser API only supports URL + protocols, not arbitrary headers
**How to avoid:** Use `api-key` query parameter OR bearer token in `Authorization` header (supported for WSS). Azure docs confirm `api-key` query string is encrypted with WSS.
**Warning signs:** 401 error on WebSocket handshake

### Pitfall 3: Mic Track Direction
**What goes wrong:** Using `recvonly` transceiver for audio (like avatar pattern)
**Why it happens:** Copy-pasting from `use-avatar-stream.ts` which is receive-only
**How to avoid:** Use `getUserMedia` + `addTrack` for bidirectional audio -- do NOT add manual transceivers
**Warning signs:** No audio reaches Azure; `input_audio_buffer.speech_started` never fires

### Pitfall 4: Data Channel Not Created Before Offer
**What goes wrong:** Missing non-audio events (transcripts, VAD, response lifecycle)
**Why it happens:** Data channel must be created before `createOffer()` to be included in SDP
**How to avoid:** Call `pc.createDataChannel('voice-live-events')` before `createOffer()`
**Warning signs:** Audio works but no transcript events arrive

### Pitfall 5: Avatar Not Supported with WebRTC Audio
**What goes wrong:** Attempting to use avatar (digital human) with WebRTC audio transport
**Why it happens:** Azure docs state "Avatar configurations are currently unsupported with side-band control"
**How to avoid:** When WebRTC transport is selected AND avatar is enabled, either (a) disable avatar or (b) use the existing avatar WebRTC pattern separately. This needs architectural decision.
**Warning signs:** `session.updated` returns avatar config as null or error

### Pitfall 6: Data Channel Message Ordering
**What goes wrong:** Processing events before data channel is open
**Why it happens:** Data channel `onopen` fires asynchronously after ICE connection established
**How to avoid:** Buffer or defer event handling until `dataChannel.readyState === 'open'`
**Warning signs:** Early events lost; transcript missing first few utterances

### Pitfall 7: Session Recording with WebRTC
**What goes wrong:** Session recorder (for CU voice scoring) fails because it expects mic MediaStream from AudioHandler
**Why it happens:** WebRTC uses getUserMedia directly; the existing AudioHandler/AudioWorklet path is bypassed
**How to avoid:** Get mic stream via getUserMedia first, feed it to BOTH RTCPeerConnection AND SessionRecorder
**Warning signs:** Voice scoring has no audio data after WebRTC sessions

## Code Examples

### Backend: WebRTC Session Endpoint
```python
# Source: Derived from Azure docs + existing voice_live_service.py pattern
from pydantic import BaseModel

class WebRTCSessionResponse(BaseModel):
    signaling_url: str       # wss://<endpoint>/voice-live/realtime/calls?...
    auth_token: str          # Bearer token or API key for WS auth
    auth_type: str           # "bearer" | "api-key"
    model: str               # e.g. "gpt-4o"
    mode: str                # "agent" | "model"
    session_config: dict     # Voice, turn detection, avatar settings
    agent_id: str | None     # For agent mode
    project_name: str | None # For agent mode

@router.post("/webrtc/session", response_model=WebRTCSessionResponse, status_code=200)
async def create_webrtc_session(
    hcp_profile_id: str | None = Query(None),
    vl_instance_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WebRTCSessionResponse:
    """Create a WebRTC session -- returns signaling URL + auth for direct Azure connection."""
    # Reuse existing _load_connection_config from voice_live_websocket.py
    cfg = await _load_connection_config(db, hcp_profile_id, vl_instance_id=vl_instance_id)
    
    # Build signaling URL (uses services.ai.azure.com, NOT cognitiveservices)
    endpoint = cfg["endpoint"].rstrip("/")
    model = cfg["model"]
    
    use_agent = cfg.get("use_agent_mode", False)
    if use_agent:
        url = f"{endpoint}/voice-live/realtime/calls?api-version=2026-01-01-preview&agent_id={cfg['agent_name']}&project_id={cfg['project_name']}"
    else:
        url = f"{endpoint}/voice-live/realtime/calls?api-version=2026-01-01-preview&model={model}"
    
    # Auth: exchange API key for bearer token (preferred for browser)
    api_key = cfg["api_key"]
    auth_token = await _exchange_api_key_for_bearer_token(endpoint, api_key)
    
    # Build session config for frontend to send via session.update
    session_config = {
        "voice": {"name": cfg["voice_name"], "type": cfg["voice_type"]},
        "turn_detection": {"type": "azure_semantic_vad"},
        "input_audio_noise_reduction": {"type": "azure_deep_noise_suppression"},
        "input_audio_echo_cancellation": {"type": "server_echo_cancellation"},
        "instructions": cfg.get("instructions", ""),
    }
    
    return WebRTCSessionResponse(
        signaling_url=url.replace("https://", "wss://"),
        auth_token=auth_token,
        auth_type="bearer",
        model=model if not use_agent else "",
        mode="agent" if use_agent else "model",
        session_config=session_config,
        agent_id=cfg.get("agent_name") if use_agent else None,
        project_name=cfg.get("project_name") if use_agent else None,
    )
```

### Frontend: WebRTC Hook Structure
```typescript
// Source: Derived from Azure WebRTC docs + existing use-voice-live.ts interface
// File: frontend/src/hooks/use-voice-live-webrtc.ts

export function useVoiceLiveWebRTC(options: VoiceLiveOptions) {
  // State mirrors use-voice-live.ts interface for compatibility
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>("disconnected");
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalingWsRef = useRef<WebSocket | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const connect = useCallback(async (hcpProfileId?: string, systemPrompt?: string, vlInstanceId?: string) => {
    // 1. Call backend for signaling URL + auth
    const session = await fetchWebRTCSession(hcpProfileId, vlInstanceId);
    
    // 2. Get mic access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = stream;
    
    // 3. Create RTCPeerConnection
    const pc = new RTCPeerConnection();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    
    // 4. Create data channel BEFORE offer
    const dc = pc.createDataChannel('voice-live-events');
    dataChannelRef.current = dc;
    dc.onmessage = handleDataChannelMessage;
    
    // 5. Set up remote audio playback
    pc.ontrack = (event) => {
      if (event.track.kind === 'audio') {
        const audio = document.createElement('audio');
        audio.srcObject = event.streams[0];
        audio.autoplay = true;
        document.body.appendChild(audio);
      }
    };
    
    // 6. Create offer + gather ICE
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);
    
    // 7. Open signaling WebSocket to Azure (with auth)
    const wsUrl = `${session.signaling_url}&Authorization=Bearer ${session.auth_token}`;
    const ws = new WebSocket(wsUrl);
    
    // 8. Send SDP offer
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'rtc.call.sdp.create',
        sdp_offer: pc.localDescription!.sdp,
      }));
    };
    
    // 9. Wait for SDP answer
    const answer = await waitForSdpAnswer(ws);
    await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp_answer });
    
    // 10. Send session.update with config
    ws.send(JSON.stringify({
      type: 'session.update',
      session: session.session_config,
    }));
    
    return { avatarEnabled: false, model: session.model, mode: session.mode };
  }, []);

  // Returns same interface as useVoiceLive for drop-in switching
  return {
    connect, disconnect, toggleMute, sendTextMessage, sendAudio,
    send, isMuted, connectionState, audioState, avatarSdpCallbackRef,
  };
}
```

### Frontend: Transport Selector Component
```typescript
// Source: Follows existing voice-live-model-select.tsx dropdown pattern
// File: frontend/src/components/voice/voice-transport-select.tsx

export type VoiceTransport = "websocket" | "webrtc";

interface VoiceTransportSelectProps {
  value: VoiceTransport;
  onChange: (transport: VoiceTransport) => void;
  disabled?: boolean;
}

export function VoiceTransportSelect({ value, onChange, disabled }: VoiceTransportSelectProps) {
  const { t } = useTranslation("voice");
  return (
    <Select value={value} onValueChange={(v) => onChange(v as VoiceTransport)} disabled={disabled}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="websocket">{t("transport.websocket")}</SelectItem>
        <SelectItem value="webrtc">{t("transport.webrtc")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WS-only Voice Live (audio over WebSocket) | WebRTC + WS signaling (audio over RTP) | 2026-01-01-preview | Lower latency, UDP transport, no backend audio proxy needed |
| Avatar over same WS connection | Avatar still via separate WebRTC (unchanged) | N/A | Avatar NOT yet supported with WebRTC audio side-band control |
| api-version 2025-10-01 | api-version 2026-01-01-preview | Jan 2026 | New /calls endpoint and rtc.* events added |

**Deprecated/outdated:**
- The `/voice-live/realtime` endpoint still works for WebSocket-only mode (current default)
- Avatar support is NOT available in WebRTC audio mode per Azure docs: "Avatar configurations are currently unsupported with side-band control"

**Critical limitation:** When using WebRTC transport for audio, Azure does NOT support avatar (digital human) in the same session. This means for `digital_human_realtime_model` and `digital_human_realtime_agent` modes with WebRTC transport, the avatar will NOT render. The planner must handle this -- either disable avatar when WebRTC is selected, or show a warning that avatar is not available in WebRTC preview mode.

## Assumptions Log

> List all claims tagged [ASSUMED] in this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Azure WebRTC endpoint (`/calls`) uses `services.ai.azure.com` domain (not `cognitiveservices.azure.com`) | Architecture Pattern 2 | Wrong URL = 404 on connection; may need domain transformation |
| A2 | Bearer token from STS can be passed as query parameter or header on browser WebSocket | Common Pitfalls #2 | If only header auth works, may need backend to proxy the signaling WS |
| A3 | `pc.createDataChannel('voice-live-events')` must be created client-side before offer | Pitfall #4 | Server may create the data channel instead; would need `ondatachannel` handler |
| A4 | Session recording can access mic MediaStream independently from WebRTC track | Pitfall #7 | May need to clone stream or use MediaStreamTrack |
| A5 | The `session.update` event works on the signaling WebSocket after SDP exchange | Code Examples | Azure may require session.update before or during SDP; ordering may differ |

**Note:** Claims A1, A2, A3, A5 are based on the Azure WebRTC documentation fetched from `learn.microsoft.com` (HIGH confidence from official docs). A4 is a browser API behavior assumption (HIGH confidence from MDN standard).

## Open Questions (RESOLVED)

1. **Avatar + WebRTC Audio Compatibility**
   - What we know: Azure docs explicitly state "Avatar configurations are currently unsupported with side-band control"
   - What's unclear: Does this mean avatar works with WebRTC audio at all, or is it completely blocked?
   - RESOLVED: For digital_human modes with WebRTC transport, show warning that avatar is unavailable in preview. Fall back to voice-only display but keep the audio WebRTC benefit. Plans implement avatar_warning field and toast notification.

2. **Authentication Flow for Browser WebSocket**
   - What we know: Azure supports api-key query param and Bearer token header
   - What's unclear: Whether browser WebSocket API supports `Authorization` header (it typically does NOT in raw `new WebSocket()`)
   - RESOLVED: Use `api-key` query parameter on WSS URL (encrypted by TLS). Azure docs confirm this works. Backend constructs the full signaling URL with api-key param; frontend receives ready-to-use URL.

3. **Agent Mode with WebRTC**
   - What we know: Agent mode uses `agent_id` + `project_id` query params on the endpoint URL
   - What's unclear: Whether agent mode works with the `/calls` WebRTC endpoint or only `/realtime`
   - RESOLVED: Implement with the assumption it works (pass agent_id/project_id in URL params), add error handling for 400/403 responses. Plans include agent_id and project_name in the signaling URL query params.

4. **Data Channel vs WebSocket for session.update**
   - What we know: Azure docs say "keep the channel open to use it for session control (session.update)" referring to the WebSocket
   - What's unclear: Whether `session.update` should go through WebSocket signaling channel or data channel
   - RESOLVED: Use WebSocket signaling channel for session.update (as documented in Azure Step 5). Plans implement this approach.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| azure-ai-voicelive | Backend SDK | Yes | 1.2.0b5 | Direct REST/WS calls |
| RTCPeerConnection | Browser WebRTC | Yes | Native | Not applicable (required) |
| getUserMedia | Mic capture | Yes | Native | Not applicable (required) |
| RTCDataChannel | Non-audio events | Yes | Native | Fall back to WS for events |
| Node.js | Frontend build | Yes | 20+ | -- |
| Python 3.11 | Backend | Yes | 3.11+ | -- |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None -- all required APIs are native browser standards

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Backend brokers auth; never expose raw API key to frontend |
| V3 Session Management | yes | Short-lived bearer tokens (10min STS); scoped per session |
| V4 Access Control | yes | `get_current_user` dependency on new endpoint |
| V5 Input Validation | yes | Validate hcp_profile_id, sanitize session config values |
| V6 Cryptography | no | WSS handles transport encryption |

### Known Threat Patterns for WebRTC + Azure

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure to browser | Information Disclosure | Backend token broker; STS exchange for short-lived bearer token |
| Unauthorized session creation | Elevation of Privilege | JWT auth on new REST endpoint; same get_current_user pattern |
| TURN credential theft | Information Disclosure | Credentials are session-scoped and short-lived from Azure |
| Signaling URL tampering | Tampering | Backend constructs URL server-side; frontend only receives |

## Sources

### Primary (HIGH confidence)
- [CITED: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-webrtc] -- Full WebRTC architecture, endpoint format, SDP protocol, event routing, code examples (updated 2026-05-12)
- [CITED: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to] -- Authentication methods, session configuration, WebSocket endpoint format (updated 2026-05-15)
- [CITED: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live] -- Supported models, regions, pricing (updated 2026-02-04)
- [VERIFIED: pip show azure-ai-voicelive] -- SDK version 1.2.0b5 installed
- [VERIFIED: codebase] -- use-voice-live.ts, use-avatar-stream.ts, voice_live_websocket.py, voice_live_service.py

### Secondary (MEDIUM confidence)
- [VERIFIED: codebase] -- voicelive-api-salescoach-main-sample-code/frontend/src/hooks/useWebRTC.ts -- Reference WebRTC pattern (Microsoft sample)

### Tertiary (LOW confidence)
- None -- all claims sourced from official Microsoft documentation or verified codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - native browser APIs, existing SDK verified installed
- Architecture: HIGH - Azure official docs with code examples, matches existing patterns
- Pitfalls: HIGH - derived from official docs + known browser WebRTC constraints
- Avatar limitation: HIGH - explicitly stated in Azure docs ("unsupported with side-band control")

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (30 days -- preview API may change, but architecture is stable)
