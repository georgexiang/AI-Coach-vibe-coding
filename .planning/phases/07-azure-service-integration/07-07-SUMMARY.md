---
phase: 07-azure-service-integration
plan: 07
subsystem: ui
tags: [react, tanstack-query, i18n, accessibility, azure-config, voice-live, region-capabilities]

# Dependency graph
requires:
  - phase: 07-05
    provides: Backend region capabilities API endpoint and Voice Live mode encoding
provides:
  - Region availability badge component with accessible icon + text rendering
  - Voice Live Agent/Model mode toggle with JSON-based encoding
  - useRegionCapabilities TanStack Query hook
  - RegionCapabilities/RegionStatus TypeScript types
  - parseVoiceLiveMode/encodeVoiceLiveMode utility functions
  - Updated i18n keys for region availability, Voice Live modes, test results (en-US + zh-CN)
affects: [azure-config, voice-session, admin-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSON-based Voice Live mode encoding matching backend parse_voice_live_mode"
    - "Region capability badges with icon + text (not color-only) for WCAG accessibility"
    - "Graceful API error fallback showing 'unknown' badge instead of broken UI"

key-files:
  created:
    - frontend/src/hooks/use-region-capabilities.ts
  modified:
    - frontend/src/types/azure-config.ts
    - frontend/src/api/azure-config.ts
    - frontend/src/components/admin/service-config-card.tsx
    - frontend/src/pages/admin/azure-config.tsx
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json
    - frontend/public/locales/en-US/voice.json
    - frontend/public/locales/zh-CN/voice.json

key-decisions:
  - "JSON-based encoding for Voice Live mode to prevent client-side drift from backend"
  - "Region badges use icon + text alongside color for WCAG accessibility compliance"
  - "Purple status dot for unavailable services (distinct from error red)"
  - "Region capability API errors show gray 'unknown' badge as graceful fallback"

patterns-established:
  - "Region availability uses TanStack Query hook with 5min staleTime and single retry"
  - "Voice Live mode encoding via encodeVoiceLiveMode utility shared between components"

requirements-completed: [PLAT-03, PLAT-05, COACH-07, EXT-04]

# Metrics
duration: 7min
completed: 2026-03-27
---

# Phase 07 Plan 07: Frontend Azure Config UX Summary

**Region availability badges with accessible icon+text, Voice Live Agent/Model mode toggle with JSON encoding, and updated i18n for all 7 Azure AI service modes**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-27T14:35:54Z
- **Completed:** 2026-03-27T14:43:16Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Service config cards now show region availability badges (green check/purple X/gray info) with accessible text+icon
- Voice Live card has Agent/Model mode radio toggle sending structured JSON to backend
- Removed hardcoded eastus2/swedencentral region warning -- region availability now dynamic via API
- All new UI text externalized in both en-US and zh-CN i18n namespaces
- Agent mode validates required fields (agent_id, project_name) before save

## Task Commits

Each task was committed atomically:

1. **Task 1: TypeScript types, API function, region capabilities hook, and i18n updates** - `3790668` (feat)
2. **Task 2: Update service-config-card with region badge, Voice Live toggle, remove hardcoded warnings** - `f7eabcb` (feat)

## Files Created/Modified
- `frontend/src/types/azure-config.ts` - Added RegionCapabilities, RegionStatus types and Voice Live mode encoding utilities
- `frontend/src/api/azure-config.ts` - Added getRegionCapabilities API function
- `frontend/src/hooks/use-region-capabilities.ts` - New TanStack Query hook for region capabilities
- `frontend/src/components/admin/service-config-card.tsx` - Region badges, Voice Live mode toggle, agent fields, accessibility improvements
- `frontend/src/pages/admin/azure-config.tsx` - Region capabilities hook integration, removed hardcoded region warning
- `frontend/public/locales/en-US/admin.json` - Region availability keys, Voice Live mode labels, test result messages
- `frontend/public/locales/zh-CN/admin.json` - Chinese translations for all new admin keys
- `frontend/public/locales/en-US/voice.json` - Updated regionUnsupported to remove hardcoded regions
- `frontend/public/locales/zh-CN/voice.json` - Updated Chinese regionUnsupported message

## Decisions Made
- Used JSON.stringify for Voice Live Agent mode encoding to prevent client-side drift from backend's JSON-first parse_voice_live_mode approach
- Region badges use icon + text (Check/X/Info icons) alongside color for WCAG accessibility -- not color-only signaling
- Purple (#7C3AED/purple-600) for unavailable status dot -- visually distinct from error red and inactive gray
- Region capability API errors show gray "unknown" badge instead of broken UI -- graceful degradation
- parseVoiceLiveMode includes legacy colon-format fallback for backward compatibility with any existing saved configs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data is wired to API endpoints.

## Next Phase Readiness
- Frontend Azure config UX is complete for all 7 Azure AI service modes
- Region availability is dynamically shown based on backend API response
- Voice Live mode encoding matches backend expectations for both Agent and Model modes

---
*Phase: 07-azure-service-integration*
*Completed: 2026-03-27*
