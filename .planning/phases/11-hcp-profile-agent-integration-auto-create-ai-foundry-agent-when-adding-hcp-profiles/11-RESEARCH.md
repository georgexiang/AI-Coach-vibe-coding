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
