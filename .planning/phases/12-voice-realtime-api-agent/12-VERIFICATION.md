---
phase: 12-voice-realtime-api-agent
verified: 2026-04-02T10:30:00Z
status: gaps_found
score: 7/8 must-haves verified
gaps:
  - truth: "All new UI text externalized to i18n in both en-US and zh-CN"
    status: partial
    reason: "Production code fully i18n'd, but voice-session.test.tsx has 12 TypeScript errors due to stale 'mode' prop reference from Phase 12-03 interface change. tsc -b fails; Vite production build succeeds."
    artifacts:
      - path: "frontend/src/components/voice/voice-session.test.tsx"
        issue: "References old 'mode' prop on VoiceSessionProps which was replaced with hcpProfileId in Plan 03. 12 TS2353 errors."
    missing:
      - "Update voice-session.test.tsx to use hcpProfileId prop instead of mode, and mock auto-mode resolution"
  - truth: "All backend tests pass with ruff check clean"
    status: partial
    reason: "Backend ruff check passes on all production files. tsc -b fails on one test file (voice-session.test.tsx). This is a frontend test issue, not backend."
    artifacts:
      - path: "frontend/src/components/voice/voice-session.test.tsx"
        issue: "TypeScript compilation failure prevents clean tsc -b across entire frontend"
    missing:
      - "Fix voice-session.test.tsx to match new VoiceSessionProps interface"
---

# Phase 12: Voice Realtime API & Agent Mode Integration Verification Report

**Phase Goal:** Each HCP profile becomes a complete "digital persona" with per-HCP voice, avatar, and conversation parameters. The token broker returns all settings in one response. MRs get automatic mode selection (Digital Human Realtime Agent as default) with graceful fallback to voice-only or text. Admin configures HCP digital personas via a tabbed editor.

**Verified:** 2026-04-02T10:30:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can configure per-HCP voice settings, avatar settings, and conversation parameters via tabbed HCP editor | VERIFIED | `voice-avatar-tab.tsx` (438 lines): 3 Cards (Voice Settings, Avatar Settings, Conversation Parameters) with Select dropdowns for voice name (8 options), avatar character (6 options) with dynamic style filtering, temperature Slider, 3 Switch controls (noise suppression, echo cancellation, EOU detection), turn detection Select, recognition language Select. `hcp-profile-editor.tsx` imports and renders VoiceAvatarTab in TabsContent. |
| 2 | Token broker returns all per-HCP voice/avatar settings when hcp_profile_id is provided, falls back to global defaults when not | VERIFIED | `voice_live_service.py` lines 82-106: sources all 13 fields from `profile.voice_name`, `profile.avatar_character`, etc. when hcp_profile_id provided. Lines 65-79: initializes defaults before the if-block. Lines 108-130: returns all fields in VoiceLiveTokenResponse. |
| 3 | New HCPs get smart defaults (voice "Ava", avatar "Lori-casual", temp 0.9, Server VAD) without manual configuration | VERIFIED | `hcp_profile.py` model defaults: `voice_name="en-US-AvaNeural"`, `avatar_character="lori"`, `avatar_style="casual"`, `voice_temperature=0.9`, `turn_detection_type="server_vad"`. Migration `i12b` has matching `server_default` on all 13 columns. Behavioral spot-check confirmed: `HcpProfileCreate(name='test', specialty='Onc', created_by='x').voice_name == 'en-US-AvaNeural'`. |
| 4 | MR does NOT see a mode picker -- system auto-selects best mode based on HCP config and service availability | VERIFIED | `voice-session.tsx`: `resolveMode(tokenData)` function at line 49 derives mode from `avatar_enabled` and `agent_id`. No ModeSelector import or render found. `voice-session-page.tsx` passes `hcpProfileId` not `mode`. |
| 5 | Fallback chain works: Digital Human Realtime Agent -> Voice-only Realtime -> Text, with toast notification and persistent mode status indicator | VERIFIED | `voice-session.tsx`: avatar connect failure triggers `toast.warning(t("error.avatarFallback"))` and falls back to voice-only (line 193). Voice connection failure triggers `toast.warning(t("error.voiceFallback"))` and falls back to text (line 210). `mode-status-indicator.tsx`: green/amber/red dot with `role="status"` and `aria-live="polite"`. `voice-session-header.tsx` renders ModeStatusIndicator. |
| 6 | HCP table shows Voice & Avatar column with badge pair showing per-HCP configuration | VERIFIED | `hcp-table.tsx`: column header `t("hcp.voiceAvatarCol")` at line 181. Cell renders two Badge elements with `getVoiceLabel(profile.voice_name)` and `profile.avatar_character-profile.avatar_style` at lines 271-276. Empty state colSpan=7. |
| 7 | Agent instructions support admin override via Agent tab (D-02) | VERIFIED | `agent-tab.tsx`: disabled Textarea showing `buildPreviewInstructions()` auto-generated preview, editable Textarea for `agent_instructions_override` with i18n placeholder. Backend `agent_sync_service.py` lines 54-57: checks override first, returns trimmed text if non-empty. Behavioral spot-check confirmed override and empty-override both work correctly. |
| 8 | All new UI text externalized to i18n in both en-US and zh-CN | VERIFIED | `admin.json` (en-US): 21+ keys including tabProfile, tabVoiceAvatar, tabAgent, voiceSettings, avatarSettings, voiceAvatarCol, notConfigured. `admin.json` (zh-CN): matching keys with Chinese translations. `voice.json` (en-US): modeStatus.connected/degraded/disconnected, error.avatarFallback/voiceFallback. `voice.json` (zh-CN): matching Chinese translations. |

**Score:** 8/8 truths verified (production code)

**Note:** One test file (`voice-session.test.tsx`) has TypeScript compilation errors from the `mode` -> `hcpProfileId` prop change. This does not affect production code or the Vite build, but prevents `tsc -b` from succeeding across the full project.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/alembic/versions/i12b_add_voice_avatar_fields_to_hcp_profile.py` | Migration adding 13 columns | VERIFIED | 13 add_column calls with server_default on all, batch_alter_table for SQLite compat |
| `backend/app/models/hcp_profile.py` | ORM model with voice/avatar columns | VERIFIED | 13 new Mapped columns (voice_name, voice_type, voice_temperature, voice_custom, avatar_character, avatar_style, avatar_customized, turn_detection_type, noise_suppression, echo_cancellation, eou_detection, recognition_language, agent_instructions_override) |
| `backend/app/schemas/hcp_profile.py` | Extended Pydantic schemas | VERIFIED | HcpProfileCreate, HcpProfileUpdate, HcpProfileResponse all include 13 voice/avatar fields |
| `backend/app/schemas/voice_live.py` | VoiceLiveTokenResponse with per-HCP fields | VERIFIED | 11 per-HCP fields added (avatar_style, avatar_customized, voice_type, voice_temperature, voice_custom, turn_detection_type, noise_suppression, echo_cancellation, eou_detection, recognition_language, agent_instructions_override) |
| `backend/app/services/voice_live_service.py` | Token broker with per-HCP sourcing | VERIFIED | Sources all fields from profile when hcp_profile_id provided, falls back to defaults |
| `backend/app/api/voice_live.py` | Endpoint with hcp_profile_id query param | VERIFIED | `hcp_profile_id: str | None = Query(None)` parameter, passes through to service |
| `backend/app/services/agent_sync_service.py` | Agent instructions override (D-02) | VERIFIED | `build_agent_instructions` checks override first, returns trimmed text if non-empty |
| `backend/app/api/hcp_profiles.py` | HcpProfileOut with voice/avatar fields | VERIFIED | 13 voice/avatar fields added to HcpProfileOut response model (bug fix in Plan 04) |
| `frontend/src/types/hcp.ts` | Extended TypeScript types | VERIFIED | HcpProfile has 13 voice/avatar fields, HcpProfileCreate has all optional |
| `frontend/src/types/voice-live.ts` | VoiceLiveToken with per-HCP fields | VERIFIED | 11 per-HCP optional fields added |
| `frontend/src/api/voice-live.ts` | API client with hcpProfileId | VERIFIED | `fetchVoiceLiveToken(hcpProfileId?: string)` passes as query param |
| `frontend/src/hooks/use-voice-token.ts` | Mutation accepts hcpProfileId | VERIFIED | `useMutation<VoiceLiveToken, Error, string | undefined>` |
| `frontend/src/components/admin/voice-avatar-tab.tsx` | Voice & Avatar tab component | VERIFIED | 438 lines, 3 Cards, all form fields wired to react-hook-form |
| `frontend/src/components/admin/agent-tab.tsx` | Agent tab component | VERIFIED | 281 lines, AGENT_STATUS_CONFIG, preview + override textareas, metadata card |
| `frontend/src/pages/admin/hcp-profile-editor.tsx` | Tabbed HCP editor | VERIFIED | 3 TabsTrigger values (profile, voice-avatar, agent), no grid-cols-3, imports VoiceAvatarTab + AgentTab |
| `frontend/src/components/admin/hcp-table.tsx` | HCP table with Voice+Avatar column | VERIFIED | voiceAvatarCol header, Badge pair display, colSpan=7 |
| `frontend/src/components/voice/mode-status-indicator.tsx` | Mode status badge | VERIFIED | Green/amber/red dot, i18n labels, role="status", aria-live="polite" |
| `frontend/src/components/voice/voice-session.tsx` | Auto-mode + fallback chain | VERIFIED | resolveMode function, hcpProfileId prop (no mode prop), fallback with toast warnings |
| `frontend/src/components/voice/voice-session-header.tsx` | Header with ModeStatusIndicator | VERIFIED | currentMode/initialMode props (no mode prop), ModeStatusIndicator rendered |
| `frontend/src/hooks/use-voice-live.ts` | Per-HCP session config | VERIFIED | Uses tokenData.voice_temperature, turn_detection_type, noise_suppression, avatar_style |
| `frontend/src/pages/user/voice-session.tsx` | Page passes hcpProfileId | VERIFIED | `hcpProfileId={hcpProfileId}` from scenario |
| `backend/tests/test_voice_live_per_hcp.py` | Per-HCP token broker tests | VERIFIED | 8 tests covering per-HCP sourcing, defaults, exception fallback, agent mode, schema |
| `backend/tests/test_hcp_profile_voice.py` | HCP CRUD voice field tests | VERIFIED | 10 tests covering create/update/get with voice/avatar fields and D-04 defaults |
| `backend/tests/test_agent_sync_service.py` | Agent instruction override tests | VERIFIED | 5 new tests for D-02 override (override, empty, whitespace, missing key, stripping) |
| `backend/scripts/seed_phase2.py` | Seed data with voice/avatar configs | VERIFIED | 5 HCP profiles with distinct voice_name (4 values), avatar_character (4 values) |
| `frontend/src/components/voice/voice-session.test.tsx` | Updated test for new props | FAILED | Still references old `mode` prop, 12 TS2353 errors |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `voice_live.py` (API) | `voice_live_service.py` | `hcp_profile_id` pass-through | WIRED | Line 28: `hcp_profile_id=hcp_profile_id` |
| `voice_live_service.py` | `hcp_profile.py` (model) | Lazy import hcp_profile_service | WIRED | Lines 83-86: `from app.services import hcp_profile_service; profile = await hcp_profile_service.get_hcp_profile(db, hcp_profile_id)` |
| `hcp-profile-editor.tsx` | `voice-avatar-tab.tsx` | Import and render in TabsContent | WIRED | Line 34: import, Line 494: `<VoiceAvatarTab form={form} />` |
| `hcp-profile-editor.tsx` | `agent-tab.tsx` | Import and render in TabsContent | WIRED | Line 35: import, Line 499: `<AgentTab ...>` |
| `voice-live.ts` (API) | Backend POST /voice-live/token | hcp_profile_id query param | WIRED | `params = hcpProfileId ? { hcp_profile_id: hcpProfileId } : {}` |
| `voice-session-page.tsx` | `voice-session.tsx` | hcpProfileId prop | WIRED | Line 46: `hcpProfileId={hcpProfileId}` |
| `voice-session.tsx` | `use-voice-token.ts` | `mutateAsync(hcpProfileId)` | WIRED | Line 173: `tokenMutation.mutateAsync(hcpProfileId)` |
| `use-voice-live.ts` | VoiceLiveToken per-HCP fields | Session config from tokenData | WIRED | `tokenData.voice_temperature`, `tokenData.turn_detection_type`, `tokenData.noise_suppression`, `tokenData.avatar_style` confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `voice-avatar-tab.tsx` | form (UseFormReturn) | Parent `hcp-profile-editor.tsx` react-hook-form | Yes - populated from HCP profile API response via useQuery | FLOWING |
| `agent-tab.tsx` | form + profile | Parent form + useQuery HCP profile | Yes - profile from API, form from react-hook-form | FLOWING |
| `mode-status-indicator.tsx` | currentMode, initialMode, connectionState | Props from voice-session.tsx state | Yes - derived from token broker response via resolveMode() | FLOWING |
| `hcp-table.tsx` | profile.voice_name, avatar_character | HCP profiles from useHcpProfiles query | Yes - DB-backed via API | FLOWING |
| `voice-session.tsx` | tokenData | tokenMutation.mutateAsync(hcpProfileId) | Yes - token broker API call | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Agent instructions override returns override text | `build_agent_instructions({'agent_instructions_override':'Custom'})` | `'Custom'` | PASS |
| Agent instructions empty override returns template | `build_agent_instructions({'name':'Dr.Z','specialty':'Onc','agent_instructions_override':''})` | Contains 'Dr.Z' | PASS |
| HcpProfileCreate smart defaults | `HcpProfileCreate(name='test',specialty='Onc',created_by='x').voice_name` | `'en-US-AvaNeural'` | PASS |
| VoiceLiveTokenResponse defaults | `VoiceLiveTokenResponse(...).avatar_style` | `'casual'` | PASS |
| Backend ruff check on production files | `ruff check app/models/hcp_profile.py ...` | All checks passed | PASS |
| Frontend Vite build | `npx vite build` | Built in 4.01s, dist/ output generated | PASS |
| Frontend tsc -b | `npx tsc -b --noEmit` | 12 errors in voice-session.test.tsx | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VOICE-12-01 | 12-01 | Per-HCP digital persona model (voice/avatar columns) | SATISFIED | 13 columns on HcpProfile model with ORM + Pydantic + migration |
| VOICE-12-02 | 12-01 | Token broker per-HCP wiring | SATISFIED | voice_live_service sources all fields from HCP profile |
| VOICE-12-03 | 12-02 | Admin tabbed HCP editor with Voice & Avatar tab | SATISFIED | 3-tab layout with VoiceAvatarTab and AgentTab components |
| VOICE-12-04 | 12-03 | Auto-mode resolution (no manual mode picker) | SATISFIED | resolveMode() function, hcpProfileId prop replaces mode |
| VOICE-12-05 | 12-02 | HCP table Voice+Avatar column, i18n | SATISFIED | Badge pair display, 21+ i18n keys in both locales |
| VOICE-12-06 | 12-03 | Fallback chain with toast notifications and ModeStatusIndicator | SATISFIED | 3-level fallback with toast.warning, green/amber/red indicator |

**Note:** VOICE-12-01 through VOICE-12-06 are referenced in ROADMAP.md but NOT defined in REQUIREMENTS.md. They appear to be phase-specific IDs that were never formally added to the requirements document.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `voice-session.test.tsx` | 277, 325, etc. | References removed `mode` prop (12 TS errors) | Warning | Test file broken, `tsc -b` fails. Production Vite build unaffected. |
| `voice_live_service.py` | 105-106 | `except Exception: pass` (silent fallback) | Info | Intentional design: falls back to defaults when HCP profile lookup fails. Prevents service outage from profile issues. |

### Human Verification Required

### 1. HCP Editor Tab Navigation

**Test:** Open HCP editor, fill in Profile tab fields, switch to Voice & Avatar tab, configure voice/avatar settings, switch to Agent tab, verify override textarea works, switch back to Profile tab.
**Expected:** All form data persists across tab switches. No data loss.
**Why human:** Cross-tab form state persistence requires interactive browser testing.

### 2. Avatar Character-Style Dynamic Filtering

**Test:** In Voice & Avatar tab, change avatar character dropdown from "lori" to "lisa". Check if style dropdown options update dynamically.
**Expected:** Style options change to lisa-specific styles (casual-sitting, graceful-sitting, etc.). Previously selected style resets to first available.
**Why human:** Dynamic dropdown filtering requires visual interaction.

### 3. ModeStatusIndicator Visual States

**Test:** Start a voice session, observe the ModeStatusIndicator badge color and text during connection, degradation (if simulated), and disconnection.
**Expected:** Green dot + "Connected" when at optimal mode, amber dot + "Degraded" when fallen back, red dot + "Disconnected" on error.
**Why human:** Real-time visual state changes during live WebSocket/Avatar connections.

### 4. Fallback Chain Toast Notifications

**Test:** Start a voice session where avatar service is unavailable but voice works. Then start one where voice is also unavailable.
**Expected:** First scenario: toast warning "Avatar unavailable, switching to voice mode". Second: toast warning "Voice unavailable, switching to text mode".
**Why human:** Requires simulating service unavailability with real Azure connections.

### 5. HCP Table Voice & Avatar Column

**Test:** View HCP list page with multiple profiles that have different voice/avatar configurations.
**Expected:** Badge pairs show short voice label (e.g., "Ava", "Yunxi") and avatar character-style (e.g., "lori-casual"). Profiles without config show "Not configured".
**Why human:** Visual layout, badge rendering, and label formatting need visual confirmation.

### Gaps Summary

The phase goal is substantially achieved. All 8 observable truths are verified in production code:

1. **Per-HCP digital persona model:** 13 voice/avatar columns with Alembic migration, ORM model, Pydantic schemas -- all verified.
2. **Token broker per-HCP wiring:** All fields sourced from HCP profile, with fallback to defaults -- verified with behavioral spot-checks.
3. **Admin UI:** Tabbed HCP editor (3 tabs), VoiceAvatarTab (8 controls), AgentTab (status + instructions), HCP table Voice+Avatar column -- all verified.
4. **Auto-mode + fallback chain:** resolveMode function, 3-level fallback with toast warnings, ModeStatusIndicator with green/amber/red dots -- all verified.
5. **i18n:** 21+ admin keys and 5 voice keys in both en-US and zh-CN -- verified.
6. **Backend tests:** 23 new tests (8 token broker, 10 HCP CRUD, 5 agent override) -- verified.
7. **Seed data:** 5 HCP profiles with distinct voice/avatar configurations -- verified.

**One gap remains:**

`voice-session.test.tsx` still references the removed `mode` prop from the pre-Phase 12-03 VoiceSessionProps interface. This produces 12 TypeScript compilation errors that cause `tsc -b` to fail. The Vite production build succeeds (it does not type-check test files), so this does not block deployment or runtime functionality. However, it prevents a clean full-project type check and means these test assertions are not runnable until fixed.

---

_Verified: 2026-04-02T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
