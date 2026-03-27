# Phase 08: Voice & Avatar Demo Integration - Research

**Researched:** 2026-03-27
**Domain:** Azure Voice Live API (GPT-4o Realtime), Azure AI Avatar (WebRTC), real-time voice coaching
**Confidence:** MEDIUM-HIGH

## Summary

Phase 08 integrates the validated Voice-Live-Agent-With-Avatar demo into the AI Coach platform. The demo uses the `rt-client` SDK (v0.5.2, a Microsoft fork of the OpenAI Realtime Audio SDK) to establish a single WebSocket connection to Azure Voice Live API, which handles STT + LLM + TTS in one round trip. Avatar video is delivered over WebRTC using ICE servers provided dynamically by the Azure service. The frontend connects directly to Azure using short-lived tokens issued by the backend (token broker pattern).

The primary complexity is decomposing the monolithic `chat-interface.tsx` (1200+ lines) from the demo into clean, reusable React hooks and components that integrate with the existing coaching session lifecycle. The backend changes are relatively lightweight: a token broker endpoint, session model extension with a `mode` field, config service extension for Voice Live settings, and transcription persistence. The frontend carries the bulk of complexity: WebSocket audio streaming, WebRTC avatar video, audio worklet processing, and three-mode graceful fallback (avatar+voice, voice-only, text-only).

**Primary recommendation:** Use the `rt-client` v0.5.2 tgz from the reference repo (it is a patched fork with Avatar/Voice Live extensions not published to npm). Backend acts purely as token broker and transcript storage -- no audio passes through the backend server.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Azure Voice Live API (unified real-time pipeline) as the voice engine -- single WebSocket carries mic audio to Azure STT+LLM+TTS in one round trip. Uses `rt-client` SDK.
- **D-02:** Backend acts as token broker -- FastAPI endpoint issues short-lived Entra ID tokens for Azure Voice Live API. Frontend connects directly to Azure using the token. No API keys exposed in browser.
- **D-03:** Install `rt-client` SDK (Microsoft OpenAI Realtime Audio SDK v0.5.2+) in the React frontend for WebSocket protocol handling.
- **D-04:** Voice Live API is region-limited (eastus2, swedencentral). Admin must configure a supported region.
- **D-05:** Avatar display is toggleable -- user can switch between embedded view (avatar in coaching page alongside chat) and full-screen immersive mode (large avatar, floating transcript, minimal controls).
- **D-06:** When avatar is unavailable but voice works, show audio-only mode with animated waveform visualization in the avatar area. Voice interaction continues without visual avatar.
- **D-07:** Avatar video delivered via WebRTC (RTCPeerConnection). ICE servers provided dynamically by Azure. H.264 video track rendered in `<video>` element.
- **D-08:** Add session mode field (text/voice/avatar) to coaching sessions. User selects mode at session start. All modes share the same session model, scoring, and reports. Mode recorded in analytics.
- **D-09:** Full speech transcription -- all voice input/output transcribed in real-time and stored as session messages. Same data model as text sessions. Enables scoring, review, and audit trail.
- **D-10:** Graceful fallback chain: avatar+voice -> voice-only -> text-only. If Azure Voice Live unavailable, fall back to text mode. If Avatar unavailable but Voice Live works, fall back to audio-only with waveform.
- **D-11:** Extend existing Azure Config page (Phase 07) with Voice Live and Avatar sections. Fields: Voice Live endpoint, API key, region; Avatar endpoint, API key, avatar character ID, voice name.
- **D-12:** Connection testing for Voice Live and Avatar services follows the same pattern as existing Azure OpenAI/Speech test buttons.

### Claude's Discretion
- Audio format details (sample rate, bit depth, channels -- follow rt-client defaults: 24kHz, 16-bit PCM, mono)
- Exact waveform visualization implementation (Web Audio API AnalyserNode)
- Component decomposition of the monolithic demo `chat-interface.tsx` into reusable hooks
- WebRTC connection management and reconnection strategy
- Exact UI layout proportions for embedded vs full-screen mode
- Loading/connecting state animations

### Deferred Ideas (OUT OF SCOPE)
- GPT Realtime API (non-Azure) as alternative voice backend -- future phase if needed for non-Azure deployments
- Voice recording export/download for training review
- Multi-language voice switching within a single session
- Proactive event manager (from demo repo) -- automated greetings and inactivity detection
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COACH-04 | User can use voice input (Azure Speech STT) -- speech recognized and sent as text to AI HCP (zh-CN + en-US) | Voice Live API handles STT internally; rt-client SDK provides `input_audio_transcription` with `azure-fast-transcription` model; transcripts exposed via `transcriptChunks()` async iterator |
| COACH-05 | AI HCP responses are spoken via Azure Speech TTS -- natural-sounding voices in Chinese and English | Voice Live API handles TTS internally; voice configured via `Voice` type (AzureStandardVoice with DragonHD or multilingual voices); audio delivered via `audioChunks()` iterator |
| COACH-07 | Azure AI Avatar renders digital human visual for HCP as configurable premium option -- falls back to TTS-only when disabled or unavailable | Avatar config passed in `SessionUpdateParams.avatar`; ICE servers returned in session response; WebRTC peer connection renders H.264 video; fallback to waveform visualization when avatar unavailable |
| EXT-04 | Azure Voice Live API as unified premium voice+avatar path | rt-client v0.5.2 provides `RTClient.configure()` with unified session config including voice, avatar, turn detection, echo cancellation, noise suppression; `RTClient.connectAvatar()` establishes WebRTC |
| PLAT-05 | Voice interaction mode (STT/TTS vs GPT Realtime vs Voice Live) configurable per deployment and per session | Session model `mode` field (text/voice/avatar); admin config page stores Voice Live endpoint/key; feature toggle `feature_voice_live_enabled` gates availability; fallback chain handles unavailability |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Async everywhere**: All backend functions must be `async def`
- **Pydantic v2** schemas with `model_config = ConfigDict(from_attributes=True)`
- **Service layer** holds business logic, routers only handle HTTP
- **Route ordering**: Static paths before parameterized `/{id}`
- **Create returns 201**, Delete returns 204
- **TanStack Query hooks** per domain, no inline `useQuery` in components
- **`@/` path alias** for all imports
- **`cn()` utility** for conditional classes
- **Alembic migration** for ALL schema changes -- NEVER modify schema without migration
- **`server_default`** in migrations for SQLite compatibility with existing rows
- **Conventional commits**: `feat:`, `fix:`, `docs:`, `test:`, `ci:`
- **Pre-commit**: ruff check + ruff format + pytest (backend); tsc -b + build (frontend)
- **i18n**: All UI text via react-i18next, zh-CN and en-US
- **No raw SQL** -- use SQLAlchemy ORM or Alembic migrations
- **>=95% test coverage** maintained

## Standard Stack

### Core (Frontend -- Voice/Avatar)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rt-client | 0.5.2 (local tgz) | Azure Voice Live API WebSocket SDK | Official Microsoft SDK (patched fork) with Avatar support; handles WebSocket protocol, audio streaming, transcription. Not published to npm -- use tgz from reference repo |
| Web Audio API (built-in) | Browser native | Audio capture, worklet processing, playback | Required by rt-client AudioHandler; 24kHz sample rate, 16-bit PCM mono |
| RTCPeerConnection (built-in) | Browser native | WebRTC for Avatar video stream | Avatar video delivered via WebRTC; ICE servers from Azure; H.264 codec |

### Core (Backend -- Token Broker)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| azure-identity | >=1.16.0 | Entra ID token generation for Voice Live API | Standard Azure SDK for generating access tokens with `https://cognitiveservices.azure.com/.default` scope |
| httpx | >=0.27.0 (already installed) | HTTP calls for token and connection testing | Already in project deps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| AudioWorklet processor | Custom JS | Mic audio capture at 24kHz | Loaded as `/audio-processor.js` in public dir; processes raw Float32 to Int16 PCM |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rt-client (local tgz) | Raw WebSocket implementation | rt-client handles the complex protocol (session config, audio framing, response iteration, avatar SDP exchange). Hand-rolling would be 500+ lines of fragile code |
| azure-identity for tokens | Direct REST token endpoint | azure-identity handles token refresh, caching, and multiple auth flows. But adds a Python dependency. Alternative: use `httpx` to call the Entra token endpoint directly if azure-identity install is undesirable |
| WebRTC for avatar | No alternative | Azure Avatar service delivers video exclusively via WebRTC |

**Installation:**
```bash
# Frontend: copy rt-client tgz from reference repo
cp path/to/rt-client-0.5.2.tgz frontend/
cd frontend && npm install ./rt-client-0.5.2.tgz

# Backend: add azure-identity for token broker
cd backend && pip install azure-identity
# Or use httpx REST call to avoid extra dependency (see token broker pattern below)
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
  app/
    api/
      voice_live.py          # Token broker endpoint + transcript persistence
    services/
      voice_live_service.py  # Token generation, config validation
    schemas/
      voice_live.py          # TokenResponse, VoiceLiveConfig schemas
frontend/
  src/
    hooks/
      use-voice-live.ts      # RTClient lifecycle: connect, configure, disconnect
      use-avatar-stream.ts   # WebRTC peer connection, video element management
      use-audio-handler.ts   # AudioHandler wrapper: recording, playback, waveform
    components/
      voice/
        voice-session.tsx     # Main voice session container (mode selector, fallback)
        avatar-view.tsx       # Video element + waveform fallback
        voice-controls.tsx    # Mic button, connect/disconnect, mode toggle
        voice-transcript.tsx  # Real-time transcript display overlay
        waveform-viz.tsx      # Animated waveform for audio-only mode
        index.ts              # Barrel exports
    types/
      voice-live.ts           # TypeScript types for rt-client integration
  public/
    audio-processor.js        # AudioWorklet processor (from reference repo)
```

### Pattern 1: Token Broker (Backend)
**What:** Backend generates short-lived Azure Entra ID tokens so the frontend can connect directly to Voice Live API without exposing API keys.
**When to use:** Every voice session initiation.
**Example:**
```python
# Source: Reference repo VoiceLiveAgent-README.md + Azure docs
# backend/app/api/voice_live.py

@router.post("/voice-live/token")
async def get_voice_live_token(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Issue a short-lived token for Voice Live API connection."""
    config = await config_service.get_config(db, "azure_voice_live")
    if config is None:
        raise AppException(status_code=503, code="VOICE_LIVE_NOT_CONFIGURED",
                          message="Voice Live API not configured")

    api_key = await config_service.get_decrypted_key(db, "azure_voice_live")

    # Option A: Return API key directly (simpler, for API key auth)
    # Option B: Exchange for Entra ID token (more secure, for managed identity)
    return {
        "endpoint": config.endpoint,
        "token": api_key,  # or entra_token
        "region": config.region,
        "avatar_endpoint": avatar_config.endpoint if avatar_config else None,
        "avatar_character": config.model_or_deployment or "Lisa-casual-sitting",
        "voice_name": voice_config_value or "zh-CN-XiaoxiaoMultilingualNeural",
    }
```

### Pattern 2: RTClient Lifecycle Hook (Frontend)
**What:** Custom React hook wrapping the rt-client SDK connection lifecycle.
**When to use:** Voice session component mounts.
**Example:**
```typescript
// Source: Reference repo chat-interface.tsx handleConnect/startResponseListener
// frontend/src/hooks/use-voice-live.ts

export function useVoiceLive(options: VoiceLiveOptions) {
  const clientRef = useRef<RTClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async (tokenData: TokenResponse) => {
    setIsConnecting(true);
    try {
      const client = new RTClient(
        new URL(tokenData.endpoint),
        { key: tokenData.token },
        { modelOrAgent: "gpt-4o-realtime-preview", apiVersion: "2025-05-01-preview" }
      );

      const session = await client.configure({
        modalities: ["text", "audio"],
        voice: { type: "azure-standard", name: tokenData.voice_name },
        input_audio_transcription: {
          model: "azure-fast-transcription",
          language: options.language,
        },
        turn_detection: { type: "server_vad" },
        instructions: options.systemPrompt,
        avatar: tokenData.avatar_endpoint ? {
          character: tokenData.avatar_character,
          video: { codec: "h264", crop: { top_left: [560, 0], bottom_right: [1360, 1080] } },
        } : undefined,
        input_audio_noise_reduction: { type: "azure_deep_noise_suppression" },
      });

      clientRef.current = client;
      setIsConnected(true);
      return session; // Contains avatar.ice_servers if avatar enabled
    } finally {
      setIsConnecting(false);
    }
  }, [options]);

  // ... disconnect, sendAudio, sendTextMessage, events iterator
}
```

### Pattern 3: WebRTC Avatar Connection (Frontend)
**What:** Establish WebRTC peer connection for avatar video using ICE servers from session response.
**When to use:** After RTClient.configure() returns avatar session with ICE servers.
**Example:**
```typescript
// Source: Reference repo chat-interface.tsx getLocalDescription/setupPeerConnection
// frontend/src/hooks/use-avatar-stream.ts

export function useAvatarStream(videoRef: RefObject<HTMLDivElement>) {
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const connect = useCallback(async (
    iceServers: RTCIceServer[],
    rtClient: RTClient
  ) => {
    const pc = new RTCPeerConnection({ iceServers });

    // Receive avatar video and audio tracks
    pc.ontrack = (event) => {
      const el = document.createElement(event.track.kind) as HTMLMediaElement;
      el.id = event.track.kind;
      el.srcObject = event.streams[0];
      el.autoplay = true;
      videoRef.current?.appendChild(el);
    };

    pc.addTransceiver("video", { direction: "sendrecv" });
    pc.addTransceiver("audio", { direction: "sendrecv" });

    // SDP offer/answer exchange
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await new Promise(r => setTimeout(r, 2000)); // Wait for ICE gathering

    const answer = await rtClient.connectAvatar(
      pc.localDescription as RTCSessionDescription
    );
    await pc.setRemoteDescription(answer as RTCSessionDescriptionInit);

    pcRef.current = pc;
  }, [videoRef]);

  // ... disconnect, clearVideo
}
```

### Pattern 4: Session Mode Extension
**What:** Extend the coaching session model with a `mode` field and integrate with existing lifecycle.
**When to use:** Session creation. Mode determines which UI components render.
**Example:**
```python
# Alembic migration
# Add mode column to coaching_sessions
op.add_column("coaching_sessions", sa.Column(
    "mode", sa.String(20), server_default="text", nullable=False
))
```

### Pattern 5: Transcript Persistence via Backend API
**What:** Voice sessions generate transcripts via rt-client `transcriptChunks()`. Frontend periodically flushes transcript segments to the backend session messages API.
**When to use:** During and after voice sessions for scoring and audit trail.
**Example:**
```typescript
// Frontend sends transcript batches
const flushTranscript = async (
  sessionId: string,
  role: "user" | "assistant",
  content: string
) => {
  await apiClient.post(`/api/v1/sessions/${sessionId}/messages`, {
    role,
    content,
    source: "voice_transcript",
  });
};
```

### Anti-Patterns to Avoid
- **Routing audio through the backend:** Voice Live API is designed for direct browser-to-Azure WebSocket. Proxying audio through FastAPI adds latency and defeats the purpose of sub-1s realtime interaction.
- **Storing API keys in frontend:** Use the token broker pattern. Even for development, the frontend should request a token from the backend.
- **Synchronous audio processing:** All audio capture and playback must use AudioWorklet (not deprecated ScriptProcessorNode). The reference repo correctly uses AudioWorkletNode.
- **Hardcoding avatar character or voice:** These should come from admin config (D-11). The reference repo hardcodes defaults like `Lisa-casual-sitting` -- platform should read from config.
- **Single monolithic voice component:** The reference repo's `chat-interface.tsx` is 1200+ lines. Decompose into hooks (useVoiceLive, useAvatarStream, useAudioHandler) and components (VoiceControls, AvatarView, WaveformViz).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket protocol for Voice Live API | Custom WebSocket framing, event parsing, audio base64 encoding | `rt-client` SDK (RTClient class) | The SDK handles complex protocol negotiation, session configuration, audio chunk streaming, response iteration, avatar SDP exchange. 800+ lines of protocol code |
| Audio capture at 24kHz mono | Custom MediaStream processing | `AudioHandler` class from reference repo + AudioWorklet processor | Handles sample rate conversion, Float32-to-Int16, streaming chunks, playback queue, timeline recording |
| WebRTC SDP exchange for Avatar | Manual SDP offer/answer creation | `RTClient.connectAvatar()` + standard RTCPeerConnection | The SDK handles SDP formatting. Use standard WebRTC API for peer connection lifecycle |
| Token refresh/caching | Custom timer-based token refresh | Azure Identity SDK `DefaultAzureCredential` or simple API-key-based auth | For MVP, API key auth via token broker is sufficient. Entra ID adds complexity without immediate benefit |

**Key insight:** The rt-client SDK and AudioHandler class from the reference repo encapsulate hundreds of lines of protocol-specific code that would be extremely error-prone to rewrite. Copy and adapt rather than rewrite from scratch.

## Common Pitfalls

### Pitfall 1: Region Limitation
**What goes wrong:** Voice Live API only works in `eastus2` and `swedencentral`. Configuring a different region silently fails or returns cryptic WebSocket errors.
**Why it happens:** Azure Voice Live API is in preview with limited regional availability.
**How to avoid:** Validate region in the admin config page before saving. Show a warning if region is not `eastus2` or `swedencentral`. Include region validation in connection tester.
**Warning signs:** WebSocket connection fails immediately after `new RTClient(...)`. Error message mentions "resource not found" or similar.

### Pitfall 2: AudioWorklet Not Loaded
**What goes wrong:** `AudioHandler.initialize()` fails because the audio worklet processor file is not served.
**Why it happens:** The reference repo uses Next.js `public/` directory. In Vite, static files go in `public/` but the path handling differs.
**How to avoid:** Place `audio-processor.js` in `frontend/public/` and load via `this.context.audioWorklet.addModule("/audio-processor.js")`. Verify the file is accessible at the URL in development and production (nginx).
**Warning signs:** Console error: "DOMException: The user aborted a request" or "Failed to load module script".

### Pitfall 3: WebRTC ICE Gathering Timeout
**What goes wrong:** Avatar video never appears because ICE candidates are not gathered before the SDP offer is sent.
**Why it happens:** The reference repo uses a `setTimeout(2000)` hack to wait for ICE gathering. In slow networks this may not be enough; in fast networks it's wasted time.
**How to avoid:** Wait for `iceGatheringState === "complete"` event instead of a fixed timeout. Implement proper ICE gathering with a Promise wrapper and a 5-second maximum timeout.
**Warning signs:** Avatar connection succeeds but video element stays black.

### Pitfall 4: Audio Playback Queue Desync
**What goes wrong:** Audio chunks play out of order or overlap, causing garbled speech.
**Why it happens:** The AudioHandler uses `nextPlayTime` scheduling. If the playback queue is not properly cleared on interruption (user starts speaking), old chunks continue playing.
**How to avoid:** Call `stopStreamingPlayback()` before starting new playback. The reference repo handles this correctly in `handleInputAudio` -- preserve this pattern.
**Warning signs:** Audio glitches, overlapping speech, or delayed responses.

### Pitfall 5: Session Transcript Gaps
**What goes wrong:** Scored session is missing portions of the conversation because voice transcripts were not persisted.
**Why it happens:** Voice sessions generate transcripts asynchronously via `transcriptChunks()`. If the session ends before all transcripts are flushed to the backend, data is lost.
**How to avoid:** Flush transcripts on each completed turn (user speech done, assistant response done). On session end, wait for all pending transcript writes before calling the end-session API.
**Warning signs:** Scoring report references conversation segments that are not in the stored messages.

### Pitfall 6: CORS and WebSocket Upgrade
**What goes wrong:** Browser blocks WebSocket connection to Azure Voice Live API.
**Why it happens:** The rt-client SDK connects directly from browser to Azure's WebSocket endpoint. This is a cross-origin request.
**How to avoid:** Azure Voice Live API handles CORS on their end -- no action needed. However, if using a custom proxy, ensure WebSocket upgrade is not stripped. The token broker pattern avoids this by having the frontend connect directly to Azure.
**Warning signs:** WebSocket connection rejected with CORS error.

### Pitfall 7: Missing audio-processor.js for AudioWorklet
**What goes wrong:** The `AudioHandler` class uses `AudioWorkletNode` with a processor registered via `addModule("/audio-processor.js")`. This file must exist in the public directory.
**Why it happens:** The reference repo includes this file in Next.js `public/`. It needs to be ported to the Vite project's `public/` directory.
**How to avoid:** Copy the AudioWorklet processor from the reference repo. The processor converts Float32 audio data to the format expected by rt-client.
**Warning signs:** AudioHandler.initialize() throws "Module not found" or "Worklet not registered".

## Code Examples

### AudioWorklet Processor (must be in public/audio-processor.js)
```javascript
// Source: Reference repo (inferred from AudioHandler usage pattern)
class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.port.onmessage = (e) => {
      if (e.data.command === 'START_RECORDING') this.isRecording = true;
      if (e.data.command === 'STOP_RECORDING') this.isRecording = false;
    };
  }

  process(inputs) {
    if (this.isRecording && inputs[0] && inputs[0][0]) {
      this.port.postMessage({
        eventType: 'audio',
        audioData: inputs[0][0], // Float32Array
      });
    }
    return true;
  }
}
registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
```

### Token Broker Endpoint (Backend)
```python
# Source: D-02 decision + reference repo /config endpoint pattern
# backend/app/api/voice_live.py

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.services import config_service
from app.utils.exceptions import AppException

router = APIRouter(prefix="/voice-live", tags=["voice-live"])

@router.post("/token")
async def get_voice_live_token(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Issue credentials for direct browser-to-Azure Voice Live connection."""
    vl_config = await config_service.get_config(db, "azure_voice_live")
    if not vl_config or not vl_config.is_active:
        raise AppException(
            status_code=503,
            code="VOICE_LIVE_NOT_CONFIGURED",
            message="Voice Live API is not configured",
        )

    api_key = await config_service.get_decrypted_key(db, "azure_voice_live")

    # Also fetch avatar config if available
    avatar_config = await config_service.get_config(db, "azure_avatar")
    avatar_key = ""
    if avatar_config and avatar_config.is_active:
        avatar_key = await config_service.get_decrypted_key(db, "azure_avatar")

    return {
        "endpoint": vl_config.endpoint,
        "token": api_key,
        "region": vl_config.region,
        "model": vl_config.model_or_deployment or "gpt-4o-realtime-preview",
        "avatar_enabled": bool(avatar_config and avatar_config.is_active and avatar_key),
        "avatar_character": avatar_config.model_or_deployment if avatar_config else "Lisa-casual-sitting",
    }
```

### Session Mode Extension (Alembic Migration)
```python
# backend/alembic/versions/xxxx_add_session_mode.py
def upgrade():
    op.add_column(
        "coaching_sessions",
        sa.Column("mode", sa.String(20), server_default="text", nullable=False),
    )

def downgrade():
    with op.batch_alter_table("coaching_sessions") as batch_op:
        batch_op.drop_column("mode")
```

### Voice Live Connection Config (Azure Config Extension)
```python
# Extend SERVICE_DISPLAY_NAMES in backend/app/api/azure_config.py
SERVICE_DISPLAY_NAMES = {
    # ... existing entries ...
    "azure_voice_live": "Azure Voice Live API",
    # azure_avatar already exists
}
```

### Frontend Mode Selector Component
```typescript
// Source: D-08 decision
// frontend/src/components/voice/mode-selector.tsx
type SessionMode = "text" | "voice" | "avatar";

interface ModeSelectorProps {
  value: SessionMode;
  onChange: (mode: SessionMode) => void;
  voiceLiveAvailable: boolean;
  avatarAvailable: boolean;
}

export function ModeSelector({
  value, onChange, voiceLiveAvailable, avatarAvailable
}: ModeSelectorProps) {
  return (
    <div className="flex gap-2">
      <Button variant={value === "text" ? "default" : "outline"} onClick={() => onChange("text")}>
        {t("voice.mode.text")}
      </Button>
      <Button
        variant={value === "voice" ? "default" : "outline"}
        disabled={!voiceLiveAvailable}
        onClick={() => onChange("voice")}
      >
        {t("voice.mode.voice")}
      </Button>
      <Button
        variant={value === "avatar" ? "default" : "outline"}
        disabled={!avatarAvailable}
        onClick={() => onChange("avatar")}
      >
        {t("voice.mode.avatar")}
      </Button>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate STT + LLM + TTS calls (3 round trips) | Azure Voice Live API (unified pipeline, single WebSocket) | 2025 Preview | Sub-1s latency vs 3-5s with separate calls |
| OpenAI Realtime API (gpt-4o-realtime-preview) | Azure Voice Live API with Azure-specific features | 2025-05 | Adds Azure voices (DragonHD), Avatar support, noise suppression, echo cancellation, Semantic VAD |
| Avatar via separate TURN server setup | Avatar integrated into Voice Live session config | rt-client v0.5.2 | Single `configure()` call handles both voice and avatar; ICE servers returned in session response |
| ScriptProcessorNode for audio capture | AudioWorkletNode (AudioWorklet API) | Chrome 66+ (2018) | Non-blocking audio processing, no main thread jank |

**Deprecated/outdated:**
- `@app.on_event("startup")` -- use `lifespan` context manager (already done in project)
- `ScriptProcessorNode` -- replaced by AudioWorklet; reference repo correctly uses AudioWorkletNode
- OpenAI Realtime API v2024-10-01 -- replaced by v2025-05-01-preview with enhanced features

## Open Questions

1. **rt-client tgz distribution**
   - What we know: The rt-client package is a patched fork (`rt-client-0.5.2.tgz`) not published to npm. The reference repo includes it as a local file.
   - What's unclear: Whether a newer version exists; whether it will be published to npm. The source repo is at `github.com/yulin-li/aoai-realtime-audio-sdk` branch `feature/voice-agent`.
   - Recommendation: Copy the tgz from the reference repo into the frontend directory and install via `npm install ./rt-client-0.5.2.tgz`. Pin the version. Check for updates periodically.

2. **Token broker: API key vs Entra ID token**
   - What we know: The reference repo supports both API key auth and Entra ID token auth. Voice Live API accepts either.
   - What's unclear: Whether the production deployment will use managed identity (Entra ID) or API key auth.
   - Recommendation: Start with API key auth (simpler -- admin enters key in config page, backend passes it to frontend via token endpoint). Architecture supports adding Entra ID token generation later by installing `azure-identity` and using `DefaultAzureCredential`.

3. **Audio-processor.js content**
   - What we know: The AudioHandler references `audio-recorder-processor` worklet. The reference repo serves this from Next.js public directory.
   - What's unclear: The exact file is not in the reference repo's Git contents (may be generated or in a different location).
   - Recommendation: Create a minimal AudioWorklet processor that captures Float32 audio and posts it to the main thread. The pattern is well-documented and the example above covers the needed functionality.

4. **Transcript batching strategy**
   - What we know: rt-client provides `transcriptChunks()` for both user and assistant speech. These are partial strings that build up progressively.
   - What's unclear: Optimal batching -- per-turn (after each VAD silence detection) vs periodic (every N seconds) vs on-complete (all at once).
   - Recommendation: Persist one message per completed turn. User speech: on `input_audio` item completion (provides full transcription). Assistant speech: on response completion (provides full transcript). This matches the existing text session message model.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build + dev | Yes | v23.11.0 | -- |
| Python 3.11+ | Backend API | Yes | 3.11.9 | -- |
| npm | Frontend package management | Yes | 11.8.0 | -- |
| rt-client SDK | Voice Live WebSocket | No (must install) | 0.5.2 (tgz) | Copy from reference repo |
| azure-identity | Entra token generation | No (optional) | -- | Use API key auth instead |
| WebRTC (browser) | Avatar video | Yes (browser native) | -- | -- |
| AudioWorklet (browser) | Audio capture | Yes (Chrome 66+) | -- | -- |

**Missing dependencies with no fallback:**
- `rt-client-0.5.2.tgz` must be copied from the reference repo to `frontend/`

**Missing dependencies with fallback:**
- `azure-identity` Python package -- use API key auth instead of Entra ID tokens for MVP

## Sources

### Primary (HIGH confidence)
- Reference repo `huqianghui/Voice-Live-Agent-With-Avadar` -- full source code analyzed: `chat-interface.tsx` (1200+ lines), `audio.ts` (AudioHandler class), `package.json` (rt-client v0.5.2 dependency)
- rt-client SDK source `yulin-li/aoai-realtime-audio-sdk` branch `feature/voice-agent` -- TypeScript models (756 lines) with full Avatar, Voice Live, noise suppression, echo cancellation types
- VoiceLiveAgent-README.md -- Architecture overview, setup instructions, region limitations, authentication requirements
- Avatar-README.md -- WebRTC connection flow, SDP exchange, video configuration

### Secondary (MEDIUM confidence)
- Existing codebase analysis: `backend/app/services/agents/avatar/azure.py` (stub), `backend/app/api/azure_config.py` (config patterns), `backend/app/services/connection_tester.py` (test patterns), `backend/app/models/session.py` (session model), `frontend/src/pages/admin/azure-config.tsx` (admin config page)
- Azure Voice Live API documentation references in READMEs (learn.microsoft.com links)

### Tertiary (LOW confidence)
- Azure Voice Live API production readiness and long-term support (currently in preview)
- Future npm publication of rt-client package

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM-HIGH - rt-client SDK is confirmed from reference repo source; Azure Voice Live API is preview but customer-validated
- Architecture: HIGH - Reference implementation provides complete working code; decomposition patterns are well-understood React patterns
- Pitfalls: HIGH - Identified from direct analysis of reference repo code patterns and Azure documentation
- Token broker pattern: MEDIUM - API key approach is straightforward; Entra ID path may need refinement based on deployment requirements

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (30 days -- Azure Voice Live API is preview, may change)
