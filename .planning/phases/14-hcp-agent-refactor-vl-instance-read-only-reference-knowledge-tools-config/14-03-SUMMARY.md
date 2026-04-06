---
phase: 14-hcp-agent-refactor-vl-instance-read-only-reference-knowledge-tools-config
plan: 03
subsystem: ui
tags: [react, typescript, voice-live, hcp-editor, read-only, tabs, i18n]

requires:
  - phase: 14-01
    provides: useUnassignVoiceLiveInstance hook, VL instance API functions, Phase 14 i18n keys
  - phase: 14-02
    provides: VlInstanceDialog component, rewritten voice-live-management and chain-card

provides:
  - Simplified read-only VoiceAvatarTab (303 lines, down from 1076)
  - VL Instance selector with assign/unassign in HCP editor
  - Read-only configuration preview with CDN avatar thumbnails
  - 4-tab HCP editor (Profile, Voice & Avatar, Knowledge, Tools)
  - Knowledge and Tools placeholder tab skeletons

affects: [14-04, voice-live-management, hcp-profiles]

tech-stack:
  added: []
  patterns:
    - "ConfigRow helper for read-only key-value display"
    - "AvatarThumbnail component for CDN image with initials fallback"
    - "4-tab HCP editor layout (Profile, Voice & Avatar, Knowledge, Tools)"

key-files:
  created: []
  modified:
    - frontend/src/components/admin/voice-avatar-tab.tsx
    - frontend/src/pages/admin/hcp-profile-editor.tsx

key-decisions:
  - "VoiceAvatarTab rewritten from 1076-line editor to 303-line read-only component"
  - "Voice/avatar editing removed from HCP editor -- managed in VL Management (Plan 02)"
  - "Knowledge and Tools tabs are placeholders indicating future availability"

patterns-established:
  - "Read-only VL config preview pattern: show instance properties without editable inputs"
  - "Tab placeholder skeleton: icon + title + description body centered in Card"

requirements-completed: [HCP-14-01, HCP-14-02, HCP-14-03]

duration: 7min
completed: 2026-04-06
---

# Phase 14 Plan 03: HCP Voice Tab Read-Only Preview + Knowledge/Tools Tabs Summary

**Simplified VoiceAvatarTab from 1076-line full editor to 303-line read-only preview with VL Instance selector, and added Knowledge/Tools placeholder tabs to HCP editor**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-06T00:13:47Z
- **Completed:** 2026-04-06T00:20:40Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Rewrote VoiceAvatarTab from 1076 lines to 303 lines (72% reduction), removing all inline voice/avatar editing and real-time test panel
- Added VL Instance selector dropdown with assign/unassign capability and confirm dialog
- Added read-only configuration preview showing model, voice, avatar (CDN thumbnail), temperature, turn detection, language
- Extended HCP editor from 2 tabs to 4 tabs with Knowledge and Tools placeholder skeletons

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite VoiceAvatarTab as read-only preview + instance selector** - `81de2c3` (feat)
2. **Task 2: Add Knowledge and Tools placeholder tabs to HCP editor** - `d599e41` (feat)

## Files Created/Modified
- `frontend/src/components/admin/voice-avatar-tab.tsx` - Simplified read-only VL preview component with instance selector, config preview, and avatar thumbnails
- `frontend/src/pages/admin/hcp-profile-editor.tsx` - Extended from 2-tab to 4-tab layout with Knowledge and Tools placeholders

## Decisions Made
- Removed all voice test logic (useVoiceLive, useAvatarStream, useAudioHandler, useAudioPlayer hooks) -- testing is now in VL Management
- Used ConfigRow helper component for clean read-only key-value grid layout
- AvatarThumbnail builds style-specific CDN URL for video avatars, falls back to initials circle
- Knowledge/Tools tabs use inline Card placeholders rather than EmptyState shared component (simpler for this case)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
- Knowledge tab: placeholder skeleton with i18n text "Knowledge base configuration will be available in a future update" -- intentional, Plan 04/future phase will implement
- Tools tab: placeholder skeleton with i18n text "Function Call tool configuration will be available in a future update" -- intentional, future phase will implement

## Next Phase Readiness
- VoiceAvatarTab is now a compact read-only component ready for the Phase 14 UI verification
- HCP editor 4-tab layout ready for future Knowledge and Tools implementation
- Plan 04 (E2E testing and verification) can proceed

## Self-Check: PASSED

- [x] voice-avatar-tab.tsx exists
- [x] hcp-profile-editor.tsx exists
- [x] Commit 81de2c3 found
- [x] Commit d599e41 found

---
*Phase: 14-hcp-agent-refactor-vl-instance-read-only-reference-knowledge-tools-config*
*Completed: 2026-04-06*
