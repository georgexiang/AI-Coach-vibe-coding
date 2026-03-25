# Phase 6: Conference Presentation Module - Research

**Researched:** 2026-03-25
**Domain:** Multi-HCP conference simulation, turn management, live transcription, voice integration (STT/TTS/Avatar)
**Confidence:** HIGH

## Summary

Phase 6 extends the existing F2F coaching infrastructure to support conference presentation mode where an MR presents to multiple virtual HCP audience members (3-5 per session). The primary technical challenges are: (1) multi-HCP turn management with a question queue, (2) extending the session/message models to track multiple speakers, (3) building a new conference-specific UI layout (stage + audience panel + transcription), and (4) integrating Azure Speech STT/TTS as optional pluggable voice layer.

The existing codebase already has strong foundations: `CoachingSession` with lifecycle states, `SessionMessage` for conversation tracking, `CoachEvent` streaming via SSE, `BaseCoachingAdapter` pattern, `ServiceRegistry` with categories (llm/stt/tts/avatar), mock adapters for all four categories, and `feature_conference_enabled` toggle in config. The `Scenario` model already has a `mode` field with `f2f/conference` values. The key gap is that scenarios currently link to a single `hcp_profile_id` via FK -- conference mode needs a many-to-many relationship between scenarios and HCP profiles.

**Primary recommendation:** Extend the existing session infrastructure (not replace it). Add a `ConferenceAudienceHcp` join table for scenario-to-multi-HCP mapping, add `speaker_id` and `speaker_name` columns to `SessionMessage`, create a `conference_service.py` that orchestrates multi-HCP turn management using the existing LLM adapter, and build a new conference UI page that reuses shared components (ChatInput, ChatBubble, Badge, ScrollArea) while adding conference-specific layout (audience cards, transcription panel, topic guide).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Extend existing CoachingSession with `session_type` field (f2f/conference) -- reuses existing lifecycle, scoring, and message infrastructure; add conference-specific fields (audience_config, presentation_topic)
- 3-5 HCPs per conference session, configurable per scenario -- realistic conference size, each with distinct personality from existing HCP profiles
- Admin assigns 2-5 HCP profiles to conference-type scenarios -- reuses existing HCP-scenario assignment pattern from Phase 2
- Same lifecycle (created -> in_progress -> completed -> scored) plus `presenting` and `qa` sub-states -- keeps compatibility with existing scoring/reporting
- Queue-based turn management with priority scoring -- HCPs generate questions internally, system queues by relevance, one HCP speaks at a time with "raise hand" visual
- Hybrid question timing: questions during natural pauses + dedicated Q&A phase at end -- HCPs may interject during presentation pauses, plus structured Q&A round after
- HCPs build on each other's questions with shared conversation context -- each HCP sees prior Q&A, can follow up or challenge previous answers, creating realistic multi-party dynamics
- Click-to-respond on queued questions -- MR sees question queue, clicks to address a specific HCP's question, response is directed to that HCP
- Stage + audience panel layout -- top area for MR's presentation/speaking, bottom/right panel shows HCP audience cards with status indicators (listening, asking, waiting)
- Real-time captions in a scrolling side panel -- similar to live subtitle track, shows speaker name + text, auto-scrolls, can be collapsed
- Free-form speech with topic guide sidebar -- no slides, MR speaks freely while checking off key topics from a checklist
- Avatar cards in a horizontal row -- each HCP has a card with name, specialty, and status icon (listening/hand-raised/speaking). Reuses existing HCP profile display pattern
- Text-first MVP with voice as pluggable optional layer -- conference works fully via text input, voice (STT/TTS) enabled via feature toggle when Azure Speech is configured
- Each HCP gets a distinct Azure TTS voice -- map voice ID to HCP profile, use different zh-CN/en-US voices. Falls back to text-only if TTS unavailable
- Single avatar display for the currently-speaking HCP -- avatar panel shows the HCP who is currently asking/speaking, swaps between HCPs. Premium feature behind toggle
- Defer GPT Realtime API to post-MVP -- conference mode has multi-party complexity that doesn't suit single-stream Realtime API. Use standard STT->LLM->TTS pipeline

### Claude's Discretion
- Database migration details for new session_type field and conference-specific columns
- Exact system prompt engineering for multi-HCP audience behavior
- SSE event format for multi-speaker streaming (extending existing CoachEvent pattern)
- Conference scoring dimension weights vs F2F defaults
- Transcription panel scroll behavior and performance optimization
- Voice service adapter implementation details (Azure Speech SDK integration)

### Deferred Ideas (OUT OF SCOPE)
- GPT Realtime API integration for conference -- multi-party complexity makes it unsuitable for MVP
- Multiple simultaneous avatars -- single avatar swapping is sufficient for MVP
- Slide-based presentations -- free-form speech is more realistic and simpler to implement
- Real-time audience sentiment visualization -- interesting but not in requirements
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONF-01 | User can start a conference presentation mode with multiple virtual HCP audience members | Session model extension with session_type, ConferenceAudienceHcp join table, conference_service.py, new conference page |
| CONF-02 | Multiple AI HCPs ask questions from audience -- questions queue with turn management | Queue-based turn manager service, SSE event extension for speaker_id/queue updates, question priority scoring |
| CONF-03 | Conference session includes live transcription display | Transcription panel component with auto-scroll, speaker color coding, SSE events carry speaker attribution |
| CONF-04 | Conference sessions are scored using the same multi-dimensional scoring system as F2F | Reuse existing scoring_service.py with conference-specific prompt adjustments, presentation-specific criteria weights |
| COACH-04 | User can use voice input (Azure Speech STT) -- speech recognized and sent as text | Azure Speech SDK (azure-cognitiveservices-speech 1.48.x) STT adapter, pluggable via ServiceRegistry |
| COACH-05 | AI HCP responses spoken via Azure Speech TTS -- natural-sounding voices | Azure Speech SDK TTS adapter, per-HCP voice mapping, pluggable via ServiceRegistry |
| COACH-06 | Voice interaction supports GPT Realtime API as configurable premium option | DEFERRED per user decision -- stub interface only, not implemented in this phase |
| COACH-07 | Azure AI Avatar renders digital human visual for HCP as configurable premium option | Azure Avatar adapter (single avatar swap between HCPs), behind feature_avatar_enabled toggle |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Async everywhere**: all backend functions use `async def`, `await`, `AsyncSession`
- **Pydantic v2** schemas with `model_config = ConfigDict(from_attributes=True)`
- **No raw SQL** -- use SQLAlchemy ORM or Alembic migrations
- **Service layer** holds business logic, routers only handle HTTP
- **Route ordering**: static paths before parameterized `/{id}`
- **Create returns 201**, Delete returns 204
- **TypeScript strict mode**: no `any` types, no unused variables
- **TanStack Query hooks** per domain, no inline `useQuery` in components
- **Path alias** `@/` for all imports
- **`cn()` utility** for conditional class composition
- **i18n**: all UI text externalized via react-i18next, add `conference` namespace
- **Conventional commits**: `feat:`, `fix:`, `docs:`, `test:`
- **Alembic migrations**: NEVER modify schema without migration, use `render_as_batch` for SQLite
- **Feature toggles** default to False for zero-config local dev
- **Pre-commit**: ruff check/format, pytest, tsc -b, npm run build

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.115.0 | ASGI web framework | Already in use, extend with conference router |
| SQLAlchemy 2.0 | >=2.0.35 | Async ORM | Already in use, extend models |
| sse-starlette | >=2.0.0 | Server-Sent Events | Already used for F2F streaming, extend for multi-speaker |
| Pydantic v2 | >=2.0 | Request/response schemas | Already in use |
| React 18 | ^18.3.0 | Frontend UI | Already in use |
| TanStack Query v5 | ^5.60.0 | Server state | Already in use |
| react-i18next | ^16.6.2 | Internationalization | Already in use |
| Radix UI | various | UI primitives | Already in use (Avatar, Badge, ScrollArea, Dialog, etc.) |

### New Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| azure-cognitiveservices-speech | >=1.48.0 | Azure Speech STT/TTS | Voice integration (COACH-04, COACH-05) |

**Installation:**
```bash
# Backend -- add to pyproject.toml [project.optional-dependencies]
# voice group:
pip install "azure-cognitiveservices-speech>=1.48.0"

# No new frontend dependencies needed -- all UI primitives already available
```

**Version verification:**
- `azure-cognitiveservices-speech`: latest is 1.48.2 (verified via pip index)
- All other dependencies are already pinned in `pyproject.toml` and `package.json`

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| azure-cognitiveservices-speech | REST API directly | SDK provides streaming, auto-reconnect, better DX; REST is simpler but no streaming |
| SSE multi-speaker extension | WebSocket per-HCP channel | SSE is simpler, already established pattern; WebSocket adds bidirectional complexity not needed |
| New conference_service.py | Extending session_service.py | Separate service is cleaner; session_service.py is already 250+ lines |

## Architecture Patterns

### Recommended Project Structure (additions only)
```
backend/app/
├── api/
│   └── conference.py          # Conference-specific router endpoints
├── models/
│   └── conference.py          # ConferenceAudienceHcp join table model
├── schemas/
│   └── conference.py          # Conference request/response schemas
├── services/
│   ├── conference_service.py  # Conference session orchestration, turn management
│   ├── turn_manager.py        # Question queue, priority scoring, turn state
│   └── agents/
│       ├── stt/
│       │   └── azure.py       # Azure Speech STT adapter
│       └── tts/
│           └── azure.py       # Azure Speech TTS adapter
frontend/src/
├── api/
│   └── conference.ts          # Conference API client functions
├── components/
│   └── conference/
│       ├── audience-panel.tsx  # HCP audience cards with status
│       ├── conference-stage.tsx # MR presentation area + avatar
│       ├── question-queue.tsx  # Queued HCP questions display
│       ├── topic-guide.tsx     # Key topic checklist sidebar
│       ├── transcription-panel.tsx # Live transcription scroll
│       └── index.ts           # Barrel exports
├── hooks/
│   ├── use-conference.ts      # Conference session TanStack Query hooks
│   └── use-conference-sse.ts  # Multi-speaker SSE streaming hook
├── pages/
│   └── user/
│       └── conference-session.tsx # Conference presentation page
├── types/
│   └── conference.ts          # Conference-specific TypeScript types
└── public/locales/
    ├── en-US/conference.json  # English conference translations
    └── zh-CN/conference.json  # Chinese conference translations
```

### Pattern 1: Multi-HCP Session Architecture (Database)

**What:** Extend session model with conference fields; add join table for multi-HCP scenarios
**When to use:** Conference mode sessions

The existing `Scenario.hcp_profile_id` links to a single HCP. For conference, add a `ConferenceAudienceHcp` join table:

```python
# backend/app/models/conference.py
class ConferenceAudienceHcp(Base, TimestampMixin):
    """Join table: maps HCP profiles to conference-type scenarios."""
    __tablename__ = "conference_audience_hcps"

    scenario_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scenarios.id"), nullable=False
    )
    hcp_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("hcp_profiles.id"), nullable=False
    )
    role_in_conference: Mapped[str] = mapped_column(
        String(50), default="audience"
    )  # "audience" or "moderator"
    voice_id: Mapped[str] = mapped_column(String(100), default="")  # Azure TTS voice mapping
    sort_order: Mapped[int] = mapped_column(default=0)

    scenario = relationship("Scenario")
    hcp_profile = relationship("HcpProfile")
```

Extend `CoachingSession` with Alembic migration:
```python
# Add these columns to coaching_sessions table
session_type: Mapped[str] = mapped_column(String(20), default="f2f")  # f2f/conference
sub_state: Mapped[str] = mapped_column(String(20), default="")  # presenting/qa (conference only)
presentation_topic: Mapped[str] = mapped_column(Text, default="")
audience_config: Mapped[str] = mapped_column(Text, default="[]")  # JSON: audience HCP IDs + config
```

Extend `SessionMessage` to track multi-speaker:
```python
# Add these columns to session_messages table
speaker_id: Mapped[str | None] = mapped_column(String(36), nullable=True)  # HCP profile ID
speaker_name: Mapped[str] = mapped_column(String(255), default="")  # Display name
```

### Pattern 2: Turn Management Service

**What:** In-memory queue-based system for managing HCP question turns
**When to use:** During active conference sessions

```python
# backend/app/services/turn_manager.py
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class QueuedQuestion:
    hcp_profile_id: str
    hcp_name: str
    question: str
    relevance_score: float  # 0.0-1.0, higher = more relevant
    queued_at: datetime = field(default_factory=lambda: datetime.now())
    status: str = "waiting"  # waiting/active/answered

class TurnManager:
    """Manages HCP question queue per conference session."""

    def __init__(self) -> None:
        self._queues: dict[str, list[QueuedQuestion]] = {}  # session_id -> queue

    def add_question(self, session_id: str, question: QueuedQuestion) -> None:
        if session_id not in self._queues:
            self._queues[session_id] = []
        self._queues[session_id].append(question)
        # Sort by relevance_score descending
        self._queues[session_id].sort(key=lambda q: q.relevance_score, reverse=True)

    def get_queue(self, session_id: str) -> list[QueuedQuestion]:
        return [q for q in self._queues.get(session_id, []) if q.status == "waiting"]

    def activate_question(self, session_id: str, hcp_profile_id: str) -> QueuedQuestion | None:
        for q in self._queues.get(session_id, []):
            if q.hcp_profile_id == hcp_profile_id and q.status == "waiting":
                q.status = "active"
                return q
        return None

    def mark_answered(self, session_id: str, hcp_profile_id: str) -> None:
        for q in self._queues.get(session_id, []):
            if q.hcp_profile_id == hcp_profile_id and q.status == "active":
                q.status = "answered"
                break

    def cleanup_session(self, session_id: str) -> None:
        self._queues.pop(session_id, None)

# Module-level singleton
turn_manager = TurnManager()
```

### Pattern 3: Multi-Speaker SSE Event Extension

**What:** Extend existing SSE event format with speaker attribution
**When to use:** Conference streaming endpoints

The existing SSE events are `text`, `hint`, `key_messages`, `done`, `error`. For conference, add new event types:

```python
# New SSE events for conference mode:
# event: speaker_text   -- HCP question with speaker attribution
# data: {"speaker_id": "...", "speaker_name": "Dr. X", "content": "..."}

# event: queue_update    -- question queue changed
# data: [{"hcp_id": "...", "hcp_name": "Dr. X", "preview": "...", "relevance": 0.85}]

# event: turn_change     -- active speaker changed
# data: {"speaker_id": "...", "speaker_name": "Dr. X", "action": "asking|listening"}

# event: sub_state       -- sub-state transition
# data: {"sub_state": "presenting|qa", "message": "..."}

# event: transcription   -- live transcription line
# data: {"speaker": "MR|Dr. X", "text": "...", "timestamp": "..."}
```

### Pattern 4: Conference Prompt Engineering

**What:** System prompts for multi-HCP audience behavior
**When to use:** Building LLM requests for conference HCP responses

```python
# backend/app/services/prompt_builder.py (extend with conference functions)
def build_conference_audience_prompt(
    hcp_profiles: list[HcpProfile],
    scenario: Scenario,
    presentation_topic: str,
    conversation_history: list[dict],
    current_hcp: HcpProfile,
    other_hcp_questions: list[dict],  # prior Q&A from other HCPs
) -> str:
    """Build system prompt for a specific HCP in conference audience.

    Each HCP generates questions based on:
    1. Their personality and expertise
    2. The MR's presentation content
    3. Questions already asked by other HCPs (to avoid duplication, enable follow-ups)
    """
    ...
```

### Pattern 5: Conference UI Layout (Stage + Audience + Transcription)

**What:** Three-area responsive layout for conference mode
**When to use:** Conference presentation page

```
+-------------------------------------------------------------------+
| Header: Timer | Topic | Sub-state (Presenting/Q&A) | End Session  |
+-------------------+----------------------------+------------------+
| Topic Guide       |  Conference Stage          | Transcription    |
| (collapsible)     |  - Avatar area (single)    | Panel            |
|                   |  - MR input area           | (scrolling,      |
| [ ] Key topic 1   |  - Streaming response area | auto-scroll,     |
| [x] Key topic 2   |                            | collapsible)     |
| [ ] Key topic 3   |                            |                  |
+-------------------+----------------------------+------------------+
| Audience Panel: HCP cards in horizontal row with status badges     |
| [Dr. A: listening] [Dr. B: hand-raised] [Dr. C: speaking]         |
+-------------------------------------------------------------------+
| Question Queue: Click-to-respond on queued questions               |
+-------------------------------------------------------------------+
```

### Anti-Patterns to Avoid

- **Separate session table for conference:** Do NOT create a `ConferenceSession` table. Extend `CoachingSession` with `session_type` field to reuse lifecycle/scoring infrastructure.
- **WebSocket per HCP:** Do NOT create individual WebSocket connections per HCP. Use single SSE stream with speaker attribution events -- simpler, matches existing pattern.
- **Parallel LLM calls for all HCPs simultaneously:** Do NOT call LLM for all 3-5 HCPs at once. Generate questions one at a time, queue them, and present via turn management. This prevents rate limiting and keeps costs manageable.
- **Embedding voice SDK calls in router layer:** Voice integration MUST go through adapter pattern (BaseSTTAdapter/BaseTTSAdapter). Router calls service, service calls adapter. Never import azure.cognitiveservices.speech directly in a router.
- **Breaking existing F2F flow:** Conference additions MUST NOT modify existing F2F endpoints or session creation. The `session_type` defaults to "f2f", so zero impact on existing functionality.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Speech-to-text | Custom audio processing pipeline | Azure Speech SDK `SpeechRecognizer` | Handles noise, accents, streaming, zh-CN/en-US |
| Text-to-speech | Custom audio synthesis | Azure Speech SDK `SpeechSynthesizer` | SSML support, neural voices, streaming output |
| SSE streaming | Custom event stream protocol | `sse-starlette` EventSourceResponse | Already in use, handles reconnection, buffering |
| Question queue ordering | Custom priority queue from scratch | Python `dataclass` list with sort | Simple enough, no external dependency needed |
| Audio playback in browser | Custom Web Audio API handling | HTML5 `<audio>` element with Blob URLs | Standard, cross-browser, handles buffering |
| Multi-speaker chat UI | Custom chat from scratch | Extend existing ChatBubble with speaker prop | Reuse design tokens, accessibility, i18n |

**Key insight:** The voice integration layer should be thin adapters around Azure Speech SDK. The conference orchestration is the novel part; voice is a pluggable concern that works identically for F2F and conference modes.

## Common Pitfalls

### Pitfall 1: SQLite ALTER COLUMN limitations
**What goes wrong:** Alembic migration fails when adding columns with non-null constraints or foreign keys to existing tables
**Why it happens:** SQLite does not support `ALTER TABLE ... ADD COLUMN ... FOREIGN KEY`
**How to avoid:** Use `render_as_batch=True` in alembic `env.py` (already configured). For new columns on existing tables, always use nullable=True or provide server_default.
**Warning signs:** Migration works in PostgreSQL but fails in dev SQLite

### Pitfall 2: Azure Speech SDK is synchronous by default
**What goes wrong:** Calling `speech_recognizer.recognize_once()` blocks the async event loop
**Why it happens:** Azure Speech SDK for Python uses callbacks, not native asyncio
**How to avoid:** Wrap blocking SDK calls in `asyncio.to_thread()` or use the SDK's async pattern with `recognize_once_async()` which returns a `Future`. The SDK has `_async` variants of methods.
**Warning signs:** FastAPI endpoint hangs during STT/TTS processing

### Pitfall 3: SSE connection drops on long conference sessions
**What goes wrong:** SSE stream disconnects after browser/proxy timeout (typically 30-60s idle)
**Why it happens:** No keepalive/heartbeat events during presentation pauses
**How to avoid:** Send periodic `event: heartbeat` with empty data every 15-20 seconds during active conference sessions. The SSE event generator should include a heartbeat mechanism.
**Warning signs:** Frontend shows "connection lost" during quiet presentation periods

### Pitfall 4: Race condition in multi-HCP question generation
**What goes wrong:** Two HCPs generate identical or contradictory questions about the same MR statement
**Why it happens:** LLM calls for different HCPs don't see each other's pending questions
**How to avoid:** Generate HCP questions sequentially (not in parallel), passing prior HCP questions as context to subsequent calls. Use the `other_hcp_questions` parameter in prompt builder.
**Warning signs:** Audience questions feel repetitive or disconnected

### Pitfall 5: Message ordering in conference multi-speaker context
**What goes wrong:** Messages from different HCPs get interleaved with incorrect message_index values
**Why it happens:** Concurrent save_message calls with count-based index calculation
**How to avoid:** Use database-level auto-increment or serialize message saves through the conference service (not parallel). The existing `message_index` counting pattern works if saves are sequential.
**Warning signs:** Conversation history appears out of order on page reload

### Pitfall 6: Azure Speech SDK binary wheel not available for all platforms
**What goes wrong:** `pip install azure-cognitiveservices-speech` fails on certain architectures
**Why it happens:** The SDK includes native binaries, not available for all OS/arch combos
**How to avoid:** Add as optional dependency group in `pyproject.toml` (like `[postgresql]`). Feature toggle `feature_voice_enabled` ensures the app works without it.
**Warning signs:** CI fails on install; Docker build fails on different base image

### Pitfall 7: TTS voice assignment not persisted
**What goes wrong:** Each conference session assigns random voices, HCPs sound different each time
**Why it happens:** Voice IDs are not stored in the scenario/HCP configuration
**How to avoid:** Store `voice_id` in `ConferenceAudienceHcp` join table, so each HCP consistently uses the same voice across sessions.
**Warning signs:** Same HCP has different voice in different sessions

## Code Examples

### Example 1: Conference Session Creation (Backend Service)
```python
# backend/app/services/conference_service.py
async def create_conference_session(
    db: AsyncSession, scenario_id: str, user_id: str
) -> CoachingSession:
    """Create a conference session with multi-HCP audience setup."""
    # Verify scenario is conference mode
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if scenario is None:
        raise NotFoundException("Scenario not found")
    if scenario.mode != "conference":
        raise AppException(
            status_code=409,
            code="NOT_CONFERENCE_SCENARIO",
            message="Scenario is not configured for conference mode",
        )

    # Load audience HCPs
    audience_result = await db.execute(
        select(ConferenceAudienceHcp)
        .options(selectinload(ConferenceAudienceHcp.hcp_profile))
        .where(ConferenceAudienceHcp.scenario_id == scenario_id)
        .order_by(ConferenceAudienceHcp.sort_order)
    )
    audience_hcps = list(audience_result.scalars().all())
    if len(audience_hcps) < 2:
        raise AppException(
            status_code=409,
            code="INSUFFICIENT_AUDIENCE",
            message="Conference scenario needs at least 2 HCP audience members",
        )

    # Build audience config JSON
    audience_config = [
        {
            "hcp_profile_id": ah.hcp_profile_id,
            "name": ah.hcp_profile.name,
            "specialty": ah.hcp_profile.specialty,
            "personality_type": ah.hcp_profile.personality_type,
            "role": ah.role_in_conference,
            "voice_id": ah.voice_id,
        }
        for ah in audience_hcps
    ]

    # Initialize key messages tracking
    key_messages = json.loads(scenario.key_messages)
    key_messages_status = [
        {"message": msg, "delivered": False, "detected_at": None} for msg in key_messages
    ]

    session = CoachingSession(
        user_id=user_id,
        scenario_id=scenario_id,
        status="created",
        session_type="conference",
        sub_state="presenting",
        presentation_topic=scenario.description,
        audience_config=json.dumps(audience_config),
        key_messages_status=json.dumps(key_messages_status),
    )
    db.add(session)
    await db.flush()
    return session
```

### Example 2: Multi-Speaker SSE Streaming (Backend)
```python
# backend/app/api/conference.py -- event generator pattern
async def conference_event_generator(
    session: CoachingSession, request_data: dict, db: AsyncSession
):
    """Generate SSE events for conference interaction with speaker attribution."""
    audience_config = json.loads(session.audience_config)

    if request_data.get("action") == "present":
        # MR is presenting -- save transcription, detect key messages
        mr_text = request_data["message"]
        await session_service.save_message(db, session.id, "user", mr_text)

        yield {"event": "transcription", "data": json.dumps({
            "speaker": "MR", "text": mr_text,
            "timestamp": datetime.now(UTC).isoformat(),
        })}

        # Generate HCP questions (sequential, not parallel)
        for hcp_config in audience_config:
            question = await _generate_hcp_question(
                db, session, hcp_config, mr_text
            )
            if question:
                turn_manager.add_question(session.id, question)
                yield {"event": "queue_update", "data": json.dumps(
                    _serialize_queue(turn_manager.get_queue(session.id))
                )}

    elif request_data.get("action") == "respond":
        # MR responding to a specific HCP's question
        hcp_id = request_data["target_hcp_id"]
        turn_manager.activate_question(session.id, hcp_id)
        # ... stream response, save messages with speaker attribution
```

### Example 3: Azure Speech STT Adapter
```python
# backend/app/services/agents/stt/azure.py
import asyncio
import azure.cognitiveservices.speech as speechsdk
from app.services.agents.stt.base import BaseSTTAdapter

class AzureSTTAdapter(BaseSTTAdapter):
    """Azure Speech-to-Text adapter using Cognitive Services SDK."""

    name = "azure"

    def __init__(self, key: str, region: str) -> None:
        self._key = key
        self._region = region

    async def transcribe(self, audio_data: bytes, language: str = "zh-CN") -> str:
        """Transcribe audio bytes to text using Azure Speech SDK."""
        speech_config = speechsdk.SpeechConfig(
            subscription=self._key, region=self._region
        )
        speech_config.speech_recognition_language = language

        # Use push stream for audio bytes
        push_stream = speechsdk.audio.PushAudioInputStream()
        push_stream.write(audio_data)
        push_stream.close()
        audio_config = speechsdk.audio.AudioConfig(stream=push_stream)

        recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config, audio_config=audio_config
        )

        # Use async variant to avoid blocking event loop
        result = await asyncio.to_thread(recognizer.recognize_once)

        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            return result.text
        elif result.reason == speechsdk.ResultReason.NoMatch:
            return ""
        else:
            raise RuntimeError(f"STT error: {result.reason}")

    async def is_available(self) -> bool:
        return bool(self._key and self._region)
```

### Example 4: Conference Session Page (Frontend)
```typescript
// frontend/src/pages/user/conference-session.tsx (structure outline)
export default function ConferenceSession() {
  const { t } = useTranslation("conference");
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("id") ?? "";

  const { data: session } = useSession(sessionId || undefined);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [questionQueue, setQuestionQueue] = useState<QueuedQuestion[]>([]);
  const [audienceHcps, setAudienceHcps] = useState<AudienceHcp[]>([]);

  // Extended SSE callbacks for conference events
  const sseCallbacks = useMemo(() => ({
    onText: (chunk: string) => { /* ... */ },
    onSpeakerText: (data: SpeakerTextEvent) => {
      setTranscriptLines(prev => [...prev, {
        speaker: data.speaker_name,
        text: data.content,
        timestamp: new Date(),
      }]);
    },
    onQueueUpdate: (queue: QueuedQuestion[]) => setQuestionQueue(queue),
    onTurnChange: (data: TurnChangeEvent) => {
      setAudienceHcps(prev => prev.map(hcp =>
        hcp.id === data.speaker_id
          ? { ...hcp, status: data.action }
          : { ...hcp, status: "listening" }
      ));
    },
    onDone: () => { /* ... */ },
    onError: (error: string) => console.error("Conference SSE error:", error),
  }), []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white">
      {/* Header */}
      <ConferenceHeader session={session} onEndSession={handleEndSession} />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <TopicGuide topics={keyMessagesStatus} isCollapsed={leftCollapsed} />
        <ConferenceStage
          sessionId={sessionId}
          onSendMessage={handlePresent}
          isStreaming={isStreaming}
          streamingText={streamedText}
        />
        <TranscriptionPanel lines={transcriptLines} isCollapsed={rightCollapsed} />
      </div>

      {/* Audience + Question Queue */}
      <AudiencePanel hcps={audienceHcps} />
      <QuestionQueue
        questions={questionQueue}
        onRespondTo={handleRespondToQuestion}
      />
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single HCP per scenario FK | Multi-HCP via join table | Phase 6 | Enables conference audience |
| `role: "user" \| "assistant"` messages | Add `speaker_id` + `speaker_name` | Phase 6 | Multi-speaker attribution |
| F2F-only SSE events | Extended events with speaker, queue, turn | Phase 6 | Conference real-time UI |
| Mock-only STT/TTS adapters | Azure Speech SDK adapters alongside mock | Phase 6 | Voice integration |

**Deprecated/outdated:**
- Azure Speech SDK versions below 1.40 lack some neural voice features used in TTS voice mapping. Use 1.48.x.
- GPT Realtime API is explicitly deferred -- do not implement in this phase.

## Open Questions

1. **Conference scoring prompt adaptation**
   - What we know: Existing scoring_service.py and scoring prompt work for 1:1 F2F transcripts with "MR" and "HCP" labels
   - What's unclear: How to weight presentation clarity, Q&A handling, and audience engagement as separate dimensions vs. mapping to existing 5 dimensions
   - Recommendation: Reuse existing 5 dimensions but adjust the scoring prompt to evaluate "key_message" as "presentation completeness", "objection_handling" as "Q&A handling", "communication" as "presentation delivery". This avoids schema changes while providing conference-appropriate feedback. Details are in Claude's Discretion.

2. **Heartbeat mechanism for long SSE connections**
   - What we know: Browser/proxy timeouts typically cut idle SSE connections at 30-60s
   - What's unclear: Exact timeout behavior through Vite dev proxy and nginx production proxy
   - Recommendation: Implement 15-second heartbeat events in the conference SSE generator. Test with both dev proxy and nginx.

3. **Azure TTS voice selection for zh-CN HCPs**
   - What we know: Azure has 100+ zh-CN neural voices with different genders/ages/styles
   - What's unclear: Which specific voices provide the best diversity for a 3-5 HCP audience
   - Recommendation: Pre-select a curated list of 6-8 distinct zh-CN voices (3-4 male, 3-4 female) and map to personality types. Store as default voice mapping in config/seed data. Allow admin override via `voice_id` in ConferenceAudienceHcp.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | Backend | Needs check | - | Required, no fallback |
| Node.js 20+ | Frontend | Needs check | - | Required, no fallback |
| SQLite (aiosqlite) | Dev database | Available | Already in use | - |
| azure-cognitiveservices-speech | COACH-04, COACH-05 | Not installed | 1.48.2 available | Mock adapter (text-only) |
| Azure Speech API key | COACH-04, COACH-05 | Config-dependent | - | Mock adapter (feature toggle) |
| Azure Avatar API | COACH-07 | Config-dependent | - | Mock adapter (feature toggle) |

**Missing dependencies with no fallback:**
- None -- all voice/avatar features use feature toggles and fall back to mock/text-only

**Missing dependencies with fallback:**
- `azure-cognitiveservices-speech`: Not installed, add as optional dependency group `[voice]`. App works fully in text-only mode via mock adapters.
- Azure Speech API credentials: Required for real STT/TTS. Falls back to mock adapters when credentials not configured.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `backend/app/models/session.py`, `backend/app/services/session_service.py`, `backend/app/api/sessions.py` -- verified session lifecycle, message model, SSE streaming pattern
- Existing codebase analysis: `backend/app/services/agents/base.py`, `backend/app/services/agents/registry.py` -- verified adapter pattern, ServiceRegistry categories
- Existing codebase analysis: `backend/app/services/agents/stt/base.py`, `backend/app/services/agents/tts/base.py`, `backend/app/services/agents/avatar/base.py` -- verified abstract bases for all voice adapters
- Existing codebase analysis: `backend/app/config.py` -- verified feature toggles (feature_conference_enabled, feature_voice_enabled, feature_avatar_enabled)
- Existing codebase analysis: `backend/app/models/scenario.py` -- verified `mode` field already supports `f2f/conference`
- pip index: `azure-cognitiveservices-speech` latest version 1.48.2 (verified 2026-03-25)

### Secondary (MEDIUM confidence)
- Azure Speech SDK Python documentation (from training data, May 2025): `SpeechRecognizer`, `SpeechSynthesizer`, push/pull audio streams, `recognize_once_async()` pattern
- SSE event extension pattern: based on existing `sse-starlette` usage in codebase, extending with new event types is a standard pattern

### Tertiary (LOW confidence)
- Azure TTS zh-CN voice catalog: specific voice IDs and availability may have changed since training data cutoff. Recommend runtime discovery via SDK `list_voices()` method or Azure portal check.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all core libraries already in use, only adding optional azure-cognitiveservices-speech
- Architecture: HIGH - extending well-established patterns (session model, SSE streaming, adapter registry, service layer)
- Database schema: HIGH - straightforward join table addition, column additions via Alembic batch migration
- Turn management: MEDIUM - novel in-memory queue pattern, but straightforward Python data structures
- Voice integration: MEDIUM - Azure Speech SDK is well-documented but async wrapping needs care
- Conference UI: HIGH - reuses existing component patterns (ChatBubble, ScrollArea, Badge, Avatar), new layout is composition

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable -- core patterns are established project conventions, Azure SDK is mature)
