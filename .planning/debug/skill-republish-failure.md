---
status: awaiting_human_verify
trigger: "技能已经发布过了，再点击发布的时候，出现'保存技能失败'错误"
created: 2026-04-27T00:00:00Z
updated: 2026-04-27T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED - Backend state machine disallows published->review transition, frontend usePublishSkill blindly forces that transition
test: TypeScript compiles clean, frontend builds clean, all 60 backend skill service tests pass
expecting: User confirms re-publishing a published skill works end-to-end in browser
next_action: Await human verification

## Symptoms

expected: 已发布的技能可以再次成功发布（更新发布）
actual: 点击发布时前端弹窗提示"保存技能失败"
errors: 前端弹窗提示"保存技能失败"
reproduction: 任何已发布的技能，点击发布按钮即可复现
started: 所有已发布技能都会出现此问题

## Eliminated

## Evidence

- timestamp: 2026-04-27T00:00:30Z
  checked: frontend/src/hooks/use-skills.ts line 158-171 - usePublishSkill hook
  found: The hook always does TWO steps: (1) updateSkill(id, {status:"review"}) then (2) publishSkill(id). This forces a draft->review transition regardless of current status.
  implication: When skill is already "published", step 1 attempts published->review which the backend rejects.

- timestamp: 2026-04-27T00:00:40Z
  checked: backend/app/models/skill.py VALID_TRANSITIONS dict
  found: "published": {"archived"} — only valid transition from published is to archived
  implication: The backend correctly rejects published->review as it's not in the transition matrix.

- timestamp: 2026-04-27T00:00:50Z
  checked: backend/app/services/skill_service.py validate_status_transition function
  found: Returns bad_request error when target not in allowed set for current status
  implication: Backend returns 400 error which frontend catches and shows "保存技能失败" toast.

## Resolution

root_cause: Two-part issue - (1) Backend VALID_TRANSITIONS does not allow published->review transition needed for re-publishing. (2) Frontend usePublishSkill hook blindly forces draft->review transition without checking current skill status, so even if backend allowed the transition, the hook sends unnecessary/wrong requests.
fix: (1) Add "review" to allowed transitions from "published" in backend. (2) Make frontend hook status-aware - only transition to "review" if not already in review, and pass current status so it can handle published skills correctly.
verification: TypeScript compiles clean, frontend builds clean, all 60 backend skill service tests pass. Awaiting human verification in browser.
files_changed: [backend/app/models/skill.py, frontend/src/hooks/use-skills.ts, frontend/src/pages/admin/skill-editor.tsx]
