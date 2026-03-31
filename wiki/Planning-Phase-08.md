# Phase 08: Voice & Avatar Demo Integration

> Auto-generated from [`.planning/phases/08-voice-avatar-demo-integration`](../blob/main/.planning/phases/08-voice-avatar-demo-integration)
> Last synced: 2026-03-29

## Overview

**Goal:** Integrate Azure Voice Live Agent with Avatar into the AI Coach platform for real-time voice coaching with digital HCP avatar. All 7 Azure AI interaction modes are implemented through a unified Azure AI Foundry endpoint resource type. Plans 08-01 through 08-03 were completed in prior work; this phase covers container wiring, route registration, admin config card, transcript persistence, and comprehensive testing.

**Status:** Complete (2026-03-28)

## Plans (6)

| # | Plan | Description | Status |
|---|------|-------------|--------|
| 08-01 | (prior work) | Voice Live backend service, API routes, token broker, adapter | Complete |
| 08-02 | (prior work) | Frontend voice components (VoiceSession, AvatarView, VoiceControls, VoiceTranscript) | Complete |
| 08-03 | (prior work) | Frontend hooks (useVoiceLive, useAvatarStream, useVoiceToken) and voice session page | Complete |
| 08-04 | 08-04-PLAN.md | Voice tab in scenario selection, session mode end-to-end (text/voice/avatar), feature flag enforcement | Complete |
| 08-05 | 08-05-PLAN.md | Backend STT/TTS REST endpoints, frontend speech API client, MediaRecorder audio hooks | Complete |
| 08-06 | 08-06-PLAN.md | Comprehensive test coverage for session mode validation, feature flags, voice integration | Complete |

## Key Deliverables

### Backend
- **Voice Live API routes** (`/api/v1/voice-live/`) -- token broker, status endpoints
- **Voice Live service** with token broker returning API key for frontend WebSocket connection
- **Azure Voice Live adapter** with Agent/Model mode support
- **Speech REST endpoints** -- `POST /speech/transcribe` (STT) and `POST /speech/synthesize` (TTS)
- Backend Literal type validation for session mode (`text`/`voice`/`avatar`)
- Feature flag enforcement (409 response when voice/avatar disabled)

### Frontend
- **VoiceSession** container orchestrating all voice hooks and leaf components
- **AvatarView** component with WebRTC peer connection for avatar video rendering
- **VoiceControls** for microphone capture and playback
- **VoiceTranscript** display with real-time updates
- **useVoiceLive** hook for WebSocket connection management
- **useAvatarStream** hook for WebRTC avatar stream
- **useVoiceToken** hook for token broker API integration
- Voice tab in scenario selection page (gated by `voice_live_enabled` feature flag)
- Voice session page (`/voice-session`) registered alongside existing session routes

### Key Technical Decisions
- Azure AI Foundry unified endpoint -- all 7 modes use single resource type
- Voice Live WSS endpoint: `wss://<foundry>.cognitiveservices.azure.com/voice-live/realtime?...`
- Avatar uses WebRTC peer connection with ICE servers provided dynamically by Azure
- Fallback chain: avatar failure -> voice-only -> text mode
- Token broker returns raw API key; frontend connects directly to Azure
- Supported regions limited to eastus2 and swedencentral for Voice Live API

---

*Phase: 08-voice-avatar-demo-integration*
