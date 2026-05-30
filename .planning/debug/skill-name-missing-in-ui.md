---
status: awaiting_human_verify
trigger: "skill-name-missing-in-ui: No skill name input field in create/edit skill UI"
created: 2026-04-24T00:00:00Z
updated: 2026-04-24T00:02:00Z
---

## Current Focus

hypothesis: ROOT CAUSE CONFIRMED and FIX APPLIED
test: TypeScript build and Vite build both pass
expecting: User verifies skill name can be set during creation and edited inline
next_action: Await user verification

## Symptoms

expected: There should be a skill name input field when creating and editing skills, allowing users to set/change the skill name.
actual: No skill name input field exists in either the create or edit skill UI. Newly created skills show "New Skill" as the default name.
errors: No error messages. The skill is created successfully but with the default name "New Skill".
reproduction: Go to skill management, click create new skill - observe there is no skill name input field. Open an existing skill for editing - observe there is no skill name field to modify.
started: Always been the case since the skill feature was implemented - the skill name input was never added.

## Eliminated

## Evidence

- timestamp: 2026-04-24T00:00:30Z
  checked: skill-editor.tsx page header (lines 419-434)
  found: The header displays the skill name as static text (`skill?.name`), not as an editable input. For new skills it shows the i18n string "Create New Skill".
  implication: Users cannot edit the skill name from the main editor view.

- timestamp: 2026-04-24T00:00:35Z
  checked: skill-editor.tsx create flow handlers (lines 174-272)
  found: Three places hardcode `name: "New Skill"` - handleSaveDraft (line 177), handleMaterialUpload (line 225), handleCreateEmpty (line 264). The name is never derived from user input.
  implication: Every newly created skill gets the same default name "New Skill" with no way to change it during creation.

- timestamp: 2026-04-24T00:00:40Z
  checked: skill-editor.tsx Settings tab (lines 837-949)
  found: A name input field EXISTS in the Settings tab (lines 850-864), but the entire Settings tab is disabled for new skills (line 838-841 shows "Save the skill first" placeholder). So the name can only be changed AFTER creation, and only by navigating to the Settings tab.
  implication: The name field is buried in a secondary tab and inaccessible during creation. Most users won't discover it.

- timestamp: 2026-04-24T00:00:45Z
  checked: skill-hub.tsx create flows (lines 170-187)
  found: The `handleCreateFromMaterials` fallback also hardcodes `name: "New Skill"` (line 178).
  implication: All creation paths consistently lack a name input.

## Resolution

root_cause: The skill name field only exists in the Settings tab, which is disabled for new skills. All skill creation paths hardcode "New Skill" as the name. The page header shows the name as static text, not an editable field. Users have no way to set a name during creation and must discover the buried Settings tab to rename after creation.
fix: Replaced the static h1 header in skill-editor.tsx with an inline-editable Input field that is always visible. Added skillName/nameDirty state, handleNameChange (syncs to settings form), and handleNameBlur (auto-saves for existing skills). Updated all 3 create handlers (handleSaveDraft, handleMaterialUpload, handleCreateEmpty) to use the user-entered name instead of hardcoded "New Skill". Updated skill-hub.tsx fallback create to use i18n default. Added i18n keys for both en-US and zh-CN locales.
verification: TypeScript type-check passes (tsc -b --noEmit). Vite production build passes (npm run build). Awaiting human verification.
files_changed: [frontend/src/pages/admin/skill-editor.tsx, frontend/src/pages/admin/skill-hub.tsx, frontend/public/locales/en-US/skill.json, frontend/public/locales/zh-CN/skill.json]
