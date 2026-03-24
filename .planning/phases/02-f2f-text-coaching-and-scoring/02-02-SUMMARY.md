---
phase: 02-f2f-text-coaching-and-scoring
plan: 02
subsystem: ui
tags: [typescript, i18n, radix-ui, recharts, slider, types]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "React SPA with i18n framework, shadcn/ui component patterns, Tailwind CSS v4 design tokens"
provides:
  - "TypeScript type definitions for HCP, scenario, session, and score domains"
  - "i18n namespaces coach, admin, scoring with en-US and zh-CN translations"
  - "Slider UI component (Radix primitive)"
  - "recharts charting library installed"
affects: [02-03, 02-04, 02-05, 02-06, 02-07, 02-08]

# Tech tracking
tech-stack:
  added: [recharts, "@radix-ui/react-slider"]
  patterns: [domain-typed-interfaces, i18n-namespace-per-domain]

key-files:
  created:
    - frontend/src/types/hcp.ts
    - frontend/src/types/scenario.ts
    - frontend/src/types/session.ts
    - frontend/src/types/score.ts
    - frontend/src/components/ui/slider.tsx
    - frontend/public/locales/en-US/coach.json
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/en-US/scoring.json
    - frontend/public/locales/zh-CN/coach.json
    - frontend/public/locales/zh-CN/admin.json
    - frontend/public/locales/zh-CN/scoring.json
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/src/components/ui/index.ts
    - frontend/src/i18n/index.ts

key-decisions:
  - "Used indexed access types (HcpProfile['personality_type']) for Create/Update interfaces to keep enums DRY"
  - "Followed existing shadcn forwardRef+cn()+displayName pattern for Slider component"
  - "i18n namespaces separated per domain (coach, admin, scoring) for lazy-loading"

patterns-established:
  - "Domain type files: one file per domain in frontend/src/types/ with interface + Create + Update pattern"
  - "i18n key structure: nested by UI section (scenarioSelection, session, errors) within namespace"

requirements-completed: [UI-03, UI-05]

# Metrics
duration: 3min
completed: 2026-03-24
---

# Phase 02 Plan 02: Frontend Types, i18n, and UI Dependencies Summary

**4 domain type files (HCP/scenario/session/score), 6 i18n locale files (coach/admin/scoring x en-US/zh-CN), Slider component, recharts installed**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T11:33:25Z
- **Completed:** 2026-03-24T11:37:00Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Created comprehensive TypeScript type definitions for all coaching domains (HCP profiles, scenarios, sessions, scores) with Create/Update variants
- Installed recharts charting library and @radix-ui/react-slider; created Slider shadcn/ui component
- Registered 3 new i18n namespaces (coach, admin, scoring) with full en-US and zh-CN translations covering all UI copy from the UI-SPEC copywriting contract

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, create TypeScript types, and Slider component** - `b861362` (feat)
2. **Task 2: Create i18n namespace files for coach, admin, and scoring** - `b1846f9` (feat)

## Files Created/Modified
- `frontend/src/types/hcp.ts` - HcpProfile, HcpProfileCreate, HcpProfileUpdate interfaces
- `frontend/src/types/scenario.ts` - Scenario, ScenarioCreate, ScenarioUpdate, ScoringWeights interfaces
- `frontend/src/types/session.ts` - CoachingSession, SessionMessage, SSEEvent, SendMessageRequest interfaces
- `frontend/src/types/score.ts` - SessionScore, ScoreDetail, ScoreStrength, ScoreWeakness interfaces
- `frontend/src/components/ui/slider.tsx` - Radix Slider with shadcn pattern (forwardRef, cn(), displayName)
- `frontend/src/components/ui/index.ts` - Added Slider barrel export
- `frontend/package.json` - Added recharts and @radix-ui/react-slider
- `frontend/src/i18n/index.ts` - Added coach, admin, scoring to ns array
- `frontend/public/locales/en-US/coach.json` - Coaching UI translations (scenario selection, session, errors)
- `frontend/public/locales/en-US/admin.json` - Admin UI translations (HCP, scenarios, Azure config)
- `frontend/public/locales/en-US/scoring.json` - Scoring UI translations (dimensions, grades, actions)
- `frontend/public/locales/zh-CN/coach.json` - Chinese coaching translations
- `frontend/public/locales/zh-CN/admin.json` - Chinese admin translations
- `frontend/public/locales/zh-CN/scoring.json` - Chinese scoring translations

## Decisions Made
- Used indexed access types (`HcpProfile["personality_type"]`) in Create/Update interfaces to keep enum values DRY
- Followed existing shadcn forwardRef + cn() + displayName pattern for Slider (consistent with Progress component)
- i18n namespaces separated per domain (coach, admin, scoring) following established lazy-loading pattern from Phase 1

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All TypeScript types ready for use in API hooks, page components, and service layers
- All i18n translation keys ready for use in coaching, admin, and scoring UI pages
- Slider component available for scoring weight configuration in admin scenarios page
- recharts available for score radar/bar charts in scoring results page

## Self-Check: PASSED

All 11 created files verified present. Both task commit hashes (b861362, b1846f9) confirmed in git log.

---
*Phase: 02-f2f-text-coaching-and-scoring*
*Completed: 2026-03-24*
