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
