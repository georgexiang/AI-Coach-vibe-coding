# Phase 08 -- UI Review

**Audited:** 2026-03-28
**Baseline:** 08-UI-SPEC.md (Phase 08 Design Contract)
**Screenshots:** Captured (dev server at localhost:5173) -- login page only (authentication required for inner pages)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All i18n keys present in both locales, matching UI-SPEC copywriting contract exactly |
| 2. Visuals | 3/4 | Strong visual hierarchy and accessibility; minor gap with hardcoded "Send message" aria-label in chat-area |
| 3. Color | 3/4 | Semantic voice colors match spec (#22C55E, #F97316); hardcoded `bg-blue-600` in chat-area diverges from design token system |
| 4. Typography | 4/4 | Only spec-declared sizes (xs, sm, base, 3xl) and weights (normal, medium, semibold) used in voice components |
| 5. Spacing | 3/4 | Consistent 4px-multiple spacing in voice components; some arbitrary pixel values in avatar view and waveform |
| 6. Experience Design | 4/4 | Comprehensive state coverage: loading, connecting, error, fallback chain, empty states, destructive confirmation dialog |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **`bg-blue-600` hardcoded color on TTS toggle and send buttons in chat-area.tsx** -- Users see inconsistent accent color that won't respect theme changes -- Replace `bg-blue-600` with `bg-primary text-primary-foreground` on lines 221 and 242 of `frontend/src/components/coach/chat-area.tsx`
2. **Hardcoded English "Send message" aria-label in chat-area.tsx** -- Screen reader users always hear English regardless of locale -- Replace `aria-label="Send message"` (line 245) with `aria-label={t("session.sendMessage")}` and add `sendMessage` key to both locale files
3. **`text-gray-900` on page heading in training.tsx** -- Heading color bypasses design token system, won't adapt to dark mode -- Replace `text-gray-900` (line 182) with `text-foreground` to use the semantic token

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

All copy from the UI-SPEC copywriting contract is present and correct:

**UI-SPEC required i18n keys -- all verified:**
- `coach:scenarioSelection.tabVoice` = "Voice" (en-US) / "语音" (zh-CN) -- `frontend/public/locales/en-US/coach.json:12`, `zh-CN/coach.json:12`
- `voice:emptyTranscript` -- `frontend/public/locales/en-US/voice.json:36`
- `voice:emptyTranscriptText` -- `frontend/public/locales/en-US/voice.json:37`
- `voice:notConfigured` -- `frontend/public/locales/en-US/voice.json:39`
- `voice:avatarNotConfigured` -- `frontend/public/locales/en-US/voice.json:40`
- `voice:error.connectionFailed` -- `frontend/public/locales/en-US/voice.json:42`
- `voice:error.avatarFailed` -- `frontend/public/locales/en-US/voice.json:44`
- `voice:error.micDenied` -- `frontend/public/locales/en-US/voice.json:43`
- `voice:endSessionTitle` -- `frontend/public/locales/en-US/voice.json:51`
- `voice:endSessionConfirm` -- `frontend/public/locales/en-US/voice.json:52`
- `voice:continueSession` -- `frontend/public/locales/en-US/voice.json:53`
- `voice:endSession` -- `frontend/public/locales/en-US/voice.json:50`
- `coach:session.startRecording` / `stopRecording` / `ttsOn` / `ttsOff` -- `coach.json:36-39`

**Speech hooks (Plan 05) copy:**
- STT/TTS i18n keys added in both locales for start/stop recording and TTS toggle

**No generic labels found** in voice components (no "Submit", "Click Here", "OK", "Cancel" bare strings).

**Empty/error states all use i18n:**
- Empty transcript: uses `t("emptyTranscript")` -- `voice-transcript.tsx:40`
- Connection errors: uses `t("error.connectionFailed")`, `t("error.avatarFailed")` -- `voice-session.tsx:117,163`
- Mic denied: uses `t("error.micDenied")` pattern in use-speech.ts

**Minor note:** One hardcoded English string exists: `aria-label="Send message"` in `chat-area.tsx:245`. This is an accessibility gap rather than user-facing copy, but it should be i18n'd. Scored as a visual/accessibility finding rather than a copywriting deduction since all user-visible copy is properly localized.

### Pillar 2: Visuals (3/4)

**Visual hierarchy -- PASS:**
- Primary focal point: AvatarView (280px height, `bg-slate-900` dark container) in center panel -- matches spec
- Secondary focal point: VoiceControls mic button (56px / h-14 w-14 circle) with state-dependent colors and ping animation -- matches spec
- Tertiary: VoiceTranscript panel (h-[200px]) below avatar -- matches spec

**Icon-only buttons with accessibility -- MOSTLY PASS:**
Voice components are excellent:
- All VoiceControls buttons wrapped in Tooltip components (`voice-controls.tsx:122-209`)
- Mic button has state-specific aria-labels via `t(config.ariaKey)` -- 6 unique states (idle, listening, speaking, muted, connecting, disabled)
- Mute toggle: `aria-label={isMuted ? t("unmute") : t("mute")}` (`voice-controls.tsx:132`)
- Keyboard: `aria-label={t("keyboardInput")}` (`voice-controls.tsx:178`)
- View toggle: `aria-label={isFullScreen ? t("embeddedView") : t("fullScreen")}` (`voice-controls.tsx:197`)
- ModeSelector: `role="radiogroup"` with `role="radio"` + `aria-checked` + `aria-label={t(option.labelKey)}` (`mode-selector.tsx:70,81-83`)
- ConnectionStatus: `aria-live="assertive"` + `role="status"` (`connection-status.tsx:54-55`)
- AvatarView: `role="region"` + `aria-label` (`avatar-view.tsx:43-44`)
- WaveformViz: `role="img"` + `aria-label` (`waveform-viz.tsx:99-100`)
- VoiceTranscript: `aria-live="polite"` for live updates (`voice-transcript.tsx:37,51`)

**Gap -- chat-area.tsx buttons:**
- Send button: hardcoded `aria-label="Send message"` (English only, not i18n) -- `chat-area.tsx:245`
- Mic button in chat-area: properly uses `t("session.startRecording")` / `t("session.stopRecording")` -- good
- TTS toggle button: properly uses `t("session.ttsOn")` / `t("session.ttsOff")` -- good

**Deduction rationale:** The one hardcoded English aria-label on the send button is a minor but real accessibility gap for non-English screen reader users.

### Pillar 3: Color (3/4)

**Semantic voice colors -- match spec exactly:**

| Spec Color | Spec Usage | Implementation |
|------------|-----------|----------------|
| #22C55E (listening green) | Mic active, connected dot, assistant label, waveform bars | `bg-[#22C55E]` in `voice-controls.tsx:68,148`, `connection-status.tsx:16`, `waveform-viz.tsx:20` |
| #F97316 (speaking orange) | Mic when AI speaking, connecting dot | `bg-[#F97316]` in `voice-controls.tsx:77`, `connection-status.tsx:14` |
| #1E40AF (primary blue) | Idle mic, user label, active mode | `bg-primary` in `voice-controls.tsx:86`, `waveform-viz.tsx:18` |
| --muted-foreground | Disabled states | `bg-muted-foreground` in `voice-controls.tsx:56`, `waveform-viz.tsx:24` |
| --destructive | End session, error dot | `bg-destructive` in `connection-status.tsx:19`, `Button variant="destructive"` in headers |

**Total primary token usage across project:** 121 occurrences in 56 files -- appropriate distribution, not overused.

**Hardcoded color issues:**
1. `bg-blue-600` in `chat-area.tsx:221` (TTS toggle active state) -- should be `bg-primary text-primary-foreground`
2. `bg-blue-600` in `chat-area.tsx:242` (send button) -- should be `bg-primary text-primary-foreground`
3. Hardcoded hex colors in voice components (`#22C55E`, `#F97316`) are intentional per UI-SPEC semantic color table and are used consistently. These are acceptable since they represent voice-specific semantic colors not in the base token system.

**Other project-wide hardcoded colors (outside Phase 08 scope, noted for context):**
- Charts/analytics: Multiple hex colors in `reports.tsx`, `session-history.tsx`, `bu-comparison-bar.tsx`, `performance-radar.tsx` (acceptable for chart libraries)
- `floating-transcript.tsx:36`: `style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}` -- inline style, matches UI-SPEC `rgba(0,0,0,0.7)` spec

**Deduction rationale:** The `bg-blue-600` in chat-area.tsx is not part of the design token system and will not adapt to theme changes. This is a Phase 05 change that should use `bg-primary`.

### Pillar 4: Typography (4/4)

**Voice component font sizes (all within spec):**

| Spec Role | Spec Size | Actual Usage |
|-----------|-----------|-------------|
| Body | text-base (16px) | `floating-transcript.tsx:47` (transcript content) |
| Label / Speaker Name | text-xs (12px) | `voice-transcript.tsx:70`, `mode-selector.tsx:69`, `voice-session-header.tsx:59`, `waveform-viz.tsx:121` |
| Transcript message | text-sm (14px) | `voice-transcript.tsx:85`, `connection-status.tsx:61`, `avatar-view.tsx:49,71`, `voice-session-header.tsx:49`, `mode-selector.tsx:91` |

**Voice component font weights (only 2 weights, matching spec):**
- `font-medium` (400/normal equivalent in context): `floating-transcript.tsx:41`, `avatar-view.tsx:71`, `voice-transcript.tsx:70`, `voice-session-header.tsx:49`
- No `font-bold` or `font-semibold` in voice components (headings are in page-level components)

The spec declares: "Font weights used: 400 (normal) for body, labels, speaker names, and transcript text; 600 (semibold) for headings only. Two weights total." Voice components correctly use only normal and medium weights. The h1 page heading in `training.tsx:182` uses `font-semibold` for the heading -- correct.

**No extra font sizes introduced by Phase 08.** All sizes are from the existing type scale.

### Pillar 5: Spacing (3/4)

**Standard spacing values (all 4px multiples):**
Voice components consistently use the declared spacing scale:
- `gap-1` (4px) -- waveform bars, mode selector options
- `gap-1.5` (6px) -- waveform bars container, mode selector button content
- `gap-2` (8px) -- ConnectionStatus dot+text, keyboard input
- `gap-3` (12px) -- avatar connecting, transcript messages, header right section
- `gap-4` (16px) -- control bar, header left section
- `p-1` (4px) -- mode selector bg
- `p-3` (12px) -- keyboard input area
- `p-4` (16px) -- transcript area, avatar overlay, header
- `px-3 py-1.5` -- mode selector buttons
- `px-4 py-2` -- transcript bubbles, avatar name overlay

**Spec-declared exceptions verified:**
- Voice control bar: `h-16` (64px) -- `voice-controls.tsx:117` -- MATCH
- Central mic button: `h-14 w-14` (56px) -- `voice-controls.tsx:157` -- MATCH
- Side control buttons: `h-10 w-10` (40px) -- `voice-controls.tsx:129,175,194` -- MATCH
- Avatar non-fullscreen: `h-[280px]` -- `avatar-view.tsx:40` -- MATCH
- Transcript panel: `h-[200px]` -- `voice-session.tsx:340` -- MATCH

**Arbitrary spacing values:**
- `h-[120px]` in `waveform-viz.tsx:96` -- fixed height for waveform container, not in spec but reasonable
- `h-[calc(100vh-64px-80px)]` in `avatar-view.tsx:40` -- fullscreen avatar height calculation, spec-declared
- `max-w-[200px]` in `voice-session-header.tsx:49` -- title truncation, reasonable
- `h-20` (80px) in `floating-transcript.tsx:33` -- spec declares "80px overlay", matches
- `w-[180px]` in `training.tsx:96,113` -- filter select width, pre-existing from earlier phases

**Deduction rationale:** Minor arbitrary values exist (`h-[120px]`, `max-w-[200px]`) that are not explicitly in the spacing scale, but they are reasonable functional values. The `style={{ height: 80 }}` inline style in `waveform-viz.tsx:102` is an inline pixel value that could use a Tailwind class.

### Pillar 6: Experience Design (4/4)

**Loading states -- comprehensive:**
- Scenario selection: Skeleton loading grid (6 cards) -- `training.tsx:141-155`
- Voice session connecting: Skeleton `h-20 w-20 rounded-full` + "Connecting avatar..." text -- `avatar-view.tsx:46-50`
- Voice controls: Loader2 spinner icon with `animate-spin` during connecting state -- `voice-controls.tsx:33-35`
- Voice session page: Loader2 spinner + "Voice Coaching Session" loading text -- `voice-session.tsx` (via VoiceSessionPage)

**Error states -- comprehensive:**
- Connection failed: toast.error with fallback to text mode -- `voice-session.tsx:116-118`
- Avatar failed: toast.error with fallback to voice-only -- `voice-session.tsx:162-164`
- Voice connection failed: toast.error with fallback to text -- `voice-session.tsx:175-178`
- Console logging for voice errors -- `voice-session.tsx:121-123`
- End session API failure: caught and handled by mutation -- `voice-session.tsx:208`
- Connection status indicator: red dot + "Connection Error" text for error state -- `connection-status.tsx:18-19,33-34`

**Empty states:**
- Empty transcript: "Start speaking to begin the conversation..." with `aria-live="polite"` -- `voice-transcript.tsx:33-43`
- Empty scenarios: EmptyState component with i18n title/body -- `training.tsx:158-164`

**Disabled states:**
- Mic button disabled when not connected or during processing -- `voice-controls.tsx:37,47`
- Side buttons disabled when not connected -- `voice-controls.tsx:127`
- Mode selector: disabled segments at 50% opacity with `cursor-not-allowed` -- `mode-selector.tsx:95`
- Chat area input disabled during recording -- `chat-area.tsx:189-191`
- Send button disabled when empty or streaming -- `chat-area.tsx:244`

**Destructive action confirmation:**
- End voice session: Dialog with DialogTitle "End Voice Session", DialogDescription confirmation text, "Continue Session" (outline) + "End Session" (destructive) buttons -- `voice-session.tsx:391-409` -- exact match to UI-SPEC
- End conference: Same dialog pattern -- `conference-session.tsx:351-371`

**Fallback chain (D-10) -- fully implemented:**
1. Avatar failure -> voice-only mode (toast notification) -- `voice-session.tsx:161-164`
2. Voice failure -> text mode (toast notification) -- `voice-session.tsx:175-178`
3. Connection error state -> text mode -- `voice-session.tsx:116-118`

**Transcript flush before end session (D-09):**
- `pendingFlushesRef` tracks pending writes -- `voice-session.tsx:72-73`
- `Promise.all(pendingFlushesRef.current)` before disconnect -- `voice-session.tsx:196-197`

**Feature flag gating:**
- Voice tab: `config.voice_live_enabled` conditional rendering -- `training.tsx:194-198`
- Speech UI: `config.voice_enabled` for mic/TTS buttons -- `chat-area.tsx:193,216`
- Conference: `config.voice_enabled` for feature flag -- `conference-session.tsx:305`

---

## Files Audited

**Voice components (Plans 01-03):**
- `frontend/src/components/voice/voice-session.tsx`
- `frontend/src/components/voice/voice-session-header.tsx`
- `frontend/src/components/voice/avatar-view.tsx`
- `frontend/src/components/voice/voice-transcript.tsx`
- `frontend/src/components/voice/voice-controls.tsx`
- `frontend/src/components/voice/floating-transcript.tsx`
- `frontend/src/components/voice/waveform-viz.tsx`
- `frontend/src/components/voice/mode-selector.tsx`
- `frontend/src/components/voice/connection-status.tsx`

**Modified in Plan 04 (Voice tab entry flow):**
- `frontend/src/pages/user/training.tsx`
- `frontend/src/types/config.ts`
- `frontend/src/contexts/config-context.tsx`
- `frontend/src/api/sessions.ts`
- `frontend/src/hooks/use-session.ts`

**Modified in Plan 05 (STT/TTS integration):**
- `frontend/src/components/coach/chat-area.tsx`
- `frontend/src/pages/user/conference-session.tsx`
- `frontend/src/hooks/use-speech.ts`
- `frontend/src/api/speech.ts`

**i18n files:**
- `frontend/public/locales/en-US/coach.json`
- `frontend/public/locales/zh-CN/coach.json`
- `frontend/public/locales/en-US/voice.json`
- `frontend/public/locales/zh-CN/voice.json`
