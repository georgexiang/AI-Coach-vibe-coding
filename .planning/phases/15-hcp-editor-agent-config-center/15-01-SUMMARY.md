---
phase: 15-hcp-editor-agent-config-center
plan: 01
subsystem: api, ui
tags: [fastapi, pydantic, react, tanstack-query, i18n, abort-controller, hcp-profiles]

# Dependency graph
requires:
  - phase: 12-voice-realtime-agent-mode
    provides: build_agent_instructions, agent_instructions_override field, HCP editor tabbed layout
  - phase: 14-vl-instance-management
    provides: VL Instance CRUD, assign/unassign hooks, VoiceAvatarTab read-only rewrite
provides:
  - POST /preview-instructions endpoint with admin auth
  - to_prompt_dict() now includes agent_instructions_override
  - InstructionsSection component with magic wand and AbortController race guard
  - AgentConfigLeftPanel with Model Deployment, Voice Mode toggle, VL Instance assign/unassign, Instructions, Knowledge/Tools skeleton
  - previewInstructions API client function with AbortSignal
  - usePreviewInstructions mutation hook
  - 21 new i18n keys in en-US + zh-CN admin.json + 2 new common.json keys
affects: [15-02-PLAN, 15-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [AbortController race condition guard for magic wand, instruction precedence override > auto-generated]

key-files:
  created:
    - frontend/src/components/admin/instructions-section.tsx
    - frontend/src/components/admin/agent-config-left-panel.tsx
  modified:
    - backend/app/api/hcp_profiles.py
    - backend/app/models/hcp_profile.py
    - frontend/src/api/hcp-profiles.ts
    - frontend/src/hooks/use-hcp-profiles.ts
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json
    - frontend/public/locales/en-US/common.json
    - frontend/public/locales/zh-CN/common.json

key-decisions:
  - "POST /preview-instructions uses inline import to avoid circular dependency with agent_sync_service"
  - "AbortController ref pattern for race condition guard on magic wand button (cancel previous request)"
  - "VL Instance assign/unassign logic migrated from voice-avatar-tab.tsx to AgentConfigLeftPanel"
  - "Knowledge & Tools section is non-functional skeleton per CONTEXT.md deferred scope"

patterns-established:
  - "AbortController race guard pattern: ref tracks in-flight request, abort on re-trigger"
  - "Instruction precedence rule: non-empty agent_instructions_override.strip() wins over auto-generated"

requirements-completed: [HCP-15-02, HCP-15-04, HCP-15-05]

# Metrics
duration: 10min
completed: 2026-04-07
---

# Phase 15 Plan 01: Backend + Left Panel Summary

**POST /preview-instructions endpoint with instruction precedence, AgentConfigLeftPanel with VL assign/unassign migration, InstructionsSection with AbortController race guard, 23 new i18n keys**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-07T09:10:47Z
- **Completed:** 2026-04-07T09:20:47Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Backend POST /preview-instructions endpoint with InstructionsPreviewRequest/Response models and require_role("admin")
- Fixed to_prompt_dict() to include agent_instructions_override for build_agent_instructions compatibility
- Created InstructionsSection with magic wand button, AbortController race condition guard, auto-gen preview, and override textarea
- Created AgentConfigLeftPanel with Model Deployment, Voice Mode toggle, VL Instance assign/unassign (migrated from voice-avatar-tab.tsx), Instructions, and Knowledge/Tools skeleton
- Added 21 new i18n keys to admin.json + 2 to common.json with full en-US/zh-CN parity

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend preview-instructions endpoint + to_prompt_dict fix** - `3cf929d` (feat)
2. **Task 2: Frontend API client, hooks, i18n keys, and left panel components** - `949b39c` (feat)

## Files Created/Modified
- `backend/app/api/hcp_profiles.py` - Added InstructionsPreviewRequest/Response models and POST /preview-instructions endpoint
- `backend/app/models/hcp_profile.py` - Added agent_instructions_override to to_prompt_dict() return dict
- `frontend/src/api/hcp-profiles.ts` - Added previewInstructions function with AbortSignal param
- `frontend/src/hooks/use-hcp-profiles.ts` - Added usePreviewInstructions mutation hook
- `frontend/src/components/admin/instructions-section.tsx` - New: auto-gen preview, magic wand with AbortController, override textarea
- `frontend/src/components/admin/agent-config-left-panel.tsx` - New: Model Deployment, Voice Mode, VL Instance assign/unassign, Instructions, Knowledge/Tools
- `frontend/public/locales/en-US/admin.json` - Added 21 new hcp.* i18n keys
- `frontend/public/locales/zh-CN/admin.json` - Added 21 new hcp.* i18n keys (parity with en-US)
- `frontend/public/locales/en-US/common.json` - Added generate/regenerate keys
- `frontend/public/locales/zh-CN/common.json` - Added generate/regenerate keys

## Decisions Made
- POST (not GET) for preview-instructions because body carries 15+ profile fields — too large for query params
- Inline import of build_agent_instructions inside route handler to avoid top-level import ordering issues
- AbortController stored in useRef to survive re-renders; abort on new request, cleanup on unmount
- VL Instance assign/unassign logic copied verbatim from voice-avatar-tab.tsx to preserve exact behavior
- Knowledge & Tools section is intentionally a non-functional skeleton per CONTEXT.md deferred scope

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Worktree had its own file tree separate from main repo; needed to use worktree paths for all edits
- node_modules not installed in worktree; required npm ci before TypeScript verification

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AgentConfigLeftPanel and InstructionsSection are ready for Plan 02 (Voice & Avatar tab rewrite) to compose into two-panel layout
- All i18n keys for Phase 15 Plans 02 and 03 are pre-loaded in this plan
- previewInstructions API function is ready for the InstructionsSection to call

---
*Phase: 15-hcp-editor-agent-config-center*
*Completed: 2026-04-07*
