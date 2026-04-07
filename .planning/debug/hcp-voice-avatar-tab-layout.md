---
status: resolved
trigger: "HCP editor Voice & Avatar tab has 3 UI problems: (1) 50/50 split ratio wrong, (2) no text chat when voice OFF, (3) no avatar/orb when voice ON"
created: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Three root causes identified, all in voice-avatar-tab.tsx and playground-preview-panel.tsx
test: Implementing fixes for all three issues
expecting: (1) 5/7 grid ratio, (2) inline text chat panel when voice off, (3) avatar/orb always visible in voice mode
next_action: Apply fixes to voice-avatar-tab.tsx, playground-preview-panel.tsx, agent-config-left-panel.tsx, and i18n files

## Symptoms

expected:
1. Voice & Avatar tab layout should use ~40/60 split (left config / right playground) matching VL Instance edit dialog
2. When Voice Mode OFF, Playground shows text chat interface with "Message the agent..." input
3. When Voice Mode ON, Playground shows avatar thumbnail or audio orb visualization

actual:
1. Uses grid-cols-2 (equal 50/50 split)
2. When Voice Mode OFF, Playground shows empty gray area
3. When Voice Mode ON, Playground shows Start/Stop/Mute buttons but no avatar image or audio orb

errors: No console errors - UI design/implementation gap
reproduction: Admin > HCP Profiles > Edit any HCP > Voice & Avatar tab
started: Since Phase 15 implementation

## Eliminated

## Evidence

- timestamp: 2026-04-07T00:01:00Z
  checked: voice-avatar-tab.tsx line 15
  found: `grid grid-cols-1 lg:grid-cols-2 gap-6` - equal 50/50 split confirmed
  implication: Issue 1 confirmed - needs change to ~40/60 ratio

- timestamp: 2026-04-07T00:02:00Z
  checked: playground-preview-panel.tsx lines 192-302
  found: Component only has voice session mode - no text chat UI, no voiceModeEnabled prop
  implication: Issue 2 confirmed - no text chat fallback when voice mode is off

- timestamp: 2026-04-07T00:03:00Z
  checked: playground-preview-panel.tsx lines 201-216
  found: Avatar/Orb area only shows during voice session; AudioOrb renders but with idle audioState shows just a static orb with no context
  implication: Issue 3 partially confirmed - orb exists but no avatar thumbnail preview shown, and Start button disabled without vlInstanceId

- timestamp: 2026-04-07T00:04:00Z
  checked: voice-avatar-tab.tsx props
  found: voiceModeEnabled state lives in agent-config-left-panel.tsx but is NOT passed to PlaygroundPreviewPanel
  implication: Playground has no way to know if voice mode is on or off - critical missing data flow

## Resolution

root_cause: Three implementation gaps: (1) grid-cols-2 gives 50/50 instead of 40/60, (2) PlaygroundPreviewPanel has no text chat mode for voice-off, (3) voiceModeEnabled not passed to Playground so it can't switch between text chat and voice modes
fix: |
  1. voice-avatar-tab.tsx: Changed grid from grid-cols-2 to grid-cols-12 with col-span-4/col-span-8 (~33/67 ratio, matching VL Instance editor). Lifted voiceModeEnabled state up from AgentConfigLeftPanel. Pass voiceModeEnabled, profileName, agentId to PlaygroundPreviewPanel.
  2. agent-config-left-panel.tsx: Changed voiceModeEnabled from internal state to controlled prop (voiceModeEnabled + onVoiceModeChange).
  3. playground-preview-panel.tsx: Added voiceModeEnabled prop. When voice OFF: renders inline text chat using existing testChatWithAgent API (chat messages, input box, send button). When voice ON: renders avatar/orb + voice controls + transcript (unchanged logic). Added profileName, agentId props. Increased avatar/orb area to min-h-[300px]. Added MessageSquare/Volume2 icon in header to indicate mode.
  4. i18n: Added 6 new keys to both en-US and zh-CN admin.json (playgroundChatPlaceholder, playgroundChatSend, playgroundChatReady, playgroundChatNoAgent, playgroundChatThinking, playgroundVoiceHint).
  5. hcp-editor-tabs.test.tsx: Added new i18n keys to parity check.
verification: TypeScript compiles with zero errors. Build passes. All 11 hcp-editor-tabs tests pass. All 17 related tests pass. Pre-existing test failures confirmed unchanged.
files_changed:
  - frontend/src/components/admin/voice-avatar-tab.tsx
  - frontend/src/components/admin/agent-config-left-panel.tsx
  - frontend/src/components/admin/playground-preview-panel.tsx
  - frontend/public/locales/en-US/admin.json
  - frontend/public/locales/zh-CN/admin.json
  - frontend/src/__tests__/hcp-editor-tabs.test.tsx
