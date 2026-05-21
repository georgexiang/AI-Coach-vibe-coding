# Phase 22: Scenarios 模块二次重构 - Research

**Researched:** 2026-05-06
**Domain:** Frontend full-page editor refactor, backend schema migration, i18n audit, tag system, state machine
**Confidence:** HIGH

## Summary

Phase 22 is a comprehensive refactoring of the Scenarios module with six interconnected work streams: (1) migrating the dialog-based editor to a full-page editor matching HCP Profile Editor pattern, (2) full frontend i18n audit, (3) replacing fixed `product`/`therapeutic_area` fields with a flexible tags system, (4) extending the state machine to include `archived`, (5) making `skill_id` NOT NULL, and (6) eliminating hardcoded enums via a database configuration table.

The codebase already has clear patterns for all of these — the HCP Profile Editor provides the full-page template, Alembic batch operations are standard for SQLite migrations, and the i18n infrastructure is fully configured. The primary risks are data migration (existing scenarios without skills, converting product/therapeutic_area to tags) and ensuring the i18n audit is truly comprehensive across all modules.

**Primary recommendation:** Execute serially in this order: (1) State machine (lowest risk, small diff), (2) Tags system + migration (backend first), (3) Skill NOT NULL + migration, (4) Full-page editor (frontend), (5) I18N audit (systematic sweep), (6) Global enum config table. Each feature fully tested before proceeding.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Editor 全页化 — 对齐 HCP Editor 风格. Routes: `/admin/scenarios/new` and `/admin/scenarios/:id`. Single page + Tabs (基本信息 / 关联配置 / 评分规则). Back button top-left. Use `useParams` + `useNavigate`.
- D-02: I18N 全局审计 — All frontend pages/components. Both en-US and zh-CN must be complete. Eliminate ALL hardcoded text.
- D-03: 元数据 → 标签系统 — Delete product/therapeutic_area. Replace with tags (预定义 + 自定义). Admin can predefine tag categories.
- D-04: 状态机完善 — draft -> active -> archived. Archived = read-only, can clone. List page filters include archived.
- D-05: Skill 关联强化 — skill_id NOT NULL. Only published skills can be associated. Existing scenarios without skills need migration handling.
- D-06: 全局硬编码消除 — Database config table for all enums. Admin UI for CRUD. Frontend fetches dynamically.
- D-07: 工作方式约束 — One feature complete (with tests) before starting next. Strictly serial delivery.

### Claude's Discretion
- Tags table design (single JSON vs relation table vs polymorphic tags)
- Data migration strategy (how to convert product/therapeutic_area to tags)
- Migration handling for scenarios without skill_id
- System enum table schema design
- Tab field grouping and layout details within the editor
- E2E test coverage scenarios

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

## Current State Analysis

### Backend Model & Schema

**Current `Scenario` model fields** (`backend/app/models/scenario.py`):
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| name | String(255) | NOT NULL | |
| description | Text | default="" | |
| product | String(255) | NOT NULL | To be removed (D-03) |
| therapeutic_area | String(255) | default="" | To be removed (D-03) |
| mode | String(20) | default="f2f" | f2f / conference |
| difficulty | String(20) | default="medium" | |
| status | String(20) | default="draft" | Currently only draft/active (D-04 adds archived) |
| hcp_profile_id | String(36) | FK, NOT NULL, indexed | |
| key_messages | Text | default="[]" | JSON array stored as string |
| skill_id | String(36) | FK, nullable, SET NULL | To become NOT NULL (D-05) |
| skill_version_id | String(36) | FK, nullable, SET NULL | Pins to published version |
| rubric_id | String(36) | FK, NOT NULL | Every scenario must have rubric |
| pass_threshold | int | default=70 | |
| created_by | String(36) | FK, NOT NULL | |

**Relationships:** hcp_profile, rubric, skill, skill_version

**Pydantic schemas** (`backend/app/schemas/scenario.py`):
- `ScenarioCreate`: Requires name, product, hcp_profile_id, rubric_id. skill_id optional.
- `ScenarioUpdate`: All fields optional (partial update).
- `ScenarioResponse`: Full model with datetime fields.

[VERIFIED: codebase read]

### Backend Service & API

**Service layer** (`backend/app/services/scenario_service.py`):
- `create_scenario`: Validates HCP profile exists, serializes key_messages to JSON, validates+pins skill version, triggers agent resync
- `get_scenarios`: Paginated list with optional status/mode/search filters, eager-loads HCP profile
- `get_scenario`: Single fetch with eager-load, 404 if not found
- `update_scenario`: Partial update, re-validates skill on change, triggers agent resync
- `delete_scenario`: Hard delete
- `clone_scenario`: Copies all fields, sets status=draft, appends "(Copy)" to name

**API routes** (`backend/app/api/scenarios.py`):
- `POST /scenarios` — Create (admin only, 201)
- `GET /scenarios` — List with filters (admin only)
- `GET /scenarios/active` — Active scenarios for users (authenticated)
- `GET /scenarios/{id}` — Single (authenticated)
- `PUT /scenarios/{id}` — Update (admin only)
- `DELETE /scenarios/{id}` — Delete (admin only, 204)
- `GET /scenarios/{id}/skill` — Get associated skill info
- `POST /scenarios/{id}/clone` — Clone (admin only, 201)

**Key pattern:** Static route `/active` placed BEFORE `/{scenario_id}` (Gotcha #3 compliance).

[VERIFIED: codebase read]

### Frontend Editor (Current Dialog-based)

**File:** `frontend/src/components/admin/scenario-editor.tsx`

**Structure:**
- `Dialog` component with `sm:max-w-2xl max-h-[90vh] overflow-y-auto`
- `react-hook-form` with `zodResolver` for validation
- Form fields in single scrollable column (no tabs)
- Hardcoded constants: `PRODUCTS` (5 items), `THERAPEUTIC_AREAS` (4 items)
- Dependencies: `useHcpProfiles()`, `usePublishedSkills()`, `useRubrics()`
- Sub-components: `ObjectionList` for key messages, `SkillStatusBadge` for archived skill warning

**Hardcoded text in editor:**
- "Name *", "Product *", "Description", "Therapeutic Area", "Assigned HCP *"
- "Mode", "Difficulty", "Skill", "Configure scenario details and scoring rubric"
- "Select product", "Select area", "Select HCP", "Select skill (optional)"
- "No skill", "No published skills available", "This skill is archived"
- Radio labels: "f2f", "conference", "easy", "medium", "hard"

[VERIFIED: codebase read]

### Frontend List Page

**File:** `frontend/src/pages/admin/scenarios.tsx`

**Structure:**
- Status filter (All / Active / Draft) — needs to add "Archived"
- Create button opens dialog (to be changed to navigate)
- `ScenarioTable` component for display
- Delete confirmation dialog
- Clone handler

**ScenarioTable** (`scenario-table.tsx`):
- Columns: Name, Product, HCP (with avatar), Mode, Difficulty, Status, Actions
- Sortable by name/product/difficulty
- Client-side pagination (10 per page)
- Actions dropdown: Edit, Clone, Delete
- Hardcoded column headers: "Name", "Product", "HCP", "Mode", "Difficulty", "Status", "Actions"
- Hardcoded pagination: "Previous", "Next", "Page X of Y"

[VERIFIED: codebase read]

### Reference: HCP Profile Editor Pattern

**File:** `frontend/src/pages/admin/hcp-profile-editor.tsx`

**Key patterns to replicate:**
1. **Route-based:** Uses `useParams<{ id: string }>()` — `id` presence determines new vs edit
2. **Lazy-loaded:** Router entry uses `lazy(() => import(...))`
3. **Route registration:** `hcp-profiles/new` and `hcp-profiles/:id` and `hcp-profiles/:id/edit`
4. **Layout:**
   - Back button (`ArrowLeft` icon) → `navigate("/admin/hcp-profiles")`
   - Title area with context (new/edit + name)
   - Save button in header (not footer)
   - `Form` component wraps entire `Tabs` (state persists across tab switches)
5. **Tabs:** Uses `Tabs/TabsList/TabsTrigger/TabsContent` from shadcn
6. **Form:** `useForm` + `zodResolver`, `Form` context wrapper, `FormField/FormItem/FormLabel/FormControl/FormMessage`
7. **Data loading:** `useHcpProfile(id)` — shows loading spinner if not new and still loading
8. **Submission:** Create → navigate to list. Update → navigate to list.
9. **Cards:** Each section wrapped in `Card/CardHeader/CardTitle/CardContent`

**Hardcoded constants found in HCP editor:**
- `SPECIALTIES` array (9 items)
- `DIFFICULTIES` array (3 items)
- Multiple hardcoded labels: "Name *", "Specialty *", "Hospital", "Title", "Difficulty", "Select specialty"

[VERIFIED: codebase read]

### Router Pattern

**File:** `frontend/src/router/index.tsx`

**Pattern for new routes:**
```typescript
// 1. Add lazy import at top
const ScenarioEditorPage = lazy(() => import("@/pages/admin/scenario-editor"));

// 2. Add route entries under AdminRoute > /admin children
{ path: "scenarios", element: <SuspensePage><ScenariosPage /></SuspensePage> },
{ path: "scenarios/new", element: <SuspensePage><ScenarioEditorPage /></SuspensePage> },
{ path: "scenarios/:id", element: <SuspensePage><ScenarioEditorPage /></SuspensePage> },
```

Current scenarios route is just: `{ path: "scenarios", element: <SuspensePage><ScenariosPage /></SuspensePage> }`

[VERIFIED: codebase read]

### I18N Current Coverage

**i18n infrastructure:** Fully configured with `i18next-http-backend` + `LanguageDetector` + `react-i18next`. Namespaces: common, auth, nav, dashboard, training, coach, admin, scoring, analytics, conference, skill, voice, meta-skill.

**admin.json coverage for scenarios:**
- en-US: `scenarios.*` section has 18 keys (title, createButton, save, etc.)
- zh-CN: `scenarios.*` section mirrors en-US with Chinese translations

**Gaps found (hardcoded text needing i18n):**

In `scenario-editor.tsx`:
- "Name *", "Product *", "Description", "Therapeutic Area", "Assigned HCP *", "Mode", "Difficulty", "Skill"
- "Configure scenario details and scoring rubric"
- "Select product", "Select area", "Select HCP", "Select skill (optional)"
- "No skill", "No published skills available", "This skill is archived"

In `scenario-table.tsx`:
- Column headers: "Name", "Product", "HCP", "Mode", "Difficulty", "Status", "Actions"
- Action items: "Edit", "Clone", "Delete"
- Pagination: "Previous", "Next", "Page X of Y"

In `hcp-profile-editor.tsx`:
- "Name *", "Specialty *", "Hospital", "Title", "Difficulty", "Select specialty"
- Tab labels use i18n but some form labels do not

In `hcp-editor.tsx`:
- Same SPECIALTIES/DIFFICULTIES constants duplicated

In `reports.tsx`:
- Hardcoded product values: "Zanubrutinib", "Tislelizumab", "Pamiparib"
- Some BU filters use i18n defaultValues but product values are raw strings

[VERIFIED: codebase grep + read]

### Hardcoded Enums Found

| Location | Constant | Values |
|----------|----------|--------|
| `scenario-editor.tsx:37` | PRODUCTS | Tislelizumab, Zanubrutinib, Pamiparib, Lifirafenib, Ociperlimab |
| `scenario-editor.tsx:45` | THERAPEUTIC_AREAS | Oncology, Hematology, Immunology, Solid Tumors |
| `hcp-profile-editor.tsx:44` | SPECIALTIES | Oncology, Hematology, Immunology, Neurology, Cardiology, Endocrinology, Dermatology, Gastroenterology, General Practice |
| `hcp-profile-editor.tsx:56` | DIFFICULTIES | easy, medium, hard |
| `hcp-editor.tsx:32` | SPECIALTIES | Same 9 items (DUPLICATE) |
| `hcp-editor.tsx:44` | DIFFICULTIES | Same 3 items (DUPLICATE) |
| `reports.tsx:207-209` | (inline) | Zanubrutinib, Tislelizumab, Pamiparib |
| `reports.tsx:167-175` | (inline) | Oncology, Hematology, Immunology (BU filter) |

**Additional hardcoded values:**
- `scenario.mode`: "f2f" / "conference" — used in multiple places
- `scenario.status`: "draft" / "active" — used in service, schemas, table
- `scenario.difficulty`: "easy" / "medium" / "hard" — used in schema, editor, table

[VERIFIED: codebase grep]

### Alembic Migration Pattern

**Key patterns observed:**
1. **Batch operations for SQLite** (Gotcha #1): All `ALTER TABLE` wrapped in `with op.batch_alter_table(...) as batch_op:`
2. **`render_as_batch=True`** configured in `alembic/env.py` for both offline and online modes
3. **Column additions:** `batch_op.add_column(sa.Column(...))`
4. **Foreign key management:** Named constraints, `ondelete="SET NULL"` or `"CASCADE"`
5. **Server defaults:** `server_default=sa.text("NULL")` or `sa.text("'value'")`
6. **Table creation:** `op.create_table(...)` for new tables (no batch needed)

**For this phase, migrations needed:**
- Remove `product` column, remove `therapeutic_area` column
- Add `tags` column (Text, JSON array) or create `scenario_tags` table
- Add `status` support for "archived" (no schema change needed — just string value)
- Change `skill_id` from nullable to NOT NULL (requires handling existing NULLs)

[VERIFIED: codebase read]

## Key Findings

### Dependencies & Integration Points

1. **Scoring Feedback page** (`/user/scoring/:sessionId`): Displays scenario product/mode — will need adaptation if product is removed
2. **Training page** (`/user/training`): Shows scenarios with product info for MR selection
3. **Conference session**: References scenario mode
4. **Agent sync service**: Triggers on skill assignment change — no change needed
5. **Coaching session model**: References `scenario_id` — no schema change needed
6. **Reports/Analytics**: Filter by product/BU — will need to use tags or different grouping
7. **`GET /scenarios/active`**: Public endpoint used by MR training flow — must maintain response compatibility or update consumer

### Risk Areas

1. **skill_id NOT NULL migration**: Existing scenarios with `skill_id=NULL` will fail constraint. Strategy needed:
   - Option A: Require admin to manually assign skills before migration
   - Option B: Create a "default" skill and assign to orphans
   - Option C: Two-step migration (add constraint in code first, migration later)
   
2. **product/therapeutic_area removal**: These fields are used in:
   - Frontend display (scenario cards, tables, filters)
   - Backend service (no filter by product currently, but future analytics might)
   - Test fixtures (many tests reference "Tislelizumab", "Oncology")
   - Reports page (product filter dropdown)

3. **API contract breaking change**: Removing `product`/`therapeutic_area` from response and adding `tags` is a breaking change. All frontend consumers must be updated atomically.

4. **i18n completeness**: The audit scope is "all frontend modules" — this is large. Risk of missing edge cases in test files, error messages, and conditional renders.

### Reusable Patterns

1. **Full-page editor template**: Copy from `hcp-profile-editor.tsx` — routing, tabs, form, save flow
2. **TanStack Query hooks**: Follow `use-scenarios.ts` pattern for new endpoints
3. **ObjectionList component**: Already used for key_messages, reusable for tags input
4. **Badge styling**: `DIFFICULTY_STYLES` in scenario-table.tsx for status/tag badges
5. **Alembic batch_alter_table**: Standard pattern in all existing migrations
6. **ServiceConfig model**: Pattern for DB-stored configuration (adapt for enum management)

## Architecture Patterns

### Recommended Project Structure for New Files

```
backend/
├── app/models/system_enum.py          # New: SystemEnum model
├── app/schemas/system_enum.py         # New: Pydantic schemas
├── app/services/system_enum_service.py # New: CRUD service
├── app/api/system_enums.py            # New: API routes
├── alembic/versions/
│   ├── xxx_add_system_enums_table.py
│   ├── xxx_scenario_tags_migration.py
│   └── xxx_skill_id_not_null.py

frontend/
├── src/pages/admin/scenario-editor.tsx  # New: Full-page editor
├── src/types/system-enum.ts             # New: TypeScript types
├── src/api/system-enums.ts              # New: API client
├── src/hooks/use-system-enums.ts        # New: TanStack Query hooks
```

### Pattern: System Enum Table Design

```python
# Recommended schema for system_enums table
class SystemEnum(Base, TimestampMixin):
    __tablename__ = "system_enums"
    
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # e.g., "product", "therapeutic_area", "specialty", "difficulty"
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    label_en: Mapped[str] = mapped_column(String(255), nullable=False)
    label_zh: Mapped[str] = mapped_column(String(255), default="")
    sort_order: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(default=True)
    
    __table_args__ = (
        UniqueConstraint("category", "value", name="uq_system_enum_category_value"),
    )
```

### Pattern: Scenario Tags (JSON Array Approach)

```python
# In Scenario model — simplest approach, avoids join table
tags: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of strings
```

Alternative: Many-to-many with a `Tag` model and junction `scenario_tags` table. This allows better querying but adds complexity. Given the existing pattern of JSON arrays for `key_messages`, the JSON approach is consistent.

### Pattern: State Machine Validation

```python
# In scenario_service.py
VALID_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"active"},
    "active": {"archived"},
    # No transitions FROM archived (except clone creates a new draft)
}

async def transition_scenario_status(
    db: AsyncSession, scenario_id: str, new_status: str
) -> Scenario:
    scenario = await get_scenario(db, scenario_id)
    allowed = VALID_TRANSITIONS.get(scenario.status, set())
    if new_status not in allowed:
        bad_request(f"Cannot transition from {scenario.status} to {new_status}")
    scenario.status = new_status
    await db.flush()
    await db.refresh(scenario)
    return scenario
```

### Anti-Patterns to Avoid
- **Direct status string assignment without validation**: Always go through the transition function
- **Removing DB columns before frontend is updated**: Deploy frontend changes first, then migration
- **Hardcoding new enum values**: All new enums must come from system_enums table
- **Inline tags storage without index considerations**: JSON columns can't be efficiently queried in SQLite; keep tag search in-memory or add a separate index table later

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation | Manual validation | zod + react-hook-form + zodResolver | Already in use, proven pattern |
| State management | Custom state machine lib | Simple dict + validation function | Small enough, Skill model already demonstrates this |
| Tag input UI | Custom tag picker from scratch | Adapt ObjectionList or use cmdk/command palette | Existing components handle list editing |
| i18n extraction | Manual file scanning | grep + systematic page-by-page audit | Comprehensive grep catches what manual review misses |
| Migration rollback | Custom data backup | Alembic downgrade() | Standard tooling |

## Common Pitfalls

### Pitfall 1: SQLite ALTER COLUMN Limitations
**What goes wrong:** Attempting to change nullable=True to nullable=False on an existing column with NULL values
**Why it happens:** SQLite doesn't support ALTER COLUMN directly; batch mode recreates the table
**How to avoid:** (1) UPDATE all NULL values FIRST, (2) THEN alter column in batch mode
**Warning signs:** Migration fails with "NOT NULL constraint failed"

### Pitfall 2: Breaking API Contract
**What goes wrong:** Removing `product`/`therapeutic_area` from response while frontend still expects them
**Why it happens:** Backend and frontend deployed out of sync
**How to avoid:** Add `tags` field first (additive), update frontend consumers, THEN remove old fields
**Warning signs:** TypeScript compile errors, 500 errors from Pydantic validation

### Pitfall 3: i18n Key Mismatches
**What goes wrong:** en-US has a key that zh-CN doesn't, or vice versa
**Why it happens:** Adding keys to one file but forgetting the other
**How to avoid:** Always add keys to BOTH locale files simultaneously. Run a diff check.
**Warning signs:** Fallback text showing in UI, `defaultValue` props masking missing keys

### Pitfall 4: Test Fixtures Referencing Removed Fields
**What goes wrong:** Tests fail because they create scenarios with `product: "Tislelizumab"`
**Why it happens:** Test data mirrors old schema
**How to avoid:** Update all test fixtures AFTER schema migration, grep for removed field names
**Warning signs:** pytest/vitest failures mentioning "unexpected field"

### Pitfall 5: Eager-load Chain for Tags
**What goes wrong:** N+1 queries when displaying scenario list with tags
**Why it happens:** If using a join table for tags, forgetting `selectinload`
**How to avoid:** Use JSON array in column (no join needed) OR add `selectinload(Scenario.tags)` to list query
**Warning signs:** Slow list page, many SQL queries in logs

## Recommendations

### Suggested Implementation Order

Based on dependency analysis and risk minimization:

1. **D-04: State machine** (draft -> active -> archived)
   - Smallest change, no schema migration needed (status is already a string field)
   - Add `VALID_TRANSITIONS` dict to service
   - Add `archived` to frontend status filter
   - Block edits on archived scenarios
   - Add archive confirmation dialog

2. **D-06: System enums table** (foundation for D-03)
   - Create `system_enums` model + migration
   - CRUD service + API
   - Seed with current hardcoded values (products, therapeutic_areas, specialties, difficulties)
   - Build admin management UI

3. **D-03: Tags system** (depends on D-06 for predefined tags)
   - Add `tags` column to Scenario model (JSON array)
   - Write data migration: convert existing product/therapeutic_area to tags
   - Keep old columns temporarily (additive change)
   - Update frontend to use tags
   - Remove old columns in follow-up migration

4. **D-05: Skill NOT NULL** (data migration risk)
   - First: audit which scenarios have NULL skill_id
   - Migration: either (a) require admin action first, or (b) assign a sentinel/default skill
   - Alter column to NOT NULL
   - Update frontend: make skill required in form validation

5. **D-01: Editor full-page** (biggest frontend change)
   - Create `scenario-editor.tsx` page component
   - Register new routes in router
   - Implement Tabs layout (基本信息 / 关联配置 / 评分规则)
   - Use new system_enums API for dynamic dropdowns
   - Update scenarios list page to navigate instead of open dialog
   - Remove old dialog-based editor

6. **D-02: I18N global audit** (sweep, best done after editor is stable)
   - Systematic module-by-module scan
   - Add missing keys to both locale files
   - Replace all hardcoded text with t() calls
   - Verify no defaultValue props remain in production code

### Migration Strategy

**For product/therapeutic_area -> tags:**
```python
# Data migration step
def upgrade():
    # 1. Add tags column
    with op.batch_alter_table("scenarios") as batch_op:
        batch_op.add_column(sa.Column("tags", sa.Text(), server_default="[]"))
    
    # 2. Migrate data: combine product + therapeutic_area into tags JSON
    conn = op.get_bind()
    scenarios = conn.execute(sa.text("SELECT id, product, therapeutic_area FROM scenarios"))
    for row in scenarios:
        tags = []
        if row.product:
            tags.append(f"product:{row.product}")
        if row.therapeutic_area:
            tags.append(f"area:{row.therapeutic_area}")
        conn.execute(
            sa.text("UPDATE scenarios SET tags = :tags WHERE id = :id"),
            {"tags": json.dumps(tags), "id": row.id}
        )
    
    # 3. Drop old columns (in a SEPARATE migration after frontend is updated)
```

**For skill_id NOT NULL:**
```python
def upgrade():
    # 1. Check for NULL skill_ids
    conn = op.get_bind()
    nulls = conn.execute(sa.text("SELECT COUNT(*) FROM scenarios WHERE skill_id IS NULL")).scalar()
    if nulls > 0:
        # Option: fail migration with helpful message
        raise Exception(f"{nulls} scenarios have no skill_id. Assign skills first via admin UI.")
    
    # 2. Alter column
    with op.batch_alter_table("scenarios") as batch_op:
        batch_op.alter_column("skill_id", nullable=False)
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JSON array for tags is preferable to a join table given existing key_messages pattern | Architecture Patterns | Medium — if complex tag queries needed later, would need refactor |
| A2 | System enum values use category+value composite key | Architecture Patterns | Low — standard pattern, easy to adjust |
| A3 | Reports page product filter can be adapted to use tags or system_enums | Risk Areas | Medium — may need additional reports refactoring |

## Open Questions

1. **Existing scenarios with NULL skill_id**
   - What we know: Some scenarios may exist without skills (created before skill feature)
   - What's unclear: How many? Is there a "default skill" to assign?
   - Recommendation: Add admin UI warning/batch-assign before running NOT NULL migration

2. **Tag display format in MR-facing pages**
   - What we know: Product was prominently displayed in scenario cards
   - What's unclear: How should tags appear in training selection UI?
   - Recommendation: Show as badges, filter by tag category

3. **Reports page dependency on product field**
   - What we know: Reports page has hardcoded product filter (Zanubrutinib, Tislelizumab, Pamiparib)
   - What's unclear: Should reports use tags for filtering, or system_enums directly?
   - Recommendation: Use system_enums API for product filter, derive from scenario tags for analytics

## Project Constraints (from CLAUDE.md)

- **Async everywhere**: All DB operations async, AsyncSession
- **Pydantic v2**: `model_config = ConfigDict(from_attributes=True)`
- **Route ordering**: Static paths before parameterized (`/active` before `/{id}`)
- **Create returns 201**, Delete returns 204
- **Service layer** = business logic, routers = HTTP only
- **No raw SQL** in application code (OK in Alembic migrations)
- **NEVER modify schema without Alembic migration**
- **npm ci** not npm install
- **TypeScript strict: true** — no `any`, no unused variables
- **TanStack Query hooks** per domain
- **Conventional commits**: feat:, fix:, docs:, test:
- **Pre-commit**: ruff check + ruff format + pytest (backend), tsc -b + build (frontend)
- **Alembic env.py must import all models** (add new SystemEnum model)

## Sources

### Primary (HIGH confidence)
- Codebase direct reads: scenario model, schemas, service, API, frontend components, router, i18n config, migrations
- All file paths verified via Read tool

### Secondary (MEDIUM confidence)
- Architecture recommendations based on established patterns in the same codebase (HCP editor, Skill model VALID_TRANSITIONS, ServiceConfig table)

### Tertiary (LOW confidence)
- None — all findings from direct codebase analysis

## Metadata

**Confidence breakdown:**
- Current state analysis: HIGH — direct file reads
- Architecture patterns: HIGH — derived from existing codebase patterns
- Migration strategy: MEDIUM — data migration specifics depend on current DB state
- Pitfalls: HIGH — observed from existing gotcha list and migration history

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (stable internal codebase, no external dependency drift)
