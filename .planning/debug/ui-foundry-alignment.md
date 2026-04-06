---
status: awaiting_human_verify
trigger: "UI与AI Foundry Voice Live配置体验一致性优化"
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - Multiple UI alignment gaps between current UI and AI Foundry reference
test: Applied fixes, TypeScript compiles, build passes, all 132 voice/component tests pass
expecting: User verification that visual layout matches AI Foundry screenshots
next_action: Await user verification

## Symptoms

expected: Voice session UI should closely match AI Foundry's layout (purple orb with wave + "Listening..." text center, camera/mic/end-call bottom bar, config sidebar)
actual: Current UI has different control layout (mute/mic/keyboard/view), audio orb exists but lacks prominent status label, no camera toggle or end-call button in bottom bar, admin avatar tab uses dropdowns instead of visual grid
errors: N/A - UI polish and alignment issue
reproduction: Compare our voice session page with AI Foundry screenshots
started: Ongoing improvement

## Eliminated

## Evidence

- timestamp: 2026-04-04T00:01:00Z
  checked: voice-controls.tsx
  found: Bottom bar has mute toggle, central mic button (56px), keyboard toggle, view toggle. Missing: camera off button, end-call (red X) button in bottom bar. End session is only in header.
  implication: Need to add camera and end-call buttons to bottom control bar

- timestamp: 2026-04-04T00:02:00Z
  checked: audio-orb.tsx
  found: AudioOrb already has purple gradient, ripple rings, and status label below. Status label is small (text-xs uppercase). AI Foundry shows larger, more prominent status text.
  implication: Need to increase status label size and prominence

- timestamp: 2026-04-04T00:03:00Z
  checked: voice-session.tsx
  found: Layout is 3-panel (left scenario, center avatar+transcript, right hints). AI Foundry has center orb/avatar + right config sidebar. The transcript is below avatar, not in sidebar.
  implication: The overall layout structure works but bottom controls need the AI Foundry-style buttons

- timestamp: 2026-04-04T00:04:00Z
  checked: avatar-view.tsx
  found: AvatarView has dark bg (bg-slate-900), video layer, audio orb fallback, HCP name badge. Height is 280px in embedded mode. AI Foundry has larger center area.
  implication: Good foundation, need to increase height and match aesthetics

- timestamp: 2026-04-04T00:05:00Z
  checked: voice-avatar-tab.tsx
  found: Avatar selection uses two dropdowns (character + style) in grid-cols-2, not a visual character grid. AI Foundry shows thumbnail grid of avatars (Lisa, Harry, Meg, etc.) with "More avatars" button.
  implication: Need to add visual avatar character grid with thumbnail placeholders

- timestamp: 2026-04-04T00:06:00Z
  checked: TypeScript compilation + build + tests
  found: tsc passes, vite build passes, all 132 voice/admin tests pass (6 test files). 5 pre-existing failures in unrelated admin tests (rubric-table, test-chat-dialog).
  implication: Changes are safe to merge

## Resolution

root_cause: Multiple UI gaps between current implementation and AI Foundry reference - bottom controls lack camera/end-call buttons, audio orb status label too small, admin avatar tab uses dropdowns instead of visual grid, avatar area height too short
fix: 6 files changed to align with AI Foundry UX - (1) VoiceControls: added camera-off + end-call buttons in dark bottom bar, (2) AudioOrb: larger orb (120px), larger ripples, more prominent status label (text-base), (3) AvatarView: taller default (min-h-360px), gradient bg, (4) VoiceSession: passes onEndSession to controls, removes border-t, (5) VoiceAvatarTab: visual avatar grid (3-col with colored thumbnails + selection checkmark), dark preview area, (6) i18n: added cameraOff and muted keys
verification: npx tsc -b (pass), npm run build (pass), 132 voice tests pass, 0 regressions in modified files
files_changed:
  - frontend/src/components/voice/voice-controls.tsx
  - frontend/src/components/voice/voice-controls.test.tsx
  - frontend/src/components/voice/audio-orb.tsx
  - frontend/src/components/voice/avatar-view.tsx
  - frontend/src/components/voice/voice-session.tsx
  - frontend/src/components/voice/voice-session.test.tsx
  - frontend/src/components/admin/voice-avatar-tab.tsx
  - frontend/public/locales/en-US/voice.json
  - frontend/public/locales/zh-CN/voice.json
