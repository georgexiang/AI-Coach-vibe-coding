# Phase 07: Azure Service Integration

> Auto-generated from [`.planning/phases/07-azure-service-integration`](../blob/main/.planning/phases/07-azure-service-integration)  
> Last synced: 2026-03-29

## Context & Decisions

# Phase 07: Azure Service Integration - Context

**Gathered:** 2026-03-27 (updated with 7-mode user-selectable design)
**Status:** Ready for replanning
**Source:** Conversation analysis + user design direction update

<domain>
## Phase Boundary

Connect the existing Admin Azure Config UI to real backend persistence and service switching for ALL 7 Azure AI service modes. The frontend pages (`azure-config.tsx`, `service-config-card.tsx`) and backend read APIs (`azure_config.py`) already exist but are disconnected — `onSave` only updates React state, `onTestConnection` is a fake `Math.random()`, and there's no PUT endpoint to persist configurations. This phase bridges those gaps and implements backend adapters/connectors for all 7 AI service modes.

**CRITICAL DESIGN PRINCIPLE:** All 7 modes are equal, user-selectable services — NOT a fallback chain. Users configure which modes to enable based on:
1. Their preference and use case
2. Whether the selected Azure region's AI Foundry supports that specific feature

**The 7 AI Service Modes:**
1. **Azure OpenAI** — GPT-4o for text coaching conversations and scoring
2. **Azure Speech (STT)** — Speech-to-text for voice input recognition
3. **Azure Speech (TTS)** — Text-to-speech for HCP voice responses
4. **Azure AI Avatar** — Digital human avatar for HCP visualization
5. **Azure Content Understanding** — Multimodal evaluation for training materials
6. **Azure OpenAI Realtime** — Real-time audio streaming for voice conversations
7. **Azure Voice Live API** — Real-time voice coaching with GPT-4o Realtime + Avatar

**In scope:**
- Backend: Configuration persistence model (DB), CRUD API for ALL 7 service configs, real connection testing
- Backend: Azure OpenAI adapter for LLM (text coaching)
- Backend: Azure Speech STT/TTS adapters (voice input/output) — already exist from Phase 06
- Backend: Azure Avatar configuration and status checking
- Backend: Azure Content Understanding adapter (document/multimodal analysis)
- Backend: Azure OpenAI Realtime adapter (real-time audio streaming)
- Backend: Azure Voice Live API adapter (voice + avatar combined)
- Backend: Region-based availability detection — check if the configured region's AI Foundry supports each service
- Backend: Dynamic adapter registration based on persisted config (register available services on startup)
- Frontend: Wire `onSave` to call backend PUT API for all 7 services
- Frontend: Wire `onTestConnection` to call backend POST /test endpoint for all 7 services
- Frontend: Show real connection status (active/inactive/error/unavailable) from backend
- Frontend: Show region availability hints — which services are available in the configured region

**Out of scope:**
- Frontend Avatar WebRTC rendering (future phase — Phase 08)
- Database for PostgreSQL UI config (deployment infrastructure, not AI service)
- New UI pages (existing `azure-config.tsx` is sufficient)

</domain>

<decisions>
## Implementation Decisions

### Core Design: User-Selectable Modes (NOT Fallback)
- All 7 modes are independently configurable — no automatic fallback chain
- Each service has its own enable/disable toggle, endpoint, API key, region
- A service being "unavailable" in a region shows informational status, NOT auto-switch to another service
- Admin explicitly chooses which services to enable for their deployment
- The system does NOT silently switch providers — if a configured service fails, it reports an error

### Configuration Persistence (already implemented in Phase 07 v1)
- Store Azure service configs in `service_config` database table (already exists)
- Config model: service_name, endpoint, api_key (encrypted), model/deployment, region, is_active, updated_by
- API keys encrypted at rest using Fernet symmetric encryption (already implemented)
- On server startup, load active configs from DB and register corresponding adapters

### API Design (partially implemented)
- `PUT /api/v1/azure-config/services/{service_name}` — Create/update service configuration (exists)
- `POST /api/v1/azure-config/services/{service_name}/test` — Real connection test (exists for some services)
- `GET /api/v1/azure-config/services` — Read from DB (exists)
- `GET /api/v1/azure-config/region-capabilities/{region}` — NEW: Check what services are available in a region
- All endpoints require admin role

### Azure OpenAI Adapter (already implemented)
- `AzureOpenAIAdapter` extends `BaseCoachingAdapter` — already exists
- Uses `openai` SDK with Azure configuration
- Streaming responses via SSE

### Azure Speech Adapters (already implemented from Phase 06)
- `AzureSpeechSTTAdapter` and `AzureSpeechTTSAdapter` — already exist
- Registered under categories "stt" and "tts"

### Azure Avatar Adapter (NEW)
- Configuration validation and status checking
- Avatar is a frontend rendering service — backend stores config and tests connectivity
- Uses Azure Speech SDK's avatar features or REST API for synthesis
- Region availability: Avatar is NOT available in all regions

### Azure Content Understanding Adapter (NEW)
- Implement `AzureContentUnderstandingAdapter`
- Uses Azure AI Content Understanding REST API
- Capabilities: document analysis, multimodal evaluation for training materials
- Region availability: Content Understanding may have limited regional availability

### Azure OpenAI Realtime Adapter (NEW)
- Implement `AzureRealtimeAdapter`
- Uses Azure OpenAI Realtime API (WebSocket-based)
- Real-time bidirectional audio streaming
- Requires gpt-4o-realtime-preview model deployment

### Azure Voice Live API Adapter (NEW)
- Implement `AzureVoiceLiveAdapter`
- Two sub-modes (both user-configurable, NOT fallback):
  - **Model mode**: Direct Azure OpenAI Realtime API, frontend controls conversation
  - **Agent mode**: Azure AI Agent Service with pre-configured HCP persona agent
- Config fields: ai_service_endpoint, ai_service_key/Azure AD token, project_name (Agent mode), agent_id (Agent mode)
- Region availability: Voice Live requires specific AI Foundry regions

### Region-Based Availability (NEW)
- Backend endpoint to check region capabilities against Azure AI Foundry
- Frontend shows availability hints per service when region is configured
- Unavailable services show "Not available in {region}" status
- Does NOT prevent saving config — admin may be preparing for future availability

### Dynamic Provider Registration
- On config save: register/update the adapter in ServiceRegistry
- On startup: load all active configs and register adapters
- No automatic fallback — if a service is configured but unavailable, report error status

### Frontend Integration (partially implemented)
- `ServiceConfigCard.onSave` → `PUT /api/v1/azure-config/services/{key}` (exists)
- `ServiceConfigCard.onTestConnection` → `POST /api/v1/azure-config/services/{key}/test` (exists)
- Display real status from `GET /services` response (exists)
- NEW: Show region availability hints for each service
- Show toast notifications on save/test success/failure (using `sonner`)

### Claude's Discretion
- Encryption key management approach (env var vs config)
- Exact error messages for connection test failures
- Retry/timeout strategy for Azure API calls
- Region capability API data source (hardcoded map vs live Azure API call)
- Azure AD token auth implementation details for Voice Live Agent mode

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — Existing Azure Config (Phase 07 v1 output)
- `backend/app/api/azure_config.py` — CRUD API for service configs (GET/PUT/POST test)
- `backend/app/api/config.py` — Feature flags and adapter listing endpoint
- `backend/app/config.py` — pydantic-settings with Azure env vars
- `backend/app/models/service_config.py` — ServiceConfig ORM model with Fernet encryption
- `backend/app/services/config_service.py` — Config CRUD + encryption orchestration
- `backend/app/utils/encryption.py` — Fernet encrypt/decrypt helpers
- `backend/app/services/connection_tester.py` — Connection testing for Azure services

### Backend — Adapter Framework
- `backend/app/services/agents/base.py` — BaseCoachingAdapter ABC, CoachRequest/CoachEvent dataclasses
- `backend/app/services/agents/adapters/mock.py` — MockCoachingAdapter (reference implementation)
- `backend/app/services/agents/adapters/azure_openai.py` — AzureOpenAIAdapter (already implemented)
- `backend/app/services/agents/registry.py` — ServiceRegistry singleton
- `backend/app/api/sessions.py` — SSE streaming endpoint (uses adapter.execute())

### Backend — Speech/Voice Adapters (Phase 06 output)
- `backend/app/services/agents/adapters/azure_stt.py` — Azure Speech STT adapter
- `backend/app/services/agents/adapters/azure_tts.py` — Azure Speech TTS adapter

### Backend — Models & DB
- `backend/app/models/base.py` — Base, TimestampMixin (all models must use)
- `backend/app/database.py` — Async engine, session factory
- `backend/alembic/` — Migration directory

### Reference Implementation
- User's `Voice-Live-Agent-With-Avadar` repo — Reference for Agent mode + Model mode Voice Live API implementation

### Frontend — Azure Config UI
- `frontend/src/pages/admin/azure-config.tsx` — Azure config page (7 service cards + DB)
- `frontend/src/components/admin/service-config-card.tsx` — Reusable config card component
- `frontend/src/types/azure-config.ts` — TypeScript interfaces for service config
- `frontend/src/api/azure-config.ts` — Typed API client for azure config endpoints
- `frontend/src/hooks/use-azure-config.ts` — TanStack Query hooks for azure config

### Frontend — API Layer
- `frontend/src/api/client.ts` — Axios instance with JWT interceptor

</canonical_refs>

<specifics>
## Specific Ideas

- The `openai` Python SDK (>=1.50.0) supports both Azure OpenAI standard and Realtime APIs
- Azure Speech SDK includes Avatar synthesis capabilities
- The reference repo (Voice-Live-Agent-With-Avadar) provides patterns for Agent mode + Model mode
- Agent mode needs: `ai_service_endpoint`, `azure_ai_project_name`, `agent_id`
- Azure AD token auth: `az account get-access-token --resource https://ai.azure.com`
- ServiceConfigCard already has status dot (green/gray/red/yellow) — extend with "unavailable in region" state
- Region capabilities can be initially hardcoded as a lookup table, with future Azure Management API integration
- Content Understanding API uses REST (not an SDK) — `POST /contentunderstanding/analyzers` pattern

</specifics>

<deferred>
## Deferred Ideas

- Azure Database for PostgreSQL configuration from UI (deployment infrastructure, not AI service)
- Avatar WebRTC rendering in frontend (Phase 08)
- Per-session provider override (always use deployment-wide config for now)
- Live Azure Management API for region capability querying (start with hardcoded map)

</deferred>

---

*Phase: 07-azure-service-integration*
*Context gathered: 2026-03-27 via conversation analysis, updated with 7-mode design direction*

## Plans (7)

| # | Plan File | Status |
|---|-----------|--------|
| 07-01 | 07-01-PLAN.md | Complete |
| 07-02 | 07-02-PLAN.md | Complete |
| 07-03 | 07-03-PLAN.md | Complete |
| 07-04 | 07-04-PLAN.md | Complete |
| 07-05 | 07-05-PLAN.md | Complete |
| 07-06 | 07-06-PLAN.md | Complete |
| 07-07 | 07-07-PLAN.md | Complete |

## Research

<details><summary>Click to expand research notes</summary>

# Phase 07: Azure Service Integration (Expanded Scope) - Research

**Researched:** 2026-03-27
**Domain:** Azure AI Services integration -- 7 independently configurable service modes
**Confidence:** MEDIUM-HIGH

## Summary

Phase 07 was previously completed with 4 plans covering Azure OpenAI LLM, config persistence (ServiceConfig model + Fernet encryption), connection testing, and frontend wiring. The expanded scope adds 4 NEW adapters/connectors (Azure Avatar real implementation, Content Understanding, OpenAI Realtime, Voice Live API) and a region-based capability detection system. The existing infrastructure (ServiceConfig DB model, encryption, CRUD API, frontend ServiceConfigCard) is solid and reusable -- the new work layers on top.

The critical architectural insight is that these 7 services have fundamentally different integration patterns: some are backend-only (OpenAI LLM, Content Understanding), some are primarily frontend (Avatar WebRTC, Realtime WebSocket), and some are hybrid (Voice Live combines backend token brokering with frontend WebSocket). The backend's role varies per service -- from full adapter (OpenAI LLM) to config-store-and-connection-tester (Avatar, Realtime). The region capability map must be a hardcoded lookup table (per user decision) since there is no single Azure API to query all service availability.

**Primary recommendation:** Extend the existing connection_tester.py and azure_config.py with real API calls for the 3 new services (Content Understanding, Realtime, Voice Live), add a region capability lookup module, and implement the missing `azure_openai_realtime` service name in SERVICE_DISPLAY_NAMES. Frontend changes are minimal -- the 7 service cards already exist, just add region availability hints.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All 7 modes are independently configurable -- NOT a fallback chain
- Each service has its own enable/disable toggle, endpoint, API key, region
- A service being "unavailable" in a region shows informational status, NOT auto-switch
- Admin explicitly chooses which services to enable
- System does NOT silently switch providers -- if a configured service fails, it reports error
- Config persistence uses existing service_config DB table with Fernet encryption
- API design: PUT/POST test/GET endpoints (partially implemented)
- NEW: GET /api/v1/azure-config/region-capabilities/{region} endpoint
- Azure OpenAI adapter already exists and is working
- Azure Speech STT/TTS adapters already exist from Phase 06
- Azure Avatar adapter is stub (is_available=False) -- needs real implementation
- Azure Content Understanding adapter is NEW
- Azure OpenAI Realtime adapter is NEW
- Azure Voice Live API adapter is NEW with Agent mode + Model mode
- Dynamic adapter registration on config save and on startup

### Claude's Discretion
- Encryption key management approach (env var vs config)
- Exact error messages for connection test failures
- Retry/timeout strategy for Azure API calls
- Region capability API data source (hardcoded map vs live Azure API call)
- Azure AD token auth implementation details for Voice Live Agent mode

### Deferred Ideas (OUT OF SCOPE)
- Azure Database for PostgreSQL configuration from UI (deployment infrastructure, not AI service)
- Avatar WebRTC rendering in frontend (Phase 08)
- Per-session provider override (always use deployment-wide config for now)
- Live Azure Management API for region capability querying (start with hardcoded map)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-03 | Admin can configure Azure service connections from web UI with connection testing | Existing CRUD API + connection_tester.py cover OpenAI/Speech/Avatar; extend for Content Understanding, Realtime, Voice Live |
| PLAT-05 | Voice interaction mode configurable per deployment and per session | Voice Live + Realtime adapter registration enables runtime mode switching |
| ARCH-05 | Azure service connections configurable per environment | ServiceConfig model + region capabilities endpoint enables per-env config |
| ARCH-01 | Pluggable adapter pattern for all AI services | ServiceRegistry already supports multi-category; add new categories for realtime, content_understanding, voice_live |
| COACH-06 | GPT Realtime API for sub-1s conversational latency as configurable premium option | Azure OpenAI Realtime adapter with connection testing |
| COACH-07 | Azure AI Avatar as configurable premium option | Avatar adapter real implementation with config validation |
</phase_requirements>

## Standard Stack

### Core (Already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | >=1.50.0 | Azure OpenAI + Realtime API client | Already installed; supports AsyncAzureOpenAI and realtime WebSocket |
| httpx | >=0.27.0 | Async HTTP client for REST API calls | Already installed; used for connection testing and Content Understanding REST calls |
| cryptography | (via python-jose) | Fernet encryption for API keys | Already available as transitive dep |
| azure-cognitiveservices-speech | latest | Azure Speech SDK (STT/TTS/Avatar) | Required for Avatar real-time synthesis via WebRTC; already used in Phase 06 |

### Supporting (No new packages needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| websockets | >=13.0 | WebSocket support | Already installed; used for Voice Live backend-to-Azure WebSocket if needed |

### New Dependencies: NONE
The expanded scope does NOT require any new Python packages. Content Understanding uses plain REST (httpx), Realtime API uses the openai SDK, and Voice Live uses httpx for connection testing (frontend handles the actual WebSocket). Avatar connection testing uses httpx REST calls.

**Installation:** No new packages needed. The existing `pyproject.toml` dependencies cover everything.

## Architecture Patterns

### Service Classification by Integration Pattern

This is the most important architectural decision for the planner:

| Service | Backend Role | Frontend Role | Integration Pattern |
|---------|-------------|---------------|---------------------|
| Azure OpenAI (LLM) | Full adapter (execute coaching) | Consumes SSE stream | Backend-primary |
| Azure Speech STT | Full adapter (audio -> text) | Sends audio, receives text | Backend-primary |
| Azure Speech TTS | Full adapter (text -> audio) | Receives audio | Backend-primary |
| Azure AI Avatar | Config store + connection test | WebRTC rendering (Phase 08) | Frontend-primary, backend config-only |
| Azure Content Understanding | Full adapter (doc analysis) | Triggers analysis, shows results | Backend-primary |
| Azure OpenAI Realtime | Config store + token broker | WebSocket direct to Azure | Frontend-primary, backend brokers |
| Azure Voice Live API | Config store + token broker | WebSocket direct to Azure | Frontend-primary, backend brokers |

**Key insight:** For services 4, 6, 7 the backend does NOT proxy the real-time stream. The backend stores config, tests connectivity, and provides tokens/credentials. The frontend connects directly to Azure. This means the "adapter" for these services is lighter -- it only needs `is_available()` and connection testing, not a full `execute()` method.

### Recommended Project Structure (new files only)
```
backend/app/
  services/
    agents/
      adapters/
        azure_openai.py          # EXISTS
        azure_content.py         # NEW: Content Understanding adapter
        azure_realtime.py        # NEW: Realtime config/availability adapter
        azure_voice_live.py      # NEW: Voice Live config/availability adapter
      avatar/
        azure.py                 # EXISTS (stub) -> UPDATE with real connection test
      stt/azure.py               # EXISTS
      tts/azure.py               # EXISTS
    connection_tester.py         # EXISTS -> UPDATE with real tests for all 7
    config_service.py            # EXISTS (no changes needed)
    voice_live_service.py        # EXISTS (token broker) -> UPDATE SUPPORTED_REGIONS
    region_capabilities.py       # NEW: hardcoded region -> services map
  api/
    azure_config.py              # EXISTS -> UPDATE: add region-capabilities endpoint, add azure_openai_realtime to SERVICE_DISPLAY_NAMES
  schemas/
    azure_config.py              # EXISTS -> UPDATE: add RegionCapabilitiesResponse schema
```

### Pattern 1: Lightweight Config Adapter (for frontend-primary services)

**What:** A simplified adapter that implements `is_available()` and holds config but does NOT implement full `execute()`.

**When to use:** Avatar, Realtime, Voice Live -- services where the real-time interaction happens in the frontend.

**Example:**
```python
# Source: Project convention from azure_openai.py pattern
class AzureRealtimeAdapter(BaseCoachingAdapter):
    """Azure OpenAI Realtime API config adapter.

    Backend stores config and tests connectivity.
    Frontend connects directly via WebSocket.
    """
    name = "azure_openai_realtime"

    def __init__(
        self,
        endpoint: str,
        api_key: str,
        deployment: str = "gpt-4o-realtime-preview",
    ) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._deployment = deployment

    async def execute(self, request: CoachRequest) -> AsyncIterator[CoachEvent]:
        """Not used -- frontend connects directly to Azure Realtime API."""
        yield CoachEvent(
            type=CoachEventType.ERROR,
            content="Realtime API is frontend-direct; use token broker endpoint",
        )
        yield CoachEvent(type=CoachEventType.DONE, content="")

    async def is_available(self) -> bool:
        return bool(self._endpoint and self._api_key and self._deployment)
```

### Pattern 2: Full Backend Adapter (for backend-primary services)

**What:** A complete adapter with `execute()` that makes real API calls.

**When to use:** Content Understanding -- the backend needs to call the REST API, poll for results, and return structured data.

**Example:**
```python
# Source: Azure Content Understanding REST API docs
class AzureContentUnderstandingAdapter(BaseCoachingAdapter):
    """Azure Content Understanding adapter for document/multimodal analysis."""
    name = "azure_content"

    def __init__(self, endpoint: str, api_key: str) -> None:
        self._endpoint = endpoint.rstrip("/")
        self._api_key = api_key

    async def execute(self, request: CoachRequest) -> AsyncIterator[CoachEvent]:
        """Analyze content using Azure Content Understanding REST API."""
        # POST {endpoint}/contentunderstanding/analyzers/{analyzer}:analyze?api-version=2025-11-01
        # Poll Operation-Location until status=Succeeded
        # Yield results as CoachEvent
        ...

    async def is_available(self) -> bool:
        return bool(self._endpoint and self._api_key)
```

### Pattern 3: Region Capability Lookup (hardcoded map)

**What:** A Python dict mapping region identifiers to sets of supported services. Sourced from official Azure docs, maintained manually.

**When to use:** For the region-capabilities endpoint.

**Example:**
```python
# Source: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions
REGION_CAPABILITIES: dict[str, set[str]] = {
    "eastus2": {
        "azure_openai", "azure_speech_stt", "azure_speech_tts",
        "azure_avatar", "azure_openai_realtime", "azure_voice_live",
        "azure_content",
    },
    "swedencentral": {
        "azure_openai", "azure_speech_stt", "azure_speech_tts",
        "azure_avatar", "azure_openai_realtime", "azure_voice_live",
        "azure_content",
    },
    "westeurope": {
        "azure_openai", "azure_speech_stt", "azure_speech_tts",
        "azure_avatar", "azure_voice_live", "azure_content",
    },
    # ... more regions
}
```

### Anti-Patterns to Avoid
- **Building a full execute() adapter for frontend-primary services:** Avatar, Realtime, and Voice Live are frontend-direct. The backend should NOT try to proxy WebSocket or WebRTC streams.
- **Making region capabilities a live Azure API call:** The Azure Management REST API is complex, requires subscription-level auth, and has different endpoints per service. A hardcoded map (updated manually) is correct per user decision.
- **Auto-fallback between services:** The user explicitly decided NO fallback chain. Each service reports its own status independently.
- **Merging azure_openai_realtime into azure_openai:** These are completely different APIs (REST chat completion vs WebSocket real-time audio). They need separate config entries.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key encryption | Custom crypto | Fernet from cryptography (already done) | Symmetric encryption with built-in key rotation support |
| Azure OpenAI chat | Raw HTTP | openai SDK AsyncAzureOpenAI (already done) | Handles auth, retries, streaming, error parsing |
| Content Understanding analysis | Custom HTTP polling | httpx + async polling loop | Simple REST API with Operation-Location pattern -- just poll |
| WebSocket for Realtime | Backend WebSocket proxy | Frontend direct connection with backend token broker | Backend proxying adds latency and complexity for no benefit |
| Region capability detection | Azure Management API | Hardcoded lookup table | Azure has no single "what's available in this region" API |

**Key insight:** The 3 new services (Content Understanding, Realtime, Voice Live) each have different API patterns but none require new Python packages. Content Understanding is REST (httpx), Realtime is an openai SDK feature, and Voice Live is a WebSocket the frontend connects to directly.

## Azure Service Details (Per Service)

### 1. Azure OpenAI (LLM) -- ALREADY IMPLEMENTED
- Adapter: `AzureOpenAIAdapter` in `backend/app/services/agents/adapters/azure_openai.py`
- Connection test: `test_azure_openai()` makes a minimal chat completion call
- No changes needed

### 2. Azure Speech STT -- ALREADY IMPLEMENTED
- Adapter: `AzureSTTAdapter` in `backend/app/services/agents/stt/azure.py`
- Connection test: `test_azure_speech()` lists available voices
- No changes needed

### 3. Azure Speech TTS -- ALREADY IMPLEMENTED
- Adapter: `AzureTTSAdapter` in `backend/app/services/agents/tts/azure.py`
- Connection test: Shares `test_azure_speech()` (same endpoint)
- No changes needed

### 4. Azure AI Avatar -- NEEDS REAL IMPLEMENTATION
- Current: Stub adapter with `is_available()=False`
- Regions: eastus2, northeurope, southcentralus, southeastasia, swedencentral, westeurope, westus2
- Real-time synthesis uses WebRTC (frontend, Phase 08 scope)
- Backend for THIS phase: store config, validate, test connectivity via REST
- Connection test: Hit the ICE token endpoint `GET /cognitiveservices/avatar/relay/token/v1` with `Ocp-Apim-Subscription-Key` header
- Endpoint format: `https://{region}.tts.speech.microsoft.com`
- **Confidence: HIGH** (verified from official docs)

### 5. Azure Content Understanding -- NEW
- API version: `2025-11-01` (GA)
- Endpoint: `{foundry_endpoint}/contentunderstanding/analyzers/{analyzer-id}:analyze?api-version=2025-11-01`
- Auth header: `Ocp-Apim-Subscription-Key: {key}`
- Pattern: Async -- POST returns 202 + `Operation-Location`, poll until `status: "Succeeded"`
- Prebuilt analyzers: `prebuilt-invoice`, `prebuilt-imageSearch`, `prebuilt-audioSearch`, `prebuilt-videoSearch`
- Requires a Microsoft Foundry Resource (not just a Speech resource)
- Supported file types: PDF, TIFF, DOCX, XLSX, PPTX, images, audio, video
- Connection test: List analyzers or attempt a lightweight analysis
- Regional availability: Runs on Foundry resource -- available wherever Foundry resources can be created (broad availability)
- **Confidence: HIGH** (verified from official docs updated 2026-03-27)

### 6. Azure OpenAI Realtime -- NEW
- Uses the openai SDK with WebSocket transport
- Endpoint format: `wss://{resource}.openai.azure.com/openai/v1`
- **IMPORTANT:** Uses `/openai/v1` GA endpoint, NOT date-based `api-version` parameter
- Auth: `api-key` header or Microsoft Entra Bearer token
- Models: `gpt-4o-realtime-preview` (2024-12-17), `gpt-realtime` (2025-08-28), `gpt-realtime-mini`, `gpt-realtime-1.5`
- Token limits: 32K input, 4K output
- Features: VAD, session config, real-time audio streaming, transcription
- Connection test: Attempt WebSocket handshake or validate endpoint format + try REST model list
- The frontend connects directly; backend stores config and provides credentials
- **Confidence: HIGH** (verified from official docs)

### 7. Azure Voice Live API -- NEW
- WebSocket endpoint: `wss://{resource}.services.ai.azure.com/voice-live/realtime?api-version=2025-10-01&model={model}`
- Alternate endpoint (older): `wss://{resource}.cognitiveservices.azure.com/voice-live/realtime?api-version=2025-10-01`
- Auth: `api-key` query param or header, OR Microsoft Entra Bearer token with scope `https://ai.azure.com/.default`
- Agent mode: Add `agent_id` and `project_id` query params instead of `model`
- Model mode: Add `model` query param (e.g., `gpt-realtime`, `gpt-4o`, `gpt-4.1`)
- Supported models: gpt-realtime, gpt-realtime-mini, gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-5, phi4-mm-realtime
- Regions with Voice Live: Very broad -- eastus, eastus2, swedencentral, westeurope, westus, westus2, australiaeast, uksouth, francecentral, etc. (expanded significantly from earlier Phase 08 assumption of only eastus2/swedencentral)
- Agent support regions: australiaeast, brazilsouth, canadaeast, eastus, eastus2, francecentral, germanywestcentral, italynorth, japaneast, norwayeast, southafricanorth, southcentralus, southeastasia, swedencentral, switzerlandnorth, uksouth, westeurope, westus, westus2, westus3
- Avatar integration: Via `avatar` parameter in `session.update` with WebRTC (ICE servers)
- Features: noise suppression, echo cancellation, semantic VAD, filler word removal, viseme for avatar lip sync
- Connection test: HTTP probe to the endpoint (already partially implemented)
- **Confidence: HIGH** (verified from official docs updated 2026-03-16)

**CRITICAL UPDATE:** The existing `SUPPORTED_REGIONS` in `voice_live_service.py` is `{"eastus2", "swedencentral"}` which is now OUTDATED. Voice Live supports many more regions. This needs updating.

## Region Capability Map

Based on official Azure documentation (verified 2026-03-27), here is the comprehensive region map:

### Avatar Regions (most restricted)
`eastus2`, `northeurope`, `southcentralus`, `southeastasia`, `swedencentral`, `westeurope`, `westus2`

### Voice Live Regions (broad)
Almost all major regions support at least some Voice Live models. Key regions with full support including Agent mode:
`australiaeast`, `brazilsouth`, `canadaeast`, `eastus`, `eastus2`, `francecentral`, `germanywestcentral`, `italynorth`, `japaneast`, `norwayeast`, `southafricanorth`, `southcentralus`, `southeastasia`, `swedencentral`, `switzerlandnorth`, `uksouth`, `westeurope`, `westus`, `westus2`, `westus3`

### Speech STT/TTS Regions (broadest)
Available in 30+ regions. Nearly universal Azure coverage.

### OpenAI Regions
Available wherever Azure OpenAI is deployed. Check Azure OpenAI model availability docs.

### Content Understanding Regions
Runs on Foundry resources. Available wherever Foundry resources exist (broad).

### Realtime API Regions
GPT Realtime models are available as global deployments (broad availability).

### Recommendation: Hardcoded Capability Map Structure
```python
# Services that have LIMITED regional availability -- only these need region checks
AVATAR_REGIONS = {
    "eastus2", "northeurope", "southcentralus", "southeastasia",
    "swedencentral", "westeurope", "westus2",
}

# Voice Live has broad availability but Agent mode is more restricted
VOICE_LIVE_AGENT_REGIONS = {
    "australiaeast", "brazilsouth", "canadaeast", "eastus", "eastus2",
    "francecentral", "germanywestcentral", "italynorth", "japaneast",
    "norwayeast", "southafricanorth", "southcentralus", "southeastasia",
    "swedencentral", "switzerlandnorth", "uksouth", "westeurope",
    "westus", "westus2", "westus3",
}

# For services with universal availability, don't restrict by region
# azure_openai, azure_speech_stt, azure_speech_tts, azure_content,
# azure_openai_realtime: available in most regions -- no restriction needed
```

## Common Pitfalls

### Pitfall 1: Missing azure_openai_realtime in SERVICE_DISPLAY_NAMES
**What goes wrong:** The frontend has `SERVICE_KEY_MAP` with `realtime: "azure_openai_realtime"` but the backend `SERVICE_DISPLAY_NAMES` in `azure_config.py` does NOT include `azure_openai_realtime` -- only 6 services are listed.
**Why it happens:** Phase 07 v1 was scoped to fewer services.
**How to avoid:** Add `"azure_openai_realtime": "Azure OpenAI Realtime"` to `SERVICE_DISPLAY_NAMES`.
**Warning signs:** Frontend save for Realtime card returns 400 "Unknown service".

### Pitfall 2: Outdated SUPPORTED_REGIONS for Voice Live
**What goes wrong:** `voice_live_service.py` has `SUPPORTED_REGIONS = {"eastus2", "swedencentral"}` but the actual Voice Live API now supports 20+ regions.
**Why it happens:** The original Phase 08 implementation was conservative.
**How to avoid:** Update SUPPORTED_REGIONS from the official docs or refactor to use the new region_capabilities module.
**Warning signs:** Users in valid regions get "Unsupported region" errors.

### Pitfall 3: Content Understanding Requires Foundry Resource
**What goes wrong:** Content Understanding won't work with a regular Cognitive Services key.
**Why it happens:** Content Understanding is a Foundry Tool, requiring a Microsoft Foundry Resource.
**How to avoid:** Document this in the config UI tooltip. Connection test should verify the resource type.
**Warning signs:** 401/403 errors on Content Understanding endpoint with valid Speech/OpenAI keys.

### Pitfall 4: Realtime API Uses /openai/v1 NOT api-version
**What goes wrong:** Connection test fails because it uses `?api-version=2024-xx-xx` query param.
**Why it happens:** Azure OpenAI standard API uses api-version, but Realtime GA uses `/openai/v1` path.
**How to avoid:** Realtime connection test must construct URL as `wss://{endpoint}/openai/v1` or verify deployment via REST.
**Warning signs:** 404 or upgrade-required errors on connection test.

### Pitfall 5: Voice Live Agent Mode Needs Different Auth
**What goes wrong:** Agent mode requires `agent_id` + `project_id` instead of `model` param. May also need Azure AD token instead of API key.
**Why it happens:** Agent service uses Foundry AI Agent framework with different auth requirements.
**How to avoid:** ServiceConfig `model_or_deployment` field can encode mode with convention like "agent:{agent_id}:{project_id}" or frontend sends mode info in the config update.
**Warning signs:** 401 errors when using API key with Agent mode, missing agent_id param.

### Pitfall 6: ServiceConfig Extra Fields for Voice Live Agent Mode
**What goes wrong:** The `ServiceConfig` model only has: endpoint, api_key, model_or_deployment, region. Voice Live Agent mode needs additional fields: `project_name`, `agent_id`.
**Why it happens:** The DB model was designed for simpler services.
**How to avoid:** Either add nullable columns to ServiceConfig, or store agent config as JSON in a text field, or encode in model_or_deployment with a convention.
**Warning signs:** Cannot save Agent mode configuration.

## Code Examples

### Content Understanding Connection Test
```python
# Source: https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/quickstart/use-rest-api
async def test_azure_content_understanding(
    endpoint: str, api_key: str,
) -> tuple[bool, str]:
    """Test Content Understanding by listing prebuilt analyzers."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = (
                f"{endpoint.rstrip('/')}/contentunderstanding"
                f"/analyzers?api-version=2025-11-01"
            )
            response = await client.get(
                url,
                headers={"Ocp-Apim-Subscription-Key": api_key},
            )
            if response.status_code == 200:
                return (True, "Connection successful")
            return (False, f"HTTP {response.status_code}: {response.text[:200]}")
    except Exception as e:
        return (False, f"Connection failed: {e!s}")
```

### Avatar Connection Test (Real)
```python
# Source: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/real-time-synthesis-avatar
async def test_azure_avatar_real(
    api_key: str, region: str,
) -> tuple[bool, str]:
    """Test Avatar by fetching ICE relay token."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = (
                f"https://{region}.tts.speech.microsoft.com"
                f"/cognitiveservices/avatar/relay/token/v1"
            )
            response = await client.get(
                url,
                headers={"Ocp-Apim-Subscription-Key": api_key},
            )
            if response.status_code == 200:
                return (True, "Avatar service reachable (ICE token retrieved)")
            return (False, f"Avatar test failed: HTTP {response.status_code}")
    except Exception as e:
        return (False, f"Avatar connection failed: {e!s}")
```

### Realtime API Connection Test
```python
# Source: https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/realtime-audio
async def test_azure_realtime(
    endpoint: str, api_key: str, deployment: str,
) -> tuple[bool, str]:
    """Test Realtime API by verifying deployment exists via REST."""
    try:
        base = endpoint.rstrip("/")
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{base}/openai/deployments/{deployment}?api-version=2024-06-01"
            response = await client.get(
                url,
                headers={"api-key": api_key},
            )
            if response.status_code == 200:
                return (True, "Realtime deployment found")
            elif response.status_code in (401, 403):
                return (False, f"Authentication failed: HTTP {response.status_code}")
            elif response.status_code == 404:
                return (False, f"Deployment '{deployment}' not found")
            return (False, f"HTTP {response.status_code}: {response.text[:200]}")
    except Exception as e:
        return (False, f"Connection failed: {e!s}")
```

### Region Capabilities Endpoint
```python
# New endpoint in azure_config.py
from app.services.region_capabilities import get_region_capabilities

@router.get("/region-capabilities/{region}")
async def get_capabilities(
    region: str,
    _admin: User = Depends(require_role("admin")),
) -> dict:
    """Return which Azure AI services are available in the given region."""
    return get_region_capabilities(region)
```

### Voice Live Agent Mode Config Convention
```python
# Convention: store agent config in model_or_deployment
# Model mode: just the model name like "gpt-realtime"
# Agent mode: "agent:{agent_id}:{project_name}"
def parse_voice_live_config(model_or_deployment: str) -> dict:
    if model_or_deployment.startswith("agent:"):
        parts = model_or_deployment.split(":", 2)
        return {
            "mode": "agent",
            "agent_id": parts[1],
            "project_name": parts[2] if len(parts) > 2 else "",
        }
    return {
        "mode": "model",
        "model": model_or_deployment or "gpt-4o-realtime-preview",
    }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Voice Live only eastus2/swedencentral | Voice Live in 20+ regions | 2025-2026 | SUPPORTED_REGIONS must be updated |
| Azure OpenAI Realtime preview API version | GA endpoint `/openai/v1` (no api-version param) | 2025-12 | Realtime connection URL construction differs from standard OpenAI |
| Content Understanding preview | GA at `2025-11-01` | 2025-11 | Stable API, prebuilt analyzers available |
| Voice Live limited models | Voice Live supports gpt-4o, gpt-4.1, gpt-5, phi4 | 2025-2026 | Many model choices for Voice Live |
| Separate Speech + Cognitive resources | Microsoft Foundry Resource (unified) | 2025-2026 | Content Understanding requires Foundry resource |

**Deprecated/outdated:**
- `SUPPORTED_REGIONS = {"eastus2", "swedencentral"}` in voice_live_service.py -- needs expansion
- Date-based `api-version` for Realtime API -- GA uses `/openai/v1` endpoint

## Open Questions

1. **ServiceConfig Extra Fields for Agent Mode**
   - What we know: Voice Live Agent mode needs `project_name` and `agent_id` beyond what ServiceConfig stores
   - What's unclear: Best storage strategy -- add DB columns vs encode in existing field vs JSON blob
   - Recommendation: Use `model_or_deployment` field with convention encoding (`"agent:{agent_id}:{project_name}"` vs `"gpt-realtime"`). Avoids DB migration for a simple config difference. Frontend can render different form fields based on a radio button (Agent/Model mode).

2. **Content Understanding Regional Availability**
   - What we know: It is a Foundry Tool running on Foundry Resources
   - What's unclear: Exact region list for Content Understanding (docs don't enumerate specific regions)
   - Recommendation: Mark as available everywhere for now. If connection test fails, the error message will indicate the issue. Flag as LOW confidence in the region map.

3. **Azure AD Token Auth for Voice Live Agent Mode**
   - What we know: Agent mode recommends Microsoft Entra (Azure AD) auth with scope `https://ai.azure.com/.default`
   - What's unclear: Whether API key works for Agent mode or ONLY Entra tokens
   - Recommendation: Support API key first (simpler). Add Azure AD as a future enhancement. The connection test will reveal if API key works.

## Environment Availability

No external tools required beyond what is already installed. Phase 07 expanded scope adds backend Python code and minor frontend updates. All dependencies (openai, httpx, cryptography) are already in pyproject.toml.

## Project Constraints (from CLAUDE.md)

- **Async everywhere:** All new adapter methods must be `async def`
- **Conditional imports:** Use `try/except ImportError` pattern inside constructors (matching azure_openai.py convention)
- **Service layer holds logic:** Connection testing logic in service, router only handles HTTP
- **Pydantic v2:** New schemas use `model_config = ConfigDict(from_attributes=True)`
- **Alembic for schema changes:** If adding columns to ServiceConfig, must use Alembic migration with batch operations for SQLite
- **No raw SQL:** Use SQLAlchemy ORM
- **Route ordering:** Static routes before parameterized (`/region-capabilities/{region}` before `/{id}`)
- **Create returns 201, Delete returns 204**
- **ruff check + format** must pass
- **Tests required:** pytest with >=95% coverage per project convention
- **Conventional commits:** `feat:`, `fix:`, `test:`

## Sources

### Primary (HIGH confidence)
- [Azure Content Understanding Overview](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/overview) - GA service, Foundry Tool, REST API
- [Azure Content Understanding REST API Quickstart](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/quickstart/use-rest-api) - Endpoint patterns, auth header, API version 2025-11-01
- [Azure Content Understanding Service Limits](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/service-limits) - File types, rate limits, analyzer limits
- [Azure OpenAI Realtime API](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/realtime-audio) - WebSocket protocol, /openai/v1 GA endpoint, supported models
- [Azure Voice Live API Overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live) - Model support, pricing tiers, regions
- [Azure Voice Live API How-To](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to) - WebSocket endpoint, auth, session config, avatar integration
- [Azure Speech Service Regions](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions) - Complete region tables for Avatar, Voice Live, STT, TTS
- [Azure TTS Avatar Overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/what-is-text-to-speech-avatar) - Avatar capabilities, real-time synthesis
- [Azure Real-time Avatar Synthesis](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/real-time-synthesis-avatar) - WebRTC setup, ICE servers, Speech SDK

### Secondary (MEDIUM confidence)
- Existing codebase: `backend/app/services/connection_tester.py`, `azure_config.py`, `voice_live_service.py` - Current implementation patterns
- Existing codebase: `frontend/src/pages/admin/azure-config.tsx` - 7 service cards with SERVICE_KEY_MAP

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new packages, all verified in existing pyproject.toml
- Architecture (service classification): HIGH - verified each service's API pattern against official docs
- Region capabilities: MEDIUM - Avatar and Voice Live regions verified from official tables; Content Understanding availability unclear
- Connection test patterns: HIGH - verified endpoint URLs and auth headers from official docs
- Voice Live Agent mode: MEDIUM - docs confirm agent_id/project_id params but API key vs Entra auth unclear
- Pitfalls: HIGH - identified from analyzing existing code gaps vs official API requirements

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (Azure services evolve; region tables should be re-verified monthly)

</details>

## UI Specification

<details><summary>Click to expand UI spec</summary>

# Phase 07 -- UI Design Contract

> Visual and interaction contract for the Azure AI Service Integration & Voice/Avatar phase. This phase is predominantly backend-focused (new adapters, connection testers, region capabilities). Frontend changes are surgical extensions to the existing Azure Config admin page: region availability hints per service, Agent/Model mode selector for Voice Live, updated region warnings, and real connection status display. No new pages are created. Generated by gsd-ui-researcher, verified by gsd-ui-checker.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | manual shadcn/ui adaptation (no `components.json`) -- inherited from Phase 1 |
| Preset | not applicable -- components adapted from local Figma Make exports |
| Component library | Radix UI primitives via shadcn/ui wrappers |
| Icon library | lucide-react ^0.460.0 |
| Font | Inter (EN) + Noto Sans SC (CN), loaded via Google Fonts |

**Source:** Phase 1 UI-SPEC (established design system); no changes for Phase 7.

**Note:** Phase 7 introduces no new UI primitive dependencies from Radix/shadcn. All frontend changes are extensions to existing components (`azure-config.tsx`, `service-config-card.tsx`) and minor additions to the `admin` i18n namespace. The only new UI construct is a region availability indicator and an Agent/Model radio toggle inside the Voice Live config card.

---

## Spacing Scale

Declared values (inherited from Phase 1, multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, status indicator dot spacing, inline label gaps |
| sm | 8px | Compact element spacing, badge internal padding, radio button gaps |
| md | 16px | Default element spacing, config card internal padding, form field gaps |
| lg | 24px | Section padding inside expanded config cards |
| xl | 32px | Vertical gap between service config cards |
| 2xl | 48px | Major section breaks (page header to card list) |
| 3xl | 64px | Not used in Phase 7 (no new pages) |

Component Dimensions (not spacing tokens):
- Region availability hint bar height: 40px (5 * 8px) -- inline informational bar below region input field
- Service config card collapsed height: 72px (9 * 8px) -- icon (48px) + vertical padding, matching existing pattern
- Agent/Model mode radio group width: fills parent grid cell (col-span-2 within the existing 2-column grid)

**Source:** Phase 1 UI-SPEC spacing scale; existing `service-config-card.tsx` layout measurements

---

## Typography

| Role | Size | Weight | Line Height | CSS Variable |
|------|------|--------|-------------|--------------|
| Body | 16px (1rem) | 400 (normal) | 1.5 | `--text-base` / `--font-weight-normal` |
| Label | 16px (1rem) | 500 (medium) | 1.5 | `--text-base` / `--font-weight-medium` |
| Heading (h3) | 18px (1.125rem) | 500 (medium) | 1.5 | `--text-lg` / `--font-weight-medium` |
| Display (h1) | 24px (1.5rem) | 500 (medium) | 1.5 | `--text-2xl` / `--font-weight-medium` |

Font stack: `'Inter', 'Noto Sans SC', sans-serif`

**Phase 7 supplementary text -- inherited Tailwind utility classes (not part of the design system type scale):**

Phase 7 uses `text-xs` (12px) and `text-sm` (14px) from Tailwind's default utility classes for supplementary and secondary text within config cards. These are NOT additions to the Phase 7 type scale -- they are pre-existing framework defaults applied to lower-emphasis elements:

- `text-xs` (12px, weight 500): Region availability tag badges (uppercase), config card masked key hint (already exists)
- `text-sm` (14px, weight 400): Region availability hint text (`text-muted-foreground`), service status text (color per status)
- `text-sm` (14px, weight 500): Agent/Model mode radio labels

**Sizes declared (3 total, unchanged):** 16px, 18px, 24px
**Weights declared (2 total, unchanged):** 400 (normal), 500 (medium)

**Source:** Phase 1 UI-SPEC typography; existing `service-config-card.tsx` and `azure-config.tsx` patterns

---

## Color

### Primary Palette (Light Mode, inherited from Phase 1)

| Role | Value | Tailwind Class | Usage |
|------|-------|----------------|-------|
| Dominant (60%) | `#FFFFFF` | `bg-background` | Page background, config card surfaces |
| Secondary (30%) | `#ECECF0` | `bg-muted` | Config card header backgrounds on hover |
| Accent (10%) | `#1E40AF` | `bg-primary` | Save button, active status dot, available badges |
| Destructive | `#EF4444` | `bg-destructive` | Error status dot, connection failure badges |

### Phase 7 Status Color Assignments

| Element | Color | Token | Rationale |
|---------|-------|-------|-----------|
| Service status: active | `#22C55E` | `bg-green-500` | Green dot -- service configured and connection verified (existing pattern) |
| Service status: inactive | `#9CA3AF` | `bg-gray-400` | Gray dot -- service not configured (existing pattern) |
| Service status: error | `#EF4444` | `bg-red-500` | Red dot -- connection test failed (existing pattern) |
| Service status: testing | `#EAB308` | `bg-yellow-500 animate-pulse` | Yellow pulsing dot -- test in progress (existing pattern) |
| Service status: unavailable | `#9333EA` | `bg-purple-600` | Purple dot -- service not available in configured region (NEW) |
| Region available badge | `#22C55E` on `#F0FDF4` | `text-green-700 bg-green-50` | Green badge -- service available in this region |
| Region unavailable badge | `#9333EA` on `#FAF5FF` | `text-purple-700 bg-purple-50` | Purple badge -- service not available in this region |
| Region unknown badge | `#6B7280` on `#F9FAFB` | `text-gray-600 bg-gray-50` | Gray badge -- region not recognized or availability unknown |
| Region warning inline | `#F97316` on `#FFF7ED` | `text-orange-800 bg-orange-50 border-orange-200` | Orange warning bar -- limited availability notice (existing Voice Live pattern) |
| Agent mode indicator | `#1E40AF` | `text-primary` | Primary color badge for Agent mode label |
| Model mode indicator | `#475569` | `text-secondary` | Secondary color badge for Model mode label |

### Accent Reserved For (explicit list, Phase 7 additions)

Inherited from Phase 1 reserved list, plus:
1. Save Configuration button (`bg-primary`)
2. Active service status dot (`bg-green-500`) -- note: this uses green, not accent blue
3. Region "Available" badge text
4. Agent/Model mode active radio indicator

NOT used for: region availability hint background (use orange/purple/gray semantic colors), config card borders (use `--border`), test connection button (use `variant="outline"`).

**Source:** Phase 1 UI-SPEC color contract; existing `service-config-card.tsx` STATUS_DOT pattern; CONTEXT.md region availability design direction

---

## Visual Hierarchy -- Focal Point Declaration

**Primary visual anchor:** The expanded service config card with its colored status dot (green/red/purple) and region availability badge draws the eye first; the status dot and badge provide immediate at-a-glance service health.

**Secondary visual anchor:** The page heading ("Azure Service Configuration") paired with the "Test All Connections" button in the top-right corner, establishing the page context and primary bulk action.

---

## Layout Contract

### Azure Config Page (Extended -- No New Pages)

Phase 7 does not create new pages. All UI changes occur within the existing `azure-config.tsx` page and `service-config-card.tsx` component.

```
+-------------------------------------------------------------------+
| Azure Service Configuration (h1)           [Test All Connections]  |
+-------------------------------------------------------------------+
| max-w-4xl, space-y-4                                               |
|                                                                    |
| +--------------------------------------------------------------+  |
| | [icon] Azure OpenAI           (green dot) Active      [^/v]  |  |
| |        GPT-4o for AI coaching...                              |  |
| |        [Available in eastus2] (green badge)                   |  |
| | (expanded: endpoint, apiKey, model, region fields + buttons)  |  |
| +--------------------------------------------------------------+  |
|                                                                    |
| +--------------------------------------------------------------+  |
| | [icon] Azure Speech (STT)     (gray dot) Inactive    [^/v]   |  |
| |        Speech-to-text for voice input...                      |  |
| |        [Available in eastus2] (green badge)                   |  |
| +--------------------------------------------------------------+  |
|                                                                    |
| +--------------------------------------------------------------+  |
| | [icon] Azure Speech (TTS)     (gray dot) Inactive    [^/v]   |  |
| |        Text-to-speech for HCP voice...                        |  |
| |        [Available in eastus2] (green badge)                   |  |
| +--------------------------------------------------------------+  |
|                                                                    |
| +--------------------------------------------------------------+  |
| | [icon] Azure AI Avatar        (purple dot) Unavailable [^/v] |  |
| |        Digital human avatar for HCP...                        |  |
| |        [Not available in westus] (purple badge)               |  |
| +--------------------------------------------------------------+  |
|                                                                    |
| +--------------------------------------------------------------+  |
| | [icon] Azure Content Understanding  (gray dot) Inactive[^/v] |  |
| |        Multimodal evaluation for training...                  |  |
| |        [Available] (green badge)                              |  |
| +--------------------------------------------------------------+  |
|                                                                    |
| +--------------------------------------------------------------+  |
| | [icon] Azure OpenAI Realtime  (gray dot) Inactive    [^/v]   |  |
| |        Real-time audio streaming...                           |  |
| |        [Available] (green badge)                              |  |
| +--------------------------------------------------------------+  |
|                                                                    |
| +--------------------------------------------------------------+  |
| | [icon] Azure Voice Live API   (green dot) Active     [^/v]   |  |
| |        Real-time voice coaching with GPT-4o Realtime          |  |
| |        [Available in eastus2] (green badge)                   |  |
| | (expanded: endpoint, apiKey, region fields                    |  |
| |  + Agent/Model mode radio                                    |  |
| |  + model field (Model mode) OR agent_id + project fields     |  |
| |  + Save + Test Connection buttons)                            |  |
| +--------------------------------------------------------------+  |
|                                                                    |
| +--------------------------------------------------------------+  |
| | [icon] Azure Database         (gray dot) Inactive    [^/v]   |  |
| |        Managed PostgreSQL for production data                 |  |
| +--------------------------------------------------------------+  |
+-------------------------------------------------------------------+
```

### ServiceConfigCard Extension -- Region Availability Badge

Added below the service description line, before the expand/collapse chevron area:

```
+--------------------------------------------------------------+
| [48px icon bg] Service Name       (status dot) Status  [^/v] |
|                Service description text                       |
|                [Region Badge] Available in eastus2            |
+--------------------------------------------------------------+
```

The region badge appears ONLY when:
1. A region is configured in the saved config for this service, AND
2. Region capability data has been fetched

Badge variants:
- Green: `[check-icon] Available in {region}` -- `text-green-700 bg-green-50 border border-green-200`
- Purple: `[x-icon] Not available in {region}` -- `text-purple-700 bg-purple-50 border border-purple-200`
- Gray: `[info-icon] Region availability unknown` -- `text-gray-600 bg-gray-50 border border-gray-200`

### Voice Live Config Card Extension -- Agent/Model Mode

When the Voice Live card is expanded, display a radio group ABOVE the standard form fields:

```
+--------------------------------------------------------------+
| Voice Live API Mode                                           |
|                                                               |
| (o) Model Mode  -- Direct Azure OpenAI model connection      |
| ( ) Agent Mode  -- Azure AI Agent Service with pre-configured |
|                    HCP persona agent                          |
+--------------------------------------------------------------+
| (standard 2-col grid: endpoint, apiKey, region)               |
|                                                               |
| Model Mode fields:                                            |
| [Model/Deployment: gpt-realtime   ] [Region: eastus2       ] |
|                                                               |
| -- OR (if Agent Mode selected) --                             |
|                                                               |
| Agent Mode fields:                                            |
| [Agent ID: ____________          ] [Project Name: _________ ] |
+--------------------------------------------------------------+
| [Save Configuration]  [Test Connection]                       |
+--------------------------------------------------------------+
```

The radio group toggles which additional fields are shown:
- **Model mode (default):** Standard `model_or_deployment` + `region` fields
- **Agent mode:** `agent_id` + `project_name` fields (stored encoded in `model_or_deployment` as `agent:{agent_id}:{project_name}`)

### Responsive Behavior

No changes to responsive behavior. The existing Azure Config page is within the admin layout which handles responsive breakpoints. The config cards stack vertically at all breakpoints. The 2-column form grid within expanded cards collapses to single column below 640px (existing behavior).

**Source:** CONTEXT.md decisions (7 equal modes, region availability hints); RESEARCH.md architecture patterns (service classification, Voice Live Agent/Model modes); existing `azure-config.tsx` and `service-config-card.tsx` implementation

---

## Copywriting Contract

All copy delivered via react-i18next `admin` namespace (extend existing). English canonical copy below.

### Region Availability Copy

| Element | Key | English Copy | Chinese Copy |
|---------|-----|-------------|--------------|
| Available badge | `admin.azureConfig.regionAvailable` | Available in {{region}} | 在 {{region}} 可用 |
| Unavailable badge | `admin.azureConfig.regionUnavailable` | Not available in {{region}} | 在 {{region}} 不可用 |
| Unknown badge | `admin.azureConfig.regionUnknown` | Region availability unknown | 区域可用性未知 |
| Avatar region hint | `admin.azureConfig.avatarRegionHint` | Azure AI Avatar is available in: East US 2, North Europe, South Central US, Southeast Asia, Sweden Central, West Europe, West US 2 | Azure AI Avatar 可用区域：美国东部 2、北欧、美国中南部、东南亚、瑞典中部、西欧、美国西部 2 |
| Voice Live region hint | `admin.azureConfig.voiceLiveRegionHint` | Voice Live API is available in most Azure regions. Agent mode requires specific AI Foundry regions. | Voice Live API 在大多数 Azure 区域可用。Agent 模式需要特定的 AI Foundry 区域。 |
| Content Understanding hint | `admin.azureConfig.contentHint` | Requires a Microsoft Foundry Resource (not a standard Cognitive Services resource). | 需要 Microsoft Foundry 资源（非标准认知服务资源）。 |
| Realtime hint | `admin.azureConfig.realtimeHint` | Requires gpt-4o-realtime-preview or gpt-realtime model deployment. | 需要部署 gpt-4o-realtime-preview 或 gpt-realtime 模型。 |

### Voice Live Agent/Model Mode Copy

| Element | Key | English Copy | Chinese Copy |
|---------|-----|-------------|--------------|
| Mode section label | `admin.voiceLive.modeLabel` | Voice Live API Mode | Voice Live API 模式 |
| Model mode label | `admin.voiceLive.modelMode` | Model Mode | 模型模式 |
| Model mode description | `admin.voiceLive.modelModeDesc` | Direct Azure OpenAI model connection | 直接 Azure OpenAI 模型连接 |
| Agent mode label | `admin.voiceLive.agentMode` | Agent Mode | Agent 模式 |
| Agent mode description | `admin.voiceLive.agentModeDesc` | Azure AI Agent Service with pre-configured HCP persona agent | Azure AI Agent 服务配合预配置的 HCP 角色代理 |
| Agent ID field | `admin.voiceLive.agentId` | Agent ID | Agent ID |
| Project name field | `admin.voiceLive.projectName` | Project Name | 项目名称 |
| Agent ID placeholder | `admin.voiceLive.agentIdPlaceholder` | Enter Azure AI Agent ID | 输入 Azure AI Agent ID |
| Project placeholder | `admin.voiceLive.projectPlaceholder` | Enter AI Foundry project name | 输入 AI Foundry 项目名称 |

### Connection Test Result Copy (extend existing)

| Element | Key | English Copy | Chinese Copy |
|---------|-----|-------------|--------------|
| Content Understanding success | `admin.azureConfig.contentTestSuccess` | Content Understanding service connected. Analyzers accessible. | 内容理解服务已连接。分析器可访问。 |
| Content Understanding failure | `admin.azureConfig.contentTestFailed` | Content Understanding connection failed. Verify this is a Foundry Resource endpoint. | 内容理解连接失败。请确认此为 Foundry 资源端点。 |
| Realtime success | `admin.azureConfig.realtimeTestSuccess` | Realtime API deployment verified. | 实时 API 部署已验证。 |
| Realtime failure | `admin.azureConfig.realtimeTestFailed` | Realtime deployment not found. Verify the deployment name supports realtime audio. | 未找到实时部署。请确认部署名称支持实时音频。 |
| Voice Live success | `admin.azureConfig.voiceLiveTestSuccess` | Voice Live API endpoint reachable. | Voice Live API 端点可访问。 |
| Voice Live failure | `admin.azureConfig.voiceLiveTestFailed` | Voice Live API connection failed. Verify the endpoint and API key. | Voice Live API 连接失败。请验证端点和 API 密钥。 |
| Avatar success | `admin.azureConfig.avatarTestSuccess` | Avatar service reachable. ICE relay token retrieved. | Avatar 服务可访问。ICE 中继令牌已获取。 |
| Avatar failure | `admin.azureConfig.avatarTestFailed` | Avatar connection failed. Verify the region supports Avatar synthesis. | Avatar 连接失败。请确认该区域支持 Avatar 合成。 |

### Primary CTA and Standard Elements

| Element | Copy |
|---------|------|
| Primary CTA | **Save Configuration** -- Phase 7 updates the existing "Save" button label in each config card to "Save Configuration" for specificity. i18n key: `admin.azureConfig.saveConfig`. |
| Empty state heading | N/A -- config page always shows all 8 service cards, never empty |
| Empty state body | N/A -- each unconfigured card shows "Inactive" status dot and form fields |
| Error state | Toast notification via sonner: "{Service Name}: {error.message}" with problem description and solution path (see connection test copy above) |
| Destructive confirmation | None in Phase 7 -- there is no "delete configuration" action. Saving empty fields effectively disables a service. |

### Updated Voice Live Region Warning (replaces outdated copy)

| Element | Key | Old Copy | New Copy (EN) | New Copy (CN) |
|---------|-----|----------|---------------|---------------|
| Region warning | `admin.voiceLive.regionWarning` | Voice Live API is only available in East US 2 and Sweden Central regions. | Voice Live API is available in most Azure regions. Some models and Agent mode may have regional restrictions. Check the Azure documentation for your region. | Voice Live API 在大多数 Azure 区域可用。部分模型和 Agent 模式可能有区域限制。请查阅您所在区域的 Azure 文档。 |

**Source:** CONTEXT.md decisions (7 equal modes, region availability); RESEARCH.md (region capability map, connection test patterns, Agent/Model mode); existing `admin.json` i18n structure

---

## Component Inventory (Phase 7)

### New Components: None

Phase 7 does NOT create new component files. All changes are modifications to existing components.

### Extended Existing Components

| Component | Extension | Location |
|-----------|-----------|----------|
| `service-config-card.tsx` | (1) Add `regionStatus` prop for region availability badge display. (2) Add `unavailable` to `ServiceStatus` type with purple dot. (3) Add region availability badge below description text. | `components/admin/` |
| `service-config-card.tsx` | (4) For Voice Live card: add Agent/Model mode radio group that toggles between model fields and agent fields. Radio selection encodes into `model_or_deployment` field. | `components/admin/` |
| `azure-config.tsx` | (1) Remove hardcoded Voice Live region warning (`eastus2`/`swedencentral` only). (2) Add `useRegionCapabilities` hook call to fetch region data. (3) Pass `regionStatus` prop to each `ServiceConfigCard` based on fetched capabilities. (4) Add `azure_openai_realtime` to `SERVICE_KEY_MAP` if missing (already present). (5) Update save button label from "Save" to "Save Configuration" (`admin.azureConfig.saveConfig`). | `pages/admin/` |

### New Hooks

| Hook | Purpose | Location |
|------|---------|----------|
| `use-region-capabilities.ts` | TanStack Query hook wrapping `GET /api/v1/azure-config/region-capabilities/{region}`. Returns map of service name to availability boolean. Stale time: 5 minutes. | `hooks/` |

### New TypeScript Types

| Addition | Location |
|----------|----------|
| `RegionCapabilities` interface: `{ region: string; services: Record<string, { available: boolean; note?: string }> }` | `types/azure-config.ts` (extend existing file) |
| `RegionStatus` type: `"available" \| "unavailable" \| "unknown"` | `types/azure-config.ts` (extend existing file) |

### New i18n Keys

| Namespace | Keys Added | Count |
|-----------|-----------|-------|
| `admin` | `azureConfig.regionAvailable`, `azureConfig.regionUnavailable`, `azureConfig.regionUnknown`, `azureConfig.avatarRegionHint`, `azureConfig.voiceLiveRegionHint`, `azureConfig.contentHint`, `azureConfig.realtimeHint`, `azureConfig.saveConfig`, `voiceLive.modeLabel`, `voiceLive.modelMode`, `voiceLive.modelModeDesc`, `voiceLive.agentMode`, `voiceLive.agentModeDesc`, `voiceLive.agentId`, `voiceLive.projectName`, `voiceLive.agentIdPlaceholder`, `voiceLive.projectPlaceholder`, connection test result keys (8) | 24 total |

### Existing Components Reused Without Modification

| Component | Phase 7 Usage |
|-----------|--------------|
| `Card`, `CardHeader`, `CardContent` | Service config card structure (existing) |
| `Input`, `Label` | Config form fields (existing) |
| `Button` | Save Configuration, Test Connection buttons (existing) |
| `Badge` | Region availability indicators (new usage of existing component) |
| Sonner `toast` | Success/error notifications for save and test operations (existing) |
| `Loader2` icon | Testing spinner (existing) |

---

## Interaction States

### Service Config Card States (Extended)

| State | Status Dot | Badge | User Actions |
|-------|-----------|-------|-------------|
| Not configured | Gray (`bg-gray-400`) | None (no region set) | Expand card, enter config, save |
| Configured + untested | Gray (`bg-gray-400`) | Region badge (if region set) | Test connection, save changes |
| Testing | Yellow pulsing (`bg-yellow-500 animate-pulse`) | Region badge (if region set) | Wait for test result |
| Active (test passed) | Green (`bg-green-500`) | Region badge (if region set) | Reconfigure, re-test |
| Error (test failed) | Red (`bg-red-500`) | Region badge (if region set) | Fix config, re-test |
| **Unavailable in region (NEW)** | Purple (`bg-purple-600`) | Purple "Not available" badge | Save config anyway (admin may prepare for future), change region |

### Region Badge Behavior

| Trigger | Behavior |
|---------|----------|
| Region field changes | Debounce 500ms, then fetch `GET /region-capabilities/{newRegion}` |
| Region capabilities response received | Update all service card badges simultaneously |
| Region empty | Hide all region badges |
| API error fetching capabilities | Show gray "Region availability unknown" badge |
| Region not in capability map | Show gray "Region availability unknown" badge |

### Voice Live Agent/Model Mode Toggle

| State | Fields Shown | Encoding |
|-------|-------------|----------|
| Model mode (default) | Endpoint, API Key, Model/Deployment, Region | `model_or_deployment` = model name (e.g., `gpt-realtime`) |
| Agent mode | Endpoint, API Key, Agent ID, Project Name, Region | `model_or_deployment` = `agent:{agent_id}:{project_name}` |
| Switching modes | Clear mode-specific fields, preserve shared fields (endpoint, API key, region) | Re-encode on next save |

### Test All Connections (Extended)

Existing "Test All Connections" button behavior is unchanged. Tests are run sequentially for all services that have an endpoint configured. Each result shows a toast. Services unavailable in the configured region still attempt the connection test -- unavailability is informational, not blocking.

---

## Accessibility Contract

Inherited from Phase 1, plus Phase 7 additions:

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | Purple unavailable badge: `#9333EA` on `#FAF5FF` meets WCAG AA (4.7:1). Green available badge: `#15803D` on `#F0FDF4` meets AA (5.1:1). |
| Focus indicators | Agent/Model radio buttons receive visible focus ring. Region badge is not interactive (no focus needed). |
| Keyboard navigation | Tab order within expanded Voice Live card: mode radio group -> endpoint -> API key -> model/agent fields -> region -> Save Configuration -> Test. |
| Screen reader | Radio group uses `role="radiogroup"` with `aria-label="Voice Live API Mode"`. Region badge uses `role="status"` with `aria-live="polite"`. |
| Touch targets | Radio buttons: 44px minimum touch target height. All other targets unchanged (existing). |

---

## Border Radius (Inherited)

| Token | Value | Usage in Phase 7 |
|-------|-------|-------------------|
| `--radius-sm` | 6px | Region availability badge border radius |
| `--radius-md` | 8px | Config card internal elements |
| `--radius-lg` | 10px | Config card container (existing) |
| `--radius-xl` | 14px | Not used in Phase 7 |

---

## Shadows (Inherited)

| Token | Usage in Phase 7 |
|-------|-------------------|
| Card shadow (`0 1px 3px rgba(0,0,0,0.1)`) | Service config cards (existing, unchanged) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (manual adaptation) | No new UI primitives added in Phase 7 -- Badge component already exists | not required |
| Third-party registries | none | not applicable |

**Note:** Phase 7 makes no additions to the UI component library. All changes are extensions to existing admin page components using existing primitives (Card, Input, Label, Button, Badge). No new Radix primitives or shadcn/ui base components are required.

---

## i18n Contract

| Namespace | Status | Files |
|-----------|--------|-------|
| `admin` | **Extended** | Add 24 new keys for region availability, Agent/Model mode, save button label, and connection test results |
| `voice` | **Updated** | Update `error.regionUnsupported` to reflect expanded Voice Live region support |
| `coach` | Unchanged | No changes |
| `common` | Unchanged | No changes |

All admin config copy uses `useTranslation("admin")`. Voice error copy update uses `useTranslation("voice")`.

---

## Dark Mode

Phase 7 does NOT implement dark mode. Dark tokens are preserved in CSS. Region availability badges use semantic color classes (`bg-green-50`, `bg-purple-50`, `bg-orange-50`) that have no dark mode variants defined. If dark mode is added later, these badges will need dark-aware color tokens.

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

# Phase 07: Azure Service Integration Verification Report

**Phase Goal:** Full Azure AI service integration -- all 7 service modes (OpenAI, Speech STT, Speech TTS, Avatar, Content Understanding, OpenAI Realtime, Voice Live) configurable, testable, and registered. Backend adapters, connection testers, region capabilities, frontend config UI with region badges and Voice Live Agent/Model mode toggle.
**Verified:** 2026-03-27T15:00:00Z
**Status:** PASSED
**Re-verification:** Yes -- previous verification covered plans 01-04 only (6/6 truths). Plans 05-07 executed after that verification, adding 7 new truths for a total of 13.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can configure Azure OpenAI endpoint/key/model/region from web UI, settings persist to DB with encrypted API key | VERIFIED | PUT `/api/v1/azure-config/services/{service_name}` persists to `service_configs` table with Fernet-encrypted API key. Frontend uses TanStack Query hooks. Lifespan loads from DB on startup. 14 original API tests pass. |
| 2 | Admin can configure all 7 Azure services (OpenAI, Speech STT, Speech TTS, Avatar, Content Understanding, Realtime, Voice Live) from the same config page | VERIFIED | `SERVICE_DISPLAY_NAMES` in `azure_config.py` has exactly 7 entries (line 24-32). Frontend `AZURE_SERVICES` array has 7 service cards plus database. `SERVICE_KEY_MAP` maps all 7 backend keys. Same PUT/GET/test endpoints handle all types. |
| 3 | Connection testing validates real Azure service reachability for all 7 services | VERIFIED | `test_service_connection()` dispatches to 7 branches: `test_azure_openai` (chat completion), `test_azure_speech` (voice list), `test_azure_avatar` (ICE relay token), `test_azure_voice_live` (endpoint probe), `test_azure_content_understanding` (list analyzers), `test_azure_realtime` (verify deployment). SSRF prevention via `validate_endpoint_url` with AZURE_HOST_PATTERN. 14 connection tester tests pass. |
| 4 | Dynamic provider switching: mock to Azure adapters on config save and server startup | VERIFIED | `register_adapter_from_config()` handles all 7 services (lines 45-94 of azure_config.py). main.py lifespan registers mocks first (lines 42-45), then loads DB configs (lines 74-90) calling `register_adapter_from_config`. |
| 5 | API keys stored encrypted (Fernet) in database | VERIFIED | `encryption.py` provides `encrypt_value()`/`decrypt_value()`. `config_service.upsert_config()` encrypts on save, `get_decrypted_key()` decrypts on read. 4 encryption tests + 8 config service tests pass. |
| 6 | System falls back to mock adapters when Azure not configured | VERIFIED | Lifespan registers mock adapters FIRST (lines 42-45), Azure overrides only when `api_key` is non-empty. `except Exception: pass` on DB load handles first-run gracefully. |
| 7 | Content Understanding adapter has bounded polling (max 30 attempts, 2s interval) | VERIFIED | `azure_content.py` lines 16-17: `MAX_POLL_ATTEMPTS = 30`, `POLL_INTERVAL_SECONDS = 2.0`. execute() uses for-loop with `asyncio.sleep`, handles Succeeded/Failed/Cancelled/timeout. 5 adapter tests verify success, poll failure, and HTTP error paths. |
| 8 | Realtime and Voice Live adapters exist as config-only frontend-direct services | VERIFIED | `azure_realtime.py`: `AzureRealtimeAdapter` yields ERROR "frontend-direct" + DONE. `azure_voice_live.py`: `AzureVoiceLiveAdapter` same pattern. Both have working `is_available()`. 6 adapter tests pass. |
| 9 | Voice Live supports Agent/Model mode via JSON-structured encoding with legacy colon fallback | VERIFIED | `parse_voice_live_mode()` tries JSON.loads first, falls back to colon-split, defaults to model mode. `encode_voice_live_mode()` produces JSON for agent, plain string for model. Frontend `parseVoiceLiveMode`/`encodeVoiceLiveMode` mirror exactly. 5 parse/encode tests pass. |
| 10 | Region capabilities returns per-service availability for any Azure region | VERIFIED | `region_capabilities.py`: 7 services in `ALL_SERVICE_NAMES`, `AVATAR_REGIONS` (7 regions), `VOICE_LIVE_REGIONS` (20 regions), `VOICE_LIVE_AGENT_REGIONS`. `get_region_capabilities()` normalizes to lowercase, returns availability + notes. GET `/region-capabilities/{region}` endpoint requires admin. 8 region tests + 3 API tests pass. |
| 11 | Frontend shows region availability badges with accessible icon + text (not color-only) | VERIFIED | `service-config-card.tsx` lines 149-178: regionStatus prop renders green Check badge (available), purple X badge (unavailable), gray Info badge (unknown). Each has `role="status"`, `aria-hidden="true"` on icons, `sr-only` label on status dot (line 146). |
| 12 | Voice Live card has Agent/Model mode radio toggle with structured JSON encoding | VERIFIED | `service-config-card.tsx` lines 191-229: `role="radiogroup"` with `aria-label`, two radio inputs for model/agent. Agent mode shows agentId + projectName fields (lines 294-321) with required-field validation. `handleSave` (line 102-128) uses `encodeVoiceLiveMode` producing JSON for agent mode. |
| 13 | All new UI text externalized via i18n in both en-US and zh-CN | VERIFIED | `admin.json` (en-US): regionAvailable, regionUnavailable, regionUnknown, saveConfig, voiceLive.modeLabel, voiceLive.agentMode, etc. `admin.json` (zh-CN): equivalent Chinese translations. `voice.json` updated regionUnsupported message. Hardcoded "eastus2/swedencentral" warning removed from azure-config.tsx. |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/service_config.py` | ServiceConfig ORM model | VERIFIED | TimestampMixin, api_key_encrypted, service_name, is_active |
| `backend/app/utils/encryption.py` | Fernet encrypt/decrypt | VERIFIED | 49 lines, encrypt_value/decrypt_value |
| `backend/app/schemas/azure_config.py` | Pydantic v2 schemas | VERIFIED | ServiceConfigUpdate, ServiceConfigResponse, ConnectionTestResult, RegionServiceAvailability, RegionCapabilitiesResponse |
| `backend/app/services/config_service.py` | Config CRUD with encryption | VERIFIED | 90 lines, get_all_configs, upsert_config, get_config, get_decrypted_key |
| `backend/app/services/agents/adapters/azure_openai.py` | AzureOpenAIAdapter with streaming | VERIFIED | 106 lines, BaseCoachingAdapter, streaming execute |
| `backend/app/services/agents/adapters/azure_content.py` | Content Understanding adapter | VERIFIED | 116 lines, bounded polling (30 attempts, 2s), httpx REST calls |
| `backend/app/services/agents/adapters/azure_realtime.py` | Realtime config adapter | VERIFIED | 52 lines, frontend-direct, ERROR+DONE pattern |
| `backend/app/services/agents/adapters/azure_voice_live.py` | Voice Live config adapter | VERIFIED | 129 lines, Agent/Model mode, parse/encode utilities |
| `backend/app/services/region_capabilities.py` | Region lookup module | VERIFIED | 128 lines, 7 services, AVATAR_REGIONS(7), VOICE_LIVE_REGIONS(20), LAST_VERIFIED date |
| `backend/app/services/connection_tester.py` | Real connection tests for all 7 services | VERIFIED | 210 lines, validate_endpoint_url (SSRF), 7 dispatch branches |
| `backend/app/api/azure_config.py` | Full CRUD + region capabilities API | VERIFIED | 187 lines, 7 SERVICE_DISPLAY_NAMES, register_adapter_from_config for all 7, region-capabilities endpoint |
| `backend/app/main.py` | Lifespan with DB config loading | VERIFIED | Lines 67-92: loads active configs, decrypts, calls register_adapter_from_config |
| `frontend/src/types/azure-config.ts` | TypeScript types + Voice Live encoding | VERIFIED | 89 lines, RegionCapabilities, RegionStatus, VoiceLiveMode, parseVoiceLiveMode, encodeVoiceLiveMode |
| `frontend/src/api/azure-config.ts` | Typed API client | VERIFIED | 44 lines, getServiceConfigs, updateServiceConfig, testServiceConnection, getRegionCapabilities |
| `frontend/src/hooks/use-azure-config.ts` | TanStack Query hooks | VERIFIED | useServiceConfigs, useUpdateServiceConfig, useTestServiceConnection |
| `frontend/src/hooks/use-region-capabilities.ts` | Region capabilities hook | VERIFIED | 13 lines, useRegionCapabilities with staleTime 5min, retry 1 |
| `frontend/src/pages/admin/azure-config.tsx` | Config page with 7 services + region status | VERIFIED | 190 lines, useRegionCapabilities, getRegionStatus, regionStatus prop, no hardcoded region warnings |
| `frontend/src/components/admin/service-config-card.tsx` | Config card with badges, toggle | VERIFIED | 341 lines, regionStatus prop, STATUS_DOT with unavailable/purple, Voice Live radio group, encodeVoiceLiveMode |
| `frontend/public/locales/en-US/admin.json` | i18n keys for regions, Voice Live | VERIFIED | regionAvailable, saveConfig, voiceLive.modeLabel, agentMode, agentIdRequired |
| `frontend/public/locales/zh-CN/admin.json` | Chinese translations | VERIFIED | Equivalent keys in Chinese |
| `backend/tests/test_adapters_new.py` | 3 new adapter tests | VERIFIED | 15 tests pass |
| `backend/tests/test_region_capabilities.py` | Region capability tests | VERIFIED | 8 tests pass |
| `backend/tests/test_connection_tester_extended.py` | Connection tester dispatch + URL validation | VERIFIED | 14 tests pass |
| `backend/tests/test_azure_config_api_extended.py` | API integration tests | VERIFIED | 6 tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `azure_config.py` (API) | `region_capabilities.py` | `get_region_capabilities` call | WIRED | Line 16: import, line 103: call in GET endpoint |
| `connection_tester.py` | `httpx.AsyncClient` | Real HTTP for avatar, content, realtime | WIRED | Lines 81, 106, 137: httpx.AsyncClient for ICE token, analyzers, deployment verify |
| `azure_config.py` | `AzureRealtimeAdapter` | register on config save | WIRED | Lines 71-77: import and register |
| `azure_config.py` | `AzureContentUnderstandingAdapter` | register on config save | WIRED | Lines 79-83: import and register |
| `azure_config.py` | `AzureVoiceLiveAdapter` | register on config save | WIRED | Lines 85-94: import and register |
| `main.py` | `register_adapter_from_config` | startup DB loading | WIRED | Line 68: import, line 84: call for each active config |
| `voice_live_service.py` | `VOICE_LIVE_REGIONS` | SUPPORTED_REGIONS reference | WIRED | Line 7: `from app.services.region_capabilities import VOICE_LIVE_REGIONS`, line 9: `SUPPORTED_REGIONS = VOICE_LIVE_REGIONS` |
| `azure-config.tsx` (page) | `use-region-capabilities.ts` | useRegionCapabilities hook | WIRED | Line 21: import, line 100: call with primaryRegion |
| `service-config-card.tsx` | `azure-config.ts` types | RegionStatus, parseVoiceLiveMode, encodeVoiceLiveMode | WIRED | Lines 14-16: imports used in badge rendering and Voice Live save |
| `use-region-capabilities.ts` | `azure-config.ts` (API) | getRegionCapabilities | WIRED | Line 2: import, line 7: call in queryFn |
| `connection_tester.py` | `azure_openai_realtime` dispatch | test_service_connection | WIRED | Line 206-207: azure_openai_realtime -> test_azure_realtime |
| `avatar/azure.py` | region parameter | constructor | WIRED | Line 19: `def __init__(self, endpoint, key, region="")`, line 22: `self._region = region` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `azure-config.tsx` | `savedConfigs` | `useServiceConfigs()` -> GET `/azure-config/services` | DB query via config_service.get_all_configs() | FLOWING |
| `azure-config.tsx` | `regionCaps` | `useRegionCapabilities(primaryRegion)` -> GET `/azure-config/region-capabilities/{region}` | get_region_capabilities() with hardcoded region maps | FLOWING |
| `service-config-card.tsx` | `savedConfig`, `regionStatus` | Props from parent | Derived from API queries above | FLOWING |
| `service-config-card.tsx` | `parsedVoiceLive` | `parseVoiceLiveMode(savedConfig?.model_or_deployment)` | Parses actual DB-stored model_or_deployment field | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 91 Phase 07 backend tests pass | `pytest tests/test_encryption.py tests/test_config_service.py tests/test_azure_openai_adapter.py tests/test_azure_config_api.py tests/test_adapters_new.py tests/test_region_capabilities.py tests/test_connection_tester_extended.py tests/test_azure_config_api_extended.py --tb=no -q` | 91 passed in 6.19s | PASS |
| TypeScript compiles | `npx tsc --noEmit` | Exit 0, no errors | PASS |
| Frontend build | `npm run build` | Fails: unresolved import "rt-client" in use-voice-live.ts | SKIP (pre-existing Phase 08 issue, not Phase 07) |
| SERVICE_DISPLAY_NAMES count | grep count in azure_config.py | 7 entries | PASS |
| SUPPORTED_REGIONS count | Python import check | 20 regions (from VOICE_LIVE_REGIONS) | PASS |
| Hardcoded region warning removed | grep "isUnsupported" azure-config.tsx | No matches | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLAT-03 | 07-01 through 07-07 | Admin can configure Azure service connections (OpenAI, Speech, Avatar, Content Understanding) from web UI with connection testing | SATISFIED | Full CRUD API for 7 services, real connection tests (ICE token, list analyzers, verify deployment), SSRF prevention, frontend config page with save/test/badges. 91 tests pass. |
| ARCH-05 | 07-01 through 07-06 | Azure service connections configurable per environment -- endpoints, keys, models, regions are config, not code | SATISFIED | ServiceConfig DB model stores all connection params per service, Settings has defaults, DB configs override at startup, dynamic registration via register_adapter_from_config for all 7 services. |
| COACH-04 | 07-06 | User can use voice input (Azure Speech STT) | SATISFIED | Azure STT adapter configurable via admin UI, register_adapter_from_config switches default_stt_provider to "azure", connection tester validates Speech service. |
| COACH-05 | 07-06 | AI HCP responses spoken via Azure Speech TTS | SATISFIED | Azure TTS adapter configurable via admin UI, register_adapter_from_config switches default_tts_provider to "azure", connection tester validates Speech service. |
| COACH-07 | 07-05, 07-07 | Azure AI Avatar as configurable premium option | SATISFIED | Avatar adapter accepts region param, is_available returns True when configured, ICE relay token connection test, region capabilities shows avatar availability per region, frontend badge shows available/unavailable. |
| EXT-04 | 07-05, 07-07 | Azure Voice Live API as unified premium voice+avatar path | SATISFIED | AzureVoiceLiveAdapter with Agent/Model mode, parse_voice_live_mode/encode_voice_live_mode, frontend radio toggle with JSON encoding, VOICE_LIVE_REGIONS (20 regions), Voice Live connection tester with endpoint probe. |
| PLAT-05 | 07-03 through 07-07 | Voice interaction mode configurable per deployment and per session | SATISFIED | STT/TTS/Realtime/Voice Live all configurable via admin UI, register_adapter_from_config handles all voice-related services, region capabilities identifies Voice Live Agent vs Model availability per region. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/main.py` | 91-92 | `except Exception: pass` for DB config loading | Info | Silently swallows DB errors on first run. Acceptable for bootstrap case where table may not exist. |
| `backend/app/services/agents/adapters/azure_openai.py` | 46-47 | `except ImportError: pass` for openai import | Info | Expected pattern for optional dependency. is_available() returns False when client is None. |

No blockers or warnings found.

### Human Verification Required

### 1. Region Availability Badges Visual Check

**Test:** Log in as admin, navigate to Azure Config, configure at least one service with a region (e.g., "eastus2"), expand other service cards.
**Expected:** Green check badge ("Available in eastus2") on OpenAI, Speech, Avatar. Purple X badge on services not available in region. Gray info badge if API call fails.
**Why human:** Requires running frontend+backend, visual confirmation of badge colors, icons, and text.

### 2. Voice Live Agent/Model Mode Toggle

**Test:** Expand Voice Live card, select Agent mode, fill agent_id and project_name, click Save. Then select Model mode and save again.
**Expected:** Agent mode saves JSON `{"mode":"agent","agent_id":"...","project_name":"..."}` in model_or_deployment. Model mode saves plain string. Validation prevents saving Agent mode with empty fields.
**Why human:** Requires running services and verifying saved payload format.

### 3. Real Connection Testing for All 7 Services

**Test:** Enter real Azure credentials for each service, click Test Connection.
**Expected:** OpenAI: chat completion test. Speech: voice list. Avatar: ICE relay token. Content Understanding: list analyzers. Realtime: verify deployment. Voice Live: endpoint probe. Each shows success/failure status with specific message.
**Why human:** Requires real Azure credentials and network connectivity.

### 4. Server Restart Persistence for All Services

**Test:** Configure all 7 services, stop backend, restart, verify configs load from DB.
**Expected:** All configs persist. Adapters re-register on startup. No manual reconfiguration needed.
**Why human:** Requires server lifecycle management and manual observation.

### Gaps Summary

No gaps found. All 13 observable truths verified through code inspection and automated testing:

1. **Plans 01-04 (previously verified):** ServiceConfig model, encryption, config service, Azure OpenAI adapter, API CRUD, connection testing, dynamic provider switching, frontend config page -- all re-confirmed with 41 original tests passing.

2. **Plan 05 (new adapters):** Content Understanding adapter with bounded polling (30 attempts, 2s), Realtime and Voice Live as config-only frontend-direct services, region capabilities module with 7 services across 20+ regions -- 4 new files, verified substantive and passing ruff check.

3. **Plan 06 (wiring):** Connection tester upgraded to real API calls for all 7 services, SSRF prevention via AZURE_HOST_PATTERN, region-capabilities endpoint, azure_openai_realtime accepted by PUT, SUPPORTED_REGIONS expanded to 20+, new adapters register on startup and save -- 50 new tests pass.

4. **Plan 07 (frontend UX):** Region badges with accessible icon+text (Check/X/Info), Voice Live Agent/Model radio toggle with JSON encoding and field validation, purple unavailable status dot, hardcoded region warning removed, all text externalized in en-US and zh-CN i18n -- TypeScript compiles, all UI patterns verified in code.

**Note on build:** `npm run build` fails due to unresolved `rt-client` import in `use-voice-live.ts`, which was introduced by Phase 08 commit (744b449), not Phase 07. TypeScript compilation (`tsc --noEmit`) passes cleanly.

---

_Verified: 2026-03-27T15:00:00Z_
_Verifier: Claude (gsd-verifier)_

</details>

