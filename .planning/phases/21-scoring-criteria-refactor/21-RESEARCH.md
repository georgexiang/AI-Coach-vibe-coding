# Phase 21: Scoring Criteria Refactor - Research

**Researched:** 2026-04-27
**Domain:** Scoring system refactoring -- eliminate hardcoded dimensions, make ScoringRubric the SSOT
**Confidence:** HIGH

## Summary

This phase is a **refactoring** of an existing, working scoring system. The core problem is that 5 scoring dimensions (`key_message`, `objection_handling`, `communication`, `product_knowledge`, `scientific_info`) are hardcoded in **7 locations** across the codebase: the Scenario ORM model (5 weight columns), the scoring engine prompt template (dimension-specific instructions), the mock score generator (5 hardcoded dimension blocks), the frontend ScoringWeights component (typed to exactly 5 keys), the frontend Scenario TypeScript types, the analytics recommendation service (dimension-to-column mapping), and the i18n locale files (hardcoded dimension translations).

A `ScoringRubric` model already exists with a JSON `dimensions` field that supports arbitrary dimension names, weights, and criteria. The rubric editor UI already supports dynamic dimensions. The refactoring goal is to make this rubric the **single source of truth** so all scoring flows read dimensions from the rubric rather than from hardcoded scenario columns. This is a structural cleanup, not a feature addition -- the user-facing behavior (multi-dimensional scoring with configurable weights) remains the same, but becomes truly configurable.

**Primary recommendation:** Add a `rubric_id` FK to the Scenario model, remove the 5 `weight_*` columns via Alembic migration with data migration (converting existing weight values to rubric records), then refactor all downstream consumers (scoring engine, mock generator, frontend components) to read dimensions from the rubric. The two separate scoring systems (session scoring and Skill quality scoring) must remain independent -- they have different dimensions and different purposes.

## Standard Stack

### Core (existing -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy 2.0 | existing | ORM with async sessions | Project standard [VERIFIED: codebase] |
| Alembic | existing | Schema migrations with batch mode for SQLite | Project standard [VERIFIED: codebase] |
| Pydantic v2 | existing | Request/response schemas with validators | Project standard [VERIFIED: codebase] |
| FastAPI | existing | API layer with dependency injection | Project standard [VERIFIED: codebase] |
| react-hook-form + zod | existing | Frontend form validation | Project standard [VERIFIED: codebase] |
| recharts | existing | RadarChart, charts for scoring visualization | Project standard [VERIFIED: codebase] |

### No New Dependencies Required

This refactoring uses exclusively existing libraries. No new packages need to be installed. [VERIFIED: codebase audit]

## Architecture Patterns

### Current Architecture (Before Refactor)

```
Scenario model
  ├── weight_key_message: int = 30
  ├── weight_objection_handling: int = 25
  ├── weight_communication: int = 20
  ├── weight_product_knowledge: int = 15
  ├── weight_scientific_info: int = 10
  └── get_scoring_weights() -> dict  # Returns hardcoded 5-key dict

ScoringRubric model (exists but underused)
  └── dimensions: JSON  # [{name, weight, criteria[], max_score}]

scoring_service.py
  ├── Reads scenario.get_scoring_weights() as fallback
  └── Reads rubric dimensions only if a default rubric exists

scoring_engine.py
  ├── SCORING_PROMPT_TEMPLATE: hardcoded dimension instructions
  └── dim_names dict: maps 5 keys to display names
```

### Target Architecture (After Refactor)

```
Scenario model
  ├── rubric_id: FK -> scoring_rubrics.id (nullable for migration)
  ├── pass_threshold: int = 70
  └── (weight_* columns REMOVED)

ScoringRubric model (SSOT)
  └── dimensions: JSON  # [{name, weight, criteria[], max_score}]

scoring_service.py
  ├── Resolves rubric: scenario.rubric_id -> specific, else default rubric
  └── Passes rubric dimensions to scoring engine

scoring_engine.py
  ├── Builds prompt dynamically from rubric dimensions
  └── No hardcoded dimension names or instructions

Frontend
  ├── ScenarioEditor: rubric selector instead of ScoringWeights
  └── All scoring components: read dimensions from score.details (already dynamic)
```

### Pattern 1: Rubric Resolution Chain

**What:** Deterministic rubric lookup with fallback chain
**When to use:** Every time a session needs to be scored
**Example:**
```python
# Source: [codebase pattern from rubric_service.py]
async def resolve_rubric(db: AsyncSession, scenario: Scenario) -> ScoringRubric:
    """Resolve which rubric to use for scoring.
    
    Priority:
    1. Scenario-specific rubric (scenario.rubric_id)
    2. Default rubric for scenario type (is_default=True, scenario_type match)
    3. System fallback rubric (built-in 5 dimensions with standard weights)
    """
    if scenario.rubric_id:
        rubric = await get_rubric(db, scenario.rubric_id)
        return rubric
    
    default = await get_default_rubric(db, scenario.mode)
    if default:
        return default
    
    return _get_system_fallback_rubric()
```

### Pattern 2: Dynamic Prompt Building

**What:** Build scoring prompt from rubric dimensions, not hardcoded names
**When to use:** LLM scoring engine
**Example:**
```python
# Replace hardcoded dim_names dict with rubric-driven config
def build_dimensions_config(rubric_dimensions: list[dict]) -> str:
    lines = []
    for dim in rubric_dimensions:
        name = dim["name"]
        weight = dim["weight"]
        criteria = dim.get("criteria", [])
        criteria_text = "; ".join(criteria) if criteria else "General assessment"
        lines.append(f"- {name}: weight={weight}%, criteria: {criteria_text}")
    return "\n".join(lines)
```

### Pattern 3: Dynamic Mock Score Generation

**What:** Generate mock scores for arbitrary dimension sets
**When to use:** Mock scoring fallback when LLM unavailable
**Example:**
```python
def _generate_mock_scores(
    rubric_dimensions: list[dict],
    scenario: Scenario,
    messages: list,
    key_messages_status: list[dict],
) -> dict:
    """Generate mock scores for N arbitrary dimensions."""
    dimensions = []
    for dim_config in rubric_dimensions:
        score = min(95, max(60, base_score + random.randint(-8, 10)))
        dimensions.append({
            "dimension": dim_config["name"],
            "score": score,
            "weight": dim_config["weight"],
            "strengths": [...],
            "weaknesses": [...],
            "suggestions": [...],
        })
    # Calculate weighted overall
    overall = sum(d["score"] * d["weight"] / 100 for d in dimensions)
    ...
```

### Anti-Patterns to Avoid

- **Merging session scoring with Skill quality scoring:** These are two separate systems with different dimensions (5 MR-facing vs 6 content-quality). They must remain independent. [VERIFIED: codebase -- Skill scoring uses sop_completeness, knowledge_accuracy, etc.]
- **Merging with DryRun scoring:** DryRun uses executability_score and coverage_percent, which are completely different metrics. Do not touch DryRun scoring. [VERIFIED: codebase]
- **Breaking backward compatibility on stored data:** Existing ScoreDetail rows reference dimension names like `key_message`. These must remain readable even after the refactoring. New sessions will use rubric-defined names.
- **Removing ScoringWeights component entirely:** Deprecate but keep the file until all references are migrated. The rubric editor already handles dynamic dimensions.

## Hardcoded Dimension Locations (Complete Inventory)

| # | File | What's Hardcoded | Action |
|---|------|------------------|--------|
| 1 | `backend/app/models/scenario.py` | 5 `weight_*` columns + `get_scoring_weights()` method | Remove columns, add `rubric_id` FK |
| 2 | `backend/app/schemas/scenario.py` | 5 `weight_*` fields in Create/Update/Response + `validate_weights_sum` | Remove weight fields, add `rubric_id` |
| 3 | `backend/app/services/scoring_engine.py` | `dim_names` dict mapping 5 keys to labels, per-dimension instructions in `SCORING_PROMPT_TEMPLATE` | Build dynamically from rubric |
| 4 | `backend/app/services/scoring_service.py` | `_generate_mock_scores()` with 5 hardcoded dimension blocks | Rewrite as loop over rubric dimensions |
| 5 | `backend/app/services/analytics_service.py` | `weight_map` dict in `get_recommended_scenarios()` mapping dimension to `Scenario.weight_*` columns | Rewrite to query via rubric dimensions |
| 6 | `backend/app/services/scenario_service.py` | `clone_scenario()` copies 5 `weight_*` fields | Copy `rubric_id` instead |
| 7 | `frontend/src/components/admin/scoring-weights.tsx` | `ScoringWeightsProps` typed to 5 keys, `WEIGHT_KEYS`, `I18N_KEYS` | Deprecate component (rubric editor replaces it) |
| 8 | `frontend/src/components/admin/scenario-editor.tsx` | 5 weight fields in zod schema, `ScoringWeights` usage, form values | Replace with rubric selector |
| 9 | `frontend/src/types/scenario.ts` | `ScoringWeights` interface with 5 keys, `Scenario`/`ScenarioCreate` types | Remove weight fields, add `rubric_id` |
| 10 | `frontend/public/locales/en-US/admin.json` | `scenarios.keyMessageDelivery` etc. (5 entries) | Keep for backward compat, mark deprecated |
| 11 | `frontend/public/locales/en-US/scoring.json` | `dimensions.keyMessage` etc. (5 entries) | Keep for backward compat, add dynamic fallback |
| 12 | `backend/scripts/seed_phase2.py` | Scenario seeds with hardcoded weight values | Update to create rubrics and reference rubric_id |
| 13 | `backend/app/startup_seed.py` | Potentially seeds default rubric | Verify/update |

### Components Already Dynamic (No Changes Needed)

| Component | Why It's Already Dynamic |
|-----------|--------------------------|
| `RadarChart` (scoring) | Reads `currentScores: ScorePoint[]` -- dimension comes from data |
| `DimensionBars` | Reads `details: ScoreDetail[]` -- iterates whatever is in the array |
| `FeedbackCard` | Reads single `ScoreDetail` -- displays `detail.dimension` as string |
| `ScoreSummary` | Only shows overall score and pass/fail -- no dimension awareness |
| `ReportSection` | Reads `improvements` array -- dimension comes from data |
| `PerformanceRadar` (analytics) | Reads `currentScores: DimensionPoint[]` -- dynamic |
| `SkillGapHeatmap` | Builds columns from `data` -- already fully dynamic |
| `RubricEditor` | Already supports dynamic dimensions with `useFieldArray` |
| `RubricTable` | Shows dimension count badge -- no hardcoded names |
| `ScoreDetail` model (backend) | `dimension: String(50)` -- already stores arbitrary names |
| `SessionScore` model (backend) | No dimension awareness -- stores overall score only |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weight sum validation | Custom validator | Existing `field_validator` in `RubricCreate` schema | Already validated, tested, handles edge cases [VERIFIED: scoring_rubric.py:30] |
| Dynamic radar charts | Custom chart component | Existing `recharts.RadarChart` with data-driven config | Already renders N-dimensional data from array input [VERIFIED: radar-chart.tsx] |
| Default rubric fallback | Ad-hoc weight defaults | `rubric_service.get_default_rubric()` | Already implements per-scenario-type default lookup [VERIFIED: rubric_service.py:85] |
| Proportional weight redistribution | Manual slider math | The rubric editor already handles this via individual sliders | No need to port `adjustWeights` logic [VERIFIED: rubric-editor.tsx] |
| JSON dimension parsing | Manual JSON.parse | Existing `parse_dimensions_json` validator in `RubricResponse` | Handles both string and list inputs [VERIFIED: scoring_rubric.py:78] |

**Key insight:** The rubric system already has ~80% of what's needed. The refactoring is mainly about removing the parallel hardcoded system and wiring the existing rubric system as the only path.

## Common Pitfalls

### Pitfall 1: SQLite Batch Migration for Column Removal
**What goes wrong:** SQLite does not support `ALTER TABLE DROP COLUMN` natively. Attempting to drop the 5 weight columns will fail.
**Why it happens:** Alembic generates standard `ALTER TABLE` SQL that SQLite cannot execute.
**How to avoid:** Use `render_as_batch=True` in Alembic's `env.py` (already configured per CLAUDE.md Gotcha #1). The migration must use `with op.batch_alter_table('scenarios') as batch_op:` to recreate the table.
**Warning signs:** Migration fails with "near DROP: syntax error" on SQLite.

### Pitfall 2: Breaking Existing ScoreDetail Records
**What goes wrong:** Existing scored sessions have ScoreDetail rows with dimension values like `key_message`, `objection_handling`, etc. If the frontend tries to display these using new rubric-based labels, they may show raw snake_case keys.
**Why it happens:** Dimension names in ScoreDetail are stored as strings, not FK references. They persist the name used at scoring time.
**How to avoid:** The frontend already displays `detail.dimension` as a raw string. Add a dimension display name mapping utility that checks rubric first, then falls back to i18n translation, then to the raw key. Historical data remains readable.
**Warning signs:** Old session reports show `key_message` instead of "Key Message Delivery".

### Pitfall 3: Analytics Recommendation Query Breaks
**What goes wrong:** `get_recommended_scenarios()` in `analytics_service.py` maps dimension names to `Scenario.weight_*` columns to find scenarios targeting the user's weakest dimension. After column removal, this query breaks.
**Why it happens:** The weight_map dict directly references ORM column attributes that no longer exist.
**How to avoid:** Rewrite the recommendation algorithm to: (1) find user's weakest dimension from ScoreDetail records, (2) for each active scenario, load its rubric, (3) rank scenarios by the weight of the weakest dimension in their rubric. This is slightly more complex but correct.
**Warning signs:** 500 errors on user dashboard after migration.

### Pitfall 4: Null rubric_id on Existing Scenarios
**What goes wrong:** After adding `rubric_id` FK and removing weight columns, existing scenarios have `rubric_id=NULL` and no weight data.
**Why it happens:** The data migration must create rubric records from existing weight values before dropping the columns.
**How to avoid:** Two-step migration: (1) Add `rubric_id` column as nullable, create rubric records for each unique weight combination, update scenarios with rubric_id; (2) Only then drop weight columns. Or: single batch migration that does both.
**Warning signs:** All existing scenarios lose their scoring configuration.

### Pitfall 5: Test File Explosions
**What goes wrong:** There are 42+ backend test files and 44+ frontend test files referencing the 5 hardcoded dimensions. Updating all at once creates massive, error-prone diffs.
**Why it happens:** Tests hardcode scenario weights and dimension names in fixtures.
**How to avoid:** Create a shared test fixture/factory that generates rubric-based scenarios. Update tests to use the factory. Tests that only assert on "some dimensions exist" (not specific names) may need minimal changes.
**Warning signs:** Hundreds of test failures after model change.

### Pitfall 6: Prompt Template Regression
**What goes wrong:** The LLM scoring prompt template has dimension-specific instructions ("For key_message, consider which key messages were delivered..."). After making it dynamic, the LLM may produce lower-quality scores because it lacks domain-specific guidance.
**Why it happens:** Generic instructions produce generic scores. The current per-dimension instructions encode domain expertise.
**How to avoid:** Move the dimension-specific instructions INTO the rubric's `criteria` field. The prompt builder reads criteria from the rubric and includes them in the prompt. The default rubric should contain the existing detailed instructions as criteria entries.
**Warning signs:** Score quality drops after refactoring.

## Data Migration Strategy

### Step 1: Create Default Rubrics from Existing Weights

```python
# In Alembic migration or seed script
# For each unique weight combination in scenarios table:
# 1. Create a ScoringRubric record with those weights
# 2. Set the dimension criteria from the current SCORING_PROMPT_TEMPLATE instructions
```

### Step 2: Map Existing Scenarios to Rubrics

```python
# For each scenario:
# 1. Find or create a rubric matching its weight configuration
# 2. Set scenario.rubric_id = rubric.id
```

### Step 3: Verify Before Dropping Columns

```python
# Assert: every scenario with status='active' has a non-null rubric_id
# Assert: every rubric has dimensions summing to 100 weight
# Only then proceed to drop weight columns
```

### Handling the Default 30/25/20/15/10 Split

Most scenarios likely use the default weights (30/25/20/15/10). The migration should:
1. Create ONE default rubric with these weights and `is_default=True`
2. Point all default-weight scenarios to this rubric
3. Create separate rubrics only for scenarios with custom weights

## Separate Scoring Systems (DO NOT MERGE)

| System | Dimensions | Used By | Location |
|--------|------------|---------|----------|
| **Session Scoring** (this refactor) | configurable via rubric (default 5) | F2F + Conference scoring | scoring_service.py, scoring_engine.py |
| **Skill Quality Scoring** | 6 fixed (sop_completeness, knowledge_accuracy, etc.) | Skill Evaluator agent | skill-evaluator/references/evaluation-dimensions.md |
| **DryRun Scoring** | 2 fixed (executability_score, coverage_percent) | Dry Run results | dry_run_service.py |

These three systems are architecturally separate and must remain so. The Skill Quality dimensions evaluate content quality (is the training material good?), while Session dimensions evaluate MR performance (did the MR perform well?). DryRun dimensions evaluate SOP executability. They serve fundamentally different purposes.

## Code Examples

### Alembic Migration: Add rubric_id, Remove weight columns
```python
# Source: [CLAUDE.md Gotcha #1 pattern, adapted for this use case]
def upgrade() -> None:
    # Step 1: Add rubric_id column
    with op.batch_alter_table("scenarios") as batch_op:
        batch_op.add_column(
            sa.Column("rubric_id", sa.String(36), 
                      sa.ForeignKey("scoring_rubrics.id"), nullable=True)
        )
    
    # Step 2: Data migration -- create rubrics and link scenarios
    # (use op.execute for SQL or connection.execute for ORM)
    
    # Step 3: Drop weight columns
    with op.batch_alter_table("scenarios") as batch_op:
        batch_op.drop_column("weight_key_message")
        batch_op.drop_column("weight_objection_handling")
        batch_op.drop_column("weight_communication")
        batch_op.drop_column("weight_product_knowledge")
        batch_op.drop_column("weight_scientific_info")
```

### Dynamic Scoring Prompt Builder
```python
# Source: [adapted from existing scoring_engine.py build_scoring_prompt]
def build_dimensions_instructions(rubric_dimensions: list[dict]) -> str:
    """Build dimension-specific scoring instructions from rubric criteria."""
    lines = []
    for dim in rubric_dimensions:
        name = dim["name"]
        weight = dim["weight"]
        criteria = dim.get("criteria", [])
        lines.append(f"- {name} (weight={weight}%)")
        if criteria:
            for criterion in criteria:
                lines.append(f"  * {criterion}")
    return "\n".join(lines)
```

### Frontend Rubric Selector (replacing ScoringWeights)
```typescript
// Source: [adapted from existing scenario-editor.tsx pattern]
// In ScenarioEditor form, replace ScoringWeights with:
<div className="grid gap-2">
  <Label>{t("scenarios.scoringRubric")}</Label>
  <Controller
    control={form.control}
    name="rubric_id"
    render={({ field }) => (
      <Select value={field.value ?? ""} onValueChange={field.onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select scoring rubric" />
        </SelectTrigger>
        <SelectContent>
          {rubrics.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name} ({r.dimensions.length} dimensions)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )}
  />
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 5 weight columns on Scenario | rubric_id FK to ScoringRubric | This phase | Unlimited configurable dimensions |
| Hardcoded prompt instructions | Rubric criteria field drives prompt | This phase | Admin controls scoring guidance |
| Mock generator with 5 blocks | Loop over rubric dimensions | This phase | Mock works with any dimension count |
| ScoringWeights component (5 sliders) | Rubric selector dropdown | This phase | Scenario editor simplified |

**Deprecated after this phase:**
- `ScoringWeights` component -- replaced by rubric selector in ScenarioEditor
- `Scenario.get_scoring_weights()` method -- replaced by rubric resolution
- `ScoringWeightsProps` TypeScript interface -- no longer used
- `WEIGHT_KEYS` and `I18N_KEYS` constants in scoring-weights.tsx -- no longer used

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Most existing scenarios use the default 30/25/20/15/10 weights | Data Migration Strategy | If many custom weight combos exist, migration creates many rubrics -- not harmful but less clean |
| A2 | The scoring prompt quality will be maintained by putting existing per-dimension instructions into rubric criteria | Common Pitfalls #6 | If criteria field is too short or LLM ignores it, score quality may degrade |
| A3 | Frontend scoring display components are truly dynamic and need no changes | Components Already Dynamic | If any component has hidden hardcoded dimension assumptions, it will break |

## Open Questions

1. **Should rubric_id be required or nullable on Scenario?**
   - What we know: Making it nullable with a fallback chain (scenario rubric -> default rubric -> system fallback) is safest for migration
   - What's unclear: Should we enforce non-null after migration is complete?
   - Recommendation: Keep nullable with fallback chain. Simpler and more resilient.

2. **Should scenario editor show rubric dimensions inline or just a selector?**
   - What we know: The rubric editor (separate page) already allows full dimension editing
   - What's unclear: Do admins want to see/tweak dimensions per-scenario without visiting the rubric page?
   - Recommendation: Start with selector only. Add inline dimension preview as a read-only display. Editing goes to rubric page.

3. **Should the data migration run in Alembic or as a seed script?**
   - What we know: Alembic migrations are the standard for schema changes. Seed scripts handle data population.
   - What's unclear: Creating rubric records with UUIDs in raw SQL (Alembic) is cumbersome vs. using ORM in a script
   - Recommendation: Use a two-phase approach: Alembic adds `rubric_id` column, a data migration script creates rubrics and links scenarios, then a second Alembic drops the old columns. This matches the project's existing pattern of seed scripts.

## Project Constraints (from CLAUDE.md)

- **NEVER modify schema without Alembic migration** -- all column changes require proper migrations
- **render_as_batch for SQLite** -- column drops require batch mode (Gotcha #1)
- **async with for all DB sessions** -- all new service code must use async patterns
- **Service layer = business logic, routers = HTTP only** -- rubric resolution belongs in service
- **Create returns 201, Delete returns 204** -- maintain API conventions
- **No raw SQL** -- use SQLAlchemy ORM or Alembic for all queries
- **db.flush() per project convention** -- not db.commit() (session middleware handles commit)
- **Pydantic v2 schemas with from_attributes=True** -- all schema updates must use ConfigDict
- **TypeScript strict: true** -- no `any` types in frontend changes
- **TanStack Query hooks per domain** -- any new hooks follow existing pattern
- **Conventional commits** -- e.g., `refactor(scoring): remove hardcoded dimensions from scenario model`
- **server_default in migrations** -- for SQLite compatibility with existing rows

## Sources

### Primary (HIGH confidence)
- [Codebase audit] -- All 13 hardcoded locations identified by grep + file read
- [backend/app/models/scenario.py] -- Current 5 weight columns
- [backend/app/models/scoring_rubric.py] -- Existing rubric model with JSON dimensions
- [backend/app/services/scoring_engine.py] -- Hardcoded dim_names and prompt template
- [backend/app/services/scoring_service.py] -- Mock generator and rubric fallback logic
- [backend/app/services/analytics_service.py] -- weight_map recommendation query
- [frontend/src/components/admin/scoring-weights.tsx] -- 5-key typed component
- [frontend/src/components/admin/rubric-editor.tsx] -- Already dynamic with useFieldArray
- [frontend/src/components/scoring/radar-chart.tsx] -- Already data-driven
- [frontend/src/components/scoring/dimension-bars.tsx] -- Already iterates ScoreDetail[]
- [CLAUDE.md] -- Project conventions and gotchas

### Secondary (MEDIUM confidence)
- [backend/app/services/meta_skill_templates/] -- Skill quality scoring dimensions are separate
- [backend/scripts/seed_phase2.py] -- Seed data patterns

## Metadata

**Confidence breakdown:**
- Hardcoded locations: HIGH -- complete grep audit of entire codebase
- Migration strategy: HIGH -- follows established Alembic patterns in project
- Frontend impact: HIGH -- verified each component's data flow
- Backward compatibility: HIGH -- ScoreDetail stores dimension as string, historical data safe
- Prompt quality after refactor: MEDIUM -- depends on criteria field quality (A2)

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (stable internal refactoring, no external dependency risk)
