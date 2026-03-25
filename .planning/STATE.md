---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
stopped_at: Completed 06-03-PLAN.md
last_updated: "2026-03-25T10:38:39.258Z"
last_activity: 2026-03-25
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 32
  completed_plans: 29
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-24)

**Core value:** MRs can practice realistic conversations with AI-powered digital HCPs and receive immediate, multi-dimensional feedback to improve their communication skills -- anytime, without needing a real HCP or trainer.
**Current focus:** Phase 06 — conference-presentation-module

## Current Position

Phase: 06 (conference-presentation-module) — EXECUTING
Plan: 5 of 6

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 10min | 2 tasks | 16 files |
| Phase 01 P02 | 12 min | 2 tasks | 22 files |
| Phase 01 P03 | 7min | 2 tasks | 15 files |
| Phase 01 P04 | 8min | 3 tasks | 29 files |
| Phase 01 P05 | 8min | 2 tasks | 6 files |
| Phase 01.1 P02 | 2min | 2 tasks | 2 files |
| Phase 01.1 P01 | 3min | 2 tasks | 16 files |
| Phase 01.1 P03 | 3min | 2 tasks | 12 files |
| Phase 01.1 P04 | 2min | 2 tasks | 3 files |
| Phase 01.1 P05 | 3min | 2 tasks | 6 files |
| Phase 02 P02 | 3min | 2 tasks | 15 files |
| Phase 02 P01 | 5min | 2 tasks | 14 files |
| Phase 02 P05 | 2min | 2 tasks | 9 files |
| Phase 02 P03 | 5min | 2 tasks | 7 files |
| Phase 02 P04 | 9min | 2 tasks | 8 files |
| Phase 02 P07 | 8min | 2 tasks | 29 files |
| Phase 02 P06 | 8min | 2 tasks | 12 files |
| Phase 02 P08 | 5min | 2 tasks | 5 files |
| Phase 03 P03 | 9min | 2 tasks | 18 files |
| Phase 05 P01 | 9min | 2 tasks | 12 files |
| Phase 05 P02 | 9min | 2 tasks | 8 files |
| Phase 05 P03 | 5min | 2 tasks | 9 files |
| Phase 06 P02 | 5min | 2 tasks | 8 files |
| Phase 06 P01 | 6min | 2 tasks | 9 files |
| Phase 06 P04 | 8min | 2 tasks | 14 files |
| Phase 06 P03 | 11min | 2 tasks | 11 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Coarse granularity -- 4 phases following critical path: Auth -> F2F Text -> Voice/Conference -> Dashboards
- [Roadmap]: Architecture-first -- pluggable adapters and config must work with mock providers before any Azure integration
- [Roadmap]: Text before voice, F2F before conference -- proven by research as safest delivery order
- [Roadmap]: i18n from day 1 -- react-i18next integrated in Phase 1, not retrofitted later
- [Phase 01]: JWT auth with python-jose + passlib bcrypt; Alembic with async engine and render_as_batch for SQLite
- [Phase 01]: Role-based access via require_role() factory returning FastAPI Depends callable
- [Phase 01]: Used Figma Make Design System for SaaS theme as primary source for design tokens (already has medical brand colors)
- [Phase 01]: Adapted sonner.tsx to remove next-themes dependency for Vite compatibility
- [Phase 01]: ServiceRegistry replaces AdapterRegistry with multi-category support and backward-compatible alias
- [Phase 01]: Feature toggles default to False for zero-config local dev; Config API requires auth
- [Phase 01]: Used useSyncExternalStore for auth store -- simpler than Context, no provider needed
- [Phase 01]: i18n separated into 3 namespaces (common, auth, nav) for lazy loading and domain separation
- [Phase 01]: Admin layout uses dark sidebar (#1E293B) per UI-SPEC; mobile uses Sheet overlay for both layouts
- [Phase 01]: Mock adapters registered in lifespan for clean startup; ConfigProvider inside QueryClientProvider for global flag access
- [Phase 01.1]: Copyright moved from login form to auth-layout for separation of concerns
- [Phase 01.1]: Followed existing Radix UI wrapper pattern (forwardRef + cn() + displayName) for 4 new components
- [Phase 01.1]: i18n namespaces per page domain (dashboard, training) for lazy-loading separation
- [Phase 01.1]: Design tokens (text-foreground, bg-primary) used everywhere in shared components instead of raw Tailwind colors
- [Phase 01.1]: ChatInput uses react-i18next training namespace for all aria labels per accessibility and i18n requirements
- [Phase 01.1]: Used dual i18n namespaces (dashboard + common) at page level for lazy-loading separation
- [Phase 01.1]: Client-side filtering on mock data with useMemo; sentinel ALL_VALUE for Radix Select compatibility
- [Phase 01.1]: Full-screen 3-panel layout without UserLayout for immersive training experience
- [Phase 01.1]: CenterPanel extended with inputMode/onMicClick/recordingState props for ChatInput integration
- [Phase 02]: Used indexed access types for HCP Create/Update interfaces to keep enum values DRY
- [Phase 02]: i18n namespaces separated per domain (coach, admin, scoring) for lazy-loading
- [Phase 02]: Used model_validator(mode='after') instead of field_validator for weight sum validation -- Pydantic v2 field validators do not fire on default values
- [Phase 02]: Used native fetch for SSE streaming -- axios does not support streaming response bodies
- [Phase 02]: Added abort() to SSE hook for clean stream cancellation on component unmount
- [Phase 02]: Used local Pydantic Out models with field_validator for JSON list parsing in CRUD routers
- [Phase 02]: Service layer uses db.flush() instead of db.commit() to work with session middleware commit/rollback
- [Phase 02]: Used keyword matching for mock key message detection -- real LLM detection deferred to AI adapter wiring
- [Phase 02]: SSE streaming via EventSourceResponse for real-time HCP response delivery with word-chunk streaming
- [Phase 02]: Service module pattern: business logic in services/*.py, routers only handle HTTP delegation
- [Phase 02]: Created type/hook stubs in parallel worktree to resolve blocking dependencies from plans 02-02/02-05
- [Phase 02]: Used recharts RadarChart with dual-series overlay for current vs previous scoring comparison
- [Phase 02]: Used react-hook-form + zod for admin forms; linked scoring weights use proportional redistribution
- [Phase 02]: Azure config API uses format validation for MVP test endpoint
- [Phase 05]: StorageBackend as Protocol for structural typing; local filesystem for MVP, Azure Blob stub for production
- [Phase 05]: Page-level chunking for PDF, paragraph-group for DOCX, sheet-per-chunk for XLSX; 2000-char chunks with 200-char overlap
- [Phase 05]: Used expunge+re-query pattern for async SQLAlchemy relationship loading to avoid MissingGreenlet errors
- [Phase 05]: Content type derived from file extension rather than trusting upload MIME type for reliability
- [Phase 05]: search_chunks uses latest-active-version subquery to only return chunks from current versions
- [Phase 05]: Used react-dropzone for drag-and-drop file upload with MIME type restriction (PDF, DOCX, XLSX)
- [Phase 05]: Used inline HTML table for material list since no dedicated Table UI component exists in the shared UI library
- [Phase 06]: Used separate conference query key namespaces to avoid F2F cache collisions
- [Phase 06]: Conference SSE hook uses fetch-based ReadableStream with typed multi-speaker event dispatch
- [Phase 06]: Used server_default in Alembic migration for conference columns for SQLite compatibility with existing rows
- [Phase 06]: TurnManager uses in-memory dict for real-time question queues, not database persistence
- [Phase 06]: Extended ChatBubble with optional speakerName/speakerColor for multi-speaker conference; backward compatible with F2F
- [Phase 06]: Conference session page uses same full-screen no-UserLayout pattern as F2F training-session.tsx
- [Phase 06]: SSE heartbeat via asyncio queue-based producer/consumer pattern for 15s keepalive in conference SSE
- [Phase 06]: Azure adapters use conditional SDK import inside methods to avoid ImportError when not installed
- [Phase 06]: AzureAvatarAdapter is_available()=False stub for COACH-07 premium option

### Pending Todos

None yet.

### Roadmap Evolution

- Phase 01.1 inserted after Phase 1: UI 需要和figma对齐，他们的figma-make 文件和UI sceenshot都放在目录：figma-make (URGENT)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260325-9wy | Add comprehensive tests for Phase 3: backend pytest 95%+ coverage, frontend logic tests with vitest, E2E Playwright tests for rubric CRUD, scoring flow, session history | 2026-03-24 | dccf83a | [260325-9wy-add-comprehensive-tests-for-phase-3-back](./quick/260325-9wy-add-comprehensive-tests-for-phase-3-back/) |

## Session Continuity

Last activity: 2026-03-25
Last session: 2026-03-25T10:38:39.255Z
Stopped at: Completed 06-03-PLAN.md
Resume file: None
