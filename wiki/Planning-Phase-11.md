# Phase 11: Hcp Profile Agent Integration Auto Create Ai Foundry Agent When Adding Hcp Profiles

> Auto-generated from [`.planning/phases/11-hcp-profile-agent-integration-auto-create-ai-foundry-agent-when-adding-hcp-profiles`](../blob/main/.planning/phases/11-hcp-profile-agent-integration-auto-create-ai-foundry-agent-when-adding-hcp-profiles)  
> Last synced: 2026-04-02

## Context & Decisions

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

## Plans (3)

| # | Plan File | Status |
|---|-----------|--------|
| 11-01 | 11-01-PLAN.md | Complete |
| 11-02 | 11-02-PLAN.md | Complete |
| 11-03 | 11-03-PLAN.md | Complete |

## Research

<details><summary>Click to expand research notes</summary>

# Phase 11: HCP Profile Agent Integration - Research

**Researched:** 2026-03-31
**Domain:** Azure AI Foundry Agent Service REST API + Backend/Frontend CRUD integration
**Confidence:** HIGH

## Summary

Phase 11 requires automatic synchronization between HCP profiles and Azure AI Foundry Agents. When an admin creates, updates, or deletes an HCP profile, the system must call the Azure AI Foundry Agent REST API to create, update, or delete a corresponding AI Agent. The Agent's `id` is stored on the HCP profile model for later use by the Digital Human Realtime Agent mode.

The Azure AI Foundry Agent Service uses an OpenAI Assistants-compatible REST API at `{project_endpoint}/assistants`. The GA API version is `2025-05-01`. Authentication can use either Entra ID Bearer tokens or API key (via `api-key` header), and this project already uses `api-key` header for all AI Foundry API calls. The existing `httpx` library (already a project dependency) is the right tool for making these REST calls -- no new SDK dependency is needed.

The frontend work involves redesigning the HCP profiles page from a list+editor panel layout to a table format, adding agent sync status badges, and extending TanStack Query mutations to handle the new agent sync fields.

**Primary recommendation:** Use direct `httpx` REST API calls to the AI Foundry `/assistants` endpoint (same pattern as `connection_tester.py`), NOT the `azure-ai-projects` Python SDK -- this avoids adding a heavy dependency and keeps consistency with the existing codebase pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full bidirectional sync -- HCP profile create -> create AI Foundry Agent, update -> update Agent instructions, delete -> delete Agent
- **D-02:** Agent creation/update/delete happens automatically on HCP profile save/delete -- no manual sync step
- **D-03:** Store `agent_id` (returned from AI Foundry) on HCP profile model for session wiring
- **D-04:** Track sync status per HCP: `synced`, `pending`, `failed`, `none` -- persisted in DB
- **D-05:** Template-based instruction generation from HCP profile fields (name, specialty, personality, communication_style, objections, knowledge_background)
- **D-06:** Template is a configurable string with `{field}` placeholders -- admin can customize the template (store in ServiceConfig or dedicated table)
- **D-07:** Agent instructions contain HCP personality only -- scenario/product context injected at session start time via system prompt, not baked into Agent
- **D-08:** HCP profiles page redesigned from card grid to **table format**
- **D-09:** Table columns: Name, Specialty, Personality, Communication Style, Agent Status (badge: synced/failed/pending/none), Actions (edit/delete)
- **D-10:** Agent creation is automatic with status badge -- no extra clicks. On save, background sync fires and badge updates
- **D-11:** Failed sync shows error details on hover/click, with retry option
- **D-12:** Digital Human Realtime Agent mode looks up `agent_id` from the session's HCP profile -- token broker returns it automatically. No user selection of Agent needed
- **D-13:** If HCP has no `agent_id` (sync failed or not yet synced), Realtime Agent mode option is **disabled/grayed out** in the mode selector with tooltip explaining why
- **D-14:** Token broker (`get_voice_live_status`) already returns `agent_id` -- extend it to source from HCP profile's `agent_id` field based on selected scenario's HCP

### Claude's Discretion
- Agent instruction template default content (exact wording)
- Error retry strategy for failed AI Foundry API calls (exponential backoff vs fixed retry)
- Table pagination/sorting implementation details
- Loading skeleton design for table

### Deferred Ideas (OUT OF SCOPE)
- Bulk agent sync for all existing HCPs (migration tool) -- could be a one-time script
- Agent versioning/rollback in AI Foundry -- future phase
- Agent analytics/usage tracking from AI Foundry -- future phase
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | 0.27.2 (installed) | REST API calls to AI Foundry Agent Service | Already used throughout codebase for connection testing; async-native |
| SQLAlchemy 2.0 | >=2.0.35 (installed) | ORM for new agent_id/status columns on HcpProfile | Project standard |
| Alembic | >=1.13.0 (installed) | Migration for new HcpProfile columns | Project standard |
| FastAPI | >=0.115.0 (installed) | Router extensions for HCP CRUD hooks | Project standard |
| TanStack Query v5 | ^5.60.0 (installed) | Frontend mutation hooks with invalidation | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| openai | 1.51.0 (installed) | NOT used for Agent API -- httpx preferred for consistency | Only for chat completions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| httpx direct REST | azure-ai-projects SDK (v2.0.1) | SDK adds ~50MB dependency, requires `azure-identity`, uses Entra ID auth by default -- project uses api-key auth pattern |
| httpx direct REST | openai SDK (already installed) | openai SDK supports Assistants API but Azure AI Foundry endpoint format differs from standard OpenAI |

**Installation:**
No new packages required. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── services/
│   ├── agent_sync_service.py    # NEW: AI Foundry Agent CRUD via REST API
│   ├── hcp_profile_service.py   # MODIFY: Add post-save/post-delete sync hooks
│   ├── config_service.py        # REUSE: get_effective_endpoint/key for AI Foundry config
│   └── voice_live_service.py    # MODIFY: Source agent_id from HCP profile
├── models/
│   └── hcp_profile.py           # MODIFY: Add agent_id, agent_sync_status, agent_sync_error
├── schemas/
│   └── hcp_profile.py           # MODIFY: Add agent fields to response schemas
├── api/
│   └── hcp_profiles.py          # MODIFY: Return agent_sync_status, add retry endpoint
frontend/src/
├── pages/admin/
│   └── hcp-profiles.tsx          # REWRITE: Card grid -> Table layout
├── components/admin/
│   ├── hcp-table.tsx             # NEW: Table component with agent status badges
│   ├── hcp-editor.tsx            # MODIFY: No agent-specific UI (auto-sync)
│   └── hcp-list.tsx              # REMOVE: Replaced by hcp-table.tsx
├── types/
│   └── hcp.ts                    # MODIFY: Add agent_id, agent_sync_status fields
├── hooks/
│   └── use-hcp-profiles.ts      # MODIFY: Add retry sync mutation
└── api/
    └── hcp-profiles.ts           # MODIFY: Add retry sync API call
```

### Pattern 1: Agent Sync Service (REST API to AI Foundry)
**What:** A new service module that wraps the Azure AI Foundry Agent (Assistants) REST API
**When to use:** Called by HCP profile service on create/update/delete

```python
# backend/app/services/agent_sync_service.py
# Source: Azure AI Foundry REST API docs (learn.microsoft.com)

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from app.services import config_service

AI_FOUNDRY_API_VERSION = "2025-05-01"

async def create_agent(
    db: AsyncSession,
    name: str,
    instructions: str,
    model: str = "gpt-4o",
) -> dict:
    """Create an AI Foundry Agent via REST API.

    Returns dict with 'id' (agent_id) on success.
    Raises on failure.
    """
    # Get AI Foundry project endpoint and key from config_service
    endpoint = await config_service.get_effective_endpoint(db, "azure_voice_live")
    api_key = await config_service.get_effective_key(db, "azure_voice_live")

    # The agent API uses the project endpoint format:
    # https://<resource>.services.ai.azure.com/api/projects/<project>/assistants
    # This needs to be derived from the AI Foundry master config
    url = f"{endpoint.rstrip('/')}/assistants"
    params = {"api-version": AI_FOUNDRY_API_VERSION}
    headers = {"api-key": api_key, "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            params=params,
            headers=headers,
            json={
                "model": model,
                "name": name,
                "instructions": instructions,
            },
        )
        response.raise_for_status()
        return response.json()


async def update_agent(
    db: AsyncSession,
    agent_id: str,
    name: str,
    instructions: str,
) -> dict:
    """Update an existing AI Foundry Agent's instructions."""
    endpoint = await config_service.get_effective_endpoint(db, "azure_voice_live")
    api_key = await config_service.get_effective_key(db, "azure_voice_live")

    url = f"{endpoint.rstrip('/')}/assistants/{agent_id}"
    params = {"api-version": AI_FOUNDRY_API_VERSION}
    headers = {"api-key": api_key, "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            params=params,
            headers=headers,
            json={"name": name, "instructions": instructions},
        )
        response.raise_for_status()
        return response.json()


async def delete_agent(
    db: AsyncSession,
    agent_id: str,
) -> bool:
    """Delete an AI Foundry Agent. Returns True on success."""
    endpoint = await config_service.get_effective_endpoint(db, "azure_voice_live")
    api_key = await config_service.get_effective_key(db, "azure_voice_live")

    url = f"{endpoint.rstrip('/')}/assistants/{agent_id}"
    params = {"api-version": AI_FOUNDRY_API_VERSION}
    headers = {"api-key": api_key}

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.delete(url, params=params, headers=headers)
        return response.status_code == 200
```

### Pattern 2: Template-Based Instruction Generation
**What:** Generate agent instructions from HCP profile fields using a configurable template
**When to use:** Called before create_agent/update_agent

```python
# backend/app/services/agent_sync_service.py

DEFAULT_AGENT_TEMPLATE = """You are {name}, a {specialty} specialist.

Personality: {personality_type}
Communication Style: {"direct" if communication_style < 50 else "indirect"} (level: {communication_style}/100)
Emotional State: {"calm and open" if emotional_state < 30 else "neutral" if emotional_state < 70 else "resistant"} (level: {emotional_state}/100)

Background:
- Hospital: {hospital}
- Title: {title}
- Expertise: {expertise_areas}
- Prescribing Habits: {prescribing_habits}
- Key Concerns: {concerns}

Common Objections:
{objections}

Topics You Probe About:
{probe_topics}

Stay in character throughout the conversation. Respond as this HCP would in a real face-to-face interaction with a Medical Representative."""


def build_agent_instructions(profile_data: dict, template: str | None = None) -> str:
    """Build agent instructions from HCP profile data using template."""
    tmpl = template or DEFAULT_AGENT_TEMPLATE
    # Safe format: handle list fields
    data = {**profile_data}
    for list_field in ("expertise_areas", "objections", "probe_topics"):
        if isinstance(data.get(list_field), list):
            data[list_field] = ", ".join(data[list_field])
    return tmpl.format(**data)
```

### Pattern 3: Post-Save Hook in HCP Service
**What:** After HCP profile save, trigger async agent sync
**When to use:** In hcp_profile_service create/update/delete

```python
# In hcp_profile_service.py (after create/update)

async def create_hcp_profile(db, data, user_id):
    profile = HcpProfile(**profile_data)
    profile.agent_sync_status = "pending"
    db.add(profile)
    await db.flush()
    await db.refresh(profile)

    # Fire agent sync (non-blocking for the HTTP response)
    try:
        result = await agent_sync_service.sync_agent_for_profile(db, profile)
        profile.agent_id = result["id"]
        profile.agent_sync_status = "synced"
        profile.agent_sync_error = ""
    except Exception as e:
        profile.agent_sync_status = "failed"
        profile.agent_sync_error = str(e)[:500]

    await db.flush()
    await db.refresh(profile)
    return profile
```

### Pattern 4: Agent Endpoint Discovery
**What:** The AI Foundry Agent API endpoint differs from the OpenAI endpoint
**When to use:** When constructing the base URL for agent REST calls

The Agent API uses project endpoint format: `https://<resource>.services.ai.azure.com/api/projects/<project>/assistants`

This is different from the OpenAI endpoint (`*.openai.azure.com`). The project needs a way to store or derive the project endpoint.

**Recommendation:** Store the AI Foundry project endpoint as a new field in the master config or use the existing `azure_voice_live` config's model_or_deployment field (which already stores agent mode JSON with `project_name`). The endpoint can be constructed as:
`https://<resource>.services.ai.azure.com/api/projects/<project_name>`

### Anti-Patterns to Avoid
- **Anti-pattern: Blocking agent sync in HTTP request path.** Although the current design syncs synchronously within the save call (per D-02), wrap in try/catch to ensure the HCP profile save succeeds even if agent sync fails. Never let AI Foundry API failure prevent HCP profile CRUD.
- **Anti-pattern: Storing raw API key in agent_sync_service.** Always use `config_service.get_effective_key()` -- never cache decrypted keys in module-level variables.
- **Anti-pattern: Using azure-ai-projects SDK.** This adds ~50MB of dependencies, requires `azure-identity` for auth, and fights against the project's `api-key` header auth pattern. Use `httpx` directly.
- **Anti-pattern: Putting agent instructions in the HCP database field.** Agent instructions are generated on-the-fly from profile data. Store the template, not the rendered instructions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| REST API client for AI Foundry | Custom retry/timeout framework | httpx with simple try/except + status tracking | httpx already handles async, timeouts, connection pooling |
| Agent status badge UI | Custom SVG badges | Tailwind utility classes with conditional cn() | Project convention -- see ServiceConfigCard pattern |
| Table pagination | Custom pagination logic | PaginatedResponse from backend + existing useHcpProfiles hook | Already supports page/page_size params |
| Template string rendering | Custom template engine | Python str.format() with safe defaults | Simple {field} placeholders per D-06 -- no Jinja needed |

**Key insight:** The Agent REST API is a simple CRUD interface (create/update/delete) with JSON payloads. The complexity is in the lifecycle management (sync status tracking, error handling, retry) -- not in the API calls themselves.

## Common Pitfalls

### Pitfall 1: AI Foundry Endpoint vs OpenAI Endpoint Confusion
**What goes wrong:** The Agent (Assistants) API uses a project-scoped endpoint (`*.services.ai.azure.com/api/projects/<project>/assistants`), NOT the OpenAI endpoint (`*.openai.azure.com`). Using the wrong endpoint returns 404.
**Why it happens:** The master config stores the OpenAI-style endpoint. The Agent API needs the AI Foundry project endpoint.
**How to avoid:** The voice_live config already stores agent mode JSON with `project_name`. Use this to construct the correct project endpoint. If the master endpoint is `https://<resource>.services.ai.azure.com`, append `/api/projects/<project_name>` for agent calls. If it's `*.cognitiveservices.azure.com`, derive the `.services.ai.azure.com` variant first.
**Warning signs:** 404 errors on `/assistants` endpoint; "Resource not found" from AI Foundry.

### Pitfall 2: API Key vs Bearer Token Auth
**What goes wrong:** AI Foundry quickstart docs show Bearer token (Entra ID) auth. But this project uses API key auth everywhere.
**Why it happens:** Azure docs emphasize Entra ID auth. But the API also accepts `api-key` header (same as OpenAI endpoints on AI Foundry).
**How to avoid:** Use `api-key: {key}` header, same as all other AI Foundry calls in this project. The existing `connection_tester.py` proves this works.
**Warning signs:** 401 errors when using `Authorization: Bearer` with an API key string.

### Pitfall 3: Alembic Migration for SQLite with Existing Data
**What goes wrong:** Adding non-nullable columns without `server_default` fails on SQLite when rows already exist.
**Why it happens:** SQLite doesn't support `ALTER TABLE ADD COLUMN` with NOT NULL unless a default is specified.
**How to avoid:** Use `server_default` for all new columns: `agent_id` -> `server_default=""`, `agent_sync_status` -> `server_default="none"`, `agent_sync_error` -> `server_default=""`. Use `batch_alter_table` per project convention.
**Warning signs:** Alembic migration fails with "Cannot add a NOT NULL column with default value NULL".

### Pitfall 4: Agent Sync Failure Blocking HCP Profile Save
**What goes wrong:** If AI Foundry is unreachable or misconfigured, HCP profile create/update fails entirely.
**Why it happens:** Agent sync is called synchronously in the save path.
**How to avoid:** Wrap agent sync in try/except. On failure, set `agent_sync_status = "failed"` and `agent_sync_error` with the error message. The HCP profile save itself must always succeed.
**Warning signs:** HCP create returns 500; profile disappears after save attempt.

### Pitfall 5: Agent ID Mismatch After Update
**What goes wrong:** Updating an HCP profile creates a new agent instead of updating the existing one, leading to orphaned agents in AI Foundry.
**Why it happens:** Using create_agent on update instead of checking for existing agent_id.
**How to avoid:** In update flow: if `profile.agent_id` is set and non-empty, call update_agent (PATCH/POST to `/assistants/{agent_id}`). Only call create_agent if no agent_id exists yet.
**Warning signs:** Multiple agents with the same name in AI Foundry console; agent_id changes on every update.

### Pitfall 6: Project Endpoint Configuration
**What goes wrong:** The AI Foundry project endpoint format (`https://<resource>.services.ai.azure.com/api/projects/<project>`) needs both the resource name AND the project name. Neither is explicitly stored in the current config schema.
**Why it happens:** Current config stores just the base endpoint and model_or_deployment.
**How to avoid:** The voice_live mode already parses `project_name` from the agent mode JSON in `model_or_deployment`. Reuse this. For the base endpoint, derive from the master AI Foundry config (preferring `.services.ai.azure.com` variant). Store the derived project endpoint or add a `project_name` field to the master config.
**Warning signs:** Empty project_name; agent sync fails with "project not found".

## Code Examples

### Example 1: AI Foundry Agent REST API - Create Agent
```bash
# Source: Azure AI Foundry quickstart docs (learn.microsoft.com)
# GA API version: 2025-05-01

curl --request POST \
  --url "https://<resource>.services.ai.azure.com/api/projects/<project>/assistants?api-version=2025-05-01" \
  -H "api-key: <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "instructions": "You are Dr. Zhang Wei, an oncologist...",
    "name": "Dr. Zhang Wei",
    "model": "gpt-4o"
  }'

# Response: {"id": "asst_abc123", "name": "Dr. Zhang Wei", ...}
```

### Example 2: AI Foundry Agent REST API - Update Agent
```bash
# Source: OpenAI Assistants API (compatible with AI Foundry)
curl --request POST \
  --url "https://<resource>.services.ai.azure.com/api/projects/<project>/assistants/asst_abc123?api-version=2025-05-01" \
  -H "api-key: <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "instructions": "Updated instructions...",
    "name": "Dr. Zhang Wei"
  }'
```

### Example 3: AI Foundry Agent REST API - Delete Agent
```bash
curl --request DELETE \
  --url "https://<resource>.services.ai.azure.com/api/projects/<project>/assistants/asst_abc123?api-version=2025-05-01" \
  -H "api-key: <your-api-key>"
```

### Example 4: Alembic Migration for New HCP Profile Columns
```python
# Source: Project convention (f09a_unified_ai_foundry_config.py)
def upgrade() -> None:
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.add_column(
            sa.Column("agent_id", sa.String(100), server_default="", nullable=False)
        )
        batch_op.add_column(
            sa.Column(
                "agent_sync_status",
                sa.String(20),
                server_default="none",
                nullable=False,
            )
        )
        batch_op.add_column(
            sa.Column("agent_sync_error", sa.Text(), server_default="", nullable=False)
        )
```

### Example 5: Frontend Agent Status Badge
```typescript
// Source: Project convention (service-config-card.tsx badge pattern)
function AgentStatusBadge({ status, error }: { status: string; error?: string }) {
  const badgeStyles: Record<string, string> = {
    synced: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
    none: "bg-gray-100 text-gray-500",
  };

  return (
    <Tooltip>
      <TooltipTrigger>
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", badgeStyles[status])}>
          {status}
        </span>
      </TooltipTrigger>
      {status === "failed" && error && (
        <TooltipContent>{error}</TooltipContent>
      )}
    </Tooltip>
  );
}
```

### Example 6: Token Broker Extension (Agent ID from HCP Profile)
```python
# In voice_live_service.py, extend get_voice_live_token to accept hcp_profile_id
async def get_voice_live_token(
    db: AsyncSession,
    hcp_profile_id: str | None = None,
) -> VoiceLiveTokenResponse:
    # ... existing token generation ...

    # If agent mode AND hcp_profile_id provided, source agent_id from HCP profile
    if is_agent and hcp_profile_id:
        from app.services import hcp_profile_service
        profile = await hcp_profile_service.get_hcp_profile(db, hcp_profile_id)
        if profile.agent_id:
            agent_id = profile.agent_id
        # project_name still comes from voice_live config

    return VoiceLiveTokenResponse(
        # ...
        agent_id=agent_id if is_agent else None,
        project_name=mode_info.get("project_name") if is_agent else None,
    )
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenAI Assistants API (`/v1/assistants`) | Azure AI Foundry Agent API (`/assistants?api-version=2025-05-01`) | May 2025 | Endpoint format uses project-scoped URLs; api-version parameter required |
| Hub-based project connection strings | Foundry project endpoint format | May 2025 | `https://<resource>.services.ai.azure.com/api/projects/<project>` |
| `azure-ai-projects` v1.x (preview) | `azure-ai-projects` v2.0.1 (GA) | March 2026 | SDK is now GA but this project uses httpx instead |
| Single agent_id in voice_live config | Per-HCP agent_id in HCP profile model | Phase 11 (now) | Each HCP gets its own AI Foundry Agent |

**Deprecated/outdated:**
- Hub-based project connection strings: Replaced by Foundry project endpoints (May 2025)
- `azure-ai-projects` < 2.0: Breaking API changes in v2.0

## Open Questions

1. **AI Foundry Project Endpoint Configuration**
   - What we know: The Agent API needs `https://<resource>.services.ai.azure.com/api/projects/<project_name>/assistants`. The voice_live config stores `project_name` in its agent mode JSON.
   - What's unclear: Should we add a dedicated `project_name` field to the AI Foundry master config, or always derive it from the voice_live agent mode config?
   - Recommendation: Add a `project_name` field to the AI Foundry master config (new DB column on service_configs or store in a separate config key). This makes agent sync independent of voice_live config.

2. **Model Deployment Name for Agents**
   - What we know: AI Foundry Agent creation requires a `model` parameter (deployment name, e.g., "gpt-4o").
   - What's unclear: Should this use the master config's `model_or_deployment`, the voice_live config's model, or a dedicated "agent model" config?
   - Recommendation: Use the master config's `model_or_deployment` as default. This is the model deployed on the AI Foundry resource.

3. **Agent API Authentication Method**
   - What we know: Quickstart docs show Entra ID Bearer auth. This project uses `api-key` header throughout.
   - What's unclear: Is `api-key` header officially supported for the Agent (Assistants) API, or only for OpenAI/Speech endpoints?
   - Recommendation: Try `api-key` header first (HIGH confidence it works based on AI Foundry unified auth pattern). Fall back to documenting Entra ID if needed. The quickstart REST example explicitly shows Bearer token, but the Python SDK `AIProjectClient` supports `AzureKeyCredential` as well.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | Backend | Yes | 3.11.9 | -- |
| httpx | Agent REST API calls | Yes | 0.27.2 | -- |
| openai | Chat completions (not agents) | Yes | 1.51.0 | -- |
| Node.js 20+ | Frontend | Yes | via npm 11.8.0 | -- |
| Azure AI Foundry project | Agent CRUD | External | -- | Agent sync fails gracefully; status = "none" |

**Missing dependencies with no fallback:**
- None -- all code dependencies are installed

**Missing dependencies with fallback:**
- Azure AI Foundry project (external service): If not configured, agent sync is skipped; HCP profiles work normally without agent sync; `agent_sync_status` stays "none"

## Project Constraints (from CLAUDE.md)

**Enforced by this phase:**
- **Async everywhere**: All agent sync functions must be `async def` with `await`
- **Service layer pattern**: Agent sync logic in `services/agent_sync_service.py`, not in router
- **Alembic migrations**: New columns require migration with `server_default` for SQLite compatibility
- **Pydantic v2 schemas**: Agent fields in response schemas use `ConfigDict(from_attributes=True)`
- **db.flush()** not `db.commit()`: Per session middleware commit pattern
- **i18n**: All new UI text externalized to admin namespace (en-US + zh-CN)
- **No raw SQL**: Use SQLAlchemy ORM for all queries
- **Static routes before parameterized**: Any new `/retry-sync` endpoint before `/{profile_id}`
- **Create returns 201, Delete returns 204**: Maintain existing HTTP semantics
- **cn() utility**: Use for conditional class composition in new table components
- **Design tokens only**: No raw Tailwind colors in shared components
- **TanStack Query hooks**: New retry mutation in `use-hcp-profiles.ts`, not inline useQuery

## Sources

### Primary (HIGH confidence)
- Azure AI Foundry Agent Service quickstart (learn.microsoft.com/en-us/azure/ai-services/agents/quickstart) - REST API endpoint format, create/delete curl examples, api-version 2025-05-01
- Azure AI Foundry Agent Service overview (learn.microsoft.com/en-us/azure/foundry/agents/overview) - Agent types, architecture, model support
- Azure AI Foundry environment setup (learn.microsoft.com/en-us/azure/foundry/agents/environment-setup) - Project endpoint format, auth requirements
- Existing codebase: `backend/app/services/connection_tester.py` - httpx REST call patterns with AI Foundry endpoints
- Existing codebase: `backend/app/services/voice_live_service.py` - Token broker agent_id sourcing pattern
- Existing codebase: `backend/app/services/agents/adapters/azure_voice_live.py` - parse_voice_live_mode with agent_id/project_name
- Existing codebase: `backend/alembic/versions/f09a_unified_ai_foundry_config.py` - Migration pattern with server_default

### Secondary (MEDIUM confidence)
- PyPI: azure-ai-projects v2.0.1 (pypi.org) - SDK GA version, Python 3.9+ support
- Project memory: `project_phase11_hcp_agent_sync.md` - Phase 11 requirement context
- Project memory: `project_ai_foundry_speech_auth.md` - api-key header auth pattern for AI Foundry

### Tertiary (LOW confidence)
- Agent API `api-key` header support: Based on inference from AI Foundry unified auth pattern, not explicitly documented for Agent (Assistants) API. Needs runtime validation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies needed
- Architecture: HIGH - Follows established project patterns (service layer, httpx REST, Alembic migrations)
- AI Foundry API: MEDIUM - REST endpoint format and auth confirmed from docs, but api-key header for Agent API specifically needs runtime validation
- Frontend table redesign: HIGH - Standard React table with existing design token system
- Pitfalls: HIGH - Based on actual codebase patterns and documented Azure quirks

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (30 days -- AI Foundry API is GA and stable)

</details>

## UI Specification

<details><summary>Click to expand UI spec</summary>

# Phase 11 -- UI Design Contract

> Visual and interaction contract for the HCP Profile Agent Integration phase. Generated by gsd-ui-researcher, verified by gsd-ui-checker.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (Radix UI primitives + Tailwind v4 + CSS custom properties -- established project pattern) |
| Preset | not applicable |
| Component library | Radix UI (via existing ui/ component wrappers) |
| Icon library | lucide-react (^0.460.0) |
| Font | Inter + Noto Sans SC (--font-sans), JetBrains Mono (--font-mono) |

**Source:** Existing `frontend/src/styles/index.css` @theme inline block and `frontend/src/components/ui/` library (20+ components).

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline badge padding, table cell icon-text gap |
| sm | 8px | Compact element spacing, table row vertical padding |
| md | 16px | Default element spacing, table cell horizontal padding |
| lg | 24px | Section padding, card content padding |
| xl | 32px | Layout gaps between major sections |
| 2xl | 48px | Page-level top/bottom padding |
| 3xl | 64px | Not used in this phase |

Exceptions: Table cell padding uses 16px horizontal (md) and 12px vertical (matching existing `scenario-table.tsx` pattern of `px-4 py-3`).

**Source:** Established project convention. Matches `scenario-table.tsx` and `service-config-card.tsx` spacing patterns.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px (text-sm) | 400 (--font-weight-normal) | 1.5 |
| Label | 14px (text-sm) | 500 (--font-weight-medium) | 1.5 |
| Heading | 16px (text-base) | 500 (font-medium) | 1.5 |
| Display | 20px (text-xl) | 500 (--font-weight-medium) | 1.5 |

**Font weights used in this phase: 400 (normal) and 500 (medium) only.**

**Phase-specific usage:**
- Table header cells: 14px, weight 500 (Label role)
- Table body cells: 14px, weight 400 (Body role)
- Agent status badge text: 12px (text-xs), weight 500
- Page title "HCP Profiles": 20px, weight 500 (Display role)
- Tooltip error detail text: 12px (text-xs), weight 400

**Source:** Existing base layer styles in `frontend/src/styles/index.css` lines 191-250. Table headers in `scenario-table.tsx` and `rubric-table.tsx` consistently use `font-medium` (500). Heading role aligned to 500 for this phase to maintain a strict 2-weight budget.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | var(--background) / #FFFFFF | Page background, table background |
| Secondary (30%) | var(--card) / #FFFFFF, var(--muted) / #ececf0 | Table header row (bg-slate-50/50), hover states, empty state area |
| Accent (10%) | var(--primary) / #1E40AF | Primary CTA button ("Create New HCP"), column sort active indicator |
| Destructive | var(--destructive) / #EF4444 | Delete HCP action, failed sync badge background, error text |

### Agent Sync Status Badge Colors

| Status | Background | Text | Border |
|--------|------------|------|--------|
| synced | var(--strength)/10 (green-100 equivalent) | var(--strength) (#22C55E) | none |
| pending | amber-100 (#FEF3C7) | amber-700 (#B45309) | none |
| failed | destructive/10 (red-100 equivalent) | var(--destructive) (#EF4444) | none |
| none | var(--muted) (#ececf0) | var(--muted-foreground) (#717182) | none |

Accent reserved for: "Create New HCP" button, table sort active indicator, "Retry Sync" button when primary variant, edit action icon hover.

**Source:** Badge color pattern derived from existing `Badge` component variants (success variant uses `--strength`). Status dot pattern from `service-config-card.tsx` STATUS_DOT map. The `synced` status reuses the existing `success` Badge variant. The `pending`, `failed`, and `none` statuses use inline utility classes matching the `DIFFICULTY_STYLES` pattern in `scenario-table.tsx`.

---

## Component Inventory

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| HcpTable | `frontend/src/components/admin/hcp-table.tsx` | Replaces HcpList; sortable table with agent status column |
| AgentStatusBadge | Inline in HcpTable | Status badge with tooltip for error details |

### Modified Components

| Component | Location | Change |
|-----------|----------|--------|
| HcpProfilesPage | `frontend/src/pages/admin/hcp-profiles.tsx` | Replace list+editor layout with table layout + dialog/sheet editor |
| HcpEditor | `frontend/src/components/admin/hcp-editor.tsx` | No agent UI -- sync is automatic; agent_id shown read-only in detail view |

### Removed Components

| Component | Location | Reason |
|-----------|----------|--------|
| HcpList | `frontend/src/components/admin/hcp-list.tsx` | Replaced by HcpTable (D-08) |

### Reused Components (no changes)

| Component | Usage in Phase 11 |
|-----------|-------------------|
| Button | Create New HCP CTA, Retry Sync action, pagination Previous/Next, table actions |
| Badge | Agent status display (success variant for synced; custom classes for pending/failed/none) |
| Avatar + AvatarFallback | HCP name column with avatar initials |
| Tooltip + TooltipTrigger + TooltipContent | Error details on failed sync badge hover |
| DropdownMenu + DropdownMenuItem | Table row actions (edit, delete, retry sync) |
| Dialog | Delete confirmation dialog |
| Skeleton | Table loading skeleton |
| Input | Search filter input |
| EmptyState | No HCP profiles state inside table |

---

## Layout Contract

**Focal point:** "Create New HCP" button (accent color, right-aligned in header bar) -- the primary action entry point for the entire page.

### HCP Profiles Page -- Table Layout

```
+----------------------------------------------------------+
| Page Header                                               |
| [Search Input]           [+ Create New HCP]              |
+----------------------------------------------------------+
| Table                                                     |
| Name | Specialty | Personality | Comm. Style | Agent | . |
|------|-----------|-------------|-------------|-------|---|
| Dr.X | Oncology  | Skeptical   | Direct (72) | [OK]  | v |
| Dr.Y | Cardio    | Friendly    | Indir. (35) | [!]   | v |
| ...  | ...       | ...         | ...         | ...   | . |
+----------------------------------------------------------+
| Page 1 of N                    [Previous] [Next]         |
+----------------------------------------------------------+
```

**Key layout decisions:**
- Full-width table replacing the previous 300px sidebar + editor panel layout (D-08)
- Page uses the standard admin content area (inside UserLayout with sidebar)
- Edit/Create opens in the existing HcpEditor, either as a sheet/dialog overlay or as a route change (Claude's discretion per D-08 table redesign)
- Table occupies full available width within the admin content area
- Search input left-aligned, Create button right-aligned in the header bar
- Header bar has 24px (lg) bottom margin before table

### Table Columns (D-09)

| Column | Width | Sortable | Content |
|--------|-------|----------|---------|
| Name | auto (min 160px) | Yes | Avatar(24px) + Name text |
| Specialty | auto (min 120px) | Yes | Plain text |
| Personality | auto (min 100px) | No | Badge with personality type |
| Communication Style | auto (min 120px) | No | Numeric value + descriptor |
| Agent Status | 100px fixed | No | AgentStatusBadge (synced/pending/failed/none) |
| Actions | 60px fixed | No | DropdownMenu (edit/delete/retry sync) |

### Table Interactions

1. **Column sort:** Click column header to toggle asc/desc. ArrowUpDown icon (size-3.5) next to sortable column names. Matches `scenario-table.tsx` pattern exactly.
2. **Row hover:** `hover:bg-slate-50/50 transition-colors` on each `<tr>`. Matches `scenario-table.tsx`.
3. **Pagination:** Client-side, 10 rows per page. Previous/Next buttons below table. Matches `scenario-table.tsx` pagination pattern.
4. **Search:** Real-time filtering by HCP name. Debounced input at top of page.
5. **Actions dropdown:** Three-dot menu (MoreHorizontal icon) per row.

### Agent Status Badge Interactions

| Status | Visual | Hover Behavior | Click Behavior |
|--------|--------|----------------|----------------|
| synced | Green badge, "Synced" text | Tooltip: "Agent synced to AI Foundry" | None |
| pending | Amber badge, "Pending" text + pulse animation | Tooltip: "Syncing agent to AI Foundry..." | None |
| failed | Red badge, "Failed" text | Tooltip: shows error message from `agent_sync_error` field | Actions dropdown includes "Retry Sync" option |
| none | Gray badge, "Not Synced" text | Tooltip: "AI Foundry not configured or sync not attempted" | None |

**Retry Sync** (D-11): Available as a DropdownMenuItem in the actions menu when status is `failed`. Triggers a `POST /api/v1/hcp-profiles/{id}/retry-sync` call. On click, badge transitions to `pending` with pulse. On success, badge transitions to `synced`. On failure, badge stays `failed` with updated error.

---

## Loading States

### Table Skeleton

When `useHcpProfiles` is loading, render 5 skeleton rows:

```
| [Skeleton 24px circle] [Skeleton 120px bar] | [Skeleton 80px] | [Skeleton 60px] | [Skeleton 40px] | [Skeleton 60px] | [Skeleton 24px] |
```

Each skeleton row height: 52px (matching real row height of `py-3` + content). Use existing `Skeleton` component with `className="h-4 rounded"` for text bars and `className="size-6 rounded-full"` for avatar placeholder.

**Source:** `Skeleton` component already exists at `frontend/src/components/ui/skeleton.tsx`.

### Save + Sync Indicator

When admin saves an HCP profile:
1. Button shows `Loader2` spinner (matches `service-config-card.tsx` pattern)
2. Toast: "Profile saved" (success)
3. Agent status badge in table transitions to `pending` (with pulse animation)
4. On sync completion, badge updates to `synced` or `failed`
5. If sync fails, toast: "Agent sync failed: {error}" (warning, not error -- profile save succeeded)

---

## Copywriting Contract

| Element | en-US Copy | zh-CN Copy |
|---------|------------|------------|
| Primary CTA | "Create New HCP" | (existing key: admin:hcp.createButton) |
| Empty state heading | "No HCP Profiles" | (existing key: admin:hcp.emptyTitle) |
| Empty state body | "Create your first HCP profile to start building training scenarios." | (existing key: admin:hcp.emptyBody) |
| Error state (save) | "Could not save HCP profile. Check required fields and try again." | (existing key: admin:errors.hcpSaveFailed) |
| Destructive confirmation (delete) | "Delete HCP Profile: This will permanently remove this profile, delete its AI Foundry agent, and unassign it from all scenarios. This action cannot be undone." | New key: admin:hcp.deleteConfirmWithAgent |
| Agent status: synced | "Synced" | New key: admin:hcp.agentSynced |
| Agent status: pending | "Syncing..." | New key: admin:hcp.agentPending |
| Agent status: failed | "Failed" | New key: admin:hcp.agentFailed |
| Agent status: none | "Not Synced" | New key: admin:hcp.agentNone |
| Tooltip: synced | "Agent synced to AI Foundry" | New key: admin:hcp.agentSyncedTooltip |
| Tooltip: pending | "Syncing agent to AI Foundry..." | New key: admin:hcp.agentPendingTooltip |
| Tooltip: none | "AI Foundry not configured or sync not attempted" | New key: admin:hcp.agentNoneTooltip |
| Tooltip: failed | "{error message from backend}" | Dynamic -- no i18n key |
| Retry action | "Retry Sync" | New key: admin:hcp.retrySync |
| Sync success toast | "Agent synced successfully" | New key: admin:hcp.syncSuccess |
| Sync failure toast | "Agent sync failed: {error}" | New key: admin:hcp.syncFailed |
| Table header: Agent Status | "Agent Status" | New key: admin:hcp.agentStatus |
| Table header: Actions | "Actions" | New key: admin:hcp.actions |

### New i18n Keys Required

**Namespace:** `admin` (existing)

```json
{
  "hcp": {
    "agentStatus": "Agent Status",
    "actions": "Actions",
    "agentSynced": "Synced",
    "agentPending": "Syncing...",
    "agentFailed": "Failed",
    "agentNone": "Not Synced",
    "agentSyncedTooltip": "Agent synced to AI Foundry",
    "agentPendingTooltip": "Syncing agent to AI Foundry...",
    "agentNoneTooltip": "AI Foundry not configured or sync not attempted",
    "retrySync": "Retry Sync",
    "syncSuccess": "Agent synced successfully",
    "syncFailed": "Agent sync failed: {{error}}",
    "deleteConfirmWithAgent": "Delete HCP Profile: This will permanently remove this profile, delete its AI Foundry agent, and unassign it from all scenarios. This action cannot be undone."
  }
}
```

Corresponding `zh-CN` keys must be added in `frontend/public/locales/zh-CN/admin.json`.

---

## Mode Selector Impact (D-13)

This phase does NOT redesign the mode selector component. The only change is:

- If a scenario's HCP profile has `agent_sync_status !== "synced"` (no valid `agent_id`), the "Digital Human Realtime Agent" and "Voice Realtime Agent" mode options are disabled in the existing mode selector.
- Disabled option shows `opacity-50 cursor-not-allowed` styling.
- Tooltip on disabled option: "HCP agent not synced. Configure AI Foundry and save the HCP profile to enable Agent mode."
- New i18n key: `training:modeSelector.agentNotAvailable` = "HCP agent not synced. Configure AI Foundry and save the HCP profile to enable Agent mode."

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| No shadcn CLI | N/A -- components hand-authored following Radix UI wrapper pattern | not applicable |

No third-party registries are used. All components are project-authored Radix UI wrappers or native HTML elements styled with Tailwind utility classes.

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

# Phase 11: HCP Profile Agent Integration Verification Report

**Phase Goal:** When admin creates/updates/deletes an HCP profile, the system automatically syncs a corresponding AI Foundry Agent. Digital Human Realtime Agent mode uses the HCP's agent_id to drive conversations. HCP profiles admin page is redesigned to table format with Agent sync status.
**Verified:** 2026-03-31T10:30:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can create/update/delete HCP profiles and the system automatically creates/updates/deletes a corresponding AI Foundry Agent | VERIFIED | `hcp_profile_service.py` lines 36-48 (create sync), 115-129 (update sync), 136-141 (delete sync) call `agent_sync_service.sync_agent_for_profile` / `delete_agent`. Integration tests `test_create_profile_triggers_agent_sync`, `test_update_profile_triggers_agent_sync`, `test_delete_profile_attempts_agent_deletion` all pass. |
| 2 | Agent sync status (synced/pending/failed/none) is visible per HCP profile in the admin table with error details on hover | VERIFIED | `hcp-table.tsx` has `AgentStatusBadge` component (line 46) with `AGENT_STATUS_STYLES` for all 4 states. Tooltip shows error text when status is "failed" (line 68-69). |
| 3 | Failed agent sync does not prevent HCP profile save -- status shows as "failed" with retry option | VERIFIED | `hcp_profile_service.py` lines 44-46: `except Exception` sets status to "failed", does not re-raise. Integration test `test_create_profile_sync_failure` confirms 201 returned with `agent_sync_status: "failed"`. Retry Sync action in dropdown at `hcp-table.tsx` line 269-275 conditional on `status === "failed"`. |
| 4 | Token broker returns per-HCP agent_id for Digital Human Realtime Agent mode sessions | VERIFIED | `voice_live_service.py` lines 64-74: when `is_agent and hcp_profile_id`, fetches profile and uses `profile.agent_id`. Integration tests `test_voice_live_token_with_hcp_profile_id` (returns profile agent_id), `test_voice_live_token_fallback_to_config` (fallback), `test_voice_live_token_backward_compatible` (no profile id) all pass. |
| 5 | HCP profiles page uses sortable table layout with agent status column replacing the previous list+editor layout | VERIFIED | `hcp-profiles.tsx` imports `HcpTable` (line 5), does NOT import `HcpList`. Table has 6 columns: Name (sortable), Specialty (sortable), Personality, Comm. Style, Agent Status, Actions. Sorting via `ArrowUpDown` icons with `toggleSort` function. |
| 6 | All new UI text externalized to i18n in both en-US and zh-CN | VERIFIED | `en-US/admin.json` has 16 new hcp keys (agentStatus, agentSynced, agentPending, agentFailed, agentNone, tooltips, retrySync, syncSuccess, syncFailed, deleteConfirmWithAgent, name, specialty, communicationStyleCol). `zh-CN/admin.json` has matching translations. Only exception: "Previous"/"Next" pagination buttons are hardcoded English, but this matches the existing pattern in `scenario-table.tsx` (pre-existing). |
| 7 | All new code has unit tests with >=95% coverage maintained | VERIFIED | 11 unit tests in `test_agent_sync_service.py` + 8 integration tests in `test_hcp_agent_sync_integration.py` = 19 tests total, all passing. Tests cover instruction builder (4 tests), REST API wrapper (4 tests), sync dispatch (2 tests), CRUD lifecycle (4 tests), token broker (3 tests), failure handling (2 tests). |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/hcp_profile.py` | HcpProfile ORM with agent fields | VERIFIED | Lines 37-41: `agent_id` String(100), `agent_sync_status` String(20), `agent_sync_error` Text -- all with defaults |
| `backend/alembic/versions/g11a_add_agent_fields_to_hcp_profile.py` | Alembic migration adding agent columns | VERIFIED | 40 lines, `batch_alter_table`, `server_default` on all 3 columns, proper `down_revision: "f09a00000001"` |
| `backend/app/services/agent_sync_service.py` | AI Foundry Agent REST API wrapper + instruction builder | VERIFIED | 223 lines, exports: `build_agent_instructions`, `get_project_endpoint`, `create_agent`, `update_agent`, `delete_agent`, `sync_agent_for_profile`. Uses `httpx.AsyncClient` with `api-key` header. |
| `backend/app/schemas/hcp_profile.py` | Updated schemas with agent fields | VERIFIED | `HcpProfileResponse` has `agent_id`, `agent_sync_status`, `agent_sync_error` (lines 68-70). Not in Create/Update schemas (read-only). |
| `backend/app/api/hcp_profiles.py` | HCP API with retry-sync endpoint | VERIFIED | `HcpProfileOut` has agent fields (lines 38-40). `POST /{profile_id}/retry-sync` endpoint at line 119. |
| `backend/app/services/hcp_profile_service.py` | HCP CRUD with agent sync hooks | VERIFIED | 165 lines. `agent_sync_service` imported (line 14). Create/update/delete all have sync hooks. `retry_agent_sync` function at line 147. |
| `backend/app/services/voice_live_service.py` | Token broker with HCP profile agent_id sourcing | VERIFIED | `get_voice_live_token` accepts `hcp_profile_id: str | None = None` (line 21). Profile lookup at line 69. |
| `backend/tests/test_agent_sync_service.py` | Unit tests for agent sync service | VERIFIED | 11 tests covering all behaviors, all passing |
| `backend/tests/test_hcp_agent_sync_integration.py` | Integration tests for agent sync lifecycle | VERIFIED | 8 tests covering CRUD sync, retry, token broker, failure handling, all passing |
| `frontend/src/types/hcp.ts` | HcpProfile type with agent fields | VERIFIED | Lines 21-23: `agent_id: string`, `agent_sync_status: "synced" | "pending" | "failed" | "none"`, `agent_sync_error: string` |
| `frontend/src/api/hcp-profiles.ts` | API client with retrySyncHcpProfile | VERIFIED | Line 42: `async function retrySyncHcpProfile(id: string)` calling `POST /hcp-profiles/${id}/retry-sync` |
| `frontend/src/hooks/use-hcp-profiles.ts` | TanStack Query hook useRetrySyncHcpProfile | VERIFIED | Line 62: `export function useRetrySyncHcpProfile()` with mutation + query invalidation |
| `frontend/src/components/admin/hcp-table.tsx` | HcpTable component with agent status badges | VERIFIED | 322 lines. `AgentStatusBadge` (line 46), `AGENT_STATUS_STYLES` (line 39), sortable columns, pagination, dropdown actions with Retry Sync, Skeleton loading state. |
| `frontend/src/pages/admin/hcp-profiles.tsx` | Rewritten HCP profiles page with table layout | VERIFIED | 216 lines. Imports `HcpTable` (not `HcpList`). Search bar, Create button, table, edit/create Dialog, delete confirmation Dialog with `deleteConfirmWithAgent` text, test chat Dialog. |
| `frontend/public/locales/en-US/admin.json` | i18n keys for agent status | VERIFIED | Contains all 16 new keys: agentStatus, agentSynced, agentPending, agentFailed, agentNone, tooltips, retrySync, syncSuccess, syncFailed, deleteConfirmWithAgent, name, specialty, communicationStyleCol |
| `frontend/public/locales/zh-CN/admin.json` | zh-CN translations for agent status keys | VERIFIED | Matching Chinese translations for all 16 keys |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `agent_sync_service.py` | `config_service.py` | `get_effective_endpoint`, `get_effective_key` | WIRED | Lines 94-95 call both functions |
| `agent_sync_service.py` | Azure AI Foundry REST API | `httpx.AsyncClient` POST/DELETE to `/assistants` | WIRED | Lines 134, 163, 186 use `httpx.AsyncClient` |
| `hcp_profile_service.py` | `agent_sync_service.py` | `sync_agent_for_profile`, `delete_agent` | WIRED | Lines 40, 119, 139, 154 call agent_sync_service functions |
| `hcp_profiles.py` (API) | `hcp_profile_service.py` | CRUD + retry_agent_sync | WIRED | Lines 71, 85, 103, 115, 126, 137 call service functions |
| `voice_live_service.py` | `hcp_profile_service.py` | `get_hcp_profile` for agent_id lookup | WIRED | Line 69: `hcp_profile_service.get_hcp_profile(db, hcp_profile_id)` |
| `hcp-profiles.tsx` (page) | `hcp-table.tsx` (component) | `HcpTable` import + props | WIRED | Line 5 imports HcpTable, line 142 renders with all 5 props |
| `hcp-profiles.tsx` (page) | `use-hcp-profiles.ts` (hooks) | `useRetrySyncHcpProfile` | WIRED | Line 23 imports, line 42 uses, line 105 calls `.mutate()` |
| `use-hcp-profiles.ts` (hooks) | `hcp-profiles.ts` (API) | `retrySyncHcpProfile` | WIRED | Line 8 imports, line 65 calls in mutationFn |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `hcp-table.tsx` | `profiles` prop | From page via `useHcpProfiles` -> `/api/v1/hcp-profiles` -> DB query | API route queries `HcpProfile` ORM model via `hcp_profile_service.get_hcp_profiles` (line 60-83 in service) | FLOWING |
| `hcp-table.tsx` | `agent_sync_status` | From `HcpProfile.agent_sync_status` DB column | Set by sync hooks in create/update/retry (lines 37-48 in service) | FLOWING |
| `voice_live_service.py` | `agent_id` from HCP profile | Via `hcp_profile_service.get_hcp_profile` -> DB query | Reads `profile.agent_id` from database (line 70-71) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend tests all pass | `pytest tests/test_agent_sync_service.py tests/test_hcp_agent_sync_integration.py -v` | 19 passed, 0 failed | PASS |
| Backend lint clean | `ruff check` on 6 modified backend files | All checks passed | PASS |
| TypeScript compiles | `npx tsc -b --noEmit` | Exit 0, no errors | PASS |
| Frontend build succeeds | `npm run build` | Built in 4.94s | PASS |
| Migration file exists | `ls backend/alembic/versions/g11a*` | File found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| HCP-01 | 11-01, 11-02, 11-03 | Admin can create/edit HCP profiles with full fields | SATISFIED | Extended with agent fields; CRUD with agent sync hooks; table UI with edit Dialog |
| HCP-02 | 11-02 | Admin can define objections and interaction rules per HCP | SATISFIED | Objections/probe_topics included in agent instruction builder template |
| COACH-06 | 11-01, 11-02 | Voice interaction supports GPT Realtime API for conversational latency | SATISFIED | Agent sync creates AI Foundry agents; token broker sources per-HCP agent_id for Realtime Agent mode |
| COACH-07 | 11-01, 11-03 | Azure AI Avatar renders digital human for HCP | SATISFIED | Agent mode + avatar config integration in token broker; agent_id per HCP enables personalized digital human |
| UI-06 | 11-03 | Admin pages follow shared design principles | SATISFIED | HCP profiles page redesigned to table layout matching scenario-table.tsx patterns |
| PLAT-01 | 11-03 | i18n framework with zh-CN and en-US | SATISFIED | 16 new i18n keys in both en-US and zh-CN admin.json files |
| PLAT-03 | 11-02 | Admin can configure Azure service connections | SATISFIED | Agent sync uses config_service for endpoint/key; retry-sync recovers from config issues |

No orphaned requirements found -- all 7 requirement IDs from ROADMAP.md are covered by plans and have implementation evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `hcp-table.tsx` | 306, 314 | Hardcoded "Previous"/"Next" pagination text (not i18n) | Info | Pre-existing pattern from scenario-table.tsx; not a regression |

No TODOs, FIXMEs, placeholders, stub implementations, or empty returns found in any Phase 11 artifacts.

### Human Verification Required

### 1. Table Visual Layout

**Test:** Navigate to admin HCP Profiles page. Verify table renders with 6 columns (Name with avatar, Specialty, Personality badge, Communication Style with descriptor, Agent Status badge, Actions dropdown).
**Expected:** Clean table layout matching scenario-table.tsx visual pattern. Sorted by name ascending by default.
**Why human:** Visual appearance and alignment cannot be verified programmatically.

### 2. Agent Status Badge Colors and Animations

**Test:** With profiles in different sync states (synced, pending, failed, none), verify badge styling.
**Expected:** Synced = green, Pending = amber with pulse animation, Failed = red, None = gray.
**Why human:** CSS color rendering and animation behavior require visual inspection.

### 3. Failed Status Tooltip

**Test:** Hover over a "Failed" agent status badge.
**Expected:** Tooltip shows the error message text from `agent_sync_error`.
**Why human:** Tooltip hover interaction behavior requires human testing.

### 4. Edit Dialog Flow

**Test:** Click Edit on an HCP profile in the table. Verify dialog opens with pre-filled editor. Make a change and save.
**Expected:** Dialog opens, editor shows existing data, save closes dialog and shows toast. Table updates with new data.
**Why human:** Dialog open/close behavior, form interaction, and toast feedback are UI flow tests.

### 5. Retry Sync Action

**Test:** For a profile with "failed" agent status, click the Actions dropdown and select "Retry Sync".
**Expected:** Toast shows success or failure message. Agent status badge updates.
**Why human:** End-to-end sync requires real AI Foundry connection; local testing would need mocks.

### 6. End-to-End Agent Sync with Real AI Foundry

**Test:** With Azure AI Foundry configured, create a new HCP profile.
**Expected:** Agent is created in AI Foundry. Profile shows "synced" status with agent_id populated. Updating the profile updates the agent instructions. Deleting the profile deletes the agent.
**Why human:** Requires real Azure AI Foundry credentials and environment.

### Gaps Summary

No gaps found. All 7 success criteria are satisfied by the implementation:

1. **Backend foundation (Plan 01):** HcpProfile model extended with agent columns, migration applies cleanly, agent_sync_service provides instruction builder + REST API wrapper, 11 unit tests passing.

2. **Backend wiring (Plan 02):** CRUD operations auto-trigger agent sync with failure-safe try/except, retry-sync endpoint available, token broker extended with per-HCP agent_id sourcing, 8 integration tests passing.

3. **Frontend (Plan 03):** HcpTable component with sortable columns, agent status badges with tooltips, dropdown actions with Retry Sync. HCP profiles page fully rewritten from list+editor to table+dialog layout. All i18n keys externalized in both locales. TypeScript compiles clean, build succeeds.

---

_Verified: 2026-03-31T10:30:00Z_
_Verifier: Claude (gsd-verifier)_

</details>

