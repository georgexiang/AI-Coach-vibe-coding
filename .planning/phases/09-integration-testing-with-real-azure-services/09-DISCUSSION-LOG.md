# Phase 09: Integration Testing with Real Azure Services - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 09-integration-testing-with-real-azure-services
**Areas discussed:** Unified AI Foundry config, 7 modes + agent runtime, Test & demo strategy
**Note:** This is an UPDATE discussion (session 3). Original context from 2026-03-27 was revised after audit showed config alignment work labeled "backported to Phase 07/08" was never implemented.

---

## Pre-Discussion Audit

Before discussing gray areas, a codebase audit was performed to check which Phase 9 context decisions were already implemented in Phase 8.

**Findings:**
| Decision | Status |
|----------|--------|
| Unified AI Foundry endpoint (D-01/D-02) | NOT DONE — still 8 separate ServiceConfig rows |
| Single AI Foundry admin card (D-03) | NOT DONE — still 8 separate cards |
| Azure AD token auth (D-04/D-05/D-06) | NOT DONE — no azure-identity dep |
| 7 interaction modes (D-07) | 3 of 7 — only text/voice/avatar |
| Fallback chain (D-08) | NOT DONE |
| Agent mode admin config | DONE — toggle stored in DB |
| Agent mode runtime | NOT DONE — token broker & frontend ignore config |

**User decision:** Update Phase 9 context to include all unimplemented config alignment work.

---

## Unified AI Foundry Config

| Option | Description | Selected |
|--------|-------------|----------|
| Single master + toggles | One ServiceConfig row with AI Foundry endpoint/region/auth. Per-service rows become just enable/disable toggles + model/deployment names | ✓ |
| Separate master table | New AiFoundryConfig table for unified config. Keep ServiceConfig for per-service customization. Two-level config | |
| Keep current + add unified fields | Add ai_foundry_endpoint/region to Settings. Keep ServiceConfig rows but auto-populate from master | |

**User's choice:** Single master + toggles

---

## Auth Method

| Option | Description | Selected |
|--------|-------------|----------|
| Dual auth | Support both API key and Azure AD. Try API key first, fall back to DefaultAzureCredential | |
| Azure AD only | Only implement DefaultAzureCredential | |
| API key first, AD later | Only implement API key auth now. Add Azure AD in a future phase | ✓ |

**User's choice:** API key first, AD later

---

## Admin UI Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Single card + service toggles | One AI Foundry card with endpoint/region/key. Below: toggle list for each service | ✓ |
| Single card only | One card, no per-service configuration | |
| You decide | Let Claude decide | |

**User's choice:** Single card + service toggles

---

## Seven Interaction Modes

| Option | Description | Selected |
|--------|-------------|----------|
| All 7 modes | Full differentiation across Text, Pipeline, Realtime Model, Realtime Agent, each with/without avatar | ✓ |
| 5 modes (skip pipeline) | Skip legacy pipeline STT→LLM→TTS modes | |
| Keep 3 modes, add agent toggle | text/voice/avatar + Agent/Model toggle | |

**User's choice:** All 7 modes

---

## Agent Mode Runtime

| Option | Description | Selected |
|--------|-------------|----------|
| Token broker passes agent config | Token broker reads agent mode, returns agent_id + project_name in response. Frontend uses voice-agent/realtime path | ✓ |
| Frontend decides path | Frontend reads mode and connects directly | |
| You decide | Let Claude determine | |

**User's choice:** Token broker passes agent config

---

## Mode Selector UI

| Option | Description | Selected |
|--------|-------------|----------|
| Two-level selector | First communication type, then engine | ✓ |
| Flat list of 7 modes | Single dropdown/radio | |
| Admin picks, user sees 3 | Engine choice invisible to user | |

**User's choice:** Two-level selector

---

## Test Priority

| Option | Description | Selected |
|--------|-------------|----------|
| Implementation first, test after | Build config + modes, then write tests | ✓ |
| Test-driven | Write tests first, implement to pass | |
| Parallel tracks | Implement and test simultaneously | |

**User's choice:** Implementation first, test after

---

## Demo Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Full pipeline demo | Login → Admin AI Foundry config → Text → Voice → Avatar → Score | ✓ |
| Mode comparison demo | All 7 modes side-by-side | |
| You decide | Let Claude determine | |

**User's choice:** Full pipeline demo

---

## Claude's Discretion

- Exact Playwright test structure and page object patterns
- Performance measurement implementation
- Test data fixtures and seed data
- Skip markers for offline development
- Smoke test checklist format
- Alembic migration details for schema changes
- Plan structure (how to split config alignment vs testing)

## Deferred Ideas

- Azure AD token auth (DefaultAzureCredential) — future phase
- Fallback chain (7→1 based on service availability) — future phase
- CI/CD integration of Azure tests — avoid costs
