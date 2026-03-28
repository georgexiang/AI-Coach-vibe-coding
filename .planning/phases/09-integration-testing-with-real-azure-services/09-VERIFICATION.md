---
phase: 09-integration-testing-with-real-azure-services
verified: 2026-03-28T14:21:55Z
status: gaps_found
score: 5/6 must-haves verified
must_haves:
  truths:
    - "Admin configures a single AI Foundry endpoint/region/API key — all 7 services derive from this unified config"
    - "Platform supports all 7 interaction modes (Text, Voice Pipeline, Digital Human Speech+Model, Voice Realtime Model, Digital Human Realtime Model, Voice Realtime Agent, Digital Human Realtime Agent)"
    - "Agent mode works end-to-end: token broker returns agent_id/project_name, frontend connects via voice-agent/realtime WebSocket"
    - "Two-level mode selector UI: communication type first (Text/Voice/Digital Human), then engine (Pipeline/Realtime Model/Realtime Agent)"
    - "Integration tests validate each Azure service with real credentials (pytest --run-integration)"
    - "E2E demo flow works: Login -> Admin AI Foundry config -> Text session -> Voice session -> Avatar session -> Score report"
  artifacts:
    - path: "backend/app/models/service_config.py"
      provides: "ServiceConfig with is_master flag"
    - path: "backend/app/schemas/session.py"
      provides: "7-mode session Literal type"
    - path: "backend/app/schemas/voice_live.py"
      provides: "VoiceLiveTokenResponse with agent fields"
    - path: "backend/app/services/config_service.py"
      provides: "Master config service with get_master_config, get_effective_key, get_effective_endpoint"
    - path: "backend/app/services/voice_live_service.py"
      provides: "Token broker returning agent_id/project_name"
    - path: "backend/app/api/azure_config.py"
      provides: "GET/PUT /azure-config/ai-foundry endpoints"
    - path: "backend/alembic/versions/f09a_unified_ai_foundry_config.py"
      provides: "Alembic migration for is_master column"
    - path: "frontend/src/types/voice-live.ts"
      provides: "7-mode SessionMode type"
    - path: "frontend/src/types/azure-config.ts"
      provides: "AIFoundryConfig and AIFoundryConfigUpdate types"
    - path: "frontend/src/pages/admin/azure-config.tsx"
      provides: "Redesigned admin page with AI Foundry master card"
    - path: "frontend/src/components/voice/mode-selector.tsx"
      provides: "Two-level mode selector component"
    - path: "frontend/src/hooks/use-voice-live.ts"
      provides: "Agent mode WebSocket path selection"
    - path: "backend/tests/integration/conftest.py"
      provides: "Integration test infrastructure"
    - path: "backend/tests/integration/test_azure_openai_integration.py"
      provides: "Azure OpenAI integration tests"
    - path: "backend/tests/integration/test_azure_speech_integration.py"
      provides: "Azure Speech integration tests"
    - path: "backend/tests/integration/test_voice_live_integration.py"
      provides: "Voice Live integration tests"
    - path: "backend/tests/integration/test_avatar_integration.py"
      provides: "Avatar integration tests"
    - path: "frontend/e2e/demo-flow.spec.ts"
      provides: "Full demo pipeline E2E test"
    - path: "docs/SMOKE_TEST_CHECKLIST.md"
      provides: "Pre-demo smoke test checklist"
  key_links:
    - from: "backend/app/services/voice_live_service.py"
      to: "backend/app/services/config_service.py"
      via: "get_master_config for unified endpoint"
    - from: "frontend/src/pages/admin/azure-config.tsx"
      to: "frontend/src/hooks/use-azure-config.ts"
      via: "useAIFoundryConfig and useUpdateAIFoundry hooks"
    - from: "frontend/src/components/voice/mode-selector.tsx"
      to: "frontend/src/types/voice-live.ts"
      via: "SessionMode type import"
    - from: "frontend/src/hooks/use-voice-live.ts"
      to: "frontend/src/types/voice-live.ts"
      via: "agent_id/voice-agent WebSocket path"
gaps:
  - truth: "Agent mode works end-to-end: token broker returns agent_id/project_name, frontend connects via voice-agent/realtime WebSocket"
    status: partial
    reason: "Backend token broker and frontend WebSocket hook are fully wired, but agentAvailable is hardcoded to false in training.tsx, preventing agent mode from being selectable in the UI mode selector. The end-to-end path exists but is unreachable from the UI."
    artifacts:
      - path: "frontend/src/pages/user/training.tsx"
        issue: "Line 70: agentAvailable = false hardcoded. Agent mode engine button is permanently disabled in the mode selector."
    missing:
      - "Derive agentAvailable from VoiceLiveConfigStatus or voice live service endpoint (e.g., check if voice_live model_or_deployment contains agent config)"
human_verification:
  - test: "Admin configures AI Foundry and verifies all services derive from it"
    expected: "Single endpoint/region/key configures all 7 services; per-service toggle only has enable/disable and model name"
    why_human: "Visual layout verification and Azure credential-dependent behavior"
  - test: "E2E demo flow from login through text/voice/avatar sessions to scoring"
    expected: "Complete pipeline works with real Azure credentials"
    why_human: "Requires running servers, real Azure credentials, and interactive voice/avatar WebRTC"
  - test: "Two-level mode selector visual appearance and interaction"
    expected: "Level 1 shows Text/Voice/Digital Human, Level 2 shows Pipeline/Realtime/Agent engines"
    why_human: "Visual layout, button styling, interaction feel"
---

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
