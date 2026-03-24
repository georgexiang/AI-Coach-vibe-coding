# Phase 2: F2F Text Coaching and Scoring - Research

**Researched:** 2026-03-24
**Domain:** AI coaching simulation, real-time streaming chat, multi-dimensional scoring, admin CRUD
**Confidence:** HIGH

## Summary

Phase 2 transforms the foundation from Phase 1 into a working AI coaching platform. It requires five major workstreams: (1) database models and Alembic migrations for HCP profiles, scenarios, coaching sessions, messages, and scores; (2) backend API routers and services for CRUD operations, streaming chat via SSE, and post-session scoring; (3) admin UI pages for managing HCP profiles and scenarios; (4) user-facing coaching UI with a 3-column layout, real-time chat, key message tracking, and coaching hints; (5) post-session scoring feedback page with radar chart visualization.

The existing codebase provides strong foundations: `BaseCoachingAdapter` with `CoachEvent` streaming, `ServiceRegistry` for adapter management, auth/role system, 17 shadcn/ui components, i18n setup, and Tailwind v4 design tokens including scoring semantic colors. The primary technical challenges are SSE streaming through the Vite proxy, system prompt engineering for HCP personality fidelity, and the linked scoring weight sliders that must total 100%.

**Primary recommendation:** Use SSE (Server-Sent Events) via `sse-starlette` for streaming HCP responses (simpler than WebSocket for text-only, one-directional streaming). Add `recharts` for the radar chart on the scoring page. Extend `BaseCoachingAdapter` and `CoachEvent` types for conversation context and key message tracking. Maximize parallelization with 4 independent workstreams: backend models/API, admin UI, coaching UI, and scoring engine/UI.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** AI HCP responds with streaming word-by-word via SSE/WebSocket -- extends existing CoachEvent streaming pattern from `BaseCoachingAdapter`
- **D-02:** Coaching hints use hybrid approach -- static scenario hints loaded at session start + contextual hints triggered at key conversation moments (e.g., when MR misses an objection handling opportunity). Separate AI call for milestone triggers.
- **D-03:** Key message tracking via AI auto-detection -- after each MR message, AI evaluates whether any key messages were delivered, checklist updates automatically in real-time
- **D-04:** Scoring is post-session only -- single AI analysis of full transcript after "End Session". No real-time score preview during conversation.
- **D-05:** Full feedback report per Figma spec (06-scoring-feedback.md) -- radar chart comparing current vs previous session, dimension score bars (green>80, orange 60-80, red<60), detailed strengths/weaknesses with conversation quotes, actionable suggestions per dimension
- **D-06:** Session end via manual button + HCP-initiated -- MR can click "End Session" anytime, AI HCP may also initiate end ("I need to go to my next patient") after key messages are covered or based on session duration. Most realistic simulation.
- **D-07:** HCP profile editor uses full form layout per Figma spec (09-admin-hcp-scenarios.md) -- left sidebar HCP list + right editor panel with identity fields, personality sliders, knowledge background, and interaction rules
- **D-08:** Scoring weights use linked sliders totaling 100% -- when one slider increases, others decrease proportionally. 5 dimensions: Key Message Delivery, Objection Handling, Communication Skills, Product Knowledge, Scientific Information
- **D-09:** Quick "Test Chat" feature for HCP profiles -- admin can open a mini-chat dialog to test HCP personality before assigning to scenarios. Uses same coaching engine.
- **D-10:** Strict character adherence -- AI strictly stays in character per HCP profile. Personality type, objections, knowledge, and communication style are all enforced in the system prompt.
- **D-11:** Full session context for conversation memory -- entire conversation history sent with each turn.
- **D-12:** Realistic mock provider with templates -- pre-scripted responses based on scenario context with personality-appropriate variations and some randomization.
- **D-13:** Plans should maximize parallelization -- backend models/API, admin UI, coaching UI, and scoring engine can be developed as parallel workstreams.

### Claude's Discretion
- System prompt engineering for HCP character fidelity (exact prompt structure, token budgets)
- SSE vs WebSocket choice for streaming (SSE recommended for text-only, simpler)
- Database schema details for HCP profiles, scenarios, sessions, messages, scores
- Scenario editor modal vs inline expand (Figma spec shows both options)
- Azure service config UI layout (PLAT-03 -- admin configures Azure connections)
- Session timer implementation details
- Responsive adaptations of 3-column F2F coaching layout for tablet/mobile

### Deferred Ideas (OUT OF SCOPE)
- Voice interaction (STT/TTS) -- Phase 3
- AI Avatar visual for HCP -- Phase 3
- Conference presentation mode -- Phase 3
- PDF export for scoring reports -- Phase 3+
- Training material upload and RAG grounding -- Phase 3
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HCP-01 | Admin can create/edit HCP profiles with name, specialty, personality, emotional state, communication style, knowledge background | Database model design + admin CRUD API + HCP editor form per Figma 09 spec |
| HCP-02 | Admin can define typical objections and interaction rules per HCP | JSON array columns on HcpProfile model, editable list UI component |
| HCP-03 | Admin can create/edit training scenarios with product, therapeutic area, key messages, difficulty | Scenario model + CRUD API + scenario management table per Figma 09 spec |
| HCP-04 | Admin can assign HCP profiles to scenarios and configure scoring dimension weights | FK relationship HcpProfile->Scenario, linked slider component totaling 100% |
| HCP-05 | Admin can set pass/fail threshold per scenario with weighted scoring criteria totaling 100% | Pass threshold field + scoring weights validation (sum = 100) |
| COACH-01 | User can start a text-based F2F coaching session with AI HCP based on selected scenario | Session lifecycle management, coaching adapter integration, chat UI |
| COACH-02 | AI HCP responds in character per HCP profile and scenario context | System prompt engineering, personality enforcement, adapter pattern |
| COACH-03 | Real-time key message delivery tracking -- checklist updates during conversation | AI auto-detection via CoachEvent metadata, real-time SSE updates |
| COACH-08 | Real-time coaching hints in side panel | Hybrid static + contextual hints, separate AI call for triggers |
| COACH-09 | Conversations immutable once completed | Session status lifecycle (created -> in_progress -> completed -> scored), no message editing after completion |
| SCORE-01 | System scores completed sessions across 5-6 configurable dimensions | Post-session AI analysis, dimension score storage, weighted calculation |
| SCORE-02 | Scoring uses Azure OpenAI to analyze transcript against criteria | Scoring adapter using same provider abstraction, mock scoring adapter |
| SCORE-03 | Feedback report shows strengths/weaknesses with conversation quotes | AI generates per-dimension feedback with quote extraction |
| SCORE-04 | Feedback includes actionable improvement suggestions per dimension | AI generates suggestions, stored in score detail records |
| SCORE-05 | Scoring dimension weights configurable per scenario | Weight fields on scenario model, applied during score calculation |
| UI-03 | F2F HCP Training page per Figma "F2F HCP Training Page Design" | 3-column layout: scenario/HCP/messages (left), chat (center), hints/tracker (right) |
| UI-05 | Scenario Selection page per Figma "Scenario Selection Page Design" | Card grid with filters, HCP avatar, difficulty badges, pagination |
| PLAT-03 | Admin can configure Azure service connections from web UI with connection testing | Admin config page, backend endpoint for connection test, settings storage |
</phase_requirements>

## Standard Stack

### Core (Backend -- New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sse-starlette | 2.3.5 | Server-Sent Events for streaming HCP responses | De facto SSE library for FastAPI/Starlette. Simpler than WebSocket for text-only streaming. Already installed on system, needs adding to pyproject.toml |
| openai | 1.51.0 (installed) | Azure OpenAI / OpenAI API calls for coaching and scoring | Already in dependencies. Used for both HCP conversation and post-session scoring |
| anthropic | 0.42.0 (installed) | Claude API client for coaching adapter | Already in dependencies. Alternative LLM provider |

### Core (Frontend -- New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.0 | Radar chart + bar charts for scoring visualization | Most popular React charting library. Composable API, good TypeScript support. Required for SCORE-03/ANLYT-05 radar charts |
| @radix-ui/react-slider | 1.3.6 | Accessible slider for scoring weight configuration | Matches existing Radix UI component stack. Needed for linked percentage sliders (D-08) |

### Already Available (No Install Needed)

| Library | Version | Purpose | In Use |
|---------|---------|---------|--------|
| @tanstack/react-query | 5.60.0+ | Server state for all new API hooks | Yes -- use-auth.ts pattern |
| react-hook-form + zod | 7.72.0 / 4.3.6 | Form validation for HCP profile and scenario editors | Yes -- form.tsx component exists |
| react-i18next | 16.6.2 | i18n for all new UI text | Yes -- 3 namespaces (common, auth, nav) |
| axios | 1.7.0+ | API client with JWT interceptor | Yes -- client.ts |
| lucide-react | 0.460.0 | Icons throughout new pages | Yes |
| react-markdown + rehype-raw | 9.0.0 / 7.0.0 | Render AI coaching hints and feedback in markdown | Yes -- in package.json |
| 17 shadcn/ui components | Various | Button, Card, Dialog, Form, Input, Select, Badge, etc. | Yes -- covers admin forms and coaching UI needs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SSE (sse-starlette) | WebSocket | WebSocket is bidirectional but overkill for text-only HCP responses. SSE is simpler, auto-reconnects, works through HTTP proxies. Decision D-01 leaves this to discretion; SSE recommended. |
| recharts | chart.js / visx | recharts has the simplest React API and built-in RadarChart. ANLYT-05 explicitly requires Recharts. |
| @radix-ui/react-slider | Custom range input | Radix provides accessibility, keyboard navigation, and matches the existing component stack. |

**Installation:**

```bash
# Backend
cd backend
pip install sse-starlette>=2.0.0
# Add to pyproject.toml dependencies

# Frontend
cd frontend
npm install recharts @radix-ui/react-slider
```

## Architecture Patterns

### Recommended Project Structure -- New Files

```
backend/
├── app/
│   ├── api/
│   │   ├── hcp_profiles.py      # CRUD for HCP profiles (admin)
│   │   ├── scenarios.py          # CRUD for scenarios (admin)
│   │   ├── sessions.py           # Session lifecycle + streaming chat
│   │   ├── scoring.py            # Trigger scoring, get results
│   │   └── azure_config.py       # PLAT-03: Azure service connection management
│   ├── models/
│   │   ├── hcp_profile.py        # HcpProfile ORM model
│   │   ├── scenario.py           # Scenario ORM model
│   │   ├── session.py            # CoachingSession ORM model
│   │   ├── message.py            # SessionMessage ORM model
│   │   └── score.py              # SessionScore + ScoreDetail ORM models
│   ├── schemas/
│   │   ├── hcp_profile.py        # Pydantic schemas for HCP profiles
│   │   ├── scenario.py           # Pydantic schemas for scenarios
│   │   ├── session.py            # Pydantic schemas for sessions
│   │   └── score.py              # Pydantic schemas for scoring
│   ├── services/
│   │   ├── hcp_profile_service.py  # HCP profile business logic
│   │   ├── scenario_service.py     # Scenario business logic
│   │   ├── session_service.py      # Session lifecycle management
│   │   ├── scoring_service.py      # Post-session scoring orchestration
│   │   ├── prompt_builder.py       # System prompt construction for HCP personas
│   │   └── agents/
│   │       └── adapters/
│   │           ├── mock.py         # Enhanced mock with HCP personality templates (D-12)
│   │           ├── openai.py       # Azure OpenAI / OpenAI adapter
│   │           └── anthropic.py    # Anthropic Claude adapter
│   └── alembic/
│       └── versions/
│           └── xxxx_add_phase2_models.py  # Single migration for all Phase 2 models
frontend/
├── src/
│   ├── api/
│   │   ├── hcp-profiles.ts       # HCP profile API calls
│   │   ├── scenarios.ts          # Scenario API calls
│   │   ├── sessions.ts           # Session + streaming API calls
│   │   └── scoring.ts            # Scoring API calls
│   ├── components/
│   │   ├── coach/
│   │   │   ├── chat-area.tsx           # Chat message list + input
│   │   │   ├── chat-message.tsx        # Single message bubble
│   │   │   ├── chat-input.tsx          # Text input + send button
│   │   │   ├── scenario-panel.tsx      # Left panel: scenario + HCP info
│   │   │   ├── key-messages.tsx        # Key message checklist component
│   │   │   ├── hints-panel.tsx         # Right panel: coaching hints
│   │   │   ├── message-tracker.tsx     # Right panel: message delivery tracker
│   │   │   ├── session-timer.tsx       # Timer component
│   │   │   └── typing-indicator.tsx    # HCP typing animation
│   │   ├── scoring/
│   │   │   ├── radar-chart.tsx         # Recharts radar with current vs previous
│   │   │   ├── dimension-bars.tsx      # Color-coded score bars
│   │   │   ├── feedback-card.tsx       # Per-dimension strengths/weaknesses/suggestions
│   │   │   └── score-summary.tsx       # Overall score with grade
│   │   ├── admin/
│   │   │   ├── hcp-editor.tsx          # HCP profile form (right panel)
│   │   │   ├── hcp-list.tsx            # HCP list sidebar
│   │   │   ├── scenario-table.tsx      # Scenario management table
│   │   │   ├── scenario-editor.tsx     # Scenario editor (modal or inline)
│   │   │   ├── scoring-weights.tsx     # Linked sliders totaling 100%
│   │   │   ├── personality-sliders.tsx # Personality configuration sliders
│   │   │   ├── objection-list.tsx      # Editable objection list
│   │   │   └── test-chat-dialog.tsx    # Quick test chat for HCP personality (D-09)
│   │   └── ui/
│   │       ├── slider.tsx              # New: shadcn slider component (Radix)
│   │       └── textarea.tsx            # New: shadcn textarea component
│   ├── hooks/
│   │   ├── use-hcp-profiles.ts    # TanStack Query hooks for HCP profiles
│   │   ├── use-scenarios.ts       # TanStack Query hooks for scenarios
│   │   ├── use-session.ts         # TanStack Query hooks for coaching sessions
│   │   ├── use-scoring.ts         # TanStack Query hooks for scoring
│   │   └── use-sse.ts             # SSE connection hook for streaming
│   ├── pages/
│   │   ├── user/
│   │   │   ├── scenario-selection.tsx   # Scenario card grid (UI-05)
│   │   │   ├── f2f-coaching.tsx         # 3-column coaching page (UI-03)
│   │   │   └── scoring-feedback.tsx     # Post-session scoring report
│   │   └── admin/
│   │       ├── hcp-profiles.tsx         # HCP profile management page
│   │       ├── scenarios.tsx            # Scenario management page
│   │       └── azure-config.tsx         # Azure service configuration (PLAT-03)
│   ├── types/
│   │   ├── hcp.ts                 # HCP profile types
│   │   ├── scenario.ts           # Scenario types
│   │   ├── session.ts            # Session + message types
│   │   └── score.ts              # Score types
│   └── public/
│       └── locales/
│           ├── en-US/
│           │   ├── coach.json      # New i18n namespace for coaching
│           │   ├── admin.json      # New i18n namespace for admin
│           │   └── scoring.json    # New i18n namespace for scoring
│           └── zh-CN/
│               ├── coach.json
│               ├── admin.json
│               └── scoring.json
```

### Pattern 1: SSE Streaming for HCP Responses

**What:** Server-Sent Events for streaming word-by-word AI HCP responses to the frontend.
**When to use:** Every coaching interaction (D-01). Text-only, server-to-client streaming.

Backend pattern:
```python
# backend/app/api/sessions.py
from sse_starlette.sse import EventSourceResponse

@router.post("/{session_id}/message")
async def send_message(
    session_id: str,
    request: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Send MR message and stream HCP response via SSE."""
    session = await session_service.get_session(db, session_id, user.id)
    # Save MR message
    await session_service.save_message(db, session_id, "user", request.message)

    async def event_generator():
        adapter = registry.get("llm", settings.default_llm_provider)
        coach_request = CoachRequest(
            session_id=session_id,
            message=request.message,
            scenario_context=session.scenario.to_context(),
            hcp_profile=session.scenario.hcp_profile.to_prompt_dict(),
            scoring_criteria=session.scenario.scoring_weights,
        )
        full_response = ""
        async for event in adapter.execute(coach_request):
            if event.type == CoachEventType.TEXT:
                full_response += event.content
                yield {"event": "text", "data": event.content}
            elif event.type == CoachEventType.SUGGESTION:
                yield {"event": "hint", "data": json.dumps({"content": event.content, "metadata": event.metadata})}
            elif event.type == CoachEventType.DONE:
                # Save complete HCP response
                await session_service.save_message(db, session_id, "assistant", full_response)
                # Key message detection (D-03)
                key_messages_status = await session_service.detect_key_messages(db, session)
                yield {"event": "key_messages", "data": json.dumps(key_messages_status)}
                yield {"event": "done", "data": ""}

    return EventSourceResponse(event_generator())
```

Frontend SSE hook pattern:
```typescript
// frontend/src/hooks/use-sse.ts
export function useSSEChat(sessionId: string) {
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(async (message: string) => {
    setIsStreaming(true);
    const response = await fetch(`/api/v1/sessions/${sessionId}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
      },
      body: JSON.stringify({ message }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    // Parse SSE events from the stream...
  }, [sessionId]);

  return { sendMessage, isStreaming };
}
```

### Pattern 2: Session Lifecycle State Machine

**What:** Coaching session progresses through defined states: `created -> in_progress -> completed -> scored`
**When to use:** All session operations (COACH-01, COACH-09)

```python
# Session status enum
class SessionStatus(str, Enum):
    CREATED = "created"           # Session initialized, not started
    IN_PROGRESS = "in_progress"   # Active conversation
    COMPLETED = "completed"       # Conversation ended, awaiting scoring
    SCORED = "scored"             # Scoring complete, feedback available

# State transitions (enforced in service layer):
# created -> in_progress (first message sent)
# in_progress -> completed (manual end or HCP-initiated end via D-06)
# completed -> scored (scoring service completes)
# scored -> (terminal, immutable per COACH-09)
```

### Pattern 3: HCP System Prompt Construction

**What:** Build a system prompt that enforces HCP personality, knowledge, and behavior from the profile.
**When to use:** Every coaching adapter call (COACH-02, D-10)

```python
# backend/app/services/prompt_builder.py
def build_hcp_system_prompt(
    hcp_profile: HcpProfile,
    scenario: Scenario,
    conversation_history: list[dict],
) -> str:
    """Construct system prompt enforcing strict HCP character adherence (D-10)."""
    return f"""You are {hcp_profile.name}, a {hcp_profile.specialty} at {hcp_profile.hospital}.

## Your Personality
- Type: {hcp_profile.personality_type} (you MUST behave this way consistently)
- Emotional State: {hcp_profile.emotional_state}
- Communication Style: {hcp_profile.communication_style}

## Your Knowledge Background
- Medical Expertise: {', '.join(hcp_profile.expertise_areas)}
- Prescribing Habits: {hcp_profile.prescribing_habits}
- Concerns: {hcp_profile.concerns}

## Your Typical Objections (USE THESE)
{chr(10).join(f'- {obj}' for obj in hcp_profile.objections)}

## Scenario Context
Product: {scenario.product}
Therapeutic Area: {scenario.therapeutic_area}

## Rules
1. Stay STRICTLY in character. Never break character or acknowledge being an AI.
2. If personality is "Skeptical", ALWAYS push back and demand evidence.
3. If personality is "Busy", keep responses short and show impatience.
4. Reference your medical background when questioning the MR.
5. Use your objections naturally in the conversation.
6. You may end the conversation when key topics have been sufficiently covered
   or session has run long (D-06): say something like "I need to see my next patient."
7. Respond in the same language the MR uses (Chinese or English).
"""
```

### Pattern 4: Linked Scoring Weight Sliders

**What:** 5 sliders that always total 100%. When one increases, others decrease proportionally.
**When to use:** Scenario editor scoring weight configuration (D-08, HCP-05, SCORE-05)

```typescript
// frontend/src/components/admin/scoring-weights.tsx
interface ScoringWeights {
  key_message: number;
  objection_handling: number;
  communication: number;
  product_knowledge: number;
  scientific_info: number;
}

function adjustWeights(
  weights: ScoringWeights,
  changed: keyof ScoringWeights,
  newValue: number
): ScoringWeights {
  const oldValue = weights[changed];
  const diff = newValue - oldValue;
  const otherKeys = Object.keys(weights).filter(k => k !== changed) as (keyof ScoringWeights)[];
  const otherTotal = otherKeys.reduce((sum, k) => sum + weights[k], 0);

  if (otherTotal === 0) return { ...weights, [changed]: 100 };

  const result = { ...weights, [changed]: newValue };
  for (const key of otherKeys) {
    const proportion = weights[key] / otherTotal;
    result[key] = Math.max(0, Math.round(weights[key] - diff * proportion));
  }
  // Fix rounding errors to ensure sum = 100
  const currentTotal = Object.values(result).reduce((a, b) => a + b, 0);
  if (currentTotal !== 100) {
    const adjustKey = otherKeys[0]!;
    result[adjustKey] += 100 - currentTotal;
  }
  return result;
}
```

### Pattern 5: Post-Session Scoring via AI Analysis

**What:** After session ends, send full transcript to AI for multi-dimensional scoring (D-04).
**When to use:** When session transitions to `completed` status (SCORE-01, SCORE-02)

```python
# backend/app/services/scoring_service.py
SCORING_PROMPT = """Analyze this conversation between an MR and HCP.
Score each dimension from 0-100 based on the scoring criteria below.

## Dimensions and Weights
{dimensions_with_weights}

## Scoring Criteria
- Key Message Delivery: Were the key messages delivered clearly? Which ones were missed?
- Objection Handling: How well did the MR handle HCP objections?
- Communication Skills: Professional tone, active listening, rapport building?
- Product Knowledge: Accuracy of product information shared?
- Scientific Information: Quality of clinical/scientific data referenced?

## Conversation Transcript
{transcript}

## Key Messages Expected
{key_messages}

Respond in JSON format:
{{
  "overall_score": number,
  "dimensions": [
    {{
      "name": "Key Message Delivery",
      "score": number,
      "weight": number,
      "strengths": [{{ "text": "...", "quote": "MR said: ..." }}],
      "weaknesses": [{{ "text": "...", "quote": "When HCP asked: ..." }}],
      "suggestions": ["..."]
    }}
  ]
}}
"""
```

### Anti-Patterns to Avoid

- **Inline useQuery in components:** Always create domain-specific hooks in `src/hooks/`. The existing `use-auth.ts` demonstrates the pattern.
- **Synchronous database calls:** ALL backend functions must be `async def`. Never use synchronous SQLAlchemy.
- **Mutable completed sessions:** Once a session is `completed` or `scored`, no messages can be added (COACH-09). Enforce in service layer, not just API.
- **Hardcoded AI prompts in adapters:** System prompts belong in `prompt_builder.py`, not inside adapter code. Adapters receive the prompt via `CoachRequest`.
- **Missing i18n:** All new UI text MUST use translation keys. Add new namespaces (`coach`, `admin`, `scoring`) to `i18n/index.ts`.
- **Missing `render_as_batch=True`:** All Alembic migrations must use batch mode for SQLite compatibility (Gotcha #1).
- **Static routes after parameterized:** In FastAPI, put `/sessions/active` before `/sessions/{id}` (Gotcha #3).
- **Forgetting to import models in `alembic/env.py`:** New models MUST be imported in `env.py` for autogenerate to detect them (Gotcha #7).

## Database Schema Design

### HcpProfile Model

```python
class HcpProfile(Base, TimestampMixin):
    __tablename__ = "hcp_profiles"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    specialty: Mapped[str] = mapped_column(String(100), nullable=False)
    hospital: Mapped[str] = mapped_column(String(255), default="")
    title: Mapped[str] = mapped_column(String(100), default="")
    avatar_url: Mapped[str] = mapped_column(String(500), default="")

    # Personality (D-07, D-10)
    personality_type: Mapped[str] = mapped_column(String(50), default="friendly")
    emotional_state: Mapped[int] = mapped_column(default=50)  # 0=neutral, 100=resistant
    communication_style: Mapped[int] = mapped_column(default=50)  # 0=direct, 100=indirect

    # Knowledge (HCP-01)
    expertise_areas: Mapped[str] = mapped_column(Text, default="[]")  # JSON array
    prescribing_habits: Mapped[str] = mapped_column(Text, default="")
    concerns: Mapped[str] = mapped_column(Text, default="")

    # Interaction Rules (HCP-02)
    objections: Mapped[str] = mapped_column(Text, default="[]")  # JSON array
    probe_topics: Mapped[str] = mapped_column(Text, default="[]")  # JSON array
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
```

### Scenario Model

```python
class Scenario(Base, TimestampMixin):
    __tablename__ = "scenarios"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    product: Mapped[str] = mapped_column(String(255), nullable=False)
    therapeutic_area: Mapped[str] = mapped_column(String(255), default="")
    mode: Mapped[str] = mapped_column(String(20), default="f2f")  # f2f / conference / both
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft / active

    # Assigned HCP (HCP-04)
    hcp_profile_id: Mapped[str] = mapped_column(String(36), ForeignKey("hcp_profiles.id"))

    # Key Messages (HCP-03)
    key_messages: Mapped[str] = mapped_column(Text, default="[]")  # JSON array

    # Scoring Weights (HCP-05, SCORE-05, D-08) -- must total 100
    weight_key_message: Mapped[int] = mapped_column(default=30)
    weight_objection_handling: Mapped[int] = mapped_column(default=25)
    weight_communication: Mapped[int] = mapped_column(default=20)
    weight_product_knowledge: Mapped[int] = mapped_column(default=15)
    weight_scientific_info: Mapped[int] = mapped_column(default=10)
    pass_threshold: Mapped[int] = mapped_column(default=70)

    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
```

### CoachingSession Model

```python
class CoachingSession(Base, TimestampMixin):
    __tablename__ = "coaching_sessions"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    scenario_id: Mapped[str] = mapped_column(String(36), ForeignKey("scenarios.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="created")
    # created -> in_progress -> completed -> scored

    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(nullable=True)

    # Key message tracking (COACH-03, D-03)
    key_messages_status: Mapped[str] = mapped_column(Text, default="[]")  # JSON: [{message, delivered, detected_at}]

    # Overall score (filled after scoring)
    overall_score: Mapped[float | None] = mapped_column(nullable=True)
    passed: Mapped[bool | None] = mapped_column(nullable=True)
```

### SessionMessage Model

```python
class SessionMessage(Base, TimestampMixin):
    __tablename__ = "session_messages"

    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("coaching_sessions.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_index: Mapped[int] = mapped_column(nullable=False)  # Ordering within session
```

### SessionScore + ScoreDetail Models

```python
class SessionScore(Base, TimestampMixin):
    __tablename__ = "session_scores"

    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("coaching_sessions.id"), unique=True)
    overall_score: Mapped[float] = mapped_column(nullable=False)
    passed: Mapped[bool] = mapped_column(nullable=False)
    feedback_summary: Mapped[str] = mapped_column(Text, default="")

class ScoreDetail(Base, TimestampMixin):
    __tablename__ = "score_details"

    score_id: Mapped[str] = mapped_column(String(36), ForeignKey("session_scores.id"), nullable=False)
    dimension: Mapped[str] = mapped_column(String(50), nullable=False)
    score: Mapped[float] = mapped_column(nullable=False)
    weight: Mapped[int] = mapped_column(nullable=False)
    strengths: Mapped[str] = mapped_column(Text, default="[]")     # JSON array of {text, quote}
    weaknesses: Mapped[str] = mapped_column(Text, default="[]")    # JSON array of {text, quote}
    suggestions: Mapped[str] = mapped_column(Text, default="[]")   # JSON array of strings
```

**Note on JSON columns:** SQLite does not have native JSON type. Use `Text` columns with JSON serialization. For PostgreSQL in production, these can use `JSONB`. The service layer handles serialization/deserialization.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE streaming | Custom chunked response | `sse-starlette` `EventSourceResponse` | Handles keep-alive, retry, event types, proper SSE protocol format |
| Radar charts | Custom SVG/Canvas | `recharts` `RadarChart` | Complex polar coordinate math, responsive, animations, accessibility |
| Form validation | Manual validation | `react-hook-form` + `zod` | Already in project. Handles complex nested forms, errors, performance |
| Slider component | Custom range input | `@radix-ui/react-slider` + shadcn wrapper | Keyboard navigation, screen reader support, touch events, RTL |
| UUID generation | Custom ID schemes | `uuid.uuid4()` via `TimestampMixin` | Already established pattern. Consistent across all models |
| Pagination | Manual offset/limit | `PaginatedResponse.create()` | Already built in `app/utils/pagination.py` |
| JWT auth | Custom token handling | Existing `get_current_user` + `require_role` | Already working. Just use `Depends(get_current_user)` and `Depends(require_role("admin"))` |
| Role-based routes | Custom permission checks | `require_role("admin")` factory | Already built in `app/dependencies.py` |

**Key insight:** The Phase 1 foundation provides most infrastructure. Phase 2 is about domain logic and UI, not plumbing.

## Common Pitfalls

### Pitfall 1: SSE Through Vite Proxy Buffering
**What goes wrong:** Vite's dev proxy may buffer SSE responses, causing all text to arrive at once instead of streaming.
**Why it happens:** HTTP proxies can buffer chunked responses. The Vite proxy config already has `ws: true` but may need SSE-specific headers.
**How to avoid:** Ensure the SSE response includes `Cache-Control: no-cache` and `X-Accel-Buffering: no` headers. The `sse-starlette` library handles this by default, but test early. In nginx production config, add `proxy_buffering off`.
**Warning signs:** Chat messages appear all at once after a delay instead of streaming word-by-word.

### Pitfall 2: CoachEvent Type Extension Without Backward Compatibility
**What goes wrong:** Adding new CoachEventType values breaks the existing MockCoachingAdapter.
**Why it happens:** The mock adapter yields specific event types. New types (e.g., `KEY_MESSAGE_UPDATE`, `HINT`) need handling.
**How to avoid:** Add new event types but keep existing ones. The mock adapter should be enhanced (D-12) but must still pass existing tests. New event types are optional for adapters to emit.
**Warning signs:** Mock adapter stops working, test failures.

### Pitfall 3: Scoring Weights Not Totaling 100%
**What goes wrong:** Admin saves scenario with weights totaling 95% or 105%.
**Why it happens:** Rounding errors in linked slider logic, or direct API manipulation.
**How to avoid:** Validate sum === 100 in both frontend (linked slider logic) AND backend (Pydantic validator). Backend is the source of truth. Use `@field_validator` to reject weights not summing to 100.
**Warning signs:** Weighted scores produce unexpected results.

### Pitfall 4: Full Conversation History Token Limits
**What goes wrong:** Long coaching sessions exceed the LLM context window (D-11 requires full history).
**Why it happens:** Each turn adds ~100-500 tokens. A 30-turn conversation could be 15K+ tokens plus the system prompt.
**How to avoid:** Track token count per session. If approaching limit (e.g., 80% of context window), truncate older messages while keeping system prompt and last N turns. Log a warning when truncation occurs. For OpenAI, use `tiktoken` for accurate counting. For mock adapter, this is not an issue.
**Warning signs:** API errors from the LLM provider about context length.

### Pitfall 5: SQLite JSON Column Querying
**What goes wrong:** Trying to query JSON array contents with SQL (e.g., filtering scenarios by key message content).
**Why it happens:** SQLite has limited JSON support compared to PostgreSQL.
**How to avoid:** For Phase 2, keep JSON columns as opaque blobs -- load the full record and filter in Python. Don't try to do JSON path queries in SQLite. PostgreSQL migration can add JSONB indexes later.
**Warning signs:** Alembic migration failures, query performance issues.

### Pitfall 6: Missing Model Imports in alembic/env.py
**What goes wrong:** `alembic revision --autogenerate` generates empty migration.
**Why it happens:** Alembic only detects models imported in `env.py`. Currently only `User` is imported (Gotcha #7).
**How to avoid:** Import ALL new models in `alembic/env.py`: `from app.models import Base, User, HcpProfile, Scenario, CoachingSession, SessionMessage, SessionScore, ScoreDetail`
**Warning signs:** Migration file has no operations in `upgrade()`.

### Pitfall 7: i18n Namespace Registration
**What goes wrong:** New translation keys show raw key strings instead of translated text.
**Why it happens:** New namespaces (`coach`, `admin`, `scoring`) not added to the i18n init config.
**How to avoid:** Update `frontend/src/i18n/index.ts` to include new namespaces: `ns: ["common", "auth", "nav", "coach", "admin", "scoring"]`. Create corresponding JSON files in both `en-US/` and `zh-CN/` locale directories.
**Warning signs:** UI shows `coach:startSession` instead of "Start Session".

### Pitfall 8: Race Condition on Session End
**What goes wrong:** MR sends a message at the same time as clicking "End Session", creating an inconsistent state.
**Why it happens:** Concurrent requests -- one to send message, one to end session.
**How to avoid:** Use optimistic locking or check session status at the beginning of every message send. If status is not `in_progress`, reject with 409 Conflict. The `completed_at` timestamp serves as the lock.
**Warning signs:** Messages appearing after session is marked as completed.

## Code Examples

### SSE EventSource on Frontend

```typescript
// frontend/src/hooks/use-sse.ts
// Pattern for consuming SSE stream from FastAPI
export function useSSEStream() {
  const streamMessage = useCallback(
    async (
      sessionId: string,
      message: string,
      onText: (chunk: string) => void,
      onHint: (hint: CoachingHint) => void,
      onKeyMessages: (status: KeyMessageStatus[]) => void,
      onDone: () => void
    ) => {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`/api/v1/sessions/${sessionId}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok || !response.body) throw new Error("Stream failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            // Parse SSE event type
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6);
            // Handle based on current event type
          }
        }
      }
    },
    []
  );

  return { streamMessage };
}
```

### Admin CRUD Router Pattern (follows auth.py)

```python
# backend/app/api/hcp_profiles.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.models.user import User
from app.schemas.hcp_profile import HcpProfileCreate, HcpProfileResponse, HcpProfileUpdate
from app.services import hcp_profile_service
from app.utils.pagination import PaginatedResponse

router = APIRouter(prefix="/hcp-profiles", tags=["hcp-profiles"])

@router.get("", response_model=PaginatedResponse[HcpProfileResponse])
async def list_profiles(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """List all HCP profiles (admin only)."""
    return await hcp_profile_service.list_profiles(db, page, page_size)

@router.post("", response_model=HcpProfileResponse, status_code=201)
async def create_profile(
    data: HcpProfileCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Create a new HCP profile (admin only)."""
    return await hcp_profile_service.create_profile(db, data, user.id)

@router.get("/{profile_id}", response_model=HcpProfileResponse)
async def get_profile(
    profile_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Get a specific HCP profile."""
    return await hcp_profile_service.get_profile(db, profile_id)

@router.put("/{profile_id}", response_model=HcpProfileResponse)
async def update_profile(
    profile_id: str,
    data: HcpProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Update an HCP profile."""
    return await hcp_profile_service.update_profile(db, profile_id, data)

@router.delete("/{profile_id}", status_code=204)
async def delete_profile(
    profile_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Delete an HCP profile."""
    await hcp_profile_service.delete_profile(db, profile_id)
```

### TanStack Query Hook Pattern (follows use-auth.ts)

```typescript
// frontend/src/hooks/use-hcp-profiles.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hcpProfilesApi } from "@/api/hcp-profiles";
import type { HcpProfileCreate, HcpProfileUpdate } from "@/types/hcp";

export function useHcpProfiles(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["hcp-profiles", page, pageSize],
    queryFn: () => hcpProfilesApi.list(page, pageSize),
  });
}

export function useHcpProfile(id: string) {
  return useQuery({
    queryKey: ["hcp-profiles", id],
    queryFn: () => hcpProfilesApi.get(id),
    enabled: !!id,
  });
}

export function useCreateHcpProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: HcpProfileCreate) => hcpProfilesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hcp-profiles"] });
    },
  });
}

export function useUpdateHcpProfile(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: HcpProfileUpdate) => hcpProfilesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hcp-profiles"] });
    },
  });
}
```

### Responsive 3-Column Layout (F2F Coaching)

```typescript
// frontend/src/pages/user/f2f-coaching.tsx
// Mobile: stacked with Sheet overlays for left/right panels
// Tablet: left panel collapses, right panel as Sheet
// Desktop: full 3-column layout

export default function F2FCoachingPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Panel: hidden on mobile, shown as sidebar on md+ */}
      <aside className="hidden w-[280px] shrink-0 overflow-y-auto border-r bg-white md:block">
        <ScenarioPanel />
        <KeyMessages />
      </aside>

      {/* Center Panel: always visible */}
      <main className="flex flex-1 flex-col">
        <SessionHeader /> {/* Timer + End Session button */}
        <ChatArea />     {/* Scrollable message list */}
        <ChatInput />    {/* Fixed at bottom */}
      </main>

      {/* Right Panel: hidden on mobile/tablet, shown on lg+ */}
      <aside className="hidden w-[260px] shrink-0 overflow-y-auto border-l bg-white lg:block">
        <HintsPanel />
        <MessageTracker />
      </aside>

      {/* Mobile: Sheet overlays for left/right panels triggered by icon buttons */}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WebSocket for all real-time | SSE for server-to-client, WebSocket only for bidirectional | 2024+ | SSE simpler for streaming AI responses; auto-reconnect built into EventSource API |
| Manual fetch + setState | TanStack Query for server state | Already in project | Consistent caching, deduplication, background refetch |
| Redux for global state | useSyncExternalStore (auth) + TanStack Query (server) | Already in project | Simpler, less boilerplate |
| Tailwind config file | Tailwind v4 @theme inline CSS variables | Already in project | Design tokens as CSS custom properties |
| Single i18n JSON file | Namespaced i18n with lazy loading | Already in project | Smaller bundles, domain separation |

**Deprecated/outdated:**
- `@app.on_event("startup")`: Replaced by lifespan context manager (already using correct pattern)
- Pydantic v1 `class Config`: Must use `model_config = ConfigDict(from_attributes=True)` (v2 pattern)
- `Optional[X]`: Use `X | None` (modern Python 3.11+ union syntax, already enforced)

## Open Questions

1. **Mock Adapter Realism Level (D-12)**
   - What we know: Mock must feel "somewhat real even without Azure OpenAI" for demo this week
   - What's unclear: Exact number of template responses needed, how much randomization
   - Recommendation: Build 5-8 response templates per personality type (Skeptical, Friendly, Busy, Detail-oriented, Resistant). Each template has 3-4 variations. Use conversation turn count and detected keywords to select appropriate template. This is sufficient for demo quality.

2. **Session Timer Behavior**
   - What we know: Timer shown in coaching page header (Figma 04), counts up from session start
   - What's unclear: Whether timer should auto-end session after a maximum duration
   - Recommendation: Timer counts up. No auto-end. Session ends via manual button or HCP-initiated (D-06). Display timer as MM:SS format.

3. **PLAT-03 Azure Config Storage**
   - What we know: Admin configures Azure connections (OpenAI, Speech, Avatar) from web UI with connection testing
   - What's unclear: Whether to store in database (runtime-updatable) or .env (requires restart)
   - Recommendation: Store in database `azure_config` table. On save, update in-memory settings. Provide "Test Connection" button that pings the Azure endpoint. Restart not needed. This is more admin-friendly.

4. **Scenario Editor: Modal vs Inline**
   - What we know: Figma spec 09 shows both options. Admin managing many scenarios.
   - What's unclear: Which is better UX for this use case.
   - Recommendation: Use Dialog (modal) for scenario editor. The table view stays visible as context. HCP profiles use the master-detail pattern (list + editor) since profiles have more fields and need visual context (personality sliders).

## Project Constraints (from CLAUDE.md)

These directives from CLAUDE.md MUST be followed by the planner:

1. **Async everywhere**: All new backend functions must be `async def` with `AsyncSession`
2. **Pydantic v2**: Use `model_config = ConfigDict(from_attributes=True)` on all response schemas
3. **Exception raisers**: Use `-> NoReturn` annotation on functions that always raise
4. **Route ordering**: Static paths before parameterized (`/defaults` before `/{id}`)
5. **Create returns 201**, Delete returns 204
6. **Service layer**: Business logic in services, routers only handle HTTP
7. **No raw SQL**: Use SQLAlchemy ORM or Alembic migrations
8. **TypeScript strict**: No `any` types, no unused variables
9. **TanStack Query hooks per domain**: No inline `useQuery` in components
10. **Path alias `@/`**: For all imports from `src/`
11. **`cn()` utility**: For conditional class composition
12. **No Redux**: TanStack Query for server state, lightweight store for auth
13. **Conventional commits**: `feat:`, `fix:`, `docs:`, `test:`
14. **Alembic for ALL schema changes**: Never modify DB schema without migration
15. **Never delete database file**: Use migrations to fix schema issues
16. **`render_as_batch=True`**: Required in all Alembic migrations for SQLite compatibility
17. **All models use `TimestampMixin`**: UUID id + created_at + updated_at
18. **i18n required**: All UI text externalized via react-i18next (zh-CN + en-US)
19. **Pre-commit checks**: `ruff check .`, `ruff format --check .`, `pytest -v`, `npx tsc -b`, `npm run build`
20. **Barrel exports**: `index.ts` for component directories
21. **Import all models in `alembic/env.py`**: Required for autogenerate

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | Backend | Yes | 3.11 | -- |
| Node.js 20+ | Frontend | Yes | 20+ | -- |
| sse-starlette | SSE streaming | Yes (system) | 2.3.5 | Must add to pyproject.toml |
| SQLite | Dev database | Yes | Built-in | -- |
| openai SDK | LLM adapters | Yes | 1.51.0 | Mock adapter |
| anthropic SDK | LLM adapters | Yes | 0.42.0 | Mock adapter |
| Azure OpenAI endpoint | COACH-02, SCORE-02 | Not configured | -- | Mock adapter sufficient for demo |
| recharts | Scoring radar chart | Not installed | 3.8.0 (npm) | Must install |
| @radix-ui/react-slider | Scoring weight sliders | Not installed | 1.3.6 (npm) | Must install |

**Missing dependencies with no fallback:**
- None -- all blocking dependencies are available or have mock fallbacks

**Missing dependencies with fallback:**
- Azure OpenAI endpoint: Not configured, but mock adapter provides demo-quality responses (D-12)
- `recharts` and `@radix-ui/react-slider`: Need npm install, but this is a plan-time action, not a blocker

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/app/services/agents/base.py`, `registry.py`, `adapters/mock.py` -- adapter pattern
- Existing codebase: `backend/app/models/base.py`, `user.py` -- ORM model pattern
- Existing codebase: `backend/app/api/auth.py` -- router pattern with DI
- Existing codebase: `frontend/src/hooks/use-auth.ts` -- TanStack Query hook pattern
- Existing codebase: `frontend/src/stores/auth-store.ts` -- useSyncExternalStore pattern
- Existing codebase: `frontend/src/components/ui/index.ts` -- 17 shadcn/ui components available
- Figma specs: `docs/figma-prompts/03-scenario-selection.md`, `04-f2f-coaching.md`, `06-scoring-feedback.md`, `09-admin-hcp-scenarios.md`
- Package versions verified via `npm view` and `pip show` against installed versions

### Secondary (MEDIUM confidence)
- `sse-starlette` library: Installed on system (v2.3.5), well-known FastAPI SSE library
- `recharts`: npm registry confirms v3.8.0, widely used React charting library
- Capgemini reference architecture: `docs/capgemini-ai-coach-solution.md` -- scoring dimensions and interaction flow

### Tertiary (LOW confidence)
- System prompt engineering patterns: Based on training data, not verified against current best practices. The exact prompt structure should be iteratively refined during development.
- Token counting with tiktoken: Based on training knowledge. Verify current API when implementing context window management.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified via npm/pip, existing patterns confirmed in codebase
- Architecture: HIGH -- follows established Phase 1 patterns exactly, Figma specs provide clear layout guidance
- Database schema: HIGH -- follows existing User model pattern with TimestampMixin, relationships are straightforward
- Pitfalls: MEDIUM -- SSE proxy behavior needs runtime testing, token limits depend on chosen model
- System prompts: LOW -- prompt engineering is iterative, initial templates are starting points

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable domain, existing patterns)
