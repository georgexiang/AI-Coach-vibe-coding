---
phase: 22-scenarios
verified: 2026-05-06T10:30:00Z
status: gaps_found
score: 2/6 must-haves verified
overrides_applied: 0
gaps:
  - truth: "State machine enforces draft -> active -> archived transitions via dedicated endpoint"
    status: failed
    reason: "Backend has no VALID_TRANSITIONS dict, no transition_status function, no POST /transition endpoint. ScenarioUpdate schema still includes status field. No archived enforcement."
    artifacts:
      - path: "backend/app/services/scenario_service.py"
        issue: "No VALID_TRANSITIONS dict, no transition_status() function, no archived guard on update_scenario()"
      - path: "backend/app/api/scenarios.py"
        issue: "No /transition endpoint. ScenarioOut still has old fields."
      - path: "backend/app/schemas/scenario.py"
        issue: "ScenarioUpdate still includes 'status' field — not removed"
      - path: "frontend/src/types/scenario.ts"
        issue: "Status type is still 'draft' | 'active' — no 'archived' value"
      - path: "frontend/src/hooks/use-scenarios.ts"
        issue: "No useTransitionScenarioStatus hook"
      - path: "frontend/src/pages/admin/scenarios.tsx"
        issue: "Status filter dropdown has no 'Archived' option"
      - path: "frontend/src/components/admin/scenario-table.tsx"
        issue: "No archive/activate actions, no archived row styling"
    missing:
      - "VALID_TRANSITIONS dict in scenario_service.py"
      - "transition_status() service function"
      - "POST /scenarios/{id}/transition API endpoint"
      - "Archived guard on update_scenario()"
      - "Remove status from ScenarioUpdate schema"
      - "'archived' value in frontend status type"
      - "useTransitionScenarioStatus hook"
      - "Archived filter in list page dropdown"
      - "Archive/Activate actions in table dropdown"
      - "Archived row styling (opacity-60, outline badge)"
  - truth: "System enums table replaces all hardcoded frontend constants with DB-driven values"
    status: failed
    reason: "The entire system_enums module was reverted. No model, service, API, frontend hooks, or admin page exist."
    artifacts:
      - path: "backend/app/models/system_enum.py"
        issue: "MISSING - file does not exist"
      - path: "backend/app/services/system_enum_service.py"
        issue: "MISSING - file does not exist"
      - path: "backend/app/api/system_enums.py"
        issue: "MISSING - file does not exist"
      - path: "frontend/src/hooks/use-system-enums.ts"
        issue: "MISSING - file does not exist"
      - path: "frontend/src/pages/admin/system-enums.tsx"
        issue: "MISSING - file does not exist"
    missing:
      - "SystemEnum model (backend/app/models/system_enum.py)"
      - "SystemEnum schemas (backend/app/schemas/system_enum.py)"
      - "SystemEnum service (backend/app/services/system_enum_service.py)"
      - "SystemEnum API router (backend/app/api/system_enums.py)"
      - "Alembic migration for system_enums table"
      - "Frontend types, API client, hooks (use-system-enums.ts)"
      - "Admin management page (system-enums.tsx)"
      - "Route registration and sidebar link"
      - "Replace hardcoded PRODUCTS/SPECIALTIES/DIFFICULTIES arrays with API calls"
  - truth: "Scenario model uses tags JSON array instead of product/therapeutic_area columns"
    status: failed
    reason: "Backend Scenario model still has product and therapeutic_area columns. tags field not present. Migration file exists but model not updated."
    artifacts:
      - path: "backend/app/models/scenario.py"
        issue: "Still has 'product' and 'therapeutic_area' mapped columns. No 'tags' column."
      - path: "backend/app/schemas/scenario.py"
        issue: "ScenarioCreate still has 'product: str' and 'therapeutic_area: str'. No 'tags' field."
      - path: "backend/app/api/scenarios.py"
        issue: "ScenarioOut still has 'product: str' and 'therapeutic_area: str'. No tags field_validator."
      - path: "backend/app/services/scenario_service.py"
        issue: "clone_scenario still copies product and therapeutic_area. No tags serialization."
      - path: "frontend/src/types/scenario.ts"
        issue: "Still has 'product: string' and 'therapeutic_area: string'. No 'tags: string[]'."
      - path: "frontend/src/components/admin/scenario-table.tsx"
        issue: "Still shows Product column, not Tags column"
      - path: "backend/alembic/versions/s22b_scenario_tags_migration.py"
        issue: "Migration FILE exists but model code contradicts it — migration would break if run"
    missing:
      - "Update Scenario model: remove product/therapeutic_area, add tags column"
      - "Update ScenarioCreate/ScenarioUpdate schemas to use tags"
      - "Update ScenarioOut with tags field_validator"
      - "Update service (create, update, clone, get) for tags"
      - "Update frontend types to use tags"
      - "Update scenario-table to show Tags column with badges"
      - "Update API client for tag filtering"
  - truth: "skill_id is NOT NULL on Scenario model with RESTRICT on delete"
    status: failed
    reason: "Backend model still has skill_id as Mapped[str | None] with nullable=True and ondelete=SET NULL. Migration file exists but model code contradicts it."
    artifacts:
      - path: "backend/app/models/scenario.py"
        issue: "skill_id is still Mapped[str | None], nullable=True, ondelete='SET NULL'"
      - path: "backend/app/schemas/scenario.py"
        issue: "ScenarioCreate still has 'skill_id: str | None = None'"
      - path: "frontend/src/types/scenario.ts"
        issue: "skill_id is still 'string | null'"
      - path: "backend/alembic/versions/s22c_skill_id_not_null.py"
        issue: "Migration FILE exists but model contradicts it"
    missing:
      - "Update model: skill_id Mapped[str], nullable=False, ondelete=RESTRICT"
      - "Update ScenarioCreate: skill_id as required str"
      - "Update frontend types: skill_id as string (not nullable)"
human_verification:
  - test: "Navigate to /admin/scenarios/new in browser and verify the full-page editor renders with 3 tabs"
    expected: "Editor page loads with Basic Info, Linked Config, and Scoring Rules tabs"
    why_human: "Router and lazy loading behavior cannot be verified without running the app"
  - test: "Switch language to zh-CN and verify non-scenario admin pages display Chinese text"
    expected: "All page titles, labels, buttons show Chinese translations"
    why_human: "i18n runtime behavior requires browser execution"
---

# Phase 22: Scenarios Module Refactor Verification Report

**Phase Goal:** Scenarios module second refactor -- Editor full-page, I18N complete, metadata to tags system, state machine enhancement, skill association enforcement, global hardcoded elimination
**Verified:** 2026-05-06T10:30:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | State machine enforces draft -> active -> archived transitions via dedicated endpoint | FAILED | Backend has no VALID_TRANSITIONS, no transition endpoint, no archived enforcement. Frontend types lack "archived" status. |
| 2 | System enums table replaces all hardcoded frontend constants with DB-driven values | FAILED | Entire system_enums module missing (model, service, API, frontend hooks, admin page) |
| 3 | Scenario model uses tags JSON array instead of product/therapeutic_area columns | FAILED | Backend model still has product/therapeutic_area. Tags field absent from model, schemas, and frontend types. Migration file exists but code was reverted. |
| 4 | skill_id is NOT NULL on Scenario model with RESTRICT on delete | FAILED | Model still has nullable skill_id with SET NULL. Migration file exists but code contradicts it. |
| 5 | Full-page route-based scenario editor replaces Dialog editor | PARTIAL | Full-page editor exists at pages/admin/scenario-editor.tsx with correct routes registered. BUT old Dialog editor still exists at components/admin/scenario-editor.tsx and scenarios.tsx still imports and uses it. |
| 6 | I18N audit eliminates all hardcoded text from frontend | PARTIAL | Plan 06 succeeded for non-scenario pages (reports, rubrics, settings, users, hcp-editor). BUT scenario module files (table, list page) retain hardcoded text. New editor uses defaultValue fallbacks because locale keys were never added. |

**Score:** 2/6 truths verified (partial credit for truths 5 and 6 which are partially achieved)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/scenario.py` | tags column, skill_id NOT NULL, no product/therapeutic_area | STUB | Still has old schema (product, therapeutic_area, nullable skill_id) |
| `backend/app/services/scenario_service.py` | VALID_TRANSITIONS, transition_status(), tags serialization | STUB | No state machine logic, still references product/therapeutic_area in clone |
| `backend/app/api/scenarios.py` | /transition endpoint, tags in ScenarioOut | STUB | Old ScenarioOut with product field, no transition endpoint |
| `backend/app/schemas/scenario.py` | tags field, required skill_id, no status in Update | STUB | Old schema with product, nullable skill_id, status in Update |
| `backend/app/models/system_enum.py` | SystemEnum ORM model | MISSING | File does not exist |
| `backend/app/services/system_enum_service.py` | CRUD service | MISSING | File does not exist |
| `backend/app/api/system_enums.py` | API router | MISSING | File does not exist |
| `backend/alembic/versions/s22b_scenario_tags_migration.py` | Tags data migration | VERIFIED | File exists with correct upgrade/downgrade logic |
| `backend/alembic/versions/s22c_skill_id_not_null.py` | Skill NOT NULL migration | VERIFIED | File exists with pre-check and alter column |
| `frontend/src/pages/admin/scenario-editor.tsx` | Full-page editor with tabs | VERIFIED | 672-line component with tabs, form, tag picker, skill selector |
| `frontend/src/router/index.tsx` | scenarios/new and scenarios/:id routes | VERIFIED | Both routes registered with lazy import |
| `frontend/src/types/scenario.ts` | tags: string[], skill_id: string, status includes archived | STUB | Still has old types (product, therapeutic_area, nullable skill_id, no archived) |
| `frontend/src/components/admin/scenario-table.tsx` | Tags column, archived styling, navigate on edit | STUB | Still shows Product column, hardcoded text, no archived handling |
| `frontend/src/pages/admin/scenarios.tsx` | Navigate to routes, no Dialog usage | STUB | Still uses Dialog-based ScenarioEditor import |
| `frontend/src/components/admin/scenario-editor.tsx` | DELETED (old Dialog editor) | EXISTS (should not) | Old Dialog editor still present |
| `frontend/src/hooks/use-scenarios.ts` | useTransitionScenarioStatus hook | STUB | Hook not present |
| `frontend/src/pages/admin/system-enums.tsx` | Admin enum management page | MISSING | File does not exist |
| `frontend/src/hooks/use-system-enums.ts` | useSystemEnums hook | MISSING | File does not exist |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| scenario-editor.tsx (page) | router | lazy import + route registration | WIRED | Routes at scenarios/new and scenarios/:id registered |
| scenario-editor.tsx (page) | useScenario hook | import + useScenario(id) | WIRED | Hook call present and functional |
| scenarios.tsx (list page) | scenario-editor.tsx (page) | navigate("/admin/scenarios/new") | NOT_WIRED | List page still uses Dialog pattern, does not navigate |
| scenario-table.tsx | scenario-editor.tsx (page) | useNavigate to /:id | NOT_WIRED | Table still uses onEdit callback, no useNavigate |
| scenarios.tsx | transition API | useTransitionScenarioStatus | NOT_WIRED | Hook does not exist |
| scenario model | tags column | ORM mapped_column | NOT_WIRED | Model lacks tags field |
| scenario model | skill_id NOT NULL | ORM mapped_column nullable=False | NOT_WIRED | Model still nullable=True |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| scenario-editor.tsx (page) | scenario | useScenario(id) -> API | Yes (existing API works) | FLOWING (for existing fields) |
| scenario-editor.tsx (page) | tags | form.watch("tags") | Hardcoded PREDEFINED_TAGS constant | STATIC -- no system_enums API |
| scenario-table.tsx | scenarios | useScenarios -> API | Yes (existing product field) | FLOWING (but for wrong schema) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend has transition endpoint | grep "transition" backend/app/api/scenarios.py | Not found | FAIL |
| System enums model exists | ls backend/app/models/system_enum.py | Not found | FAIL |
| Scenario model has tags field | grep "tags" backend/app/models/scenario.py | Not found | FAIL |
| Full-page editor file exists | ls frontend/src/pages/admin/scenario-editor.tsx | Found (672 lines) | PASS |
| Routes registered | grep "scenarios/:id" frontend/src/router/index.tsx | Found | PASS |
| Old editor deleted | ls frontend/src/components/admin/scenario-editor.tsx | Still exists | FAIL |

### Requirements Coverage

No formal requirements mapped to phase 22 in REQUIREMENTS.md (phase was added ad-hoc).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| frontend/src/pages/admin/scenario-editor.tsx | 46-49 | PREDEFINED_TAGS hardcoded constant | Warning | Tags come from constants, not system_enums API |
| frontend/src/pages/admin/scenario-editor.tsx | 315-328 | Hardcoded mode/difficulty radio arrays | Warning | Not driven by system_enums |
| frontend/src/pages/admin/scenario-editor.tsx | 27 occurrences | defaultValue in t() calls | Warning | Locale keys not in JSON files |
| frontend/src/pages/admin/scenarios.tsx | 22 | Import of deleted component (ScenarioEditor from Dialog) | Blocker | List page uses old Dialog flow |
| frontend/src/components/admin/scenario-table.tsx | 88-121 | Hardcoded English text in column headers | Warning | I18N incomplete |
| frontend/src/components/admin/scenario-table.tsx | 192-203 | Hardcoded "Edit"/"Clone"/"Delete" text | Warning | I18N incomplete |
| backend/app/models/scenario.py | 17-18 | product/therapeutic_area columns (should be removed) | Blocker | Schema contradicts planned migration |
| backend/app/models/scenario.py | 27-29 | skill_id nullable=True (should be NOT NULL) | Blocker | Schema contradicts planned migration |
| backend/alembic/versions/s22b_scenario_tags_migration.py | 20 | down_revision: "ed6e59a95958" | Warning | May conflict with migration chain |
| backend/alembic/versions/s22c_skill_id_not_null.py | 16 | down_revision: "q20a_add_dry_run_tables" | Warning | Both migrations have different down_revisions -- chain conflict |

### Human Verification Required

1. **Full-page editor renders correctly**
   - **Test:** Navigate to /admin/scenarios/new in browser
   - **Expected:** Editor page loads with 3 tabs (Basic Info, Linked Config, Scoring Rules), back button, save button
   - **Why human:** Requires running dev server to verify React rendering and routing

2. **Language switching works for cleaned pages**
   - **Test:** Switch language to zh-CN on admin reports, rubrics, settings pages
   - **Expected:** All text displays in Chinese with no raw i18n keys visible
   - **Why human:** i18n runtime behavior requires browser execution and visual inspection

### Gaps Summary

**Root Cause:** The phase execution used worktree agents that had conflicts. Plans 01-05 made changes but subsequent plans (or manual operations) reverted critical files. The final restore commit (`68e315d`) recovered only the full-page editor component, routes, migrations, and planning files -- but did NOT restore changes to:

- Backend model/schema/service/API (still in pre-phase-22 state)
- Frontend types (still in pre-phase-22 state)
- Frontend scenario-table and scenarios list page (still uses old patterns)
- Old Dialog editor (should be deleted but still exists)
- System enums module (entire module missing)

**What survived:**
1. Full-page scenario editor component (pages/admin/scenario-editor.tsx) -- GOOD
2. Router registration for /admin/scenarios/new and /admin/scenarios/:id -- GOOD
3. Migration files (s22b tags, s22c skill NOT NULL) -- GOOD but disconnected from model
4. Plan 06 i18n cleanup on non-scenario pages (reports, rubrics, settings, users, hcp-editor, login, dashboard) -- GOOD

**What was lost (must be re-implemented):**
1. Backend state machine (D-04): VALID_TRANSITIONS, transition endpoint, archived guard
2. Backend tags migration code in model/schema/service (D-03)
3. Backend skill_id NOT NULL in model/schema (D-05)
4. System enums entire module (D-06)
5. Frontend type updates (tags, archived, required skill_id)
6. Scenario table updates (tags column, archived styling, navigate on edit)
7. Scenarios list page wiring (use routes instead of Dialog)
8. Delete old Dialog editor
9. I18n keys for scenario module in locale JSON files

**Migration chain issue:** The two surviving migrations (s22b, s22c) have different `down_revision` values and may conflict with the current Alembic HEAD. They need to be verified against the current migration chain before running.

---

_Verified: 2026-05-06T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
