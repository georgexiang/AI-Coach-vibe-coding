# Architecture Patterns

**Domain:** AI-powered pharma MR training platform (voice + LLM + avatar on Azure)
**Researched:** 2026-03-24

## Recommended Architecture

### High-Level System Diagram

```
+--------------------------------------------------+
|                   BROWSER (React SPA)             |
|                                                   |
|  +------------+  +----------+  +--------------+   |
|  | Coaching   |  | Admin    |  | Dashboard    |   |
|  | Pages      |  | Pages    |  | Pages        |   |
|  +-----+------+  +----+-----+  +------+-------+   |
|        |              |               |            |
|  +-----+------+  +----+-----+  +-----+--------+   |
|  | Voice      |  | Config   |  | TanStack     |   |
|  | Manager    |  | Forms    |  | Query Hooks  |   |
|  | (WebSocket)|  |          |  | (REST)       |   |
|  +-----+------+  +----------+  +--------------+   |
|        |                                           |
|  +-----+------+  +----------------------------+   |
|  | Avatar     |  | i18n (react-i18next)       |   |
|  | Renderer   |  +----------------------------+   |
|  | (WebRTC)   |                                   |
|  +-----+------+                                   |
+--------+---------+--------------------------------+
         |         |
    WebSocket    REST/HTTP
    (voice)    (data CRUD)
         |         |
+--------+---------+--------------------------------+
|              BACKEND (FastAPI ASGI)                |
|                                                    |
|  +-------------------+  +---------------------+    |
|  | WebSocket Router  |  | REST Routers        |    |
|  | /api/v1/ws/coach  |  | /api/v1/sessions    |    |
|  +--------+----------+  | /api/v1/scenarios   |    |
|           |              | /api/v1/hcp-profiles|    |
|  +--------+----------+  | /api/v1/scoring     |    |
|  | Session Orchestr- |  | /api/v1/users       |    |
|  | ator Service      |  | /api/v1/admin       |    |
|  +--------+----------+  +--------+------------+    |
|           |                      |                  |
|  +--------+----------+  +-------+-------------+    |
|  | AI Adapter Layer  |  | CRUD Service Layer  |    |
|  | (Strategy Pattern)|  | (Business Logic)    |    |
|  +---+------+--------+  +--------+------------+    |
|      |      |                     |                 |
|      |      |            +--------+------------+    |
|      |      |            | SQLAlchemy ORM      |    |
|      |      |            | (Async, PostgreSQL)  |    |
|      |      |            +---------------------+    |
+------+------+-------------------------------------+
       |      |
       |      +--- Azure OpenAI (GPT-4o / Realtime)
       |      +--- Azure Speech Services (STT/TTS)
       |      +--- Azure Content Understanding
       |
       +---------- Azure Voice Live API (unified voice+LLM+avatar)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **React SPA** | UI rendering, user interaction, local audio capture, avatar display | Backend via REST + WebSocket |
| **Voice Manager (Frontend)** | Captures microphone audio, sends PCM via WebSocket, plays received audio | Backend WebSocket, browser MediaStream API |
| **Avatar Renderer (Frontend)** | Manages WebRTC peer connection for avatar video stream | Azure Avatar service (via WebRTC), Backend (for ICE/SDP relay) |
| **WebSocket Router (Backend)** | Accepts voice/text coaching interactions over WebSocket | Session Orchestrator |
| **Session Orchestrator** | Manages coaching session lifecycle, routes to AI adapters, persists conversation | AI Adapter Layer, CRUD Services, Database |
| **AI Adapter Layer** | Strategy pattern -- pluggable AI providers (Azure OpenAI, Voice Live, Mock) | Azure OpenAI, Azure Voice Live, Azure Speech |
| **CRUD Service Layer** | Business logic for scenarios, HCP profiles, scoring, users, reports | Database (SQLAlchemy) |
| **REST Routers** | HTTP endpoints for all non-realtime operations | CRUD Services, Auth middleware |
| **i18n Layer** | Translation loading and locale switching | Frontend components, Backend (locale-aware content) |

---

## Two Architecture Modes: Choose Based on Phase

The system supports two distinct real-time voice architectures. Build Mode A first (simpler), then add Mode B when avatar is needed.

### Mode A: Backend-Mediated Voice (Build First)

```
Browser                    FastAPI Backend              Azure Services
  |                             |                           |
  |--[WebSocket: PCM audio]--->|                           |
  |                             |--[WS: audio stream]----->| Azure OpenAI
  |                             |                           | Realtime API
  |                             |<-[WS: audio + text]------|
  |<-[WebSocket: PCM audio]----|                           |
  |<-[WebSocket: transcript]---|                           |
  |                             |                           |
  |  (play audio locally)      |                           |
```

**How it works:**
1. Browser captures microphone audio (PCM 24kHz) via Web Audio API
2. Frontend sends audio chunks over WebSocket to FastAPI backend
3. Backend forwards audio to Azure OpenAI Realtime API via its own WebSocket
4. Azure OpenAI returns audio response + transcript + function calls
5. Backend streams audio back to browser, persists conversation, tracks scoring
6. Browser plays audio through Web Audio API

**Why backend-mediated (not browser-direct):**
- Azure OpenAI Realtime docs state: "not designed to connect directly to end-user devices"
- Backend needs to inject system prompts with HCP personality, scoring criteria, scenario context
- Backend must persist conversation and scoring data in real-time
- Backend can intercept function calls (e.g., "score this response") before forwarding
- Credentials stay server-side

**Key Azure OpenAI Realtime API details (HIGH confidence -- from official docs):**
- Protocol: WebSocket at `wss://{resource}.openai.azure.com/openai/v1`
- Audio format: PCM 24kHz, base64-encoded in JSON events
- VAD options: `server_vad` (audio volume), `semantic_vad` (understands meaning)
- Client events: `session.update`, `input_audio_buffer.append`, `response.create`
- Server events: `response.output_audio.delta`, `response.output_text.delta`, `response.done`
- Session config includes `instructions` (where HCP persona goes), `voice`, `turn_detection`
- Models: `gpt-4o-realtime-preview`, `gpt-realtime`, `gpt-realtime-mini`
- Limits: 32K input tokens, 4K output tokens per response

### Mode B: Voice Live API with Avatar (Build Second)

```
Browser                    FastAPI Backend              Azure Voice Live
  |                             |                           |
  |--[WebSocket: PCM audio]--->|                           |
  |                             |--[WS: audio + config]--->| Voice Live API
  |                             |                           | (LLM + STT + TTS
  |                             |<-[WS: audio + text +     |  + Avatar unified)
  |                             |   viseme/avatar SDP]-----|
  |<-[WebSocket: audio + text]-|                           |
  |                             |                           |
  |<=========[WebRTC video]=============================>| Avatar rendering
  |  (avatar video stream)      |                           |
```

**How it works:**
1. Backend establishes WebSocket to Voice Live API (`wss://{resource}.services.ai.azure.com/voice-live/realtime`)
2. Backend sends `session.update` with model choice, voice config, avatar config, instructions
3. Voice Live API handles STT + LLM + TTS internally (no separate orchestration needed)
4. For avatar: session config includes `avatar` object with character, style, ICE servers
5. Browser establishes WebRTC peer connection for avatar video using ICE/SDP exchanged via backend
6. Avatar video streams directly browser<->Azure (WebRTC), audio/text via backend WebSocket

**Voice Live API advantages (HIGH confidence -- from official docs):**
- Unified: STT + LLM + TTS + Avatar in one API call, no manual orchestration
- Noise suppression and echo cancellation built-in (`azure_deep_noise_suppression`, `server_echo_cancellation`)
- Advanced turn detection: `azure_semantic_vad` understands semantic meaning (not just silence)
- Filler word removal to reduce false barge-in
- Model flexibility: `gpt-realtime`, `gpt-4o`, `gpt-4.1`, `gpt-5`, `phi4-mini`
- Azure standard/HD voices, custom voice support
- Viseme output for custom avatar rendering
- Compatible event model with Azure OpenAI Realtime API (same events, additive features)

**Voice Live Avatar integration details (HIGH confidence):**
- Avatar config in `session.update`: character, style, video resolution, background, ICE servers
- WebRTC peer connection for video stream (h264, 1920x1080 or 3840x2160)
- SDP exchange: client sends `session.avatar.connect` with `client_sdp`, gets `session.avatar.connecting` with `server_sdp`
- Avatar is synchronized with TTS audio output automatically
- Standard avatars available (e.g., "lisa", "casual-sitting") or custom avatars
- 5-minute idle timeout, 30-minute max session (auto-reconnect possible)

---

## Data Flow: F2F Coaching Session (Primary Flow)

```
1. MR selects scenario + HCP profile on frontend
   |
2. Frontend sends POST /api/v1/sessions to create session
   Backend creates session record (status: "created")
   Returns session_id + scenario context + HCP profile
   |
3. Frontend opens WebSocket to /api/v1/ws/coach/{session_id}
   Backend validates session, loads scenario + HCP profile
   Backend opens WebSocket to Azure OpenAI Realtime (or Voice Live)
   Backend sends session.update with:
     - instructions = HCP persona prompt (personality, knowledge, scoring criteria)
     - voice = configured Azure voice
     - turn_detection = server_vad or azure_semantic_vad
     - tools = [score_response, track_key_message, end_session]
   Session status -> "in_progress"
   |
4. MR speaks (or types)
   Frontend captures audio via Web Audio API (PCM 24kHz)
   Frontend sends audio chunks via WebSocket to backend
   Backend forwards as input_audio_buffer.append to Azure
   |
5. Azure processes audio, generates response
   Backend receives response.output_audio.delta (audio chunks)
   Backend receives response.output_text.delta (transcript)
   Backend receives response.function_call (scoring, key message tracking)
   Backend streams audio + transcript to frontend via WebSocket
   Backend persists conversation turn to database
   |
6. Frontend plays audio, displays transcript, updates UI
   Chat bubbles appear, message tracker updates, timer ticks
   |
7. Repeat 4-6 until session ends
   |
8. MR or timer ends session
   Frontend sends end signal via WebSocket
   Backend sends final scoring request to Azure (out-of-band response)
   Backend persists final scores, closes Azure connection
   Session status -> "completed" -> "scored"
   Returns POST /api/v1/sessions/{id}/complete with scores
   |
9. Frontend navigates to scoring/feedback page
   Fetches scores via GET /api/v1/sessions/{id}/scoring
```

## Data Flow: Conference Presentation Mode

```
1. MR selects conference scenario
   Backend creates session with multiple virtual HCP attendees
   |
2. Frontend opens WebSocket to /api/v1/ws/conference/{session_id}
   Backend configures Azure with conference moderator persona
   |
3. MR presents (voice captured + transcribed in real-time)
   Frontend sends audio via WebSocket
   Backend streams to Azure for real-time transcription
   Backend returns transcript to frontend (live transcription bar)
   |
4. Azure generates audience reactions periodically
   Backend uses function calling to generate HCP questions
   Questions appear in frontend "Audience Questions" panel
   |
5. MR answers question (voice or text)
   Backend routes MR response to specific HCP persona
   Azure evaluates response against that HCP's perspective
   |
6. Session ends -> multi-dimensional scoring
   Backend collects all interaction data
   Optionally sends to Azure Content Understanding for multimodal eval
   Returns comprehensive scoring breakdown
```

## Data Flow: Avatar Rendering

```
Phase 1 (no avatar): Audio-only with chat bubbles
  - HCP responses shown as text + played as audio
  - Simpler, lower cost, works everywhere

Phase 2 (avatar enabled):
  Option A - Voice Live Avatar (recommended):
    1. Backend includes avatar config in session.update to Voice Live
    2. Voice Live returns ICE server details in session.updated
    3. Backend relays ICE details to frontend
    4. Frontend creates RTCPeerConnection with ICE servers
    5. Frontend gathers ICE candidates, sends client SDP to backend
    6. Backend sends session.avatar.connect to Voice Live
    7. Voice Live returns server SDP
    8. Backend relays server SDP to frontend
    9. Frontend completes WebRTC handshake
    10. Avatar video streams directly Azure -> Browser (WebRTC)
    11. Avatar lip-syncs automatically with TTS audio

  Option B - Standalone Avatar (fallback if Voice Live unavailable):
    1. Frontend creates RTCPeerConnection
    2. Frontend fetches ICE server from Azure Speech REST API
    3. Frontend creates AvatarSynthesizer (Speech SDK JS)
    4. Backend sends TTS text to frontend
    5. Frontend feeds text to AvatarSynthesizer.speakTextAsync()
    6. Avatar renders in browser via WebRTC video stream

  Budget control:
    - Avatar is configurable per admin settings (on/off)
    - When off, fall back to audio + chat bubbles (Phase 1)
    - Avatar idle timeout is 5 min -- close connection when not speaking
```

---

## Component Architecture Detail

### Backend Services

```
backend/app/services/
  |
  +-- agents/                      # AI Adapter Layer (existing pattern)
  |   +-- base.py                  # BaseCoachingAdapter ABC (exists)
  |   +-- registry.py              # AdapterRegistry singleton (exists)
  |   +-- adapters/
  |       +-- mock.py              # Mock adapter (exists)
  |       +-- azure_realtime.py    # Azure OpenAI Realtime adapter (NEW)
  |       +-- voice_live.py        # Azure Voice Live adapter (NEW)
  |       +-- azure_chat.py        # Azure OpenAI Chat adapter (NEW, for scoring)
  |
  +-- coaching/                    # Session Orchestration (NEW)
  |   +-- session_manager.py       # Session lifecycle + WebSocket management
  |   +-- prompt_builder.py        # Builds HCP persona prompts from profile + scenario
  |   +-- conversation_store.py    # Persists conversation turns in real-time
  |   +-- scoring_engine.py        # Processes scoring function calls, computes dimensions
  |
  +-- content/                     # Content Management (NEW)
  |   +-- material_service.py      # Training material CRUD + versioning
  |   +-- content_analyzer.py      # Azure Content Understanding integration
  |
  +-- azure/                       # Azure Service Wrappers (NEW)
  |   +-- speech_service.py        # Azure Speech STT/TTS helpers
  |   +-- avatar_service.py        # Avatar WebRTC/ICE management
  |   +-- config_manager.py        # ServiceConfig dual-layer (system + admin overrides)
  |
  +-- reports/                     # Reporting (NEW)
      +-- report_generator.py      # Aggregate scoring, generate reports
      +-- export_service.py        # PDF/Excel export
```

### Frontend Modules

```
frontend/src/
  |
  +-- api/
  |   +-- client.ts               # Axios instance (exists)
  |   +-- websocket.ts            # WebSocket client for coaching (NEW)
  |
  +-- components/
  |   +-- shared/                  # Reusable UI components
  |   |   +-- Button, Input, Card, etc.
  |   |   +-- LanguageSwitcher.tsx # i18n switcher component (NEW)
  |   |
  |   +-- coach/                   # Coaching domain components (NEW)
  |   |   +-- ChatBubble.tsx
  |   |   +-- VoiceControl.tsx     # Mic capture, audio playback
  |   |   +-- AvatarDisplay.tsx    # WebRTC avatar video element
  |   |   +-- MessageTracker.tsx   # Key message checklist
  |   |   +-- CoachHints.tsx       # AI hints panel
  |   |   +-- SessionTimer.tsx
  |   |
  |   +-- conference/              # Conference mode components (NEW)
  |   |   +-- SlideViewer.tsx
  |   |   +-- LiveTranscription.tsx
  |   |   +-- AudienceStrip.tsx
  |   |   +-- QuestionQueue.tsx
  |   |
  |   +-- scoring/                 # Scoring/feedback components (NEW)
  |   |   +-- ScoreRadarChart.tsx
  |   |   +-- DimensionBreakdown.tsx
  |   |   +-- FeedbackPanel.tsx
  |   |
  |   +-- admin/                   # Admin components (NEW)
  |       +-- AzureServiceCard.tsx
  |       +-- ConnectionTester.tsx
  |
  +-- hooks/                       # TanStack Query hooks (NEW)
  |   +-- useSession.ts
  |   +-- useScenarios.ts
  |   +-- useHcpProfiles.ts
  |   +-- useScoring.ts
  |   +-- useCoachingWebSocket.ts  # WebSocket hook for real-time coaching
  |   +-- useAvatarWebRTC.ts       # WebRTC hook for avatar rendering
  |   +-- useVoiceCapture.ts       # Web Audio API mic capture hook
  |
  +-- contexts/
  |   +-- CoachingSessionContext.tsx # Active session state (NEW)
  |
  +-- lib/
  |   +-- audio-utils.ts           # PCM encoding/decoding, audio buffer management (NEW)
  |   +-- webrtc-utils.ts          # WebRTC peer connection helpers (NEW)
  |   +-- i18n.ts                  # i18next initialization (NEW)
  |
  +-- locales/                     # i18n translation files (NEW)
  |   +-- zh-CN/
  |   |   +-- common.json
  |   |   +-- coaching.json
  |   |   +-- admin.json
  |   +-- en/
  |       +-- common.json
  |       +-- coaching.json
  |       +-- admin.json
  |
  +-- pages/                       # Route pages (NEW)
      +-- LoginPage.tsx
      +-- DashboardPage.tsx
      +-- ScenarioSelectPage.tsx
      +-- F2FCoachingPage.tsx
      +-- ConferencePage.tsx
      +-- ScoringPage.tsx
      +-- SessionHistoryPage.tsx
      +-- admin/
          +-- UsersPage.tsx
          +-- ScenariosPage.tsx
          +-- AzureSettingsPage.tsx
          +-- MaterialsPage.tsx
          +-- ReportsPage.tsx
```

### Database Models

```
backend/app/models/
  |
  +-- base.py           # Base + TimestampMixin (exists)
  +-- user.py           # User (id, username, role, business_unit)
  +-- scenario.py       # Scenario (product, key_messages, scoring_weights)
  +-- hcp_profile.py    # HcpProfile (name, specialty, personality, knowledge, avatar_config)
  +-- session.py        # TrainingSession (user_id, scenario_id, hcp_profile_id, mode, status, started_at, ended_at)
  +-- conversation.py   # ConversationTurn (session_id, role, content, audio_url, timestamp)
  +-- scoring.py        # SessionScore (session_id, dimension, score, feedback, suggestions)
  +-- material.py       # TrainingMaterial (title, file_url, version, scenario_id)
  +-- azure_config.py   # AzureServiceConfig (service_name, config_json, is_active)
```

---

## Patterns to Follow

### Pattern 1: WebSocket Session Orchestration

The coaching WebSocket endpoint is the most complex component. Use a dedicated orchestrator class per session.

```python
# backend/app/services/coaching/session_manager.py
class CoachingSessionManager:
    """Manages a single coaching session's real-time lifecycle."""

    def __init__(self, session_id: str, db: AsyncSession):
        self.session_id = session_id
        self.azure_ws: WebSocket | None = None  # Connection to Azure
        self.client_ws: WebSocket | None = None  # Connection to browser
        self.conversation_store = ConversationStore(db)
        self.scoring_engine = ScoringEngine()

    async def start(self, client_ws: WebSocket, scenario: Scenario, hcp: HcpProfile):
        """Open Azure connection, configure session, begin routing."""
        self.client_ws = client_ws

        # Build HCP persona prompt
        instructions = PromptBuilder.build_hcp_prompt(hcp, scenario)

        # Connect to Azure (adapter handles Realtime vs Voice Live)
        adapter = AdapterRegistry.get(settings.active_adapter)
        self.azure_ws = await adapter.connect(instructions, scenario.voice_config)

        # Start bidirectional routing
        await asyncio.gather(
            self._route_client_to_azure(),   # MR audio -> Azure
            self._route_azure_to_client(),   # Azure responses -> MR
        )

    async def _route_azure_to_client(self):
        """Process Azure events: forward audio, intercept function calls."""
        async for event in self.azure_ws:
            if event.type == "response.output_audio.delta":
                await self.client_ws.send_bytes(base64.b64decode(event.delta))
            elif event.type == "response.output_text.delta":
                await self.client_ws.send_json({"type": "transcript", "text": event.delta})
            elif event.type == "response.function_call":
                await self._handle_function_call(event)
            elif event.type == "response.done":
                await self.conversation_store.persist_turn(event)
```

### Pattern 2: ServiceConfig Dual-Layer (from Reference Project)

Azure service configuration should have two layers: system defaults from `.env` and admin overrides from database.

```python
# backend/app/services/azure/config_manager.py
class AzureConfigManager:
    """Resolves Azure config: DB override > env default."""

    async def get_config(self, service_name: str, db: AsyncSession) -> dict:
        # Try DB override first (admin-configured)
        db_config = await self._get_db_config(service_name, db)
        if db_config and db_config.is_active:
            return json.loads(db_config.config_json)

        # Fall back to environment defaults
        settings = get_settings()
        return self._get_env_config(service_name, settings)
```

### Pattern 3: Frontend Voice Capture Hook

```typescript
// frontend/src/hooks/useVoiceCapture.ts
function useVoiceCapture(ws: WebSocket | null) {
  const [isRecording, setIsRecording] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext({ sampleRate: 24000 });
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (ws?.readyState === WebSocket.OPEN) {
        const pcmData = e.inputBuffer.getChannelData(0);
        const int16 = float32ToInt16(pcmData); // Convert to 16-bit PCM
        ws.send(int16.buffer);
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
    // ... cleanup on stop
  }, [ws]);
}
```

### Pattern 4: Avatar WebRTC Integration

```typescript
// frontend/src/hooks/useAvatarWebRTC.ts
function useAvatarWebRTC(iceServers: RTCIceServer[] | null) {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const connect = useCallback(async (serverSdpCallback: (sdp: string) => Promise<string>) => {
    const pc = new RTCPeerConnection({ iceServers: iceServers! });

    pc.ontrack = (event) => {
      if (event.track.kind === 'video' && videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
      }
      // Audio handled separately (from WebSocket audio stream)
    };

    pc.addTransceiver('video', { direction: 'sendrecv' });
    pc.addTransceiver('audio', { direction: 'sendrecv' });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE gathering, then exchange SDP with server
    await waitForIceGathering(pc);
    const serverSdp = await serverSdpCallback(pc.localDescription!.sdp);
    await pc.setRemoteDescription({ type: 'answer', sdp: serverSdp });

    peerConnectionRef.current = pc;
  }, [iceServers]);
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Browser-Direct Azure Connection
**What:** Connecting browser directly to Azure OpenAI Realtime API
**Why bad:** Exposes API keys in browser, cannot inject server-side context (HCP personas, scoring), cannot persist conversation data, Azure docs explicitly advise against it
**Instead:** All Azure connections go through FastAPI backend WebSocket proxy

### Anti-Pattern 2: Synchronous Scoring After Session
**What:** Running scoring as a batch job after the session ends
**Why bad:** Loses real-time feedback opportunity (FR-4.2 requires real-time suggestions), scoring data may be incomplete if session drops
**Instead:** Use Azure OpenAI function calling during the conversation to score incrementally, with a final comprehensive score at session end

### Anti-Pattern 3: Separate STT + LLM + TTS Pipeline
**What:** Manually chaining Azure Speech STT -> Azure OpenAI Chat -> Azure Speech TTS
**Why bad:** Adds 500ms+ latency per turn (each service has network round-trip), complex orchestration code, no built-in interruption handling
**Instead:** Use Azure OpenAI Realtime API (built-in STT+LLM+TTS) or Voice Live API (even more unified with avatar)

### Anti-Pattern 4: Storing Audio in Database
**What:** Saving audio blobs directly in PostgreSQL
**Why bad:** Bloats database, slow queries, hard to apply retention policies
**Instead:** Store audio in Azure Blob Storage, keep URL references in database, use lifecycle management for automatic deletion per retention policy

### Anti-Pattern 5: Single WebSocket for Everything
**What:** Mixing real-time coaching audio with REST-like data queries over the same WebSocket
**Why bad:** Complex message routing, hard to debug, breaks REST caching
**Instead:** WebSocket for real-time audio/coaching only. REST for everything else (CRUD, scoring history, reports, config)

---

## i18n Architecture

### Strategy: react-i18next on Frontend, Backend Content is Locale-Aware

```
Frontend (react-i18next):
  - All UI text in translation files (locales/zh-CN/, locales/en/)
  - Namespace per domain: common, coaching, admin, scoring
  - LanguageSwitcher component in app header
  - Locale persisted in localStorage, passed to backend via Accept-Language header
  - Lazy loading: only load active locale's translations

Backend (locale-aware content):
  - HCP persona prompts include language instruction: "Respond in {locale}"
  - Scenario descriptions stored with locale variants (JSON: {"zh-CN": "...", "en": "..."})
  - Scoring feedback generated in session locale
  - API responses include translated error messages based on Accept-Language
  - Azure Speech voice selected by locale (zh-CN -> zh-CN-XiaoxiaoNeural, en-US -> en-US-AvaNeural)

Key design decisions:
  - i18n from day 1 (PROJECT.md constraint -- retrofitting is costly)
  - Chinese + English minimum, extensible to European languages
  - UI translations are static files, content translations are database-driven
  - Azure OpenAI system prompt always instructs response language
  - Avatar voice auto-matched to session language
```

### i18n File Structure

```typescript
// frontend/src/lib/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['zh-CN', 'en'],
    ns: ['common', 'coaching', 'admin', 'scoring'],
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });
```

---

## Suggested Build Order (Dependencies)

Build order is driven by dependencies and demo value. Each layer builds on the previous.

### Layer 0: Foundation (no Azure dependency)
**What:** Database models, REST API CRUD, auth, basic frontend shell, i18n setup
**Dependencies:** None (uses existing skeleton)
**Enables:** Everything else

```
- User model + auth (JWT)
- Scenario model + CRUD API
- HCP Profile model + CRUD API
- Training Session model + lifecycle API
- Frontend: Login, Dashboard, Scenario Selection pages
- i18n framework + zh-CN/en translations for all UI
- Admin: User management page
```

### Layer 1: Text-Based Coaching (minimal Azure)
**What:** Chat-based coaching via Azure OpenAI Chat API (non-realtime)
**Dependencies:** Layer 0 (models, auth, scenarios)
**Azure services:** Azure OpenAI (GPT-4o Chat Completions -- simpler than Realtime)

```
- Azure OpenAI Chat adapter (text in, text out)
- Prompt builder (HCP persona from profile + scenario)
- WebSocket endpoint for streaming text responses
- Frontend: F2F Coaching page (chat-only, no voice)
- Conversation persistence
- Admin: Azure OpenAI config page
```

### Layer 2: Voice Interaction (core Azure)
**What:** Real-time voice via Azure OpenAI Realtime API
**Dependencies:** Layer 1 (chat coaching works, prompts tested)
**Azure services:** Azure OpenAI Realtime API

```
- Azure OpenAI Realtime adapter (audio in, audio out)
- Frontend: Voice capture hook (Web Audio API)
- Frontend: Audio playback (PCM decoding)
- Audio/Text mode toggle on coaching page
- Session timer and lifecycle management
```

### Layer 3: Scoring System
**What:** Multi-dimensional scoring during and after sessions
**Dependencies:** Layer 2 (conversations happening to score)
**Azure services:** Azure OpenAI (function calling for scoring)

```
- Scoring dimensions model (key messages, objection handling, communication, etc.)
- Function calling integration (Azure OpenAI tools)
- Real-time scoring during session (message tracker, hints)
- Post-session scoring aggregation
- Frontend: Scoring/feedback page with radar chart
- Frontend: Session history page
```

### Layer 4: Avatar Integration
**What:** Digital HCP avatar during coaching
**Dependencies:** Layer 2 (voice works), can be parallel with Layer 3
**Azure services:** Azure Voice Live API or Azure Speech Avatar SDK

```
- Voice Live adapter (or standalone Avatar integration)
- WebRTC peer connection management (backend ICE/SDP relay)
- Frontend: Avatar display component (WebRTC video element)
- Admin: Avatar configuration (character, style, on/off toggle)
- Budget control: avatar enable/disable per admin setting
```

### Layer 5: Conference Mode
**What:** One-to-many presentation training
**Dependencies:** Layers 2+3 (voice + scoring)
**Azure services:** Same as Layers 2-4

```
- Conference session type with multiple HCP personas
- Slide presentation viewer
- Live transcription display
- Audience question generation
- Conference-specific scoring
```

### Layer 6: Content Understanding + Reports
**What:** Training material analysis, organizational reports
**Dependencies:** Layer 3 (scoring data exists)
**Azure services:** Azure Content Understanding

```
- Training material upload + versioning
- Azure Content Understanding for document analysis
- Organizational reports and dashboards
- PDF/Excel export
- Data retention policies
```

---

## Scalability Considerations

| Concern | At 10 users (demo) | At 1K users | At 10K users |
|---------|---------------------|-------------|--------------|
| **WebSocket connections** | Single FastAPI instance | Multiple Uvicorn workers behind Azure Container Apps load balancer | Sticky sessions or session-state in Redis |
| **Azure OpenAI concurrency** | Single deployment | Provisioned throughput units (PTU) | Multiple deployments with load balancing |
| **Avatar sessions** | 1-2 concurrent | Avatar is expensive -- queue system with max concurrent limits | Per-region avatar deployment, budget caps |
| **Database** | SQLite (dev) | PostgreSQL on Azure | PostgreSQL with read replicas, connection pooling (pgbouncer) |
| **Audio storage** | Local filesystem | Azure Blob Storage | Azure Blob Storage with lifecycle management + CDN |
| **Real-time latency** | Not an issue | Azure region proximity matters | Multi-region deployment (China + Europe) |

### Per-Region Deployment (Data Residency)

```
China Region:
  - Azure China (mooncake): OpenAI, Speech, PostgreSQL
  - Chinese locale default, Chinese voices
  - Data stays in China

Europe Region:
  - Azure West Europe / Sweden Central: OpenAI, Speech, PostgreSQL
  - European locale default, multilingual voices
  - GDPR compliant, data stays in EU

Architecture is identical per region -- only Azure resource endpoints differ.
Config manager resolves to region-specific Azure services.
```

---

## Technology Choices for This Architecture

| Component | Technology | Why |
|-----------|-----------|-----|
| Real-time voice | Azure OpenAI Realtime API (Layer 2) -> Voice Live API (Layer 4) | Lowest latency, built-in STT+LLM+TTS, Azure-native |
| Avatar rendering | Azure Voice Live Avatar (WebRTC) | Integrated with voice pipeline, lip-sync automatic |
| Avatar fallback | Azure Speech SDK JS (standalone) | Works without Voice Live, useful for budget control |
| WebSocket server | FastAPI WebSocket | Already in stack, async-native, good WS support |
| Audio format | PCM 24kHz int16 | Azure OpenAI Realtime native format |
| Frontend audio | Web Audio API (AudioContext + ScriptProcessor/AudioWorklet) | Standard browser API, supports 24kHz capture |
| i18n | react-i18next + i18next-http-backend | Most popular React i18n, namespace support, lazy loading |
| Scoring visualization | Recharts (radar chart) | Lightweight, React-native, good for radar/dimension charts |
| Content analysis | Azure Content Understanding (GA) | Multimodal document/video/audio analysis, structured output |

---

## Sources

- [Azure OpenAI Realtime API](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/realtime-audio) -- HIGH confidence, official docs, updated 2026
- [Azure AI Avatar Overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/what-is-text-to-speech-avatar) -- HIGH confidence, official docs, updated 2026-02-17
- [Azure Avatar Real-time Synthesis](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/real-time-synthesis-avatar) -- HIGH confidence, official docs, updated 2026-03-03
- [Azure Voice Live API Overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live) -- HIGH confidence, official docs, updated 2026-02-04
- [Azure Voice Live API How-To](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to) -- HIGH confidence, official docs, updated 2026-03-16
- [Azure Content Understanding Overview](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/overview) -- HIGH confidence, GA service, updated 2026-03-13
- [Azure Avatar Browser Samples (GitHub)](https://github.com/Azure-Samples/cognitive-services-speech-sdk/tree/master/samples/js/browser/avatar) -- HIGH confidence, official samples
- Existing codebase architecture analysis (`.planning/codebase/ARCHITECTURE.md`) -- reviewed 2026-03-24
