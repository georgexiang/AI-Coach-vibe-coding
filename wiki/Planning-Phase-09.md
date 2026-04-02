# Phase 09: Integration Testing With Real Azure Services

> Auto-generated from [`.planning/phases/09-integration-testing-with-real-azure-services`](../blob/main/.planning/phases/09-integration-testing-with-real-azure-services)  
> Last synced: 2026-04-02

## Context & Decisions

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

## Plans (5)

| # | Plan File | Status |
|---|-----------|--------|
| 09-01 | 09-01-PLAN.md | Complete |
| 09-02 | 09-02-PLAN.md | Complete |
| 09-03 | 09-03-PLAN.md | Complete |
| 09-04 | 09-04-PLAN.md | Complete |
| 09-05 | 09-05-PLAN.md | Complete |

## Research

<details><summary>Click to expand research notes</summary>

# Phase 09: Integration Testing with Real Azure Services - Research

**Researched:** 2026-03-27
**Domain:** Integration testing, Azure service validation, E2E demo testing, performance measurement
**Confidence:** HIGH

## Summary

Phase 9 is fundamentally different from prior phases: it builds no new features. Instead, it validates that the Azure services integrated in Phases 7 and 8 work correctly end-to-end with real credentials, polishes the demo experience for BeiGene customer presentations, and creates automated + manual test suites for ongoing validation. The codebase already has a comprehensive mock-based test suite (pytest with 60+ test files, Playwright with 30+ spec files) and all Azure adapter implementations are in place.

The testing strategy has two layers: (1) pytest integration tests that bypass mocks and call real Azure APIs (Azure OpenAI chat completion, Azure Speech STT/TTS, Voice Live token broker, Avatar config validation), and (2) Playwright E2E tests that exercise the full browser demo flow from admin config through coaching session modes and scoring. A third layer is a manual smoke test checklist for pre-demo preparation.

**Primary recommendation:** Use pytest markers (`@pytest.mark.integration` with `--run-integration` CLI flag) to separate Azure integration tests from the fast mock-based unit test suite. Playwright E2E tests for the demo flow should run against a live backend with real Azure credentials loaded via the admin UI. Performance assertions (< 3s latency) go directly in the integration test assertions. Do NOT modify existing mock tests or adapters; this phase is purely additive.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Equal focus on technical validation AND demo polish -- this is the main content for customer demos
- **D-02:** Test the full pipeline demo flow: admin configures Azure services -> user starts text session -> switches to voice-only -> switches to avatar mode, with scoring working on all modes
- **D-03:** All Azure services tested: Azure OpenAI (LLM), Azure Speech (STT/TTS), Azure Voice Live API, Azure AI Avatar
- **D-04:** Use existing pattern from Phase 7 -- credentials in backend `.env` for dev, configured via Admin Azure Config page for demo
- **D-05:** No separate test config profiles -- use the same admin UI configuration flow that the demo itself uses
- **D-06:** Tests are local + manual only -- no CI/CD integration with Azure credentials (avoids Azure costs)
- **D-07:** Two-layer test approach: Pytest integration tests per Azure service + Playwright E2E tests for full demo flow
- **D-08:** Pytest tests: one test module per Azure service adapter (test_azure_openai_integration.py, test_azure_speech_integration.py, test_voice_live_integration.py, test_avatar_integration.py)
- **D-09:** Playwright E2E tests: exercise the complete demo scenario from login -> admin config -> start session -> text/voice/avatar interaction -> scoring report
- **D-10:** Manual smoke test checklist documented for pre-demo preparation
- **D-11:** AI response latency < 3 seconds for smooth conversation flow (text and voice modes)
- **D-12:** Avatar renders smoothly -- lip-sync matches speech, no freezing or glitches
- **D-13:** Graceful fallback chain works: Avatar unavailable -> voice-only with waveform, Voice unavailable -> text-only. Clear user feedback at each transition.
- **D-14:** Post-session scoring report generates correctly for text, voice, and avatar sessions -- same dimensions, same quality

### Claude's Discretion
- Exact Playwright test structure and page object patterns
- Performance measurement implementation (timing hooks, metrics collection)
- Test data fixtures and seed data for integration tests
- Skip markers for offline development (pytest markers to skip Azure tests without credentials)
- Smoke test checklist format and detail level

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pytest | 8.3.3 | Backend integration test framework | Already installed and configured in pyproject.toml |
| pytest-asyncio | 0.24.0+ | Async test support | Already configured with asyncio_mode = "auto" |
| pytest-timeout | 2.2.0+ | Test timeout enforcement (60s default) | Already installed; integration tests need longer timeouts |
| Playwright | 1.58.2 | E2E browser testing | Already installed with auth setup and 30+ specs |
| httpx | 0.27.0+ | Async HTTP client for integration tests | Already a project dependency; used for real HTTP calls |
| openai | 1.50.0+ | Azure OpenAI SDK for real API calls | Already installed; integration tests import directly |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| time (stdlib) | - | Performance timing in tests | Measure API response latency |
| os (stdlib) | - | Environment variable reading for credentials | Skip tests when credentials missing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom timing framework | pytest-benchmark | Overkill for simple latency checks; stdlib time.perf_counter() is sufficient |
| Page Object Model classes | Inline selectors | POM adds structure for the complex demo flow; worth it for E2E readability |

**No new installations needed.** All required packages are already in pyproject.toml.

## Architecture Patterns

### Recommended Test File Structure
```
backend/tests/
├── conftest.py                          # Existing: in-memory SQLite fixtures
├── integration/
│   ├── conftest.py                      # Integration-specific: real DB, skip markers, credentials
│   ├── test_azure_openai_integration.py # D-08: Azure OpenAI streaming + latency
│   ├── test_azure_speech_integration.py # D-08: STT transcription + TTS synthesis
│   ├── test_voice_live_integration.py   # D-08: Voice Live token + endpoint reachability
│   └── test_avatar_integration.py       # D-08: Avatar config validation
├── ... (existing test files unchanged)

frontend/e2e/
├── playwright.config.ts                 # Existing: webServer config
├── auth.setup.ts                        # Existing: user + admin auth
├── coverage-helper.ts                   # Existing: Istanbul coverage
├── demo-flow.spec.ts                    # D-09: Full demo pipeline E2E test
├── ... (existing spec files unchanged)

docs/
├── SMOKE_TEST_CHECKLIST.md              # D-10: Pre-demo manual checklist
```

### Pattern 1: Pytest Integration Skip Markers
**What:** Use custom pytest markers and environment variables to gate Azure integration tests
**When to use:** Every integration test file
**Example:**
```python
# backend/tests/integration/conftest.py
import os
import pytest

# Custom marker for integration tests requiring Azure credentials
def pytest_configure(config):
    config.addinivalue_line(
        "markers", "integration: mark test as requiring real Azure credentials"
    )

def has_azure_openai_credentials() -> bool:
    """Check if Azure OpenAI credentials are available in environment."""
    return bool(
        os.environ.get("AZURE_OPENAI_ENDPOINT")
        and os.environ.get("AZURE_OPENAI_API_KEY")
        and os.environ.get("AZURE_OPENAI_DEPLOYMENT")
    )

def has_azure_speech_credentials() -> bool:
    return bool(
        os.environ.get("AZURE_SPEECH_KEY")
        and os.environ.get("AZURE_SPEECH_REGION")
    )

skip_no_openai = pytest.mark.skipif(
    not has_azure_openai_credentials(),
    reason="Azure OpenAI credentials not set (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT)"
)

skip_no_speech = pytest.mark.skipif(
    not has_azure_speech_credentials(),
    reason="Azure Speech credentials not set (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION)"
)
```

### Pattern 2: Performance Assertion in Integration Tests
**What:** Measure and assert response latency within integration tests themselves (D-11)
**When to use:** Every Azure OpenAI and Speech API test
**Example:**
```python
import time
import pytest

@pytest.mark.integration
async def test_azure_openai_response_latency():
    """Azure OpenAI must respond within 3 seconds for conversational flow."""
    adapter = AzureOpenAIAdapter(
        endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        deployment=os.environ["AZURE_OPENAI_DEPLOYMENT"],
    )
    request = CoachRequest(
        session_id="perf-test-1",
        message="Hello doctor, I'd like to discuss treatment options.",
        scenario_context="You are a cardiologist specializing in hypertension.",
    )

    start = time.perf_counter()
    first_token_time = None
    events = []
    async for event in adapter.execute(request):
        if first_token_time is None and event.type == CoachEventType.TEXT:
            first_token_time = time.perf_counter() - start
        events.append(event)
    total_time = time.perf_counter() - start

    assert first_token_time is not None, "Should receive at least one TEXT event"
    assert first_token_time < 3.0, f"First token latency {first_token_time:.2f}s exceeds 3s threshold"
    assert total_time < 15.0, f"Total response time {total_time:.2f}s is too long"
```

### Pattern 3: Playwright Demo Flow with Page Object Pattern
**What:** Structure E2E tests with page helper functions for the multi-step demo flow (D-09)
**When to use:** The demo flow E2E spec
**Example:**
```typescript
// Pattern: helper functions at top of spec file (lightweight, no full POM class)
async function configureAzureService(page: Page, serviceName: string, config: ServiceConfig) {
  await page.goto("/admin/azure-config");
  // Expand the service card
  await page.getByText(serviceName).first().click();
  await page.waitForTimeout(300);
  // Fill config fields
  if (config.endpoint) await page.getByPlaceholder("https://...").first().fill(config.endpoint);
  if (config.apiKey) await page.getByPlaceholder("Enter API key").first().fill(config.apiKey);
  // Save
  await page.getByRole("button", { name: /^save$/i }).first().click();
  await page.waitForTimeout(1000);
}
```

### Anti-Patterns to Avoid
- **Modifying existing mock tests:** Integration tests are additive. Do not change existing test files in `backend/tests/` or `frontend/e2e/`.
- **Hardcoding credentials in test files:** All credentials come from environment variables or the admin UI flow.
- **Running integration tests in CI:** D-06 explicitly excludes CI integration. The pytest marker approach makes this safe -- `pytest` without `-m integration` runs only unit tests.
- **Testing with `ASGITransport`/in-memory DB for integration tests:** Integration tests need the real app running with a real database to test config persistence and dynamic adapter registration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test skip logic | Custom test runner | `pytest.mark.skipif` + env var checks | Standard pytest pattern, well-documented |
| Latency measurement | Custom timing framework | `time.perf_counter()` in test assertions | Sub-millisecond precision, stdlib |
| Browser automation | Custom Selenium setup | Existing Playwright infrastructure | Already configured with auth setup |
| Audio test data | Generate audio files | Use Azure TTS to generate then feed to STT | Tests the real pipeline; no fake audio needed |
| Demo checklist tool | Custom checklist app | Markdown checklist document | Simple, version-controlled, no maintenance |

**Key insight:** This phase creates zero new application code. Every test calls existing adapters, services, and UI pages. The only new files are test modules and a checklist document.

## Common Pitfalls

### Pitfall 1: Azure SDK Not Installed for Integration Tests
**What goes wrong:** `azure-cognitiveservices-speech` is in the optional `[voice]` dependency group, not the base install. Tests import it and fail with ImportError.
**Why it happens:** The STT/TTS adapters use conditional `import` inside methods. Integration tests need the real SDK.
**How to avoid:** Integration test conftest.py should check for the SDK and skip speech tests if not installed. Document: `pip install -e ".[all]"` is required for full integration testing.
**Warning signs:** `ImportError: No module named 'azure.cognitiveservices.speech'`

### Pitfall 2: Stale Config After Admin UI Changes
**What goes wrong:** Playwright tests configure Azure services via admin UI, but the backend Settings singleton (LRU-cached) doesn't reflect the new config until `register_adapter_from_config` is called.
**Why it happens:** `get_settings()` uses `@lru_cache` -- environment variables are read once at startup. Dynamic config goes through the database and adapter registry, not Settings.
**How to avoid:** E2E tests should configure services via the admin UI (PUT endpoint), which triggers `register_adapter_from_config`. Do not rely on `.env` changes during E2E tests.
**Warning signs:** "Connection test succeeds but coaching session still uses mock adapter."

### Pitfall 3: Azure Speech SDK Blocks Event Loop
**What goes wrong:** STT/TTS integration tests hang or timeout because the Azure Speech SDK is synchronous.
**Why it happens:** The SDK uses gRPC internally and blocks. The adapters wrap calls in `asyncio.to_thread()`, but if tests call SDK directly (not through adapters), they'll block.
**How to avoid:** Always test through the adapter methods (`transcribe()`, `synthesize()`), which handle the thread offloading.
**Warning signs:** Test hangs indefinitely or hits the 60s timeout.

### Pitfall 4: Voice Live API Region Restrictions
**What goes wrong:** Voice Live tests fail with authentication or 404 errors.
**Why it happens:** Azure Voice Live API is only available in `eastus2` and `swedencentral` (hardcoded in `SUPPORTED_REGIONS`). Using a different region silently fails.
**How to avoid:** Integration test conftest.py should validate that the configured region is in SUPPORTED_REGIONS before running Voice Live tests.
**Warning signs:** HTTP 404 or "Unsupported region" errors.

### Pitfall 5: Playwright Timeout on Voice/Avatar Rendering
**What goes wrong:** E2E tests for voice and avatar mode timeout because WebRTC/WebSocket connections take time to establish.
**Why it happens:** Default Playwright timeout is 30s. Avatar rendering involves WebRTC negotiation, ICE candidates, and media streams which can take 10-15s.
**How to avoid:** Use extended timeouts (60-90s) for voice/avatar E2E tests. Use `page.waitForSelector` with generous timeouts for connection status indicators.
**Warning signs:** `TimeoutError: waiting for selector` on avatar or voice connection elements.

### Pitfall 6: Concurrent Test Interference with Adapter Registry
**What goes wrong:** Integration tests that register real Azure adapters interfere with unit tests that expect mock adapters.
**Why it happens:** `ServiceRegistry` is a singleton -- registering an adapter in one test affects all subsequent tests.
**How to avoid:** Integration tests are in a separate directory (`tests/integration/`) and run with a separate pytest invocation. The marker system ensures they don't run with `pytest` alone.
**Warning signs:** Existing unit tests start failing with real API errors after running integration tests.

## Code Examples

### Integration Test: Azure OpenAI Streaming
```python
# backend/tests/integration/test_azure_openai_integration.py
import os
import time

import pytest

from app.services.agents.adapters.azure_openai import AzureOpenAIAdapter
from app.services.agents.base import CoachEventType, CoachRequest

pytestmark = [pytest.mark.integration]

skip_no_credentials = pytest.mark.skipif(
    not all(os.environ.get(k) for k in [
        "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT"
    ]),
    reason="Azure OpenAI credentials not configured",
)


@skip_no_credentials
async def test_streaming_response():
    """Real Azure OpenAI returns streaming TEXT events followed by DONE."""
    adapter = AzureOpenAIAdapter(
        endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        deployment=os.environ["AZURE_OPENAI_DEPLOYMENT"],
    )
    assert await adapter.is_available()

    request = CoachRequest(
        session_id="integration-test",
        message="Hello, I am a medical representative.",
        scenario_context="You are Dr. Wang, a cardiologist. Respond in 2-3 sentences.",
    )

    events = []
    async for event in adapter.execute(request):
        events.append(event)

    text_events = [e for e in events if e.type == CoachEventType.TEXT]
    assert len(text_events) > 0, "Should receive at least one TEXT event"
    assert events[-1].type == CoachEventType.DONE

    full_text = "".join(e.content for e in text_events)
    assert len(full_text) > 10, f"Response too short: {full_text}"
```

### Integration Test: Azure Speech STT + TTS Round-Trip
```python
# backend/tests/integration/test_azure_speech_integration.py
import os
import pytest

from app.services.agents.stt.azure import AzureSTTAdapter
from app.services.agents.tts.azure import AzureTTSAdapter

pytestmark = [pytest.mark.integration]

skip_no_credentials = pytest.mark.skipif(
    not all(os.environ.get(k) for k in ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"]),
    reason="Azure Speech credentials not configured",
)

skip_no_sdk = pytest.mark.skipif(
    not _speech_sdk_available(),
    reason="azure-cognitiveservices-speech package not installed",
)


@skip_no_credentials
@skip_no_sdk
async def test_tts_then_stt_round_trip():
    """Synthesize speech with TTS, then transcribe with STT. Text should be similar."""
    key = os.environ["AZURE_SPEECH_KEY"]
    region = os.environ["AZURE_SPEECH_REGION"]

    tts = AzureTTSAdapter(key, region)
    stt = AzureSTTAdapter(key, region)

    original_text = "Hello, I would like to discuss treatment options."
    audio_bytes = await tts.synthesize(original_text, language="en-US")
    assert len(audio_bytes) > 1000, "TTS should produce substantial audio data"

    transcribed = await stt.transcribe(audio_bytes, language="en-US")
    assert len(transcribed) > 0, "STT should produce non-empty transcription"
    # Fuzzy match: key words should appear
    assert "treatment" in transcribed.lower() or "discuss" in transcribed.lower()
```

### Playwright E2E: Admin Config + Text Session Demo Flow
```typescript
// frontend/e2e/demo-flow.spec.ts (pattern sketch)
test.describe("Full Demo Pipeline", () => {
  test.use({ storageState: join(authDir, "admin.json") });
  test.setTimeout(120_000); // 2 minute timeout for full flow

  test("admin configures Azure OpenAI and tests connection", async ({ page }) => {
    await page.goto("/admin/azure-config");
    // Expand Azure OpenAI card
    await page.getByText("Azure OpenAI", { exact: true }).click();
    await page.waitForTimeout(300);
    // Test connection button
    await page.getByRole("button", { name: /test connection/i }).first().click();
    // Wait for result
    await expect(page.locator("[data-sonner-toaster]")).toBeVisible({ timeout: 15000 });
  });
});
```

### Smoke Test Checklist Pattern
```markdown
## Pre-Demo Smoke Test Checklist

### Azure Service Health
- [ ] Azure OpenAI: admin config page -> Test Connection -> green checkmark
- [ ] Azure Speech STT: admin config page -> Test Connection -> green checkmark
- [ ] Azure Speech TTS: admin config page -> Test Connection -> green checkmark
- [ ] Azure Voice Live: admin config page -> Test Connection -> green checkmark

### Text Mode Demo
- [ ] Select scenario, start text session
- [ ] Send 3+ messages, verify AI responds in character (< 3s latency)
- [ ] End session, verify scoring report renders with all dimensions

### Voice Mode Demo
- [ ] Start voice session, verify connection status shows "connected"
- [ ] Speak into mic, verify transcript appears
- [ ] Verify AI response is spoken back
- [ ] End session, verify scoring works

### Avatar Mode Demo
- [ ] Start avatar session, verify avatar renders (no freeze/glitch)
- [ ] Verify lip-sync matches speech output
- [ ] Verify avatar fallback to voice-only if avatar service unavailable
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All tests use mocks | Integration tests use real Azure APIs | Phase 9 | Validates real-world behavior |
| Manual Azure config validation | Automated connection testing per service | Phase 7 | Faster pre-demo verification |
| No performance assertions | Latency thresholds in test assertions | Phase 9 | Catches regressions before demo |

**Deprecated/outdated:**
- None. All existing patterns are current and should be preserved.

## Open Questions

1. **Audio format compatibility for STT integration test**
   - What we know: Azure Speech STT expects specific audio formats (WAV PCM 16kHz). TTS output format may not match STT input format directly.
   - What's unclear: Whether the TTS output from `synthesize()` can be fed directly to `transcribe()` without format conversion.
   - Recommendation: Test the round-trip first. If format mismatch occurs, the TTS adapter may need an explicit output format parameter, or the integration test should use a known WAV file.

2. **Avatar rendering validation in automated tests**
   - What we know: D-12 requires avatar lip-sync validation. Avatar uses WebRTC which Playwright can observe (DOM elements, connection state) but cannot easily verify visual quality.
   - What's unclear: How to programmatically verify "lip-sync matches speech" and "no freezing."
   - Recommendation: E2E tests verify avatar DOM elements appear and connection state is "connected." Visual quality validation (D-12) is inherently manual -- include in smoke test checklist.

3. **Fallback chain test reliability**
   - What we know: D-13 requires testing avatar -> voice -> text fallback. The fallback logic is in the frontend components.
   - What's unclear: How to reliably trigger fallback in E2E tests (would need to temporarily break avatar config, then voice config).
   - Recommendation: Use the admin UI to disable services one at a time and verify the fallback behavior in the user session.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | Backend tests | Yes | 3.11.9 | -- |
| Node.js 20+ | Playwright E2E | Yes | 23.11.0 | -- |
| pytest | Integration tests | Yes | 8.3.3 | -- |
| Playwright | E2E tests | Yes | 1.58.2 | -- |
| openai SDK | Azure OpenAI tests | Yes | 1.50.0+ (in pyproject.toml) | -- |
| azure-cognitiveservices-speech | STT/TTS tests | Conditional | Requires `pip install -e ".[voice]"` | Skip speech tests if not installed |
| Azure OpenAI credentials | D-03, D-08 | User-provided | -- | Skip tests with marker |
| Azure Speech credentials | D-03, D-08 | User-provided | -- | Skip tests with marker |
| Azure Voice Live credentials | D-03, D-08 | User-provided | -- | Skip tests with marker |

**Missing dependencies with no fallback:**
- None (all are available or have skip markers)

**Missing dependencies with fallback:**
- `azure-cognitiveservices-speech`: Optional install (`pip install -e ".[voice]"`). Speech integration tests skip if not installed.
- Azure credentials: All integration tests skip gracefully when credentials are not in environment.

## Project Constraints (from CLAUDE.md)

The following directives from CLAUDE.md apply to this phase:

1. **Async everywhere**: All backend test code must use `async def` with `await`
2. **pytest-asyncio with asyncio_mode = "auto"**: No need for explicit `@pytest.mark.asyncio`
3. **Ruff lint/format**: All new test files must pass `ruff check .` and `ruff format --check .`
4. **Double quotes**: Ruff format enforces double quotes in Python
5. **Line length 100**: All Python code must stay within 100 character lines
6. **TypeScript strict mode**: E2E test TypeScript must pass `npx tsc -b`
7. **No raw SQL**: Tests must use SQLAlchemy ORM (relevant if integration tests interact with DB)
8. **Conventional commits**: Commits should use `test:` prefix
9. **Pre-commit checklist**: `ruff check .`, `ruff format --check .`, `pytest -v` must pass
10. **Service layer holds business logic**: Integration tests should test through adapter/service methods, not bypass them
11. **Existing patterns**: Follow the mock test patterns established in `test_azure_openai_adapter.py` and `test_stt_tts_adapters.py` for structure
12. **E2E config**: Playwright needs `--config=e2e/playwright.config.ts` flag (Gotcha #5)

## Sources

### Primary (HIGH confidence)
- `backend/tests/conftest.py` -- Existing test fixture patterns, verified by reading source
- `backend/tests/test_azure_openai_adapter.py` -- Existing Azure OpenAI mock test patterns
- `backend/tests/test_stt_tts_adapters.py` -- Existing STT/TTS mock test patterns
- `backend/tests/test_voice_live.py` -- Existing Voice Live test patterns
- `backend/app/services/agents/adapters/azure_openai.py` -- Azure OpenAI adapter implementation
- `backend/app/services/agents/stt/azure.py` -- Azure STT adapter implementation
- `backend/app/services/agents/tts/azure.py` -- Azure TTS adapter implementation
- `backend/app/services/agents/avatar/azure.py` -- Azure Avatar adapter (stub)
- `backend/app/services/connection_tester.py` -- Connection testing patterns for all Azure services
- `backend/app/services/voice_live_service.py` -- Voice Live service with SUPPORTED_REGIONS
- `backend/app/api/azure_config.py` -- Admin config API with dynamic adapter registration
- `frontend/e2e/playwright.config.ts` -- Playwright config with webServer setup
- `frontend/e2e/auth.setup.ts` -- Authentication setup patterns (user + admin)
- `frontend/e2e/coaching-session.spec.ts` -- Coaching session E2E test patterns
- `frontend/e2e/admin-azure-config.spec.ts` -- Admin Azure config E2E test patterns
- `backend/pyproject.toml` -- pytest config, dependency groups including `[voice]` optional

### Secondary (MEDIUM confidence)
- `backend/.env.example` -- All required environment variables documented
- `backend/app/config.py` -- Settings class with all config fields and defaults

### Tertiary (LOW confidence)
- None. All findings are based on direct codebase analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All tools already installed and configured in the project
- Architecture: HIGH -- Test patterns directly follow existing codebase conventions
- Pitfalls: HIGH -- Identified from actual adapter code (conditional imports, asyncio.to_thread, SUPPORTED_REGIONS)
- Performance: MEDIUM -- 3s threshold from D-11 is clear; actual Azure latency depends on region and load

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- testing patterns don't change rapidly)

</details>

## UI Specification

<details><summary>Click to expand UI spec</summary>

# Phase 09 -- UI Design Contract

> Visual and interaction contract for Phase 09: Integration Testing with Real Azure Services. This phase creates NO new UI components, pages, or visual changes. It validates that the existing UI (built in Phases 01-08) works correctly with real Azure services end-to-end. The contract below documents the inherited design system state and defines the visual acceptance criteria that Playwright E2E tests and manual smoke tests must verify against. Generated by gsd-ui-researcher.

---

## Phase Scope: Testing Only

Phase 09 is fundamentally different from prior phases. Per CONTEXT.md:

- **In scope:** Pytest integration tests, Playwright E2E demo-flow tests, manual smoke test checklist, performance validation, fallback chain verification, UI polish verification
- **Out of scope:** New features, new UI pages, new components, CI/CD integration of Azure tests
- **New files created:** Test modules (`.py`, `.spec.ts`) and a markdown checklist (`SMOKE_TEST_CHECKLIST.md`). Zero frontend application code.

The UI-SPEC below therefore serves as the **visual acceptance reference** for test assertions rather than a build contract.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | manual shadcn/ui adaptation (no `components.json`) -- inherited from Phase 01, unchanged |
| Preset | not applicable -- components adapted from local Figma Make exports |
| Component library | Radix UI primitives via shadcn/ui wrappers -- 22 base components in `frontend/src/components/ui/` |
| Icon library | lucide-react ^0.460.0 |
| Font | Inter (EN) + Noto Sans SC (CN), loaded via Google Fonts |

**Source:** Phase 01 UI-SPEC; Phase 08 UI-SPEC. No changes for Phase 09.

---

## Spacing Scale

Inherited from Phase 01. No modifications. Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing |
| md | 16px | Default element spacing |
| lg | 24px | Section padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing, session headers |

Exceptions: none new. Phase 08 exceptions (avatar area 280px, waveform 120px, mic button 56px, etc.) remain in effect.

**E2E test relevance:** Playwright tests should NOT assert pixel-level spacing. Layout structure assertions (element visibility, ordering, containment) are sufficient.

---

## Typography

Inherited from Phase 01. No modifications.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px (1rem) | 400 (normal) | 1.5 |
| Label | 16px (1rem) | 500 (medium) | 1.5 |
| Heading (h3) | 18px (1.125rem) | 500 (medium) | 1.5 |
| Display (h1) | 24px (1.5rem) | 500 (medium) | 1.5 |

Font stack: `'Inter', 'Noto Sans SC', sans-serif`

**E2E test relevance:** Playwright tests verify text content presence and i18n key rendering. Typography values are not directly asserted in E2E tests.

---

## Color

Inherited from Phase 01 + Phase 08 additions. No modifications.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#FFFFFF` | Background, surfaces |
| Secondary (30%) | `#F8FAFC` / `#ECECF0` | Cards, sidebar, nav, panels |
| Accent (10%) | `#1E40AF` | Primary CTA buttons, active mode indicator, connect button |
| Destructive | `#EF4444` | End session button, disconnect, error states |

Accent reserved for: primary CTA buttons, active navigation items, active mode selector pill, mic button idle state, waveform bars, connection success dot, chart primary series.

### E2E Test Color Verification

Playwright E2E tests should verify semantic states through CSS classes or `data-*` attributes, not hex color values. Specifically:

| Visual State | How E2E Tests Should Verify |
|--------------|----------------------------|
| Connection status: connected | Check for green dot element visibility + "Connected" text |
| Connection status: error | Check for red dot element visibility + error text |
| Mode selector: active | Check `aria-pressed="true"` or active CSS class |
| Mic button state | Check `aria-label` text (changes per state) |
| Toast notifications | Check `[data-sonner-toaster]` visibility + toast text content |

---

## Copywriting Contract

Phase 09 creates NO new user-facing copy. All copy was defined in prior phases. The contract below documents the copy that E2E tests and smoke tests must verify is rendered correctly with real Azure services.

### Demo Flow Copy Verification (Playwright E2E)

| Element | Namespace | Key | Expected English Text |
|---------|-----------|-----|-----------------------|
| Admin config: Azure OpenAI card | admin | `admin.azureOpenai.name` | Azure OpenAI |
| Admin config: test connection success | common | (toast text) | Connection successful |
| Admin config: Voice Live region warning | admin | `admin.voiceLive.regionWarning` | Voice Live API is only available in East US 2 and Sweden Central regions. |
| Scenario selection: start button | coach | `coach.startSession` | Start Session |
| Text session: chat input placeholder | training | (placeholder text) | Type your message... |
| Voice session: connection status | voice | `voice.status.connected` | Connected |
| Voice session: end session dialog title | voice | `voice.endSessionTitle` | End Voice Session |
| Scoring report: heading | scoring | (heading text) | Scoring Report |

### Error State Copy Verification (Smoke Test)

| Scenario | Expected Copy | Verified By |
|----------|---------------|-------------|
| Azure OpenAI not configured | Mock adapter active; coaching works with mock responses | Manual: observe response quality difference |
| Avatar unavailable, voice available | "Avatar connection failed. Switching to voice-only mode." toast | Manual: disable avatar config, start avatar session |
| Voice unavailable, text available | "Voice connection failed. Switching to text mode." toast | Manual: disable voice config, start voice session |
| Wrong region configured | "Voice Live API is not available in the configured region..." warning | Manual: set non-supported region in admin config |

### Destructive Action Copy (Unchanged)

| Action | Confirmation | Copy |
|--------|-------------|------|
| End Session (all modes) | Dialog | "Are you sure you want to end this [text/voice] coaching session?" |

**Source:** Phase 02 UI-SPEC (coach copy), Phase 08 UI-SPEC (voice copy). No new copy for Phase 09.

---

## Visual Acceptance Criteria for E2E Tests

These are the visual/interaction contracts that Playwright E2E tests (D-09) and manual smoke tests (D-10) must verify.

### Full Demo Pipeline Flow (D-02)

```
Step 1: Admin Login
  - Verify: Login form renders, admin credentials accepted, redirect to admin dashboard

Step 2: Admin Configures Azure OpenAI
  - Verify: Azure Config page loads, Azure OpenAI card expandable
  - Verify: Endpoint/key/deployment fields accept input
  - Verify: "Test Connection" button triggers real connection test
  - Verify: Success toast appears within 15 seconds

Step 3: Admin Configures Azure Speech (optional)
  - Verify: STT and TTS cards expandable
  - Verify: Key/region fields accept input
  - Verify: Test Connection succeeds

Step 4: User Login + Scenario Selection
  - Verify: Switch to user login, dashboard renders
  - Verify: Scenario selection page shows available scenarios
  - Verify: Mode selector shows text (always), voice (if configured), avatar (if configured)

Step 5: Text Coaching Session
  - Verify: Session starts, chat area renders
  - Verify: User sends message, AI responds (real Azure OpenAI, not mock)
  - Verify: Response appears within 3 seconds (D-11)
  - Verify: Key message checklist updates in hints panel
  - Verify: End session -> scoring report renders with all dimensions

Step 6: Voice Coaching Session (if Voice Live configured)
  - Verify: Connection status transitions: connecting -> connected
  - Verify: Mic button appears and is interactive
  - Verify: Transcript area shows real-time transcription
  - Verify: End session -> scoring report renders (same quality as text)

Step 7: Fallback Chain (D-13)
  - Verify: With avatar disabled, voice session shows waveform (not avatar video)
  - Verify: With voice disabled, session falls back to text-only with ChatInput
```

### Performance Thresholds (D-11)

| Metric | Threshold | How Measured |
|--------|-----------|-------------|
| First AI text response token | < 3 seconds | Pytest integration test: `time.perf_counter()` around adapter.execute() |
| Total AI text response | < 15 seconds | Pytest integration test: total stream duration |
| Speech STT transcription | < 5 seconds | Pytest integration test: round-trip TTS -> STT |
| Admin config test connection | < 15 seconds | Playwright: wait for toast with timeout |

### Scoring Report Verification (D-14)

E2E tests must verify that scoring reports render identically for text, voice, and avatar sessions:

| Element | Present in Report |
|---------|-------------------|
| Overall score (numeric) | Yes -- visible heading with score value |
| Per-dimension scores | Yes -- radar chart or dimension cards |
| Strengths section | Yes -- green-highlighted text blocks |
| Weaknesses section | Yes -- orange-highlighted text blocks |
| Improvement suggestions | Yes -- purple-highlighted text blocks |
| Conversation quotes | Yes -- quoted excerpts from transcript |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (manual adaptation) | No new blocks in Phase 09 | not required |
| Third-party registries | none | not applicable |

Phase 09 adds zero new UI dependencies. All test infrastructure uses existing project dependencies (pytest, Playwright, httpx).

---

## Component Inventory (Phase 09)

### New Components

None. Phase 09 creates no new frontend components.

### Modified Components

None. Phase 09 modifies no existing frontend components.

### Components Under Test (Reference)

The following existing components are exercised by E2E tests but are NOT modified:

| Component | E2E Coverage |
|-----------|-------------|
| Admin Azure Config page (`pages/admin/azure-config.tsx`) | Config entry, test connection, save |
| Scenario Selection page | Browse scenarios, select mode, start session |
| F2F Training Session page (`pages/user/training-session.tsx`) | Text coaching full flow |
| Voice Session page (`pages/user/voice-session.tsx`) | Voice coaching full flow |
| Scoring Report section | Post-session report rendering |
| Login page | Auth flow for admin and user |

---

## i18n Contract

No new i18n namespaces or keys. All existing namespaces are verified by E2E tests:

| Namespace | Status | E2E Coverage |
|-----------|--------|-------------|
| `auth` | Unchanged | Login flow |
| `admin` | Unchanged | Azure Config page |
| `coach` | Unchanged | Session flow |
| `voice` | Unchanged | Voice session flow |
| `scoring` | Unchanged | Scoring report |
| `common` | Unchanged | Shared UI elements |

---

## Smoke Test Checklist Contract (D-10)

The smoke test checklist document (`docs/SMOKE_TEST_CHECKLIST.md`) must cover these categories with checkbox format:

| Category | Items |
|----------|-------|
| Azure Service Health | Test Connection for each configured Azure service (OpenAI, Speech STT, Speech TTS, Voice Live, Avatar) |
| Text Mode Demo | Start session, send 3+ messages, verify AI responds in character, verify < 3s latency, end session, verify scoring report |
| Voice Mode Demo | Start session, verify connection, speak into mic, verify transcript, verify AI spoken response, end session, verify scoring |
| Avatar Mode Demo | Start session, verify avatar renders, verify lip-sync (manual visual), verify fallback if avatar unavailable |
| Fallback Chain | Disable avatar -> verify voice-only fallback, disable voice -> verify text-only fallback |
| Scoring Parity | Compare scoring report quality across text, voice, and avatar sessions |
| Performance | Response latency feels conversational (< 3s), avatar renders without glitches, transitions are smooth |

**Source:** CONTEXT.md D-10, D-11, D-12, D-13, D-14.

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

## Verification

<details><summary>Click to expand verification report</summary>

# Phase 09: Integration Testing with Real Azure Services Verification Report

**Phase Goal:** Implement unified AI Foundry config (replacing 8 separate ServiceConfig rows), expand to 7 interaction modes, wire agent mode runtime end-to-end, redesign admin UI with single AI Foundry card, then validate all Azure service integrations with real credentials and polish demo experience for BeiGene customer presentations
**Verified:** 2026-03-28T14:21:55Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin configures a single AI Foundry endpoint/region/API key -- all 7 services derive from this unified config | VERIFIED | ServiceConfig.is_master flag exists. config_service.get_master_config/get_effective_key/get_effective_endpoint implement master-fallback pattern. API has GET/PUT /azure-config/ai-foundry. Lifespan loads master config first (main.py lines 79-110). Admin page uses useAIFoundryConfig/useUpdateAIFoundry hooks with endpoint/region/apiKey form fields. connection_tester accepts master_endpoint/master_key/master_region params. |
| 2 | Platform supports all 7 interaction modes | VERIFIED | Backend SessionCreate.mode is Literal with all 7 values. Frontend SessionMode type has all 7 values. mode-selector.tsx has MODE_MAP covering all 7 modes. Session model column widened to String(40). |
| 3 | Agent mode works end-to-end: token broker returns agent_id/project_name, frontend connects via voice-agent/realtime WebSocket | PARTIAL | Backend: voice_live_service.py parses mode via parse_voice_live_mode, returns agent_id/project_name in VoiceLiveTokenResponse (lines 51-65). Frontend: use-voice-live.ts constructs voice-agent/realtime WebSocket URL when agent_id is present (line 102-104). GAP: training.tsx line 70 hardcodes agentAvailable=false, making agent mode unreachable from the UI mode selector. |
| 4 | Two-level mode selector UI: communication type first, then engine | VERIFIED | mode-selector.tsx implements Level 1 (text/voice/digital_human) and Level 2 (pipeline/realtime_model/realtime_agent) with MODE_MAP. Props include pipelineAvailable and agentAvailable. data-testid="engine-{engine}" for E2E testing. training.tsx passes pipelineAvailable and agentAvailable to ModeSelector. |
| 5 | Integration tests validate each Azure service with real credentials | VERIFIED | 4 test modules with 18 total tests: OpenAI (6 tests incl. first-token latency < 3s), Speech (5 tests incl. TTS->STT round-trip), Voice Live (4 tests incl. region validation), Avatar (3 tests incl. ICE token retrieval). All use pytestmark=[pytest.mark.integration]. pyproject.toml addopts="-m 'not integration'" auto-deselects. Confirmed: 921 passed, 14 skipped, 18 deselected. |
| 6 | E2E demo flow works: Login -> Admin config -> Text session -> Voice/Avatar session -> Score report | VERIFIED | demo-flow.spec.ts has 4 test cases with 120s timeout, admin/user auth via storageState, screenshot capture. SMOKE_TEST_CHECKLIST.md has 84 checkbox items across 8 sections covering all demo stages. |

**Score:** 5/6 truths verified (1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/service_config.py` | is_master field | VERIFIED | Line 20: `is_master: Mapped[bool] = mapped_column(Boolean, default=False)` |
| `backend/app/schemas/session.py` | 7-mode Literal | VERIFIED | Lines 15-20: all 7 mode values present |
| `backend/app/schemas/voice_live.py` | agent_id/project_name | VERIFIED | Lines 16-17: `agent_id: str | None = None`, `project_name: str | None = None` |
| `backend/app/schemas/azure_config.py` | AIFoundryConfigUpdate | VERIFIED | Line 17: `class AIFoundryConfigUpdate(BaseModel)` |
| `backend/app/services/config_service.py` | Master config functions | VERIFIED | get_master_config (line 53), upsert_master_config (line 61), get_effective_key (line 148), get_effective_endpoint (line 163) |
| `backend/app/services/voice_live_service.py` | Token broker with agent fields | VERIFIED | parse_voice_live_mode (line 51), agent_id in response (line 64) |
| `backend/app/api/azure_config.py` | AI Foundry endpoints | VERIFIED | GET /ai-foundry (line 126), PUT /ai-foundry (line 160) |
| `backend/alembic/versions/f09a_unified_ai_foundry_config.py` | Migration | VERIFIED | File exists |
| `backend/app/main.py` | Lifespan loads master config | VERIFIED | Lines 79-110: loads master config first, passes master_endpoint/master_key/master_region to per-service registration |
| `frontend/src/types/voice-live.ts` | 7-mode SessionMode | VERIFIED | Lines 7-8: voice_realtime_agent, digital_human_realtime_agent present |
| `frontend/src/types/azure-config.ts` | AIFoundryConfig type | VERIFIED | Lines 20, 28: AIFoundryConfig and AIFoundryConfigUpdate interfaces |
| `frontend/src/api/azure-config.ts` | API client functions | VERIFIED | getAIFoundryConfig (line 47), updateAIFoundryConfig (line 54) |
| `frontend/src/hooks/use-azure-config.ts` | TanStack Query hooks | VERIFIED | useAIFoundryConfig (line 43), useUpdateAIFoundry (line 50) |
| `frontend/src/pages/admin/azure-config.tsx` | AI Foundry master card | VERIFIED | Uses useAIFoundryConfig/useUpdateAIFoundry, renders AI Foundry card with endpoint/region/apiKey fields, per-service toggles below |
| `frontend/src/components/voice/mode-selector.tsx` | Two-level selector | VERIFIED | Imports SessionMode, has MODE_MAP for 7 modes, pipelineAvailable/agentAvailable props, data-testid="engine-{engine}" |
| `frontend/src/hooks/use-voice-live.ts` | Agent WebSocket path | VERIFIED | voice-agent/realtime (line 104), openai/realtime (line 111), agent_id check (line 102) |
| `backend/tests/integration/conftest.py` | Skip markers | VERIFIED | 4 credential helpers, 4 skip markers, marker registration |
| `backend/tests/integration/test_azure_openai_integration.py` | OpenAI tests | VERIFIED | 6 tests incl. first_token_time < 3.0 assertion |
| `backend/tests/integration/test_azure_speech_integration.py` | Speech tests | VERIFIED | 5 tests incl. TTS->STT round-trip |
| `backend/tests/integration/test_voice_live_integration.py` | Voice Live tests | VERIFIED | 4 tests with region validation and endpoint reachability |
| `backend/tests/integration/test_avatar_integration.py` | Avatar tests | VERIFIED | 3 tests with ICE relay token retrieval |
| `frontend/e2e/demo-flow.spec.ts` | Demo E2E test | VERIFIED | 4 test cases, 120s timeout, admin+user auth, screenshots |
| `docs/SMOKE_TEST_CHECKLIST.md` | Smoke test checklist | VERIFIED | 84 checkbox items, 8 sections, quick recovery table |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| voice_live_service.py | config_service.py | get_master_config | WIRED | Line 41: `master = await config_service.get_master_config(db)` |
| azure_config.py API | config_service.py | register_adapter_from_config | WIRED | Lines 182, 257: called with master fallback params |
| main.py lifespan | ServiceConfig model | is_master query | WIRED | Lines 83-84: queries ServiceConfig.is_master == True |
| azure-config.tsx | use-azure-config.ts | useAIFoundryConfig/useUpdateAIFoundry | WIRED | Lines 113, 116: hooks called and data used for form state |
| mode-selector.tsx | types/voice-live.ts | SessionMode import | WIRED | Line 6: `import type { SessionMode } from "@/types/voice-live"` |
| use-voice-live.ts | types/voice-live.ts | agent_id/voice-agent | WIRED | Lines 102-111: conditional WebSocket URL based on agent_id |
| demo-flow.spec.ts | auth.setup.ts | storageState admin.json | WIRED | Lines 77, 139, 239, 293: storageState references |
| demo-flow.spec.ts | azure-config page | Navigation | WIRED | Line 35: goto("/admin/azure-config") |
| connection_tester.py | master config | master_endpoint/master_key/master_region params | WIRED | Lines 189-191: params accepted, lines 199-218: used as fallback |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| azure-config.tsx | aiFoundryData | useAIFoundryConfig -> GET /azure-config/ai-foundry | Yes (DB query via get_master_config) | FLOWING |
| mode-selector.tsx | value (SessionMode) | props from training.tsx | Yes (derived from user selection) | FLOWING |
| use-voice-live.ts | tokenData | /api/v1/voice-live/token broker | Yes (DB query + parse_voice_live_mode) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| ServiceConfig has is_master | python3 -c "from app.models.service_config import ServiceConfig; assert hasattr(ServiceConfig, 'is_master')" | OK | PASS |
| 7-mode schema accepts voice_realtime_agent | python3 -c "from app.schemas.session import SessionCreate; s = SessionCreate(scenario_id='x', mode='voice_realtime_agent')" | OK | PASS |
| VoiceLiveTokenResponse has agent_id | python3 -c "from app.schemas.voice_live import VoiceLiveTokenResponse; r = VoiceLiveTokenResponse(..., agent_id='a1', project_name='p1'); assert r.agent_id == 'a1'" | OK | PASS |
| Master config functions importable | python3 -c "from app.services.config_service import get_master_config, upsert_master_config, get_effective_key, get_effective_endpoint" | OK | PASS |
| Backend tests pass (921) with integration deselected (18) | pytest tests/ -x -q | 921 passed, 14 skipped, 18 deselected | PASS |
| Integration tests properly deselected | pytest tests/integration/ -v --collect-only | 18 items collected, all deselected | PASS |
| Frontend TypeScript compiles | npx tsc -b --noEmit | Clean (no output) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COACH-04 | 09-01, 09-03, 09-04, 09-05 | Voice input via Azure Speech STT | SATISFIED | 7-mode schema includes voice_pipeline; Speech integration tests cover STT; smoke checklist covers voice mode |
| COACH-05 | 09-01, 09-03, 09-04, 09-05 | AI HCP responses via Azure Speech TTS | SATISFIED | TTS integration tests with round-trip; voice pipeline mode in schema |
| COACH-06 | 09-01, 09-02, 09-03, 09-04, 09-05 | GPT Realtime API WebSocket | SATISFIED | voice_realtime_model and voice_realtime_agent modes; use-voice-live hook with agent/model WebSocket paths; Voice Live integration tests |
| COACH-07 | 09-01, 09-03, 09-04, 09-05 | Azure AI Avatar digital human | SATISFIED | digital_human_* modes in schema; Avatar integration tests with ICE token; smoke checklist covers avatar mode |
| PLAT-03 | 09-01, 09-02, 09-04, 09-05 | Admin configures Azure service connections from web UI | SATISFIED | AI Foundry admin card with endpoint/region/key; per-service toggles; connection testing |
| PLAT-05 | 09-01, 09-02, 09-03, 09-05 | Voice mode configurable per deployment/session | SATISFIED | 7 session modes selectable; two-level mode selector; per-service enable/disable |

No orphaned requirements found (REQUIREMENTS.md traceability table does not map any additional IDs to Phase 09 beyond what the plans claim).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| frontend/src/pages/user/training.tsx | 70 | `agentAvailable = false` hardcoded | Warning | Agent mode engine button is permanently disabled in the mode selector. Backend agent path is fully wired but unreachable from UI. |

No TODO/FIXME/PLACEHOLDER patterns found in key phase files. No empty implementations. No console.log-only handlers. All other files clean.

### Human Verification Required

### 1. AI Foundry Admin Config Visual Layout

**Test:** Login as admin, navigate to Admin > Azure Config. Verify AI Foundry master card appears at top with endpoint/region/API key fields, followed by per-service toggle list below.
**Expected:** Single prominent card for AI Foundry, simplified per-service rows with toggle switches and model name fields (no per-service endpoint/key fields).
**Why human:** Visual layout and UX quality cannot be verified programmatically.

### 2. Two-Level Mode Selector Interaction

**Test:** Login as user, select a scenario. Verify mode selector shows Level 1 (Text/Voice/Digital Human) and Level 2 (Pipeline/Realtime/Agent) when non-text mode is selected.
**Expected:** Level 2 row appears/hides based on Level 1 selection. Disabled engines show as grayed out. Text mode hides Level 2 entirely.
**Why human:** Multi-step UI interaction and visual state transitions.

### 3. End-to-End Demo with Real Azure Credentials

**Test:** Configure real Azure AI Foundry credentials via admin UI. Run through full demo: text session with AI response, voice session with realtime WebSocket, avatar session with digital human rendering, scoring report.
**Expected:** All modes produce real AI responses (not mock), voice has sub-3s latency, avatar renders with lip sync, scoring report has meaningful content.
**Why human:** Requires real Azure credentials, microphone, WebRTC-capable browser, and subjective quality assessment.

### 4. Integration Tests with Real Credentials

**Test:** Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, AZURE_VOICE_LIVE_ENDPOINT, AZURE_VOICE_LIVE_API_KEY, AZURE_VOICE_LIVE_REGION env vars. Run `pytest -m integration`.
**Expected:** All 18 integration tests pass including first-token latency < 3s, TTS->STT round-trip, ICE token retrieval.
**Why human:** Requires Azure credentials not available in automated verification environment.

### Gaps Summary

One gap was found: **agent mode UI discoverability**. The backend token broker correctly returns agent_id/project_name when voice_live is configured in agent mode. The frontend use-voice-live hook correctly constructs the voice-agent/realtime WebSocket URL when agent_id is present. However, `agentAvailable` is hardcoded to `false` in `frontend/src/pages/user/training.tsx` (line 70), which means the "Agent" engine button in the two-level mode selector is permanently disabled. Users cannot reach agent mode through the UI.

The fix is straightforward: derive agentAvailable from the VoiceLiveConfigStatus endpoint or from the voice live service response that indicates agent mode is configured. This is a single-line change with a corresponding API enhancement to expose agent availability.

All other 5 success criteria are fully verified with codebase evidence and behavioral spot-checks.

---

_Verified: 2026-03-28T14:21:55Z_
_Verifier: Claude (gsd-verifier)_

</details>

