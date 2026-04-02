# Phase 12: Voice Realtime API & Agent Mode Integration - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend HCP profiles to be complete "digital persona" configurations — each HCP stores Voice Live API settings (voice name, conversation parameters) and Avatar settings (character, custom avatar) alongside the existing AI Foundry Agent. When an MR selects an HCP and starts a session, the system auto-configures the voice connection with per-HCP settings and defaults to Digital Human Realtime Agent mode with automatic fallback to voice-only or text.

</domain>

<decisions>
## Implementation Decisions

### HCP Voice/Avatar Configuration Scope
- **D-01:** Full Voice Live settings stored per HCP profile: voice name, avatar character/style, temperature, turn detection (Server VAD), noise suppression, echo cancellation, EOU detection, recognition language, custom voice toggle, custom avatar toggle
- **D-02:** Agent instructions are auto-generated from HCP personality fields but admin can view and override the generated text in the HCP editor
- **D-03:** Avatar supports both predefined Azure Avatar characters (Lisa, Lori, Harry, etc. in dropdown) and custom avatars (character name with `customized: true` toggle) — matching reference repo pattern
- **D-04:** New HCPs get smart defaults: voice "Ava", avatar "Lori-casual", temp 0.9, Server VAD, noise suppression off, echo cancellation off, EOU detection disabled, recognition language "Auto Detect". Admin can override per-HCP

### Admin UX — HCP Editor Redesign
- **D-05:** HCP editor uses tabbed layout with 3 tabs: "Profile" (existing personality/specialty/objections fields), "Voice & Avatar" (voice name, avatar character, conversation parameters), "Agent" (auto-generated + editable instructions text, agent sync status)
- **D-06:** HCP table adds a Voice+Avatar column showing voice name + avatar character as badges (e.g. "Ava / Lori-casual") or "Not configured" if missing
- **D-07:** Table maintains existing columns from Phase 11 (Name, Specialty, Personality, Agent Status) plus new Voice+Avatar column

### Session Wiring
- **D-08:** Token broker API returns all HCP voice/avatar settings (voice name, avatar character, conversation params) alongside auth token/endpoint. Frontend auto-configures WebSocket and Avatar connection from this single response
- **D-09:** MR cannot override HCP voice/avatar settings during a session — settings are locked per-HCP for consistent experience

### Mode Simplification & Fallback
- **D-10:** Default to Digital Human Realtime Agent mode (best experience). MR does NOT see a mode picker — system auto-selects based on HCP config and service availability
- **D-11:** Fallback chain: Digital Human Realtime Agent → Voice-only Realtime → Text mode. Triggered when avatar service unavailable or network degraded
- **D-12:** Fallback notification: toast alert for the initial fallback event ("Avatar unavailable, switching to voice mode") PLUS persistent status indicator showing current active mode throughout the session

### Claude's Discretion
- Exact DB column types and migration details for new HCP voice/avatar fields
- Default avatar/voice options list (can derive from Azure documentation)
- Tab component implementation details (reuse existing Tabs from UI library)
- WebSocket reconnection strategy on network recovery
- Status indicator component design

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference Implementation
- User's screenshot of Voice Live Agent demo — shows full settings panel (Instructions, Connection Settings, Conversation Settings, Voice, Avatar) with Digital Human avatar rendering and chat

### HCP Profile Model & API (Phase 11 output)
- `backend/app/models/hcp_profile.py` — HcpProfile ORM model (extend with voice/avatar fields)
- `backend/app/schemas/hcp_profile.py` — HcpProfileCreate/Update/Response schemas (extend)
- `backend/app/api/hcp_profiles.py` — HCP profile CRUD router
- `backend/app/services/hcp_profile_service.py` — HCP profile service layer
- `backend/app/services/agent_sync_service.py` — Agent sync (extend to sync voice/avatar config)

### Voice Live Infrastructure (Phase 08/09 output)
- `backend/app/services/voice_live_service.py` — Token broker (extend to return per-HCP voice/avatar settings)
- `backend/app/schemas/voice_live.py` — VoiceLiveTokenResponse (extend with voice/avatar fields)
- `backend/app/services/agents/adapters/azure_voice_live.py` — Agent/Model mode parse/encode
- `backend/app/api/voice_live.py` — Voice Live API routes

### Frontend Voice Components (Phase 08 output)
- `frontend/src/hooks/use-voice-live.ts` — RTClient WebSocket hook (consume per-HCP settings)
- `frontend/src/hooks/use-avatar-stream.ts` — Avatar WebRTC hook (consume per-HCP avatar config)
- `frontend/src/components/voice/voice-session.tsx` — VoiceSession container
- `frontend/src/components/voice/mode-selector.tsx` — Current mode selector (replace with auto-mode + fallback)
- `frontend/src/components/voice/avatar-view.tsx` — Avatar renderer

### Frontend Admin (Phase 11 output)
- `frontend/src/pages/admin/hcp-profiles.tsx` — HCP profiles admin page (add tabs)
- `frontend/src/pages/admin/hcp-profile-editor.tsx` — HCP editor (extend with tabs)
- `frontend/src/components/admin/hcp-table.tsx` — HCP table (add Voice+Avatar column)
- `frontend/src/types/hcp.ts` — HCP TypeScript types (extend)

### Config & Auth
- `backend/app/services/config_service.py` — AI Foundry unified config
- `backend/app/services/connection_tester.py` — Connection testing patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HcpProfile` model already has `agent_id`, `agent_sync_status` fields from Phase 11 — extend with voice/avatar columns
- `agent_sync_service.py` — Pattern for auto-syncing on HCP CRUD, reuse for voice/avatar validation
- `VoiceLiveTokenResponse` — Already returns endpoint, api_key, agent_id — extend with voice/avatar settings
- `Tabs` component in UI library — reuse for HCP editor tabbed layout
- `useVoiceLive` hook — Already handles WebSocket connection, needs to accept per-HCP conversation params
- `useAvatarStream` hook — Already handles WebRTC, needs to accept per-HCP avatar character
- `mode-selector.tsx` — Has the 7-mode mapping, will be replaced by auto-mode logic

### Established Patterns
- Per-domain TanStack Query hooks with mutation invalidation
- Alembic migration with `server_default` for SQLite compatibility
- i18n namespaces per domain (admin, voice)
- Token broker pattern: backend generates config, frontend consumes directly
- Full-screen session pages without UserLayout

### Integration Points
- HcpProfile model → add ~12 new columns for voice/avatar settings
- Token broker → extend response to include all voice/avatar params from HCP
- VoiceSession container → consume per-HCP settings instead of global config
- Mode selector → replace with auto-mode + fallback chain logic
- HCP editor page → add tabbed layout with Voice & Avatar tab
- HCP table → add Voice+Avatar column

</code_context>

<specifics>
## Specific Ideas

- Reference implementation screenshot shows the exact settings panel: Instructions, Connection Settings, Conversation Settings (Recognition Language, Noise suppression, Echo cancellation, Turn detection, EOU detection, Temperature), Voice (custom voice toggle, voice name), Avatar (toggle, custom avatar toggle, character)
- Each HCP becomes a complete "digital persona" — personality + voice + appearance
- Smart defaults mean new HCPs work immediately for demo without manual configuration
- Fallback chain matches the user's note: "voice+avatar as default, fallback to voice or text if service unavailable or network bad"
- Token broker is the single integration point — frontend gets everything it needs in one call

</specifics>

<deferred>
## Deferred Ideas

- Developer mode toggle for MRs to override HCP settings during debug sessions — future enhancement
- Per-session provider override — always use HCP-level config for now
- Azure AD token auth (DefaultAzureCredential) for Entra token acquisition — future phase
- Multiple avatar characters per HCP (wardrobe selection) — future enhancement
- Voice cloning / custom neural voice training — future phase

</deferred>

---

*Phase: 12-voice-realtime-api-agent*
*Context gathered: 2026-04-02*
