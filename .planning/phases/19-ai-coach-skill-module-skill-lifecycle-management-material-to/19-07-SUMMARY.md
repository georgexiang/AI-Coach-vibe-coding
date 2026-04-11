---
phase: 19-ai-coach-skill-module
plan: 07
subsystem: skill-scenario-integration
tags: [skill, scenario, agent-sync, script-runner, version-pinning]
dependency_graph:
  requires: [19-01, 19-04]
  provides: [scenario-skill-association, skill-manager, skill-augmented-instructions]
  affects: [agent_sync_service, prompt_builder, scenario_service]
tech_stack:
  added: []
  patterns: [version-pinning, sandboxed-subprocess, lazy-import]
key_files:
  created:
    - backend/app/services/skill_manager.py
    - backend/alembic/versions/960bc2f081dd_add_skill_version_id_to_scenarios.py
  modified:
    - backend/app/models/scenario.py
    - backend/app/schemas/scenario.py
    - backend/app/services/scenario_service.py
    - backend/app/services/prompt_builder.py
    - backend/app/services/agent_sync_service.py
    - backend/app/api/scenarios.py
    - frontend/src/types/scenario.ts
    - frontend/src/components/admin/scenario-editor.tsx
    - frontend/src/components/admin/scenario-editor.test.tsx
decisions:
  - "Version pinning: Scenario.skill_version_id pins to specific immutable SkillVersion for deterministic agent behavior"
  - "Server-side enforcement: only published/archived skills allowed in scenario association"
  - "Backward-compatible agent sync: scenario_id is optional parameter, existing behavior unchanged"
  - "Skill picker shows published skills only, with quality score badge"
  - "SkillStatusBadge warns when associated skill is archived (D-23)"
metrics:
  duration: 11min
  completed: "2026-04-11T08:08:00Z"
---

# Phase 19 Plan 07: Scenario-Skill Integration with SkillManager Summary

Scenario-Skill association with version-pinned runtime injection, SkillManager for instruction composition, sandboxed script runner, and frontend Skill picker.

## What Changed

### Task 1: Scenario skill_version_id FK, migration, schema/service/API updates, Skill picker UI (9915b5d)

**Backend Model & Migration:**
- Added `skill_id` and `skill_version_id` FKs to `Scenario` model with `ondelete="SET NULL"`
- Added `skill` and `skill_version` relationships
- Created Alembic migration `960bc2f081dd` with `server_default=sa.text("NULL")` for SQLite compat

**Backend Schemas:**
- Added `skill_id: str | None = None` to `ScenarioCreate` and `ScenarioUpdate`
- Added `skill_id` and `skill_version_id` to `ScenarioResponse` and `ScenarioOut`

**Backend Service (scenario_service.py):**
- Added `_validate_and_pin_skill()`: server-side enforcement of published/archived-only constraint, pins to published `SkillVersion.id`
- Added `_trigger_agent_resync()`: lazy-import agent sync after skill assignment change
- Updated `create_scenario()`, `update_scenario()`, `clone_scenario()` to handle skill association

**Backend API (scenarios.py):**
- Added `GET /{scenario_id}/skill` endpoint returning skill summary (name, status, quality_score, version_number)

**Frontend Types (scenario.ts):**
- Added `skill_id: string | null` and `skill_version_id: string | null` to `Scenario` and `ScenarioCreate`

**Frontend UI (scenario-editor.tsx):**
- Added Skill picker Select using `usePublishedSkills()` hook
- Shows published skills with quality score badge
- "No skill" option for clearing association
- `SkillStatusBadge` component warns when skill is archived (D-23)
- Fixed `scenario-editor.test.tsx` mock with new fields and `usePublishedSkills` mock

### Task 2: SkillManager, sandboxed script_runner, prompt_builder + agent_sync integration (59c375c)

**SkillManager (skill_manager.py):**
- `SkillContent` dataclass: name, description, content, version_id, token_estimate
- `SkillManager.from_db_skill()`: creates SkillContent from DB models, version-pinned
- `SkillManager.compose_instructions()`: follows reference repo pattern, includes version tag in header for audit trail (T-19-25)
- `load_skill_for_scenario()`: loads skill for a scenario, uses pinned version or falls back to published
- `run_skill_script()`: sandboxed subprocess execution (shell=False, cwd="/tmp", minimal env, timeout=30s, temp file + cleanup) (T-19-22)
- `read_skill_resource()`: on-demand resource loading (D-26)

**Prompt Builder (prompt_builder.py):**
- Added `build_skill_augmented_instructions()`: composes base HCP instructions + Skill SOP via SkillManager
- Uses `TYPE_CHECKING` import pattern for `AsyncSession`

**Agent Sync Service (agent_sync_service.py):**
- Added optional `scenario_id` parameter to `sync_agent_for_profile()`
- When scenario_id provided, uses `build_skill_augmented_instructions()` for Skill-augmented agent instructions
- Backward compatible: no scenario_id = existing behavior

## Decisions Made

1. **Version pinning via skill_version_id**: Scenario references a specific SkillVersion for deterministic agent behavior. The version is pinned at assignment time.
2. **Server-side published-only enforcement**: Backend validates skill status (published/archived) before association, not relying on frontend filtering alone.
3. **Backward-compatible agent sync**: The `scenario_id` parameter is optional, preserving all existing sync behavior.
4. **Skill picker with quality badge**: Published skills shown with quality score inline for informed selection.
5. **Archived skill warning**: When a skill becomes archived, existing scenarios keep the association but show a warning to admins.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed scenario-editor.test.tsx mock Scenario**
- **Found during:** Task 1 verification
- **Issue:** Test mock `Scenario` object was missing new `skill_id` and `skill_version_id` fields, causing TS2739 error
- **Fix:** Added `skill_id: null, skill_version_id: null` to mock and added `usePublishedSkills` mock
- **Files modified:** `frontend/src/components/admin/scenario-editor.test.tsx`
- **Commit:** 9915b5d

## Verification Results

```
alembic upgrade head: PASS (migration 960bc2f081dd applied)
ruff check (6 files): All checks passed
python3 -c "from app.main import app": App loads OK
python3 -c "SkillManager.compose_instructions(...)": SkillManager OK
python3 -c "from app.services.prompt_builder import build_skill_augmented_instructions": OK
npx tsc --noEmit (scenario/skill files): 0 errors
npm run build: PASS (built in 3.79s)
```

## Self-Check: PASSED
