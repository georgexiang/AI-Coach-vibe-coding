# Phase 13: Voice Live Instance & Agent Voice Management - Research

**Researched:** 2026-04-03
**Domain:** Azure Voice Live instance management, Agent voice mode configuration, AI Foundry portal workflow automation
**Confidence:** HIGH

## Summary

Phase 13 aims to provide admin-level management of Voice Live instances (model selection) and Agent voice mode configuration, matching the AI Foundry portal's end-to-end workflow. The critical discovery from research is that Azure Voice Live is a **fully managed service with no separate "instance" REST API**. There is no Azure REST endpoint to "create a Voice Live instance" or "bind Voice Live to an agent" -- these are UI-only concepts in the AI Foundry portal that translate to:

1. **Model selection**: The generative AI model (gpt-4o, gpt-4.1, gpt-5, etc.) is specified as a query parameter at WebSocket connection time. The "instance" is the active WebSocket session itself.
2. **Bind to agent**: Writing `microsoft.voice-live.configuration` metadata on the agent (already implemented in `agent_sync_service.py` via `build_voice_live_metadata()`).
3. **Enable Voice mode**: Presence of the `microsoft.voice-live.configuration` metadata key on the agent signals that voice mode is enabled.
4. **Speech/Avatar config**: Stored as JSON in the agent metadata, sent to Voice Live API via `session.update` at connection time.

The existing codebase (Phase 11-12) already implements items 2-4 via `build_voice_live_metadata()` and per-HCP token broker. What Phase 13 adds is: (a) explicit admin UI for selecting the Voice Live generative AI model per-HCP, (b) a dedicated Voice Live management page showing the full HCP-to-Voice-Live binding chain, (c) upgrading `azure-ai-projects` from `1.0.0b12` to `2.0.1` (the stable release), and (d) comprehensive testing of the automated full chain.

**Primary recommendation:** Since no new Azure APIs need to be called (Voice Live has no instance management API), this phase is primarily a UI/UX enhancement phase: add model selection to HCP profiles, build a Voice Live management overview admin page, and ensure the existing agent metadata sync covers all Voice Live configuration fields.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOICE-13-01 | Admin can create/manage Voice Live instances (select generative AI model) | No separate API for "instances" -- model selection is a config choice stored per-HCP and sent as WebSocket param. Add `voice_live_model` column to HCP profile, admin selects from supported model list. |
| VOICE-13-02 | Admin can bind Voice Live to HCP Agents | Already implemented via `build_voice_live_metadata()` in `agent_sync_service.py`. Phase 13 adds admin UI visibility: show binding status on management page, allow re-binding. |
| VOICE-13-03 | Admin can enable Voice mode on agents and configure speech input/output/avatar parameters | Per-HCP voice/avatar/speech config already stored (Phase 12). Voice mode toggle = `voice_live_enabled` flag. Phase 13 adds management overview showing enabled/disabled status per HCP. |
| VOICE-13-04 | Platform automates HCP Profile -> Agent -> Voice Live -> Voice mode -> Speech/Avatar config chain | Automation exists in `sync_agent_for_profile()`. Phase 13 adds: (a) model selection in the chain, (b) admin visibility of the full chain status, (c) batch re-sync capability. |
| VOICE-13-05 | Matching AI Foundry portal workflow end-to-end | Admin management page mirrors AI Foundry portal steps: model selection, agent binding status, voice mode status, speech/avatar config summary per HCP. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| azure-ai-projects | 2.0.1 | Agent CRUD with metadata (stable release) | Project standard, currently on 1.0.0b12 -- must upgrade |
| SQLAlchemy 2.0 (async) | >=2.0.0 | ORM model extension for voice_live_model field | Already in use |
| Alembic | >=1.13.0 | Migration for new voice_live_model column | Required by project rules |
| Pydantic v2 | >=2.0.0 | Schema extension | Already in use |
| @azure/ai-voicelive | 1.0.0-beta.3 | Frontend Voice Live SDK | Already installed |
| React 18 + TypeScript | strict | Admin management UI | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TanStack Query v5 | ^5.60.0 | Server state for management page queries | Admin page data fetching |
| react-i18next | existing | i18n for new admin UI text | All new UI strings |
| sonner | existing | Toast notifications for sync operations | Batch re-sync feedback |
| lucide-react | >=0.460.0 | Icons for management page | Status indicators |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-HCP model column | Global model config only | Global is simpler but doesn't match AI Foundry portal where each agent can have a different model |
| Management overview page | Extend existing HCP table | Separate page provides clearer workflow visualization matching AI Foundry portal steps |

**Installation:**
```bash
# Backend -- upgrade azure-ai-projects to stable 2.0.1
cd backend
pip install "azure-ai-projects>=2.0.1"

# Frontend -- no new packages needed
```

**Version verification:**
- `azure-ai-projects`: Currently installed `1.0.0b12`, must upgrade to `2.0.1` (verified via `pip index versions`)
- All other packages already installed from previous phases

## Architecture Patterns

### Recommended Project Structure

```
backend/
  alembic/versions/
    k14a_add_voice_live_model_to_hcp_profile.py   # NEW: migration
  app/
    models/hcp_profile.py                          # EXTEND: voice_live_model column
    schemas/hcp_profile.py                         # EXTEND: voice_live_model field
    schemas/voice_live.py                          # EXTEND: model list response
    services/voice_live_service.py                 # EXTEND: per-HCP model in token
    services/agent_sync_service.py                 # EXTEND: model in metadata, SDK upgrade compat
    api/voice_live.py                              # EXTEND: management endpoints
    api/hcp_profiles.py                            # NO CHANGE (already handles all fields)

frontend/
  src/
    types/hcp.ts                                   # EXTEND: voice_live_model field
    types/voice-live.ts                            # EXTEND: model list type
    pages/admin/voice-live-management.tsx           # NEW: Voice Live management overview page
    components/admin/voice-live-chain-card.tsx      # NEW: Per-HCP chain status card
    components/admin/voice-avatar-tab.tsx           # EXTEND: model selection dropdown
    hooks/use-voice-live-management.ts              # NEW: TanStack Query hooks for management
    api/voice-live.ts                              # EXTEND: management API calls
    public/locales/en-US/admin.json                # EXTEND: management page strings
    public/locales/zh-CN/admin.json                # EXTEND: management page strings
```

### Pattern 1: Voice Live Model Selection per HCP

**What:** Each HCP profile stores the generative AI model to use for Voice Live sessions. This model is passed as a query parameter when connecting the WebSocket.
**When to use:** Admin configures per-HCP Voice Live settings.
**Example:**
```python
# Source: Azure Voice Live docs -- model is a WebSocket connection parameter
# wss://<resource>.services.ai.azure.com/voice-live/realtime?api-version=2025-10-01&model=gpt-4.1

# HCP profile stores the model choice
voice_live_model: Mapped[str] = mapped_column(
    String(50), default="gpt-4o"
)  # gpt-4o, gpt-4.1, gpt-5, gpt-realtime, phi4-mini, etc.
```

### Pattern 2: AI Foundry Workflow Chain Visualization

**What:** Admin page showing the 4-step workflow chain for each HCP: Profile -> Agent -> Voice Live Config -> Speech/Avatar.
**When to use:** Voice Live management admin page.
**Example:**
```typescript
// Each HCP shows its chain status:
// Step 1: HCP Profile (always exists)
// Step 2: Agent (synced/pending/failed/none)
// Step 3: Voice Live Config (voice_live_enabled + model selection)
// Step 4: Speech/Avatar (voice_name + avatar_character configured)
interface ChainStatus {
  hcpId: string;
  hcpName: string;
  agentStatus: "synced" | "pending" | "failed" | "none";
  agentId: string;
  voiceLiveEnabled: boolean;
  voiceLiveModel: string;
  voiceName: string;
  avatarCharacter: string;
  avatarStyle: string;
}
```

### Pattern 3: Batch Agent Re-sync with Updated Metadata

**What:** Admin can trigger batch re-sync of all HCP agents to update Voice Live metadata after changing model or config.
**When to use:** After changing Voice Live model for multiple HCPs, or after SDK upgrade.
**Example:**
```python
# Source: Existing sync_agent_for_profile() pattern in agent_sync_service.py
async def batch_resync_agents(
    db: AsyncSession,
    hcp_profile_ids: list[str] | None = None,
) -> dict:
    """Re-sync all (or selected) HCP agents with current metadata.

    Useful after changing Voice Live model settings or upgrading SDK.
    Returns summary of results: {synced: N, failed: N, errors: [...]}
    """
    # Prefetch config once for all profiles
    endpoint, api_key, model = await prefetch_sync_config(db)
    results = {"synced": 0, "failed": 0, "errors": []}
    # ... iterate profiles and call sync_agent_for_profile()
```

### Anti-Patterns to Avoid
- **Creating a separate "Voice Live Instance" table:** Azure has no concept of persistent instances -- Voice Live is session-based. Store the model choice on the HCP profile.
- **Calling a non-existent "create Voice Live instance" API:** No such API exists. The portal UI creates the WebSocket session on-demand.
- **Ignoring the SDK version upgrade:** The installed `1.0.0b12` is a beta; `2.0.1` is stable with breaking changes to the agent API surface.
- **Storing model config globally only:** Each HCP can use a different model in the AI Foundry portal. Per-HCP model selection is required.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Voice Live model list | Hardcoded incomplete list | Const from Azure docs (12 models) | Official list with pricing tiers |
| Agent metadata sync | Direct REST calls | `agent_sync_service.sync_agent_for_profile()` | Already handles create/update with metadata |
| Voice Live config JSON | Manual JSON construction | `build_voice_live_metadata()` | Already builds the microsoft.voice-live.configuration JSON |
| Chain status visualization | Custom complex component | Card grid with status badges | Simple, reuses existing badge/card patterns |
| Admin page routing | New router config | Add to existing admin routes | Follow existing admin page pattern |

## Common Pitfalls

### Pitfall 1: azure-ai-projects SDK Upgrade Breaking Changes (1.0.0b12 -> 2.0.1)
**What goes wrong:** The `agent_sync_service.py` uses `client.agents.create_version()`, `client.agents.get()`, `client.agents.delete()` which may have different signatures in v2.0.1.
**Why it happens:** The project is on beta `1.0.0b12` but the memory says `>=2.0.1`. The stable release `2.0.1` may have different class/method names.
**How to avoid:** Before upgrading, check the v2.0 migration guide. Test `create_version`, `get`, `delete` methods against the new API surface. The `PromptAgentDefinition` import path may change.
**Warning signs:** ImportError or AttributeError on server startup after pip upgrade.

### Pitfall 2: Voice Live Model vs Agent model Confusion
**What goes wrong:** The Voice Live model (e.g., `gpt-4.1`) is confused with the Agent model (e.g., `gpt-4o` used for agent instructions). These are different.
**Why it happens:** The `ServiceConfig.model_or_deployment` for `azure_voice_live` already stores a model/agent-mode config. The agent's own model (set in `PromptAgentDefinition`) is separate from the Voice Live WebSocket model.
**How to avoid:** Voice Live model is the model parameter passed in the WebSocket URL. In agent mode, the agent already has its own LLM model. The Voice Live model may be used for non-agent sessions or as the orchestration model. Store as `voice_live_model` on HCP profile separately from the agent's `model` field.
**Warning signs:** Admin selects gpt-4.1 for Voice Live but the agent still uses gpt-4o for its own responses.

### Pitfall 3: Agent Mode Does Not Use Model Parameter
**What goes wrong:** When connecting in agent mode, the `model` query parameter is not used -- the agent's own model is used instead. Passing both `model` and `agent_id` may cause errors.
**Why it happens:** Azure Voice Live docs say: "The only difference is the required `model` query parameter, or, when using the Agent service, the `agent_id` and `project_id` parameters." This is an either/or -- not both.
**How to avoid:** When HCP has a synced agent (`agent_id`), use agent mode (no `model` param). When HCP has no agent, use model mode with the selected `voice_live_model`. The token broker already handles this distinction.
**Warning signs:** WebSocket connection fails with "invalid parameters" when both model and agent_id are provided.

### Pitfall 4: Metadata Value Size Limit (512 chars)
**What goes wrong:** Agent metadata values are limited to 512 characters per key. Complex Voice Live config JSON may exceed this.
**Why it happens:** Azure AI agent metadata has a 512-character value limit.
**How to avoid:** Already handled by `_chunk_metadata_value()` in `agent_sync_service.py`, which splits long values into key, key.1, key.2, etc.
**Warning signs:** Agent creation/update fails with metadata size error.

### Pitfall 5: SQLite Batch Alter for New Column
**What goes wrong:** Alembic migration fails on SQLite when adding the `voice_live_model` column.
**Why it happens:** Standard project gotcha -- SQLite needs `batch_alter_table` with `server_default`.
**How to avoid:** Use `with op.batch_alter_table("hcp_profiles") as batch_op:` with `server_default=sa.text("'gpt-4o'")`.
**Warning signs:** Migration fails locally on SQLite but works on PostgreSQL.

## Code Examples

### Voice Live Supported Models (from Azure docs)
```python
# Source: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live
# Verified: 2026-04-03, docs updated 2026-02-04

VOICE_LIVE_MODELS = {
    # Pro tier
    "gpt-realtime": {"tier": "pro", "description": "GPT real-time + Azure TTS"},
    "gpt-4o": {"tier": "pro", "description": "GPT-4o + Azure STT/TTS"},
    "gpt-4.1": {"tier": "pro", "description": "GPT-4.1 + Azure STT/TTS"},
    "gpt-5": {"tier": "pro", "description": "GPT-5 + Azure STT/TTS"},
    "gpt-5-chat": {"tier": "pro", "description": "GPT-5 chat + Azure STT/TTS"},
    # Basic tier
    "gpt-realtime-mini": {"tier": "basic", "description": "GPT mini real-time + Azure TTS"},
    "gpt-4o-mini": {"tier": "basic", "description": "GPT-4o mini + Azure STT/TTS"},
    "gpt-4.1-mini": {"tier": "basic", "description": "GPT-4.1 mini + Azure STT/TTS"},
    "gpt-5-mini": {"tier": "basic", "description": "GPT-5 mini + Azure STT/TTS"},
    # Lite tier
    "gpt-5-nano": {"tier": "lite", "description": "GPT-5 nano + Azure STT/TTS"},
    "phi4-mm-realtime": {"tier": "lite", "description": "Phi4-mm realtime + Azure TTS"},
    "phi4-mini": {"tier": "lite", "description": "Phi4-mini + Azure STT/TTS"},
}
```

### Frontend Model Selection Dropdown
```typescript
// Source: Azure Voice Live overview docs, organized by pricing tier
const VOICE_LIVE_MODEL_OPTIONS = [
  // Pro tier
  { value: "gpt-realtime", label: "GPT Realtime", tier: "pro" },
  { value: "gpt-4o", label: "GPT-4o", tier: "pro" },
  { value: "gpt-4.1", label: "GPT-4.1", tier: "pro" },
  { value: "gpt-5", label: "GPT-5", tier: "pro" },
  { value: "gpt-5-chat", label: "GPT-5 Chat", tier: "pro" },
  // Basic tier
  { value: "gpt-realtime-mini", label: "GPT Realtime Mini", tier: "basic" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", tier: "basic" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", tier: "basic" },
  { value: "gpt-5-mini", label: "GPT-5 Mini", tier: "basic" },
  // Lite tier
  { value: "gpt-5-nano", label: "GPT-5 Nano", tier: "lite" },
  { value: "phi4-mm-realtime", label: "Phi4-MM Realtime", tier: "lite" },
  { value: "phi4-mini", label: "Phi4 Mini", tier: "lite" },
] as const;
```

### Token Broker Model Resolution
```python
# Source: Extend existing voice_live_service.py
# In model mode: use HCP's voice_live_model (default "gpt-4o")
# In agent mode: model is NOT sent (agent has its own model)

# In get_voice_live_token():
if is_agent:
    # Agent mode: no model param needed -- agent has its own LLM
    model_for_session = ""
else:
    # Model mode: use HCP-level or global config model
    model_for_session = (
        profile.voice_live_model
        if hcp_profile_id and profile
        else mode_info.get("model", "gpt-4o")
    )
```

### Voice Live Management Admin Page Chain Card
```typescript
// Each HCP shows its full chain status
// Reuses existing Card, Badge, and cn() patterns
<Card>
  <CardHeader>
    <CardTitle>{hcp.name} - {hcp.specialty}</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex items-center gap-3">
      {/* Step 1: Agent */}
      <Badge variant={agentOk ? "default" : "destructive"}>
        Agent: {hcp.agent_sync_status}
      </Badge>
      {/* Step 2: Voice Live */}
      <Badge variant={hcp.voice_live_enabled ? "default" : "secondary"}>
        Voice: {hcp.voice_live_enabled ? hcp.voice_live_model : "Disabled"}
      </Badge>
      {/* Step 3: Speech */}
      <Badge variant="outline">
        {hcp.voice_name}
      </Badge>
      {/* Step 4: Avatar */}
      <Badge variant="outline">
        {hcp.avatar_character}/{hcp.avatar_style}
      </Badge>
    </div>
  </CardContent>
</Card>
```

### Agent Metadata with Voice Live Model
```python
# Source: Extend build_voice_live_metadata() in agent_sync_service.py
# The model is NOT stored in agent metadata -- it's a runtime connection parameter.
# Agent metadata stores speech/avatar config that the Voice Live session needs.
# Model selection is handled by the token broker at session start.
#
# Existing metadata format (already works):
# {
#   "microsoft.voice-live.configuration": '{"voice":{"type":"azure-standard","name":"en-US-AvaNeural","temperature":0.9},"turn_detection":{"type":"server_vad"}}'
# }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single global model for Voice Live | Per-HCP model selection | Phase 13 | Each HCP can use different model tier |
| azure-ai-projects 1.0.0b12 (beta) | azure-ai-projects 2.0.1 (stable) | Phase 13 | Stable Agent Registry API, breaking changes possible |
| No admin visibility of Voice Live chain | Management overview page | Phase 13 | Admin sees full HCP -> Agent -> VL -> Speech chain |
| Implicit Voice Live "instance" creation | Explicit model selection in admin | Phase 13 | Matches AI Foundry portal workflow |

**Azure Voice Live API supported models (current, verified 2026-04-03):**
- Pro: gpt-realtime, gpt-4o, gpt-4.1, gpt-5, gpt-5-chat
- Basic: gpt-realtime-mini, gpt-4o-mini, gpt-4.1-mini, gpt-5-mini
- Lite: gpt-5-nano, phi4-mm-realtime, phi4-mini

**Critical insight: Voice Live has no instance management API.**
The AI Foundry portal "Voice Live playground" is a UI experience that connects a WebSocket with model selection. There is no REST API to "create a Voice Live instance" that persists on Azure. The "instance" is simply a configuration choice (model + speech + avatar) that exists in the platform's database and is applied at WebSocket connection time.

## Open Questions

1. **SDK upgrade impact on agent_sync_service.py**
   - What we know: `azure-ai-projects` 2.0.1 is stable; installed version is 1.0.0b12 (beta). The `PromptAgentDefinition`, `client.agents.create_version()`, `client.agents.get()`, `client.agents.delete()` are the methods used.
   - What's unclear: Whether v2.0.1 has the same API surface as v1.0.0b12. Method signatures may have changed.
   - Recommendation: Upgrade in a dedicated plan. Test each method. If API surface changed, adapt `agent_sync_service.py`. The memory note says v2.0+ uses `client.agents.create_version()` which matches current code -- likely compatible.

2. **Per-HCP model vs global config model**
   - What we know: Currently `model_or_deployment` on the `azure_voice_live` ServiceConfig stores the global model/agent config. HCP profiles don't have a `voice_live_model` field.
   - What's unclear: Whether the global config model should serve as a default that HCP-level overrides, or whether per-HCP model should be the only source.
   - Recommendation: Add `voice_live_model` to HcpProfile with default "gpt-4o". Global `model_or_deployment` remains as system-level agent/model mode config. Per-HCP `voice_live_model` is used for model-mode sessions. Agent-mode sessions ignore it (agent has its own LLM).

3. **Management page as separate route or tab in existing HCP page**
   - What we know: AI Foundry portal has a separate "Voice Live" section showing all Voice Live configurations per agent.
   - What's unclear: Whether a new admin page is needed or the existing HCP table is sufficient.
   - Recommendation: New admin route `/admin/voice-live` showing chain overview across all HCPs, with links to individual HCP editors. The HCP editor already has the Voice & Avatar tab for per-HCP config.

## Project Constraints (from CLAUDE.md)

### Coding Standards
- Async everywhere: all backend functions must be `async def`
- Pydantic v2 schemas with `model_config = ConfigDict(from_attributes=True)`
- Route ordering: static paths before parameterized (`/{id}`)
- Service layer holds business logic, routers only handle HTTP
- No raw SQL -- use SQLAlchemy ORM
- TypeScript strict mode: no `any`, no unused variables
- TanStack Query hooks per domain, no inline useQuery
- `cn()` for conditional class composition
- i18n: all UI text externalized via react-i18next
- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`

### Database Rules
- NEVER modify schema without Alembic migration
- All models use TimestampMixin
- batch_alter_table with server_default for SQLite compatibility

### Pre-Commit Checklist
- Backend: `ruff check .`, `ruff format --check .`, `pytest -v`
- Frontend: `npx tsc -b`, `npm run build`

### Memory Directives
- Use `python3` not `python` in local commands
- Unit tests MUST use real .env credentials when available
- Always complete full workflow: fix -> commit -> push -> CI verify
- Each phase needs >=95% test coverage
- All UI communication in Chinese with user, English in code/commits

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| azure-ai-projects | Agent sync service | Installed (wrong version) | 1.0.0b12 | Must upgrade to 2.0.1 |
| @azure/ai-voicelive | Frontend Voice Live SDK | Installed | 1.0.0-beta.3 | -- |
| azure-identity | Entra ID auth | Installed | -- | API key fallback |
| Python 3.11+ | Backend | Available | 3.11+ | -- |
| Node 20+ | Frontend | Available | 20+ | -- |

**Missing dependencies with no fallback:**
- `azure-ai-projects` must be upgraded from `1.0.0b12` to `>=2.0.1` (stable release)

**Missing dependencies with fallback:**
- None -- all runtime dependencies are already available

## Sources

### Primary (HIGH confidence)
- Azure Voice Live how-to: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to -- Session configuration, authentication, model selection, avatar config, voice config. Updated 2026-03-16.
- Azure Voice Live overview: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live -- Supported models list (12 models in 3 tiers), pricing, architecture. Updated 2026-02-04.
- Azure Voice Live customization: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to-customize -- Custom speech, custom voice, personal voice, custom avatar config. Updated 2026-04-02.
- Existing codebase files (all read directly):
  - `backend/app/services/agent_sync_service.py` -- Agent CRUD with `build_voice_live_metadata()`, `sync_agent_for_profile()`
  - `backend/app/services/voice_live_service.py` -- Token broker with per-HCP resolution
  - `backend/app/models/hcp_profile.py` -- ORM model with 13 voice/avatar columns
  - `backend/app/schemas/hcp_profile.py` -- Pydantic schemas with all voice/avatar fields
  - `backend/app/schemas/voice_live.py` -- Token response and status schemas
  - `backend/app/api/voice_live.py` -- Token broker and status endpoints
  - `backend/app/models/service_config.py` -- Global config with model_or_deployment
  - `backend/app/services/agents/adapters/azure_voice_live.py` -- parse_voice_live_mode(), encode_voice_live_mode()
  - `backend/app/services/region_capabilities.py` -- Region availability maps
  - `frontend/src/hooks/use-voice-live.ts` -- Voice Live WebSocket session with buildSessionConfig()
  - `frontend/src/hooks/use-avatar-stream.ts` -- Avatar WebRTC connection
  - `frontend/src/components/admin/voice-avatar-tab.tsx` -- Voice/Avatar admin settings with live test
  - `frontend/src/pages/admin/hcp-profile-editor.tsx` -- Tabbed HCP editor
  - `frontend/src/types/hcp.ts` -- HCP TypeScript types
  - `frontend/src/types/voice-live.ts` -- Voice Live types

### Secondary (MEDIUM confidence)
- pip index verification: `azure-ai-projects` latest stable is `2.0.1`, installed is `1.0.0b12`
- User memory (2026-04-03): AI Foundry Voice Live complete workflow with model selection and agent binding steps

### Tertiary (LOW confidence)
- SDK v2.0.1 API surface compatibility with v1.0.0b12 -- needs runtime verification during upgrade plan

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, SDK upgrade path clear
- Architecture: HIGH - Voice Live has no instance management API (verified from official docs), pattern is config-driven
- Pitfalls: HIGH - SDK upgrade risk identified, model/agent-mode distinction well-understood from docs
- Azure API structure: HIGH - verified from official docs updated 2026-03-16 and 2026-04-02

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable -- Azure Voice Live API is GA, model list may expand but existing models remain)
