---
status: awaiting_human_verify
trigger: "Bug 1: During voice live conversation in model mode, there is no audio wave/orb animation effect"
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:01:00Z
---

## Current Focus

hypothesis: The WaveformViz component (voice-only fallback in AvatarView) renders only 5 flat bars with no orb/sphere animation. It lacks the pulsating orb with ripple effects similar to AI Foundry's listening animation.
test: Read AvatarView and WaveformViz source
expecting: WaveformViz is a simple bar visualization, no orb component exists
next_action: Create AudioOrb component with CSS-only pulsating sphere + ripple animation, integrate into AvatarView as voice-only fallback

## Symptoms

expected: During voice conversation, a visual audio wave/orb animation should appear (similar to AI Foundry's purple sphere animation shown when in "Listening..." state)
actual: No audio orb visualization animation is shown during voice conversation - only 5 flat bars (WaveformViz)
errors: No errors - just missing visual feature
reproduction: Start a voice live session in model mode, observe the UI during conversation
started: Feature was never implemented

## Eliminated

- hypothesis: Audio state is not tracked correctly
  evidence: useVoiceLive correctly tracks audioState (idle/listening/speaking/muted) and passes it through AvatarView to WaveformViz
  timestamp: 2026-04-04T00:00:00Z

## Evidence

- timestamp: 2026-04-04T00:00:00Z
  checked: AvatarView component (avatar-view.tsx)
  found: When not avatar-connected and not connecting, renders WaveformViz as fallback. WaveformViz is just 5 vertical bars with scaleY animation from analyser data.
  implication: Need to replace/enhance WaveformViz with an orb-style animation similar to AI Foundry

- timestamp: 2026-04-04T00:00:00Z
  checked: voice-session.tsx passes audioState and analyserData to AvatarView
  found: audioState flows from useVoiceLive hook (idle/listening/speaking/muted). analyserData from useAudioHandler (Uint8Array frequency bins).
  implication: The data pipeline exists, just need a proper visual component

- timestamp: 2026-04-04T00:00:00Z
  checked: Design tokens in index.css
  found: --improvement: #A855F7 (purple), --primary: #1E40AF (blue). The improvement color is close to AI Foundry's purple orb.
  implication: Can use purple gradient for the orb animation

## Resolution

root_cause: WaveformViz only renders 5 flat bars. No orb/sphere animation component exists. The AvatarView voice-only fallback lacks the pulsating sphere with ripple effects that AI Foundry shows.
fix: Create AudioOrb component with CSS-only pulsating sphere + ripple animation. Replace WaveformViz in AvatarView with AudioOrb for voice-only mode. The orb uses purple gradient, state-dependent animations (idle pulse, listening active ripple, speaking glow, muted dim).
verification: TypeScript compiles clean, Vite build passes, all 171 voice component tests pass (29 new + 142 existing). AudioOrb renders in 4 audio states with correct animations, colors, ripples, and accessibility labels.
files_changed:
  - frontend/src/components/voice/audio-orb.tsx (new)
  - frontend/src/components/voice/audio-orb.test.tsx (new)
  - frontend/src/components/voice/avatar-view.tsx (updated - AudioOrb replaces WaveformViz)
  - frontend/src/components/voice/avatar-view.test.tsx (updated - mocks AudioOrb)
  - frontend/src/styles/index.css (added CSS keyframe animations)
