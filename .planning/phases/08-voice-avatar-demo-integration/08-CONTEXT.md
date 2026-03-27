# Phase 08: Voice & Avatar Demo Integration - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate Azure Voice Live API (GPT-4o Realtime) with Azure AI Avatar into the AI Coach platform, enabling real-time voice-based coaching sessions where MRs talk to a digital HCP avatar. Reference implementation: https://github.com/huqianghui/Voice-Live-Agent-With-Avadar (previously demoed to customer, not yet integrated with the platform).

</domain>

<decisions>
## Implementation Decisions

### Voice Architecture
- **D-01:** Use Azure Voice Live API (unified real-time pipeline) as the voice engine — single WebSocket carries mic audio → Azure STT+LLM+TTS in one round trip. This matches the demo repo approach using `rt-client` SDK.
- **D-02:** Backend acts as token broker — FastAPI endpoint issues short-lived Entra ID tokens for Azure Voice Live API. Frontend connects directly to Azure using the token. No API keys exposed in browser.
- **D-03:** Install `rt-client` SDK (Microsoft OpenAI Realtime Audio SDK v0.5.2+) in the React frontend for WebSocket protocol handling.
- **D-04:** Voice Live API is region-limited (eastus2, swedencentral). Admin must configure a supported region.

### Avatar Rendering
- **D-05:** Avatar display is toggleable — user can switch between embedded view (avatar in coaching page alongside chat) and full-screen immersive mode (large avatar, floating transcript, minimal controls).
- **D-06:** When avatar is unavailable but voice works, show audio-only mode with animated waveform visualization in the avatar area. Voice interaction continues without visual avatar.
- **D-07:** Avatar video delivered via WebRTC (RTCPeerConnection). ICE servers provided dynamically by Azure. H.264 video track rendered in `<video>` element.

### Session Integration
- **D-08:** Add session mode field (text/voice/avatar) to coaching sessions. User selects mode at session start. All modes share the same session model, scoring, and reports. Mode recorded in analytics.
- **D-09:** Full speech transcription — all voice input/output transcribed in real-time and stored as session messages. Same data model as text sessions. Enables scoring, review, and audit trail.
- **D-10:** Graceful fallback chain: avatar+voice → voice-only → text-only. If Azure Voice Live unavailable, fall back to text mode. If Avatar unavailable but Voice Live works, fall back to audio-only with waveform.

### Admin Configuration
- **D-11:** Extend existing Azure Config page (Phase 07) with Voice Live and Avatar sections. Fields: Voice Live endpoint, API key, region; Avatar endpoint, API key, avatar character ID, voice name.
- **D-12:** Connection testing for Voice Live and Avatar services follows the same pattern as existing Azure OpenAI/Speech test buttons.

### Claude's Discretion
- Audio format details (sample rate, bit depth, channels — follow rt-client defaults: 24kHz, 16-bit PCM, mono)
- Exact waveform visualization implementation (Web Audio API AnalyserNode)
- Component decomposition of the monolithic demo `chat-interface.tsx` into reusable hooks
- WebRTC connection management and reconnection strategy
- Exact UI layout proportions for embedded vs full-screen mode
- Loading/connecting state animations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference Implementation
- `https://github.com/huqianghui/Voice-Live-Agent-With-Avadar` — Demo repo with Azure Voice Live API + Avatar integration. Key files: `src/app/chat-interface.tsx` (core component), `src/lib/audio.ts` (audio handling). Uses `rt-client` SDK for WebSocket protocol.

### Existing Platform Code
- `backend/app/services/agents/avatar/base.py` — BaseAvatarAdapter interface (create_session, send_text, close_session, is_available)
- `backend/app/services/agents/avatar/azure.py` — Stub Azure Avatar adapter (currently returns is_available=False). Needs real implementation.
- `backend/app/services/agents/stt/base.py` — BaseSTTAdapter interface
- `backend/app/services/agents/tts/base.py` — BaseTTSAdapter interface
- `backend/app/services/agents/registry.py` — AdapterRegistry singleton for provider management
- `backend/app/services/connection_tester.py` — Connection testing patterns for Azure services
- `backend/app/api/azure_config.py` — Azure config admin API routes
- `frontend/src/pages/admin/azure-config.tsx` — Azure Config admin page (extend with Voice Live/Avatar sections)
- `frontend/src/pages/user/conference-session.tsx` — Conference session page (audio/video patterns reference)

### Project Requirements
- `docs/requirements.md` — COACH-04 (voice STT), COACH-05 (TTS), COACH-07 (Avatar), EXT-04 (Voice Live API), PLAT-05 (voice mode configurable)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Adapter pattern**: STT/TTS/Avatar base classes + registry. Voice Live may need a new unified adapter type or wrap multiple adapters.
- **Azure config service**: `backend/app/services/config_service.py` + Fernet encryption for API keys. Extend for Voice Live settings.
- **Connection tester**: `backend/app/services/connection_tester.py` pattern for validating Azure service connectivity.
- **Conference components**: `frontend/src/components/conference/` has audio-related UI patterns (conference-stage, audience panel).
- **Session model**: `backend/app/models/session.py` — existing session lifecycle supports extension with mode field.
- **Azure config page**: `frontend/src/pages/admin/azure-config.tsx` — extend with new service sections.

### Established Patterns
- **Pluggable adapters**: All AI services use base class + concrete implementations + registry discovery
- **Admin config persistence**: Fernet-encrypted DB storage, PUT/GET/test API pattern
- **SSE streaming**: Used for text coaching chat — voice sessions use WebSocket instead
- **TanStack Query hooks**: Frontend data fetching pattern for config/sessions

### Integration Points
- **Backend**: New token broker endpoint (`/api/v1/voice-live/token`), extend config service, extend session model with mode
- **Frontend**: New voice session page/component, extend azure-config page, extend session creation with mode selector
- **Database**: Alembic migration to add session mode field, Voice Live config entries

</code_context>

<specifics>
## Specific Ideas

- "这是一个整体最重要的功能，需要好好设计性能和体验" — This is the most important feature overall, needs careful design for performance and experience.
- Reference repo: https://github.com/huqianghui/Voice-Live-Agent-With-Avadar — previously demoed to customer, approach is validated but needs production hardening and platform integration.
- "让端到端，不同模式都能很好的表现" — End-to-end, all modes (text/voice/avatar) should perform well.
- Decompose the monolithic `chat-interface.tsx` from the demo into clean React hooks: `useVoiceLiveSession`, `useAvatarStream`, reuse existing `AudioHandler`.

</specifics>

<deferred>
## Deferred Ideas

- GPT Realtime API (non-Azure) as alternative voice backend — future phase if needed for non-Azure deployments
- Voice recording export/download for training review
- Multi-language voice switching within a single session
- Proactive event manager (from demo repo) — automated greetings and inactivity detection

</deferred>

---

*Phase: 08-voice-avatar-demo-integration*
*Context gathered: 2026-03-27*
