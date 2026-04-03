---
phase: 13-voice-live-instance-agent-voice-management
plan: 02
subsystem: ui
tags: [react, typescript, i18n, voice-live, hcp-editor, dropdown, shadcn]

# Dependency graph
requires:
  - phase: 12-voice-realtime-api-agent
    provides: HcpProfile with voice_live_enabled, VoiceAvatarTab, HCP table
provides:
  - VoiceLiveModelSelect grouped dropdown component (12 models in 3 tiers)
  - HcpProfile type extended with voice_live_model field
  - VoiceLiveModelInfo/VoiceLiveModelsResponse types
  - Complete i18n keys for Voice Live management page (en-US/zh-CN)
  - HCP editor form schema with voice_live_model field
  - HCP table model badge display
affects: [13-03-voice-live-management-page, voice-live-config]

# Tech tracking
tech-stack:
  added: []
  patterns: [grouped-select-by-tier, model-options-constant-export]

key-files:
  created:
    - frontend/src/components/admin/voice-live-model-select.tsx
  modified:
    - frontend/src/types/hcp.ts
    - frontend/src/types/voice-live.ts
    - frontend/src/components/admin/voice-avatar-tab.tsx
    - frontend/src/pages/admin/hcp-profile-editor.tsx
    - frontend/src/components/admin/hcp-table.tsx
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json
    - frontend/public/locales/en-US/nav.json
    - frontend/public/locales/zh-CN/nav.json

key-decisions:
  - "VOICE_LIVE_MODEL_OPTIONS exported as named constant for reuse in HCP table badge lookup"
  - "Model tiers grouped as Pro/Basic/Lite matching AI Foundry portal terminology"
  - "Default model is gpt-4o (most commonly used in Pro tier)"

patterns-established:
  - "Grouped Select pattern: VOICE_LIVE_MODEL_OPTIONS with tier field, filtered per group in SelectGroup"
  - "Model badge in table: conditional render when voice_live_enabled && voice_live_model"

requirements-completed: [VOICE-13-01, VOICE-13-03]

# Metrics
duration: 5min
completed: 2026-04-03
---

# Phase 13 Plan 02: Voice Live Model Selection UI Summary

**VoiceLiveModelSelect grouped dropdown (12 models in Pro/Basic/Lite tiers) integrated into HCP editor Voice tab, form schema, and table badge with full en-US/zh-CN i18n**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-03T08:42:17Z
- **Completed:** 2026-04-03T08:47:17Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Created VoiceLiveModelSelect component with 12 models organized in 3 tier groups (Pro/Basic/Lite)
- Extended HcpProfile and HcpProfileCreate types with voice_live_model field
- Integrated model select dropdown into VoiceAvatarTab Voice Settings card
- Extended HCP editor form schema and defaultValues with voice_live_model (default: gpt-4o)
- Added model badge to HCP table Voice & Avatar column (shown when voice_live_enabled)
- Added complete i18n keys for Voice Live management page in both en-US and zh-CN
- Added VoiceLiveModelInfo/VoiceLiveModelsResponse types for future API integration

## Task Commits

Each task was committed atomically:

1. **Task 1: TypeScript types, VoiceLiveModelSelect component, i18n keys** - `4663640` (feat)
2. **Task 2: Integrate model select into VoiceAvatarTab, HCP editor schema, and HCP table** - `cac3303` (feat)

## Files Created/Modified
- `frontend/src/components/admin/voice-live-model-select.tsx` - New grouped dropdown component with 12 model options in 3 tiers
- `frontend/src/types/hcp.ts` - Added voice_live_model to HcpProfile and HcpProfileCreate
- `frontend/src/types/voice-live.ts` - Added VoiceLiveModelInfo and VoiceLiveModelsResponse interfaces
- `frontend/src/pages/admin/hcp-profile-editor.tsx` - Extended hcpSchema, defaultValues, form.reset with voice_live_model
- `frontend/src/components/admin/voice-avatar-tab.tsx` - Added VoiceLiveModelSelect FormField in Voice Settings card
- `frontend/src/components/admin/hcp-table.tsx` - Added getModelLabel helper and model badge in Voice & Avatar column
- `frontend/public/locales/en-US/admin.json` - Added hcp.voiceLiveModel/modelTier* keys and voiceLive management section
- `frontend/public/locales/zh-CN/admin.json` - Added matching zh-CN translations
- `frontend/public/locales/en-US/nav.json` - Added voiceLive nav key
- `frontend/public/locales/zh-CN/nav.json` - Added voiceLive nav key
- `frontend/src/components/admin/hcp-editor.test.tsx` - Added voice_live_model to mock (Rule 3 fix)
- `frontend/src/components/admin/hcp-list.test.tsx` - Added voice_live_model to mocks (Rule 3 fix)
- `frontend/src/components/admin/scenario-table.test.tsx` - Added voice_live_model to mock (Rule 3 fix)
- `frontend/src/components/coach/scenario-card.test.tsx` - Added voice_live_model to mock (Rule 3 fix)
- `frontend/src/components/coach/scenario-panel.test.tsx` - Added voice_live_model to mock (Rule 3 fix)

## Decisions Made
- VOICE_LIVE_MODEL_OPTIONS exported as named constant for reuse in HCP table badge lookup
- Model tiers grouped as Pro/Basic/Lite matching AI Foundry portal terminology
- Default model is gpt-4o (most commonly used in Pro tier)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added voice_live_model to test mock HcpProfile objects**
- **Found during:** Task 1 (TypeScript type check)
- **Issue:** Adding voice_live_model as required field to HcpProfile caused TS2741 errors in 5 test files with mock data
- **Fix:** Added `voice_live_model: "gpt-4o"` to all mock HcpProfile objects in test files
- **Files modified:** hcp-editor.test.tsx, hcp-list.test.tsx, scenario-table.test.tsx, scenario-card.test.tsx, scenario-panel.test.tsx
- **Verification:** `npx tsc -b --noEmit` exits 0
- **Committed in:** 4663640 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary fix for type safety. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- VoiceLiveModelSelect component ready for reuse in Plan 03 Voice Live management page
- All i18n keys for the management page pre-loaded
- HCP type and form schema extended, ready for backend voice_live_model persistence

## Self-Check: PASSED

All files verified present. All commit hashes found in git log.

---
*Phase: 13-voice-live-instance-agent-voice-management*
*Completed: 2026-04-03*
