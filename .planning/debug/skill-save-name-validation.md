---
status: awaiting_human_verify
trigger: "User enters skill name in top input of Skill Editor, clicks save, validation error 'Name is required, at least 2 characters' still shows"
created: 2026-04-25T00:00:00Z
updated: 2026-04-25T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two independent name inputs (header + settings form) with fragile one-way sync via settingsForm.setValue causes validation desync.
test: Code analysis complete
expecting: Fix by removing redundant name from settings form and using skillName state as single source of truth
next_action: Awaiting human verification that the fix resolves the issue

## Symptoms

expected: Skill saves successfully with name "zanubrutinib-training-skill"
actual: Validation error "名称为必填项，至少2个字符" displayed despite name being filled in header input
errors: "名称为必填项，至少2个字符" validation message
reproduction: Open Skill Editor -> type name in top input -> click Save -> error appears
started: Since commit 129a1bd "fix: add editable skill name input to skill editor header"

## Eliminated

- hypothesis: Backend returns validation error for name
  evidence: Backend SkillCreate schema has `name: str` with no min length. Error message only exists in frontend i18n files and is rendered only in Settings tab form (line 906).
  timestamp: 2026-04-25T00:00:10Z

- hypothesis: Header Save Draft button triggers settings form validation
  evidence: Header Save Draft button (line 482-501) is outside the <form> tag (line 890-993). It calls handleSaveDraft which bypasses form validation entirely, sending API request directly.
  timestamp: 2026-04-25T00:00:20Z

## Evidence

- timestamp: 2026-04-25T00:00:05Z
  checked: Where validation error message appears in code
  found: "settingsNameRequired" error only renders at line 906 inside Settings tab form, triggered by settingsForm.formState.errors.name
  implication: User must be on Settings tab and clicking Settings Save button to see this error

- timestamp: 2026-04-25T00:00:10Z
  checked: How header name input syncs to settings form
  found: handleNameChange (line 212-217) calls settingsForm.setValue("name", newName) - one-way sync from header to settings form, no shouldValidate option
  implication: Settings form value is updated but stale validation errors are not cleared

- timestamp: 2026-04-25T00:00:15Z
  checked: Radix UI TabsContent mount behavior
  found: TabsContent does NOT use forceMount - inactive tab content is unmounted from DOM. Settings form inputs are destroyed when switching away from Settings tab.
  implication: When Settings tab remounts, register() re-runs. The interplay between register, setValue, and tab mount/unmount creates unreliable state sync.

- timestamp: 2026-04-25T00:00:20Z
  checked: Settings form has its own name input at line 899-901 using register("name")
  found: Two separate name inputs exist - header (controlled via skillName state) and settings form (uncontrolled via register). handleNameChange syncs header->settings but NOT settings->header.
  implication: Redundant name inputs with fragile one-way sync is the architectural root cause

- timestamp: 2026-04-25T00:00:25Z
  checked: react-hook-form setValue internals (v7.72.0)
  found: setValue updates _formValues (line 1837) and calls setFieldValue which updates DOM ref (line 1803). _runSchema validates against _formValues. In theory this should work, but Radix tab mount/unmount and React render timing can cause desync.
  implication: The sync mechanism is theoretically correct but practically fragile due to component lifecycle interactions

## Resolution

root_cause: Commit 129a1bd added an editable name input to the skill editor header but left the original name field in the Settings tab form. The two inputs sync via settingsForm.setValue("name", newName) which is fragile - Radix UI tab mount/unmount cycles, React render timing, and the lack of shouldValidate on setValue calls mean the settings form's internal name state can become stale. When the user types a name in the header input then clicks the Settings tab Save button, the form validation may run against an empty/stale name value, producing the "名称为必填项" error.
fix: Remove redundant name field from settings form schema and UI. The header input is the single source of truth for the name. handleSettingsSave injects the current skillName into the API payload. This eliminates the dual-input sync problem entirely.
verification: TypeScript check passes, build succeeds, no remaining references to settingsForm name field. Awaiting human verification in browser.
files_changed: [frontend/src/pages/admin/skill-editor.tsx]
