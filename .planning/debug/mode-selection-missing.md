---
status: awaiting_human_verify
trigger: "Implement mode availability filtering and in-session mode switching"
created: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

## Current Focus

hypothesis: Both features implemented and verified via TypeScript + build + tests
test: tsc --noEmit passes, npm run build succeeds, all related tests pass
expecting: User sees only available modes on ScenarioCard, can switch mode mid-session via header dropdown
next_action: Await human verification

## Symptoms

expected: User should be able to select training mode (Text, Voice, Digital Human) before starting
actual: All sessions default to text mode with no way to choose
errors: None - functional issue, not a crash
reproduction: Go to /user/training, click any scenario's "Start Training" button - always creates text mode session
started: Missing feature / design gap

## Eliminated

(none)

## Evidence

- timestamp: 2026-05-18T00:00:00Z
  checked: frontend/src/api/sessions.ts
  found: createSession already accepts mode param with default "digital_human_realtime_model"
  implication: API layer is ready, only UI is missing

- timestamp: 2026-05-18T00:00:00Z
  checked: frontend/src/hooks/use-session.ts
  found: useCreateSession mutationFn accepts { scenarioId, mode? } - mode is optional
  implication: Hook layer is ready, just need to pass mode from UI

- timestamp: 2026-05-18T00:00:00Z
  checked: frontend/src/pages/user/training.tsx:65
  found: handleStartTraining calls createSession.mutateAsync({ scenarioId }) without mode
  implication: This is where mode needs to be passed through

- timestamp: 2026-05-18T00:00:00Z
  checked: frontend/src/components/coach/scenario-card.tsx
  found: onStart prop typed as (scenarioId: string) => void - no mode param
  implication: Need to add mode state + selector UI + update callback signature

## Resolution

root_cause: Feature gap - no mode availability filtering by feature flags, no in-session mode switching capability
fix: |
  Part 1: ScenarioCard now accepts `availableModes` prop, filters TRAINING_MODES accordingly,
  auto-falls back if selected mode unavailable. training.tsx uses useFeatureFlags to compute
  available modes (text always, voice if voice_live_enabled, digital_human if also avatar_enabled).
  
  Part 2: VoiceSessionHeader now accepts optional `onModeChange` and `availableModes` props.
  When provided, the ModeStatusIndicator becomes a clickable dropdown with available mode options.
  unified-session.tsx implements handleModeSwitch that stops/starts voice connections appropriately.
verification: |
  - TypeScript compiles clean (tsc -b --noEmit)
  - Vite build succeeds
  - voice-session-header.test.tsx: 9/9 pass
  - scenario-card.test.tsx: 7/7 pass (including 2 new tests for availability)
  - unified-session.test.tsx: 13/13 pass
  - Admin voice-session.tsx unaffected (new props are optional)
files_changed: [
  "frontend/src/components/coach/scenario-card.tsx",
  "frontend/src/components/coach/scenario-card.test.tsx",
  "frontend/src/pages/user/training.tsx",
  "frontend/src/components/voice/voice-session-header.tsx",
  "frontend/src/pages/user/unified-session.tsx",
  "frontend/public/locales/en-US/coach.json",
  "frontend/public/locales/zh-CN/coach.json",
  "frontend/public/locales/en-US/voice.json",
  "frontend/public/locales/zh-CN/voice.json"
]
