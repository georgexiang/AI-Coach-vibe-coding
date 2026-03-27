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
