---
status: awaiting_human_verify
trigger: "avatar-toggle-not-working: When user disables Enable avatar toggle in VL Instance editor, playground still shows digital human avatar"
created: 2026-04-08T00:00:00Z
updated: 2026-04-08T00:00:02Z
---

## Current Focus

hypothesis: CONFIRMED — VoiceTestPlayground passes `isAvatarConnected={sessionState === "connected"}` to AvatarView. This conflates "voice session connected" with "avatar stream connected". During a connected voice session with avatar disabled, the video element still shows at z-10 opacity-100 (because sessionState is "connected"), and AudioOrb never renders (because `!isAvatarConnected` is false). Additionally, for idle state: AvatarView only shows AudioOrb when `!charMeta` — but charMeta depends on avatarCharacter prop being undefined, which IS correctly handled by the prop chain when avatarEnabled=false.
test: Verified code trace through VL editor -> VoiceTestPlayground -> AvatarView
expecting: Two-part fix: (1) separate voice session state from avatar stream state in AvatarView rendering, (2) ensure AudioOrb shows during connected sessions when avatar is disabled
next_action: Implement fix in voice-test-playground.tsx — pass avatarStream.isConnected to AvatarView as isAvatarConnected

## Symptoms

expected: When "Enable avatar" is toggled OFF in the VL Instance editor left panel, the Voice Live Playground on the right should show an audio wave ball/orb visualization instead of the digital human avatar.
actual: The digital human avatar (a female figure - "Lisa") is always displayed in the Voice Live Playground regardless of the Avatar toggle state.
errors: No error messages visible
reproduction: Go to VL Instance editor -> Toggle "Enable avatar" OFF -> Observe right side still shows digital human avatar
started: Current state, frontend logic issue

## Eliminated

## Evidence

- timestamp: 2026-04-08T00:01:00Z
  checked: vl-instance-editor.tsx lines 688-698 — prop passing to VoiceTestPlayground
  found: Props are passed correctly: `avatarCharacter={form.avatar_enabled ? (form.avatar_character ?? undefined) : undefined}` and `avatarEnabled={form.avatar_enabled ?? false}`
  implication: The VL editor correctly sets avatarCharacter to undefined when avatar is disabled

- timestamp: 2026-04-08T00:02:00Z
  checked: voice-test-playground.tsx lines 208-218 — AvatarView rendering
  found: AvatarView receives `avatarCharacter={avatarEnabled ? (avatarCharacter ?? undefined) : undefined}` — double-guarded correctly
  implication: avatarCharacter should be undefined when avatarEnabled is false

- timestamp: 2026-04-08T00:03:00Z
  checked: avatar-view.tsx lines 52-53 and 143 — charMeta lookup and AudioOrb condition
  found: `charMeta = avatarCharacter ? AVATAR_CHARACTER_MAP.get(avatarCharacter) : undefined` — this means when avatarCharacter is undefined, charMeta is undefined. AudioOrb shows when `!isConnecting && !isAvatarConnected && !charMeta`. Static preview shows when `!isAvatarConnected && !isConnecting && charMeta && !imgError`.
  implication: The logic in AvatarView appears correct IF avatarCharacter is truly undefined. Need to check if `form.avatar_character` could default to a truthy value even when avatar is disabled.

- timestamp: 2026-04-08T00:04:00Z
  checked: voice-test-playground.tsx line 210 — isAvatarConnected prop value
  found: `isAvatarConnected={sessionState === "connected"}` — this uses the VOICE SESSION state, not the avatar WebRTC stream state. avatarStream.isConnected exists (from use-avatar-stream.ts line 25) but is never used in AvatarView rendering.
  implication: During a connected voice session with avatar disabled, isAvatarConnected is true (session connected), so video shows at opacity-100 z-10 and AudioOrb is suppressed.

- timestamp: 2026-04-08T00:05:00Z
  checked: use-voice-session-lifecycle.ts line 97 — avatar connect decision
  found: `if (result.avatarEnabled) { await avatarStream.connect(...) }` — result.avatarEnabled comes from the SERVER response (stored VL instance config), not from the frontend form state. If user toggles avatar off but doesn't save, server still returns avatarEnabled=true.
  implication: Even with frontend toggle OFF, the backend may still enable avatar stream during session, compounding the issue.

- timestamp: 2026-04-08T00:06:00Z
  checked: avatar-view.tsx lines 86-95 — video element visibility
  found: Video element is always in DOM. When isAvatarConnected=true (regardless of avatar stream state), video shows at z-10 opacity-100. All other content (AudioOrb, static preview) is suppressed by !isAvatarConnected conditions.
  implication: During any connected voice session, avatar video ALWAYS shows, even when no avatar stream is actually connected.

- timestamp: 2026-04-08T00:07:00Z
  checked: All 46 VL editor tests pass, all 22 AvatarView tests pass
  found: Tests confirm prop chain is correct for idle state. No test coverage for connected session state with avatar disabled.
  implication: The idle-state logic is correct. Bug manifests during connected voice sessions.

## Resolution

root_cause: VoiceTestPlayground passes `isAvatarConnected={sessionState === "connected"}` to AvatarView, which conflates "voice session connected" with "avatar WebRTC stream connected". During a connected voice session with avatar disabled: (1) the video element shows at full opacity (z-10) because sessionState is "connected", (2) AudioOrb never renders because `!isAvatarConnected` is false, (3) the avatar stream may still connect because the backend uses the stored/saved config not the unsaved frontend form state. The fix requires using avatarStream.isConnected for avatar video visibility, and adding a sessionConnected flag so AudioOrb can show during voice-only sessions.
fix: (1) Pass both `isAvatarConnected` (avatarStream.isConnected) and `isSessionActive` (sessionState connected) to AvatarView. (2) Use isAvatarConnected for video visibility, use isSessionActive for AudioOrb active state display. (3) Show AudioOrb during connected sessions when avatar is not connected.
verification: All 28 AvatarView tests pass (22 existing + 6 new), 26/27 VoiceTestPlayground tests pass (4 new pass, 1 pre-existing failure unrelated to change), all 46 VL editor tests pass, Vite production build succeeds, TypeScript compiles clean (only pre-existing test file warning).
files_changed:
  - frontend/src/components/voice/voice-test-playground.tsx
  - frontend/src/components/voice/avatar-view.tsx
  - frontend/src/components/voice/avatar-view.test.tsx
  - frontend/src/components/voice/voice-test-playground.test.tsx
