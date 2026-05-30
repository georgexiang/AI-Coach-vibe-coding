---
status: awaiting_human_verify
trigger: "A skill should be downloadable as a single zip archive named after the skill, containing all its files (SKILL.md, references/, scripts/, etc.)"
created: 2026-04-13T00:00:00Z
updated: 2026-04-13T00:00:00Z
---

## Current Focus

hypothesis: ROOT CAUSE CONFIRMED - For regular skills, export zip exists but frontend lacks a prominent "Download Package" button in the resources tab. For meta-skills, there is NO zip download endpoint at all — only individual file downloads. Both need zip download support in the UI.
test: Verified by reading all code paths
expecting: N/A - confirmed
next_action: Implement backend zip endpoint for meta-skills + add "Download Package" buttons in both frontend pages

## Symptoms

expected: There should be a "Download" button that packages ALL files of a skill (SKILL.md + references/ + scripts/ subdirectories) into a single zip archive named like `{skill-name}.zip` and downloads it
actual: Currently only individual file downloads are possible (one file at a time), there's no option to download the entire skill as a package
errors: No errors — this is a missing feature / incorrect implementation
reproduction: Go to Meta Skills > Skill Creator or Skill Editor > Skill Resources tab. There's a Download button but it only downloads individual files
started: Feature was never implemented as a zip download

## Eliminated

## Evidence

- timestamp: 2026-04-13T00:01:00Z
  checked: backend/app/api/skills.py - existing export endpoint
  found: GET /{skill_id}/export exists at line 604, uses skill_zip_service.export_skill_zip() to produce a zip with SKILL.md + resources. Returns Response with application/zip. Named skill-{id}.zip.
  implication: Regular skills already have backend zip export. Frontend just needs a "Download Package" button in resources tab.

- timestamp: 2026-04-13T00:02:00Z
  checked: backend/app/api/meta_skills.py - download endpoints
  found: Only individual file download exists: GET /{skill_type}/resources/{resource_type}/{filename}. No zip endpoint.
  implication: Meta-skills need a new backend endpoint to produce a zip of SKILL.md + references/ + scripts/.

- timestamp: 2026-04-13T00:03:00Z
  checked: frontend/src/pages/admin/meta-skills.tsx - download buttons
  found: ResourceContentPreview component (line 144-158) has Download button per individual file via downloadMetaSkillResource(). No "Download All/Package" button.
  implication: Need to add a "Download Package" button to the Resources tab for meta-skills.

- timestamp: 2026-04-13T00:04:00Z
  checked: frontend/src/pages/admin/skill-editor.tsx - download buttons
  found: Resources tab (line 568-638) shows individual file Download button per resource (line 619-628). No "Download Package" / export zip button in resources tab.
  implication: Need to add a "Download Package" button to the Resources tab for regular skills.

- timestamp: 2026-04-13T00:05:00Z
  checked: frontend/src/api/skills.ts - exportSkillZip function
  found: exportSkillZip(id) exists at line 262, calls GET /skills/{id}/export with responseType blob. But it only returns a Blob, doesn't trigger browser download.
  implication: Need a downloadSkillZip wrapper that triggers browser file download, or handle in the component.

- timestamp: 2026-04-13T00:06:00Z
  checked: backend/app/services/meta_skill_service.py - skill directory structure
  found: _SKILL_DIR_MAP maps "creator"->"skill-creator", "evaluator"->"skill-evaluator". Directories contain SKILL.md, SKILL_zh.md, references/, scripts/. list_meta_skill_resources() enumerates them.
  implication: Zip endpoint needs to read from these disk directories, packaging SKILL.md + references/ + scripts/ into a zip named {skill-type-dir-name}.zip.

## Resolution

root_cause: Two gaps - (1) Meta-skills have no backend zip export endpoint; (2) Neither meta-skills nor regular skills have a "Download Package" button in the frontend Resources tab UI.
fix: (1) Add export_meta_skill_zip() to meta_skill_service.py, (2) Add GET /{skill_type}/export endpoint to meta_skills.py router, (3) Add downloadMetaSkillZip() to frontend/src/api/meta-skills.ts, (4) Add downloadSkillZip() to frontend/src/api/skills.ts, (5) Add "Download Package" button to both meta-skills.tsx and skill-editor.tsx Resources tabs.
verification: Backend zip function tested directly (creator=12808 bytes/6 files, evaluator=11062 bytes/6 files, unknown type=None). Backend lint+format pass. TypeScript compiles clean. Frontend builds successfully. 89 relevant backend tests pass (meta_skill_api, meta_skill_resources, meta_skill_service, skill_zip_service, health). Awaiting human verification in browser.
files_changed:
  - backend/app/services/meta_skill_service.py
  - backend/app/api/meta_skills.py
  - frontend/src/api/meta-skills.ts
  - frontend/src/api/skills.ts
  - frontend/src/pages/admin/meta-skills.tsx
  - frontend/src/pages/admin/skill-editor.tsx
