---
status: diagnosed
trigger: "User reports: (1) All Skills stuck in draft status, publish workflow may not be functional. (2) Create skill from existing materials workflow unclear if implemented."
created: 2026-04-11T00:00:00Z
updated: 2026-04-11T00:00:00Z
---

## Current Focus

hypothesis: Two confirmed root causes — (1) missing draft->review status transition in UI, (2) no Material-to-Skill bridge exists at all, plus 3 URL mismatches in frontend API client
test: traced full publish pipeline and material conversion pipeline through all layers
expecting: confirmed
next_action: return diagnosis

## Symptoms

expected: |
  1. Admin should be able to transition Skills through full lifecycle: draft -> review -> published -> archived
  2. Admin should be able to select existing uploaded materials and create a Skill from them
actual: |
  1. All Skills show "draft" status — publish flow may not complete
  2. "Create from Materials" button creates blank skill, may not connect to existing materials
errors: No specific error messages — workflow/feature gap investigation
reproduction: |
  1. Go to /admin/skills — all skills show "draft"
  2. Go to /admin/materials — 2 materials exist, try to create Skill from them
started: Phase 19 just completed implementing Skill module (Plans 01-08)

## Eliminated

- hypothesis: Backend publish endpoint is missing or broken
  evidence: Backend has POST /{skill_id}/publish, POST /{skill_id}/archive, POST /{skill_id}/restore all correctly implemented in skills.py. State transition matrix is correct in model.
  timestamp: 2026-04-11

- hypothesis: Frontend publish button doesn't call the API
  evidence: skill-editor.tsx has handlePublish which calls publishMutation.mutate(id), which calls publishSkill API. PublishGateDialog correctly gates on L1+L2 checks. The API call chain is correct.
  timestamp: 2026-04-11

## Evidence

- timestamp: 2026-04-11
  checked: VALID_TRANSITIONS in backend/app/models/skill.py
  found: "draft" can only transition to {"review"}, and "review" can transition to {"draft", "published"}. Publishing requires status="review" first.
  implication: A skill MUST be in "review" status before it can be published. There is no way to go directly from "draft" to "published".

- timestamp: 2026-04-11
  checked: Backend publish_skill() in skill_service.py line 258
  found: validate_status_transition(skill.status, "published") — this enforces the review->published transition. If skill is in "draft", this will raise "Invalid status transition from 'draft' to 'published'".
  implication: Backend correctly enforces the state machine, but the frontend never transitions skills to "review" status.

- timestamp: 2026-04-11
  checked: Frontend handleRequestReview in skill-editor.tsx lines 308-318
  found: handleRequestReview only calls checkStructureMutation and evaluateQualityMutation — it runs L1+L2 quality checks but NEVER changes the skill status to "review". No call to updateSkill({status: "review"}).
  implication: ROOT CAUSE #1 — after clicking "Request Review", the quality gates run but the skill stays in "draft". When user clicks Publish, the backend rejects it because draft->published is not a valid transition.

- timestamp: 2026-04-11
  checked: PublishGateDialog in publish-gate-dialog.tsx
  found: The dialog checks L1 pass, L2 score >= 50, staleness, then calls onPublish which calls publishSkill API. It does NOT first transition to "review" status.
  implication: The PublishGateDialog assumes the skill is already in "review" status, but nothing in the UI ever sets it to "review".

- timestamp: 2026-04-11
  checked: Frontend API URLs vs backend routes for conversion endpoints
  found: |
    MISMATCH 1: Frontend calls `/skills/${id}/convert/retry` but backend route is `/{skill_id}/retry-conversion`
    MISMATCH 2: Frontend calls `/skills/${id}/convert/status` but backend route is `/{skill_id}/conversion-status`  
    MISMATCH 3: Frontend calls `/skills/${id}/convert/upload` but backend route is `/{skill_id}/upload-and-convert`
  implication: These 3 URL mismatches mean retry-conversion, conversion polling, and upload-and-convert all silently fail with 404/405 errors. The conversion flow will start but retry, status polling, and the combined upload+convert will not work.

- timestamp: 2026-04-11
  checked: Material model (material.py) vs Skill model (skill.py)
  found: TrainingMaterial and SkillResource are completely separate models with no FK relationship. TrainingMaterial stores files via MaterialVersion.storage_url. SkillResource stores files via SkillResource.storage_path. There is no bridge table or FK linking them.
  implication: ROOT CAUSE #2 — There is NO mechanism to convert existing TrainingMaterial records into SkillResource records. The "Create from Materials" button in skill-hub.tsx just creates a blank skill and navigates to the editor. It does not select or import existing materials.

- timestamp: 2026-04-11
  checked: Training materials page (training-materials.tsx)
  found: The materials page has no "Create Skill from this material" action. It only has upload, edit metadata, archive/restore, and view versions.
  implication: There is no UI path from materials to skills at all. Materials and Skills are completely disconnected systems.

- timestamp: 2026-04-11
  checked: skill_conversion_service.py start_conversion()
  found: The conversion service reads from SkillResource records (resource_type="reference") attached to a skill. It does NOT read from TrainingMaterial/MaterialVersion. So conversion works only if files are uploaded directly as SkillResources, not from existing Materials.
  implication: The conversion pipeline is functional IF files are uploaded directly to the skill via upload-and-convert or the resource upload endpoints. But there's no way to "adopt" existing materials from the Materials section.

## Resolution

root_cause: |
  **Issue 1 (Skills stuck in draft):** Two sub-causes:
  (A) The frontend handleRequestReview function runs L1/L2 quality checks but NEVER transitions the skill status from "draft" to "review". The backend state machine requires draft->review->published, but no UI action ever sets status="review". So even after quality checks pass, clicking Publish fails because the backend rejects draft->published transition.
  (B) The PublishGateDialog also does not transition to "review" before calling publish. It assumes the skill is already in review status.
  
  **Issue 2 (Materials-to-Skill conversion):** The "Create from Materials" button in SkillHub creates a blank new skill and navigates to the editor — it does NOT allow selecting existing TrainingMaterial records. Furthermore, TrainingMaterial and SkillResource are completely separate ORM models with no FK or bridge table. There is no backend API or service method to copy/link a TrainingMaterial into a SkillResource. The admin must re-upload files directly to the Skill.
  
  **Bonus: 3 Frontend API URL Mismatches:**
  - retry-conversion: frontend `/convert/retry` vs backend `/retry-conversion`
  - conversion-status: frontend `/convert/status` vs backend `/conversion-status`
  - upload-and-convert: frontend `/convert/upload` vs backend `/upload-and-convert`
  These cause silent 404 failures for conversion retry, status polling, and combined upload+convert.

fix:
verification:
files_changed: []
