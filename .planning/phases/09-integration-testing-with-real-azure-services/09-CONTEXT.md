# Phase 09: Integration Testing with Real Azure Services - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate all Azure service integrations end-to-end with real Azure credentials AND polish the demo experience for customer presentations. This phase covers both technical validation (each Azure service works correctly, fallbacks trigger properly) and demo-readiness (UI polish, performance tuning, smooth transitions). The platform must be ready to demo the full pipeline: text coaching → voice-only coaching → avatar coaching, with admin config switching between modes.

**In scope:**
- Pytest integration tests for each Azure service (OpenAI, Speech STT/TTS, Voice Live, Avatar)
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

### Test Scope & Strategy
- **D-01:** Equal focus on technical validation AND demo polish — this is the main content for customer demos
- **D-02:** Test the full pipeline demo flow: admin configures Azure services → user starts text session → switches to voice-only → switches to avatar mode, with scoring working on all modes
- **D-03:** All Azure services tested: Azure OpenAI (LLM), Azure Speech (STT/TTS), Azure Voice Live API, Azure AI Avatar

### Environment & Credentials
- **D-04:** Use existing pattern from Phase 7 — credentials in backend `.env` for dev, configured via Admin Azure Config page for demo
- **D-05:** No separate test config profiles — use the same admin UI configuration flow that the demo itself uses
- **D-06:** Tests are local + manual only — no CI/CD integration with Azure credentials (avoids Azure costs)

### Test Execution Approach
- **D-07:** Two-layer test approach: Pytest integration tests per Azure service + Playwright E2E tests for full demo flow
- **D-08:** Pytest tests: one test module per Azure service adapter (test_azure_openai_integration.py, test_azure_speech_integration.py, test_voice_live_integration.py, test_avatar_integration.py)
- **D-09:** Playwright E2E tests: exercise the complete demo scenario from login → admin config → start session → text/voice/avatar interaction → scoring report
- **D-10:** Manual smoke test checklist documented for pre-demo preparation

### Acceptance Criteria
- **D-11:** AI response latency < 3 seconds for smooth conversation flow (text and voice modes)
- **D-12:** Avatar renders smoothly — lip-sync matches speech, no freezing or glitches
- **D-13:** Graceful fallback chain works: Avatar unavailable → voice-only with waveform, Voice unavailable → text-only. Clear user feedback at each transition.
- **D-14:** Post-session scoring report generates correctly for text, voice, and avatar sessions — same dimensions, same quality

### Claude's Discretion
- Exact Playwright test structure and page object patterns
- Performance measurement implementation (timing hooks, metrics collection)
- Test data fixtures and seed data for integration tests
- Skip markers for offline development (pytest markers to skip Azure tests without credentials)
- Smoke test checklist format and detail level

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Azure Service Adapters (Phase 07)
- `backend/app/services/agents/adapters/azure_openai.py` — Azure OpenAI LLM adapter implementation
- `backend/app/services/agents/stt/azure.py` — Azure Speech STT adapter
- `backend/app/services/agents/tts/azure.py` — Azure Speech TTS adapter
- `backend/app/services/agents/avatar/azure.py` — Azure Avatar adapter
- `backend/app/services/agents/registry.py` — AdapterRegistry singleton for provider management
- `backend/app/services/connection_tester.py` — Connection testing patterns for Azure services
- `backend/app/services/config_service.py` — Azure config persistence with Fernet encryption

### Voice Live & Avatar (Phase 08)
- `backend/app/api/voice.py` — Voice Live API routes (token broker)
- `frontend/src/pages/user/voice-session.tsx` — Voice session page
- `frontend/src/components/voice/` — Voice session UI components

### Admin Configuration
- `backend/app/api/azure_config.py` — Azure config admin API routes
- `frontend/src/pages/admin/azure-config.tsx` — Azure Config admin page

### Existing Tests
- `backend/tests/` — Existing test patterns and conftest.py fixtures
- `frontend/e2e/` — Existing Playwright E2E test patterns

### Project Requirements
- `docs/requirements.md` — COACH-04 (voice STT), COACH-05 (TTS), COACH-07 (Avatar), PLAT-03 (Azure config), PLAT-05 (voice mode configurable)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Connection tester**: `backend/app/services/connection_tester.py` — pattern for testing Azure service connectivity, can be reused in integration tests
- **Mock adapters**: All services have mock adapters — can be used as baseline comparison for real adapter behavior
- **Conftest fixtures**: `backend/tests/conftest.py` — async test client, database fixtures, authentication helpers
- **Playwright config**: `frontend/playwright.config.ts` — existing E2E test infrastructure

### Established Patterns
- **Pytest-asyncio**: All backend tests use async patterns with httpx AsyncClient
- **Playwright E2E**: Health check test exists as pattern reference
- **Adapter pattern**: Each Azure service follows BaseAdapter → MockAdapter/RealAdapter pattern

### Integration Points
- Backend integration tests connect to real Azure services via adapter registry
- Playwright E2E tests exercise full browser flow including admin config and user coaching sessions
- Session mode switching (text/voice/avatar) is the key integration seam to test

</code_context>

<specifics>
## Specific Ideas

- This is the main demo content for BeiGene customer presentation — must be polished and reliable
- Demo should showcase the full pipeline: text → voice → avatar modes with smooth transitions
- Performance matters — response latency must feel conversational (< 3 seconds)
- Avatar must render without glitches — this is the "wow" factor for the demo
- 需要好好测试性能，UI美观，效果，便利性等 (thorough testing of performance, UI aesthetics, effects, and convenience)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-integration-testing-with-real-azure-services*
*Context gathered: 2026-03-27*
