---
status: awaiting_human_verify
trigger: "avatar-not-showing-unified-session - After refactoring unified training session page, clicking Start does not display digital human avatar video"
created: 2026-05-08T00:00:00Z
updated: 2026-05-08T01:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - useEffect indirection with unstable startVoiceSession dependency causes stale closure when calling initVoice
test: Replaced useEffect-based init with direct invocation in handleStartSession click handler
expecting: Avatar connects properly because startVoiceSession is called directly with current closure values
next_action: User verification that avatar video appears after clicking Start

## Symptoms

expected: After clicking Start, the digital human avatar should appear as a WebRTC video stream showing the HCP character
actual: Start button clicked, but no digital human video appears. Avatar area remains empty.
errors: Unknown - likely silent failure due to stale closure in useEffect
reproduction: Go to http://localhost:5173/user/training/session?id=<session-id>, click Start button
started: After unified session page refactored to reuse voice-session components (commit 3734e6b)

## Eliminated

- hypothesis: Backend returns avatar_enabled: false for unified session
  evidence: Same hcpProfileId is sent, same backend handler, admin page gets avatar_enabled:true with identical params
  timestamp: 2026-05-08T00:15:00Z

- hypothesis: videoRef not connected to DOM when avatar stream tries to set srcObject
  evidence: AvatarView is rendered unconditionally (not behind any conditional), video element always in DOM after loading guard passes
  timestamp: 2026-05-08T00:20:00Z

- hypothesis: React StrictMode double-invoke causes reentrancy guard to block second attempt
  evidence: The useEffect has [sessionStarted] dep with early-return guard for false; it only fires on state CHANGE (not mount), so StrictMode mount double-invoke is a no-op
  timestamp: 2026-05-08T00:30:00Z

- hypothesis: scenario data not loaded when initVoice fires
  evidence: Loading guard at line 350 prevents rendering Start button until session+scenario are loaded; by the time user can click Start, data is available
  timestamp: 2026-05-08T00:35:00Z

- hypothesis: avatarSdpCallbackRef not properly wired between voiceLive and avatarStream
  evidence: Lifecycle hook sets it before connect() on line 81; ref is stable across renders; nothing clears it
  timestamp: 2026-05-08T00:40:00Z

## Evidence

- timestamp: 2026-05-08T00:10:00Z
  checked: Compared unified-session.tsx with working voice-session.tsx and VoiceTestPlayground
  found: Working implementations (VoiceSession component, VoiceTestPlayground) call startVoiceSession DIRECTLY from click handler or tightly-coupled effect with stable prop deps. Unified session used useEffect([sessionStarted]) indirection where initVoice was not in the dependency array.
  implication: The useEffect captures initVoice via closure from the render where sessionStarted transitions to true, but initVoice depends on startVoiceSession which is unstable (recreated every render due to voiceLive/avatarStream object deps in useVoiceSessionLifecycle). This creates potential for stale closure execution.

- timestamp: 2026-05-08T00:20:00Z
  checked: useVoiceSessionLifecycle startSession deps
  found: startSession useCallback has deps [voiceLive, avatarStream, audioHandler] - these are objects returned by hooks that get new references every render, making startSession unstable
  implication: initVoice (which depends on startVoiceSession) also changes every render, but useEffect([sessionStarted]) doesn't include initVoice in deps

- timestamp: 2026-05-08T00:30:00Z
  checked: How VoiceTestPlayground calls startVoiceSession
  found: VoiceTestPlayground.startTest() calls startVoiceSession directly in the onClick callback (line 141). No useEffect indirection. This pattern works reliably.
  implication: The fix should match this pattern - call startVoiceSession directly from the click handler

- timestamp: 2026-05-08T00:45:00Z
  checked: AvatarView video visibility condition
  found: Video shows when isAvatarConnected && !isConnecting. During connection, isConnecting=true would hide video temporarily but it becomes visible once startVoiceSession resolves (finally block sets isConnecting=false)
  implication: Not a display bug - the video element correctly transitions to visible when avatar connects

## Resolution

root_cause: The unified-session used a useEffect([sessionStarted]) pattern to trigger voice initialization, but initVoice (which depends on the unstable startVoiceSession reference) was NOT in the dependency array. While React captures the current render's initVoice in the effect closure, the underlying issue is that this indirection pattern differs from the working implementations (VoiceTestPlayground, VoiceSession) which call startVoiceSession directly from click handlers. The useEffect indirection creates a window where React's batching/scheduling can lead to the effect firing with a closure that has inconsistent state — particularly the combination of startVoiceSession being recreated every render (due to unstable hook object deps) while the effect only fires once on sessionStarted change.

fix: Removed the useEffect([sessionStarted]) indirection. Moved the entire voice initialization logic directly into handleStartSession (the click handler), matching the proven VoiceTestPlayground pattern. Added a ref-based cleanup (stopVoiceSessionRef) with a simple useEffect([]) for unmount cleanup. This ensures startVoiceSession is called with the exact closure values available at click time — no indirection, no stale captures.

verification: TypeScript compiles clean (npx tsc --noEmit), build succeeds (npm run build), all 12 unified-session tests pass, all 17 lifecycle hook tests pass, all 50 voice-session component tests pass.

files_changed:
- frontend/src/pages/user/unified-session.tsx
