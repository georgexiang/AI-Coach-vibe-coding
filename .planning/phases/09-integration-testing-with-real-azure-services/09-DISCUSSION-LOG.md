# Phase 09: Integration Testing with Real Azure Services - Discussion Log (Updated)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-03-27 (updated)
**Phase:** 09-integration-testing-with-real-azure-services
**Areas discussed:** Config alignment scope, Azure AD Token strategy, Agent/Model mode, Unified endpoint, 7 interaction modes

## Session 2: Config Alignment Discussion

User provided AI Foundry resource config (kind: AIServices, region: eastus2).
Key findings: `disableLocalAuth: true`, unified endpoint, voice-agent + voice-live paths.

### Config Alignment Scope
- Chose: **Backport to Phase 07/08** (not expand Phase 09)

### Azure AD Token Strategy
- Chose: **Both API key + AD token** — try API key first, fall back to DefaultAzureCredential
- User note: "两种方式都支持，如果不支持API key的话，就可以使用AD token认证"

### Unified Endpoint
- Chose: **Single AI Foundry card** — replace 6 separate service configs
- User note: "用户不用配置那么多东西，配置就简单很多"

### Interaction Modes (iterated from 5→6→7)
- User initially described 5 modes, then added Voice Realtime (no avatar), then confirmed all 7:
  1. Text, 2. Voice Pipeline, 3. Digital Human Speech+Model
  4. Voice Realtime Model, 5. Digital Human Realtime Model
  6. Voice Realtime Agent, 7. Digital Human Realtime Agent

## Session 1 (original)

**User note:** "这个功能是需要给客户demo的主要内容，很重要，需要好好测试性能，UI美观，效果，便利性等等。"
(This is the main demo content for customers, very important, needs thorough testing of performance, UI aesthetics, effects, convenience, etc.)

---

## Test Scope & Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Demo polish | Focus on making the full E2E demo flow flawless | |
| Technical validation | Focus on integration correctness | |
| Both equally | Split effort between technical validation AND demo-ready polish | ✓ |

**User's choice:** Both equally

| Option | Description | Selected |
|--------|-------------|----------|
| Voice + Avatar coaching | The 'wow' factor demo | |
| F2F text coaching with real AI | Core value demo | |
| Full pipeline demo | Show all modes: text → voice → avatar | ✓ |

**User's choice:** Full pipeline demo

---

## Environment & Credentials

| Option | Description | Selected |
|--------|-------------|----------|
| Backend .env + Admin UI | Same pattern as Phase 7 | ✓ |
| Dedicated test config | Separate test configuration file/profile | |
| You decide | Claude picks best approach | |

**User's choice:** Backend .env + Admin UI

| Option | Description | Selected |
|--------|-------------|----------|
| Local + manual only | No CI integration, avoids Azure costs | ✓ |
| CI with skip markers | Tests in CI but skipped by default | |
| Full CI integration | Tests run on every PR | |

**User's choice:** Local + manual only

---

## Test Execution Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Pytest + manual smoke | Integration tests per service + manual E2E checklist | ✓ |
| Manual checklist only | Documented test checklist, no automated tests | |
| Automated E2E with Playwright | Playwright E2E tests for full demo flow | ✓ |

**User's choice:** Both Pytest + manual smoke AND Playwright E2E (user requested options 1 and 3)

---

## Acceptance Criteria

All four criteria selected:
- ✓ Response latency < 3s
- ✓ Avatar renders smoothly
- ✓ Graceful fallback chain
- ✓ Scoring works on all modes

---

## Claude's Discretion

- Pytest test structure and markers
- Playwright page object patterns
- Performance measurement implementation
- Test data fixtures
- Smoke test checklist format
