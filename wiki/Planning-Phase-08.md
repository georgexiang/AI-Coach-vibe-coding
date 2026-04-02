# Phase 08: Voice Avatar Demo Integration

> Auto-generated from [`.planning/phases/08-voice-avatar-demo-integration`](../blob/main/.planning/phases/08-voice-avatar-demo-integration)  
> Last synced: 2026-04-02

## Context & Decisions

# Phase 08: Voice & Avatar Demo Integration - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate Azure Voice Live Agent with Avatar into the AI Coach platform for real-time voice coaching with digital HCP avatar. All 7 Azure AI interaction modes are implemented through a unified Azure AI Foundry endpoint resource type. The reference implementation is the user's Voice-Live-Agent-With-Avadar repo. Plans 08-01 through 08-03 are complete — remaining work is container wiring, route registration, admin config card, transcript persistence, and comprehensive testing.

</domain>

<decisions>
## Implementation Decisions

### Azure AI Foundry Unified Endpoint
- **D-01:** ALL 7 interaction modes use Azure AI Foundry endpoint as the single resource type — no separate Azure service endpoints
- **D-02:** The 7 modes: (1) Azure OpenAI text, (2) Azure Speech STT, (3) Azure Speech TTS, (4) Azure AI Avatar, (5) Azure Content Understanding, (6) Azure OpenAI Realtime, (7) Azure Voice Live API
- **D-03:** Voice Live API WSS endpoint pattern: `wss://<foundry-resource>.cognitiveservices.azure.com/voice-live/realtime?api-version=2025-05-01-preview&agent-project-name=<name>&agent-id=<id>&agent-access-token=<token>`
- **D-04:** Supported regions limited to eastus2 and swedencentral per Azure Voice Live API availability

### Voice Session Entry Flow
- **D-05:** Voice session starts from scenario selection page with mode URL parameter — same pattern as existing F2F and conference session entry
- **D-06:** VoiceSessionPage reads `?id=<sessionId>&mode=<voice|avatar>` from URL search params (already implemented)
- **D-07:** Route registration adds `/voice-session` to the router alongside existing `/training-session` and `/conference-session`

### Admin Voice Live Configuration Card
- **D-08:** Voice Live config card in admin Azure Config page follows ServiceConfigCard pattern from Phase 07
- **D-09:** Voice Live card fields: AI Foundry endpoint, API key, agent-project-name, agent-id, avatar character/style selector, voice name selector
- **D-10:** Agent mode needs: ai_service_endpoint, azure_ai_project_name, agent_id, Entra access token (scope: `https://ai.azure.com/.default`)
- **D-11:** Model mode needs: AI Foundry endpoint, API key, deployment name (gpt-4o-realtime-preview)
- **D-12:** Region availability hints shown per service — "Not available in {region}" status when applicable

### Avatar Rendering
- **D-13:** Avatar uses WebRTC peer connection — ICE servers provided dynamically by Azure Avatar service during session init
- **D-14:** Avatar configuration supports both predefined avatars (character-style parsing) and custom avatars (character name with `customized: true`)
- **D-15:** Video parameters: H.264 codec with crop coordinates [560, 0] to [1360, 1080] per reference repo

### Session Lifecycle & Fallback
- **D-16:** Fallback chain: avatar failure → voice-only → text mode (D-10 from prior plans, already in VoiceSession component)
- **D-17:** Session end navigates to scoring page — same lifecycle as F2F (created → in_progress → completed → scored)
- **D-18:** Transcript flush-before-end-session uses pendingFlushesRef with Promise.all (D-09 from prior plans)
- **D-19:** Token broker returns raw API key — frontend connects directly to Azure (D-08 from prior plans)

### Testing Strategy
- **D-20:** Comprehensive tests based on .env configuration — test all 7 Azure AI modes with real Azure services when configured
- **D-21:** Tests must verify: route registration, admin config CRUD, token broker, transcript persistence, session lifecycle, fallback behavior
- **D-22:** Unit tests for each adapter/service, integration tests for API routes, component tests for voice UI
- **D-23:** >=95% test coverage requirement maintained

### Claude's Discretion
- Exact WebRTC error handling and retry logic
- Avatar video element sizing and responsive behavior
- Toast notification wording for connection state changes
- Test mock strategy for WebRTC/audio APIs in unit tests

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference Implementation
- `https://github.com/huqianghui/Voice-Live-Agent-With-Avadar` — User's reference repo for Voice Live + Avatar patterns, session flow, config, WebRTC avatar rendering

### Backend — Voice Live (Phase 08 output, plans 01-03)
- `backend/app/api/voice_live.py` — Voice Live API routes (token broker, status)
- `backend/app/schemas/voice_live.py` — Pydantic schemas for voice live
- `backend/app/services/voice_live_service.py` — Voice Live service logic
- `backend/app/services/agents/adapters/azure_voice_live.py` — Azure Voice Live adapter

### Backend — Azure Config (Phase 07 output)
- `backend/app/api/azure_config.py` — CRUD API for service configs
- `backend/app/models/service_config.py` — ServiceConfig ORM model with Fernet encryption
- `backend/app/services/config_service.py` — Config CRUD + encryption
- `backend/app/services/connection_tester.py` — Connection testing

### Frontend — Voice Components (Phase 08 output, plans 02-03)
- `frontend/src/components/voice/voice-session.tsx` — Main VoiceSession container
- `frontend/src/components/voice/avatar-view.tsx` — Avatar WebRTC renderer
- `frontend/src/components/voice/voice-controls.tsx` — Voice control buttons
- `frontend/src/components/voice/voice-transcript.tsx` — Transcript display
- `frontend/src/components/voice/voice-session-header.tsx` — Session header
- `frontend/src/pages/user/voice-session.tsx` — Voice session page

### Frontend — Hooks & Data Layer (Phase 08 output, plans 02-03)
- `frontend/src/hooks/use-voice-live.ts` — Voice Live WebSocket hook
- `frontend/src/hooks/use-avatar-stream.ts` — Avatar WebRTC stream hook
- `frontend/src/hooks/use-voice-token.ts` — Token broker hook
- `frontend/src/api/voice-live.ts` — Typed API client
- `frontend/src/types/voice-live.ts` — TypeScript type definitions

### Frontend — Admin Config (Phase 07 output)
- `frontend/src/pages/admin/azure-config.tsx` — Azure config page
- `frontend/src/components/admin/service-config-card.tsx` — Reusable config card

### Configuration
- `backend/.env.example` — Environment variable template
- `backend/.env` — Current config with Azure OpenAI keys, voice_live mode active

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VoiceSession` container: Already orchestrates all voice hooks and leaf components
- `VoiceSessionPage`: Full-screen page following conference-session pattern
- `ServiceConfigCard`: Reusable admin config card with status dot, test connection, save
- `useVoiceLive` hook: WebSocket connection management with transcript callbacks
- `useAvatarStream` hook: WebRTC peer connection for avatar video
- `useAudioHandler` hook: Microphone capture and audio playback
- `useVoiceToken` hook: Token broker API integration

### Established Patterns
- Full-screen session pages without UserLayout (conference-session, training-session)
- SSE streaming for real-time responses (F2F, conference)
- ServiceConfigCard for admin Azure service configuration
- TanStack Query hooks per domain with dedicated query key namespaces
- Voice i18n as dedicated namespace for lazy-loading

### Integration Points
- Router: Add `/voice-session` route alongside `/training-session` and `/conference-session`
- Navigation: Add voice session link in scenario selection or session type chooser
- Admin config: Add Voice Live and Avatar cards to `azure-config.tsx`
- Session lifecycle: Wire voice session to existing scoring/feedback pipeline
- Feature toggles: `FEATURE_VOICE_ENABLED` and `FEATURE_AVATAR_ENABLED` gate visibility

</code_context>

<specifics>
## Specific Ideas

- Follow Voice-Live-Agent-With-Avadar repo patterns for Voice Live session flow and avatar WebRTC setup
- All 7 Azure AI modes should be testable through Azure AI Foundry endpoint (user's explicit requirement)
- .env already has real Azure OpenAI keys configured — tests should leverage this for real integration testing
- Avatar ICE servers come dynamically from Azure service during session init — no hardcoded STUN/TURN
- Support both Agent mode (with agent-project-name + agent-id) and Model mode (direct OpenAI Realtime)

</specifics>

<deferred>
## Deferred Ideas

- Per-session provider override (always use deployment-wide config for now)
- Live Azure Management API for region capability querying (start with hardcoded map)
- Multiple avatar characters selectable per HCP profile — future enhancement
- Azure AD SSO integration for Entra token acquisition — future phase (AUTH-V2-01)

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-voice-avatar-demo-integration*
*Context gathered: 2026-03-27*

## Plans (3)

| # | Plan File | Status |
|---|-----------|--------|
| 08-04 | 08-04-PLAN.md | Complete |
| 08-05 | 08-05-PLAN.md | Complete |
| 08-06 | 08-06-PLAN.md | Complete |

## Research

<details><summary>Click to expand research notes</summary>

# Phase 08: Voice & Avatar Demo Integration - Research

**Researched:** 2026-03-27
**Domain:** Azure Voice Live API + AI Avatar WebRTC integration, container component wiring, route/admin config, transcript persistence
**Confidence:** HIGH

## Summary

Phase 08 integrates Azure Voice Live API (real-time speech-to-speech) and Azure AI Avatar (WebRTC digital human) into the AI Coach platform. Plans 01-03 are complete, delivering: backend voice_live API (token broker, status endpoint, connection tester, Alembic migration for session mode), frontend data layer (types, API client, TanStack Query hooks, audio-processor.js), and all voice UI components plus hooks (useVoiceLive, useAvatarStream, useAudioHandler, 7 leaf components). The remaining Plan 04 covers container wiring -- connecting VoiceSession to the router (already done), the admin config Voice Live card (already implemented in ServiceConfigCard with agent/model mode), transcript flush persistence, and comprehensive end-to-end testing.

The codebase inspection reveals that most Plan 04 integration points are already in place from plans 01-03 execution. The router has `/user/training/voice` registered. The admin Azure Config page already includes the Voice Live card with agent/model mode selector. The VoiceSession container is fully wired with all hooks and leaf components. The primary remaining work is: (1) verifying all integration points connect properly end-to-end, (2) ensuring the scenario selection page can route users to voice sessions, (3) comprehensive test coverage for the wired system, and (4) any gap-filling for edge cases in the existing code.

**Primary recommendation:** Focus Plan 04 on integration testing, voice session entry from scenario selection (currently no voice tab/button exists in training.tsx), and comprehensive test coverage rather than building new components -- nearly all code already exists.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: ALL 7 interaction modes use Azure AI Foundry endpoint as the single resource type
- D-02: The 7 modes: (1) Azure OpenAI text, (2) Azure Speech STT, (3) Azure Speech TTS, (4) Azure AI Avatar, (5) Azure Content Understanding, (6) Azure OpenAI Realtime, (7) Azure Voice Live API
- D-03: Voice Live API WSS endpoint pattern: `wss://<foundry-resource>.cognitiveservices.azure.com/voice-live/realtime?api-version=2025-05-01-preview&agent-project-name=<name>&agent-id=<id>&agent-access-token=<token>`
- D-04: Supported regions limited to eastus2 and swedencentral per Azure Voice Live API availability
- D-05: Voice session starts from scenario selection page with mode URL parameter
- D-06: VoiceSessionPage reads `?id=<sessionId>&mode=<voice|avatar>` from URL search params (already implemented)
- D-07: Route registration adds `/voice-session` to the router (already done as `/user/training/voice`)
- D-08: Voice Live config card follows ServiceConfigCard pattern (already implemented)
- D-09: Voice Live card fields: AI Foundry endpoint, API key, agent-project-name, agent-id, avatar character/style selector, voice name selector
- D-10: Agent mode needs: ai_service_endpoint, azure_ai_project_name, agent_id, Entra access token
- D-11: Model mode needs: AI Foundry endpoint, API key, deployment name (gpt-4o-realtime-preview)
- D-12: Region availability hints shown per service
- D-13: Avatar uses WebRTC peer connection with dynamic ICE servers
- D-14: Avatar configuration supports predefined and custom avatars
- D-15: Video parameters: H.264 codec with crop coordinates [560, 0] to [1360, 1080]
- D-16: Fallback chain: avatar failure -> voice-only -> text mode
- D-17: Session end navigates to scoring page (same lifecycle as F2F)
- D-18: Transcript flush-before-end-session uses pendingFlushesRef with Promise.all
- D-19: Token broker returns raw API key
- D-20: Comprehensive tests based on .env configuration
- D-21: Tests must verify: route registration, admin config CRUD, token broker, transcript persistence, session lifecycle, fallback behavior
- D-22: Unit tests for each adapter/service, integration tests for API routes, component tests for voice UI
- D-23: >=95% test coverage requirement maintained

### Claude's Discretion
- Exact WebRTC error handling and retry logic
- Avatar video element sizing and responsive behavior
- Toast notification wording for connection state changes
- Test mock strategy for WebRTC/audio APIs in unit tests

### Deferred Ideas (OUT OF SCOPE)
- Per-session provider override (always use deployment-wide config)
- Live Azure Management API for region capability querying (hardcoded map)
- Multiple avatar characters selectable per HCP profile
- Azure AD SSO integration for Entra token acquisition (AUTH-V2-01)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COACH-04 | Voice input via Azure Speech STT | Already implemented in Phase 03; Voice Live API subsumes this with native audio input. No additional work needed. |
| COACH-05 | AI HCP responses spoken via Azure Speech TTS | Already implemented in Phase 03; Voice Live API handles TTS natively. Config card for TTS exists. |
| COACH-07 | Azure AI Avatar renders digital human for HCP as configurable premium option | useAvatarStream hook implements WebRTC connection. AvatarView component renders video. Fallback to voice-only on failure (D-16). Admin config card exists. |
| EXT-04 | Azure Voice Live API as unified premium voice+avatar path | Token broker API, useVoiceLive hook, VoiceSession container all implemented. Admin Voice Live card with agent/model mode selector exists. Remaining: integration testing, scenario selection entry point. |
| PLAT-05 | Voice interaction mode configurable per deployment and per session | Session model has `mode` field (text/voice/avatar). Feature toggles (feature_voice_enabled, feature_voice_live_enabled) in config. Admin can configure via Azure Config page. |
</phase_requirements>

## Standard Stack

### Core (already installed and in use)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rt-client | 0.5.2 | Azure Voice Live API WebSocket client | Official Azure SDK for realtime voice, installed from tgz file |
| react | 18.3+ | UI framework | Project standard |
| @tanstack/react-query | 5.60+ | Server state management | Project standard for all API hooks |
| fastapi | 0.115+ | Backend API framework | Project standard |
| pydantic | 2.x | Request/response schemas | Project standard |
| vitest | latest | Frontend unit testing | Project standard for frontend tests |
| pytest | 8.3+ | Backend testing | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | installed | Toast notifications | Connection state changes, errors, fallback notifications |
| lucide-react | 0.460+ | Icons | Phone icon for voice live card, Mic for voice controls |
| react-i18next | installed | Internationalization | voice.json namespace for all voice UI strings |

### No New Packages Required

All dependencies are already in place from plans 01-03. The rt-client 0.5.2 tgz is present in the frontend directory but may need `npm install` to be fully resolved in node_modules (check revealed it is not currently in node_modules).

## Architecture Patterns

### Current Implementation Structure (Plans 01-03 Output)
```
backend/
  app/
    api/voice_live.py              # Token broker + status endpoints (DONE)
    schemas/voice_live.py          # Pydantic schemas (DONE)
    services/voice_live_service.py # Service logic (DONE)
    services/connection_tester.py  # Voice Live connection testing (DONE)
    services/region_capabilities.py # Region availability map (DONE)
    models/session.py              # mode field added (DONE)
  alembic/versions/
    a1b2c3d4e5f6_add_session_mode.py  # Migration (DONE)

frontend/
  src/
    api/voice-live.ts              # API client (DONE)
    types/voice-live.ts            # TypeScript types (DONE)
    types/azure-config.ts          # VoiceLiveMode types (DONE)
    hooks/
      use-voice-live.ts            # WebSocket hook (DONE)
      use-avatar-stream.ts         # WebRTC hook (DONE)
      use-audio-handler.ts         # Microphone/AudioWorklet (DONE)
      use-voice-token.ts           # Token broker hook (DONE)
    components/voice/
      voice-session.tsx            # Container orchestrator (DONE)
      avatar-view.tsx              # WebRTC video renderer (DONE)
      voice-controls.tsx           # Mute/keyboard/fullscreen (DONE)
      voice-transcript.tsx         # Transcript display (DONE)
      voice-session-header.tsx     # Header bar (DONE)
      floating-transcript.tsx      # Full-screen overlay (DONE)
      waveform-viz.tsx             # Audio visualizer (DONE)
      mode-selector.tsx            # Text/voice/avatar selector (DONE)
      connection-status.tsx        # Status indicator (DONE)
    pages/user/voice-session.tsx   # Full-screen page (DONE)
  public/
    audio-processor.js             # AudioWorklet processor (DONE)
    locales/en-US/voice.json       # i18n voice namespace (DONE)
```

### Integration Points for Plan 04

| Integration Point | Current State | Work Needed |
|---|---|---|
| Router `/user/training/voice` | Registered in router/index.tsx | DONE - verify works end-to-end |
| Admin Azure Config Voice Live card | ServiceConfigCard renders for voiceLive key with agent/model selector | DONE - verify CRUD works |
| Scenario selection -> voice session | training.tsx has NO voice tab or button; only F2F and conference tabs | NEEDS WORK - add voice session entry |
| Voice Live router in main.py | voice_live_router included | DONE |
| Session mode in create session | SessionCreate schema accepts mode field | DONE - verify voice sessions created properly |
| Transcript persistence to sessions/{id}/messages | persistTranscriptMessage in voice-live.ts calls POST | DONE - verify backend handler accepts voice_transcript source |
| Feature toggle gating | feature_voice_live_enabled in config.py | Verify toggle gates voice entry in scenario selection |
| Scoring after voice session | VoiceSession navigates to `/user/scoring/${sessionId}` | DONE - same as F2F/conference |

### Pattern: Session Entry Flow (Voice)
```
ScenarioSelection -> Create Session (POST /sessions with mode=voice|avatar)
  -> Navigate to /user/training/voice?id={sessionId}&mode={mode}
    -> VoiceSessionPage reads params
      -> VoiceSession container initializes hooks
        -> Token broker -> Voice Live connect -> Avatar connect (if mode=avatar)
          -> Transcript display, controls, scoring on end
```

### Anti-Patterns to Avoid
- **Duplicating ServiceConfigCard logic for Voice Live**: The card already supports Voice Live with agent/model mode selection -- do not create a separate component
- **Hardcoding voice session start URL**: Follow the existing pattern where scenario selection uses `navigate()` with URL params
- **Skipping transcript flush before session end**: The pendingFlushesRef pattern is already implemented -- do not bypass it

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket management | Custom WebSocket wrapper | rt-client SDK (0.5.2) | Handles reconnection, session config, audio encoding |
| WebRTC connection | Manual RTCPeerConnection setup beyond useAvatarStream | Existing useAvatarStream hook | Already handles ICE gathering, SDP exchange, track injection |
| Audio capture | Raw getUserMedia | useAudioHandler hook | Manages AudioWorklet, AnalyserNode, cleanup lifecycle |
| Admin config cards | Custom Voice Live config form | ServiceConfigCard with voiceLive mode detection | Already implements agent/model radio, field validation, save/test |
| Region capabilities | API call to Azure Management | region_capabilities.py hardcoded map | Locked decision -- no live querying |

## Common Pitfalls

### Pitfall 1: rt-client Not in node_modules
**What goes wrong:** `npm ls rt-client` shows empty -- the tgz is present but not installed
**Why it happens:** node_modules may not include it after clean install if tgz path resolution fails
**How to avoid:** Run `npm install` in frontend directory to ensure rt-client-0.5.2.tgz resolves. Verify with `npm ls rt-client`.
**Warning signs:** useVoiceLive dynamic import `import("rt-client")` throws at runtime

### Pitfall 2: No Voice Session Entry in Scenario Selection
**What goes wrong:** Users cannot start a voice session from the training page
**Why it happens:** training.tsx only has F2F and Conference tabs -- no voice option exists
**How to avoid:** Add a voice session start flow (third tab or mode selector on scenario card) that creates a session with mode=voice|avatar and navigates to `/user/training/voice?id={id}&mode={mode}`
**Warning signs:** The voice session page only works if navigated to directly via URL

### Pitfall 3: Transcript Not Persisted for Scoring
**What goes wrong:** After voice session ends, scoring page has no conversation to analyze
**Why it happens:** persistTranscriptMessage POSTs to `/sessions/{id}/messages` but backend may not handle `source: "voice_transcript"` or the format may differ from what scoring expects
**How to avoid:** Verify that POST to sessions/{id}/messages creates SessionMessage records that the scoring service reads for analysis
**Warning signs:** Scoring page shows "No conversation data" after voice session

### Pitfall 4: WebRTC/Audio APIs in Test Environment
**What goes wrong:** Tests fail because jsdom has no RTCPeerConnection, MediaDevices, AudioContext
**Why it happens:** These are browser-only APIs not available in test runner
**How to avoid:** Mock WebRTC, AudioContext, and getUserMedia at the test setup level. The existing test files (voice-controls.test.tsx, etc.) already mock these -- follow the same pattern.
**Warning signs:** "RTCPeerConnection is not defined" errors in vitest

### Pitfall 5: Feature Toggle Not Gating Voice Entry
**What goes wrong:** Voice option appears in scenario selection even when voice is disabled
**Why it happens:** Feature toggle check (feature_voice_live_enabled) not applied to the new voice entry UI
**How to avoid:** Check `voice_enabled` or `feature_voice_live_enabled` from config context before rendering voice session option
**Warning signs:** Voice tab/button visible in local dev where voice is not configured

### Pitfall 6: Voice Live Region Mismatch
**What goes wrong:** Region shown as "available" but Voice Live connection fails
**Why it happens:** VOICE_LIVE_REGIONS in region_capabilities.py was updated to include many regions, but SUPPORTED_REGIONS in voice_live_service.py only has eastus2 and swedencentral
**How to avoid:** Ensure SUPPORTED_REGIONS uses VOICE_LIVE_REGIONS import consistently. Current code has `SUPPORTED_REGIONS = VOICE_LIVE_REGIONS` which is correct.
**Warning signs:** Connection test succeeds but Voice Live WebSocket connection fails at runtime

## Code Examples

### Existing: Voice Session Page Entry Pattern
```typescript
// frontend/src/pages/user/voice-session.tsx (already implemented)
const sessionId = searchParams.get("id") ?? "";
const mode = (searchParams.get("mode") ?? "voice") as SessionMode;
```

### Existing: Admin Config Voice Live Card Pattern
```typescript
// frontend/src/pages/admin/azure-config.tsx (already implemented)
{
  key: "voiceLive",
  name: "Azure Voice Live API",
  description: "Real-time voice coaching with GPT-4o Realtime",
  icon: <Phone className="size-6 text-primary" />,
}
```

### Needed: Scenario Selection Voice Entry (gap to fill)
```typescript
// Pattern to add in training.tsx -- voice session start
const handleStartVoiceSession = async (scenarioId: string, mode: SessionMode) => {
  const session = await createSession.mutateAsync({ scenario_id: scenarioId, mode });
  navigate(`/user/training/voice?id=${session.id}&mode=${mode}`);
};
```

### Existing: Transcript Persistence Pattern
```typescript
// frontend/src/api/voice-live.ts (already implemented)
export async function persistTranscriptMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await apiClient.post(`/sessions/${sessionId}/messages`, {
    message: content,
    role,
    source: "voice_transcript",
  });
}
```

### Existing: Backend Token Broker Pattern
```python
# backend/app/services/voice_live_service.py (already implemented)
async def get_voice_live_token(db: AsyncSession) -> VoiceLiveTokenResponse:
    vl_config = await config_service.get_config(db, "azure_voice_live")
    api_key = await config_service.get_decrypted_key(db, "azure_voice_live")
    return VoiceLiveTokenResponse(
        endpoint=vl_config.endpoint,
        token=api_key,
        ...
    )
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual STT+LLM+TTS orchestration | Voice Live API unified pipeline | 2025 GA | Single WebSocket replaces 3 separate services |
| rt-client SDK (file-based tgz) | openai SDK with RealtimeWS | 2025-2026 | Official OpenAI SDK now supports Azure realtime natively |
| Fixed STUN/TURN servers | Dynamic ICE from Azure Avatar service | Current | No hardcoded WebRTC config needed |
| API key only auth | Entra ID recommended, API key supported | 2025+ | D-19 uses API key for now; Entra deferred |

**Azure Voice Live API (as of 2026-01):**
- Supports models: gpt-realtime, gpt-4o, gpt-4.1, gpt-5, phi-4, and more
- Single WebSocket manages speech recognition + LLM + TTS + avatar
- Compatible with Azure OpenAI Realtime API events
- Avatar integration is additive (optional session parameter)
- Available in 20+ regions (expanded from initial 2-region launch)

**Note on rt-client vs OpenAI SDK:** The project uses rt-client 0.5.2 (file-based install). The newer approach uses the official `openai` npm package with `OpenAIRealtimeWS`. Since rt-client is already integrated and the useVoiceLive hook wraps it, migration would be significant work -- not recommended for this phase.

## Open Questions

1. **useCreateSession hook vs direct API call for voice mode**
   - What we know: `useCreateSession` in use-session.ts calls `createSession(scenarioId)` which may not pass the `mode` parameter
   - What's unclear: Whether the create session API handler accepts and stores mode correctly for voice sessions
   - Recommendation: Verify `useCreateSession` hook and its backend endpoint accept `mode` parameter; if not, extend it

2. **Scoring service reading voice transcripts**
   - What we know: Voice transcripts are persisted via `persistTranscriptMessage` to `/sessions/{id}/messages`
   - What's unclear: Whether the scoring service reads these messages when analyzing the conversation
   - Recommendation: Verify that the scoring flow works identically for voice session messages

3. **Feature toggle granularity**
   - What we know: `feature_voice_enabled`, `feature_realtime_voice_enabled`, `feature_voice_live_enabled` all exist
   - What's unclear: Which toggle should gate the voice tab in scenario selection
   - Recommendation: Use `feature_voice_live_enabled` specifically for the Voice Live path; check via config context

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | Backend | Assumed (project standard) | -- | -- |
| Node 20+ | Frontend | Assumed (project standard) | -- | -- |
| rt-client | useVoiceLive hook | tgz present, NOT in node_modules | 0.5.2 | Must run npm install |
| Azure Voice Live API | Real-time voice | External service (needs config) | 2025-05-01-preview | Text mode fallback |
| Azure AI Avatar | Digital human rendering | External service (needs config) | Current | Voice-only fallback |
| WebRTC browser support | Avatar video | Modern browsers | Native | Voice-only fallback |
| AudioWorklet support | Microphone capture | Modern browsers | Native | Text mode fallback |

**Missing dependencies with no fallback:**
- rt-client must be installed (run `npm install` in frontend/)

**Missing dependencies with fallback:**
- Azure Voice Live API: falls back to text mode (D-16)
- Azure AI Avatar: falls back to voice-only (D-16)

## Project Constraints (from CLAUDE.md)

- **Async everywhere** in backend: all handlers use `async def`, `await`, `AsyncSession`
- **Pydantic v2** for schemas with `ConfigDict(from_attributes=True)`
- **Route ordering**: Static paths before parameterized
- **Create returns 201**, Delete returns 204
- **Service layer** holds business logic, routers only handle HTTP
- **TypeScript strict mode**: no `any`, no unused variables
- **TanStack Query hooks** per domain, no inline useQuery
- **Path alias** `@/` for imports
- **cn() utility** for conditional classes
- **Conventional commits** (`feat:`, `fix:`, `test:`)
- **i18n**: all UI text externalized via react-i18next
- **Alembic** for all schema changes with batch operations for SQLite
- **No raw SQL** -- use SQLAlchemy ORM
- **>=95% test coverage** requirement
- Pre-commit checks: `ruff check .`, `ruff format --check .`, `pytest -v`, `npx tsc -b`, `npm run build`

## Sources

### Primary (HIGH confidence)
- Codebase inspection: backend/app/api/voice_live.py, services/voice_live_service.py, schemas/voice_live.py
- Codebase inspection: frontend/src/components/voice/*.tsx, hooks/use-voice-live.ts, hooks/use-avatar-stream.ts
- Codebase inspection: frontend/src/router/index.tsx, pages/admin/azure-config.tsx, components/admin/service-config-card.tsx
- Codebase inspection: frontend/src/pages/user/voice-session.tsx, training.tsx
- Codebase inspection: backend/app/main.py (voice_live_router registered), models/session.py (mode field), config.py (feature toggles)
- [Azure Voice Live API Overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live) - Official docs, confirmed features and model support
- [Azure OpenAI Realtime API](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/realtime-audio) - WebSocket patterns, authentication methods
- [Azure AI Avatar Overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/what-is-text-to-speech-avatar) - Avatar capabilities, WebRTC integration, sample code links

### Secondary (MEDIUM confidence)
- [Voice Live Avatar Samples](https://github.com/azure-ai-foundry/voicelive-samples/tree/main/javascript/voice-live-avatar) - GitHub repo structure and patterns

### Tertiary (LOW confidence)
- Region availability may have expanded beyond what is hardcoded in region_capabilities.py (Voice Live API docs mention 20+ regions as of 2026-01)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages identified from codebase inspection, versions verified
- Architecture: HIGH - all components exist from plans 01-03, integration points mapped from source
- Pitfalls: HIGH - identified from actual code gaps (no voice tab in training.tsx, rt-client not installed)
- Azure API patterns: MEDIUM - verified from official docs but rt-client 0.5.2 API details from training data

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- all code already exists, Azure API versions pinned)

</details>

## UI Specification

<details><summary>Click to expand UI spec</summary>

# Phase 08 -- UI Design Contract

> Visual and interaction contract for the Voice & Avatar Demo Integration phase. Generated by gsd-ui-researcher, verified by gsd-ui-checker.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (Tailwind CSS v4 with `@theme inline` tokens, Radix UI primitives) |
| Preset | not applicable |
| Component library | Radix UI via shadcn-style wrappers (forwardRef + cn() + displayName) |
| Icon library | lucide-react 0.460+ |
| Font | Inter + Noto Sans SC (sans-serif), JetBrains Mono (monospace) |

**Note:** Phase 08 extends the design system established in Phase 01. No new design tokens or base UI components are needed. All voice-specific components (plans 01-03) are already implemented. This contract documents the visual rules for the remaining Plan 04 integration work: voice tab in scenario selection, admin config card wiring verification, and route registration.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps (e.g., `gap-1` in waveform bars), inline padding |
| sm | 8px | Compact element spacing (`gap-2` in ConnectionStatus dot + text) |
| md | 16px | Default element spacing (`p-4` in transcript area, `gap-4` in header) |
| lg | 24px | Section padding (`p-6` in admin config page) |
| xl | 32px | Layout gaps (not used in voice components) |
| 2xl | 48px | Major section breaks (not used in voice components) |
| 3xl | 64px | Page-level spacing (not used in voice components) |

Exceptions:
- Voice control bar height: 64px (h-16), consistent with session header height
- Central mic button: 56px (h-14 w-14), a touch-friendly target exceeding the 44px minimum
- Side control buttons: 40px (h-10 w-10), meeting 44px touch target with padding
- Avatar view non-fullscreen height: 280px (fixed, provides adequate video framing)
- Transcript panel height: 200px (fixed, balanced with avatar view in 3-panel layout)

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px (text-base) | 400 (normal) | 1.5 |
| Label / Speaker Name | 12px (text-xs) | 400 (normal) | 1.5 |
| Heading (h1 page title) | 30px (text-3xl) | 600 (semibold) | 1.5 |
| Transcript message | 14px (text-sm) | 400 (normal) | 1.5 |

Font weights used: 400 (normal) for body, labels, speaker names, and transcript text; 600 (semibold) for headings only. Two weights total.

Typography follows the project-wide convention established in `frontend/src/styles/index.css`. Phase 08 uses only the existing type scale -- no new sizes introduced.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | #FFFFFF (--background) | Page background, transcript panel, header bar |
| Secondary (30%) | #1E293B (slate-900) / #F3F3F5 (muted) | Avatar view dark background, transcript bubbles (assistant), control bar |
| Accent (10%) | #1E40AF (--primary) | Mic button idle state, user transcript bubble, active mode selector, connection status text |
| Destructive | #EF4444 (--destructive) | End session button, disconnected/error connection dot |

### Voice-Specific Semantic Colors

| Color | Hex | Usage (exact elements) |
|-------|-----|----------------------|
| Listening green | #22C55E (--strength) | Mic button active/listening state, connected status dot, assistant speaker label, waveform bars during speech output |
| Speaking orange | #F97316 (--weakness) | Mic button when AI is speaking, connecting/reconnecting status dot |
| Primary blue | #1E40AF (--primary) | Idle mic button, user speaker label, active mode segment, waveform bars during listening |
| Muted gray | --muted-foreground | Disabled mic button, muted waveform bars, disconnected state |

Accent reserved for: active mode selector segment, user transcript bubble background, primary mic button idle state, "Start Voice Session" CTA on scenario selection, connection status "connected" text (via green semantic color, not primary blue).

---

## Visual Hierarchy & Focal Points

**Primary focal point:** AvatarView (avatar mode) or WaveformViz (voice-only mode) in the center panel. This is the largest, most visually prominent element occupying the vertical center of the session layout.

**Secondary focal point:** Mic button in the VoiceControls bar at the bottom center. The 56px circle with state-dependent color and ping animation draws the eye as the primary interactive element.

**Tertiary:** VoiceTranscript panel below the avatar/waveform, providing running conversation context. ConnectionStatus dot in the header provides ambient awareness without demanding attention.

---

## Component Inventory

### Existing Voice Components (Plans 01-03, NO changes needed)

| Component | File | Visual Contract |
|-----------|------|----------------|
| VoiceSession | `components/voice/voice-session.tsx` | Full-screen 3-panel layout: left (ScenarioPanel) + center (Avatar/Transcript/Controls) + right (HintsPanel). Panels collapse in full-screen mode. `bg-background` surface. |
| VoiceSessionHeader | `components/voice/voice-session-header.tsx` | 64px height, `border-b border-slate-200 bg-white`. Left: SessionTimer + truncated title (max-w-200px). Center: mode Badge (secondary variant). Right: ConnectionStatus + view toggle + destructive End Session button. |
| AvatarView | `components/voice/avatar-view.tsx` | Dark container (`bg-slate-900`), 280px non-fullscreen / `calc(100vh - 64px - 80px)` fullscreen. WebRTC video fills container. Waveform fallback when no avatar. HCP name overlay at bottom with `from-black/60` gradient. |
| VoiceTranscript | `components/voice/voice-transcript.tsx` | Chat-style bubbles with auto-scroll. User: right-aligned, primary bg, rounded-2xl rounded-tr-sm. Assistant: left-aligned, muted bg, rounded-2xl rounded-tl-sm. Speaker labels: user in primary color, assistant in #22C55E. Non-final segments at 70% opacity with pulsing cursor. |
| VoiceControls | `components/voice/voice-controls.tsx` | 64px (h-16) centered bar. Central mic 56px circle with state-dependent colors and ping animation on listening. Side buttons 40px circles for mute, keyboard, fullscreen. Tooltip on all controls. |
| FloatingTranscript | `components/voice/floating-transcript.tsx` | 80px overlay at bottom of fullscreen view, `rgba(0,0,0,0.7)` background. Speaker label + single line truncated text in white. |
| WaveformViz | `components/voice/waveform-viz.tsx` | 120px `bg-slate-900` container. 5 vertical bars (w-2, h-64, rounded-full) with requestAnimationFrame-driven scaleY. Bar color: primary (listening), #22C55E (speaking), muted (idle/muted). State label in `text-xs text-white/70`. |
| ModeSelector | `components/voice/mode-selector.tsx` | Segmented radio group in `bg-muted p-1 rounded-lg`. Active segment: `bg-primary text-primary-foreground`. Inactive: `text-muted-foreground`. Icons: MessageSquare (text), Mic (voice), User (avatar). Disabled segments at 50% opacity with `cursor-not-allowed`. |
| ConnectionStatus | `components/voice/connection-status.tsx` | Inline flex with 8px (h-2 w-2) colored dot + text-sm label. Green (#22C55E) for connected, orange (#F97316) for connecting/reconnecting, destructive for disconnected/error. `aria-live="assertive"` for screen reader. |

### New/Modified UI for Plan 04

| Element | Location | Visual Contract |
|---------|----------|----------------|
| Voice tab in scenario selection | `pages/user/training.tsx` | Third TabsTrigger in existing TabsList after "F2F" and "Conference". Label: i18n `coach:scenarioSelection.tabVoice`. Same styling as existing tabs (Radix TabsTrigger with project defaults). |
| Voice scenario card action | ScenarioCard interaction | When voice tab is active, ScenarioCard's "Start Training" button creates session with `mode=voice` and navigates to `/user/training/voice?id={sessionId}&mode=voice`. Uses existing `ScenarioCard` component -- no visual change. |
| Feature toggle gating | Voice tab visibility | Voice tab rendered ONLY when `feature_voice_live_enabled` is true in ConfigContext. When false, only F2F and Conference tabs shown (current behavior). No placeholder or "coming soon" state. |
| Admin Voice Live config card | `pages/admin/azure-config.tsx` | Already rendered via `AZURE_SERVICES` array with key `voiceLive`, Phone icon, ServiceConfigCard pattern. No visual changes needed. |

---

## Interaction States

### Voice Session Lifecycle

| State | Visual | Transition |
|-------|--------|-----------|
| Loading | Centered Loader2 spinner (h-8 w-8, animate-spin, text-primary) + "Voice Coaching Session" text below | URL params parsed, session/scenario fetching |
| Connecting | AvatarView shows Skeleton (h-20 w-20 rounded-full) + "Connecting avatar..." text. Header shows orange connecting dot. | Token broker called, WebSocket/WebRTC initializing |
| Connected (voice) | WaveformViz active with audio bars. Green connected dot in header. Mic button in primary blue (idle). | Voice Live WebSocket connected, no avatar |
| Connected (avatar) | WebRTC video fills AvatarView container. Green connected dot. HCP name overlay at bottom. | Both Voice Live and Avatar connected |
| Listening | Mic button turns green (#22C55E) with ping animation (1.5s pulse). Waveform bars in primary blue. | User speaking into microphone |
| AI Speaking | Mic button turns orange (#F97316). Volume2 icon replaces Mic. Waveform bars in green (#22C55E). | AI HCP responding via TTS |
| Muted | MicOff icon, muted-foreground bg. Waveform bars at 30% opacity. | User tapped mute toggle |
| Fullscreen | Header has `bg-black/50 border-white/10 text-white`. Side panels hidden. FloatingTranscript overlay at bottom. Minimize2 icon replaces Maximize2. | User toggled fullscreen |
| Keyboard input | Text input appears below transcript area with `border-t border-slate-200 p-3`. Input field with `border-slate-300`, sm text, primary focus ring. Send button. | User toggled keyboard |
| End session dialog | Dialog with DialogTitle "End Voice Session", DialogDescription confirmation text. Two buttons: "Continue Session" (outline) and "End Session" (destructive). | User clicked End Session |
| Fallback: avatar -> voice | Toast error "Avatar connection failed. Switching to voice-only mode." Mode badge changes to "Voice Mode". AvatarView switches to WaveformViz. | WebRTC connection failure |
| Fallback: voice -> text | Toast error "Failed to connect to voice service. Check your network and try again." Mode badge changes to "Text Mode". Keyboard input shown by default. | Voice Live WebSocket failure |

### Scenario Selection Voice Tab

| State | Visual |
|-------|--------|
| Voice tab active | Same grid layout as F2F/Conference tabs. Scenario cards rendered with existing ScenarioCard component. |
| Empty scenarios | EmptyState component with `scenarioSelection.emptyTitle` and `scenarioSelection.emptyBody` copy. |
| Session creating | ScenarioCard loading state (button disabled during mutation). |
| Voice unavailable (feature off) | Voice tab not rendered. No visual placeholder. |

---

## Copywriting Contract

| Element | en-US Copy | i18n Key |
|---------|-----------|----------|
| Primary CTA (scenario selection) | "Start Training" | `coach:scenarioSelection.startTraining` (existing) |
| Voice tab label | "Voice" | `coach:scenarioSelection.tabVoice` (NEW -- add to coach.json) |
| Empty transcript (voice) | "Start speaking to begin the conversation. Your transcript will appear here." | `voice:emptyTranscript` (existing) |
| Empty transcript (text fallback) | "Type a message to begin the conversation." | `voice:emptyTranscriptText` (existing) |
| Voice not configured | "Voice mode is not available. Contact your admin to configure Azure Voice Live API." | `voice:notConfigured` (existing) |
| Avatar not configured | "Avatar mode is not available. Voice-only mode will be used instead." | `voice:avatarNotConfigured` (existing) |
| Connection failed | "Failed to connect to voice service. Check your network and try again." | `voice:error.connectionFailed` (existing) |
| Avatar failed | "Avatar connection failed. Switching to voice-only mode." | `voice:error.avatarFailed` (existing) |
| Mic denied | "Microphone access was denied. Please allow microphone access in your browser settings." | `voice:error.micDenied` (existing) |
| End session title | "End Voice Session" | `voice:endSessionTitle` (existing) |
| End session confirm | "Are you sure you want to end this voice coaching session? Your conversation will be scored and cannot be resumed." | `voice:endSessionConfirm` (existing) |
| Continue session | "Continue Session" | `voice:continueSession` (existing) |
| End session button | "End Session" | `voice:endSession` (existing) |
| Admin config saved | "Configuration saved" | `admin:azureConfig.saved` (existing) |
| Admin config save failed | "Failed to save configuration" | `admin:azureConfig.saveFailed` (existing) |

### Destructive Actions

| Action | Confirmation Approach |
|--------|----------------------|
| End voice session | Dialog with explicit "End Session" (destructive variant) vs. "Continue Session" (outline variant). Copy explains scoring consequence and irreversibility. |

### New i18n Keys Required

| Namespace | Key | en-US Value | zh-CN Value |
|-----------|-----|-------------|-------------|
| coach | `scenarioSelection.tabVoice` | "Voice" | "语音" |

All other voice copy already exists in the `voice` namespace from Plans 02-03.

---

## Responsive Behavior

| Breakpoint | Layout Change |
|------------|--------------|
| Desktop (>=1024px) | 3-panel layout: left ScenarioPanel (collapsible, ~280px) + center (flex-1) + right HintsPanel (collapsible, ~280px) |
| Tablet (768-1023px) | Side panels auto-collapsed. Center panel fills width. User can expand panels via toggle buttons. |
| Mobile (<768px) | Full-screen mode auto-activated. Header compact. FloatingTranscript overlay for last message. Controls bar at bottom. |

The voice session page follows the existing full-screen pattern from `conference-session.tsx` and `training-session.tsx` -- no UserLayout wrapper.

---

## Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Screen reader connection state | ConnectionStatus uses `aria-live="assertive"` + `role="status"` |
| Mic button state announcement | Each mic state has a unique `aria-label` from `voice:micButton.*` keys |
| Mode selector | Uses `role="radiogroup"` with `role="radio"` + `aria-checked` on each option |
| Tooltip on controls | All VoiceControls buttons wrapped in Tooltip component |
| Avatar region label | AvatarView container has `role="region"` + `aria-label` |
| Transcript live updates | VoiceTranscript and empty state use `aria-live="polite"` |
| Waveform visualization | WaveformViz has `role="img"` with descriptive `aria-label` |
| Keyboard navigation | All interactive elements are focusable native buttons with visible focus rings (outline-ring/50 from base styles) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| No registries | No new components from any registry | not applicable |

Phase 08 Plan 04 does not add any new shadcn or third-party UI components. All components were already created in Plans 01-03 using the project's established Radix UI wrapper pattern.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

</details>

