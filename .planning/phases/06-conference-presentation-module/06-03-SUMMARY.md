---
phase: 06-conference-presentation-module
plan: 03
subsystem: api, services, agents
tags: [fastapi, sse, conference, azure-speech, stt, tts, avatar, prompt-engineering]

# Dependency graph
requires:
  - phase: 06-01
    provides: ConferenceAudienceHcp ORM model, extended session/message columns, TurnManager, conference schemas
  - phase: 02-f2f-text-coaching
    provides: session_service, scoring_service, prompt_builder, SSE streaming pattern
provides:
  - Conference service (create_conference_session, generate_hcp_questions, handle_respond, end_conference_session)
  - Conference API router with 7 endpoints (CRUD sessions, SSE stream, sub-state, audience management)
  - Conference prompt builder (build_conference_audience_prompt, build_conference_scoring_prompt)
  - Azure STT adapter with conditional SDK import and asyncio.to_thread
  - Azure TTS adapter with SSML voice selection and curated zh-CN/en-US voice lists
  - Azure Avatar adapter stub (is_available=False, premium option behind toggle)
  - SSE heartbeat mechanism (15-second interval via asyncio queue pattern)
affects: [06-04, 06-05, 06-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [conference SSE heartbeat via asyncio producer/consumer queue, sequential HCP question generation with shared context, conference-adapted scoring prompts]

key-files:
  created:
    - backend/app/services/conference_service.py
    - backend/app/api/conference.py
    - backend/app/services/agents/stt/azure.py
    - backend/app/services/agents/tts/azure.py
    - backend/app/services/agents/avatar/azure.py
  modified:
    - backend/app/services/prompt_builder.py
    - backend/app/main.py
    - backend/app/api/__init__.py
    - backend/app/services/agents/stt/__init__.py
    - backend/app/services/agents/tts/__init__.py
    - backend/app/services/agents/avatar/__init__.py

key-decisions:
  - "SSE heartbeat via asyncio queue-based producer/consumer pattern for reliable 15-second keepalive"
  - "Sequential HCP question generation passing prior questions as context to avoid duplicates (per RESEARCH Pitfall 4)"
  - "Azure adapters use conditional SDK import inside methods to avoid ImportError when SDK not installed"
  - "AzureAvatarAdapter is a stub (is_available=False) satisfying COACH-07 configurable premium requirement"

patterns-established:
  - "Conference service pattern: separate conference_service.py for multi-HCP orchestration, distinct from F2F session_service.py"
  - "Azure adapter pattern: conditional import, asyncio.to_thread for blocking SDK calls, credentials in constructor"
  - "Conference prompt pattern: shared personality behaviors dict, audience context with other HCPs' questions"

requirements-completed: [CONF-01, CONF-02, CONF-04, COACH-04, COACH-05, COACH-07]

# Metrics
duration: 11min
completed: 2026-03-25
---

# Phase 06 Plan 03: Conference Backend Services and API Summary

**Conference service with multi-HCP session orchestration, SSE streaming API with 15s heartbeat, Azure STT/TTS adapters with asyncio.to_thread, and conference-adapted prompt engineering**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-25T10:24:20Z
- **Completed:** 2026-03-25T10:35:36Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Created conference_service.py with full session lifecycle: create, question generation, respond, sub-state transition, end with scoring
- Built conference API router with 7 endpoints: POST/GET sessions, SSE stream, PATCH sub-state, POST end, GET/PUT audience
- Extended prompt_builder.py with build_conference_audience_prompt and build_conference_scoring_prompt for multi-HCP context
- Implemented SSE heartbeat mechanism via asyncio queue-based producer/consumer pattern (15-second interval)
- Created AzureSTTAdapter with conditional SDK import, PushAudioInputStream, and asyncio.to_thread wrapping
- Created AzureTTSAdapter with SSML voice selection and curated voice lists (6 zh-CN + 4 en-US voices)
- Created AzureAvatarAdapter stub for premium avatar feature behind toggle
- Registered all Azure adapters conditionally in main.py lifespan based on configured credentials

## Task Commits

Each task was committed atomically:

1. **Task 1: Conference service, prompt builder extension, and API router with SSE** - `e9354a1` (feat)
2. **Task 2: Azure STT/TTS adapters with ServiceRegistry registration** - `eb86625` (feat)

## Files Created/Modified
- `backend/app/services/conference_service.py` - Conference session orchestration with multi-HCP question generation and response handling
- `backend/app/api/conference.py` - Conference REST + SSE endpoints with heartbeat support
- `backend/app/services/prompt_builder.py` - Extended with conference audience and scoring prompts
- `backend/app/services/agents/stt/azure.py` - Azure Speech STT adapter with asyncio.to_thread
- `backend/app/services/agents/tts/azure.py` - Azure Speech TTS adapter with SSML and voice catalog
- `backend/app/services/agents/avatar/azure.py` - Azure Avatar adapter stub (premium feature)
- `backend/app/main.py` - Conference router registration and conditional Azure adapter registration
- `backend/app/api/__init__.py` - Added conference_router export
- `backend/app/services/agents/stt/__init__.py` - Added AzureSTTAdapter export
- `backend/app/services/agents/tts/__init__.py` - Added AzureTTSAdapter export
- `backend/app/services/agents/avatar/__init__.py` - Added AzureAvatarAdapter export

## Decisions Made
- Used asyncio queue-based producer/consumer pattern for SSE heartbeat instead of inline sleep loop -- cleaner separation and more reliable heartbeat delivery
- Sequential HCP question generation (not parallel) per RESEARCH Pitfall 4 -- each HCP sees prior HCPs' questions to avoid duplication
- Azure Speech SDK imported conditionally inside adapter methods (not at module level) to avoid ImportError when SDK not installed
- AzureAvatarAdapter returns is_available()=False as a stub -- satisfies COACH-07 "configurable premium option" without requiring real Azure Avatar credentials
- Conference scoring prompt maps existing 5 dimensions to conference context (key_message -> presentation completeness, objection_handling -> Q&A handling, etc.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ruff lint errors in conference files**
- **Found during:** Task 1 (verification)
- **Issue:** Unused variable in heartbeat inner function, module docstring exceeded 100 chars
- **Fix:** Removed unused heartbeat inner function code, shortened docstring
- **Files modified:** backend/app/api/conference.py, backend/app/services/prompt_builder.py
- **Verification:** ruff check passes
- **Committed in:** e9354a1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor formatting fix. No scope creep.

## Issues Encountered
None - plan executed as specified.

## User Setup Required
None - Azure Speech adapters are registered conditionally based on environment variables (azure_speech_key, azure_speech_region). The application works in text-only mode with mock adapters when credentials are not configured.

## Next Phase Readiness
- Conference backend fully operational: session creation, multi-HCP Q&A, SSE streaming with heartbeat, scoring integration
- Azure STT/TTS adapters ready for real voice integration when credentials are configured
- Frontend (Plan 04/05) can consume the conference API endpoints and SSE events
- All 500 existing tests pass with no regressions

## Self-Check: PASSED

All 5 created files verified present. Both commit hashes (e9354a1, eb86625) found in git log.

---
*Phase: 06-conference-presentation-module*
*Completed: 2026-03-25*
