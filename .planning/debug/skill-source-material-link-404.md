---
status: awaiting_human_verify
trigger: "skill-source-material-link-404: Clicking source material link on skill edit page navigates to /admin/materials/{id} which returns 404"
created: 2026-04-26T00:00:00Z
updated: 2026-04-26T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — No /admin/materials/:id route exists; skill editor links to it
test: Verified router config, found only /admin/materials (list), no :id route
expecting: N/A — root cause confirmed
next_action: Await human verification of fix

## Symptoms

expected: Clicking the source material link on the skill edit page should open the material detail/preview page or download the original file
actual: Navigates to /admin/materials/6106924f-bce6-40d7-a918-44887eec8df9 which shows a 404 error page
errors: 404 page not found at /admin/materials/{id} route
reproduction: Go to skill edit page, in the "来源材料" section, click the file link
started: Unknown

## Eliminated

## Evidence

- timestamp: 2026-04-26T00:01:00Z
  checked: frontend/src/router/index.tsx — all admin routes
  found: Only `/admin/materials` route exists (line 96). No `/admin/materials/:id` route defined.
  implication: Any navigation to /admin/materials/{uuid} will hit the wildcard `*` route → NotFound page

- timestamp: 2026-04-26T00:02:00Z
  checked: frontend/src/pages/admin/skill-editor.tsx lines 559-569
  found: Source material links use `<Link to={/admin/materials/${mat.id}}>` which targets a non-existent route
  implication: This is the direct cause of the 404

- timestamp: 2026-04-26T00:03:00Z
  checked: backend/app/api/materials.py — API endpoints exist (GET /{material_id}, versions, download)
  found: Backend has full material CRUD but frontend has no material detail page component
  implication: No frontend page exists to display individual material details

## Resolution

root_cause: Skill editor source material links navigate to /admin/materials/{id} but no such route exists in the React Router config. The only materials route is the list page at /admin/materials. There is no material detail page component.
fix: Changed source material link target from /admin/materials/{id} to /admin/materials?search={name} so it navigates to the materials list page pre-filtered by material name. Also updated TrainingMaterialsPage to read the ?search= URL param and initialize the search query from it.
verification: TypeScript compilation and full frontend build pass cleanly with zero errors.
files_changed: [frontend/src/pages/admin/skill-editor.tsx, frontend/src/pages/admin/training-materials.tsx]
