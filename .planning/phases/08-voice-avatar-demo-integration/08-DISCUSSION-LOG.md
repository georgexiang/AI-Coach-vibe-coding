# Phase 08: Voice & Avatar Demo Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 08-voice-avatar-demo-integration
**Areas discussed:** Voice session entry flow, Admin Voice Live config card, Session end & scoring flow, Test coverage strategy

---

## Voice Session Entry Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Scenario selection with mode param | User starts voice session from scenario selection page with URL mode parameter | ✓ |
| Dedicated voice page | Separate navigation entry for voice sessions | |
| Mode toggle within session | Start as text, switch to voice mid-session | |

**User's choice:** Follow existing pattern — scenario selection with mode URL parameter (matching F2F and conference patterns)
**Notes:** VoiceSessionPage already reads `?id=<sessionId>&mode=<voice|avatar>` from URL search params. Route registration is the remaining work.

---

## Admin Voice Live Config Card

| Option | Description | Selected |
|--------|-------------|----------|
| Unified AI Foundry card | Single card for Azure AI Foundry endpoint covering all 7 modes | ✓ |
| Separate cards per mode | Individual ServiceConfigCard for each of the 7 modes | |

**User's choice:** All 7 modes use Azure AI Foundry endpoint as single resource type
**Notes:** User explicitly stated: "基于azure ai foundry的endpoint来做，7种交互模式全部通过这个资源类型来实现" (use Azure AI Foundry endpoint, all 7 interaction modes through this resource type). Voice Live needs agent-project-name, agent-id, Entra token per reference repo WSS URL pattern.

---

## Session End & Scoring Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to scoring page | Same lifecycle as F2F (completed → scored) | ✓ |
| In-session scoring display | Show score within voice session page | |
| Return to dashboard | Skip direct scoring, view later | |

**User's choice:** Same session lifecycle as F2F and conference — navigate to scoring page
**Notes:** VoiceSession component already has end-session dialog and navigation. Transcript flush-before-end-session (D-09) ensures all messages are persisted before scoring.

---

## Test Coverage Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Real Azure integration tests | Test all 7 modes with real Azure services via .env config | ✓ |
| Mock-only unit tests | Use mocks for all Azure services | |
| Hybrid approach | Unit tests with mocks + separate integration test suite | |

**User's choice:** Comprehensive testing based on .env configuration — all 7 Azure AI modes tested with real services
**Notes:** User stated: "要根据.env的配置，进行全面的测试" (comprehensive testing based on .env configuration). Backend .env already has real Azure OpenAI keys configured.

---

## Claude's Discretion

- WebRTC error handling and retry logic
- Avatar video element sizing and responsive behavior
- Toast notification wording for connection state changes
- Test mock strategy for WebRTC/audio APIs in unit tests

## Deferred Ideas

- Per-session provider override — future enhancement
- Multiple avatar characters per HCP profile — future enhancement
- Azure AD SSO for Entra token — AUTH-V2-01
