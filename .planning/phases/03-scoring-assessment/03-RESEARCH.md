# Phase 3: Scoring & Assessment - Research

**Researched:** 2026-03-24
**Domain:** Scoring system wiring, post-session reports API, admin rubric CRUD, score history analytics
**Confidence:** HIGH

## Summary

Phase 3 completes the scoring system that Phase 2 scaffolded. The vast majority of code already exists as uncommitted files or wired-but-incomplete services. The work is primarily **integration wiring** -- connecting existing `suggestion_service.py` into the SSE flow, exposing `report_service.py` via API, building a CRUD router for the existing `ScoringRubric` model, and adding score history endpoints. The frontend has existing components (HintsPanel, RadarChart, DimensionBars, FeedbackCard, ScoreSummary) that need to be connected to real API data and extended with new pages (admin rubric management, user score history).

The codebase follows strongly established patterns from Phase 2: service-layer business logic, Pydantic v2 schemas with `ConfigDict(from_attributes=True)`, TanStack Query hooks per domain, SSE streaming via native fetch, i18n via react-i18next with domain namespaces, and admin pages using a sidebar-list + editor panel pattern. Phase 3 should follow these patterns exactly.

**Primary recommendation:** Wire existing services/models/schemas first (backend), then build the missing API endpoints and admin UI, following Phase 2 patterns precisely. No new libraries needed -- the stack is complete.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Wire existing `suggestion_service.py` into the SSE message flow -- call after each user message alongside HCP response generation
- Suggestions delivered via existing `CoachEventType.SUGGESTION` SSE events -- frontend HintsPanel already handles these
- Keep keyword-based mock analysis for MVP (already implemented); LLM-based analysis deferred to AI adapter wiring
- Add dedicated `GET /api/v1/sessions/{id}/suggestions` endpoint to retrieve accumulated suggestions for a session
- Wire existing `report_service.py` to a new `GET /api/v1/sessions/{id}/report` API endpoint
- Extend the existing scoring-feedback page to show full report data (DimensionBreakdown with quotes, improvement priorities)
- Enable PDF export using browser print-to-PDF (CSS @media print) -- lightweight approach, no server-side PDF generation
- Historical comparison: provide previous session score via API for RadarChart overlay
- Create `rubric_service.py` with full CRUD operations using existing model + schemas
- Create `rubrics` API router at `/api/v1/rubrics` with admin-only access
- Build admin rubric management page at `/admin/scoring-rubrics` -- list view + editor with dimension config
- Wire scoring service to use rubric dimensions when available, fall back to scenario weights
- Default rubric seeded for F2F scenario type with the 5 standard dimensions
- Scoring results already persisted (SessionScore + ScoreDetail from Phase 2)
- Add `GET /api/v1/scoring/history` endpoint for user's score history across sessions
- Add trend calculation in service layer -- compute improvement percentage per dimension over last N sessions
- Wire user dashboard to real scoring data via TanStack Query hooks (replace mock data)

### Claude's Discretion
- Database schema details for any new columns/tables
- Exact rubric editor UI layout and interaction patterns
- Score aggregation algorithm details (moving average vs simple average for trends)
- CSS print stylesheet specifics for PDF export
- Test structure and mock data patterns

### Deferred Ideas (OUT OF SCOPE)
- LLM-based real-time suggestion generation (requires Azure OpenAI wiring -- Phase scope is mock/keyword for MVP)
- Server-side PDF generation (browser print-to-PDF sufficient for MVP)
- Admin analytics dashboard (Phase 4 scope)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCORE-01 | System scores completed sessions across 5-6 configurable dimensions | Already implemented in Phase 2 (`scoring_service.py`). Phase 3 wires rubric-based configurable dimensions as override. |
| SCORE-02 | Scoring uses Azure OpenAI to analyze conversation transcript | Mock scoring exists; deferred LLM-based scoring. Phase 3 keeps mock but integrates rubric weights. |
| SCORE-03 | Post-session feedback report shows strengths/weaknesses per dimension with quotes | `report_service.py` EXISTS but not exposed via API. Phase 3 wires it to `GET /api/v1/sessions/{id}/report`. |
| SCORE-04 | Post-session feedback includes actionable improvement suggestions per dimension | `report_service.py` already generates `ImprovementSuggestion` with priority levels. API wiring needed. |
| SCORE-05 | Scoring dimension weights are configurable per scenario -- admin sets via weighted sliders | Scenario model has `weight_*` columns. Phase 3 adds `ScoringRubric` as override with CRUD UI. |
| COACH-08 | Real-time coaching hints displayed in side panel during conversation | `HintsPanel` component exists, SSE `hint` event type exists. Phase 3 wires `suggestion_service` into SSE flow. |
| COACH-09 | Conversations are immutable once completed | Already enforced in `sessions.py` endpoint (status check). Phase 3 maintains this constraint. |
</phase_requirements>

## Standard Stack

### Core (Already Installed -- No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.115.0 | ASGI web framework | Already installed, all routers follow this pattern |
| SQLAlchemy 2.0 | async | ORM with AsyncSession | Already installed, all models use this |
| Pydantic v2 | >=2.5.0 | Request/response schemas | Already installed, `ConfigDict(from_attributes=True)` pattern |
| sse-starlette | installed | SSE streaming for real-time suggestions | Already used in `sessions.py` for HCP response streaming |
| TanStack Query v5 | ^5.60.0 | Server state management | Already used for all API hooks |
| Recharts | installed | Radar charts, trend charts | Already used in `RadarChart` and dashboard mini-charts |
| react-i18next | installed | i18n with domain namespaces | Already configured with `scoring`, `admin`, `coach` namespaces |
| react-hook-form + zod | installed | Form management | Already used in scenario editor, will reuse for rubric editor |

### Supporting (No additions needed)

All supporting libraries are already present in the project. Phase 3 introduces zero new dependencies.

**Installation:** None required -- all dependencies are already in `pyproject.toml` and `package.json`.

## Architecture Patterns

### Backend: New Files Needed

```
backend/
├── app/
│   ├── api/
│   │   └── rubrics.py                  # NEW: CRUD router for /api/v1/rubrics
│   ├── services/
│   │   ├── rubric_service.py           # NEW: Rubric CRUD business logic
│   │   ├── suggestion_service.py       # EXISTS: Wire into SSE flow
│   │   ├── report_service.py           # EXISTS: Wire to API endpoint
│   │   └── scoring_service.py          # MODIFY: Use rubric dimensions when available
│   ├── api/sessions.py                 # MODIFY: Add suggestion wiring + report/suggestions endpoints
│   ├── api/scoring.py                  # MODIFY: Add history endpoint
│   └── api/__init__.py                 # MODIFY: Register rubrics_router
├── scripts/
│   └── seed_data.py                    # MODIFY: Add default F2F rubric
└── tests/
    ├── test_rubric_service.py          # NEW
    ├── test_rubrics_api.py             # NEW
    ├── test_report_service.py          # NEW
    ├── test_suggestion_service.py      # NEW
    └── test_scoring_history.py         # NEW
```

### Frontend: New Files Needed

```
frontend/src/
├── api/
│   ├── rubrics.ts                      # NEW: Rubric CRUD API client
│   └── reports.ts                      # NEW: Report + suggestions API client
├── hooks/
│   ├── use-rubrics.ts                  # NEW: TanStack Query hooks for rubrics
│   └── use-reports.ts                  # NEW: TanStack Query hooks for reports
├── types/
│   ├── rubric.ts                       # NEW: Rubric TypeScript types
│   └── report.ts                       # NEW: Report TypeScript types
├── components/
│   ├── admin/
│   │   ├── rubric-table.tsx            # NEW: Rubric list view
│   │   └── rubric-editor.tsx           # NEW: Rubric editor with dimension config
│   └── scoring/
│       └── report-section.tsx          # NEW: Report detail sections
├── pages/
│   ├── admin/
│   │   └── scoring-rubrics.tsx         # NEW: Admin rubric management page
│   └── user/
│       └── session-history.tsx         # NEW: User score history page
└── public/locales/
    ├── en-US/
    │   ├── scoring.json                # MODIFY: Add report/history keys
    │   └── admin.json                  # MODIFY: Add rubric management keys
    └── zh-CN/
        ├── scoring.json                # MODIFY: Add report/history keys
        └── admin.json                  # MODIFY: Add rubric management keys
```

### Pattern 1: Wiring Suggestion Service into SSE Flow

**What:** After each user message, call `generate_suggestions()` and emit `SUGGESTION` events before the `done` event.
**When to use:** In the `send_message` endpoint's `event_generator()` function.
**Example:**

```python
# In backend/app/api/sessions.py send_message event_generator
# After DONE event, before yielding done:
from app.services.suggestion_service import generate_suggestions, parse_key_messages_status

# After saving HCP response and detecting key messages:
km_status_list = parse_key_messages_status(session.key_messages_status)
suggestions = await generate_suggestions(
    messages=[{"role": "user", "content": request.message}],
    key_messages_status=km_status_list,
    scoring_weights=session.scenario.get_scoring_weights(),
)
for suggestion in suggestions:
    yield {
        "event": "hint",
        "data": json.dumps({
            "content": suggestion.message,
            "metadata": {
                "type": suggestion.type.value,
                "trigger": suggestion.trigger,
                "relevance": suggestion.relevance_score,
            },
        }),
    }
```

### Pattern 2: Admin CRUD Router (Following HCP Profiles Pattern)

**What:** Full CRUD router with admin-only access via `require_role("admin")`.
**When to use:** For `/api/v1/rubrics` endpoints.
**Example:**

```python
# backend/app/api/rubrics.py
from fastapi import APIRouter, Depends
from app.dependencies import get_db, require_role
from app.models.user import User

router = APIRouter(prefix="/rubrics", tags=["rubrics"])

@router.post("/", status_code=201)
async def create_rubric(
    request: RubricCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    return await rubric_service.create_rubric(db, request, user.id)
```

### Pattern 3: Score History with Trend Calculation

**What:** Endpoint returns user's scored sessions with per-dimension trend data.
**When to use:** For `GET /api/v1/scoring/history` endpoint.
**Example:**

```python
# Service layer: compute simple improvement percentage
async def get_score_history(db, user_id, limit=10):
    # Fetch last N scored sessions ordered by completed_at desc
    # For each dimension, compare current vs previous to compute trend
    # Return list of {session_id, scenario_name, overall_score, passed, dimensions, completed_at}
```

### Pattern 4: Admin Page Pattern (Sidebar List + Editor)

**What:** Admin pages follow the existing pattern from HCP profiles and Scenarios pages.
**When to use:** For the `/admin/scoring-rubrics` page.
**Example:**

```typescript
// Follow the exact pattern from pages/admin/scenarios.tsx:
// 1. State: editorOpen, editingItem, isNew, deleteConfirmId
// 2. Hooks: useRubrics, useCreateRubric, useUpdateRubric, useDeleteRubric
// 3. Layout: filter bar + table + Dialog editor
// 4. i18n: useTranslation("admin") with rubric-specific keys
```

### Anti-Patterns to Avoid

- **Do NOT use redux or context for scoring data:** TanStack Query handles all server state. The dashboard mock data should be replaced with `useScoreHistory()` hook, not a context provider.
- **Do NOT parse JSON in the frontend for ScoreDetail strengths/weaknesses:** The `report_service.py` already parses JSON and returns structured Pydantic models. The API should return parsed objects, not raw JSON strings. Note: the existing `ScoreDetailResponse` schema returns raw JSON strings -- the report endpoint returns parsed objects via `SessionReport` schema.
- **Do NOT add inline `useQuery` calls in components:** Create domain-specific hooks in `use-reports.ts` and `use-rubrics.ts`.
- **Do NOT modify existing scoring components:** `RadarChart`, `FeedbackCard`, `DimensionBars` already accept the right props. Extend the page that uses them, don't modify the components.
- **Do NOT use `db.commit()` in services:** Use `db.flush()` per the established pattern. The session middleware handles commit/rollback.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF export | Server-side PDF generation | CSS `@media print` stylesheet | Browser print-to-PDF is sufficient for MVP; avoids adding weasyprint/reportlab dependency |
| Score trend calculation | Complex statistical library | Simple Python arithmetic in service layer | Moving average or simple delta comparison is a few lines of code |
| Real-time suggestions | LLM-based analysis | Existing keyword-based `suggestion_service.py` | LLM wiring is explicitly deferred; mock is intentional |
| Form validation | Custom validation logic | react-hook-form + zod (already installed) | Already used for scenario editor; rubric editor follows same pattern |
| Weight slider UI | Custom slider component | Existing pattern from scenario weight editor | Phase 2 already built proportional weight redistribution logic |

**Key insight:** Phase 3 is an integration phase. Nearly every piece of business logic already exists in service files. The work is routing, wiring, and UI assembly.

## Common Pitfalls

### Pitfall 1: ScoreDetail JSON Parsing Inconsistency

**What goes wrong:** The existing `ScoreDetailResponse` schema returns `strengths`, `weaknesses`, and `suggestions` as raw JSON strings (Text columns from SQLite). The frontend `ScoreDetail` type expects parsed arrays. The `report_service.py` handles parsing, but the scoring API does not.
**Why it happens:** Phase 2 left the scoring API response as raw JSON strings and the frontend was parsing them client-side.
**How to avoid:** The report endpoint should use `SessionReport` schema which has parsed objects. For the score history endpoint, either add JSON parsing validators to the response schema (like the existing `parse_dimensions_json` pattern in `RubricResponse`) or return data through the report service.
**Warning signs:** Frontend displays `[object Object]` or stringified JSON in score displays.

### Pitfall 2: SSE Suggestion Timing

**What goes wrong:** Suggestions emitted before the HCP response is fully streamed create a confusing user experience.
**Why it happens:** The `generate_suggestions()` call could be placed before the HCP text streaming loop.
**How to avoid:** Call `generate_suggestions()` AFTER the full HCP response is saved and key messages are detected (inside the `CoachEventType.DONE` handler), before yielding the final `done` event. This ensures suggestions reflect the complete conversation state.
**Warning signs:** Hints panel updates mid-stream or shows stale suggestions.

### Pitfall 3: Rubric Weight Validation Edge Case

**What goes wrong:** Rubric dimensions with weights that don't sum to 100 bypass validation when updating individual dimensions.
**Why it happens:** `RubricUpdate` has `dimensions` as optional. If dimensions are provided, the field_validator fires. But if dimensions are not provided, existing dimensions remain unchanged.
**How to avoid:** The existing `validate_weights_sum` field_validator on `RubricUpdate` already handles this correctly -- it only validates when dimensions are provided. No additional logic needed.
**Warning signs:** Rubric with dimensions summing to != 100 in database.

### Pitfall 4: Admin Route Not Protected

**What goes wrong:** The rubric CRUD endpoint is accessible to regular users.
**Why it happens:** Forgetting to use `require_role("admin")` dependency.
**How to avoid:** Use `Depends(require_role("admin"))` on ALL rubric CRUD endpoints, following the exact pattern from `hcp_profiles.py` and `scenarios.py` routers.
**Warning signs:** Non-admin user can create/edit/delete rubrics.

### Pitfall 5: Router Registration Order in main.py

**What goes wrong:** New router is not included in `main.py` or `api/__init__.py`.
**Why it happens:** Creating the router file but forgetting to register it.
**How to avoid:** Checklist: (1) create `api/rubrics.py`, (2) add to `api/__init__.py`, (3) add `app.include_router(rubrics_router, prefix=settings.api_prefix)` to `main.py`.
**Warning signs:** 404 on `/api/v1/rubrics` endpoints.

### Pitfall 6: Frontend Route Not Added to Router

**What goes wrong:** New pages exist but are unreachable.
**Why it happens:** Creating page component but not adding to `router/index.tsx`.
**How to avoid:** For each new page: (1) create page file, (2) import in `router/index.tsx`, (3) add route entry under appropriate layout (admin routes under `AdminRoute > AdminLayout`, user routes under `ProtectedRoute > UserLayout`).
**Warning signs:** Clicking sidebar nav link shows NotFound page.

### Pitfall 7: i18n Keys Not Added to Both Locales

**What goes wrong:** New UI text shows raw keys like `admin.rubrics.title` instead of translated text.
**Why it happens:** Adding keys to `en-US` but not `zh-CN` (or vice versa).
**How to avoid:** Always add new keys to both `en-US` and `zh-CN` locale files simultaneously. The project has `locales/en-US/` and `locales/zh-CN/` plus a duplicated `locales/locales/` directory -- add to the primary set.
**Warning signs:** UI shows translation keys as raw strings.

### Pitfall 8: Session Suggestion Accumulation

**What goes wrong:** Retrieving suggestions for a session via `GET /sessions/{id}/suggestions` returns nothing because suggestions are only emitted via SSE and not persisted.
**Why it happens:** The SSE flow generates and streams suggestions but doesn't save them to the database.
**How to avoid:** Either (a) persist suggestions to a new table during the SSE flow, or (b) regenerate them from the conversation history when the GET endpoint is called. Option (b) is simpler for MVP -- call `generate_suggestions()` with the full conversation history.
**Warning signs:** Empty suggestions list when querying after session.

## Code Examples

### Backend: Report API Endpoint (Wiring Existing Service)

```python
# Add to backend/app/api/sessions.py (or a new reports.py)
from app.services.report_service import generate_report
from app.schemas.report import SessionReport

@router.get("/{session_id}/report", response_model=SessionReport)
async def get_session_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get detailed post-session report with strengths, weaknesses, and improvements."""
    # Verify session belongs to user
    await session_service.get_session(db, session_id, user.id)
    report = await generate_report(db, session_id)
    return report
```

### Backend: Rubric Service CRUD Pattern

```python
# backend/app/services/rubric_service.py
import json
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.scoring_rubric import ScoringRubric
from app.schemas.scoring_rubric import RubricCreate, RubricUpdate
from app.utils.exceptions import NotFoundException

async def create_rubric(db: AsyncSession, data: RubricCreate, user_id: str) -> ScoringRubric:
    rubric = ScoringRubric(
        name=data.name,
        description=data.description,
        scenario_type=data.scenario_type,
        dimensions=json.dumps([d.model_dump() for d in data.dimensions]),
        is_default=data.is_default,
        created_by=user_id,
    )
    # If setting as default, unset other defaults for same scenario_type
    if data.is_default:
        await _unset_defaults(db, data.scenario_type)
    db.add(rubric)
    await db.flush()
    return rubric
```

### Backend: Score History Endpoint

```python
# Add to backend/app/api/scoring.py
@router.get("/history")
async def get_score_history(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get user's scoring history with dimension trends."""
    history = await scoring_service.get_score_history(db, user.id, limit)
    return history
```

### Frontend: Report Hook Pattern

```typescript
// frontend/src/hooks/use-reports.ts
import { useQuery } from "@tanstack/react-query";
import { getSessionReport, getSessionSuggestions } from "@/api/reports";

export function useSessionReport(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["reports", sessionId],
    queryFn: () => getSessionReport(sessionId!),
    enabled: !!sessionId,
  });
}

export function useSessionSuggestions(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["suggestions", sessionId],
    queryFn: () => getSessionSuggestions(sessionId!),
    enabled: !!sessionId,
  });
}
```

### Frontend: Rubric Admin Hook Pattern

```typescript
// frontend/src/hooks/use-rubrics.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRubrics, createRubric, updateRubric, deleteRubric } from "@/api/rubrics";

export function useRubrics(params?: { scenario_type?: string }) {
  return useQuery({
    queryKey: ["rubrics", params],
    queryFn: () => getRubrics(params),
  });
}

export function useCreateRubric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRubric,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rubrics"] });
    },
  });
}
// ... same pattern for update, delete
```

### CSS Print Stylesheet Pattern

```css
/* Add to scoring-feedback page or global print styles */
@media print {
  /* Hide navigation, sidebar, action buttons */
  nav, .sidebar, .action-bar, button { display: none !important; }
  /* Full width for content */
  .max-w-7xl { max-width: 100% !important; }
  /* Ensure charts render properly */
  .recharts-wrapper { break-inside: avoid; }
  /* Page breaks between dimension cards */
  .feedback-card { break-inside: avoid; }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline scoring weights in Scenario model | Configurable via ScoringRubric override | Phase 3 | Admin can define reusable rubrics across scenarios |
| Mock data in user dashboard | Real scoring data from API | Phase 3 | Dashboard shows actual session history and trends |
| SSE without coaching hints | SSE with suggestion_service wiring | Phase 3 | Real-time coaching tips during conversation |
| Basic scoring page | Full report with strengths/weaknesses/quotes | Phase 3 | Actionable post-session feedback |

## Open Questions

1. **Suggestion Persistence Strategy**
   - What we know: SSE delivers suggestions in real-time, but the CONTEXT.md specifies a `GET /api/v1/sessions/{id}/suggestions` endpoint.
   - What's unclear: Should suggestions be persisted to a DB table, or regenerated from conversation history on demand?
   - Recommendation: Regenerate on demand for MVP (simpler, no schema change). If suggestions are needed in bulk/analytics later, add a `session_suggestions` table in Phase 4. The keyword-based generation is deterministic and fast enough for on-demand regeneration.

2. **Rubric-to-Scenario Linking**
   - What we know: Scenarios have hardcoded `weight_*` columns. Rubrics have a `scenario_type` field (f2f/conference) but no direct FK to scenarios.
   - What's unclear: How does the scoring service decide which rubric to use for a session?
   - Recommendation: Scoring service checks for a default rubric matching the scenario's `mode` (f2f/conference). If found, use rubric dimensions. Otherwise, fall back to scenario `weight_*` columns. This avoids schema migration to add a rubric_id FK to scenarios.

3. **ScoreDetail JSON Parsing for Frontend**
   - What we know: `ScoreDetailResponse` returns raw JSON strings. The `SessionReport` returns parsed objects. The frontend types expect parsed arrays.
   - What's unclear: Should the score API be updated to parse JSON, or only the report API?
   - Recommendation: Add JSON parsing `field_validator` to `ScoreDetailResponse` (following the existing `parse_dimensions_json` pattern from `RubricResponse`). This keeps both APIs consistent.

## Project Constraints (from CLAUDE.md)

### Backend
- Async everywhere: `async def`, `await`, `AsyncSession`
- Pydantic v2 schemas with `model_config = ConfigDict(from_attributes=True)`
- Service layer holds business logic, routers only handle HTTP
- `db.flush()` not `db.commit()` in services (session middleware handles commit)
- Route ordering: static paths before parameterized `/{id}`
- Create returns 201, Delete returns 204
- No raw SQL -- use SQLAlchemy ORM
- Schema changes require Alembic migration (rubrics migration already exists)

### Frontend
- `strict: true` TypeScript -- no `any` types, no unused variables
- TanStack Query hooks per domain -- no inline `useQuery`
- `@/` path alias for all imports
- `cn()` utility for conditional classes
- No Redux -- TanStack Query for server state
- react-i18next with domain namespaces per page

### Testing
- Backend: pytest + pytest-asyncio with in-memory SQLite
- >=95% coverage required
- Test patterns: service unit tests, API integration tests, schema tests
- Frontend: Component tests using vitest + testing-library

### Database
- Never modify schema without Alembic migration
- All models use `TimestampMixin`
- rubrics migration already exists (`16f9f0ba6e9d_add_scoring_rubrics_table.py`)

## Sources

### Primary (HIGH confidence)
- **Codebase analysis**: Direct reading of all existing services, models, schemas, components, tests, and configuration files
- `backend/app/services/suggestion_service.py` -- complete implementation, keyword-based
- `backend/app/services/report_service.py` -- complete implementation, returns `SessionReport`
- `backend/app/models/scoring_rubric.py` -- complete model with JSON dimensions column
- `backend/app/schemas/scoring_rubric.py` -- complete CRUD schemas with weight validation
- `backend/app/schemas/report.py` -- complete report schemas with strengths/weaknesses/improvements
- `backend/app/schemas/suggestion.py` -- complete suggestion schemas with SuggestionType enum
- `backend/app/api/sessions.py` -- existing SSE flow, suggestion wiring point identified
- `backend/app/api/scoring.py` -- existing scoring endpoints, history endpoint location
- `frontend/src/components/scoring/` -- 4 existing components (radar-chart, dimension-bars, feedback-card, score-summary)
- `frontend/src/components/coach/hints-panel.tsx` -- existing SSE hint handling
- `frontend/src/hooks/use-sse.ts` -- existing SSE hook with hint callback
- `frontend/src/pages/admin/scenarios.tsx` -- admin page pattern reference
- `frontend/src/router/index.tsx` -- existing route configuration, new route insertion points identified
- `frontend/src/components/layouts/admin-layout.tsx` -- sidebar already has `/admin/reports` placeholder
- `frontend/src/components/layouts/user-layout.tsx` -- sidebar already has `/user/history` and `/user/reports` placeholders

### Secondary (MEDIUM confidence)
- Phase 2 state decisions (from STATE.md) -- patterns for JSON parsing, service layer, SSE streaming

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use; no new dependencies
- Architecture: HIGH - All patterns directly observed in codebase from Phase 2
- Pitfalls: HIGH - Derived from direct codebase analysis of existing inconsistencies and integration points

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- no external dependency changes expected)
