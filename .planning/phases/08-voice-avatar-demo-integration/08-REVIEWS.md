---
phase: 08
reviewers: [codex]
reviewed_at: 2026-03-27T23:50:00Z
plans_reviewed: [08-04-PLAN.md, 08-05-PLAN.md]
---

# Cross-AI Plan Review — Phase 08

## Codex Review

**Plan 08-04 (Integration Wiring)**
1. **Summary**  
Plan 08-04 is a solid end-to-end wiring pass: it propagates `mode` from UI to backend session creation and exposes `voice_live_enabled` from backend config to frontend rendering. It is well-scoped for Wave 1, but currently reads as transport-focused; the main risk is missing authoritative backend validation/gating for mode and feature-flag enforcement.

2. **Strengths**  
- Clear vertical slice: backend API → frontend API/types → UI tab entry.
- Good dependency fit with prior plans (01-03 already implemented infra/components).
- Feature flag propagation is explicitly included (backend + frontend context + UI gating).
- i18n updates are called out early, reducing UI regressions later.

3. **Concerns**  
- **HIGH:** No explicit backend validation for invalid `mode` values (e.g., typo/unknown mode).  
- **HIGH:** Voice feature appears UI-gated only; backend must also reject voice/avatar modes when `voice_live_enabled=false` (direct API callers can bypass UI).  
- **MEDIUM:** Backward compatibility/defaulting behavior for clients not sending `mode` is not specified.  
- **MEDIUM:** Frontend async config load edge case not addressed (tab flicker, stale selected tab when flag turns false).  
- **LOW:** No mention of audit/telemetry tagging by `mode` (important for rollout/debugging).

4. **Suggestions**  
- Define strict enum validation server-side (`default|voice|avatar`) and return `422` for invalid values.  
- Enforce feature flag server-side for mode selection (`403/409` when disabled).  
- Add deterministic defaulting (`mode=default` when omitted) in one canonical backend location.  
- Ensure frontend handles delayed config fetch safely (fallback tab + selected mode reset if hidden).  
- Add contract-level schema checks so backend/frontend stay aligned on field name and allowed values.

5. **Risk Assessment**  
**Overall risk: MEDIUM-HIGH.**  
The wiring likely works for happy paths, but without backend validation and flag enforcement, it is vulnerable to invalid inputs and feature bypass.

---

**Plan 08-05 (Comprehensive Tests)**
1. **Summary**  
Plan 08-05 has the right cross-layer intent and file targets for Wave 2, and it directly tests the core outputs of 08-04 (mode storage, feature flags, Voice tab behavior). However, it under-specifies negative and edge-path coverage, which are exactly where integration bugs and rollout risks usually occur.

2. **Strengths**  
- Good backend + frontend coverage split.
- Directly maps to must-haves (tab visibility, mode parameter, feature flag flow).
- Includes build verification, which helps catch TS/type drift after wiring changes.
- Logical dependency sequencing after 08-04.

3. **Concerns**  
- **HIGH:** Missing explicit tests for invalid/unsupported `mode` and omitted `mode`.  
- **HIGH:** Missing test that backend rejects `voice/avatar` mode when feature flag is off.  
- **MEDIUM:** No explicit config-propagation test from backend config API through frontend context into UI state transitions.  
- **MEDIUM:** Potential over-mocking risk; tests may pass without catching request payload/contract mismatches.  
- **LOW:** Coverage target is stated, but branch/path coverage around toggles may still be weak.

4. **Suggestions**  
- Add backend parameterized tests: `default`, `voice`, `avatar`, `invalid`, `None`.  
- Add backend authorization/feature tests: mode requested while disabled must fail predictably.  
- Add frontend tests for async config arrival and tab state correction when toggle changes.  
- Add request-contract assertions in frontend API tests to verify exact payload shape (`mode`).  
- Prefer branch coverage checks for flag/mode logic (not just line coverage).  
- Add one lightweight end-to-end smoke test (UI tab select → API call with mode).

5. **Risk Assessment**  
**Overall risk: MEDIUM.**  
The plan should validate primary behavior, but without negative-path tests it may miss the highest-impact defects.

---

**Phase Goal Fit (Both Plans Together)**  
These plans likely complete the **entry/wiring** part of Phase 08 and support PLAT-05, but full goal confidence for COACH-04/05/07 + EXT-04 depends on strict backend mode/flag enforcement and negative-path testing. The key gap to close is: “UI toggle” must become “platform policy,” verified by tests.

---

## Consensus Summary

*(Single reviewer — consensus not applicable)*

### Key Concerns (Priority Order)

1. **Backend mode validation missing (HIGH)** — No server-side enum validation for mode field; invalid values accepted silently
2. **Backend feature flag enforcement missing (HIGH)** — voice_live_enabled only gated in UI; backend should reject voice/avatar mode when flag is off
3. **Missing negative-path tests (HIGH)** — No tests for invalid mode, or mode requested while feature disabled
4. **Config propagation edge cases (MEDIUM)** — Frontend async config load could cause tab flicker

### Agreed Strengths

- Clear vertical slice from backend to frontend
- Good dependency ordering (Wave 1 wiring, Wave 2 tests)
- Feature flag propagation explicitly included across full stack
- i18n updates included early
