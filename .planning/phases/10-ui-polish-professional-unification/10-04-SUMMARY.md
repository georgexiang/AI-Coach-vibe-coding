---
phase: 10-ui-polish-professional-unification
plan: 04
subsystem: ui
tags: [tailwind, design-tokens, dark-mode, responsive, figma-audit, mobile-stacking]

# Dependency graph
requires:
  - phase: 10-02
    provides: "Navigation polish, theme picker, page transitions"
  - phase: 10-03
    provides: "Admin page polish with design tokens"
provides:
  - "All 8 user-facing pages polished against Figma prompt specs"
  - "Login page with theme-aware gradient and bg-card dark mode"
  - "Dashboard with responsive 4-col stat grid and bg-card cards"
  - "Training session pages with mobile vertical stacking (D-24)"
  - "Session history with mobile card list and desktop table layout"
  - "Scoring feedback with bg-card wrapped sections and strength colors"
  - "Coach panel components (ScenarioPanel, ChatArea, HintsPanel) with design tokens"
affects: [10-05, 10-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mobile-first responsive: flex-col lg:flex-row for 3-panel layouts"
    - "Design token colors: bg-background, bg-card, text-foreground, text-muted-foreground everywhere"
    - "Dark mode: bg-muted/50 for secondary surfaces, dark: variants for score colors"
    - "Collapsible mobile hints via toggle button at bottom of training session pages"

key-files:
  created: []
  modified:
    - "frontend/src/pages/login.tsx"
    - "frontend/src/components/layouts/auth-layout.tsx"
    - "frontend/src/pages/user/dashboard.tsx"
    - "frontend/src/pages/user/training.tsx"
    - "frontend/src/pages/user/session-history.tsx"
    - "frontend/src/pages/user/scoring-feedback.tsx"
    - "frontend/src/pages/user/reports.tsx"
    - "frontend/src/pages/user/training-session.tsx"
    - "frontend/src/pages/user/conference-session.tsx"
    - "frontend/src/pages/user/voice-session.tsx"
    - "frontend/src/components/coach/scenario-panel.tsx"
    - "frontend/src/components/coach/chat-area.tsx"
    - "frontend/src/components/coach/hints-panel.tsx"
    - "frontend/src/components/voice/voice-session.tsx"

key-decisions:
  - "Replaced all hardcoded slate/blue colors in coach panels with design token classes (bg-muted/50, border-border, text-foreground)"
  - "Mobile training session: hidden side panels, compact HCP bar at top, collapsible hints at bottom"
  - "Auth-layout gradient uses from-primary/5 via-background to-primary/3 for theme-aware adaptation"
  - "Session history: table for desktop, card list for mobile via hidden/sm:block pattern"
  - "Reports: unified all stat card colors to text-primary instead of individual color classes"

patterns-established:
  - "Mobile stacking: flex-col lg:flex-row for immersive 3-panel layouts"
  - "Page heading: text-2xl font-medium text-foreground universally"
  - "Card styling: bg-card rounded-lg border border-border for all content cards"
  - "Dark-safe score colors: dark:bg-green-900/30 dark:text-green-400 pattern"

requirements-completed: [UI-02, UI-03, UI-04, UI-05]

# Metrics
duration: 10min
completed: 2026-03-29
---

# Phase 10 Plan 04: User Pages Polish Summary

**Audited and polished all 10 user-facing pages (login + 8 user pages + auth-layout) against Figma prompt specs with consistent 24px gaps, design token colors, dark mode, responsive grids, and mobile vertical stacking for training sessions**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-28T22:35:49Z
- **Completed:** 2026-03-28T22:45:49Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Eliminated all hardcoded colors (hex, slate-*, blue-*) from 10 user pages and 4 coach panel components, replacing with design token classes
- Implemented mobile vertical stacking (D-24) for F2F, conference, and voice training session pages with collapsible hints panel
- Standardized page headings to text-2xl font-medium, section gaps to gap-6, and card styling to bg-card rounded-lg border
- Added mobile card list alternative for session history table (hidden table on mobile, shown cards)
- Fixed auth-layout gradient to use theme-aware primary color tokens instead of hardcoded blue-50

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit and polish login, dashboard, training, history, scoring, reports pages** - `e386856` (feat)
2. **Task 2: Polish training session pages (F2F, conference, voice)** - `81b3129` (feat)

## Files Created/Modified
- `frontend/src/pages/login.tsx` - Replaced hardcoded blue with bg-primary, shadow-lg card, transition-colors
- `frontend/src/components/layouts/auth-layout.tsx` - Theme-aware gradient using from-primary/5
- `frontend/src/pages/user/dashboard.tsx` - text-2xl heading, responsive 4-col grid, LoadingState/EmptyState
- `frontend/src/pages/user/training.tsx` - Fixed text-gray-900 to text-foreground, consistent gap-6
- `frontend/src/pages/user/session-history.tsx` - Table headers with text-muted-foreground, mobile card list
- `frontend/src/pages/user/scoring-feedback.tsx` - bg-card wrapped sections, stroke-muted for SVG ring
- `frontend/src/pages/user/reports.tsx` - text-primary for stat values, consistent card styling
- `frontend/src/pages/user/training-session.tsx` - flex-col lg:flex-row, mobile compact HCP bar, collapsible hints
- `frontend/src/pages/user/conference-session.tsx` - flex-col lg:flex-row for responsive panels
- `frontend/src/pages/user/voice-session.tsx` - bg-background loading state (already had it)
- `frontend/src/components/coach/scenario-panel.tsx` - bg-muted/50, border-border, text-muted-foreground
- `frontend/src/components/coach/chat-area.tsx` - bg-background, bg-primary send button, bg-foreground/5 avatar area
- `frontend/src/components/coach/hints-panel.tsx` - Dark mode yellow hints, text-foreground tokens
- `frontend/src/components/voice/voice-session.tsx` - border-slate-200 to border-border, flex-col lg:flex-row

## Decisions Made
- Replaced all `bg-slate-50`/`border-slate-200`/`text-slate-600` in coach panels with semantic tokens (`bg-muted/50`, `border-border`, `text-muted-foreground`) for dark mode compatibility
- Mobile training session uses hidden desktop panels + compact HCP info bar + collapsible hints toggle (not full side panel restructuring)
- Auth-layout uses `from-primary/5 via-background to-primary/3` gradient which automatically adapts to any accent color theme
- Session history uses `hidden sm:block` / `sm:hidden` pattern to show table on desktop, card list on mobile
- Reports page unified all stat card value colors to `text-primary` instead of per-card color classes (text-blue-600, text-green-600 etc) for theme consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed voice-session.tsx hardcoded border colors**
- **Found during:** Task 2 (training session polish)
- **Issue:** `frontend/src/components/voice/voice-session.tsx` had 4 instances of `border-slate-200` and `border-slate-300` that would break dark mode
- **Fix:** Replaced all with `border-border` design token class
- **Files modified:** frontend/src/components/voice/voice-session.tsx
- **Verification:** Build passes, grep confirms no remaining slate classes
- **Committed in:** 81b3129 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for dark mode correctness. No scope creep.

## Issues Encountered
- Frontend node_modules not installed in worktree, required `npm ci` before build verification
- Pre-existing TypeScript errors in test files (vitest types, file-saver types) are unrelated to this plan's changes

## Known Stubs
None - all pages render real data from existing hooks and API layer.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All user-facing pages now use consistent design tokens and support dark mode
- Training session pages support mobile vertical stacking per D-24
- Ready for demo seed data polish (Plan 06) and final verification

## Self-Check: PASSED

- All 14 modified files verified present on disk
- Both task commits (e386856, 81b3129) verified in git log
- SUMMARY.md created successfully

---
*Phase: 10-ui-polish-professional-unification*
*Completed: 2026-03-29*
