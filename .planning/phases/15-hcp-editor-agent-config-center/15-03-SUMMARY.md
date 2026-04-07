---
phase: 15-hcp-editor-agent-config-center
plan: 03
subsystem: testing
tags: [vitest, pytest, i18n, preview-instructions, tab-structure, lifecycle]

# Dependency graph
requires:
  - phase: 15-hcp-editor-agent-config-center (plans 01+02)
    provides: preview-instructions endpoint, 2-tab editor, playground panel, instructions section, i18n keys
provides:
  - 9 backend tests for preview-instructions endpoint + to_prompt_dict + route order
  - 11 frontend structural tests for tab structure, i18n parity, lifecycle safeguards, AbortController
  - i18n parity verification (19 Phase 15 keys confirmed in both en-US and zh-CN)
  - Fixed invalid JSON in zh-CN admin.json (Chinese curly quotes)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source file analysis testing pattern for structural regression without full component rendering"

key-files:
  created:
    - backend/tests/test_hcp_profiles_api.py (new test classes added)
    - frontend/src/__tests__/hcp-editor-tabs.test.tsx
  modified:
    - frontend/public/locales/zh-CN/admin.json (JSON fix)

key-decisions:
  - "Used source file analysis (fs.readFileSync) for frontend tests instead of component rendering to avoid 15+ mock dependencies"
  - "Used fs.readFileSync + JSON.parse for i18n locale files to avoid Vite transform choking on Chinese curly quotes"
  - "Fixed zh-CN admin.json invalid JSON as Rule 1 bug fix (Chinese curly quotes breaking JSON parse)"

patterns-established:
  - "Source analysis testing: read .tsx files as text and assert structural invariants (tab count, import presence, lifecycle patterns)"

requirements-completed: [HCP-15-05]

# Metrics
duration: 6min
completed: 2026-04-07
---

# Phase 15 Plan 03: Test Coverage + Build Verification Summary

**9 backend + 11 frontend structural tests covering preview-instructions endpoint, 2-tab editor invariants, i18n parity, and lifecycle safeguards**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-07T09:34:55Z
- **Completed:** 2026-04-07T09:41:00Z
- **Tasks:** 1 automated + 1 visual checkpoint (documented below)
- **Files modified:** 3

## Accomplishments
- 9 backend tests pass: 6 preview-instructions endpoint tests (auto-generated, override, unauthorized, non-admin, empty body, whitespace), 2 to_prompt_dict unit tests, 1 route order verification
- 11 frontend structural tests pass: 2 i18n parity (admin + common), 4 tab structure (TabsTrigger count, no knowledge/tools, VALID_TABS, Form wraps Tabs), 4 lifecycle (state machine, cleanup, buffer cap, mic permission), 1 AbortController race guard
- Fixed invalid JSON in zh-CN admin.json that would break runtime JSON.parse
- TypeScript compiles with zero errors, frontend production build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend tests + frontend automated tests + i18n parity + build verification** - `0d3101a` (test)

## Files Created/Modified
- `backend/tests/test_hcp_profiles_api.py` - Added TestPreviewInstructionsEndpoint (6 tests), TestToPromptDictOverride (2 tests), TestPreviewInstructionsRouteOrder (1 test)
- `frontend/src/__tests__/hcp-editor-tabs.test.tsx` - New file with 11 structural tests
- `frontend/public/locales/zh-CN/admin.json` - Fixed Chinese curly quotes causing invalid JSON

## Decisions Made
- Used source file analysis (reading .tsx as text) for frontend tests rather than component rendering, avoiding need to mock 15+ hooks/providers
- Used `fs.readFileSync` + `JSON.parse` for locale file loading instead of dynamic `import()` to bypass Vite transform issues with Unicode characters
- Fixed zh-CN admin.json inline as Rule 1 deviation (bug in pre-existing file)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid JSON in zh-CN admin.json**
- **Found during:** Task 1 (i18n parity test)
- **Issue:** Line 428 contained Chinese curly double quotes (U+201C, U+201D) inside a JSON string value, causing `JSON.parse` to fail with "Expected ',' or '}' after property value"
- **Fix:** Replaced Chinese curly quotes with corner brackets (suitable for Chinese typography)
- **Files modified:** frontend/public/locales/zh-CN/admin.json
- **Verification:** i18n parity test now passes; all 19 Phase 15 keys verified in both locales
- **Committed in:** 0d3101a (Task 1 commit)

**2. [Rule 1 - Bug] Adapted frontend test regex to match JSX usage only**
- **Found during:** Task 1 (frontend tests)
- **Issue:** Regex `/TabsTrigger/g` matched import statement + JSX usage = 5 matches instead of expected 2
- **Fix:** Changed regex to `/<TabsTrigger/g` to match only JSX element opening tags
- **Files modified:** frontend/src/__tests__/hcp-editor-tabs.test.tsx
- **Verification:** Test correctly verifies exactly 2 `<TabsTrigger` elements
- **Committed in:** 0d3101a (Task 1 commit)

**3. [Rule 1 - Bug] Fixed unit tests for to_prompt_dict with explicit JSON fields**
- **Found during:** Task 1 (backend tests)
- **Issue:** Creating HcpProfile without database session leaves Text columns as None (SQLAlchemy defaults apply at DB level only), causing json.loads(None) TypeError in to_prompt_dict()
- **Fix:** Provided explicit `expertise_areas="[]"`, `objections="[]"`, `probe_topics="[]"` in test constructors
- **Files modified:** backend/tests/test_hcp_profiles_api.py
- **Verification:** Both TestToPromptDictOverride tests pass
- **Committed in:** 0d3101a (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes necessary for test correctness. No scope creep.

## Issues Encountered
- Pre-existing ruff E402 errors in backend/app/main.py (module-level imports after logging setup) -- out of scope, not caused by this plan's changes

## Checkpoint

**Task 2: Visual verification of Agent Config Center layout**
**Type:** checkpoint:human-verify

The following items require human visual verification:

1. Start backend: `cd backend && uvicorn app.main:app --reload --port 8000`
2. Start frontend: `cd frontend && npm run dev`
3. Open http://localhost:5173 and log in as admin
4. Navigate to Admin > HCP Profiles > click an existing HCP profile (or create new)
5. Verify: Only 2 tabs visible: "Profile" and "Voice and Avatar" (NO Knowledge/Tools tabs)
6. Click "Voice and Avatar" tab and verify TWO-PANEL layout:
   - LEFT SIDE: Model Deployment dropdown, Voice Mode toggle, VL Instance selector, Instructions section with magic wand, Knowledge and Tools collapsible
   - RIGHT SIDE: Playground card with avatar preview or audio orb, Start button, transcript area
7. Click the magic wand button -- should generate instructions containing profile name and specialty
8. Toggle Voice Mode switch ON/OFF -- VL Instance selector should appear/disappear
9. Switch language to zh-CN -- all new labels should display in Chinese
10. Switch between Profile and Voice and Avatar tabs -- form data should persist
11. Navigate to URL with ?tab=knowledge -- should fall back to Profile tab

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 15 fully covered with automated tests (backend + frontend)
- All builds passing, ready for merge
- Visual checkpoint documents what needs human eyes before final sign-off

## Self-Check: PASSED

- FOUND: backend/tests/test_hcp_profiles_api.py
- FOUND: frontend/src/__tests__/hcp-editor-tabs.test.tsx
- FOUND: .planning/phases/15-hcp-editor-agent-config-center/15-03-SUMMARY.md
- FOUND: commit 0d3101a

---
*Phase: 15-hcp-editor-agent-config-center*
*Completed: 2026-04-07*
