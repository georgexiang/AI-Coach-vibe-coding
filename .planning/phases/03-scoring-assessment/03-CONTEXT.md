# Phase 3: Scoring & Assessment - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning
**Mode:** Auto-generated (full user authorization — Claude's discretion on all decisions)

<domain>
## Phase Boundary

Complete the scoring system with: (1) real-time coaching suggestions wired into the SSE session flow, (2) detailed post-session reports with strengths/weaknesses/improvement areas exposed via API, (3) admin-customizable scoring rubrics with full CRUD, and (4) historical scoring data persistence and query APIs for trend analysis. Phase 2 built the scoring foundation (mock scores, 5 dimensions, basic feedback page). Phase 3 finishes the job — wiring the existing scaffolding, adding missing APIs, and building the admin rubric management UI.

</domain>

<decisions>
## Implementation Decisions

### Real-time Coaching Suggestions
- Wire existing `suggestion_service.py` into the SSE message flow — call after each user message alongside HCP response generation
- Suggestions delivered via existing `CoachEventType.SUGGESTION` SSE events — frontend HintsPanel already handles these
- Keep keyword-based mock analysis for MVP (already implemented); LLM-based analysis deferred to AI adapter wiring
- Add dedicated `GET /api/v1/sessions/{id}/suggestions` endpoint to retrieve accumulated suggestions for a session

### Post-session Reports
- Wire existing `report_service.py` to a new `GET /api/v1/sessions/{id}/report` API endpoint
- Extend the existing scoring-feedback page to show full report data (DimensionBreakdown with quotes, improvement priorities)
- Enable PDF export using browser print-to-PDF (CSS @media print) — lightweight approach, no server-side PDF generation
- Historical comparison: provide previous session score via API for RadarChart overlay

### Admin Scoring Rubrics
- Create `rubric_service.py` with full CRUD operations using existing model + schemas
- Create `rubrics` API router at `/api/v1/rubrics` with admin-only access
- Build admin rubric management page at `/admin/scoring-rubrics` — list view + editor with dimension config
- Wire scoring service to use rubric dimensions when available, fall back to scenario weights
- Default rubric seeded for F2F scenario type with the 5 standard dimensions

### Score Persistence & Analytics
- Scoring results already persisted (SessionScore + ScoreDetail from Phase 2)
- Add `GET /api/v1/scoring/history` endpoint for user's score history across sessions
- Add trend calculation in service layer — compute improvement percentage per dimension over last N sessions
- Wire user dashboard to real scoring data via TanStack Query hooks (replace mock data)

### Claude's Discretion
- Database schema details for any new columns/tables
- Exact rubric editor UI layout and interaction patterns
- Score aggregation algorithm details (moving average vs simple average for trends)
- CSS print stylesheet specifics for PDF export
- Test structure and mock data patterns

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/suggestion_service.py` — keyword-based suggestion generator (EXISTS, not wired)
- `backend/app/services/report_service.py` — full report generator parsing ScoreDetail JSON (EXISTS, not wired)
- `backend/app/models/scoring_rubric.py` — ScoringRubric ORM model (EXISTS, uncommitted)
- `backend/app/schemas/scoring_rubric.py` — RubricCreate/Update/Response with weight validation (EXISTS, uncommitted)
- `backend/app/schemas/report.py` — SessionReport, DimensionBreakdown (EXISTS, uncommitted)
- `backend/app/schemas/suggestion.py` — SuggestionType, SuggestionCreate/Response (EXISTS, uncommitted)
- `backend/alembic/versions/16f9f0ba6e9d_add_scoring_rubrics_table.py` — Migration (EXISTS, uncommitted)
- Frontend: HintsPanel, RadarChart, DimensionBars, FeedbackCard, ScoreSummary all exist
- Frontend: SSE hook handles `hint` events; scoring hooks and API client exist
- `backend/app/services/prompt_builder.py` — `build_scoring_prompt()` ready for LLM integration

### Established Patterns
- Service layer pattern: business logic in `services/*.py`, routers delegate only
- Pydantic v2 schemas with `ConfigDict(from_attributes=True)` and field validators
- TanStack Query hooks per domain with typed API client
- i18n via react-i18next with domain namespaces
- Admin pages follow sidebar list + editor panel pattern (see hcp-profiles, scenarios)
- SSE streaming via EventSourceResponse for real-time delivery

### Integration Points
- `backend/app/api/sessions.py` — SSE message endpoint needs suggestion_service wiring
- `backend/app/main.py` — New routers registered here
- `frontend/src/App.tsx` — New routes added here
- Admin sidebar navigation already has `/admin/reports` placeholder
- User navigation already has `/user/history` and `/user/reports` placeholders

</code_context>

<specifics>
## Specific Ideas

- Leverage all existing uncommitted scaffolding files — they represent intentional Phase 3 preparation
- Keep consistency with Phase 2 admin page patterns (hcp-profiles, scenarios) for rubric management
- Follow the same test coverage pattern: service tests, API tests, schema tests, component tests, hook tests
- Use Recharts (already installed) for any new charts in reports/history pages

</specifics>

<deferred>
## Deferred Ideas

- LLM-based real-time suggestion generation (requires Azure OpenAI wiring — Phase scope is mock/keyword for MVP)
- Server-side PDF generation (browser print-to-PDF sufficient for MVP)
- Admin analytics dashboard (Phase 4 scope)

</deferred>
