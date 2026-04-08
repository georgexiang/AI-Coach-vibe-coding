# Phase 16 Reviews — Voice Live Refactor

**Generated:** 2026-04-08
**Reviewers:** Codex (gpt-5.3-codex)

---

## Codex Review (gpt-5.3-codex)

### Plan 16-01: Frontend Voice Live Modularization
**Score:** 4/5

**Strengths:**
- Clear extraction targets and good separation (`utils`, `hook`, `component`, `constants`).
- Success criteria are mostly concrete (shared usage + build pass).
- Reduces duplication in the highest-impact frontend paths.

**Concerns:**
- `DEFAULT_VL_INSTANCE_FORM` as a shared object can introduce mutation bugs if any consumer mutates it.
- Lifecycle hook extraction can regress behavior if `startSession/stopSession` are not idempotent (double-click start, unmount during connect, reconnect after failure).
- `encodePcmToBase64` needs explicit clipping and invalid-value handling to avoid audio artifacts.
- Build checks alone do not prove parity of runtime behavior.

**Suggestions:**
- Export `createDefaultVlInstanceForm()` instead of a mutable shared object.
- Define lifecycle contract explicitly: reentrancy guard, cleanup order, unmount cancellation, and error propagation.
- Add unit tests for PCM conversion edge values and hook integration tests with mocked media + websocket client.
- Add one smoke E2E for both `voice-session` and `voice-test-playground` to validate unchanged behavior.

---

### Plan 16-02: Backend Dual-Mode WebSocket + Agent Mode Support
**Score:** 3/5

**Strengths:**
- Dual-mode architecture is correct for progressive rollout.
- Fallback path and degraded-mode event are good resilience patterns.
- Token broker pre-check is a good place to centralize capability signals.

**Concerns:**
- `azure-ai-voicelive>=1.2.0b5` is too loose for a beta SDK; future beta changes could break behavior unexpectedly.
- Fallback policy is underspecified: some failures should not silently degrade (e.g., auth/config errors).
- Pre-check criteria (`synced` + `agent_id`) may still be insufficient if `agent_name/project_name` are missing or stale.
- Removing API version hardcode without observability can make behavior drift hard to diagnose.

**Suggestions:**
- Pin to an exact tested beta (`==1.2.0b5`) or bounded range (`>=1.2.0b5,<1.3.0`).
- Define deterministic mode selection precedence and fallback matrix (which error classes trigger fallback).
- Emit structured telemetry for connect attempts: selected mode, fallback reason, final mode, latency.
- Include `voice_live_agent_mode_enabled` in pre-check logic and response so UI/backend decisions are consistent.
- Add contract tests for token broker response shape (backward compatibility).

---

### Plan 16-03: Voice Live Config Sync to AI Foundry Agent
**Score:** 3/5

**Strengths:**
- Correctly targets root cause: config source mismatch (`resolve_voice_config()` vs inline fields).
- Resync triggers on update and assignment lifecycle events are the right integration points.
- Expands metadata to include avatar and instance-specific fields.

**Concerns:**
- Fan-out resync after instance update can be expensive and failure-prone if done inline in request path.
- Unassign behavior is ambiguous: must ensure stale agent metadata is removed, not just left as previous values.
- Metadata schema growth without versioning can break downstream consumers or make debugging difficult.
- Partial-failure handling and retry semantics are not defined.

**Suggestions:**
- Move resync to background jobs with idempotency keys and retry/backoff.
- Add metadata schema version (e.g., `voice_live_metadata_version`) and explicit clear-on-unassign behavior.
- Sync only changed fields when possible, but ensure stale fields are explicitly nulled/removed.
- Add tests for bulk-update fan-out, unassign-clears-metadata, and failure recovery paths.

---

### Plan 16-04: Full Test Coverage + Build Verification
**Score:** 3/5

**Strengths:**
- Good intent: includes unit/integration/build/manual verification.
- Calls out both frontend and backend verification, not just one side.

**Concerns:**
- Too high-level; lacks explicit test matrix and pass/fail thresholds.
- "Human verification checkpoint" is not actionable without a checklist.
- No mention of mocking strategy for external Azure dependencies (risk of flaky CI).

**Suggestions:**
- Define required CI gates explicitly: commands, minimum coverage, and blocking conditions.
- Add a scenario matrix covering: model-only, agent-only, agent-fallback, vl_instance test mode, assign/unassign, instance update fan-out.
- Provide a concrete manual checklist for AI Foundry Portal fields (voice + avatar + updated timestamps).
- Add one end-to-end websocket smoke test with a deterministic fake/stub backend.

---

### Overall Assessment
**Overall Score:** 3.25/5

**Key Risks:**
1. Beta SDK version drift and unclear fallback policy in Plan 16-02
2. Resync fan-out and stale metadata handling in Plan 16-03
3. Runtime parity risk from frontend lifecycle refactor in Plan 16-01
4. Insufficiently concrete verification plan in Plan 16-04

**Recommended Changes (Priority Order):**
1. **Tighten Plan 16-02 first**: exact SDK pin, mode decision table, fallback matrix, and telemetry schema
2. **Implement Plan 16-03 with async idempotent resync jobs** and explicit metadata clear/versioning
3. **In Plan 16-01**, enforce lifecycle idempotency and replace mutable default constants with factory functions
4. **Rewrite Plan 16-04** into a concrete test matrix with explicit CI/manual acceptance gates

---

## Owner Decisions (2026-04-08)

| # | Codex Suggestion | Owner Decision | Rationale |
|---|-----------------|----------------|-----------|
| 1 | Pin SDK to `>=1.2.0b5,<1.3.0` | **Rejected** — keep `>=1.2.0b5` | Need to auto-adopt stable releases (1.2.0+) when available |
| 2 | Define fallback matrix (Agent→Model) | **Rejected** — remove fallback entirely | Agent连接失败直接报错，不做静默降级。两种模式行为完全不同，降级会误导用户 |
| 3 | Move resync to background jobs | **Under consideration** | 如果绑定HCP数量少，同步做也可接受 |
| 4 | Clear stale metadata on unassign | **Accepted** — 解绑后清空Agent voice/avatar配置 | 解绑=清空，Agent回到空白voice状态 |

## Accepted Actionable Items

| # | Plan | Action | Priority |
|---|------|--------|----------|
| 1 | 16-02 | **Remove** Agent→Model fallback; Agent connect failure = error response to frontend | High |
| 2 | 16-03 | Unassign triggers Agent voice/avatar metadata **clear** (not just leave stale) | High |
| 3 | 16-03 | Evaluate async resync for VL Instance update fan-out during execution | Medium |
| 4 | 16-01 | Replace `DEFAULT_VL_INSTANCE_FORM` with factory function `createDefaultVlInstanceForm()` | Medium |
| 5 | 16-01 | Add reentrancy guard + unmount cancellation to lifecycle hook | Medium |
| 6 | 16-04 | Create concrete test scenario matrix | Medium |
