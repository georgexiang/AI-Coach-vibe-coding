---
phase: 15-hcp-editor-agent-config-center
verified: 2026-04-07T10:15:00Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "Open HCP editor, verify only 2 tabs (Profile, Voice & Avatar), then click Voice & Avatar tab and verify two-panel layout with left config panel and right Playground preview"
    expected: "Left panel shows Model Deployment, Voice Mode toggle, VL Instance selector, Instructions section with magic wand, Knowledge & Tools collapsible. Right panel shows avatar/orb area, Start button, transcript area."
    why_human: "Visual layout verification cannot be done programmatically -- need to confirm responsive grid, component alignment, and overall UX matches Azure AI Foundry style"
  - test: "Click magic wand button in Instructions section on an existing HCP profile"
    expected: "Auto-generated instructions appear in the preview area containing the profile name and specialty"
    why_human: "End-to-end flow through backend endpoint requires running server and human observation"
  - test: "Toggle Voice Mode switch ON/OFF and verify VL Instance selector appears/disappears"
    expected: "Switch controls visibility of VL Instance selector section"
    why_human: "Interactive toggle behavior requires visual confirmation"
  - test: "Switch between Profile and Voice & Avatar tabs multiple times"
    expected: "Form data persists across tab switches (values entered on one tab remain when switching back)"
    why_human: "State persistence across UI interactions needs human observation"
  - test: "Switch language to zh-CN and verify all new labels display in Chinese"
    expected: "All Phase 15 labels (Model Deployment, Voice Mode, Playground, Instructions, etc.) show Chinese translations"
    why_human: "i18n rendering quality and completeness requires visual inspection"
  - test: "Navigate to a URL with legacy tab ID (e.g. ?tab=knowledge) and verify graceful fallback"
    expected: "Falls back to Profile tab without errors"
    why_human: "URL-based navigation testing requires browser interaction"
---

# Phase 15: HCP Editor Agent Config Center Verification Report

**Phase Goal:** Refactor HCP editor to Agent Config Center aligned with Azure AI Foundry Agent editing experience. Remove empty Knowledge/Tools tabs, upgrade Voice & Avatar tab to full Agent config layout: Model Deployment selector, Voice Mode toggle + VL Instance binding, auto-generated + editable override Instructions, right-side Playground preview panel (digital human/audio orb + Start test).

**Verified:** 2026-04-07T10:15:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | HCP editor has only Profile and Voice & Avatar tabs (Knowledge/Tools removed) | VERIFIED | `hcp-profile-editor.tsx` has exactly 2 `<TabsTrigger>` (profile, voice-avatar), 2 `<TabsContent>`. No `value="knowledge"` or `value="tools"`. No `BookOpen` or `Wrench` imports. VALID_TABS fallback set at line 116. |
| 2 | Voice & Avatar tab left panel: Model Deployment + Voice Mode toggle + VL Instance + Instructions | VERIFIED | `agent-config-left-panel.tsx` (294 lines) contains VoiceLiveModelSelect, Switch for Voice Mode, Select for VL Instance with assign/unassign mutation hooks, InstructionsSection composition, Knowledge & Tools collapsible skeleton. |
| 3 | Voice & Avatar tab right panel: Playground preview with avatar/orb + Start + transcript | VERIFIED | `playground-preview-panel.tsx` (302 lines) contains AvatarView/AudioOrb conditional rendering, Start/Stop buttons with session state machine (idle/connecting/connected/error/stopping), transcript area with role="log" aria-live="polite", MAX_TRANSCRIPTS=100 cap. |
| 4 | Instructions magic wand calls build_agent_instructions to regenerate | VERIFIED | `instructions-section.tsx` contains Wand2 button calling `previewInstructions` API -> backend POST `/preview-instructions` -> `build_agent_instructions`. AbortController race guard confirmed. Override precedence verified: non-empty override returns directly, empty triggers auto-generation. |
| 5 | Frontend + backend tests, i18n (en-US + zh-CN), TypeScript compilation | VERIFIED | 9 backend tests (TestPreviewInstructionsEndpoint 6 + TestToPromptDictOverride 2 + TestPreviewInstructionsRouteOrder 1). 11 frontend structural tests. 19 Phase 15 i18n keys present in both locales. generate/regenerate keys in common.json for both locales. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/api/hcp_profiles.py` | POST /preview-instructions endpoint | VERIFIED | Lines 164-205: InstructionsPreviewRequest, InstructionsPreviewResponse models + endpoint with require_role("admin") and build_agent_instructions call |
| `backend/app/models/hcp_profile.py` | to_prompt_dict includes agent_instructions_override | VERIFIED | Line 100: `"agent_instructions_override": self.agent_instructions_override` in return dict |
| `frontend/src/components/admin/agent-config-left-panel.tsx` | AgentConfigLeftPanel component | VERIFIED | 294 lines, exports AgentConfigLeftPanel with Model Deployment, Voice Mode, VL Instance assign/unassign (migrated from voice-avatar-tab.tsx), InstructionsSection, Knowledge & Tools |
| `frontend/src/components/admin/instructions-section.tsx` | InstructionsSection with AbortController | VERIFIED | 153 lines, abortControllerRef, handleGenerate with abort/recreate pattern, Wand2 button, auto-gen preview + override textarea |
| `frontend/src/components/admin/playground-preview-panel.tsx` | PlaygroundPreviewPanel with session state machine | VERIFIED | 302 lines, SessionState type, useVoiceLive/useAvatarStream/useAudioHandler/useAudioPlayer hooks, NotAllowedError mic permission handling, unmount cleanup useEffect, profile change cleanup useEffect |
| `frontend/src/components/admin/voice-avatar-tab.tsx` | Two-panel grid layout | VERIFIED | 34 lines, thin composition: grid grid-cols-1 lg:grid-cols-2 gap-6 composing AgentConfigLeftPanel + PlaygroundPreviewPanel |
| `frontend/src/pages/admin/hcp-profile-editor.tsx` | 2 tabs only, legacy fallback | VERIFIED | 545 lines, VALID_TABS Set, handleTabChange fallback, Form wraps Tabs (line 284 before 285), no BookOpen/Wrench imports |
| `backend/tests/test_hcp_profiles_api.py` | Tests for preview-instructions | VERIFIED | TestPreviewInstructionsEndpoint (6 tests), TestToPromptDictOverride (2 tests), TestPreviewInstructionsRouteOrder (1 test) |
| `frontend/src/__tests__/hcp-editor-tabs.test.tsx` | Frontend structural tests | VERIFIED | 181 lines, 11 tests covering i18n parity, tab structure, lifecycle safeguards, AbortController |
| `frontend/src/api/hcp-profiles.ts` | previewInstructions with AbortSignal | VERIFIED | Lines 117-127: previewInstructions function with signal?: AbortSignal parameter |
| `frontend/src/hooks/use-hcp-profiles.ts` | usePreviewInstructions hook | VERIFIED | Line 85: usePreviewInstructions mutation hook |
| `frontend/public/locales/en-US/admin.json` | Phase 15 i18n keys | VERIFIED | 19 keys present (modelDeployment, playgroundTitle, permissionDeniedMic, etc.) |
| `frontend/public/locales/zh-CN/admin.json` | Phase 15 i18n keys (Chinese) | VERIFIED | 19 keys present with Chinese translations |
| `frontend/public/locales/en-US/common.json` | generate/regenerate keys | VERIFIED | Lines 55-56: generate, regenerate |
| `frontend/public/locales/zh-CN/common.json` | generate/regenerate keys (Chinese) | VERIFIED | Lines 55-56: Chinese translations |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| voice-avatar-tab.tsx | agent-config-left-panel.tsx | import AgentConfigLeftPanel | WIRED | Line 2: import, Line 18: JSX usage in grid left cell |
| voice-avatar-tab.tsx | playground-preview-panel.tsx | import PlaygroundPreviewPanel | WIRED | Line 3: import, Line 22-29: JSX usage in grid right cell with form.watch props |
| agent-config-left-panel.tsx | instructions-section.tsx | import InstructionsSection | WIRED | Line 35: import, Line 225-229: JSX composition with form, profileId, isNew props |
| instructions-section.tsx | /api/v1/hcp-profiles/preview-instructions | previewInstructions API call with AbortController | WIRED | Line 15: import previewInstructions, Line 42+70: called with form.getValues() and controller.signal |
| hcp_profiles.py | agent_sync_service.py | build_agent_instructions import | WIRED | Line 199: inline import, Line 202: called with body.model_dump() |
| agent-config-left-panel.tsx | use-voice-live-instances.ts | assign/unassign VL instance hooks | WIRED | Lines 36-40: import useVoiceLiveInstances, useAssignVoiceLiveInstance, useUnassignVoiceLiveInstance; Lines 73-115: handleInstanceChange + handleConfirmRemove logic |
| hcp-profile-editor.tsx | voice-avatar-tab.tsx | VoiceAvatarTab composition | WIRED | Line 34: import, Line 525: JSX usage in TabsContent |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| instructions-section.tsx | autoInstructions | previewInstructions API -> build_agent_instructions | Yes -- calls backend endpoint that runs template generation | FLOWING |
| agent-config-left-panel.tsx | instances | useVoiceLiveInstances() | Yes -- fetches from /api/v1/voice-live-instances | FLOWING |
| playground-preview-panel.tsx | transcripts | onTranscript callback from useVoiceLive | Yes -- populated by WebSocket events during active session | FLOWING (when connected) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend import succeeds | `python3 -c "from app.api.hcp_profiles import router, InstructionsPreviewRequest, InstructionsPreviewResponse"` | All imports successful | PASS |
| InstructionsPreviewRequest model validates | `python3 -c "...InstructionsPreviewRequest(name='Test', specialty='Oncology')"` | Model created with correct values | PASS |
| to_prompt_dict includes override | `python3 -c "...HcpProfile(...).to_prompt_dict()"` | agent_instructions_override present in dict | PASS |
| Override precedence: override wins | `build_agent_instructions({..., agent_instructions_override: 'Custom'})` | Returns 'Custom override text' directly | PASS |
| Override precedence: empty triggers auto-gen | `build_agent_instructions({..., agent_instructions_override: ''})` | Returns text containing 'Dr. Test' and 'Oncology' | PASS |
| Route not shadowed | POST route order analysis | /preview-instructions at position 3, no bare POST /{profile_id} before it | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| HCP-15-01 | 15-02 | HCP editor has only Profile and Voice & Avatar tabs (Knowledge/Tools removed) | SATISFIED | hcp-profile-editor.tsx: 2 TabsTrigger, 2 TabsContent, no knowledge/tools values |
| HCP-15-02 | 15-01 | Voice & Avatar tab left panel: Model Deployment + Voice Mode toggle + VL Instance + Instructions | SATISFIED | agent-config-left-panel.tsx: VoiceLiveModelSelect, Switch, Select + assign/unassign, InstructionsSection |
| HCP-15-03 | 15-02 | Voice & Avatar tab right panel: Playground preview with avatar/orb + Start + transcript | SATISFIED | playground-preview-panel.tsx: AvatarView/AudioOrb, Start/Stop, transcript area, session state machine |
| HCP-15-04 | 15-01 | Instructions magic wand button calls build_agent_instructions to regenerate | SATISFIED | instructions-section.tsx: Wand2 button -> previewInstructions API -> build_agent_instructions |
| HCP-15-05 | 15-01, 15-03 | Tests + i18n (en-US + zh-CN) + TypeScript compilation passes | SATISFIED | 9 backend + 11 frontend tests, 19+2 i18n keys in both locales, TypeScript compiles per summary |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| agent-config-left-panel.tsx | 252, 256 | `knowledgePlaceholder` / `toolsPlaceholder` i18n keys referencing "coming soon" text | Info | Intentional non-functional skeleton per phase scope. Knowledge & Tools deferred to future phases. Not a stub -- explicit placeholder with i18n. |

### Human Verification Required

### 1. Two-Panel Layout Visual Verification

**Test:** Open HCP editor, click Voice & Avatar tab, verify the two-panel responsive grid layout
**Expected:** Left panel shows Model Deployment, Voice Mode toggle, VL Instance selector, Instructions section, Knowledge & Tools. Right panel shows Playground with avatar/orb area, Start button, transcript.
**Why human:** Visual layout, responsive behavior, and UX alignment with Azure AI Foundry style cannot be verified programmatically

### 2. Magic Wand Instructions Generation

**Test:** Click magic wand button in Instructions section on an existing HCP profile
**Expected:** Auto-generated instructions appear in preview area containing profile name and specialty
**Why human:** End-to-end flow through backend endpoint requires running server and human observation

### 3. Voice Mode Toggle Interaction

**Test:** Toggle Voice Mode switch ON/OFF
**Expected:** VL Instance selector appears/disappears, form value cleared on toggle off
**Why human:** Interactive toggle behavior requires visual confirmation

### 4. Tab State Persistence

**Test:** Enter data on Profile tab, switch to Voice & Avatar, switch back
**Expected:** Form data persists across tab switches
**Why human:** State persistence across UI interactions needs human observation

### 5. i18n Chinese Translation Verification

**Test:** Switch language to zh-CN and navigate to HCP editor Voice & Avatar tab
**Expected:** All new labels display in Chinese (model deployment, voice mode, playground, etc.)
**Why human:** Translation quality and completeness requires visual inspection

### 6. Legacy Tab ID Fallback

**Test:** Navigate directly to HCP editor URL with ?tab=knowledge or ?tab=tools
**Expected:** Falls back to Profile tab without console errors
**Why human:** URL-based navigation testing requires browser interaction

### Gaps Summary

No code-level gaps found. All 5 observable truths verified with full artifact existence, substantive implementation, wiring, and data-flow confirmation. All 5 phase requirements (HCP-15-01 through HCP-15-05) satisfied.

6 items require human visual verification before the phase can be marked as fully passed -- all relate to interactive UI behavior and visual layout that cannot be assessed through static code analysis or programmatic checks.

---

_Verified: 2026-04-07T10:15:00Z_
_Verifier: Claude (gsd-verifier)_
