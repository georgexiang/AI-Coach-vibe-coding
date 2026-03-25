# Phase 6: Conference Presentation Module - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

MRs can practice conference presentations to multiple virtual HCP audience members with turn management, live transcription, Q&A, and multi-scenario scoring. Also integrates voice capabilities (STT/TTS/Avatar) as optional pluggable layer for both F2F and conference modes.

Requirements covered: CONF-01, CONF-02, CONF-03, CONF-04, COACH-04, COACH-05, COACH-06, COACH-07

</domain>

<decisions>
## Implementation Decisions

### Conference Session Architecture
- Extend existing CoachingSession with `session_type` field (f2f/conference) — reuses existing lifecycle, scoring, and message infrastructure; add conference-specific fields (audience_config, presentation_topic)
- 3-5 HCPs per conference session, configurable per scenario — realistic conference size, each with distinct personality from existing HCP profiles
- Admin assigns 2-5 HCP profiles to conference-type scenarios — reuses existing HCP-scenario assignment pattern from Phase 2
- Same lifecycle (created → in_progress → completed → scored) plus `presenting` and `qa` sub-states — keeps compatibility with existing scoring/reporting

### Multi-HCP Turn Management & Q&A
- Queue-based turn management with priority scoring — HCPs generate questions internally, system queues by relevance, one HCP speaks at a time with "raise hand" visual
- Hybrid question timing: questions during natural pauses + dedicated Q&A phase at end — HCPs may interject during presentation pauses, plus structured Q&A round after
- HCPs build on each other's questions with shared conversation context — each HCP sees prior Q&A, can follow up or challenge previous answers, creating realistic multi-party dynamics
- Click-to-respond on queued questions — MR sees question queue, clicks to address a specific HCP's question, response is directed to that HCP

### Conference UI & Live Transcription
- Stage + audience panel layout — top area for MR's presentation/speaking, bottom/right panel shows HCP audience cards with status indicators (listening, asking, waiting)
- Real-time captions in a scrolling side panel — similar to live subtitle track, shows speaker name + text, auto-scrolls, can be collapsed
- Free-form speech with topic guide sidebar — no slides, MR speaks freely while checking off key topics from a checklist. Most realistic to real conference talk
- Avatar cards in a horizontal row — each HCP has a card with name, specialty, and status icon (listening/hand-raised/speaking). Reuses existing HCP profile display pattern

### Voice Integration (STT/TTS/Avatar)
- Text-first MVP with voice as pluggable optional layer — conference works fully via text input, voice (STT/TTS) enabled via feature toggle when Azure Speech is configured. Follows existing feature-toggle pattern.
- Each HCP gets a distinct Azure TTS voice — map voice ID to HCP profile, use different zh-CN/en-US voices. Falls back to text-only if TTS unavailable.
- Single avatar display for the currently-speaking HCP — avatar panel shows the HCP who is currently asking/speaking, swaps between HCPs. Premium feature behind toggle.
- Defer GPT Realtime API to post-MVP — conference mode has multi-party complexity that doesn't suit single-stream Realtime API. Use standard STT→LLM→TTS pipeline.

### Claude's Discretion
- Database migration details for new session_type field and conference-specific columns
- Exact system prompt engineering for multi-HCP audience behavior
- SSE event format for multi-speaker streaming (extending existing CoachEvent pattern)
- Conference scoring dimension weights vs F2F defaults
- Transcription panel scroll behavior and performance optimization
- Voice service adapter implementation details (Azure Speech SDK integration)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CoachingSession` model with full lifecycle (created → in_progress → completed → scored) — extend with session_type
- `SessionMessage` model for conversation tracking — works for multi-speaker by adding speaker_id
- `SessionScore` + `ScoreDetail` models for multi-dimensional scoring — reuse directly
- `BaseCoachingAdapter` with streaming `CoachEvent` pattern (TEXT, AUDIO, SCORE, SUGGESTION, ERROR, DONE)
- `MockCoachingAdapter` for dev/test — extend for multi-HCP mock responses
- `session_service.py` — create_session, send_message, end_session lifecycle functions
- `scoring_service.py` — score_session with configurable dimensions
- `report_service.py` — generate_report with radar chart data
- `suggestion_service.py` — real-time coaching hints
- `prompt_builder.py` — system prompt construction for HCP personality
- HCP profile + scenario admin pages — reuse patterns for conference scenario config
- Training session page — reuse chat UI patterns for conference Q&A panel
- Design tokens and shared components (Card, Badge, Button, Avatar, ScrollArea)
- i18n namespaces pattern — add `conference` namespace

### Established Patterns
- FastAPI routers with Pydantic schemas and dependency injection
- SSE streaming via `sse_starlette` for real-time AI responses
- TanStack Query hooks per domain for frontend server state
- Feature toggles via ConfigProvider for optional capabilities
- Admin CRUD pages with list + editor pattern
- Service layer holds business logic, routers handle HTTP only

### Integration Points
- `backend/app/api/sessions.py` — extend or add conference-specific endpoints
- `backend/app/main.py` — register new router(s), add feature toggles
- `frontend/src/pages/user/` — add conference presentation page
- `frontend/src/hooks/` — add useConferenceSession hook
- `frontend/src/api/` — add conference API client methods
- React Router routes — add /user/conference/:sessionId route
- Alembic migrations — extend session model with new fields

</code_context>

<specifics>
## Specific Ideas

- Conference mode reuses the same scoring engine as F2F but with presentation-specific criteria
- HCP audience members should feel distinct — different personalities lead to different question styles
- Live transcription should be performant with auto-scroll and speaker color coding
- Topic guide checklist mirrors key message tracking from F2F but adapted for presentation flow
- Voice integration follows the same pluggable pattern as existing AI adapters

</specifics>

<deferred>
## Deferred Ideas

- GPT Realtime API integration for conference — multi-party complexity makes it unsuitable for MVP
- Multiple simultaneous avatars — single avatar swapping is sufficient for MVP
- Slide-based presentations — free-form speech is more realistic and simpler to implement
- Real-time audience sentiment visualization — interesting but not in requirements

</deferred>
