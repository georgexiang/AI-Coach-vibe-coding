# Phase 11: HCP Profile Agent Integration - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

When admin creates/updates/deletes an HCP profile, the system automatically syncs a corresponding AI Foundry Agent. Digital Human Realtime Agent mode uses the HCP's agent_id to drive conversations. HCP profiles admin page is redesigned to table format with Agent sync status.

</domain>

<decisions>
## Implementation Decisions

### Agent Sync Lifecycle
- **D-01:** Full bidirectional sync — HCP profile create → create AI Foundry Agent, update → update Agent instructions, delete → delete Agent
- **D-02:** Agent creation/update/delete happens automatically on HCP profile save/delete — no manual sync step
- **D-03:** Store `agent_id` (returned from AI Foundry) on HCP profile model for session wiring
- **D-04:** Track sync status per HCP: `synced`, `pending`, `failed`, `none` — persisted in DB

### Agent Instructions Generation
- **D-05:** Template-based instruction generation from HCP profile fields (name, specialty, personality, communication_style, objections, knowledge_background)
- **D-06:** Template is a configurable string with `{field}` placeholders — admin can customize the template (store in ServiceConfig or dedicated table)
- **D-07:** Agent instructions contain HCP personality only — scenario/product context injected at session start time via system prompt, not baked into Agent

### Admin UX — HCP Table Redesign
- **D-08:** HCP profiles page redesigned from card grid to **table format**
- **D-09:** Table columns: Name, Specialty, Personality, Communication Style, Agent Status (badge: synced/failed/pending/none), Actions (edit/delete)
- **D-10:** Agent creation is automatic with status badge — no extra clicks. On save, background sync fires and badge updates
- **D-11:** Failed sync shows error details on hover/click, with retry option

### Mode Selector Wiring
- **D-12:** Digital Human Realtime Agent mode looks up `agent_id` from the session's HCP profile — token broker returns it automatically. No user selection of Agent needed
- **D-13:** If HCP has no `agent_id` (sync failed or not yet synced), Realtime Agent mode option is **disabled/grayed out** in the mode selector with tooltip explaining why
- **D-14:** Token broker (`get_voice_live_status`) already returns `agent_id` — extend it to source from HCP profile's `agent_id` field based on selected scenario's HCP

### Claude's Discretion
- Agent instruction template default content (exact wording)
- Error retry strategy for failed AI Foundry API calls (exponential backoff vs fixed retry)
- Table pagination/sorting implementation details
- Loading skeleton design for table

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### HCP Profile Model & API
- `backend/app/models/__init__.py` — HcpProfile ORM model (add agent_id, agent_sync_status fields)
- `backend/app/schemas/hcp_profile.py` — HcpProfileCreate, HcpProfileUpdate, HcpProfileResponse schemas
- `backend/app/api/hcp_profiles.py` — HCP profile CRUD router (add sync hooks)
- `backend/app/services/session_service.py` — Session lifecycle (wires HCP to session)

### AI Foundry Config & Voice Live
- `backend/app/services/config_service.py` — AI Foundry unified config service (endpoint/key/region)
- `backend/app/services/voice_live_service.py` — Token broker, parse_voice_live_mode, agent_id sourcing
- `backend/app/schemas/voice_live.py` — VoiceLiveStatus schema (agent_id field)
- `backend/app/services/connection_tester.py` — Connection test patterns for Azure services

### Frontend Admin Pages
- `frontend/src/pages/admin/azure-config.tsx` — AI Foundry admin config page pattern
- `frontend/src/types/azure-config.ts` — AI Foundry TypeScript types
- `frontend/src/hooks/use-azure-config.ts` — AI Foundry TanStack Query hooks pattern

### Azure AI Foundry Agent API
- Azure AI Agent Service REST API docs — Agent CRUD operations (create/update/delete/list)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/config_service.py` — ConfigService with get_effective_endpoint/key for AI Foundry unified config. Agent API calls can reuse this to get endpoint/key
- `backend/app/services/voice_live_service.py` — parse_voice_live_mode already extracts agent_id. Extend to source from HCP profile
- `backend/app/schemas/hcp_profile.py` — Existing HcpProfileCreate/Update/Response schemas. Add agent_id and agent_sync_status fields
- `frontend/src/components/admin/service-config-card.tsx` — Admin card pattern with status badges (reuse badge patterns for agent sync status)
- `backend/scripts/seed_phase2.py` — Seed HCP profiles (update to include agent_id for synced demo data)

### Established Patterns
- Service layer pattern: business logic in `services/*.py`, routers delegate (D-01 sync logic goes in a new `agent_sync_service.py`)
- Alembic migration with `server_default` for SQLite compatibility (for new agent_id/status columns)
- TanStack Query hooks per domain with mutation invalidation (for HCP CRUD with sync)
- i18n namespace per domain (add `admin` namespace entries for agent status labels)

### Integration Points
- HCP profile CRUD router → add post-save/post-delete hooks that call agent_sync_service
- Token broker (voice_live_service) → source agent_id from HCP profile instead of/in addition to model_or_deployment parsing
- Mode selector frontend → check HCP's agent_sync_status to enable/disable Realtime Agent option
- Admin HCP page → full rewrite from cards to table

</code_context>

<specifics>
## Specific Ideas

- User example: "Dr. Zhang Wei" HCP profile → creates "Dr. Zhang Wei" Agent in AI Foundry default project
- Agent name should match HCP profile name exactly for clarity in AI Foundry console
- Digital Human mode (数字人) is the primary consumer of per-HCP Agents

</specifics>

<deferred>
## Deferred Ideas

- Bulk agent sync for all existing HCPs (migration tool) — could be a one-time script
- Agent versioning/rollback in AI Foundry — future phase
- Agent analytics/usage tracking from AI Foundry — future phase

</deferred>

---

*Phase: 11-hcp-profile-agent-integration*
*Context gathered: 2026-03-31*
