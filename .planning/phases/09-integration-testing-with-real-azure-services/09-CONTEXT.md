# Phase 09: Integration Testing with Real Azure Services - Context

**Gathered:** 2026-03-28 (updated — revised scope to include unimplemented config alignment)
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the remaining Azure config alignment work (unified AI Foundry endpoint, 7 interaction modes, agent mode runtime) that was planned for Phase 07/08 but not implemented, then validate all Azure service integrations end-to-end with real credentials and polish the demo experience for BeiGene customer presentations.

**Implementation scope (config alignment):**
- Unified AI Foundry config: single endpoint replacing 8 separate ServiceConfig rows
- Expand from 3 modes (text/voice/avatar) to 7 interaction modes
- Wire agent mode end-to-end (token broker, frontend hook, WebSocket path)
- Admin UI redesign: single AI Foundry card with per-service toggles

**Testing scope:**
- Pytest integration tests per Azure service with real credentials
- Playwright E2E tests for full demo flow
- Performance validation and manual smoke test checklist

**Out of scope:**
- Azure AD token auth (DefaultAzureCredential) — deferred to future phase
- Fallback chain (7→1 based on service availability) — deferred
- New features or capabilities
- CI/CD integration of Azure tests (local-only execution)

</domain>

<decisions>
## Implementation Decisions

### Unified AI Foundry Config
- **D-01:** Single master ServiceConfig row with AI Foundry endpoint, region, and API key. Per-service rows become enable/disable toggles with service-specific fields (model/deployment name). Replaces current 8 separate rows with own endpoints/keys.
- **D-02:** ServiceConfig schema changes: add `ai_foundry_endpoint`, `ai_foundry_region`, `api_key_encrypted` (master). Per-service rows keep `service_name`, `enabled`, `model_or_deployment`. Remove per-service endpoint/key fields.
- **D-03:** API key auth only for now. Azure AD token auth (DefaultAzureCredential) deferred to a future phase. Current resource may have `disableLocalAuth: true` — tester needs to enable API key auth or defer AD auth support.

### Admin UI — Single AI Foundry Card
- **D-04:** One "Azure AI Foundry" config card with endpoint URL, region, API key fields. Below it: toggle list for each service (enable/disable) with service-specific fields like model/deployment name.
- **D-05:** Replaces current 8 separate `ServiceConfigCard` components in `azure-config.tsx`.

### Seven Interaction Modes
- **D-06:** Platform supports 7 interaction modes, admin-configurable:
  1. **Text** — Text-only coaching (Azure OpenAI chat completions REST API)
  2. **Voice Pipeline** — Voice without avatar (Azure Speech STT → Azure OpenAI chat → Azure Speech TTS)
  3. **Digital Human: Speech+Model** — Avatar with pipeline voice (STT → LLM → TTS → Avatar rendering)
  4. **Voice Realtime Model** — Voice without avatar via `voice-live/realtime` WebSocket (all-in-one realtime)
  5. **Digital Human: Realtime Model** — Avatar with `voice-live/realtime` WebSocket + Avatar rendering
  6. **Voice Realtime Agent** — Voice without avatar via `voice-agent/realtime` WebSocket (function calling enabled)
  7. **Digital Human: Realtime Agent** — Avatar with `voice-agent/realtime` WebSocket + Avatar rendering (function calling enabled)
- **D-07:** Session mode schema expands from `Literal["text", "voice", "avatar"]` to full 7-mode enum. Alembic migration required.

### Mode Selector UI — Two-Level
- **D-08:** Two-level selector: first pick communication type (Text, Voice-only, Digital Human), then pick engine (Pipeline, Realtime Model, Realtime Agent). Clearer for non-technical MR users.
- **D-09:** Admin-configured default mode. Modes only shown if their required services are enabled in AI Foundry config.

### Agent Mode Runtime
- **D-10:** Token broker reads agent mode from ServiceConfig (via `parse_voice_live_mode()`), returns `agent_id` + `project_name` in `VoiceLiveTokenResponse` when agent mode is selected.
- **D-11:** Frontend `use-voice-live.ts` hook uses `voice-agent/realtime` WebSocket path when agent mode, `voice-live/realtime` when model mode. Conditional connection logic based on token response.

### Test Scope & Strategy
- **D-12:** Implementation first, test after. Build unified config + 7 modes + agent runtime, then write integration tests and E2E tests to validate.
- **D-13:** Two-layer test approach: Pytest integration tests per Azure service + Playwright E2E tests for full demo flow.
- **D-14:** Pytest tests: one test module per service, all using the unified AI Foundry endpoint. Use `@pytest.mark.integration` with `--run-integration` CLI flag.
- **D-15:** Playwright E2E tests: exercise the complete demo scenario from login → admin AI Foundry config → text/voice/avatar → scoring.
- **D-16:** Manual smoke test checklist documented for pre-demo preparation.

### Acceptance Criteria
- **D-17:** AI response latency < 3 seconds for smooth conversation flow.
- **D-18:** Avatar renders smoothly — lip-sync matches speech, no freezing.
- **D-19:** Post-session scoring report generates correctly for all session modes.
- **D-20:** Full pipeline demo works: Login → Admin configures AI Foundry → Text session → Switch to voice → Switch to avatar → Score report.

### Claude's Discretion
- Exact Playwright test structure and page object patterns
- Performance measurement implementation
- Test data fixtures and seed data
- Skip markers for offline development
- Smoke test checklist format
- Alembic migration details for schema changes
- How to structure plans (config alignment vs testing can be separate plans)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Azure AI Foundry Resource
- Resource: `ai-foundary-qiah-east-us2` (kind: `AIServices`, region: `eastus2`)
- Unified endpoint: `https://ai-foundary-qiah-east-us2.cognitiveservices.azure.com/`
- Endpoints confirmed: OpenAI Realtime, Voice Agent Realtime, Voice Live Realtime, Speech STT/TTS, Avatar, Content Understanding

### Current Config Architecture (Phase 07)
- `backend/app/services/config_service.py` — Config CRUD with Fernet encryption
- `backend/app/api/azure_config.py` — Admin REST API + dynamic adapter registration
- `backend/app/models/service_config.py` — ServiceConfig ORM model (needs schema changes for unified config)
- `backend/app/config.py` — Settings class with env vars
- `backend/app/utils/encryption.py` — Fernet encrypt/decrypt
- `backend/app/services/connection_tester.py` — Service-specific connection tests
- `backend/app/main.py` — Startup lifespan with 2-phase adapter loading

### Azure Service Adapters
- `backend/app/services/agents/adapters/azure_openai.py` — Azure OpenAI LLM adapter
- `backend/app/services/agents/stt/azure.py` — Azure Speech STT
- `backend/app/services/agents/tts/azure.py` — Azure Speech TTS
- `backend/app/services/agents/avatar/azure.py` — Azure Avatar adapter (stub)
- `backend/app/services/agents/adapters/azure_voice_live.py` — Agent/Model mode parse/encode functions
- `backend/app/services/agents/registry.py` — ServiceRegistry singleton

### Voice Live & Avatar (Phase 08)
- `backend/app/services/voice_live_service.py` — Token broker (needs agent mode + unified config)
- `backend/app/api/voice_live.py` — Voice Live API routes
- `frontend/src/hooks/use-voice-live.ts` — RTClient connection (needs Agent mode path)
- `frontend/src/hooks/use-avatar-stream.ts` — WebRTC avatar stream

### Admin Configuration UI
- `frontend/src/pages/admin/azure-config.tsx` — Needs full redesign for single AI Foundry card
- `frontend/src/components/admin/service-config-card.tsx` — Has agent mode toggle (partially done)
- `frontend/src/api/azure-config.ts` — Frontend API client
- `frontend/src/types/azure-config.ts` — TypeScript types (has VoiceLiveAgentConfig)

### Mode Selection
- `frontend/src/components/voice/mode-selector.tsx` — Current 3-mode selector (needs 7-mode two-level redesign)
- `frontend/src/types/voice-live.ts` — SessionMode type (needs expansion)
- `backend/app/schemas/session.py` — Session mode Literal (needs expansion)
- `backend/app/models/session.py` — Session model mode field

### Existing Tests
- `backend/tests/` — Existing test patterns and conftest.py
- `frontend/e2e/` — Existing Playwright E2E patterns

### Project Requirements
- `docs/requirements.md` — COACH-04, COACH-05, COACH-06, COACH-07, PLAT-03, PLAT-05

### Reference Repository
- User's `Voice-Live-Agent-With-Avadar` repo — Reference for Agent mode + Model mode pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Agent mode parse/encode**: `backend/app/services/agents/adapters/azure_voice_live.py` — `parse_voice_live_mode()` and `encode_voice_live_mode()` already handle agent config serialization
- **Agent mode admin UI**: `frontend/src/components/admin/service-config-card.tsx` — Agent/Model toggle with agent_id/project_name fields already implemented
- **Agent mode types**: `frontend/src/types/azure-config.ts` — `VoiceLiveAgentConfig` and `VoiceLiveModelConfig` types exist
- **Region capabilities**: `backend/app/services/region_capabilities.py` — `VOICE_LIVE_AGENT_REGIONS` defined
- **Connection tester**: `backend/app/services/connection_tester.py` — needs adaptation for unified endpoint
- **Mock adapters**: All services have mock adapters — baseline comparison for real behavior
- **Conftest fixtures**: `backend/tests/conftest.py` — async test client, database fixtures, auth helpers
- **Playwright config**: `frontend/playwright.config.ts` — existing E2E infrastructure

### Established Patterns
- **Pytest-asyncio**: All backend tests use async patterns with httpx AsyncClient
- **Adapter pattern**: BaseAdapter → MockAdapter/RealAdapter pattern per service
- **Config service**: CRUD with Fernet encryption for sensitive values
- **TanStack Query hooks**: Per-domain hooks in `frontend/src/hooks/`

### Integration Points
- **ServiceConfig model**: Schema change for unified AI Foundry (Alembic migration)
- **register_adapter_from_config()**: Must accept unified config and instantiate all adapters from single endpoint
- **Voice Live token broker**: Must pass agent config and support unified endpoint
- **Frontend mode selector**: Two-level UI replacing current 3-button selector
- **Session schema/model**: Mode enum expansion from 3 to 7 values

### Key Gaps (from codebase audit)
1. No Agent mode runtime — admin can store config, but token broker and frontend ignore it
2. Raw API key exposed to browser via token broker (no token-based approach)
3. STT/TTS configured as separate services with duplicate keys
4. Frontend `SERVICE_KEY_MAP` lists services not recognized by backend
5. `register_adapter_from_config` ignores `azure_voice_live`
6. Azure Avatar adapter is a stub (`is_available()` always False)
7. Session mode limited to 3 values (text/voice/avatar)

</code_context>

<specifics>
## Specific Ideas

- Use single AI Foundry service approach — users shouldn't configure so many things (用户不用配置那么多东西，配置就简单很多)
- Reference Voice-Live-Agent-With-Avadar repo for Agent mode + Model mode pattern
- This is the main demo content for BeiGene — must be polished and reliable
- Demo should showcase full pipeline: text → voice → avatar with smooth transitions
- Performance matters — response latency must feel conversational (< 3 seconds)
- Avatar must render without glitches — "wow" factor for demo
- Two-level mode selector: communication type first, then engine — clearer for non-technical MR users
- 需要好好测试性能，UI美观，效果，便利性等

</specifics>

<deferred>
## Deferred Ideas

- **Azure AD token auth (DefaultAzureCredential)** — Requires `azure-identity` SDK, more complex auth flow. Implement when production deployment requires it.
- **Fallback chain (7→6→5→4→3→2→1)** — Graceful mode degradation based on service availability. Good for production resilience but not needed for controlled demo environment.
- **CI/CD integration of Azure tests** — Avoid Azure costs in CI pipeline. Local-only execution for now.
- **Azure cost optimization** — Future phase concern.

</deferred>

---

*Phase: 09-integration-testing-with-real-azure-services*
*Context gathered: 2026-03-28 (updated — config alignment + testing scope)*
