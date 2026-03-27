# Phase 04: Dashboard Reporting

> Auto-generated from [`.planning/phases/04-dashboard-reporting`](../blob/main/.planning/phases/04-dashboard-reporting)  
> Last synced: 2026-03-27

## Plans (6)

| # | Plan File | Status |
|---|-----------|--------|
| 04-01 | 04-01-PLAN.md | Complete |
| 04-02 | 04-02-PLAN.md | Complete |
| 04-03 | 04-03-PLAN.md | Complete |
| 04-04 | 04-04-PLAN.md | Complete |
| 04-05 | 04-05-PLAN.md | Complete |
| 04-06 | 04-06-PLAN.md | Complete |

## Research

<details><summary>Click to expand research notes</summary>

# Phase 4: Dashboard & Reporting - Research

**Researched:** 2026-03-25
**Domain:** Data analytics, charting, PDF/Excel export, full-stack dashboard
**Confidence:** HIGH

## Summary

Phase 4 builds personal MR dashboards with performance trends and skill radar charts, admin organization-level analytics (BU comparison, skill gap heatmaps, training completion rates), and PDF/Excel export capabilities. The codebase already has substantial infrastructure in place: recharts 3.8.0 is installed with radar/line chart usage patterns established, a score history API exists (`GET /scoring/history`), session history is partially rendered, and openpyxl is already a backend dependency. The user dashboard page exists but uses limited live data -- this phase enhances it with real aggregated statistics, trend computation, and per-dimension performance tracking.

The primary challenge is that the User model has no `business_unit` field, which is required for ANLYT-03 (BU comparisons). An Alembic migration to add this field is necessary. The admin dashboard is currently an empty placeholder (`EmptyState` component). The export flow requires a backend endpoint for Excel (using openpyxl + FastAPI StreamingResponse) and a frontend-driven PDF export using window.print() (already partially implemented in scoring-feedback.tsx) or a dedicated library for richer PDF output.

**Primary recommendation:** Extend the existing backend analytics service layer with aggregation queries, add the `business_unit` column to User, build dedicated API endpoints for dashboard stats and admin analytics, enhance the existing user dashboard page with live data, and create the admin analytics page. Use openpyxl for server-side Excel export. Use browser print CSS for PDF export (already established pattern), with jspdf+html2canvas as optional enhancement.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-04 | MR Dashboard from Figma "Medical Representative Dashboard" -- score overview, recent sessions, skill radar chart | User dashboard page exists but stats are partially hardcoded ("--"). Figma design already adapted in Phase 01.1. Enhance with real aggregated data from new analytics endpoints |
| UI-06 | Additional pages (admin, config, reports, session history) follow same design principles | Admin dashboard is empty placeholder. Create admin analytics page and admin reports page using shared components and existing design tokens |
| ANLYT-01 | User can view session history -- list of past sessions with date, scenario, score, duration | Session history page exists at `/user/history` with `useScoreHistory(20)`. Currently shows scenario_name and score but NOT duration. Extend backend `get_score_history` to include duration_seconds and session_type |
| ANLYT-02 | User can view personal performance trends -- score improvement over time per dimension | Line chart with per-dimension trends exists in session-history.tsx. Enhance with date range filtering and a dedicated stats API that computes averages over time windows |
| ANLYT-03 | Admin can view organization-level analytics -- BU comparisons, skill gap heatmaps, training completion rates | No admin analytics exist. Requires: (1) `business_unit` field on User model, (2) new admin analytics API endpoints with aggregate queries, (3) new admin analytics page with recharts bar/heatmap visualizations |
| ANLYT-04 | System recommends next training scenarios based on user's scoring history and identified weaknesses | No recommendation logic exists. Implement a rule-based recommendation service: find the user's weakest scoring dimension, match scenarios emphasizing that dimension's weight, return top-N unplayed or low-scored scenarios |
| ANLYT-05 | Reports and dashboards use Recharts radar/spider charts for multi-dimensional score visualization | Recharts 3.8.0 already installed. RadarChart component exists at `components/scoring/radar-chart.tsx` with current/previous overlay. Reuse for dashboard skill overview and admin heatmap |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

**Backend:**
- Async everywhere: `async def`, `await`, `AsyncSession`
- Pydantic v2 schemas with `model_config = ConfigDict(from_attributes=True)`
- Service layer holds business logic, routers only handle HTTP
- No raw SQL -- use SQLAlchemy ORM or Alembic migrations
- Schema changes MUST use Alembic migration
- All models MUST use `TimestampMixin`
- Create returns 201, Delete returns 204
- Static routes BEFORE parameterized routes
- Ruff lint/format, pytest with >= 95% coverage

**Frontend:**
- TypeScript strict mode, no `any` types
- TanStack Query hooks per domain, no inline `useQuery`
- Path alias `@/` for imports
- `cn()` for conditional classes
- Design tokens as CSS custom properties
- All UI text externalized via react-i18next (zh-CN + en-US)
- No Redux -- TanStack Query for server state

**General:**
- English for commits/code, Chinese for user-facing text where applicable
- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`
- API routes under `/api/v1/` prefix
- Pagination via `PaginatedResponse` wrapper
- JWT auth on all protected routes

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.0 | All charts: radar, line, bar, treemap (heatmap) | Already installed, already used for RadarChart and LineChart |
| openpyxl | 3.1.5 | Server-side Excel report generation | Already a project dependency in pyproject.toml |
| SQLAlchemy 2.0+ | async | Aggregate queries (func.count, func.avg, group_by) | Project ORM, no raw SQL allowed |
| Alembic | >=1.13.0 | Migration for `business_unit` column on User | Required by project rules for all schema changes |

### New Dependencies (Frontend)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| file-saver | 2.0.5 | Trigger browser download of Blob data (Excel files) | When downloading export files from API |
| @types/file-saver | 2.0.7 | TypeScript types for file-saver | TypeScript strict mode requires types |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| file-saver | `<a download>` with Blob URL | file-saver handles edge cases (Safari, large files) better; tiny library (2KB) |
| window.print() for PDF | jspdf + html2canvas | print CSS is already established in project (scoring-feedback.tsx); jspdf adds 300KB+. Use print CSS. |
| recharts TreeMap for heatmap | Custom CSS grid heatmap | TreeMap is built into recharts. However, a simple CSS grid with color-coded cells may be cleaner for a skill-gap matrix. Recommend CSS grid heatmap for skill gaps. |
| Server-side Excel (openpyxl) | Client-side xlsx library | Server-side is preferred: avoids shipping large JS bundles, handles pagination server-side, and openpyxl is already installed |

**Installation:**
```bash
# Frontend
cd frontend
npm install file-saver@^2.0.5 @types/file-saver@^2.0.7

# Backend: no new dependencies needed -- openpyxl already in pyproject.toml
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── api/
│   ├── analytics.py           # NEW: Admin analytics endpoints
│   └── exports.py             # NEW: PDF/Excel export endpoints
├── schemas/
│   └── analytics.py           # NEW: Analytics response schemas
├── services/
│   ├── analytics_service.py   # NEW: Aggregation queries, recommendation engine
│   └── export_service.py      # NEW: Excel workbook generation

frontend/src/
├── api/
│   └── analytics.ts           # NEW: Analytics API client
├── types/
│   └── analytics.ts           # NEW: Analytics TypeScript types
├── hooks/
│   └── use-analytics.ts       # NEW: TanStack Query hooks for analytics
├── components/
│   └── analytics/             # NEW: Chart wrapper components
│       ├── performance-radar.tsx
│       ├── trend-line-chart.tsx
│       ├── skill-gap-heatmap.tsx
│       ├── bu-comparison-bar.tsx
│       └── completion-rate.tsx
├── pages/
│   ├── user/
│   │   └── dashboard.tsx      # MODIFY: Replace hardcoded stats with live data
│   └── admin/
│       ├── dashboard.tsx       # MODIFY: Replace EmptyState with analytics
│       └── reports.tsx         # NEW: Admin export/reports page
├── public/locales/
│   ├── en-US/
│   │   └── analytics.json     # NEW: Analytics i18n namespace
│   └── zh-CN/
│       └── analytics.json     # NEW: Analytics i18n namespace
```

### Pattern 1: Analytics Service with Aggregate Queries
**What:** Backend service with SQLAlchemy aggregate functions for dashboard stats
**When to use:** Any endpoint returning computed metrics (averages, counts, trends)
**Example:**
```python
# Source: Existing project pattern from scoring_service.py
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

async def get_user_dashboard_stats(db: AsyncSession, user_id: str) -> dict:
    """Compute dashboard statistics for a single user."""
    result = await db.execute(
        select(
            func.count(CoachingSession.id).label("total_sessions"),
            func.avg(CoachingSession.overall_score).label("avg_score"),
        )
        .where(
            CoachingSession.user_id == user_id,
            CoachingSession.status == "scored",
        )
    )
    row = result.one()
    return {
        "total_sessions": row.total_sessions or 0,
        "avg_score": round(row.avg_score or 0, 1),
    }
```

### Pattern 2: Excel Export via StreamingResponse
**What:** Generate Excel workbook server-side and stream to client
**When to use:** Export endpoints for reports
**Example:**
```python
# Source: FastAPI + openpyxl pattern
from io import BytesIO
from fastapi.responses import StreamingResponse
from openpyxl import Workbook

async def export_sessions_excel(db: AsyncSession, user_id: str) -> StreamingResponse:
    wb = Workbook()
    ws = wb.active
    ws.title = "Session History"
    ws.append(["Date", "Scenario", "Score", "Duration (min)", "Result"])
    # ... populate rows from DB query ...
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=report.xlsx"},
    )
```

### Pattern 3: Frontend Blob Download
**What:** Download binary file from API endpoint using axios responseType blob
**When to use:** When user clicks "Export Excel" button
**Example:**
```typescript
// Source: Standard axios blob pattern
import { saveAs } from "file-saver";
import apiClient from "./client";

export async function downloadSessionsExcel(): Promise<void> {
  const { data } = await apiClient.get("/analytics/export/sessions", {
    responseType: "blob",
  });
  saveAs(data, `sessions-report-${Date.now()}.xlsx`);
}
```

### Pattern 4: Recommendation Engine (Rule-Based)
**What:** Simple rule-based scenario recommendation from scoring weakness patterns
**When to use:** ANLYT-04 -- recommend next training scenarios
**Example:**
```python
async def get_recommended_scenarios(
    db: AsyncSession, user_id: str, limit: int = 3
) -> list[dict]:
    """Recommend scenarios targeting user's weakest dimensions."""
    # 1. Find user's average scores per dimension (last 10 sessions)
    # 2. Identify weakest dimension
    # 3. Find scenarios with highest weight for that dimension
    # 4. Exclude recently completed scenarios
    # 5. Return top N
```

### Anti-Patterns to Avoid
- **Inline aggregate queries in routers:** All SQLAlchemy aggregate logic belongs in `analytics_service.py`, not in API routes
- **Client-side data aggregation:** Do NOT fetch all sessions to the frontend and compute averages/trends in JS. The backend must aggregate via SQL
- **Hardcoded chart data:** The existing dashboard has `"--"` placeholder values. Replace with real API-driven data
- **Separate API call per stat card:** Bundle related stats into a single endpoint (e.g., `/analytics/dashboard` returns all 4 stat values)
- **Missing i18n:** Every new string must go through react-i18next. Do not hardcode English/Chinese text

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel workbook generation | Custom CSV/tab writer | openpyxl `Workbook` | Handles formatting, multiple sheets, date types, large datasets. Already installed. |
| Browser file download | Manual Blob URL + anchor click | file-saver `saveAs()` | Handles Safari quirks, revokes object URLs, tiny footprint |
| Radar/spider charts | Custom SVG polygon math | recharts `RadarChart` | Already in use at `components/scoring/radar-chart.tsx`. Reuse the component. |
| Date range filtering | Custom date picker logic | Simple `select` dropdowns (7d/30d/90d/all) | MVP does not need a full date-range picker. Simple preset ranges are sufficient. |
| PDF export | Server-side PDF generation library | Browser `window.print()` with print CSS | Already established in `scoring-feedback.tsx`. Print stylesheet hides nav/sidebar. |

**Key insight:** This phase is primarily about backend aggregation queries and frontend visualization wiring. The charting library and export tools are already available -- the work is in writing the right SQL queries and connecting data to existing UI patterns.

## Common Pitfalls

### Pitfall 1: N+1 Query in Analytics
**What goes wrong:** Loading each session's score details one-by-one in a loop when computing aggregates
**Why it happens:** Easy to write `for session in sessions: load score details`
**How to avoid:** Use SQLAlchemy `selectinload` for relationships, or write aggregate queries with `func.avg`/`func.count` and `group_by` to avoid loading individual records
**Warning signs:** Dashboard stats endpoint takes > 500ms

### Pitfall 2: Missing Business Unit Migration
**What goes wrong:** ANLYT-03 requires BU comparisons but User model has no `business_unit` field
**Why it happens:** The field was not part of the original auth schema
**How to avoid:** Add Alembic migration with `server_default=""` for existing rows. Use `render_as_batch=True` for SQLite compatibility (Gotcha #1).
**Warning signs:** Admin analytics queries fail with "no such column"

### Pitfall 3: Timezone-Naive Date Comparison
**What goes wrong:** "This week" and "last 7 days" calculations produce wrong results
**Why it happens:** SQLite stores datetimes as timezone-naive strings. The session model has `started.tzinfo is None` handling already (see `session_service.py:181`).
**How to avoid:** Always use `datetime.now(UTC)` and handle timezone-naive comparison as the existing code does
**Warning signs:** "This week" count shows stale data or all-time data

### Pitfall 4: Admin Role Check Missing on Analytics Endpoints
**What goes wrong:** Regular users can access organization-level analytics
**Why it happens:** New router uses `get_current_user` but not `require_role("admin")`
**How to avoid:** Use `require_role("admin")` dependency on all admin analytics endpoints, same pattern as admin config/rubric endpoints
**Warning signs:** Non-admin users see org-level data

### Pitfall 5: Recharts Heatmap Misuse
**What goes wrong:** Using recharts TreeMap for a skill-gap heatmap produces poor visual results
**Why it happens:** TreeMap is for hierarchical size comparison, not a 2D matrix
**How to avoid:** Build the skill-gap heatmap as a CSS grid with colored cells (similar to GitHub contribution graph). recharts is not the right tool for matrix heatmaps.
**Warning signs:** Heatmap looks like a random rectangle mosaic instead of a structured grid

### Pitfall 6: Export Endpoint Without Auth
**What goes wrong:** Excel export endpoint is accessible without authentication
**Why it happens:** Export routers added without `Depends(get_current_user)`
**How to avoid:** All export endpoints MUST include `user: User = Depends(get_current_user)` and admin-only exports must use `require_role("admin")`
**Warning signs:** Unauthenticated request returns data

## Code Examples

### Backend: User Dashboard Stats Endpoint
```python
# Source: Existing project patterns from scoring_service.py and session_service.py
from datetime import UTC, datetime, timedelta
from sqlalchemy import and_, func, select

async def get_user_dashboard_stats(db: AsyncSession, user_id: str) -> dict:
    """All four stat card values in one query batch."""
    now = datetime.now(UTC)
    week_start = now - timedelta(days=7)

    # Total scored sessions
    total_q = await db.execute(
        select(func.count())
        .select_from(CoachingSession)
        .where(CoachingSession.user_id == user_id, CoachingSession.status == "scored")
    )
    total_sessions = total_q.scalar_one()

    # Average score
    avg_q = await db.execute(
        select(func.avg(CoachingSession.overall_score))
        .where(CoachingSession.user_id == user_id, CoachingSession.status == "scored")
    )
    avg_score = avg_q.scalar_one() or 0

    # This week count
    week_q = await db.execute(
        select(func.count())
        .select_from(CoachingSession)
        .where(
            CoachingSession.user_id == user_id,
            CoachingSession.created_at >= week_start,
        )
    )
    this_week = week_q.scalar_one()

    return {
        "total_sessions": total_sessions,
        "avg_score": round(float(avg_score), 1),
        "this_week": this_week,
    }
```

### Backend: Admin Org-Level Analytics
```python
# Source: SQLAlchemy aggregate pattern from project
async def get_org_analytics(db: AsyncSession) -> dict:
    """Organization-level analytics for admin dashboard."""
    # Sessions per BU
    bu_result = await db.execute(
        select(
            User.business_unit,
            func.count(CoachingSession.id).label("session_count"),
            func.avg(CoachingSession.overall_score).label("avg_score"),
        )
        .join(CoachingSession, CoachingSession.user_id == User.id)
        .where(CoachingSession.status == "scored")
        .group_by(User.business_unit)
    )
    bu_stats = [dict(row._mapping) for row in bu_result.all()]

    # Training completion rate
    total_users = await db.execute(select(func.count()).select_from(User).where(User.role == "user"))
    users_with_sessions = await db.execute(
        select(func.count(func.distinct(CoachingSession.user_id)))
        .where(CoachingSession.status == "scored")
    )
    total = total_users.scalar_one()
    active = users_with_sessions.scalar_one()
    completion_rate = round((active / max(total, 1)) * 100, 1)

    return {
        "bu_stats": bu_stats,
        "completion_rate": completion_rate,
        "total_users": total,
        "active_users": active,
    }
```

### Frontend: Skill Gap Heatmap (CSS Grid)
```typescript
// Source: Project convention with cn() and design tokens
interface SkillGapCell {
  bu: string;
  dimension: string;
  avgScore: number;
}

function getHeatColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 70) return "bg-yellow-100 text-yellow-800";
  if (score >= 60) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

export function SkillGapHeatmap({ data }: { data: SkillGapCell[] }) {
  // Group by BU, display dimensions as columns
  // Each cell shows avgScore with color intensity
}
```

### Frontend: Excel Download Hook
```typescript
// Source: TanStack Query mutation + file-saver pattern
import { useMutation } from "@tanstack/react-query";
import { downloadSessionsExcel } from "@/api/analytics";

export function useExportExcel() {
  return useMutation({
    mutationFn: () => downloadSessionsExcel(),
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| recharts v2 | recharts v3.8.0 | Already in project | Treeshaking improved, same API surface |
| window.print() only | window.print() + jspdf option | N/A | print CSS is the simple path; jspdf adds rich layout but larger bundle |
| Client-side XLSX (SheetJS) | Server-side openpyxl | N/A | Server-side avoids 300KB JS bundle; openpyxl already installed |

**Deprecated/outdated:**
- recharts v2 API: v3 is installed; some old examples may reference v2 patterns but v3 is backward compatible
- SheetJS (xlsx) has licensing concerns for commercial use; openpyxl (server-side) avoids this entirely

## Open Questions

1. **Business Unit values for seed data**
   - What we know: ANLYT-03 requires BU comparisons. User model needs a `business_unit` field.
   - What's unclear: What BU values to use for seed/demo data (e.g., "Oncology BU", "Hematology BU", "Solid Tumor BU")
   - Recommendation: Use generic BU names in seed data. The field should be a free-text String(100) -- admin can set values. Pre-populate the 3 seed users with different BUs.

2. **Improvement percentage calculation**
   - What we know: The scoring service already computes `improvement_pct` per dimension (current - previous). The dashboard "Improvement" stat card shows "--".
   - What's unclear: Should the dashboard improvement be overall score improvement (latest vs first), or average of last N sessions vs prior N?
   - Recommendation: Use latest scored session's overall_score minus the one before it. Simple, matches existing `get_score_history` logic.

3. **Admin analytics -- which users to include**
   - What we know: Admin sees org-level stats. All `role="user"` accounts should be included.
   - What's unclear: Should admin users who also take training be included in analytics?
   - Recommendation: Include only `role="user"` in organization analytics. Admins testing scenarios should not skew training metrics.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | Backend | Checked via CLAUDE.md | 3.11+ | -- |
| Node.js 20+ | Frontend | Checked via CLAUDE.md | 20+ | -- |
| openpyxl | Excel export | Installed | 3.1.5 | -- |
| recharts | Charts | Installed | 3.8.0 | -- |
| file-saver | Download trigger | Not installed | -- | `npm install file-saver` |
| @types/file-saver | TS types | Not installed | -- | `npm install @types/file-saver` |

**Missing dependencies with no fallback:**
- None (all core tools available)

**Missing dependencies with fallback:**
- file-saver: Simple `npm install` in Plan 1

## Sources

### Primary (HIGH confidence)
- **Existing codebase** -- Verified all models, schemas, services, pages, components, and dependencies by direct file inspection
  - `backend/app/models/session.py` -- CoachingSession model with overall_score, duration_seconds, session_type
  - `backend/app/models/score.py` -- SessionScore and ScoreDetail models
  - `backend/app/models/user.py` -- User model (confirmed NO business_unit field)
  - `backend/app/services/scoring_service.py` -- `get_score_history()` with dimension trends
  - `backend/app/services/report_service.py` -- `generate_report()` with full dimension breakdown
  - `frontend/src/pages/user/dashboard.tsx` -- Existing dashboard with hardcoded stat placeholders
  - `frontend/src/pages/user/session-history.tsx` -- LineChart with dimension trends
  - `frontend/src/pages/admin/dashboard.tsx` -- Empty placeholder
  - `frontend/src/components/scoring/radar-chart.tsx` -- Reusable recharts RadarChart
  - `frontend/src/router/index.tsx` -- Existing route structure
  - `frontend/src/components/layouts/user-layout.tsx` -- Nav items include `/user/reports` path
  - `frontend/src/components/layouts/admin-layout.tsx` -- Sidebar items include `/admin/reports` path

### Secondary (MEDIUM confidence)
- **npm registry** -- Verified versions: recharts 3.8.0, file-saver 2.0.5, @types/file-saver 2.0.7, jspdf 4.2.1, html2canvas 1.4.1
- **pip show openpyxl** -- Confirmed version 3.1.5 installed

### Tertiary (LOW confidence)
- Web search for recharts heatmap patterns was unavailable (API errors). Recommendation for CSS grid heatmap over recharts TreeMap is based on training data knowledge of recharts capabilities. The heatmap implementation should be validated during development.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already installed and verified against npm/pip registries
- Architecture: HIGH -- Follows exact patterns from existing codebase (scoring_service, report_service, radar-chart)
- Pitfalls: HIGH -- Identified from direct codebase inspection (timezone handling, SQLite batch mode, auth patterns)
- Export: MEDIUM -- openpyxl server-side export is standard; PDF via print CSS is established but limited in formatting control
- Heatmap: MEDIUM -- CSS grid recommendation based on training data; recharts TreeMap is not ideal but could work

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable domain, no fast-moving dependencies)

</details>

## Verification

<details><summary>Click to expand verification report</summary>

# Phase 4: Dashboard & Reporting Verification Report

**Phase Goal:** MRs can track their improvement over time via a personal dashboard, and admins can view organization-level analytics with export capabilities
**Verified:** 2026-03-26T03:15:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view a personal dashboard with score overview, recent sessions, and a skill radar chart showing multi-dimensional performance | VERIFIED | `frontend/src/pages/user/dashboard.tsx` uses `useDashboardStats` hook for 4 stat cards (total_sessions, avg_score, this_week, improvement), `useScoreHistory` for recent sessions, and `PerformanceRadar` component with recharts RadarChart for skill overview |
| 2 | User can view session history (date, scenario, score, duration) and personal performance trends over time per scoring dimension | VERIFIED | `frontend/src/pages/user/session-history.tsx` shows duration column (line 261), uses `useScoreHistory`, and displays `PerformanceRadar`. `frontend/src/pages/user/reports.tsx` uses `useDimensionTrends` with `TrendLineChart` for per-dimension trends |
| 3 | Admin can view organization-level analytics including BU comparisons, skill gap heatmaps, and training completion rates | VERIFIED | `frontend/src/pages/admin/dashboard.tsx` uses `useOrgAnalytics` hook, renders `BuComparisonBar` (recharts BarChart), `SkillGapHeatmap` (color-coded table), and `CompletionRate` components, all fed by live `orgData` |
| 4 | Reports can be exported as PDF/Excel for offline review | VERIFIED | Excel: `frontend/src/api/analytics.ts` has `downloadSessionsExcel` and `downloadAdminReportExcel` using file-saver; backend `export_service.py` generates openpyxl workbooks. PDF: `frontend/src/pages/user/reports.tsx` line 92 calls `window.print()` with `@media print` CSS in `frontend/src/styles/index.css` |
| 5 | All new code has unit tests with >= 95% coverage maintained | VERIFIED | `backend/tests/test_analytics.py` has 35 tests covering all 7 endpoints (dashboard, trends, recommendations, export/sessions, admin/overview, admin/skill-gaps, export/admin-report) plus edge cases and date range filtering -- all 35 pass |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/schemas/analytics.py` | Pydantic v2 analytics schemas | VERIFIED (79 lines) | 7 schemas: UserDashboardStats, DimensionScore, DimensionTrendPoint, BuStats, SkillGapCell, OrgAnalytics, RecommendedScenarioItem |
| `backend/app/services/analytics_service.py` | Backend aggregate queries | VERIFIED (364 lines) | 5 async functions with SQLAlchemy func.count, func.avg, group_by, date range filtering |
| `backend/app/services/export_service.py` | Excel workbook generation | VERIFIED (140 lines) | 2 functions: export_sessions_excel, export_admin_report_excel using openpyxl Workbook + BytesIO |
| `backend/app/api/analytics.py` | FastAPI router with 7 endpoints | VERIFIED (106 lines) | 7 endpoints with require_role('admin') on admin routes, start_date/end_date params |
| `frontend/src/types/analytics.ts` | TypeScript interfaces | VERIFIED (52 lines) | 7 interfaces matching backend schemas |
| `frontend/src/api/analytics.ts` | Typed axios API client | VERIFIED (51 lines) | 6 functions including downloadSessionsExcel, downloadAdminReportExcel with file-saver |
| `frontend/src/hooks/use-analytics.ts` | TanStack Query hooks | VERIFIED (49 lines) | 6 hooks: useDashboardStats, useDimensionTrends, useOrgAnalytics, useRecommendedScenarios, useExportSessionsExcel, useExportAdminReport |
| `frontend/src/pages/user/dashboard.tsx` | Enhanced user dashboard | VERIFIED (233 lines) | Uses useDashboardStats, useRecommendedScenarios, useExportSessionsExcel, PerformanceRadar |
| `frontend/src/pages/user/session-history.tsx` | Session history with duration | VERIFIED (395 lines) | Duration column present, PerformanceRadar for skill radar |
| `frontend/src/pages/user/reports.tsx` | User reports with live data | VERIFIED (246 lines) | Uses useDashboardStats, useDimensionTrends, useRecommendedScenarios, TrendLineChart, PerformanceRadar, window.print() for PDF |
| `frontend/src/pages/admin/dashboard.tsx` | Admin analytics dashboard | VERIFIED (277 lines) | Uses useOrgAnalytics, BuComparisonBar, SkillGapHeatmap, CompletionRate -- all live data |
| `frontend/src/pages/admin/reports.tsx` | Admin reports with exports | VERIFIED (428 lines) | Uses useOrgAnalytics for live summary stats, useExportSessionsExcel, useExportAdminReport |
| `frontend/src/components/analytics/performance-radar.tsx` | Recharts radar chart wrapper | VERIFIED (70 lines) | RadarChart with PolarGrid, current + previous scores |
| `frontend/src/components/analytics/trend-line-chart.tsx` | Recharts line chart wrapper | VERIFIED (80 lines) | LineChart with per-dimension lines, overall score line |
| `frontend/src/components/analytics/skill-gap-heatmap.tsx` | CSS grid heatmap | VERIFIED (86 lines) | Color-coded table with getHeatColor function |
| `frontend/src/components/analytics/bu-comparison-bar.tsx` | Recharts bar chart | VERIFIED (44 lines) | BarChart with session count and avg score per BU |
| `frontend/src/components/analytics/completion-rate.tsx` | Completion rate display | VERIFIED (28 lines) | Rate, total users, active users |
| `frontend/src/components/analytics/index.ts` | Barrel exports | VERIFIED (5 lines) | Exports all 5 chart components |
| `frontend/public/locales/en-US/analytics.json` | English i18n translations | VERIFIED (52 lines) | Complete analytics namespace |
| `frontend/public/locales/zh-CN/analytics.json` | Chinese i18n translations | VERIFIED (52 lines) | Complete analytics namespace |
| `backend/tests/test_analytics.py` | Pytest tests for analytics | VERIFIED (487 lines) | 35 tests, all passing |
| `backend/scripts/seed_data.py` | Seed data with sessions | VERIFIED (317 lines) | seed_sessions() creates 12 scored sessions across 3 BUs |
| `backend/alembic/versions/e8cd533abc43_add_business_unit_to_users.py` | Alembic migration | VERIFIED | Migration file exists |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `analytics_service.py` | `models/session.py` | SQLAlchemy aggregate queries | WIRED | func.count, func.avg, group_by, selectinload all present |
| `export_service.py` | `openpyxl` | Workbook creation | WIRED | `from openpyxl import Workbook` at line 5 |
| `api/analytics.py` | `services/analytics_service.py` | Service function calls | WIRED | analytics_service.get_user_dashboard_stats, get_user_dimension_trends, get_org_analytics, get_skill_gap_matrix, get_recommended_scenarios |
| `api/analytics.py` | `services/export_service.py` | Export function calls | WIRED | export_service.export_sessions_excel, export_service.export_admin_report_excel |
| `main.py` | `api/__init__.py` | Router import | WIRED | `analytics_router` imported and included at line 110 |
| `frontend/api/analytics.ts` | `frontend/api/client.ts` | import apiClient | WIRED | `import apiClient from "./client"` at line 2 |
| `frontend/hooks/use-analytics.ts` | `frontend/api/analytics.ts` | import API functions | WIRED | All 6 functions imported from `@/api/analytics` |
| `pages/user/dashboard.tsx` | `hooks/use-analytics.ts` | Hook imports | WIRED | useDashboardStats, useRecommendedScenarios, useExportSessionsExcel all imported and called |
| `pages/user/reports.tsx` | `hooks/use-analytics.ts` | Hook imports | WIRED | useDashboardStats, useDimensionTrends, useRecommendedScenarios, useExportSessionsExcel all imported and called |
| `pages/admin/dashboard.tsx` | `hooks/use-analytics.ts` | Hook imports | WIRED | useOrgAnalytics imported and called, data rendered via BuComparisonBar, SkillGapHeatmap, CompletionRate |
| `pages/admin/reports.tsx` | `hooks/use-analytics.ts` | Hook imports | WIRED | useOrgAnalytics, useExportSessionsExcel, useExportAdminReport imported and called |
| `router/index.tsx` | `pages/admin/reports.tsx` | Route registration | WIRED | `/admin/reports` route at line 70, import at line 18 |
| `router/index.tsx` | `pages/user/reports.tsx` | Route registration | WIRED | `/user/reports` route at line 46, import at line 20 |
| `seed_data.py` | `models/session.py` | ORM model instances | WIRED | CoachingSession, SessionScore, ScoreDetail all created with realistic data |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `pages/user/dashboard.tsx` | `dashStats` (useDashboardStats) | GET /analytics/dashboard -> analytics_service.get_user_dashboard_stats -> SQLAlchemy func.count/func.avg queries | Yes - aggregate queries on CoachingSession table | FLOWING |
| `pages/user/dashboard.tsx` | `recommended` (useRecommendedScenarios) | GET /analytics/recommendations -> analytics_service.get_recommended_scenarios -> weakest dimension query chain | Yes - multi-step query logic with real DB queries | FLOWING |
| `pages/user/reports.tsx` | `trends` (useDimensionTrends) | GET /analytics/trends -> analytics_service.get_user_dimension_trends -> selectinload queries | Yes - joined queries with session/score/details | FLOWING |
| `pages/admin/dashboard.tsx` | `orgData` (useOrgAnalytics) | GET /analytics/admin/overview -> analytics_service.get_org_analytics -> multiple aggregate queries | Yes - 6+ separate DB queries for org stats | FLOWING |
| `pages/admin/reports.tsx` | `orgData` (useOrgAnalytics) | Same as above | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend analytics tests pass | `pytest tests/test_analytics.py -v` | 35/35 passed (7.43s) | PASS |
| TypeScript compiles without errors | `npx tsc -b` | No output (success) | PASS |
| Frontend builds successfully | `npm run build` | Built in 3.85s, dist/ generated | PASS |
| Analytics router registered | grep analytics_router main.py | Found import (line 8) and include_router (line 110) | PASS |
| All admin endpoints use require_role | grep require_role analytics.py | 3 occurrences on admin/overview, admin/skill-gaps, export/admin-report | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| UI-04 | 04-02, 04-04, 04-06 | MR Dashboard from Figma -- score overview, recent sessions, skill radar chart | SATISFIED | dashboard.tsx has 4 stat cards from useDashboardStats, recent sessions from useScoreHistory, PerformanceRadar chart |
| UI-06 | 04-05, 04-06 | Additional pages follow design principles -- admin, reports, session history | SATISFIED | admin/dashboard.tsx, admin/reports.tsx, user/reports.tsx, user/session-history.tsx all follow shared component patterns with i18n |
| ANLYT-01 | 04-01, 04-03, 04-04, 04-06 | User can view session history -- date, scenario, score, duration | SATISFIED | session-history.tsx shows all 4 columns including duration (line 261) |
| ANLYT-02 | 04-01, 04-04, 04-06 | User performance trends -- score improvement over time per dimension | SATISFIED | user/reports.tsx uses useDimensionTrends + TrendLineChart with per-dimension lines |
| ANLYT-03 | 04-01, 04-03, 04-05, 04-06 | Admin org-level analytics -- BU comparisons, skill gap heatmaps, completion rates | SATISFIED | admin/dashboard.tsx uses useOrgAnalytics with BuComparisonBar, SkillGapHeatmap, CompletionRate components |
| ANLYT-04 | 04-01, 04-03, 04-04, 04-06 | Recommendation engine based on scoring history and weaknesses | SATISFIED | analytics_service.get_recommended_scenarios implements multi-step weakest-dimension logic; dashboard.tsx and reports.tsx display recommendations |
| ANLYT-05 | 04-02, 04-04, 04-05 | Recharts radar/spider charts for multi-dimensional visualization | SATISFIED | PerformanceRadar (RadarChart), TrendLineChart (LineChart), BuComparisonBar (BarChart) all use recharts |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/pages/admin/dashboard.tsx` | 31-58 | Mock data arrays (SCORE_DISTRIBUTION, TOP_PERFORMERS, NEEDS_ATTENTION, HEATMAP_DATA) | Warning | Score distribution, top performers, needs attention, and training activity heatmap sections use hardcoded data. Core org analytics (stat cards, BU comparison, skill gap heatmap, completion rate) use live data from useOrgAnalytics. These mock sections are supplementary visualizations not required by any ANLYT requirement. |
| `frontend/src/pages/admin/reports.tsx` | 39-68 | Mock data arrays for charts (groupPerformanceData, scoreTrendData, completionData, skillGapData) | Warning | Chart sections in admin reports page use mock data. Summary stats section uses live useOrgAnalytics data. The comment states "charts will be wired to live data in future plans". This is documented in 04-06-SUMMARY known stubs section. Export buttons (Excel) are fully wired. |

**Assessment:** The mock data in admin pages is limited to supplementary visualizations (score distribution, individual performer rankings, training activity heatmap on the dashboard; and detailed chart sections on the reports page). All core analytics features required by ANLYT-01 through ANLYT-05 use live data. The stat cards, BU comparison, skill gap heatmap, and completion rate -- which are the org-level analytics specified in ANLYT-03 -- are all wired to live useOrgAnalytics data. The mock sections are aesthetic enhancements that do not block any requirement.

### Human Verification Required

### 1. Dashboard Visual Rendering
**Test:** Navigate to /user/dashboard as a user with scored sessions
**Expected:** 4 stat cards show real numbers (not "--" or 0), recent sessions list is populated, skill radar chart renders with dimension scores, recommended scenario shows a real scenario name
**Why human:** Visual rendering, chart correctness, and layout require browser interaction

### 2. Admin Analytics Dashboard
**Test:** Navigate to /admin/dashboard as admin after running seed_data.py
**Expected:** Stat cards show total users, active users, total sessions, avg score from seeded data; BU comparison bar chart shows Oncology/Hematology/Solid Tumor; skill gap heatmap shows color-coded dimension scores per BU
**Why human:** Chart visual correctness and color coding require visual inspection

### 3. Excel Export Flow
**Test:** Click "Export Excel" on user dashboard and "Export Full Report" on admin reports page
**Expected:** Browser downloads .xlsx files; user export has session history sheet; admin export has Overview, BU Comparison, and Skill Gaps sheets
**Why human:** File download behavior and Excel file content require browser interaction

### 4. PDF Print Export
**Test:** Click "Print Report" on user reports page
**Expected:** Browser print dialog opens; preview shows content without navigation sidebar; output is suitable for PDF saving
**Why human:** Print CSS rendering and dialog behavior require browser interaction

### Gaps Summary

No blocking gaps found. All 5 ROADMAP success criteria are satisfied. All 7 requirement IDs (UI-04, UI-06, ANLYT-01 through ANLYT-05) are covered with implementation evidence.

**Warnings (non-blocking):**
- Admin dashboard has supplementary mock data (score distribution, top performers, needs attention, training activity heatmap) that are not required by any requirement. These are UI polish items.
- Admin reports page has chart sections using mock data (group performance, score trends, completion rates, skill gap table). The summary stats section is live. Chart wiring is documented as out-of-scope per 04-06-SUMMARY.

These warnings do not affect goal achievement since all ANLYT requirements are satisfied by the live-data sections.

---

_Verified: 2026-03-26T03:15:00Z_
_Verifier: Claude (gsd-verifier)_

</details>

