---
phase: 12-voice-realtime-api-agent
plan: 03
subsystem: ui
tags: [react, voice-live, fallback-chain, auto-mode, per-hcp, toast, aria, badge]

# Dependency graph
requires:
  - phase: 12-voice-realtime-api-agent-01
    provides: "VoiceLiveToken type, token broker API, useVoiceToken hook, VoiceSessionHeader, voice-session.tsx"
provides:
  - "ModeStatusIndicator component with green/amber/red dot states"
  - "Auto-mode resolution from token broker response (resolveMode function)"
  - "3-level fallback chain: digital human -> voice-only -> text"
  - "Per-HCP session config in useVoiceLive (voice_temperature, turn_detection, noise_suppression, etc.)"
  - "hcpProfileId flow from VoiceSessionPage -> VoiceSession -> tokenMutation"
  - "Extended VoiceLiveToken type with 11 per-HCP fields"
affects: [12-voice-realtime-api-agent-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["auto-mode resolution from token broker", "3-level fallback chain with toast warnings", "per-HCP session config from token response"]

key-files:
  created:
    - "frontend/src/components/voice/mode-status-indicator.tsx"
  modified:
    - "frontend/src/components/voice/voice-session-header.tsx"
    - "frontend/src/components/voice/voice-session.tsx"
    - "frontend/src/pages/user/voice-session.tsx"
    - "frontend/src/hooks/use-voice-live.ts"
    - "frontend/src/hooks/use-voice-token.ts"
    - "frontend/src/api/voice-live.ts"
    - "frontend/src/types/voice-live.ts"
    - "frontend/src/components/voice/voice-session-header.test.tsx"

key-decisions:
  - "Mode auto-resolved from token broker capabilities, not from URL params"
  - "toast.warning used for fallback notifications (not toast.error) since degradation is expected"
  - "Per-HCP noise_suppression/echo_cancellation are conditionally added (not always-on)"
  - "initialModeRef tracks original mode for ModeStatusIndicator degradation detection"

patterns-established:
  - "resolveMode: pure function deriving mode from token capabilities"
  - "Fallback chain: avatar failure -> voice-only, voice failure -> text, with toast.warning"
  - "Per-HCP config: token broker returns all settings, frontend consumes without needing separate API calls"

requirements-completed: [VOICE-12-04, VOICE-12-06]

# Metrics
duration: 5min
completed: 2026-04-02
---

# Phase 12 Plan 03: Auto-mode + Fallback Chain Summary

**Voice session auto-mode resolution from token broker with 3-level fallback chain, ModeStatusIndicator with green/amber/red dot states, and per-HCP session config in useVoiceLive**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-02T08:50:03Z
- **Completed:** 2026-04-02T08:55:05Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Created ModeStatusIndicator component showing connection quality via green/amber/red dot with mode label and i18n status text
- Refactored VoiceSession to auto-resolve mode from token broker response (Digital Human Realtime Agent > Digital Human Realtime Model > Voice Realtime Agent > Voice Realtime Model)
- Implemented 3-level fallback chain with toast.warning notifications: avatar failure -> voice-only, voice connection failure -> text mode
- Extended useVoiceLive to build session config from per-HCP token fields (voice_temperature, turn_detection_type, noise_suppression, echo_cancellation, avatar_style, recognition_language, agent_instructions_override)
- Wired hcpProfileId flow from Scenario through VoiceSessionPage to VoiceSession to token broker

## Task Commits

Each task was committed atomically:

1. **Task 1: ModeStatusIndicator component + VoiceSessionHeader integration** - `bca66c7` (feat)
2. **Task 2: VoiceSession auto-mode + fallback chain + per-HCP token wiring + useVoiceLive per-HCP config** - `319a0fb` (feat)

## Files Created/Modified
- `frontend/src/components/voice/mode-status-indicator.tsx` - Persistent mode status badge with green/amber/red dot, i18n labels, aria accessibility
- `frontend/src/components/voice/voice-session-header.tsx` - Replaced static Badge with ModeStatusIndicator, updated props to currentMode/initialMode
- `frontend/src/components/voice/voice-session-header.test.tsx` - Updated tests for new prop interface and ModeStatusIndicator mock
- `frontend/src/components/voice/voice-session.tsx` - Auto-mode resolver, 3-level fallback chain, hcpProfileId prop replacing mode
- `frontend/src/pages/user/voice-session.tsx` - Passes hcpProfileId from scenario, removed manual mode selection
- `frontend/src/hooks/use-voice-live.ts` - Session config built from per-HCP token fields
- `frontend/src/hooks/use-voice-token.ts` - Mutation accepts optional hcpProfileId parameter
- `frontend/src/api/voice-live.ts` - fetchVoiceLiveToken accepts optional hcpProfileId
- `frontend/src/types/voice-live.ts` - Extended VoiceLiveToken with 11 per-HCP fields

## Decisions Made
- Mode auto-resolved from token broker capabilities (avatar_enabled + agent_id), not from URL params -- MR never selects mode manually
- Used toast.warning for fallback notifications instead of toast.error since graceful degradation is expected behavior, not an error
- Per-HCP noise_suppression and echo_cancellation are conditionally added to session config only when enabled, not always-on
- initialModeRef (React ref) tracks original resolved mode for ModeStatusIndicator to detect degradation vs connected state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated voice-session-header.test.tsx for new prop interface**
- **Found during:** Task 1 (ModeStatusIndicator + VoiceSessionHeader integration)
- **Issue:** Existing test file referenced old `mode` prop which no longer exists; needed `currentMode` and `initialMode`
- **Fix:** Updated defaultProps, added ModeStatusIndicator mock, changed test assertions
- **Files modified:** frontend/src/components/voice/voice-session-header.test.tsx
- **Verification:** TypeScript types match (pre-existing module errors excluded)
- **Committed in:** bca66c7 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Extended VoiceLiveToken type and API layer for per-HCP fields**
- **Found during:** Task 1 (needed for type safety across all Task 2 changes)
- **Issue:** VoiceLiveToken type lacked per-HCP fields; fetchVoiceLiveToken and useVoiceToken didn't accept hcpProfileId
- **Fix:** Added 11 per-HCP fields to VoiceLiveToken, updated API function signature, updated mutation type
- **Files modified:** frontend/src/types/voice-live.ts, frontend/src/api/voice-live.ts, frontend/src/hooks/use-voice-token.ts
- **Verification:** Type definitions match plan interface specification
- **Committed in:** bca66c7 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both auto-fixes necessary for correctness and type safety. No scope creep.

## Issues Encountered
- TypeScript compilation in worktree produces false-positive errors due to missing node_modules (pre-existing infrastructure issue, not caused by this plan's changes)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auto-mode resolution and fallback chain fully wired in frontend
- Ready for Plan 04 (end-to-end integration testing with real Azure services)
- Per-HCP token fields flow from backend through to WebSocket session config

## Self-Check: PASSED

All 9 files verified present. Both task commits (bca66c7, 319a0fb) confirmed in git log.

---
*Phase: 12-voice-realtime-api-agent*
*Completed: 2026-04-02*
