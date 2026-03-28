---
phase: 09-integration-testing-with-real-azure-services
plan: 03
subsystem: ui
tags: [typescript, react, mode-selector, voice-live, websocket, agent-mode, i18n]

# Dependency graph
requires:
  - phase: 08-voice-live-and-avatar
    provides: Voice Live hook, mode-selector component, voice session components
  - phase: 09-integration-testing-with-real-azure-services
    provides: 7-mode SessionMode type (plan 02), unified AI Foundry config (plan 01)
provides:
  - Two-level mode selector (communication type + engine) supporting 7 interaction modes
  - Agent mode WebSocket path selection in use-voice-live hook (voice-agent/realtime vs openai/realtime)
  - Updated i18n keys for 7-mode labels and engine selector (en-US + zh-CN)
  - ModeSelector integrated into training page voice tab with availability props
affects: [09-04, 09-05, voice-session-pages]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-level mode selector: communication type row + engine row with conditional visibility"
    - "Agent/model mode WebSocket URL dispatch based on token agent_id"
    - "MODE_MAP record for (commType, engine) -> SessionMode mapping"

key-files:
  created: []
  modified:
    - frontend/src/components/voice/mode-selector.tsx
    - frontend/src/hooks/use-voice-live.ts
    - frontend/src/pages/user/training.tsx
    - frontend/src/types/voice-live.ts
    - frontend/public/locales/en-US/voice.json
    - frontend/public/locales/zh-CN/voice.json
    - frontend/src/components/voice/voice-session.tsx
    - frontend/src/pages/user/voice-session.tsx
    - frontend/src/components/voice/mode-selector.test.tsx
    - frontend/src/components/voice/voice-session.test.tsx
    - frontend/src/components/voice/voice-session-header.test.tsx
    - frontend/src/hooks/use-voice-live.test.ts

key-decisions:
  - "Two-level selector uses internal parseMode/MODE_MAP pattern for bidirectional mode conversion"
  - "Voice comm type available when either voiceLiveAvailable OR pipelineAvailable (either engine works)"
  - "Agent availability set to false by default; future: derive from voice-live status endpoint"
  - "WebSocket URL dispatch: voice-agent/realtime for agent mode, openai/realtime for model mode per D-11"

patterns-established:
  - "MODE_MAP record pattern: Record<CommType, Record<Engine, SessionMode | null>> for 7-mode mapping"
  - "parseMode() utility: reverse-map SessionMode string to (commType, engine) tuple"
  - "Agent mode session config includes agent_id and project_name fields"

requirements-completed: [PLAT-05, COACH-04, COACH-05, COACH-06, COACH-07]

# Metrics
duration: 10min
completed: 2026-03-28
---

# Phase 09 Plan 03: Two-Level Mode Selector and Agent Mode WebSocket Summary

**Two-level mode selector (Text/Voice/Digital Human + Pipeline/Realtime/Agent) with conditional WebSocket path dispatch for agent vs model mode in use-voice-live hook**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-28T13:48:42Z
- **Completed:** 2026-03-28T13:58:49Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Rewrote mode-selector.tsx as two-level selector: Level 1 picks communication type (Text/Voice/Digital Human), Level 2 picks engine (Pipeline/Realtime/Agent) -- engine row hidden for text mode
- Updated use-voice-live.ts hook to construct agent-specific WebSocket URL (voice-agent/realtime) when agent_id present, or model-specific URL (openai/realtime) when in model mode
- Integrated ModeSelector into training.tsx voice tab with pipelineAvailable and agentAvailable props
- Updated all voice.json locale files (en-US + zh-CN) with 7-mode labels, engine names, and new tooltips

## Task Commits

Each task was committed atomically:

1. **Task 1: Two-level mode selector with 7 modes** - `173f3ff` (feat)
2. **Task 2: Agent mode WebSocket path in use-voice-live** - `393675a` (feat)

## Files Created/Modified
- `frontend/src/components/voice/mode-selector.tsx` - Complete rewrite: two-level selector with MODE_MAP for 7-mode mapping
- `frontend/src/hooks/use-voice-live.ts` - Agent vs model mode WebSocket URL dispatch with agent_id/project_name in session config
- `frontend/src/pages/user/training.tsx` - Added ModeSelector to voice tab with availability props from config
- `frontend/src/types/voice-live.ts` - Expanded SessionMode to 7 values, added agent_id/project_name to VoiceLiveToken
- `frontend/public/locales/en-US/voice.json` - Added 7-mode labels, engine keys, commType keys, tooltips
- `frontend/public/locales/zh-CN/voice.json` - Chinese translations for all new keys
- `frontend/src/components/voice/voice-session.tsx` - Updated avatar mode check to use startsWith("digital_human")
- `frontend/src/pages/user/voice-session.tsx` - Updated default mode to voice_pipeline
- `frontend/src/components/voice/mode-selector.test.tsx` - New tests for two-level selector, engine buttons, mode mapping
- `frontend/src/components/voice/voice-session.test.tsx` - Updated mode values from voice/avatar to new 7-mode values
- `frontend/src/components/voice/voice-session-header.test.tsx` - Updated mode values in tests
- `frontend/src/hooks/use-voice-live.test.ts` - Added 4 tests for agent/model WebSocket path and session config

## Decisions Made
- Used MODE_MAP record pattern for clean bidirectional mapping between (commType, engine) and SessionMode
- Voice communication type is available when either voiceLiveAvailable OR pipelineAvailable (either engine suffices)
- Agent availability defaults to false since feature flags don't expose it yet; future enhancement via voice-live status
- WebSocket URL uses voice-agent/realtime path per D-11 when token contains agent_id

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated SessionMode type and downstream components for 7-mode values**
- **Found during:** Task 1 (mode selector rewrite)
- **Issue:** This parallel worktree does not have Plan 09-02 changes; SessionMode was still 3-value (text/voice/avatar) and downstream components used old mode values
- **Fix:** Expanded SessionMode to 7 values, added agent_id/project_name to VoiceLiveToken, updated voice-session.tsx, voice-session.tsx (page), voice-session-header test, voice-session test with new mode values
- **Files modified:** voice-live.ts, voice-session.tsx, voice-session.tsx (page), voice-session-header.test.tsx, voice-session.test.tsx, voice.json (en-US + zh-CN)
- **Verification:** TypeScript check and build pass cleanly
- **Committed in:** 173f3ff (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking dependency from parallel execution)
**Impact on plan:** Prerequisite type changes were necessary since this worktree runs parallel to Plan 09-02. No scope creep.

## Issues Encountered
None - both tasks executed smoothly.

## Known Stubs
- `agentAvailable` is hardcoded to `false` in training.tsx because feature flags don't yet expose agent config availability. Future plan should add agent_available to VoiceLiveConfigStatus and wire through to the UI.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Two-level mode selector is ready for integration testing with real Azure services
- Agent mode WebSocket path is wired and ready for end-to-end testing
- All 7 SessionMode values are reachable from the UI when services are enabled

## Self-Check: PASSED

All 12 modified files verified present. Both task commits (173f3ff, 393675a) verified in git log. TypeScript compiles cleanly. Build succeeds.

---
*Phase: 09-integration-testing-with-real-azure-services*
*Completed: 2026-03-28*
