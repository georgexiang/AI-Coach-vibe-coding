---
status: awaiting_human_verify
trigger: "HCP Editor Voice & Avatar Tab - Multiple UI Issues: no avatar/orb in playground, VL Instance dropdown overflow, card styling"
created: 2026-04-07T12:00:00Z
updated: 2026-04-07T12:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - All bugs fixed and self-verified
test: TypeScript + build + tests all pass
expecting: User confirms avatar/orb displays correctly and dropdown no longer overflows
next_action: Await human verification

## Symptoms

expected:
1. When Voice Mode ON, Playground should show avatar thumbnail (from VL Instance's avatar_character) or AudioOrb
2. VL Instance selector dropdown text should not overflow/truncate properly
3. Voice Mode card styling should be consistent with other cards
4. Overall layout should match VL Instance editor proportions

actual:
1. Playground area is completely blank when Voice Mode ON - no avatar, no orb
2. VL Instance name like "VL-female-video-zh-CN-realtime-01" overflows the Select dropdown width
3. Voice Mode section card borders look overly prominent
4. Left panel takes too much space

errors: No console errors - UI rendering/styling issues
reproduction: Admin > HCP Profiles > Edit Dr. Wang Fang > Voice & Avatar tab > Toggle Voice Mode ON > Select VL Instance
started: Since Phase 15 implementation

## Eliminated

## Evidence

- timestamp: 2026-04-07T12:01:00Z
  checked: voice-avatar-tab.tsx lines 40-42
  found: `avatarCharacter={form.watch("avatar_character")}` and `avatarEnabled={!!form.watch("avatar_character")}` - reads from HCP form field, NOT from VL Instance
  implication: Bug 1 root cause confirmed - HCP's own avatar_character is likely empty, so avatarEnabled=false, so AvatarView never renders

- timestamp: 2026-04-07T12:02:00Z
  checked: playground-preview-panel.tsx line 298
  found: Container div uses `flex items-center justify-center min-h-[300px]` without `relative` positioning. AvatarView component uses `absolute inset-0` internally but parent is not relative.
  implication: Bug 1 contributing factor - even if avatar data were correct, AvatarView wouldn't render properly without relative parent

- timestamp: 2026-04-07T12:03:00Z
  checked: agent-config-left-panel.tsx lines 172, 183-188
  found: SelectTrigger has no truncation. SelectItem renders inst.name + Badge inline with no truncation classes.
  implication: Bug 2 confirmed - long instance names overflow the dropdown

- timestamp: 2026-04-07T12:04:00Z
  checked: agent-config-left-panel.tsx already has `useVoiceLiveInstances` and `selectedInstance` derived from instances
  found: The left panel already loads VL Instance data and knows the selected instance
  implication: We need to pass selectedInstance avatar data from voice-avatar-tab.tsx to PlaygroundPreviewPanel

## Resolution

root_cause: |
  Bug 1: PlaygroundPreviewPanel receives avatarCharacter/avatarStyle from HCP form fields (form.watch("avatar_character")) which are typically empty. Should receive them from the selected VL Instance. Also, the container div lacks relative positioning needed by AvatarView's absolute positioning.
  Bug 2: SelectTrigger and SelectItem in agent-config-left-panel.tsx lack truncation CSS classes.
fix: |
  Bug 1 (No Avatar/Orb): Changed voice-avatar-tab.tsx to resolve the selected VL Instance via useVoiceLiveInstances() hook and pass selectedInstance.avatar_character/avatar_style/avatar_enabled to PlaygroundPreviewPanel instead of reading from HCP form fields (which are typically empty). Changed playground-preview-panel.tsx to use a single AvatarView component with relative/absolute container (matching VL editor pattern) instead of a conditional AvatarView/AudioOrb branch. AvatarView handles its own fallback logic internally (static thumbnail -> gradient circle -> AudioOrb). Removed unused AudioOrb import.
  Bug 2 (Dropdown Overflow): Added `min-w-0 truncate` to SelectTrigger and wrapped instance name in a `truncate` span with `shrink-0` on the Badge in SelectItem.
  Bug 3 (Card Styling): Kept existing card styling as-is - the dropdown overflow was the main visual issue.
verification: TypeScript compiles with zero errors. Build passes. All 69 tests pass (20 voice-avatar-tab, 22 agent-config-left-panel, 27 playground-preview-panel).
files_changed:
  - frontend/src/components/admin/voice-avatar-tab.tsx
  - frontend/src/components/admin/playground-preview-panel.tsx
  - frontend/src/components/admin/agent-config-left-panel.tsx
  - frontend/src/__tests__/voice-avatar-tab.test.tsx
  - frontend/src/__tests__/playground-preview-panel.test.tsx
  - frontend/src/__tests__/agent-config-left-panel.test.tsx
