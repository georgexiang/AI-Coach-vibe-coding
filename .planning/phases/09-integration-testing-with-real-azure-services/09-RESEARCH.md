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
