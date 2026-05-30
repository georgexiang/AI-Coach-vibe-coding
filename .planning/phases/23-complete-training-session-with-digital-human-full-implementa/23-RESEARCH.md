# Phase 23: Complete Training Session with Digital Human - Research

**Researched:** 2026-05-07
**Domain:** Unified training session UI + async voice scoring + Azure Content Understanding
**Confidence:** HIGH

## Summary

This phase unifies three separate session pages (text `training-session.tsx`, voice `voice-session.tsx`, and conference `conference-session.tsx`) into a single voice-dominant training session page with in-session mode switching (text/voice/digital human). The existing `VoiceSession` component (508 lines) already contains most of the voice/avatar functionality needed; the text-mode `TrainingSession` (280 lines) handles SSE-based text chat. The unified page must compose both capabilities with shared conversation history.

The scoring system requires extension: currently only content-based scoring via LLM exists (`scoring_engine.py`). Phase 23 adds async voice quality scoring via Azure Content Understanding — audio is saved to storage (Azure Blob or local), then analyzed post-session for voice-specific dimensions (fluency, pace, pronunciation, tone). The existing `ScoringRubric` model already supports arbitrary dimensions with configurable weights, so the schema extension is minimal (add `audio_url` to session model, add `voice_score` fields).

The i18n infrastructure is mature (react-i18next with 12 namespaces, lazy-loaded). New strings go into existing `voice.json` and `coach.json` namespaces plus a new `session.json` namespace for the unified page.

**Primary recommendation:** Build the unified session page as a new component that composes existing hooks (`useSSEStream`, `useVoiceLive`, `useAvatarStream`, `useAudioHandler`) with a mode-switching state machine. Implement audio recording as a parallel capture stream (MediaRecorder API) alongside the existing AudioWorklet-based voice input. Backend extension: add `audio_url` column to `coaching_sessions`, implement `AudioStorageService` on top of existing `StorageBackend` protocol, create `VoiceScoringService` that calls Content Understanding post-session.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Unified entry, mode switching — merge into one training session page, users can switch between text/voice/digital-human modes. Deprecate separate `training-session.tsx` and `voice-session.tsx`.
- **D-02:** Voice-dominant layout — left: digital human video/voice waveform + controls; right: conversation transcript + hints/config panel.
- **D-03:** Text mode left panel shows HCP avatar + name + specialty + scenario description + Key Messages checklist (replacing video area). Right panel: chat + coaching hints.
- **D-04:** Real-time mode switching in-session — context preserved, conversation history maintained across mode switches.
- **D-05:** Voice is the default mode. Text mode available per user preference or Skill requirements.
- **D-06:** Must preserve ALL original session info (text transcripts + audio recordings) for Content Understanding scoring.
- **D-07:** Inline prompt cards for guidance (not a step-wizard). Cards disappear as user progresses.
- **D-08:** Mic permission denial auto-degrades to text mode with user notification.
- **D-09:** Dual-dimension scoring — existing content dimensions + new voice dimensions (fluency, tone, pace, pronunciation clarity).
- **D-10:** Async post-session voice scoring — audio saved to Azure Blob, Content Understanding called after session ends, scores appear after delay.
- **D-11:** Extended radar chart with voice dimension nodes. Detailed report splits into content + voice sections. Voice section includes audio playback evidence.
- **D-12:** Voice language follows scenario/HCP config. STT/TTS auto-match.
- **D-13:** Digital human appearance follows HCP Profile config (avatar character + voice name from VL Instance).
- **D-14:** Full i18n — all user-visible text via `t()`, zh-CN + en-US complete coverage.

### Claude's Discretion
- Unified session page component split strategy
- Mode switch transition animations and loading states
- Audio recording format (WAV/WebM/OGG) and sample rate
- Azure Blob Storage audio file naming and retention policy
- Content Understanding API call parameters
- Voice scoring dimension weight distribution
- Guidance card disappearance logic (one-time vs localStorage persistence)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18+ | UI framework | Project standard [VERIFIED: package.json] |
| TanStack Query | v5 | Server state management | Project standard for all data fetching [VERIFIED: codebase] |
| react-i18next | 14+ | Internationalization | Day-1 i18n requirement [VERIFIED: i18n/index.ts] |
| recharts | 2.x | Radar chart visualization | Already used for scoring [VERIFIED: scoring/radar-chart.tsx] |
| FastAPI | 0.100+ | Backend API | Project standard [VERIFIED: backend] |
| SQLAlchemy 2.0 | async | ORM | Project standard [VERIFIED: models] |
| Alembic | - | Migrations | Project standard [VERIFIED: alembic/versions/] |
| httpx | - | Async HTTP client | Used for Azure API calls [VERIFIED: azure_content.py] |

### Supporting (New for Phase 23)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MediaRecorder API | Browser native | Audio recording to file | Record session audio for post-scoring [VERIFIED: Web API standard] |
| azure-storage-blob | 12.x | Azure Blob upload | Production audio storage [ASSUMED] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MediaRecorder API | RecordRTC | RecordRTC adds dependency; MediaRecorder is native and sufficient |
| Azure Blob Storage | Local filesystem | Local works for dev; Blob needed for production multi-instance |
| Separate voice scoring service | Inline in scoring_engine.py | Separate service keeps voice scoring concerns isolated |

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── pages/user/
│   └── unified-session.tsx          # New unified page (replaces training-session + voice-session)
├── components/session/              # New folder for unified session components
│   ├── unified-session-layout.tsx   # Main layout container (voice-dominant 2-panel)
│   ├── mode-switch-bar.tsx          # In-session mode switcher (text/voice/digital-human)
│   ├── left-panel/
│   │   ├── voice-panel.tsx          # Avatar + controls (voice/digital-human modes)
│   │   └── text-panel.tsx           # HCP info + key messages (text mode)
│   ├── right-panel/
│   │   ├── chat-transcript.tsx      # Unified conversation display (both modes)
│   │   ├── hints-coaching.tsx       # Coaching hints panel
│   │   └── config-tab.tsx           # Voice configuration
│   └── guidance-cards.tsx           # Inline tutorial cards (D-07)
├── hooks/
│   ├── use-unified-session.ts       # Session state machine (mode switching)
│   └── use-audio-recorder.ts        # MediaRecorder for audio file capture
└── components/scoring/
    ├── voice-score-section.tsx       # Voice scoring report section
    └── audio-evidence-player.tsx     # Audio playback for score evidence

backend/app/
├── services/
│   ├── audio_storage_service.py     # Audio upload to Blob/local storage
│   └── voice_scoring_service.py     # Azure Content Understanding async scoring
├── api/
│   └── sessions.py                  # Extended: audio upload endpoint, voice score polling
└── models/
    └── session.py                   # Extended: audio_url, voice_score_status fields
```

### Pattern 1: Unified Session State Machine
**What:** A state machine managing session mode (text/voice/digital_human), connection state, and conversation history across mode switches.
**When to use:** Whenever rendering the unified session page.
**Example:**
```typescript
// Source: Derived from existing voice-session.tsx + training-session.tsx patterns
type SessionMode = "text" | "voice" | "digital_human";
type ConnectionState = "idle" | "connecting" | "connected" | "error";

interface UnifiedSessionState {
  mode: SessionMode;
  connectionState: ConnectionState;
  messages: SessionMessage[];         // Text messages (SSE)
  transcripts: TranscriptSegment[];   // Voice transcripts
  isRecording: boolean;               // Audio file recording active
  keyMessagesStatus: KeyMessageStatus[];
}
```

### Pattern 2: Parallel Audio Capture
**What:** MediaRecorder runs independently of the AudioWorklet voice input, capturing raw audio to a Blob for post-session scoring.
**When to use:** Whenever voice mode is active and D-06 audio preservation is required.
**Example:**
```typescript
// Source: Web API MediaRecorder standard pattern
function useAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = (stream: MediaStream) => {
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.start(10000); // 10s chunks for reliability
    mediaRecorderRef.current = recorder;
  };

  const stopAndGetBlob = (): Blob => {
    mediaRecorderRef.current?.stop();
    return new Blob(chunksRef.current, { type: "audio/webm" });
  };

  return { startRecording, stopAndGetBlob };
}
```

### Pattern 3: Async Voice Scoring (Backend)
**What:** After session ends, a background task uploads audio and calls Content Understanding for voice quality analysis.
**When to use:** On session end when audio_url exists.
**Example:**
```python
# Source: Existing pattern from skill_evaluation_service.py (L2 durable background task)
import asyncio
from app.services.audio_storage_service import upload_audio
from app.services.voice_scoring_service import score_voice_quality

async def trigger_voice_scoring(session_id: str, audio_data: bytes):
    """Durable background task for async voice scoring."""
    async with get_async_session() as db:
        # 1. Upload audio to storage
        audio_url = await upload_audio(session_id, audio_data)
        # 2. Update session with audio reference
        session = await get_session_by_id(db, session_id)
        session.audio_url = audio_url
        # 3. Call Content Understanding
        voice_scores = await score_voice_quality(audio_url)
        # 4. Save voice scores
        await save_voice_scores(db, session_id, voice_scores)
        session.voice_score_status = "completed"
        await db.flush()
```

### Anti-Patterns to Avoid
- **Separate routes for each mode:** D-01 explicitly requires ONE unified page. Do NOT create new route per mode.
- **Breaking conversation history on switch:** D-04 requires history preservation. Never reset messages/transcripts on mode switch.
- **Synchronous voice scoring:** D-10 says async. Never block session end on Content Understanding response.
- **Coupling audio recording to voice input pipeline:** The AudioWorklet sends real-time chunks for voice interaction; the MediaRecorder captures for post-scoring. These are independent concerns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio recording | Custom PCM buffer accumulator | MediaRecorder API | Browser-native, handles encoding, supports WebM/Opus |
| Blob storage | Custom HTTP upload to Azure | `azure-storage-blob` SDK or existing `StorageBackend` protocol | Edge cases (chunked upload, retry, SAS tokens) |
| Voice quality analysis | Custom speech analysis algorithms | Azure Content Understanding API | Domain expertise, multi-language support |
| Radar chart extension | Custom SVG rendering | Existing `recharts` RadarChart (add data points) | Already working, just needs more dimensions |
| Audio playback in reports | Custom audio player | HTML5 `<audio>` element with controls | Standard, accessible, zero dependencies |

**Key insight:** Most complexity is in COMPOSITION of existing components, not building new primitives. The voice hooks, text chat hooks, avatar components, and scoring engine all exist. The work is wiring them together under a unified state machine.

## Common Pitfalls

### Pitfall 1: MediaRecorder MIME Type Support
**What goes wrong:** `audio/wav` is NOT supported by MediaRecorder in most browsers. Developers try WAV and get silent failures.
**Why it happens:** Browser MediaRecorder only supports container formats it can encode in real-time (WebM/Opus in Chrome, WebM/Opus or OGG in Firefox).
**How to avoid:** Use `audio/webm;codecs=opus` as primary, check `MediaRecorder.isTypeSupported()` before starting.
**Warning signs:** Empty or 0-byte audio blobs after recording. [VERIFIED: Web API documentation]

### Pitfall 2: AudioContext + MediaRecorder Conflict
**What goes wrong:** If both AudioWorklet (for voice input) and MediaRecorder (for audio capture) share the same MediaStream, stopping one can affect the other.
**Why it happens:** MediaStream tracks are shared references.
**How to avoid:** Clone the stream for MediaRecorder: `stream.clone()`. This gives an independent track that won't be affected by the AudioWorklet pipeline. [ASSUMED]

### Pitfall 3: Mode Switch During Active Voice Connection
**What goes wrong:** Switching from voice to text mode while Voice Live WebSocket is connected can leave dangling connections.
**Why it happens:** Voice Live connection cleanup is async; if not awaited before switching mode, resources leak.
**How to avoid:** Mode switch handler must `await stopVoiceSession()` before transitioning to text mode. Use the existing `useVoiceSessionLifecycle` hook's `stopSession` method. [VERIFIED: use-voice-session-lifecycle.ts]

### Pitfall 4: SSE Stream + Voice Transcript Merge
**What goes wrong:** Unified conversation display shows duplicates or out-of-order messages when both SSE (text mode) and voice transcripts (voice mode) feed into the same list.
**Why it happens:** Text mode uses `useSSEStream` which returns `SessionMessage[]` from API; voice mode uses local `TranscriptSegment[]` persisted via `persistTranscriptMessage`.
**How to avoid:** Use a single canonical message list backed by the session messages API. Voice transcripts are persisted to the same endpoint already (`persistTranscriptMessage`). After mode switch, refetch messages from API to get unified chronological list. [VERIFIED: voice-live.ts:persistTranscriptMessage]

### Pitfall 5: Content Understanding API Requires `.services.ai.azure.com` Domain
**What goes wrong:** Using `.cognitiveservices.azure.com` endpoint for Content Understanding returns 404 or auth errors.
**Why it happens:** Per project docs, Content Understanding ONLY works on `.services.ai.azure.com` domain.
**How to avoid:** Always use `get_effective_endpoint` which resolves to the correct domain. The existing `AzureContentUnderstandingAdapter` already uses the correct API path pattern. [VERIFIED: docs/microsoft-foundry/04-service-auth-and-routing.md]

### Pitfall 6: Audio Upload Size for Long Sessions
**What goes wrong:** A 30-minute voice session produces ~15-30 MB of WebM audio. Single-request upload may timeout.
**Why it happens:** Azure Blob Storage recommends chunked upload for files > 4 MB.
**How to avoid:** Use block blob upload with chunking, or upload in 10-second segments during the session (matching MediaRecorder's `timeslice` parameter). For MVP, single upload is acceptable for sessions < 15 minutes. [ASSUMED]

### Pitfall 7: Alembic Migration with SQLite Existing Rows
**What goes wrong:** Adding NOT NULL columns to existing tables fails on SQLite because existing rows have no value.
**Why it happens:** SQLite doesn't support `ALTER COLUMN ADD ... NOT NULL` without default.
**How to avoid:** Always use `server_default` for new columns on existing tables. This is a consistent project pattern (see Phase 08, 11, 12 decisions). [VERIFIED: STATE.md multiple phases]

## Code Examples

### Unified Session Page Route Change
```typescript
// Source: Existing router/index.tsx pattern
// BEFORE: Two separate full-screen routes
// { path: "/user/training/session", element: <TrainingSession /> }
// { path: "/user/training/voice", element: <VoiceSession /> }

// AFTER: Single unified route
{ path: "/user/training/session", element: <SuspensePage><UnifiedSession /></SuspensePage> }
// Keep /user/training/voice as redirect to /user/training/session for backward compat
```

### Mode-Aware Left Panel
```typescript
// Source: Derived from D-02 and D-03 decisions
function LeftPanel({ mode, ...props }: { mode: SessionMode }) {
  if (mode === "text") {
    return (
      <TextModePanel
        hcpProfile={props.hcpProfile}
        keyMessagesStatus={props.keyMessagesStatus}
        scenario={props.scenario}
      />
    );
  }
  return (
    <VoiceModePanel
      videoRef={props.videoRef}
      avatarStream={props.avatarStream}
      voiceControls={props.voiceControls}
      audioState={props.audioState}
    />
  );
}
```

### Session Model Extension (Backend)
```python
# Source: Existing session.py model pattern + D-06/D-10 requirements
class CoachingSession(Base, TimestampMixin):
    # ... existing fields ...

    # Phase 23: Audio storage for voice scoring
    audio_url: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    voice_score_status: Mapped[str] = mapped_column(
        String(20), default="none"
    )  # none / pending / processing / completed / failed
```

### Voice Scoring Service Pattern
```python
# Source: Derived from existing AzureContentUnderstandingAdapter pattern
import asyncio
import httpx

async def analyze_voice_quality(audio_url: str, language: str = "zh-CN") -> dict:
    """Call Azure Content Understanding to analyze voice quality metrics.

    Uses submit-then-poll pattern matching existing adapter in azure_content.py.
    Returns voice dimension scores.
    """
    endpoint = await config_service.get_effective_endpoint(db, "azure_content_understanding")
    api_key = await config_service.get_effective_key(db, "azure_content_understanding")

    # Custom analyzer for speech quality (not prebuilt-invoice)
    url = f"{endpoint}/contentunderstanding/analyzers/speech-quality:analyze?api-version=2025-11-01"
    headers = {"Ocp-Apim-Subscription-Key": api_key, "Content-Type": "application/json"}
    body = {"url": audio_url, "locale": language}

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, json=body)
        # ... poll pattern same as azure_content.py ...
```

### Audio Upload Endpoint
```python
# Source: Derived from existing StorageBackend protocol
@router.post("/{session_id}/audio", status_code=201)
async def upload_session_audio(
    session_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload recorded audio for a session (called on session end)."""
    session = await session_service.get_session(db, session_id, user.id)
    storage = get_audio_storage()
    audio_path = f"sessions/{session_id}/recording.webm"
    audio_url = await storage.save(audio_path, await file.read())
    session.audio_url = audio_url
    session.voice_score_status = "pending"
    await db.flush()
    # Trigger async voice scoring
    asyncio.create_task(trigger_voice_scoring_task(session_id))
    return {"audio_url": audio_url}
```

### Extended Scoring Radar Chart
```typescript
// Source: Extending existing scoring/radar-chart.tsx
// The radar chart already handles arbitrary dimensions from score.details
// Voice dimensions will just be additional ScoreDetail records in the DB
// No chart code change needed — just pass more dimensions from API response
const currentScores = score.details.map((d) => ({
  dimension: d.dimension,  // Will now include "Fluency", "Pace", "Tone" etc.
  score: d.score,
}));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate pages per mode | Unified session with mode switching | Phase 23 | Single entry point, better UX |
| Content-only scoring | Dual content + voice scoring | Phase 23 | Richer feedback, speech quality metrics |
| Synchronous scoring | Async scoring with polling | Phase 23 | Non-blocking session end, handles slow analysis |
| Manual mode selection before session | In-session real-time switching | Phase 23 | Flexibility, graceful degradation |

**Deprecated/outdated:**
- `training-session.tsx` standalone page: Merged into unified session
- `voice-session.tsx` standalone page: Merged into unified session
- Text-only scoring: Superseded by dual-dimension scoring

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `audio/webm;codecs=opus` is suitable for Azure Content Understanding input | Audio Recording | Content Understanding may require WAV/PCM; would need transcoding |
| A2 | Azure Content Understanding supports custom speech quality analyzers | Voice Scoring | May need to use Azure Speech SDK pronunciation assessment instead |
| A3 | `azure-storage-blob` SDK 12.x is the current production version | Stack | Minor — version may differ, API stable |
| A4 | Stream cloning (`stream.clone()`) prevents AudioWorklet/MediaRecorder interference | Pitfall 2 | May need separate getUserMedia calls instead |
| A5 | Single-upload audio (non-chunked) works for typical 10-15 min sessions (~10MB) | Pitfall 6 | May need chunked upload for longer sessions |
| A6 | Content Understanding custom analyzer API path matches the pattern in existing adapter | Code Examples | May need different analyzer name or API version |
| A7 | Voice scoring dimensions (fluency, pace, tone, pronunciation) are returned by Content Understanding | Scoring | May need to combine CU with Speech SDK pronunciation assessment for full metrics |

## Open Questions

1. **Content Understanding vs Speech SDK for Voice Quality**
   - What we know: Azure Content Understanding exists and is already integrated (adapter in `azure_content.py`). Azure Speech SDK also has Pronunciation Assessment API.
   - What's unclear: Which service provides the specific voice quality dimensions (fluency, pace, tone, pronunciation clarity) that D-09 requires. Content Understanding may only do document/invoice analysis, not speech quality.
   - Recommendation: Implement with a pluggable `VoiceScoringBackend` protocol (like `StorageBackend`). Start with Content Understanding adapter; if it doesn't support speech quality metrics, swap to Speech SDK Pronunciation Assessment. Both use similar async patterns.

2. **Audio Format for Content Understanding**
   - What we know: MediaRecorder outputs WebM/Opus natively. Azure Speech SDK typically wants WAV/PCM.
   - What's unclear: What audio formats Content Understanding accepts for speech analysis.
   - Recommendation: Record as WebM/Opus (browser-native, small size). If Content Understanding needs WAV, add server-side transcoding via `ffmpeg` or accept WAV via MediaRecorder in browsers that support it.

3. **Scoring Rubric Extension Strategy**
   - What we know: `ScoringRubric` stores dimensions as JSON array with `name`, `weight`, `criteria`. Rubrics are per-scenario type (`f2f`/`conference`).
   - What's unclear: Should voice dimensions be in the SAME rubric (merged with content dimensions) or a SEPARATE voice-specific rubric?
   - Recommendation: Same rubric, additional dimensions with `category: "voice"` tag in the JSON. This keeps the single-rubric-per-scenario pattern intact and the radar chart automatically renders all dimensions.

4. **Audio Recording During Full Session vs Voice-Only Segments**
   - What we know: D-06 says preserve ALL original info. D-04 says mode switching is allowed mid-session.
   - What's unclear: If user switches text -> voice -> text -> voice, should we get one continuous audio file or multiple segments?
   - Recommendation: Record one continuous file during voice segments. Stop recording when in text mode, resume when back in voice mode. The final upload is a single concatenated file (or multiple files with timestamps). This matches the MediaRecorder pause/resume API.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build | Likely available | 18+ expected | -- |
| Python 3.11+ | Backend | Likely available | 3.11+ expected | -- |
| MediaRecorder API | Audio recording | Browser-native | -- | RecordRTC polyfill |
| Azure Content Understanding | Voice scoring | Config-dependent | API 2025-11-01 | Mock scoring fallback |
| Azure Blob Storage | Audio storage | Config-dependent | -- | Local filesystem (StorageBackend protocol) |

**Missing dependencies with no fallback:**
- None blocking — all have viable fallbacks for development.

**Missing dependencies with fallback:**
- Azure Blob Storage: Falls back to `LocalStorageBackend` (already implemented)
- Azure Content Understanding: Falls back to mock voice scoring (same pattern as `_generate_mock_scores`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing JWT Bearer (no change) |
| V3 Session Management | yes | Existing session lifecycle (no change) |
| V4 Access Control | yes | `get_current_user` + session ownership check (existing) |
| V5 Input Validation | yes | Pydantic v2 schemas for audio upload (max size, content-type check) |
| V6 Cryptography | no | No new crypto requirements |

### Known Threat Patterns for Phase 23

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Audio file upload abuse (oversized/malicious files) | Denial of Service | File size limit (50MB max), content-type validation, virus scan in production |
| Unauthorized audio access | Information Disclosure | SAS tokens with expiry for Blob URLs, session ownership check |
| Audio URL injection in scoring response | Tampering | Server generates audio URLs, never accepts from client in scoring context |

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `frontend/src/pages/user/training-session.tsx` — text session patterns
- Codebase inspection: `frontend/src/components/voice/voice-session.tsx` — voice session patterns
- Codebase inspection: `backend/app/services/scoring_service.py` — existing scoring architecture
- Codebase inspection: `backend/app/services/agents/adapters/azure_content.py` — Content Understanding adapter
- Codebase inspection: `frontend/src/hooks/use-voice-session-lifecycle.ts` — voice lifecycle hook
- Codebase inspection: `backend/app/services/storage/__init__.py` — StorageBackend protocol
- Project docs: `docs/microsoft-foundry/04-service-auth-and-routing.md` — CU endpoint requirements

### Secondary (MEDIUM confidence)
- MDN Web Docs: MediaRecorder API documentation (standard Web API)
- Project conventions: STATE.md accumulated decisions (server_default pattern, background task pattern)

### Tertiary (LOW confidence)
- Azure Content Understanding speech quality analysis capabilities (web search unavailable, based on training knowledge)
- `azure-storage-blob` SDK version (assumed from training knowledge)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all core libraries already in project, verified via codebase
- Architecture: HIGH - patterns derived directly from existing code with clear composition strategy
- Pitfalls: HIGH for browser/MediaRecorder issues, MEDIUM for Azure CU specifics
- Voice scoring: MEDIUM - Content Understanding integration pattern known, but specific speech quality analyzer capabilities are assumed

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (30 days — architecture is stable, Azure CU details may evolve)
