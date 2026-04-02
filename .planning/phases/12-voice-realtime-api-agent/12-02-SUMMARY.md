---
phase: 12-voice-realtime-api-agent
plan: 02
subsystem: ui
tags: [react, typescript, i18n, tabs, voice, avatar, hcp, admin, react-hook-form, zod]

# Dependency graph
requires:
  - phase: 12-voice-realtime-api-agent-01
    provides: Backend voice/avatar columns on HcpProfile, token broker with hcp_profile_id support
provides:
  - Extended TypeScript HcpProfile and VoiceLiveToken types with voice/avatar fields
  - VoiceAvatarTab component for per-HCP voice, avatar, and conversation parameter configuration
  - AgentTab component with agent status, auto-generated instructions preview, and override textarea
  - Tabbed HCP editor (3 tabs replacing 3-column layout)
  - Voice & Avatar column in HCP table with badge pair display
  - i18n keys for admin and voice namespaces in en-US and zh-CN
affects: [12-voice-realtime-api-agent-03, 12-voice-realtime-api-agent-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tabbed form layout with single react-hook-form instance spanning all tabs"
    - "Type-safe zod schema with .default() for all voice/avatar fields"
    - "Dynamic avatar style filtering based on selected character"

key-files:
  created:
    - frontend/src/components/admin/voice-avatar-tab.tsx
    - frontend/src/components/admin/agent-tab.tsx
  modified:
    - frontend/src/types/hcp.ts
    - frontend/src/types/voice-live.ts
    - frontend/src/api/voice-live.ts
    - frontend/src/hooks/use-voice-token.ts
    - frontend/src/pages/admin/hcp-profile-editor.tsx
    - frontend/src/components/admin/hcp-table.tsx
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json
    - frontend/public/locales/en-US/voice.json
    - frontend/public/locales/zh-CN/voice.json

key-decisions:
  - "Used Resolver type cast on zodResolver to resolve TS5 type incompatibility between @hookform/resolvers v5 and FormProvider"
  - "Exported HcpFormValues type from hcp-profile-editor for reuse in VoiceAvatarTab and AgentTab"
  - "Used .default() instead of .optional() for zod string fields to produce consistent string types"
  - "Avatar style auto-updates when character changes via AVATAR_VIDEO_CHARACTERS constant lookup"

patterns-established:
  - "Tabbed admin form: Form wraps Tabs, not individual TabsContent, for cross-tab state persistence"
  - "Voice/avatar constants defined in component file for colocation with UI rendering logic"
  - "Client-side instruction preview in AgentTab using buildPreviewInstructions utility"

requirements-completed: [VOICE-12-03, VOICE-12-05]

# Metrics
duration: 12min
completed: 2026-04-02
---

# Phase 12 Plan 02: Frontend HCP Digital Persona Admin Summary

**Tabbed HCP editor with VoiceAvatarTab (8 voice/avatar controls), AgentTab (status + instructions), and Voice+Avatar table column with i18n for en-US/zh-CN**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-02T08:49:39Z
- **Completed:** 2026-04-02T09:01:39Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- Extended HcpProfile TypeScript type with 13 voice/avatar/agent fields and VoiceLiveToken with 11 per-HCP fields
- Created VoiceAvatarTab component with voice name select, avatar character/style dropdowns, temperature slider, 5 switches, and recognition language select
- Created AgentTab component with agent status card (moved from sidebar), auto-generated instructions preview, and editable override textarea
- Rewrote HCP editor from 3-column grid to 3-tab layout (Profile, Voice & Avatar, Agent) with single form instance
- Added Voice & Avatar column to HCP table showing badge pair (voice label + avatar character-style) or "Not configured"
- Added 21 i18n keys to admin namespace and 5 keys to voice namespace in both en-US and zh-CN

## Task Commits

Each task was committed atomically:

1. **Task 1: TypeScript types, API client, i18n keys** - `0958d27` (feat)
2. **Task 2: VoiceAvatarTab + AgentTab components, HCP editor tabbed rewrite, HCP table column** - `b051323` (feat)

## Files Created/Modified
- `frontend/src/components/admin/voice-avatar-tab.tsx` - VoiceAvatarTab with 3 cards: Voice Settings, Avatar Settings, Conversation Parameters
- `frontend/src/components/admin/agent-tab.tsx` - AgentTab with Agent Status, Instructions Preview/Override, Metadata cards
- `frontend/src/types/hcp.ts` - HcpProfile and HcpProfileCreate extended with 13 voice/avatar fields
- `frontend/src/types/voice-live.ts` - VoiceLiveToken extended with 11 per-HCP configuration fields
- `frontend/src/api/voice-live.ts` - fetchVoiceLiveToken accepts optional hcpProfileId query parameter
- `frontend/src/hooks/use-voice-token.ts` - useMutation accepts string | undefined variable
- `frontend/src/pages/admin/hcp-profile-editor.tsx` - Rewritten to 3-tab Tabs layout with extended zod schema
- `frontend/src/components/admin/hcp-table.tsx` - Added Voice & Avatar column with Badge pair display
- `frontend/public/locales/en-US/admin.json` - 21 new i18n keys for tabs, voice settings, avatar settings
- `frontend/public/locales/zh-CN/admin.json` - Corresponding zh-CN translations
- `frontend/public/locales/en-US/voice.json` - modeStatus and fallback keys
- `frontend/public/locales/zh-CN/voice.json` - Corresponding zh-CN translations
- `frontend/src/components/voice/voice-session.tsx` - Fixed mutateAsync call for new signature
- `frontend/src/components/admin/hcp-editor.test.tsx` - Added voice/avatar mock fields
- `frontend/src/components/admin/hcp-list.test.tsx` - Added voice/avatar mock fields
- `frontend/src/components/admin/scenario-table.test.tsx` - Added voice/avatar mock fields
- `frontend/src/components/coach/scenario-card.test.tsx` - Added voice/avatar mock fields
- `frontend/src/components/coach/scenario-panel.test.tsx` - Added voice/avatar mock fields
- `frontend/src/hooks/use-voice-token.test.ts` - Fixed mutate() calls for new signature

## Decisions Made
- Used `Resolver<HcpFormValues>` type assertion on `zodResolver(hcpSchema)` to resolve known TS incompatibility between @hookform/resolvers v5 and FormProvider generic inference
- Exported `HcpFormValues` type from hcp-profile-editor for reuse in child tab components (VoiceAvatarTab, AgentTab)
- Changed zod schema fields from `.optional()` to `.default("")` for consistent non-undefined types in form values
- Avatar style select content dynamically filters based on selected character using AVATAR_VIDEO_CHARACTERS constant

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed voice-session.tsx mutateAsync call**
- **Found during:** Task 1 (TypeScript type check)
- **Issue:** Changing useVoiceToken mutation type to `string | undefined` made the zero-arg `mutateAsync()` call in voice-session.tsx a TS error
- **Fix:** Changed `tokenMutation.mutateAsync()` to `tokenMutation.mutateAsync(undefined)` in voice-session.tsx
- **Files modified:** frontend/src/components/voice/voice-session.tsx
- **Verification:** npx tsc -b passes
- **Committed in:** 0958d27 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed 5 test files with missing HcpProfile voice/avatar fields**
- **Found during:** Task 2 (build verification)
- **Issue:** Extending HcpProfile interface broke mock objects in 5 test files that were missing the 13 new required fields
- **Fix:** Added all 13 voice/avatar fields with defaults to each mock HcpProfile in test files
- **Files modified:** hcp-editor.test.tsx, hcp-list.test.tsx, scenario-table.test.tsx, scenario-card.test.tsx, scenario-panel.test.tsx
- **Verification:** npm run build succeeds
- **Committed in:** b051323 (Task 2 commit)

**3. [Rule 3 - Blocking] Fixed use-voice-token.test.ts mutate calls**
- **Found during:** Task 2 (build verification)
- **Issue:** Test calling `mutate()` without arguments fails since mutation now requires `string | undefined`
- **Fix:** Changed `result.current.mutate()` to `result.current.mutate(undefined)` in 2 test calls
- **Files modified:** frontend/src/hooks/use-voice-token.test.ts
- **Verification:** npm run build succeeds
- **Committed in:** b051323 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All auto-fixes were necessary downstream effects of the type changes. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components are fully wired to form data and i18n keys.

## Next Phase Readiness
- VoiceAvatarTab and AgentTab are ready for use in the editor
- Backend voice/avatar fields from Plan 01 are now fully represented in frontend types
- Token broker API client passes hcpProfileId for per-HCP voice configuration
- Plan 03 can build voice session connection using the extended VoiceLiveToken fields
- Plan 04 can implement fallback chain using the modeStatus i18n keys

---
*Phase: 12-voice-realtime-api-agent*
*Completed: 2026-04-02*
