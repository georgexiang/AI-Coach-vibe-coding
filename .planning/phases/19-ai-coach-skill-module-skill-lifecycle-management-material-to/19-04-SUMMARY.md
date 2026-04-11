---
phase: 19-ai-coach-skill-module
plan: 04
subsystem: frontend
tags: [react, typescript, tanstack-query, i18n, skill-hub, card-grid, admin-ui]

# Dependency graph
requires: [19-01]
provides:
  - TypeScript interfaces for Skill domain (SkillListItem, Skill, SkillCreate, etc.)
  - Typed axios API client for /api/v1/skills (18 functions)
  - TanStack Query hooks with skillKeys query-key factory (15+ hooks)
  - i18n namespaces (en-US/zh-CN) with full key groups
  - SkillCard and SkillStatusBadge shared components
  - Skill Hub admin page with card grid, debounced search, filters, pagination
  - Router routes for /admin/skills, /admin/skills/new, /admin/skills/:id/edit
  - Admin sidebar entry with Lightbulb icon
affects: [19-05, 19-06, 19-07, 19-08]

# Tech tracking
tech-stack:
  added: [jszip]
  patterns: [query-key factory, debounced search with useState+useEffect, card grid layout]

key-files:
  created:
    - frontend/src/types/skill.ts
    - frontend/src/api/skills.ts
    - frontend/src/hooks/use-skills.ts
    - frontend/public/locales/en-US/skill.json
    - frontend/public/locales/zh-CN/skill.json
    - frontend/src/components/shared/skill-status-badge.tsx
    - frontend/src/components/shared/skill-card.tsx
    - frontend/src/pages/admin/skill-hub.tsx
    - frontend/src/pages/admin/skill-editor.tsx
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/src/i18n/index.ts
    - frontend/src/router/index.tsx
    - frontend/src/components/layouts/admin-layout.tsx
    - frontend/src/components/shared/index.ts
    - frontend/public/locales/en-US/nav.json
    - frontend/public/locales/zh-CN/nav.json

key-decisions:
  - "Query-key factory pattern (skillKeys) for disciplined cache invalidation across 15+ hooks"
  - "Debounced search with 300ms delay using useState + useEffect pattern"
  - "Product filter options derived from current result set"
  - "Placeholder skill-editor page for future Plans 05a/05b implementation"
  - "SkillStatusBadge uses Badge variant + colored dot per UI-SPEC color mapping"

patterns-established:
  - "Query-key factory: skillKeys.all/lists/list/details/detail/conversion/evaluation"
  - "Mutation invalidation matrix: CRUD -> all, Update -> detail+lists, Conversion -> detail+conversion"

requirements-completed: [D-14, D-16]

# Metrics
duration: 7min
completed: 2026-04-11
---

# Phase 19 Plan 04: Skill Hub Frontend Summary

**Skill Hub admin page with card grid, query-key factory pattern for 15+ TanStack Query hooks, 5-state status badge, debounced search/filters, full i18n, and jszip for ZIP import/export**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-11T07:13:55Z
- **Completed:** 2026-04-11T07:21:00Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Created TypeScript interfaces matching backend Pydantic schemas (SkillListItem, Skill, SkillCreate, SkillUpdate, quality/conversion types)
- Built typed axios API client with 18 functions covering all skill endpoints (CRUD, lifecycle, conversion, quality, resources, import/export, SOP regeneration)
- Implemented query-key factory pattern (skillKeys) addressing reviewer concern about cache invalidation bugs across 15+ hooks
- Created comprehensive i18n namespaces for en-US and zh-CN with hub, editor, status, conversion, quality, actions, fileTree, errors, confirm key groups
- Built SkillStatusBadge with 5-state lifecycle (draft/review/published/archived/failed) with colored dots and aria-label accessibility
- Built SkillCard with status badge, quality score, product, tags (max 3 + "+N"), and dropdown action menu
- Created Skill Hub page with responsive card grid (1/2/3 cols), debounced search, status filter, product filter, pagination, loading/error/empty states
- Added Create Skill dialog with "From Materials" and "Import ZIP" options
- Added delete and archive confirmation dialogs
- Registered routes and admin sidebar entry with Lightbulb icon

## Task Commits

Each task was committed atomically:

1. **Task 1: TypeScript types, API client, TanStack Query hooks, i18n, jszip** - `69204af` (feat)
2. **Task 2: SkillCard, SkillStatusBadge, Skill Hub page, routing, sidebar** - `6cf33ca` (feat)

## Files Created/Modified
- `frontend/src/types/skill.ts` - TypeScript interfaces for Skill domain (SkillStatus, ConversionStatus, QualityVerdict, etc.)
- `frontend/src/api/skills.ts` - 18 typed axios API functions for all skill endpoints
- `frontend/src/hooks/use-skills.ts` - 15+ TanStack Query hooks with skillKeys factory pattern
- `frontend/public/locales/en-US/skill.json` - English i18n namespace for skill module
- `frontend/public/locales/zh-CN/skill.json` - Chinese i18n namespace for skill module
- `frontend/src/components/shared/skill-status-badge.tsx` - 5-state lifecycle badge component
- `frontend/src/components/shared/skill-card.tsx` - Skill card with status, score, tags, actions
- `frontend/src/pages/admin/skill-hub.tsx` - Skill Hub page with card grid, filters, pagination
- `frontend/src/pages/admin/skill-editor.tsx` - Placeholder editor page for Plans 05a/05b
- `frontend/package.json` - Added jszip dependency
- `frontend/src/i18n/index.ts` - Registered skill namespace
- `frontend/src/router/index.tsx` - Added /admin/skills, /admin/skills/new, /admin/skills/:id/edit routes
- `frontend/src/components/layouts/admin-layout.tsx` - Added Skill Hub sidebar entry with Lightbulb icon
- `frontend/src/components/shared/index.ts` - Added barrel exports for SkillStatusBadge and SkillCard
- `frontend/public/locales/en-US/nav.json` - Added skillHub key
- `frontend/public/locales/zh-CN/nav.json` - Added skillHub key

## Decisions Made
- Used query-key factory pattern (skillKeys) to prevent cache invalidation bugs — each hook references the factory rather than constructing keys ad-hoc, following the reviewer's recommendation for 15+ hooks
- Debounced search with 300ms delay using useState + useEffect rather than a library
- Product filter options are derived from the current page results, not a separate API call
- SkillStatusBadge maps status to Badge variant + dot color per UI-SPEC color contract
- Placeholder skill-editor page created to satisfy routing without implementing full editor (Plans 05a/05b)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| frontend/src/pages/admin/skill-editor.tsx | entire file | Placeholder editor page | Full implementation deferred to Plans 05a/05b |

## Threat Flags

None - no new security surface beyond existing admin-only route guard pattern.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Skill Hub UI foundation complete; Plans 05a/05b will build the full Skill Editor with tabbed content, file tree, quality radar chart
- All API hooks and types ready for editor components to consume
- i18n keys pre-populated for editor tab labels and quality dimension names

## Self-Check: PASSED
