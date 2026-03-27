# Phase 07: Azure Service Integration - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning
**Source:** Conversation analysis of existing codebase gaps

<domain>
## Phase Boundary

Connect the existing Admin Azure Config UI to real backend persistence and service switching. The frontend pages (`azure-config.tsx`, `service-config-card.tsx`) and backend read APIs (`azure_config.py`) already exist but are disconnected — `onSave` only updates React state, `onTestConnection` is a fake `Math.random()`, and there's no PUT endpoint to persist configurations. This phase bridges those gaps and adds real Azure OpenAI/Speech adapter implementations so F2F coaching can use real AI services when configured.

**In scope:**
- Backend: Configuration persistence model (DB), CRUD API for service configs, real connection testing
- Backend: Azure OpenAI adapter for LLM (real coaching conversations)
- Backend: Azure Speech STT/TTS adapters (voice input/output)
- Backend: Azure Avatar adapter placeholder (configuration only, actual rendering is frontend)
- Backend: Dynamic adapter switching based on persisted config (mock ↔ real)
- Frontend: Wire `onSave` to call backend PUT API
- Frontend: Wire `onTestConnection` to call backend POST /test endpoint
- Frontend: Show real connection status (active/inactive/error) from backend

**Out of scope:**
- Frontend Avatar rendering/WebRTC (future phase)
- Azure Content Understanding integration (future phase)
- Azure OpenAI Realtime audio streaming (future phase)
- New UI pages (existing `azure-config.tsx` is sufficient)

</domain>

<decisions>
## Implementation Decisions

### Configuration Persistence
- Store Azure service configs in a new `service_config` database table (not `.env` files)
- Config model: service_name, endpoint, api_key (encrypted), model/deployment, region, is_active, updated_by
- API keys must be encrypted at rest using Fernet symmetric encryption
- On server startup, load active configs from DB and register corresponding adapters

### API Design
- `PUT /api/v1/azure-config/services/{service_name}` — Create/update service configuration
- `POST /api/v1/azure-config/services/{service_name}/test` — Real connection test (not just format validation)
- `GET /api/v1/azure-config/services` — Already exists, enhance to read from DB
- All endpoints require admin role

### Azure OpenAI Adapter
- Implement `AzureOpenAIAdapter` extending `BaseCoachingAdapter`
- Use `openai` SDK with Azure configuration (already a dependency)
- Support streaming responses via SSE (matching existing mock adapter pattern)
- Register under category "llm" with name "azure_openai"

### Azure Speech Adapters
- Implement `AzureSpeechSTTAdapter` and `AzureSpeechTTSAdapter`
- Use Azure Speech SDK (add `azure-cognitiveservices-speech` dependency)
- Register under categories "stt" and "tts"

### Dynamic Provider Switching
- On config save: re-register the adapter in ServiceRegistry
- Update `default_llm_provider`/`default_stt_provider`/`default_tts_provider` in runtime settings
- Sessions created after config change use new provider; existing sessions continue with their current provider
- Fallback to mock if configured service fails health check

### Frontend Integration
- `ServiceConfigCard.onSave` → `PUT /api/v1/azure-config/services/{key}`
- `ServiceConfigCard.onTestConnection` → `POST /api/v1/azure-config/services/{key}/test`
- Display real status from `GET /services` response
- Show toast notifications on save/test success/failure (already using `sonner`)

### Claude's Discretion
- Encryption key management approach (env var vs config)
- Exact error messages for connection test failures
- Retry/timeout strategy for Azure API calls
- Whether to add a "Reset to Mock" button per service

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — Existing Azure Config
- `backend/app/api/azure_config.py` — Current read-only API (GET /services, POST /test stub)
- `backend/app/api/config.py` — Feature flags and adapter listing endpoint
- `backend/app/config.py` — pydantic-settings with Azure env vars (lines 24-52)

### Backend — Adapter Framework
- `backend/app/services/agents/base.py` — BaseCoachingAdapter ABC, CoachRequest/CoachEvent dataclasses
- `backend/app/services/agents/adapters/mock.py` — MockCoachingAdapter (reference implementation)
- `backend/app/services/agents/registry.py` — ServiceRegistry singleton
- `backend/app/api/sessions.py` — SSE streaming endpoint (uses adapter.execute())

### Backend — Models & DB
- `backend/app/models/base.py` — Base, TimestampMixin (all models must use)
- `backend/app/database.py` — Async engine, session factory
- `backend/alembic/` — Migration directory

### Frontend — Azure Config UI
- `frontend/src/pages/admin/azure-config.tsx` — Azure config page (7 service cards)
- `frontend/src/components/admin/service-config-card.tsx` — Reusable config card component
- `frontend/src/router/index.tsx` — Route registration (already registered)

### Frontend — API Layer
- `frontend/src/api/client.ts` — Axios instance with JWT interceptor

</canonical_refs>

<specifics>
## Specific Ideas

- The `openai` Python SDK (already installed, >=1.50.0) supports Azure OpenAI via `AzureOpenAI` client class — no new dependency needed for LLM
- Azure Speech SDK (`azure-cognitiveservices-speech`) is the only new Python dependency needed
- Existing `MockCoachingAdapter.execute()` returns `AsyncIterator[CoachEvent]` — Azure adapter must match this interface exactly
- `ServiceConfigCard` already has status dot (green/gray/red/yellow) — just needs real data
- Frontend already uses `sonner` for toast notifications — reuse for save/test feedback
- Existing `AZURE_SERVICES` array in `azure-config.tsx` defines 7 services but we only need to implement 4 for this phase: Azure OpenAI, Speech STT, Speech TTS, Avatar

</specifics>

<deferred>
## Deferred Ideas

- Azure Content Understanding adapter (document analysis)
- Azure OpenAI Realtime adapter (real-time audio streaming)
- Azure Database for PostgreSQL configuration from UI (handled by deployment config)
- Avatar WebRTC rendering in frontend
- Per-session provider override (always use deployment-wide config for now)

</deferred>

---

*Phase: 07-azure-service-integration*
*Context gathered: 2026-03-27 via conversation analysis*
