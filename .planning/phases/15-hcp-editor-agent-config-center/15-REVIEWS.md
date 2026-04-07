---
phase: 15
reviewers: [codex]
reviewed_at: 2026-04-07T20:00:00Z
plans_reviewed: [15-01-PLAN.md, 15-02-PLAN.md, 15-03-PLAN.md]
---

# Cross-AI Plan Review — Phase 15

## Codex Review

### Plan 15-01: Backend + Left Panel Components (Wave 1)

**Summary**
This is a strong foundation plan with good scoping for Wave 1: it addresses the key backend plumbing (`to_prompt_dict` + preview endpoint), introduces the core left-panel UI composition, and includes i18n/security from the start. The main risk is contract ambiguity (GET vs POST) and undefined behavior around generated vs override instructions, which can create integration churn later.

**Strengths**
- Scope is coherent and aligns with HCP-15-02 and HCP-15-04.
- FastAPI route ordering risk is explicitly identified and mitigated.
- Security thinking is present early (`require_role("admin")` + validation).
- Left panel decomposition (`AgentConfigLeftPanel`, `InstructionsSection`) supports reuse and cleaner Wave 2 integration.
- i18n is planned in both `en-US` and `zh-CN`, not deferred.

**Concerns**
- **[HIGH]** Endpoint contract mismatch: context says new **GET** preview endpoint, plan defines **POST** `/preview-instructions`.
- **[HIGH]** Instruction precedence is not specified when both auto-generated and override values exist.
- **[MEDIUM]** No explicit handling for concurrent magic-wand clicks (race/out-of-order responses).
- **[MEDIUM]** Missing UX/error states for preview generation failures/timeouts.
- **[LOW]** Knowledge/Tools collapsible in this wave may invite scope creep beyond "UI skeleton only."

**Suggestions**
- Freeze API contract now (method, path, payload, response) and align all plans/docs.
- Define deterministic precedence rule: `override` (non-empty) > generated; document empty-string behavior.
- Add mutation guard/cancel strategy for magic-wand regeneration.
- Add explicit error UI states (retry, fallback copy, disabled apply behavior).
- Mark Knowledge/Tools areas with clear "non-functional skeleton" acceptance criteria.

**Risk Assessment**
**MEDIUM** — technically sound, but contract and state semantics gaps can cause downstream rework.

---

### Plan 15-02: Playground Panel + Tab Restructuring (Wave 2)

**Summary**
This plan directly targets the phase goal and has the right architectural direction (reusing VL Instance Editor patterns, extracting a preview panel, and simplifying tab structure). It carries the highest delivery risk because it combines real-time media/session behavior with aggressive UI refactor (large component rewrite), where regressions are likely without stricter lifecycle and compatibility handling.

**Strengths**
- Strong requirement coverage for HCP-15-01 and HCP-15-03.
- Reuse of proven hooks/components reduces greenfield risk.
- Clear two-panel layout strategy with responsive breakpoint logic.
- Disabled Start conditions (`isNew` / no VL instance) are correctly anticipated.
- Threat model addresses websocket spoofing and click-spam concerns.

**Concerns**
- **[HIGH]** Rewriting `VoiceAvatarTab` from ~307 lines to ~35 lines risks dropping existing validation/state logic.
- **[HIGH]** No explicit lifecycle cleanup plan for sockets/media streams on unmount/tab switch/profile change.
- **[MEDIUM]** Error handling for mic/camera permissions and connection failures is not defined.
- **[MEDIUM]** Potential stale-config behavior if form values change during/after connection start.
- **[MEDIUM]** Removing tabs may break persisted tab IDs/deep links from older UI states.
- **[LOW]** Transcript growth/autoscroll behavior may create UX/performance issues over longer sessions.

**Suggestions**
- Use incremental refactor checkpoints (extract panel first, then tab pruning) instead of one-shot rewrite.
- Define a strict session state machine (`idle/connecting/connected/error/stopping`) and teardown rules.
- Add backward compatibility mapping for unknown legacy tab key -> `profile`.
- Cap transcript buffer and suspend auto-scroll when user scrolls upward.
- Define explicit empty/error states for right panel before Start and on failures.

**Risk Assessment**
**MEDIUM-HIGH** — achievable, but real-time + refactor coupling makes regression risk significant.

---

### Plan 15-03: Tests + Build Verification (Wave 3)

**Summary**
The verification plan is disciplined on backend regression and build hygiene, and the manual visual gate is valuable for UX validation. However, given this phase is frontend-heavy, the automated test coverage is unbalanced: key UI behavior risks are mostly untested in CI.

**Strengths**
- Good backend regression set for instructions generation and `to_prompt_dict`.
- Includes full compile/build checks (`pytest`, `tsc`, build).
- Manual 11-step visual gate is practical for layout/workflow confirmation.
- Explicitly checks default/empty input behaviors.

**Concerns**
- **[HIGH]** No frontend automated tests for critical behaviors (tab removal, wand flow, disabled Start states, persistence).
- **[MEDIUM]** No contract test for preview endpoint method/path and route-order conflict.
- **[MEDIUM]** No locale parity test ensuring new keys exist in both `en-US` and `zh-CN`.
- **[MEDIUM]** Manual checklist is non-repeatable and may miss regressions in later merges.
- **[LOW]** No lightweight performance smoke for repeated Start/Stop.

**Suggestions**
- Add frontend integration tests (RTL/Playwright) for:
  - exactly 2 tabs visible,
  - magic-wand regenerate success/failure,
  - Start disabled rules,
  - form state persistence across tab switches.
- Add API contract test covering auth + route resolution edge case.
- Add i18n key-parity script in CI.
- Keep manual checklist, but pair it with a minimal automated smoke suite.

**Risk Assessment**
**MEDIUM** — good baseline checks, but CI coverage is insufficient for the highest-risk frontend changes.

---

## Consensus Summary

*(Single reviewer — consensus analysis requires 2+ reviewers)*

### Key Concerns (Priority Order)

1. **API contract mismatch** (HIGH) — CONTEXT.md says GET, plans use POST. Must resolve before execution.
2. **VoiceAvatarTab rewrite regression risk** (HIGH) — 307→35 line rewrite may drop existing state/validation logic. Need incremental approach.
3. **WebSocket/media lifecycle cleanup** (HIGH) — No explicit teardown plan for tab switch/unmount/profile change.
4. **No frontend automated tests** (HIGH) — Frontend-heavy phase has zero automated UI tests in CI.
5. **Instruction precedence undefined** (HIGH) — When both override and auto-gen exist, which wins?
6. **Magic wand race conditions** (MEDIUM) — Concurrent clicks not handled.
7. **Mic/camera permission errors** (MEDIUM) — No UX for denied permissions.
8. **Legacy tab ID compatibility** (MEDIUM) — Deep links to removed tabs may break.
9. **i18n key parity** (MEDIUM) — No CI check for matching keys across locales.
10. **Transcript buffer growth** (LOW) — Long sessions may accumulate unbounded transcripts.

### Overall Delivery Risk

**MEDIUM** — The 3-wave structure is logical and mostly complete. Plans should achieve phase goals if contract alignment and frontend test coverage are tightened. Wave 2 regression risk and Wave 3 automation gaps are the main blockers to confident rollout.
