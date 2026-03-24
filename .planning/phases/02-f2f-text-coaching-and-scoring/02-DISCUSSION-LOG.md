# Phase 2: F2F Text Coaching and Scoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 02-f2f-text-coaching-and-scoring
**Areas discussed:** Coaching conversation flow, Scoring & feedback experience, Admin HCP/Scenario management, AI HCP personality system

---

## Coaching Conversation Flow

### How should the AI HCP respond in the chat?

| Option | Description | Selected |
|--------|-------------|----------|
| Streaming word-by-word | HCP response appears word-by-word with typing animation — feels like real conversation. Uses SSE/WebSocket. | ✓ |
| Full response at once | HCP responds with complete message after "typing..." indicator. Simpler, less immersive. | |
| You decide | Claude picks based on existing adapter pattern | |

**User's choice:** Streaming word-by-word
**Notes:** CoachEvent streaming pattern already exists in BaseCoachingAdapter — natural extension.

### How should the coaching hints panel behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Real-time contextual hints | Hints update after each MR message — separate AI call per turn. | |
| Pre-loaded hints from scenario | Static hints loaded from scenario config, no dynamic updates. | |
| Hybrid: static + milestone triggers | Start with scenario hints, trigger new contextual hints at key moments. | ✓ |

**User's choice:** Hybrid: static + milestone triggers
**Notes:** None

### How should key message tracking work?

| Option | Description | Selected |
|--------|-------------|----------|
| AI auto-detects delivery | After each MR message, AI evaluates key message delivery — checklist updates in real-time. | ✓ |
| Post-session analysis only | Key messages checked only after session ends. Simpler but no real-time feedback. | |
| You decide | Claude picks the approach | |

**User's choice:** AI auto-detects delivery
**Notes:** None

---

## Scoring & Feedback Experience

### When should scoring happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Post-session only | Score after "End Session" — single AI analysis of full transcript. | ✓ |
| Real-time + post-session | Running score during session + final score after. More complex. | |
| You decide | Claude picks | |

**User's choice:** Post-session only
**Notes:** None

### How should the feedback report be structured?

| Option | Description | Selected |
|--------|-------------|----------|
| Full report per Figma spec | Radar chart + dimension bars + conversation quotes + actionable suggestions. | ✓ |
| Simplified summary first | Overall score + top 3 strengths/weaknesses, expand for details. | |
| You decide | Claude picks detail level | |

**User's choice:** Full report per Figma spec
**Notes:** None

### What triggers session end?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual only | MR clicks "End Session". Timer shows elapsed but no limit. | |
| Manual + time limit | MR can end anytime, auto-end after configurable time. | |
| Manual + HCP-initiated end | MR or AI HCP can end — HCP may say "I need to go" after key messages covered. | ✓ |

**User's choice:** Manual + HCP-initiated end
**Notes:** Most realistic simulation experience.

---

## Admin HCP/Scenario Management

### How should the HCP profile editor work?

| Option | Description | Selected |
|--------|-------------|----------|
| Full form per Figma spec | Left list + right editor with all fields as in 09-admin-hcp-scenarios.md. | ✓ |
| Simplified wizard | Step-by-step wizard through creation stages. | |
| You decide | Claude picks form approach | |

**User's choice:** Full form per Figma spec
**Notes:** None

### How should scoring weight configuration work?

| Option | Description | Selected |
|--------|-------------|----------|
| Linked sliders totaling 100% | 5 sliders that auto-adjust to always total 100%. | ✓ |
| Independent inputs with validation | Number inputs, validate total = 100% on save. | |
| Preset templates + custom | Pre-built presets plus custom editing. | |

**User's choice:** Linked sliders totaling 100%
**Notes:** None

### Should there be a 'Test Chat' feature for HCP profiles?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, quick test chat | Admin can test-chat with HCP before assigning to scenarios. | ✓ |
| No, test via full session | Admin creates scenario and starts session to test. | |
| You decide | Claude decides priority | |

**User's choice:** Yes, quick test chat
**Notes:** Uses same coaching engine.

---

## AI HCP Personality System

### How strictly should the AI follow the HCP profile?

| Option | Description | Selected |
|--------|-------------|----------|
| Strict character adherence | AI strictly stays in character — personality, objections, knowledge all enforced. | ✓ |
| Guided but adaptive | Profile sets baseline, AI can adapt to conversation context. | |
| You decide | Claude designs prompt approach | |

**User's choice:** Strict character adherence
**Notes:** None

### Should the AI HCP use conversation memory within a session?

| Option | Description | Selected |
|--------|-------------|----------|
| Full session context | Entire conversation history per turn — AI remembers everything. | ✓ |
| Sliding window | Last N messages + scenario context. Saves tokens. | |
| You decide | Claude picks based on needs | |

**User's choice:** Full session context
**Notes:** None

### How should the mock provider behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Realistic mock with templates | Pre-scripted responses with personality variations and randomization. | ✓ |
| Simple echo/template | Basic templates, clearly a placeholder. | |
| You decide | Claude decides mock fidelity | |

**User's choice:** Realistic mock with templates
**Notes:** Demo needed this week — mock must feel somewhat real.

---

## Claude's Discretion

- System prompt engineering details
- SSE vs WebSocket for streaming
- Database schema specifics
- Scenario editor modal vs inline
- Azure config UI layout
- Session timer implementation
- Responsive adaptations for tablet/mobile

## Deferred Ideas

- Voice, avatar, conference — Phase 3
- PDF export — future
- Training material upload/RAG — Phase 3

## User Notes

- "没有功能冲突点的话，我希望加快速度并行起来" — Maximize parallelization in plans where no functional conflicts exist
