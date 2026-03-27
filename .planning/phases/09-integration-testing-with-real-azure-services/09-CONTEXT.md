# Phase 09: Integration Testing with Real Azure Services - Context

**Gathered:** 2026-03-27 (updated)
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate all Azure service integrations end-to-end with real Azure credentials AND polish the demo experience for customer presentations. This phase covers both technical validation (each Azure service works correctly, fallbacks trigger properly) and demo-readiness (UI polish, performance tuning, smooth transitions). The platform must be ready to demo the full pipeline: text coaching → voice-only coaching → avatar coaching, with admin config switching between modes.

**PREREQUISITE (backported to Phase 07/08):** Azure config must be aligned to use unified AI Foundry endpoint, dual auth (API key + Azure AD token), and Agent/Model dual mode BEFORE integration tests run. This config alignment work is backported to Phase 07 (config service) and Phase 08 (Voice Live) as additional plan(s).

**In scope:**
- **Config alignment (backported):** Unified AI Foundry endpoint, Azure AD token auth, Agent/Model mode toggle
- Pytest integration tests for each Azure service (OpenAI, Speech STT/TTS, Voice Live, Avatar, Content Understanding)
- Playwright E2E tests for full demo flow with real Azure services
- Manual smoke test checklist for demo preparation
- Performance validation (response latency, avatar rendering quality)
- Fallback chain verification (avatar → voice → text)
- UI polish and transition smoothness for customer demo
- Scoring verification across all session modes

**Out of scope:**
- New features or capabilities
- CI/CD integration of Azure tests (local-only execution)
- Azure cost optimization
- New UI pages

</domain>

<decisions>
## Implementation Decisions

### Config Alignment — Unified AI Foundry Endpoint
- **D-01:** Replace 6 separate service configs with a single AI Foundry config card. Admin configures ONE endpoint (`https://ai-foundary-qiah-east-us2.cognitiveservices.azure.com/`), ONE region (`eastus2`), and ONE auth method. All services (OpenAI, Speech, Avatar, Voice Live, Content Understanding) derive from this single config.
- **D-02:** ServiceConfig model changes: add `ai_foundry_endpoint`, `ai_foundry_region`, `auth_method` (enum: `api_key` | `azure_ad`). Individual service rows become toggles (enabled/disabled) without their own endpoint/key fields.
- **D-03:** Admin UI: Single "Azure AI Foundry" config card replaces the current 6 service cards. Fields: endpoint URL, region, auth method toggle, API key (if api_key mode). Per-service toggles for enable/disable below the main card.

### Config Alignment — Dual Auth (API Key + Azure AD Token)
- **D-04:** Support both auth methods: API key AND Azure AD token. If API key is configured and works, use it. If not (or `disableLocalAuth: true` on the resource), fall back to Azure AD token via `DefaultAzureCredential`.
- **D-05:** `DefaultAzureCredential` chain: works with `az login` locally, managed identity in prod. Requires `azure-identity` SDK package.
- **D-06:** Token broker for Voice Live: if AD auth, use `DefaultAzureCredential` to get a short-lived token instead of passing raw API key to frontend. This is more secure than current raw-key approach.

### Seven Interaction Modes
- **D-07:** Platform supports 7 interaction modes, admin-configurable:
  1. **Text** — Text-only coaching (Azure OpenAI chat completions REST API)
  2. **Voice Pipeline** — Voice without avatar (Azure Speech STT → Azure OpenAI chat → Azure Speech TTS)
  3. **Digital Human: Speech+Model** — Avatar with pipeline voice (STT → LLM → TTS → Avatar rendering)
  4. **Voice Realtime Model** — Voice without avatar via `voice-live/realtime` WebSocket (all-in-one realtime)
  5. **Digital Human: Realtime Model** — Avatar with `voice-live/realtime` WebSocket + Avatar rendering
  6. **Voice Realtime Agent** — Voice without avatar via `voice-agent/realtime` WebSocket (function calling enabled)
  7. **Digital Human: Realtime Agent** — Avatar with `voice-agent/realtime` WebSocket + Avatar rendering (function calling enabled)
- **D-08:** Admin selects active mode from AI Foundry config card. Default to Text for backward compatibility. Fallback chain: 7→6→5→4→3→2→1 based on service availability.

### Config Alignment Scope
- **D-09:** Config alignment code changes are backported to Phase 07 (backend config service, config API, adapters) and Phase 08 (Voice Live token broker, frontend hooks). Phase 09 focuses on testing + validation of the aligned config.

### Test Scope & Strategy
- **D-10:** Equal focus on technical validation AND demo polish — this is the main content for customer demos
- **D-11:** Test the full pipeline demo flow: admin configures AI Foundry → user starts text session → switches to voice-only → switches to avatar mode, with scoring working on all modes
- **D-12:** All Azure services tested: Azure OpenAI (LLM), Azure Speech (STT/TTS), Azure Voice Live (Agent + Model), Azure AI Avatar, Azure Content Understanding

### Environment & Credentials
- **D-13:** Tests run with real AI Foundry credentials. For AD auth: tester must run `az login` first. For API key: key in `.env`.
- **D-14:** Tests are local + manual only — no CI/CD integration with Azure credentials

### Test Execution Approach
- **D-15:** Two-layer test approach: Pytest integration tests per Azure service + Playwright E2E tests for full demo flow
- **D-16:** Pytest tests: one test module per service, all using the unified AI Foundry endpoint
- **D-17:** Playwright E2E tests: exercise the complete demo scenario from login → admin AI Foundry config → text/voice/avatar → scoring
- **D-18:** Manual smoke test checklist documented for pre-demo preparation

### Acceptance Criteria
- **D-19:** AI response latency < 3 seconds for smooth conversation flow
- **D-20:** Avatar renders smoothly — lip-sync matches speech, no freezing
- **D-21:** Graceful fallback chain: Avatar → voice-only → text. Clear user feedback at each transition.
- **D-22:** Post-session scoring report generates correctly for all session modes

### Claude's Discretion
- Exact Playwright test structure and page object patterns
- Performance measurement implementation
- Test data fixtures and seed data
- Skip markers for offline development
- Smoke test checklist format
- How to structure the backported config alignment plans within Phase 07/08

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Azure AI Foundry Resource (from user)
- Resource: `ai-foundary-qiah-east-us2` (kind: `AIServices`, region: `eastus2`)
- Unified endpoint: `https://ai-foundary-qiah-east-us2.cognitiveservices.azure.com/`
- `disableLocalAuth: true` — API key auth disabled on this resource, Azure AD required
- Endpoints confirmed: OpenAI Realtime, Voice Agent Realtime, Voice Live Realtime, Speech STT/TTS, Avatar, Content Understanding

### Current Config Architecture (Phase 07)
- `backend/app/services/config_service.py` — Config CRUD with Fernet encryption
- `backend/app/api/azure_config.py` — Admin REST API + dynamic adapter registration + `register_adapter_from_config()`
- `backend/app/models/service_config.py` — ServiceConfig ORM model (needs schema changes)
- `backend/app/config.py` — Settings class with env vars
- `backend/app/utils/encryption.py` — Fernet encrypt/decrypt
- `backend/app/services/connection_tester.py` — Service-specific connection tests
- `backend/app/main.py` — Startup lifespan with 2-phase adapter loading

### Azure Service Adapters
- `backend/app/services/agents/adapters/azure_openai.py` — Azure OpenAI LLM adapter (needs AD token support)
- `backend/app/services/agents/stt/azure.py` — Azure Speech STT (needs unified endpoint + AD token)
- `backend/app/services/agents/tts/azure.py` — Azure Speech TTS (needs unified endpoint + AD token)
- `backend/app/services/agents/avatar/azure.py` — Azure Avatar adapter (stub)
- `backend/app/services/agents/registry.py` — ServiceRegistry singleton

### Voice Live & Avatar (Phase 08)
- `backend/app/services/voice_live_service.py` — Token broker (needs AD token + Agent/Model mode)
- `backend/app/api/voice_live.py` — Voice Live API routes
- `frontend/src/hooks/use-voice-live.ts` — RTClient connection (needs Agent mode path option)
- `frontend/src/hooks/use-avatar-stream.ts` — WebRTC avatar stream

### Admin Configuration UI
- `frontend/src/pages/admin/azure-config.tsx` — Needs full redesign for single AI Foundry card
- `frontend/src/api/azure-config.ts` — Frontend API client
- `frontend/src/types/azure-config.ts` — TypeScript types

### Existing Tests
- `backend/tests/` — Existing test patterns and conftest.py
- `frontend/e2e/` — Existing Playwright E2E patterns

### Project Requirements
- `docs/requirements.md` — COACH-04, COACH-05, COACH-07, PLAT-03, PLAT-05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Connection tester**: `backend/app/services/connection_tester.py` — needs adaptation for unified endpoint + AD token
- **Mock adapters**: All services have mock adapters — baseline comparison for real behavior
- **Conftest fixtures**: `backend/tests/conftest.py` — async test client, database fixtures, auth helpers
- **Playwright config**: `frontend/playwright.config.ts` — existing E2E infrastructure

### Established Patterns
- **Pytest-asyncio**: All backend tests use async patterns with httpx AsyncClient
- **Adapter pattern**: BaseAdapter → MockAdapter/RealAdapter pattern per service
- **Config service**: CRUD with Fernet encryption for sensitive values

### Integration Points
- **ServiceConfig model**: Must change schema for unified AI Foundry approach (Alembic migration needed)
- **register_adapter_from_config()**: Must accept unified config and instantiate all adapters from single endpoint
- **Voice Live token broker**: Must support both API key pass-through and AD token generation
- **Frontend admin UI**: Complete redesign of azure-config page for single AI Foundry card

### Key Gaps (from codebase analysis)
1. No Azure AD Token auth anywhere — all uses API keys exclusively
2. No Agent mode — only Model mode for Voice Live
3. Raw API key exposed to browser via token broker
4. STT/TTS configured as separate services with duplicate keys
5. Frontend `SERVICE_KEY_MAP` lists services not recognized by backend
6. `register_adapter_from_config` ignores `azure_voice_live`
7. Azure Avatar adapter is a stub (`is_available()` always False)

</code_context>

<specifics>
## Specific Ideas

- Use single AI Foundry service approach — users shouldn't configure so many things (用户不用配置那么多东西，配置就简单很多)
- Reference Voice-Live-Agent-With-Avadar repo for Agent mode + Model mode pattern
- This is the main demo content for BeiGene — must be polished and reliable
- Demo should showcase full pipeline: text → voice → avatar with smooth transitions
- Performance matters — response latency must feel conversational (< 3 seconds)
- Avatar must render without glitches — "wow" factor for demo
- 需要好好测试性能，UI美观，效果，便利性等

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-integration-testing-with-real-azure-services*
*Context gathered: 2026-03-27 (updated with AI Foundry config alignment decisions)*
