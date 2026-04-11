---
phase: 19
reviewers: [codex]
reviewed_at: 2026-04-11T21:00:00Z
plans_reviewed: [19-01-PLAN.md, 19-02-PLAN.md, 19-03-PLAN.md, 19-04-PLAN.md, 19-05-PLAN.md, 19-06-PLAN.md, 19-07-PLAN.md]
---

# Cross-AI Plan Review — Phase 19

## Codex Review

### Plan 19-01 (Backend Data Foundation)

**Summary**  
Strong foundation plan with correct core entities and lifecycle intent, but it under-specifies data invariants, storage strategy, and security controls that will affect every later wave.

**Strengths**
- Clear domain split into `Skill`, `SkillVersion`, `SkillResource`.
- Early lifecycle state machine design reduces ad-hoc transitions later.
- Includes migration + schema + API in one wave, which is delivery-efficient.
- Starts security thinking early (whitelist, path sanitization, admin-only).

**Concerns**
- [HIGH] State transitions are not fully defined/enforced (especially `failed`, republish, archive/unarchive paths).
- [HIGH] Versioning invariants are missing (single published version, immutable published snapshots, optimistic locking).
- [MEDIUM] Search/filter scalability risks without explicit DB indexes and pagination contract.
- [MEDIUM] File security controls are incomplete (MIME sniffing, size limits, malware scanning, storage isolation).
- [LOW] `pdfplumber/python-pptx` dependency install in Wave 1 is likely scope bleed from Wave 2.

**Suggestions**
- Define a strict transition matrix and enforce in service + DB constraints.
- Add versioning constraints (e.g., one published version per skill via partial unique index).
- Introduce storage abstraction now (prefer Azure Blob + signed access patterns).
- Add audit columns (`created_by`, `updated_by`, timestamps, optional soft delete).
- Lock list API contract now: pagination, sorting, filtering fields for Skill Hub.

**Risk Assessment**  
**MEDIUM** — Solid baseline, but missing invariants/security details can cause rework in Waves 2–6.

---

### Plan 19-02 (Material-to-Skill Conversion)

**Summary**  
Functionally aligned with phase goals, but the async/job architecture is the main risk: `asyncio.create_task` is not durable enough for production multi-instance systems.

**Strengths**
- Supports all required document formats.
- Good extraction strategy (`unify → chunk → extract → merge/dedup`).
- Includes retry and polling, matching D-04/D-08.
- Structured JSON extraction is a good fit for downstream validation.

**Concerns**
- [HIGH] `asyncio.create_task` in API workers is non-durable (task loss on restart/deploy, weak horizontal scaling story).
- [HIGH] 80K token default chunk size is cost/latency heavy and may exceed practical model limits.
- [MEDIUM] Extraction edge cases not addressed (scanned PDFs, encrypted files, malformed docs, tables/images).
- [MEDIUM] Retry/idempotency race conditions can overwrite statuses/results.
- [MEDIUM] Prompt-injection risk from uploaded content is not explicitly mitigated.

**Suggestions**
- Move to durable background processing (queue + worker pattern).
- Add conversion job table with idempotency keys, locking, and attempt history.
- Use dynamic chunk sizing by model limits; store per-chunk diagnostics for debugging.
- Define unsupported-file handling and OCR fallback policy explicitly.
- Harden prompts and output validation with strict schema + sanitization.

**Risk Assessment**  
**HIGH** — Core business value depends on this; current async design is fragile for production reliability.

---

### Plan 19-03 (Quality Gates)

**Summary**  
Good conceptual separation of L1/L2 and publish policy, but the plan needs stronger consistency guarantees and calibration strategy to avoid noisy gating behavior.

**Strengths**
- L1 rule-based + L2 AI split is sensible and explainable.
- Six-dimension L2 model aligns with product requirements.
- Publish gate logic is clearly tied to thresholds.

**Concerns**
- [HIGH] Publish race conditions possible if L2 is pending/stale while publish is attempted.
- [MEDIUM] L2 thresholds lack calibration plan (inter-rater consistency, drift monitoring).
- [MEDIUM] L1 rules may be overly rigid across locales/products without configurability.
- [LOW] No explicit abuse controls (rate limits/cooldowns for repeated L2 runs).

**Suggestions**
- Bind evaluation results to immutable `skill_version_id` and enforce transactional gate checks on publish.
- Add calibration dataset + periodic human audit to tune thresholds.
- Make L1 rules configurable by locale/product line.
- Store per-dimension rationale text for reviewer transparency.

**Risk Assessment**  
**MEDIUM** — Gate concept is good, but consistency/calibration gaps can cause trust issues.

---

### Plan 19-04 (Frontend Data Layer + Skill Hub)

**Summary**  
Good coverage for the hub MVP and domain typing; primary risks are maintainability (too many hooks) and scalability/access control details.

**Strengths**
- Strong typing + query layer early reduces later UI churn.
- Hub features map well to success criteria (cards, badges, search/filter).
- i18n included from the start.

**Concerns**
- [MEDIUM] `15+` hooks without a query-key strategy can create cache invalidation bugs.
- [MEDIUM] Hub performance risk if backend pagination/sort contract is not finalized.
- [MEDIUM] Admin-only UX needs route guards plus server-side enforcement coordination.
- [LOW] `jszip` in Wave 2 appears premature.

**Suggestions**
- Define a query-key factory and mutation invalidation matrix.
- Enforce paginated APIs for hub lists before scaling data.
- Add RBAC route guards and explicit unauthorized states.
- Include accessibility checks for cards/filters/badges from first implementation.

**Risk Assessment**  
**LOW** — Reasonable plan; mostly execution hygiene and integration discipline needed.

---

### Plan 19-05 (Skill Editor)

**Summary**  
Feature-complete on paper, but this wave is overloaded and has a hard dependency mismatch that can block delivery.

**Strengths**
- Matches required 4-tab editor architecture.
- Covers core UX components (conversion progress, quality visualization, publish dialog).
- Includes dual-mode SOP editing, aligned with D-09.

**Concerns**
- [HIGH] Dependency mismatch: AI feedback regeneration UI is planned here, but backend endpoint is planned in 19-07.
- [HIGH] Scope concentration is high (many complex components in one wave).
- [MEDIUM] Dual-mode editing lacks conflict/merge/versioning behavior design.
- [MEDIUM] Markdown rendering path needs explicit XSS sanitization.
- [LOW] VSCode-like keyboard tree may be over-engineered for initial release.

**Suggestions**
- Split into MVP editor first (Content + Quality + basic Resources), advanced interactions later.
- Move regeneration endpoint to Wave 4 or defer related UI.
- Add autosave + optimistic locking + unsaved-change recovery policy.
- Sanitize markdown and define preview security policy explicitly.

**Risk Assessment**  
**HIGH** — Most likely schedule slip point; dependency/order issue should be corrected immediately.

---

### Plan 19-06 (Scenario-Skill Integration)

**Summary**  
Critical integration plan with good touchpoints, but currently has major model-consistency and runtime security risks.

**Strengths**
- Correctly identifies all integration surfaces (DB, prompt builder, sync service, scenario editor).
- Includes operational trigger (re-sync on assignment change).
- Aligns with "inject SOP into agent" goal.

**Concerns**
- [HIGH] Data model may violate D-21 one-to-one (simple `skill_id` FK usually allows many scenarios per skill).
- [HIGH] "Published-only" constraint appears UI-driven; must be enforced server-side.
- [HIGH] `subprocess.run(timeout=30)` for scripts is high-risk without sandbox/resource controls.
- [MEDIUM] Scenario should reference `skill_version_id` for deterministic agent behavior.
- [MEDIUM] Re-sync storms possible on frequent edits/assignments.

**Suggestions**
- Reconcile D-21 explicitly with DB constraints (or revise decision intentionally).
- Enforce publish/archived constraints in backend assignment APIs.
- Sandbox script execution: no shell, allowlist paths, CPU/memory/time limits, isolated runtime.
- Pin scenario to immutable `skill_version_id`; publish new version should require explicit reassignment.
- Queue/debounce agent sync jobs.

**Risk Assessment**  
**HIGH** — Data integrity + execution security issues are critical.

---

### Plan 19-07 (ZIP Import/Export, Tests, Verification)

**Summary**  
Necessary closing wave, but security hardening and validation details are underpowered for ZIP ingestion; testing strategy should start earlier than this wave.

**Strengths**
- Covers interoperability requirement (agentskills.io package format).
- Includes explicit import security mention (path traversal).
- Adds broad backend test target and verification checkpoint.

**Concerns**
- [HIGH] ZIP import security not complete (zip bombs, symlinks, oversized files, unsafe script payloads).
- [MEDIUM] Conflict behavior unspecified (duplicate names, versions, existing skills).
- [MEDIUM] Testing concentrated too late; defects will surface after most implementation is done.
- [MEDIUM] "25+ tests" may miss concurrency/retry/i18n/regression paths.
- [LOW] Human verification checkpoint lacks measurable acceptance criteria.

**Suggestions**
- Add strict manifest/schema validation and hard limits (file count, total size, depth).
- Never auto-execute imported scripts; treat as inert artifacts unless explicitly approved.
- Define deterministic import conflict policy (reject, overwrite, new version, rename).
- Shift tests left: minimum test suites per wave with CI gates.
- Add end-to-end happy path + failure path tests across conversion→quality→publish→assignment.

**Risk Assessment**  
**HIGH** — Import boundary is a major security surface; current detail level is insufficient.

---

## Consensus Summary

*Single reviewer (Codex) — consensus analysis requires 2+ reviewers.*

### Key Strengths (Codex)
- Well-structured domain model with clear entity separation (Skill, SkillVersion, SkillResource)
- Strong alignment between plans and phase decisions (D-01 through D-27)
- Good wave dependency ordering for most plans
- Security thinking present from Wave 1

### Top Concerns (by frequency)
1. **Async architecture fragility** — `asyncio.create_task` is not durable for production (Plans 02, 03)
2. **Dependency mismatch** — AI regeneration backend (Plan 07) needed by frontend editor (Plan 05) (Plans 05, 07)
3. **Security gaps** — ZIP import (bombs, symlinks), script execution (no sandbox), file upload (incomplete controls) (Plans 01, 06, 07)
4. **Version/integrity modeling** — Missing version pinning in Scenario-Skill association, publish race conditions (Plans 03, 06)
5. **Scope overload** — Plan 05 (Skill Editor) packs too many complex components into one wave

### Risk Summary by Plan

| Plan | Risk | Key Issue |
|------|------|-----------|
| 19-01 | MEDIUM | Missing versioning invariants |
| 19-02 | HIGH | Fragile async architecture |
| 19-03 | MEDIUM | Publish race conditions |
| 19-04 | LOW | Hook cache strategy |
| 19-05 | HIGH | Dependency mismatch + scope overload |
| 19-06 | HIGH | D-21 constraint + script execution security |
| 19-07 | HIGH | ZIP import security gaps |

### Recommended Priority Fixes
1. Replace `asyncio.create_task` with durable job processing before Wave 2
2. Fix dependency order: move AI regeneration endpoint from Plan 07 to Plan 02 or 03
3. Strengthen ZIP/script/resource security model comprehensively
4. Pin Scenario to `skill_version_id` for deterministic behavior
5. Split Plan 05 into MVP editor + advanced interactions
