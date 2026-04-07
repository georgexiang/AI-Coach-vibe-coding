# Phase 15: HCP Editor Agent Config Center - Research

**Researched:** 2026-04-07
**Domain:** React frontend refactoring + FastAPI backend endpoint + i18n
**Confidence:** HIGH

## Summary

Phase 15 is a frontend-heavy refactoring phase that transforms the HCP Profile Editor's tab structure to align with Azure AI Foundry's Agent editing experience. The core work involves: (1) removing two placeholder tabs (Knowledge, Tools), (2) rebuilding the Voice & Avatar tab as a two-panel Agent configuration center with left-side controls and right-side Playground preview, and (3) adding a new backend endpoint to preview auto-generated instructions.

The codebase already has nearly all building blocks in place. The VL Instance Editor page (`vl-instance-editor.tsx`) implements a nearly identical Playground pattern with `AvatarView`, `AudioOrb`, `useVoiceLive`, `useAvatarStream`, `useAudioHandler`, and transcript display. The `VoiceLiveModelSelect` component provides tiered model selection. The `build_agent_instructions` function in `agent_sync_service.py` handles instruction generation with override priority. The only net-new backend work is a preview endpoint that calls `build_agent_instructions` with profile form data and returns the generated text.

**Primary recommendation:** Extract the Playground preview panel from `vl-instance-editor.tsx` into a reusable component, then compose the new Voice & Avatar tab as a left-right split layout importing existing components (`VoiceLiveModelSelect`, VL Instance selector, Instructions textarea, and the new Playground panel).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Tab structure: remove Knowledge and Tools tabs, keep Profile and Voice & Avatar only
- Voice & Avatar tab left panel: Model Deployment selector, Voice Mode toggle + VL Instance selector, Instructions area (auto-generate + editable override), Knowledge & Tools inline config
- Voice & Avatar tab right panel: Playground preview (avatar/audio orb + Start button + transcript)
- Backend: to_prompt_dict() must include agent_instructions_override; new GET endpoint for instructions preview
- i18n: new keys for model deployment, voice mode toggle, instructions area (en-US + zh-CN)

### Claude's Discretion
- Knowledge & Tools inline section UI component details
- Playground audio orb animation effect
- Instructions auto-generation API call timing (realtime vs on-demand)

### Deferred Ideas (OUT OF SCOPE)
- Knowledge area full file upload functionality (UI skeleton only, backend integration later)
- Tools area full Function Call configuration (UI skeleton only)
- Playground full real-time conversation functionality (UI structure + Start button first)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HCP-15-01 | HCP editor has only Profile and Voice & Avatar tabs (Knowledge/Tools removed) | Direct code change in `hcp-profile-editor.tsx` lines 285-554 -- remove 2 TabsTrigger + 2 TabsContent blocks and unused imports |
| HCP-15-02 | Voice & Avatar tab left panel: Model Deployment + Voice Mode toggle + VL Instance + Instructions | Reuse `VoiceLiveModelSelect`, existing VL Instance assign/unassign hooks, existing `agent_instructions_override` form field; new preview endpoint |
| HCP-15-03 | Voice & Avatar tab right panel: Playground preview with avatar/orb + Start + transcript | Extract from `vl-instance-editor.tsx` (lines 248-367) -- `AvatarView`, `AudioOrb`, `useVoiceLive`, `useAvatarStream`, `useAudioHandler` already exist |
| HCP-15-04 | Instructions magic wand button calls build_agent_instructions to regenerate | New backend `POST /{profile_id}/preview-instructions` endpoint calling `build_agent_instructions`; frontend hook + button |
| HCP-15-05 | Tests + i18n (en-US + zh-CN) + TypeScript compilation passes | Follow existing test patterns; add i18n keys to both locale files |
</phase_requirements>

## Standard Stack

### Core (already installed -- no new packages needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3+ | UI framework | Project standard [VERIFIED: codebase] |
| react-hook-form | existing | Form state management | Used across all admin forms [VERIFIED: codebase] |
| zod | existing | Schema validation | Used with zodResolver in HCP editor [VERIFIED: codebase] |
| @tanstack/react-query | ^5.60 | Server state + mutations | Project standard [VERIFIED: codebase] |
| react-i18next | existing | i18n framework | Project standard since Phase 1 [VERIFIED: codebase] |
| lucide-react | ^0.460 | Icons (Wand2, Play, etc.) | Project icon library [VERIFIED: codebase] |
| FastAPI | >=0.115 | Backend API | Project standard [VERIFIED: codebase] |

### Supporting (reusable existing components)
| Component | Location | Purpose | Reuse Strategy |
|-----------|----------|---------|----------------|
| VoiceLiveModelSelect | `components/admin/voice-live-model-select.tsx` | Tiered model dropdown | Import directly |
| AudioOrb | `components/voice/audio-orb.tsx` | Voice-only animation | Import directly |
| AvatarView | `components/voice/avatar-view.tsx` | Avatar video + fallback | Import directly |
| useVoiceLive | `hooks/use-voice-live.ts` | WebSocket proxy hook | Import directly |
| useAvatarStream | `hooks/use-avatar-stream.ts` | WebRTC avatar stream | Import directly |
| useAudioHandler | `hooks/use-audio-handler.ts` | Mic input capture | Import directly |
| useAudioPlayer | `hooks/use-audio-player.ts` | Audio playback | Import directly |
| VoiceControls | `components/voice/voice-controls.tsx` | Mute/disconnect buttons | Import directly |
| useVoiceLiveInstances | `hooks/use-voice-live-instances.ts` | VL Instance CRUD hooks | Import directly |
| AVATAR_CHARACTER_MAP | `data/avatar-characters.ts` | Avatar metadata | Import directly |

**Installation:** No new packages required. This phase only uses existing dependencies. [VERIFIED: codebase analysis]

## Architecture Patterns

### Recommended Component Structure
```
frontend/src/
├── pages/admin/
│   └── hcp-profile-editor.tsx       # Modified: remove Knowledge/Tools tabs
├── components/admin/
│   ├── voice-avatar-tab.tsx          # REWRITE: 2-panel agent config center
│   ├── agent-config-left-panel.tsx   # NEW: left panel (model, voice mode, instructions)
│   ├── playground-preview-panel.tsx  # NEW: right panel (avatar/orb + start + transcript)
│   └── instructions-section.tsx      # NEW: auto-gen + override + magic wand
├── hooks/
│   └── use-hcp-profiles.ts           # Modified: add usePreviewInstructions hook
└── api/
    └── hcp-profiles.ts               # Modified: add previewInstructions API call
```

### Pattern 1: Two-Panel Split Layout
**What:** Voice & Avatar tab uses CSS Grid with `grid-cols-1 lg:grid-cols-2` for responsive left-right split.
**When to use:** Admin editor pages that need both configuration controls and live preview.
**Example:**
```typescript
// Source: existing pattern from vl-instance-editor.tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div className="space-y-4"> {/* Left: Config controls */}
    <AgentConfigLeftPanel />
  </div>
  <div className="sticky top-4"> {/* Right: Playground preview */}
    <PlaygroundPreviewPanel />
  </div>
</div>
```

### Pattern 2: Instructions Auto-Generate with Override
**What:** Display auto-generated instructions text, allow user to type an override, provide magic wand button to re-generate.
**When to use:** When system prompt is derived from structured data but users may want customization.
**Backend flow:**
```python
# Source: agent_sync_service.py build_agent_instructions() [VERIFIED: codebase]
# 1. If agent_instructions_override is non-empty -> return override
# 2. Otherwise -> format DEFAULT_AGENT_TEMPLATE with profile data
```
**Frontend flow:**
1. On tab load, call `GET /api/v1/hcp-profiles/{id}/preview-instructions` to get auto-generated text
2. Show in read-only textarea (collapsed/dimmed when override is active)
3. Override textarea bound to `agent_instructions_override` form field
4. Magic wand button: re-call preview endpoint, show result in auto-gen area

### Pattern 3: Playground Panel Extraction
**What:** Extract test session logic from `vl-instance-editor.tsx` into a reusable Playground component.
**Why:** The VL Instance Editor page (lines 248-367) already implements the complete pattern: `useVoiceLive` + `useAvatarStream` + `useAudioHandler` + transcript accumulation + start/stop logic. The HCP editor needs the exact same functionality.
**Interface:**
```typescript
interface PlaygroundPreviewPanelProps {
  hcpProfileId?: string;
  vlInstanceId?: string;
  systemPrompt?: string;
  avatarCharacter?: string;
  avatarStyle?: string;
  avatarEnabled: boolean;
  disabled?: boolean;  // true for new profiles (no id yet)
}
```

### Anti-Patterns to Avoid
- **Duplicating Playground code:** Do NOT copy-paste the test session logic from `vl-instance-editor.tsx`. Extract into a shared component.
- **Inlining useQuery in components:** Follow project convention -- all queries go through hooks in `hooks/` directory. [VERIFIED: CLAUDE.md rule]
- **Static route ordering violation:** Any new endpoint added to `hcp_profiles.py` must come BEFORE `/{profile_id}` routes. Add `preview-instructions` route after `batch-sync` but before `/{profile_id}`. [VERIFIED: CLAUDE.md Gotcha #3]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model tier dropdown | Custom select with tiers | `VoiceLiveModelSelect` component | Already groups models by Pro/Standard/Lite tiers with i18n [VERIFIED: codebase] |
| Audio visualization | CSS animation from scratch | `AudioOrb` component | Already matches AI Foundry style with listening/speaking states [VERIFIED: codebase] |
| Avatar preview | Manual video element management | `AvatarView` component | Handles WebRTC video, static thumbnail fallback, AudioOrb fallback [VERIFIED: codebase] |
| Voice Live WebSocket | Raw WebSocket code | `useVoiceLive` hook | Complete proxy flow with reconnect, transcript, audio delta [VERIFIED: codebase] |
| VL Instance assignment | Custom mutation logic | `useAssignVoiceLiveInstance` / `useUnassignVoiceLiveInstance` hooks | Already handle cache invalidation for both VL and HCP query keys [VERIFIED: codebase] |
| Instructions generation | Frontend string templating | Backend `build_agent_instructions()` | Server-side generation ensures consistency with agent sync [VERIFIED: codebase] |

**Key insight:** This phase is primarily a UI restructuring and composition phase. Nearly every functional building block already exists in the codebase. The risk is in duplicating rather than reusing existing components.

## Common Pitfalls

### Pitfall 1: to_prompt_dict() Missing agent_instructions_override
**What goes wrong:** The CONTEXT.md explicitly calls out that `to_prompt_dict()` needs to include `agent_instructions_override`. Currently it does NOT (verified in `hcp_profile.py` lines 84-100).
**Why it happens:** `to_prompt_dict()` was originally designed for system prompt construction and predates the override field.
**How to avoid:** Add `agent_instructions_override` to the return dict in `to_prompt_dict()`. The `build_agent_instructions` function already checks for it (line 62-63 of `agent_sync_service.py`).
**Warning signs:** Instructions preview always returns template-generated text, never the override.

### Pitfall 2: Static Route Ordering in hcp_profiles.py
**What goes wrong:** New route `/{profile_id}/preview-instructions` added after `/{profile_id}` gets shadowed by the `/{profile_id}` route.
**Why it happens:** FastAPI matches the first route that fits the pattern.
**How to avoid:** Place the new endpoint after `batch-sync` (line 161) but before `/{profile_id}` (line 120). Better yet, use a path like `POST /{profile_id}/preview-instructions` which won't conflict because it uses POST and has a sub-path.
**Warning signs:** 404 or wrong handler executing.

### Pitfall 3: Form State Persistence Across Tabs
**What goes wrong:** Switching between Profile and Voice & Avatar tabs loses form state.
**Why it happens:** If Form wrapper doesn't encompass both tabs.
**How to avoid:** The current architecture already wraps `<Form {...form}>` around `<Tabs>` (line 276 of `hcp-profile-editor.tsx`). This pattern MUST be preserved. [VERIFIED: codebase decision from Phase 12]
**Warning signs:** Data entered in one tab disappears when switching.

### Pitfall 4: Playground Connecting Without Saved Profile
**What goes wrong:** Clicking Start on a new (unsaved) profile attempts WebSocket connection with no profile ID.
**Why it happens:** New profiles have `isNew=true` and no database ID.
**How to avoid:** Disable the Start button when `isNew` is true. Show helper text: "Save profile first to test."
**Warning signs:** WebSocket errors or empty sessions.

### Pitfall 5: Knowledge & Tools Inline Sections Scope Creep
**What goes wrong:** Building full file upload / function call UI instead of placeholder skeleton.
**Why it happens:** The CONTEXT.md's decision section mentions Knowledge & Tools inline config, but the Deferred section explicitly marks full functionality as out of scope.
**How to avoid:** Build collapsible sections with descriptive placeholder content only. No actual upload/API integration.
**Warning signs:** Sprint overrun, blocked on unbuilt backend features.

### Pitfall 6: Unused Imports After Tab Removal
**What goes wrong:** TypeScript compilation fails due to unused imports (`BookOpen`, `Wrench`) after removing Knowledge/Tools tabs.
**Why it happens:** Tab placeholder components imported icons that are no longer needed.
**How to avoid:** Clean up imports when removing tab content. `npx tsc -b` will catch these. [VERIFIED: CLAUDE.md pre-commit checklist]
**Warning signs:** Build failures in CI.

## Code Examples

### Backend: Instructions Preview Endpoint
```python
# Source: pattern derived from agent_sync_service.build_agent_instructions [VERIFIED: codebase]
# Place AFTER /batch-sync but BEFORE /{profile_id} routes

class InstructionsPreviewRequest(BaseModel):
    """Profile data for instructions generation preview."""
    name: str = ""
    specialty: str = ""
    hospital: str = ""
    title: str = ""
    personality_type: str = "friendly"
    emotional_state: int = 50
    communication_style: int = 50
    expertise_areas: list[str] = []
    prescribing_habits: str = ""
    concerns: str = ""
    objections: list[str] = []
    probe_topics: list[str] = []
    difficulty: str = "medium"
    agent_instructions_override: str = ""

class InstructionsPreviewResponse(BaseModel):
    """Generated instructions text."""
    instructions: str
    is_override: bool

@router.post("/preview-instructions", response_model=InstructionsPreviewResponse)
async def preview_instructions(
    body: InstructionsPreviewRequest,
    user: User = Depends(require_role("admin")),
):
    """Preview auto-generated agent instructions from profile data. Admin only."""
    from app.services.agent_sync_service import build_agent_instructions
    profile_data = body.model_dump()
    instructions = build_agent_instructions(profile_data)
    is_override = bool(body.agent_instructions_override and body.agent_instructions_override.strip())
    return InstructionsPreviewResponse(instructions=instructions, is_override=is_override)
```

### Frontend: Voice & Avatar Tab Layout
```typescript
// Source: composition pattern from vl-instance-editor.tsx [VERIFIED: codebase]
export function VoiceAvatarTab({ form, profile, isNew }: VoiceAvatarTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Panel: Configuration */}
      <div className="space-y-4">
        <AgentConfigLeftPanel form={form} profile={profile} isNew={isNew} />
      </div>
      {/* Right Panel: Playground Preview */}
      <div>
        <PlaygroundPreviewPanel
          hcpProfileId={profile?.id}
          vlInstanceId={form.watch("voice_live_instance_id") ?? undefined}
          systemPrompt={form.watch("agent_instructions_override") ?? ""}
          avatarCharacter={form.watch("avatar_character")}
          avatarStyle={form.watch("avatar_style")}
          avatarEnabled={!!form.watch("avatar_character")}
          disabled={isNew}
        />
      </div>
    </div>
  );
}
```

### Frontend: Instructions Section with Magic Wand
```typescript
// Source: pattern derived from existing form fields + new preview hook [VERIFIED: codebase]
import { Wand2 } from "lucide-react";

function InstructionsSection({ form, profileId }: { form: UseFormReturn<HcpFormValues>; profileId?: string }) {
  const { t } = useTranslation("admin");
  const [autoInstructions, setAutoInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const formValues = form.getValues();
      const result = await previewInstructions(formValues);
      setAutoInstructions(result.instructions);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{t("admin:hcp.autoInstructions")}</CardTitle>
          <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={isGenerating}>
            <Wand2 className="size-4 mr-1" />
            {isGenerating ? "..." : t("common:generate")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {autoInstructions && (
          <pre className="text-xs bg-muted/50 rounded p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
            {autoInstructions}
          </pre>
        )}
        <FormField
          control={form.control}
          name="agent_instructions_override"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin:hcp.overrideInstructions")}</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder={t("admin:hcp.overridePlaceholder")} {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 4 tabs (Profile, Voice & Avatar, Knowledge, Tools) | 2 tabs (Profile, Agent Config Center) | Phase 15 | Knowledge/Tools become inline sections in Voice & Avatar |
| Voice & Avatar tab = read-only VL preview (303 lines) | Voice & Avatar tab = full Agent config center (left+right panels) | Phase 15 | Major rewrite of `voice-avatar-tab.tsx` |
| No instructions preview API | POST /preview-instructions endpoint | Phase 15 | Enables magic wand button for instruction regeneration |
| `to_prompt_dict()` excludes override | `to_prompt_dict()` includes `agent_instructions_override` | Phase 15 | Fixes data flow for instruction preview |

**Deprecated/outdated:**
- Knowledge tab placeholder (added Phase 14-03, removed Phase 15)
- Tools tab placeholder (added Phase 14-03, removed Phase 15)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Wand2` icon exists in lucide-react ^0.460 for the magic wand button | Code Examples | LOW -- fallback to `Sparkles` or `RefreshCw` icon if not available |
| A2 | POST method for preview-instructions won't conflict with existing route patterns | Architecture | LOW -- POST to a static path before /{profile_id} is unambiguous |
| A3 | Knowledge & Tools inline sections should be collapsible Card components with placeholder content | Architecture | LOW -- CONTEXT.md says "inline in tab, not independent tab"; UI details are Claude's Discretion |

## Open Questions

1. **Instructions generation timing**
   - What we know: The magic wand button calls backend on-demand (CONTEXT.md: Claude's Discretion area)
   - What's unclear: Should auto-generated instructions load automatically when tab opens (initial load), or only when user clicks the wand?
   - Recommendation: Load on tab mount for existing profiles (cheap GET call), require explicit click for new profiles. This provides immediate feedback while keeping UX responsive.

2. **Playground test scope**
   - What we know: CONTEXT.md says "Start test button (reuse VL Instance Editor test logic)" and Deferred says "full real-time conversation first phase = UI structure + Start button"
   - What's unclear: Should the Start button actually connect to Voice Live (full test), or just show UI skeleton?
   - Recommendation: Implement full Start/Stop functionality by extracting from `vl-instance-editor.tsx`. The hooks already exist and the code is proven. Only defer if Azure credentials are not configured (show appropriate message).

3. **Playground preview for new profiles**
   - What we know: New profiles have no ID, can't test
   - What's unclear: Should we show a static avatar preview image even without a live connection?
   - Recommendation: Show static avatar thumbnail based on selected `avatar_character` + `avatar_style` from form state, with disabled Start button and helper text.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified -- this phase is code/config changes only using existing project dependencies).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | yes | `require_role("admin")` on new endpoint [VERIFIED: all HCP endpoints use this] |
| V5 Input Validation | yes | Pydantic schema validation on preview request body [VERIFIED: existing pattern] |
| V6 Cryptography | no | -- |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized instructions preview | Elevation of Privilege | `require_role("admin")` dependency [VERIFIED: codebase] |
| XSS via instructions override text | Tampering | React auto-escapes JSX; Textarea value is text-only [VERIFIED: React default] |

## Sources

### Primary (HIGH confidence)
- Codebase analysis of all files listed in CONTEXT.md canonical_refs -- verified current state of every component
- `hcp-profile-editor.tsx` (572 lines) -- current 4-tab structure, Form wrapping Tabs
- `voice-avatar-tab.tsx` (307 lines) -- current read-only VL preview, will be rewritten
- `vl-instance-editor.tsx` (~700+ lines) -- Playground test pattern to extract
- `agent_sync_service.py` (565 lines) -- `build_agent_instructions` function
- `hcp_profile.py` (100 lines) -- `to_prompt_dict()` missing override field
- `hcp_profiles.py` API router -- route ordering, existing endpoints

### Secondary (MEDIUM confidence)
- Project STATE.md accumulated decisions -- confirmed Form-wraps-Tabs pattern (Phase 12), VoiceAvatarTab rewrite (Phase 14)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all components already exist in codebase, no new dependencies
- Architecture: HIGH - pattern directly extracted from existing vl-instance-editor.tsx
- Pitfalls: HIGH - identified from concrete codebase analysis (route ordering, form state, missing field)

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable -- internal refactoring phase, no external API changes)
