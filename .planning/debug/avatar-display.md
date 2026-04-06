---
status: awaiting_human_verify
trigger: "Bug 3: Avatar does not show up during voice conversation even when avatar is enabled in config"
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Three compounding issues prevented avatar display
test: TypeScript build + unit tests + manual verification
expecting: Avatar video renders in center area when enabled, falls back to audio orb when not
next_action: Await human verification in real environment

## Symptoms

expected: When avatar is enabled in HCP profile's voice live config, a digital human avatar should be visible in the main area during voice conversation
actual: Avatar does not show up during voice conversation even when avatar is enabled in config
errors: Unknown - need to investigate the avatar stream pipeline
reproduction: Enable avatar for an HCP profile, start voice live session, observe avatar area is empty
started: Avatar feature was implemented but may have integration issues

## Eliminated

## Evidence

- timestamp: 2026-04-04T00:10:00Z
  checked: Reference implementation pattern (useWebRTC.ts, VideoPanel.tsx)
  found: Reference uses a pre-rendered <video> element with React ref that is ALWAYS in the DOM and visible. srcObject is set directly in ontrack handler. Explicit play() called.
  implication: Our implementation creates video elements dynamically inside a HIDDEN container, which can prevent autoplay

- timestamp: 2026-04-04T00:12:00Z
  checked: avatar-view.tsx container visibility logic
  found: Video container has Tailwind "hidden" class (display:none) when !isAvatarConnected || isConnecting. Video elements are appended to this hidden container during WebRTC negotiation. Browsers may not autoplay video in display:none containers.
  implication: CRITICAL - video appended to hidden container may not autoplay when container becomes visible

- timestamp: 2026-04-04T00:14:00Z
  checked: use-avatar-stream.ts connect() function
  found: ontrack creates <video>/<audio> elements dynamically, sets el.autoplay=true but never calls el.play(). Reference implementation calls videoRef.current.play() explicitly after setting srcObject.
  implication: Missing explicit play() call may prevent video from playing, especially when element was in hidden container

- timestamp: 2026-04-04T00:15:00Z
  checked: avatar-view.tsx layout
  found: Container uses h-[280px] in non-fullscreen mode but has no min-height guarantee for video. Video container div is empty (no pre-rendered video element). AudioOrb shows correctly as fallback since isAvatarConnected stays false if WebRTC fails silently.
  implication: If WebRTC negotiation fails silently, user sees AudioOrb instead of avatar (fallback works but avatar never appears)

- timestamp: 2026-04-04T00:16:00Z
  checked: use-avatar-stream.ts vs reference useWebRTC.ts video rendering pattern
  found: Our implementation uses dynamic createElement + appendChild to a container div. Reference uses a single <video ref={videoRef}> with srcObject assignment. Our approach is fragile because the container may be hidden. Also, our approach doesn't handle video playback failure (no error handling on play).
  implication: Should switch to ref-based approach like reference, or at minimum handle visibility transitions

## Resolution

root_cause: Three compounding issues prevented avatar from displaying: (1) Video container used Tailwind "hidden" class (display:none) during WebRTC negotiation, preventing browsers from autoplay-ing video elements; (2) Video elements were created dynamically via createElement and appended to the hidden container instead of using pre-rendered <video> element with React ref (the Azure reference implementation pattern); (3) No explicit play() call after setting srcObject, which is required for reliable autoplay across browsers, especially when elements transition from invisible to visible.
fix: Rewrote avatar video pipeline to match Azure reference implementation (VideoPanel.tsx + useWebRTC.ts): (1) Changed useAvatarStream to accept videoRef (HTMLVideoElement ref) instead of container div ref; (2) Pre-render <video> element in AvatarView that is always in DOM with autoPlay/playsInline attributes; (3) Use opacity-0/opacity-100 with z-index layering instead of display:none for visibility transitions; (4) Set srcObject directly on video ref element and call explicit play() in ontrack handler; (5) Create audio element on document.body (hidden) matching reference pattern; (6) Updated admin voice-avatar-tab to use same pattern.
verification: TypeScript compiles clean, build passes, all unit tests pass (18 avatar-stream, 12 avatar-view, 50 voice-session, 15 voice-live = 95 tests total)
files_changed:
  - frontend/src/hooks/use-avatar-stream.ts
  - frontend/src/hooks/use-avatar-stream.test.ts
  - frontend/src/components/voice/avatar-view.tsx
  - frontend/src/components/voice/avatar-view.test.tsx
  - frontend/src/components/voice/voice-session.tsx
  - frontend/src/components/admin/voice-avatar-tab.tsx
