# Phase 09: Integration Testing with Real Azure Services

> Auto-generated from [`.planning/phases/09-integration-testing-with-real-azure-services`](../blob/main/.planning/phases/09-integration-testing-with-real-azure-services)
> Last synced: 2026-03-29

## Overview

**Goal:** Implement remaining Azure config alignment work (unified AI Foundry endpoint, 7 interaction modes, agent mode runtime) that was planned for Phase 07/08 but not implemented, then validate all Azure service integrations end-to-end with real credentials and polish the demo experience for BeiGene customer presentations.

**Status:** Complete (2026-03-28)
**Verification:** 5/6 must-haves verified (E2E demo flow gap due to environment dependency)

## The 7 Interaction Modes

1. **Text** -- Text-only coaching (Azure OpenAI chat completions REST API)
2. **Voice Pipeline** -- Voice without avatar (STT -> LLM -> TTS pipeline)
3. **Digital Human: Speech+Model** -- Avatar with pipeline voice (STT -> LLM -> TTS -> Avatar)
4. **Voice Realtime Model** -- Voice without avatar via `voice-live/realtime` WebSocket
5. **Digital Human: Realtime Model** -- Avatar with `voice-live/realtime` WebSocket + Avatar rendering
6. **Voice Realtime Agent** -- Voice without avatar via `voice-agent/realtime` WebSocket (function calling)
7. **Digital Human: Realtime Agent** -- Avatar with `voice-agent/realtime` WebSocket + Avatar rendering

## Plans (5)

| # | Plan | Description | Status |
|---|------|-------------|--------|
| 09-01 | 09-01-PLAN.md | Unified AI Foundry master config, 7-mode session schema, agent mode token broker wiring | Complete |
| 09-02 | 09-02-PLAN.md | Frontend AI Foundry config page redesign, 7-mode TypeScript types, admin UI with master card | Complete |
| 09-03 | 09-03-PLAN.md | Two-level mode selector UI, agent mode WebSocket path selection in use-voice-live hook | Complete |
| 09-04 | 09-04-PLAN.md | Pytest integration tests per Azure service with real credentials | Complete |
| 09-05 | 09-05-PLAN.md | Playwright E2E demo flow test, pre-demo smoke test checklist (84 checkpoints) | Complete |

## Key Deliverables

### Backend -- Config Alignment
- **Unified AI Foundry master config** -- single endpoint/region/API key replacing 8 separate ServiceConfig rows
- **7-mode session schema** expansion from 3-mode Literal to full 7-mode enum
- **Agent mode runtime** -- token broker returns `agent_id` + `project_name` in `VoiceLiveTokenResponse`
- `get_master_config`, `get_effective_key`, `get_effective_endpoint` service methods
- Alembic migration for `is_master` column on ServiceConfig
- `GET/PUT /api/v1/azure-config/ai-foundry` endpoints

### Frontend -- Config Alignment
- **Redesigned admin Azure config page** with single AI Foundry master card + per-service toggles
- **Two-level mode selector** -- communication type first (Text/Voice/Digital Human), then engine (Pipeline/Realtime Model/Realtime Agent)
- **Agent mode WebSocket path** -- `voice-agent/realtime` for agent mode, `openai/realtime` for model mode
- `AIFoundryConfig` and `AIFoundryConfigUpdate` TypeScript interfaces
- 7-mode `SessionMode` type

### Testing
- **Pytest integration tests** per Azure service using `@pytest.mark.integration` with `--run-integration` flag
- Test modules: Azure OpenAI, Azure Speech (STT/TTS), Voice Live, Avatar
- **Playwright E2E test** exercising full demo pipeline: Login -> Admin config -> Text session -> Scoring
- **Pre-demo smoke test checklist** with 84 checkpoint items across all services

---

*Phase: 09-integration-testing-with-real-azure-services*
