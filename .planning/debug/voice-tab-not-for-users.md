---
status: awaiting_human_verify
trigger: "voice-tab-should-not-appear - On /user/training, 3 tabs showing including '语音' which should NOT appear for users"
created: 2026-05-08T00:00:00Z
updated: 2026-05-08T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED
test: TSC build, vitest (16/16 pass), vite production build
expecting: User confirms the voice tab no longer appears on /user/training
next_action: Awaiting human verification

## Symptoms

expected: Training page should only show relevant scenario mode tabs (面对面培训, 会议培训). The "语音" voice tab with mode selection (文字/语音/数字人) and engine selection (管道/实时/智能体) should NOT be visible to users.
actual: A third tab "语音" appears on /user/training with admin-like voice configuration UI (对话模式: 文字/语音/数字人, 引擎: 管道/实时/智能体)
errors: No JS errors - it's a UI/routing issue
reproduction: Navigate to /user/training as a user role, see 3 tabs instead of expected 2
started: Since the training page was built with scenario modes

## Eliminated

## Evidence

- timestamp: 2026-05-08T00:01:00Z
  checked: backend/app/models/scenario.py mode field
  found: Scenario mode is "f2f" or "conference" only - there is no "voice" scenario mode
  implication: The voice tab does not correspond to any scenario mode; it's a separate UI construct

- timestamp: 2026-05-08T00:02:00Z
  checked: frontend/src/pages/user/training.tsx lines 202-234
  found: Voice tab is shown when config.voice_live_enabled is true, displays ModeSelector with engine selection (pipeline/realtime/agent)
  implication: This is admin-level voice infrastructure config leaked to user page

- timestamp: 2026-05-08T00:03:00Z
  checked: backend/.env line 22
  found: FEATURE_VOICE_LIVE_ENABLED=true
  implication: Flag is enabled, causing voice tab to appear for all users

- timestamp: 2026-05-08T00:04:00Z
  checked: frontend/src/pages/admin/vl-instance-editor.tsx
  found: VoiceTestPlayground (admin voice testing) is correctly in admin pages only
  implication: Voice config UI belongs in admin, not user training page

- timestamp: 2026-05-08T00:05:00Z
  checked: ModeSelector usage across codebase
  found: Only used in user/training.tsx (not in any admin page)
  implication: ModeSelector was incorrectly placed in user page instead of being admin-only

## Resolution

root_cause: The user training page (training.tsx) conditionally renders a "语音" (Voice) tab when `config.voice_live_enabled` is true. This flag is a global infrastructure toggle (enabled in .env), not a user-facing feature flag. The tab exposes ModeSelector with engine selection (pipeline/realtime/agent) which is admin/debug-level configuration. Scenario modes are only "f2f" and "conference" -- there is no "voice" scenario mode. The voice tab and its ModeSelector were incorrectly placed in the user-facing page.
fix: Remove the voice tab, ModeSelector import, voice-related state, and handleStartVoiceSession from the user training page. Voice capabilities are a transport layer detail managed by admins via the VL Instance Editor.
verification: TypeScript compiles clean, all 16 tests pass, production build succeeds. Voice tab no longer rendered.
files_changed: [frontend/src/pages/user/training.tsx, frontend/src/pages/user/training.test.tsx]
