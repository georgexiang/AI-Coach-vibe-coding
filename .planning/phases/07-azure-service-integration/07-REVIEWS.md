---
phase: 07
reviewers: [codex]
reviewed_at: 2026-03-27T18:30:00Z
plans_reviewed: [07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md, 07-04-PLAN.md, 07-05-PLAN.md, 07-06-PLAN.md, 07-07-PLAN.md]
---

# Cross-AI Plan Review — Phase 07

## Codex Review

### Plan 07-01: Config Data Foundation (Wave 1)

**Summary**
This is a solid foundational plan and correctly prioritizes persistence, encryption, schema boundaries, and tests. It supports PLAT-03/ARCH-05 well, but it needs stronger definition of config scope, secret lifecycle, and operational controls (rotation/audit) to be production-safe.

**Strengths**
- Good layering: ORM + service + schema + migration + unit tests.
- Encryption orchestration in service layer is the right separation of concerns.
- Starts from persistence first, which unblocks all later waves.
- Includes dedicated test artifacts, not just implementation.

**Concerns**
- **[HIGH]** No key rotation/versioning strategy for Fernet-encrypted values.
- **[MEDIUM]** Scope uniqueness is unclear (service per env/region/tenant/deployment), risking duplicate/ambiguous configs.
- **[MEDIUM]** Secret redaction rules are not explicit for API responses/logging.
- **[LOW]** Migration/backward compatibility from env-based config is not described.

**Suggestions**
- Add encryption metadata (`key_id`, `encrypted_at`) and rotation playbook.
- Define and enforce a composite unique constraint for config scope.
- Make API key write-only in APIs; always return masked value.
- Add audit fields (`updated_by`, `updated_at`, `change_reason`) for admin changes.

**Risk Assessment:** MEDIUM

---

### Plan 07-02: Azure OpenAI Adapter (Wave 1)

**Summary**
The adapter plan is technically sound (streaming + async SDK + tests), but it risks overlap because an Azure OpenAI adapter already exists. The major gap is conversation history control (token budget/validation), which can create latency and cost regressions.

**Strengths**
- Streaming support aligns with coaching UX.
- Async client integration fits FastAPI async stack.
- Mocked unit tests reduce external dependency in CI.
- Adds multi-turn support via `conversation_history`.

**Concerns**
- **[HIGH]** Possible duplicate/rewrite of existing adapter instead of incremental extension.
- **[HIGH]** No token/window management strategy for `conversation_history`.
- **[MEDIUM]** History role/content validation is not explicit (prompt injection surface).
- **[MEDIUM]** Timeout/retry/cancellation/error mapping behavior not specified.

**Suggestions**
- Treat as delta update to existing adapter, not new parallel implementation.
- Add deterministic history truncation/summarization policy.
- Validate allowed roles/content sizes server-side.
- Standardize Azure error translation to domain errors with retry policy.

**Risk Assessment:** MEDIUM

---

### Plan 07-03: API & Integration Layer (Wave 2)

**Summary**
This plan is central and aligns directly to PLAT-03, but it carries the highest architectural and security risk. It needs explicit authz, endpoint safety, and multi-instance consistency rules for dynamic registration.

**Strengths**
- Correct endpoint set (`PUT`, `POST test`, `GET`) for admin workflow.
- Connection tester dispatch pattern is extensible.
- Dynamic registration on startup/save supports runtime flexibility.
- Integration tests are planned at API layer.

**Concerns**
- **[HIGH]** Admin-only authorization requirements are not explicitly called out.
- **[HIGH]** User-configured endpoints without strict validation create SSRF/exfiltration risk.
- **[HIGH]** Dynamic registration consistency across multiple app instances is unclear.
- **[MEDIUM]** Connection tests can be slow/flaky without strict timeout/rate limiting.
- **[MEDIUM]** No explicit audit trail of config changes and test attempts.

**Suggestions**
- Enforce RBAC + admin scopes on all service-config endpoints.
- Whitelist Azure host patterns and enforce `https` only.
- Make registry DB-driven or add distributed invalidation strategy.
- Add per-service timeout budgets and test throttling.
- Emit sanitized audit logs for save/test operations.

**Risk Assessment:** HIGH

---

### Plan 07-04: Frontend Wiring (Wave 3)

**Summary**
This is a practical, necessary integration wave with good TypeScript/TanStack Query discipline. Main gaps are secret UX handling, stale update protection, and validation/error resilience.

**Strengths**
- Replaces stubs with real API integration.
- Strong typed contract between frontend and backend.
- Dedicated hooks improve reuse and maintainability.
- Save/test flows include user feedback via toasts.

**Concerns**
- **[MEDIUM]** Secret field behavior (mask/edit/clear) is not clearly defined.
- **[MEDIUM]** No concurrency control for multi-admin edits (last-write-wins risk).
- **[MEDIUM]** Required-field and format validation before save/test not specified.
- **[LOW]** Toast-only feedback may be insufficient for accessibility and persistent errors.

**Suggestions**
- Implement write-only API key UX with masked placeholder.
- Add optimistic concurrency (`version`/`updated_at` checks).
- Validate endpoint/region/model fields client-side and server-side.
- Add inline field errors and disabled states for invalid test attempts.

**Risk Assessment:** MEDIUM

---

### Plan 07-05: New Adapters & Region Capabilities (Wave 4)

**Summary**
This plan targets the hardest functional scope and is broadly aligned with the roadmap, but it is too dense for one wave and mixes runtime adapters, region policy, tester logic, and registry expansion. There is also a requirement-coverage risk for COACH-06/07 if Realtime/Voice Live/Avatar remain config-only.

**Strengths**
- Covers the missing service families and region-awareness.
- Correctly models Content Understanding as async poll workflow.
- Adds region capability endpoint for frontend decisioning.
- Expands connection tester to service-specific checks.

**Concerns**
- **[HIGH]** Scope concentration is very high; failure blast radius is large.
- **[HIGH]** Content Understanding polling lacks explicit max wait/backoff/cancel policy.
- **[HIGH]** `agent:{id}:{project}` encoding is brittle (delimiter/parsing edge cases).
- **[MEDIUM]** Hardcoded region lists will drift without ownership/update process.
- **[MEDIUM]** Config-only adapters may not fully satisfy COACH-06/07 runtime coaching goals.
- **[MEDIUM]** Global `SUPPORTED_REGIONS` expansion may over-permit unsupported service-region combos.

**Suggestions**
- Split into smaller deliverables: region model, Content Understanding runtime, then realtime/voice config.
- Store Voice Live mode as structured fields; encode only at transport boundary.
- Add bounded polling strategy with explicit terminal-state mapping.
- Validate region per service type (not global permissive list).
- Add operational process for periodic region-table updates.

**Risk Assessment:** HIGH

---

### Plan 07-06: Backend Tests (Wave 5)

**Summary**
Test scope is good and includes key adapter and dispatch paths, but it is still mostly mock-based and misses some security/contract/performance edges that are critical for this phase.

**Strengths**
- Broad adapter coverage intent across new services.
- Includes region edge cases (`unknown`, case-insensitive).
- Tests dispatch behavior across all service types.
- Avoids real credential dependency in CI.

**Concerns**
- **[MEDIUM]** No contract testing against Azure response shapes/version evolution.
- **[MEDIUM]** Limited coverage of timeout/retry/cancellation behavior.
- **[LOW]** Potential DB behavior mismatch if integration tests don't use Postgres/Alembic path.
- **[LOW]** Security test cases (RBAC, redaction, endpoint whitelist) not explicit.

**Suggestions**
- Add contract fixtures from documented Azure payloads.
- Add negative tests for malformed Voice Live mode strings and parser edge cases.
- Run integration tests against ephemeral Postgres.
- Add dedicated security integration tests for config/test endpoints.

**Risk Assessment:** MEDIUM

---

### Plan 07-07: Frontend Region & Voice Live UI (Wave 5)

**Summary**
This plan improves admin clarity and feature operability, especially for region-limited services and Voice Live mode selection. Main risk is logic duplication and validation gaps between frontend encoding and backend parsing.

**Strengths**
- Brings region capability visibility directly into admin UX.
- Adds explicit Voice Live Agent/Model controls.
- Includes i18n updates for both locales.
- Removes outdated hardcoded region assumptions.

**Concerns**
- **[MEDIUM]** Client-side mode encoding can drift from backend parse rules.
- **[MEDIUM]** Agent/project input validation constraints are not defined.
- **[LOW]** Color-only status signaling may hurt accessibility.
- **[LOW]** No explicit fallback UX for region-capability API failures.

**Suggestions**
- Send structured mode payload and let backend own encoding/parsing.
- Add strict field validation and localized error messages.
- Use text + icon status semantics with WCAG-safe colors.
- Add loading/error/empty-state behavior and Playwright coverage for mode toggles.

**Risk Assessment:** MEDIUM

---

## Consensus Summary

### Agreed Strengths
- Well-layered architecture with clear wave dependencies
- Strong typed contracts between frontend and backend
- Comprehensive test coverage planned across all waves
- Correct separation: backend-primary vs frontend-primary services

### Agreed Concerns
- **SSRF/endpoint validation risk** in Plan 07-03 — user-configured endpoints need Azure host whitelist + HTTPS enforcement (HIGH)
- **Voice Live `agent:{id}:{project}` encoding is brittle** — delimiter-based parsing has edge cases; structured fields preferred (HIGH)
- **Plan 07-05 scope concentration** — too many concerns in one wave; splitting recommended (HIGH)
- **No token/window management for conversation_history** — unbounded history creates latency/cost risk (HIGH)
- **Hardcoded region tables drift** without ownership/update process (MEDIUM)
- **Config-only adapters may not satisfy COACH-06/07** runtime coaching requirements (MEDIUM)

### Divergent Views
(Single reviewer — no divergent views to report)
