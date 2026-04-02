# Phase 12: Voice Realtime API & Agent Mode Integration - Research

**Researched:** 2026-04-02
**Domain:** HCP digital persona configuration, Voice Live API session wiring, auto-mode + fallback chain
**Confidence:** HIGH

## Summary

Phase 12 extends HCP profiles into complete "digital persona" configurations that bundle voice, avatar, and conversation parameters alongside the existing AI Foundry Agent. The token broker API becomes the single integration point: it reads all per-HCP settings and returns them to the frontend, which auto-configures WebSocket and Avatar connections without manual mode selection. The fallback chain (Digital Human Realtime Agent -> Voice-only Realtime -> Text) replaces the current 7-mode ModeSelector with automatic degradation.

The codebase is well-structured for this extension. The HcpProfile ORM model needs ~12 new columns for voice/avatar settings. The VoiceLiveTokenResponse schema already returns voice_name, avatar_character, and agent_id -- these just need to be sourced from HCP profile data instead of global config. The frontend VoiceSession container already implements a basic fallback chain (avatar failure -> voice-only -> text); it needs refinement to consume per-HCP settings from the token broker and display a persistent mode status indicator.

**Primary recommendation:** Work bottom-up: database migration first, then backend schema/service extension, then frontend HCP editor tabs, then session wiring with auto-mode + fallback, then integration testing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full Voice Live settings stored per HCP profile: voice name, avatar character/style, temperature, turn detection (Server VAD), noise suppression, echo cancellation, EOU detection, recognition language, custom voice toggle, custom avatar toggle
- **D-02:** Agent instructions are auto-generated from HCP personality fields but admin can view and override the generated text in the HCP editor
- **D-03:** Avatar supports both predefined Azure Avatar characters (Lisa, Lori, Harry, etc. in dropdown) and custom avatars (character name with `customized: true` toggle) -- matching reference repo pattern
- **D-04:** New HCPs get smart defaults: voice "Ava", avatar "Lori-casual", temp 0.9, Server VAD, noise suppression off, echo cancellation off, EOU detection disabled, recognition language "Auto Detect". Admin can override per-HCP
- **D-05:** HCP editor uses tabbed layout with 3 tabs: "Profile" (existing personality/specialty/objections fields), "Voice & Avatar" (voice name, avatar character, conversation parameters), "Agent" (auto-generated + editable instructions text, agent sync status)
- **D-06:** HCP table adds a Voice+Avatar column showing voice name + avatar character as badges (e.g. "Ava / Lori-casual") or "Not configured" if missing
- **D-07:** Table maintains existing columns from Phase 11 (Name, Specialty, Personality, Agent Status) plus new Voice+Avatar column
- **D-08:** Token broker API returns all HCP voice/avatar settings (voice name, avatar character, conversation params) alongside auth token/endpoint. Frontend auto-configures WebSocket and Avatar connection from this single response
- **D-09:** MR cannot override HCP voice/avatar settings during a session -- settings are locked per-HCP for consistent experience
- **D-10:** Default to Digital Human Realtime Agent mode (best experience). MR does NOT see a mode picker -- system auto-selects based on HCP config and service availability
- **D-11:** Fallback chain: Digital Human Realtime Agent -> Voice-only Realtime -> Text mode. Triggered when avatar service unavailable or network degraded
- **D-12:** Fallback notification: toast alert for the initial fallback event ("Avatar unavailable, switching to voice mode") PLUS persistent status indicator showing current active mode throughout the session

### Claude's Discretion
- Exact DB column types and migration details for new HCP voice/avatar fields
- Default avatar/voice options list (can derive from Azure documentation)
- Tab component implementation details (reuse existing Tabs from UI library)
- WebSocket reconnection strategy on network recovery
- Status indicator component design

### Deferred Ideas (OUT OF SCOPE)
- Developer mode toggle for MRs to override HCP settings during debug sessions
- Per-session provider override -- always use HCP-level config for now
- Azure AD token auth (DefaultAzureCredential) for Entra token acquisition
- Multiple avatar characters per HCP (wardrobe selection)
- Voice cloning / custom neural voice training
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy 2.0 (async) | >=2.0.0 | ORM model extension for voice/avatar fields | Already in use, async throughout |
| Alembic | >=1.13.0 | Database migration for new columns | Required by project rules |
| Pydantic v2 | >=2.0.0 | Schema extension for voice/avatar fields | Already in use for all schemas |
| @radix-ui/react-tabs | (via project UI lib) | Tabbed HCP editor layout | Already available as `Tabs` component |
| react-hook-form + zod | (via project) | Form validation for voice/avatar settings tab | Already used in HCP editor |
| rt-client | 0.5.2 | Voice Live WebSocket connection | Already installed from reference repo |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | (via project) | Toast notifications for fallback alerts | Fallback chain notifications |
| lucide-react | >=0.460.0 | Icons for mode status indicator | Status indicator component |

### Alternatives Considered
None -- this phase extends existing infrastructure, not introducing new libraries.

## Architecture Patterns

### Recommended Project Structure

New/modified files organized by domain:

```
backend/
  alembic/versions/
    i12a_add_voice_avatar_fields_to_hcp_profile.py   # NEW: migration
  app/
    models/hcp_profile.py                              # EXTEND: ~12 new columns
    schemas/hcp_profile.py                             # EXTEND: voice/avatar fields
    schemas/voice_live.py                              # EXTEND: per-HCP fields in response
    services/voice_live_service.py                     # EXTEND: source settings from HCP
    services/hcp_profile_service.py                    # EXTEND: handle voice/avatar in CRUD
    api/voice_live.py                                  # EXTEND: accept hcp_profile_id param

frontend/
  src/
    types/hcp.ts                                       # EXTEND: voice/avatar fields
    types/voice-live.ts                                # EXTEND: new token response fields
    pages/admin/hcp-profile-editor.tsx                 # REWRITE: tabbed layout
    components/admin/hcp-table.tsx                     # EXTEND: Voice+Avatar column
    components/admin/voice-avatar-tab.tsx              # NEW: Voice & Avatar settings tab
    components/admin/agent-tab.tsx                     # NEW: Agent instructions tab
    components/voice/voice-session.tsx                 # EXTEND: auto-mode + per-HCP config
    components/voice/mode-status-indicator.tsx         # NEW: persistent mode badge
    components/voice/mode-selector.tsx                 # REMOVE: no longer needed (auto-mode)
    hooks/use-voice-token.ts                           # EXTEND: pass hcp_profile_id
    api/voice-live.ts                                  # EXTEND: pass hcp_profile_id to token
```

### Pattern 1: Per-HCP Token Broker Extension

**What:** Token broker reads HCP profile to source voice/avatar/conversation settings instead of global config.
**When to use:** Every voice session start.
**Example:**
```python
# Source: existing voice_live_service.py pattern, extended per D-08
async def get_voice_live_token(
    db: AsyncSession,
    hcp_profile_id: str | None = None,
) -> VoiceLiveTokenResponse:
    # ... existing config fetch ...

    # Source voice/avatar from HCP profile (D-08)
    if hcp_profile_id:
        profile = await hcp_profile_service.get_hcp_profile(db, hcp_profile_id)
        voice_name = profile.voice_name or "en-US-AvaNeural"
        avatar_character = profile.avatar_character or "lori"
        avatar_style = profile.avatar_style or "casual"
        avatar_customized = profile.avatar_customized
        temperature = profile.voice_temperature or 0.9
        # ... etc for all conversation params

    return VoiceLiveTokenResponse(
        # ... existing fields ...
        voice_name=voice_name,
        avatar_character=avatar_character,
        avatar_style=avatar_style,
        avatar_customized=avatar_customized,
        temperature=temperature,
        turn_detection_type=turn_detection_type,
        noise_suppression=noise_suppression,
        echo_cancellation=echo_cancellation,
        eou_detection=eou_detection,
        recognition_language=recognition_language,
    )
```

### Pattern 2: Auto-Mode with Fallback Chain (D-10, D-11)

**What:** Frontend automatically selects the best mode based on HCP config and service availability. No ModeSelector exposed to MR.
**When to use:** Session initialization in VoiceSession container.
**Example:**
```typescript
// Source: existing voice-session.tsx fallback pattern, refined per D-10/D-11
const resolveMode = (tokenData: VoiceLiveToken): SessionMode => {
  // D-10: Default to Digital Human Realtime Agent (best experience)
  if (tokenData.avatar_enabled && tokenData.agent_id) {
    return "digital_human_realtime_agent";
  }
  if (tokenData.avatar_enabled) {
    return "digital_human_realtime_model";
  }
  if (tokenData.agent_id) {
    return "voice_realtime_agent";
  }
  return "voice_realtime_model";
};

// D-11: Fallback chain on connection failure
// Avatar fails -> voice-only; Voice fails -> text
```

### Pattern 3: Tabbed HCP Editor (D-05)

**What:** Replace current single-page editor with 3-tab layout using existing Radix Tabs.
**When to use:** HCP profile create/edit page.
**Example:**
```typescript
// Source: existing Tabs component from @/components/ui/tabs
<Tabs defaultValue="profile">
  <TabsList>
    <TabsTrigger value="profile">Profile</TabsTrigger>
    <TabsTrigger value="voice-avatar">Voice & Avatar</TabsTrigger>
    <TabsTrigger value="agent">Agent</TabsTrigger>
  </TabsList>
  <TabsContent value="profile">
    {/* Existing personality/specialty/objections fields */}
  </TabsContent>
  <TabsContent value="voice-avatar">
    <VoiceAvatarTab form={form} />
  </TabsContent>
  <TabsContent value="agent">
    <AgentTab profile={profile} onRetrySync={handleRetrySync} />
  </TabsContent>
</Tabs>
```

### Anti-Patterns to Avoid
- **Exposing mode picker to MR (D-09/D-10):** MRs must NOT manually select voice/avatar modes. System auto-selects.
- **Global voice/avatar config fallback:** Always source from HCP profile. Only fall back to global defaults when HCP has no configuration.
- **Mixing tab state with form state:** All voice/avatar fields must be part of the single react-hook-form instance, not separate state.
- **Storing avatar settings in a separate table:** Keep all HCP digital persona fields in the same `hcp_profiles` table -- simpler queries, no joins needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tabbed layout | Custom tab switching logic | Radix Tabs (`@/components/ui/tabs`) | Already in UI library, accessible, keyboard-navigable |
| Avatar character list | Hardcoded constants | Azure standard avatars list from docs | Authoritative source, characters updated by Microsoft |
| Form validation for new fields | Manual validation in handlers | zod schema extension in existing HCP form | Already established pattern in hcp-profile-editor.tsx |
| WebSocket session config | Manual JSON construction | Extend existing `useVoiceLive` hook | Hook already builds session config from tokenData |
| Persistent mode indicator | Custom status component | Badge + cn() from existing UI primitives | Consistent with existing badge patterns in the project |

## Common Pitfalls

### Pitfall 1: SQLite batch_alter_table Required for Adding Columns
**What goes wrong:** Alembic `op.add_column()` fails on SQLite for certain operations.
**Why it happens:** SQLite doesn't fully support ALTER TABLE. The project already uses batch operations.
**How to avoid:** Use `with op.batch_alter_table("hcp_profiles") as batch_op:` for all column additions, with `server_default` on every column.
**Warning signs:** Migration fails locally but would work on PostgreSQL.

### Pitfall 2: Token Broker Must Pass hcp_profile_id from Frontend
**What goes wrong:** Token broker returns global config instead of per-HCP settings because hcp_profile_id is not passed.
**Why it happens:** The current `POST /voice-live/token` endpoint doesn't accept hcp_profile_id. The voice session page gets session data which includes scenario_id, and scenario has hcp_profile_id.
**How to avoid:** Extend the token endpoint to accept `hcp_profile_id` as a query parameter or request body field. Wire it through from VoiceSessionPage -> useVoiceToken -> fetchVoiceLiveToken -> API.
**Warning signs:** All HCPs use the same voice/avatar during sessions.

### Pitfall 3: Avatar Character vs Style are Separate Fields
**What goes wrong:** Avatar character and style are concatenated or confused (e.g., "lori-casual" vs character="lori" style="casual").
**Why it happens:** Azure Avatar API requires `character` and `style` as separate fields in the session config JSON. The reference screenshots show them combined in UI display.
**How to avoid:** Store `avatar_character` and `avatar_style` as separate DB columns. Display combined in table badges. Send separate in WebSocket session config.
**Warning signs:** Avatar fails to render because character name includes the style suffix.

### Pitfall 4: Form Reset on Tab Switch Loses Unsaved Changes
**What goes wrong:** Switching tabs resets form fields if each tab has its own form state.
**Why it happens:** Multiple form instances or conditional rendering that unmounts tab content.
**How to avoid:** Use a single react-hook-form instance that spans all tabs. Radix Tabs renders all TabsContent in DOM by default (just hidden), so form state persists across tab switches.
**Warning signs:** Admin fills voice settings, switches to Profile tab, switches back, and settings are gone.

### Pitfall 5: Lazy Import for hcp_profile_service in voice_live_service
**What goes wrong:** Circular import error when voice_live_service imports hcp_profile_service at module level.
**Why it happens:** Already documented as Phase 11 decision -- voice_live_service uses lazy import inside the function body.
**How to avoid:** Continue using the existing lazy import pattern: `from app.services import hcp_profile_service` inside the function, not at module level.
**Warning signs:** ImportError on server startup.

### Pitfall 6: Avatar Session Config Structure Must Match Azure API
**What goes wrong:** Avatar doesn't render because session config JSON structure doesn't match Azure Voice Live API expected format.
**Why it happens:** The avatar config in session.update requires specific nested structure: `{ character, style, customized, video: { codec, crop, resolution } }`.
**How to avoid:** Use the exact Azure API structure from the Voice Live how-to docs. The existing `useVoiceLive` hook already sends avatar config but without `style` and `customized` fields -- extend it.
**Warning signs:** WebSocket connection succeeds but avatar video stream never starts.

## Code Examples

### Azure Voice Live Session Config with Per-HCP Settings
```json
{
  "instructions": "You are Dr. Zhang, an Oncology specialist...",
  "turn_detection": {
    "type": "server_vad",
    "silence_duration_ms": 500
  },
  "input_audio_noise_reduction": {"type": "azure_deep_noise_suppression"},
  "input_audio_echo_cancellation": {"type": "server_echo_cancellation"},
  "voice": {
    "name": "en-US-Ava:DragonHDLatestNeural",
    "type": "azure-standard",
    "temperature": 0.9
  },
  "input_audio_transcription": {
    "model": "azure-speech",
    "language": "zh-CN"
  },
  "avatar": {
    "character": "lori",
    "style": "casual",
    "customized": false,
    "video": {
      "codec": "h264",
      "crop": {"top_left": [560, 0], "bottom_right": [1360, 1080]}
    }
  },
  "agent_id": "dr-zhang-oncology",
  "project_name": "ai-coach-project"
}
```
Source: Azure Voice Live API how-to docs (https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to)

### Azure Standard Video Avatar Characters (for dropdown)
```typescript
// Source: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/standard-avatars
const AVATAR_VIDEO_CHARACTERS = [
  { character: "harry",  styles: ["business", "casual", "youthful"] },
  { character: "jeff",   styles: ["business", "formal"] },
  { character: "lisa",   styles: ["casual-sitting", "graceful-sitting", "graceful-standing", "technical-sitting", "technical-standing"] },
  { character: "lori",   styles: ["casual", "graceful", "formal"] },
  { character: "max",    styles: ["business", "casual", "formal"] },
  { character: "meg",    styles: ["formal", "casual", "business"] },
] as const;

// Note: Photo avatars (Adrian, Amara, Bianca, etc.) are also available but only at 512x512 resolution.
// Video avatars are recommended for this project due to 1920x1080 resolution.
```

### HCP Profile Voice/Avatar DB Columns
```python
# Source: Derived from D-01 and Azure Voice Live session config
# All columns use server_default for SQLite compatibility with existing rows

# Voice settings
voice_name: Mapped[str] = mapped_column(String(200), default="en-US-AvaNeural")
voice_type: Mapped[str] = mapped_column(String(50), default="azure-standard")
voice_temperature: Mapped[float] = mapped_column(default=0.9)
voice_custom: Mapped[bool] = mapped_column(Boolean, default=False)

# Avatar settings
avatar_character: Mapped[str] = mapped_column(String(100), default="lori")
avatar_style: Mapped[str] = mapped_column(String(100), default="casual")
avatar_customized: Mapped[bool] = mapped_column(Boolean, default=False)

# Conversation parameters
turn_detection_type: Mapped[str] = mapped_column(String(50), default="server_vad")
noise_suppression: Mapped[bool] = mapped_column(Boolean, default=False)
echo_cancellation: Mapped[bool] = mapped_column(Boolean, default=False)
eou_detection: Mapped[bool] = mapped_column(Boolean, default=False)
recognition_language: Mapped[str] = mapped_column(String(20), default="auto")

# Agent instruction override (D-02)
agent_instructions_override: Mapped[str] = mapped_column(Text, default="")
```

### Extended VoiceLiveTokenResponse Schema
```python
# Source: Extend existing backend/app/schemas/voice_live.py
class VoiceLiveTokenResponse(BaseModel):
    # Existing fields
    endpoint: str
    token: str
    region: str
    model: str
    avatar_enabled: bool
    avatar_character: str
    voice_name: str
    agent_id: str | None = None
    project_name: str | None = None

    # New per-HCP fields (D-08)
    avatar_style: str = "casual"
    avatar_customized: bool = False
    voice_type: str = "azure-standard"
    voice_temperature: float = 0.9
    turn_detection_type: str = "server_vad"
    noise_suppression: bool = False
    echo_cancellation: bool = False
    eou_detection: bool = False
    recognition_language: str = "auto"
```

### Turn Detection Types (for dropdown)
```typescript
// Source: Azure Voice Live API how-to docs
const TURN_DETECTION_TYPES = [
  { value: "server_vad", label: "Server VAD" },
  { value: "semantic_vad", label: "Semantic VAD (gpt-realtime only)" },
  { value: "azure_semantic_vad", label: "Azure Semantic VAD (all models)" },
  { value: "azure_semantic_vad_multilingual", label: "Azure Semantic VAD Multilingual" },
] as const;
```

### Voice Name Options (common Azure TTS voices)
```typescript
// Source: Azure Speech TTS voice list (commonly used for Chinese + English)
const VOICE_NAME_OPTIONS = [
  // English voices
  { value: "en-US-AvaNeural", label: "Ava (EN-US)" },
  { value: "en-US-Ava:DragonHDLatestNeural", label: "Ava HD (EN-US)" },
  { value: "en-US-AndrewNeural", label: "Andrew (EN-US)" },
  { value: "en-US-JennyNeural", label: "Jenny (EN-US)" },
  // Chinese voices
  { value: "zh-CN-XiaoxiaoMultilingualNeural", label: "Xiaoxiao Multilingual (ZH-CN)" },
  { value: "zh-CN-XiaoxiaoNeural", label: "Xiaoxiao (ZH-CN)" },
  { value: "zh-CN-YunxiNeural", label: "Yunxi (ZH-CN)" },
  { value: "zh-CN-YunjianNeural", label: "Yunjian (ZH-CN)" },
] as const;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global voice/avatar config | Per-HCP voice/avatar config | Phase 12 | Each HCP is a complete digital persona |
| 7-mode manual selector | Auto-mode with fallback chain | Phase 12 | MRs never see mode picker |
| server_vad only | Multiple turn detection types | Voice Live API 2025-10 | azure_semantic_vad works with all models |
| Single avatar character globally | Per-HCP avatar character + style | Phase 12 | Different HCPs look different |
| h264 only codec | h264 remains default (Video Avatar) | Current | Photo Avatar supports vp9 but lower res |

**Azure Voice Live API supported models (current):**
- gpt-realtime, gpt-realtime-mini, gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-5, gpt-5-mini, gpt-5-nano, gpt-5-chat, phi4-mm-realtime, phi4-mini

**Turn detection types available:**
- `server_vad` (default, all models)
- `semantic_vad` (gpt-realtime/gpt-realtime-mini only)
- `azure_semantic_vad` (all models, Voice Live specific)
- `azure_semantic_vad_multilingual` (all models, multilingual support)

## Open Questions

1. **Avatar style naming format**
   - What we know: Azure API uses separate `character` and `style` fields (e.g., character="lisa", style="casual-sitting"). The existing codebase stores `avatar_character` as a combined string like "Lisa-casual-sitting".
   - What's unclear: Should we store combined (backward compatible) or split (matches API)?
   - Recommendation: Store split (`avatar_character` + `avatar_style`) to match Azure API structure. Combine for display only. The migration can default `avatar_character="lori"` and `avatar_style="casual"`.

2. **Recognition language "Auto Detect" value**
   - What we know: Azure Voice Live docs show `"language": "en"` for explicit language. D-04 says default "Auto Detect".
   - What's unclear: The exact value for auto-detect in the Azure API (empty string? omit the field?).
   - Recommendation: Use empty string `""` or omit `language` field from `input_audio_transcription` config when "auto" is selected. Store `"auto"` in DB, translate to API format at WebSocket config time.

3. **Whether to keep ModeSelector component**
   - What we know: D-10 says MR does NOT see a mode picker. But the admin/debug use case was deferred.
   - What's unclear: Should mode-selector.tsx be deleted or just hidden from MR view?
   - Recommendation: Keep the file but do not render it in the voice session. The auto-mode logic replaces its function. The component can be restored later if developer mode is implemented.

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
- Current Alembic head: `b820e86271f8`

### Pre-Commit Checklist
- Backend: `ruff check .`, `ruff format --check .`, `pytest -v`
- Frontend: `npx tsc -b`, `npm run build`

## Sources

### Primary (HIGH confidence)
- Azure Voice Live API how-to: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to -- session.update config structure, turn detection types, voice config, avatar config, noise suppression, echo cancellation
- Azure Standard Avatars: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/standard-avatars -- full character list with styles (Harry, Jeff, Lisa, Lori, Max, Meg + photo avatars)
- Azure Voice Live overview: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live -- supported models, pricing tiers, feature list
- Existing codebase files (all read directly):
  - `backend/app/models/hcp_profile.py` -- current ORM model
  - `backend/app/schemas/hcp_profile.py` -- current Pydantic schemas
  - `backend/app/services/voice_live_service.py` -- current token broker
  - `backend/app/schemas/voice_live.py` -- current token response schema
  - `backend/app/services/hcp_profile_service.py` -- CRUD with agent sync hooks
  - `backend/app/services/agent_sync_service.py` -- agent instructions builder
  - `frontend/src/hooks/use-voice-live.ts` -- WebSocket session config builder
  - `frontend/src/hooks/use-avatar-stream.ts` -- WebRTC avatar connection
  - `frontend/src/components/voice/voice-session.tsx` -- session container with fallback
  - `frontend/src/components/voice/mode-selector.tsx` -- 7-mode selector (to be replaced)
  - `frontend/src/pages/admin/hcp-profile-editor.tsx` -- current editor layout
  - `frontend/src/components/admin/hcp-table.tsx` -- current table columns
  - `frontend/src/types/hcp.ts` -- HCP TypeScript types
  - `frontend/src/types/voice-live.ts` -- Voice Live types
  - `frontend/src/components/ui/tabs.tsx` -- Radix Tabs available in UI library
  - `backend/app/services/region_capabilities.py` -- region/service availability maps

### Secondary (MEDIUM confidence)
- Azure OpenAI Realtime API reference (linked from Voice Live docs) -- base event format that Voice Live extends

### Tertiary (LOW confidence)
- Voice name list is a commonly-used subset, not exhaustive. Azure has 600+ standard voices. The admin should have a text input with the dropdown as suggestions, not a locked select.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in the project, no new dependencies
- Architecture: HIGH - extending well-established patterns (token broker, HCP CRUD, form hooks)
- Pitfalls: HIGH - based on direct codebase reading and established project conventions
- Azure API config structure: HIGH - verified from official Microsoft documentation (updated 2026-02-04 / 2026-03-16)

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- Azure Voice Live API is GA, avatar characters list stable)
