# Phase 24: Session Skill Focus & CU-Based Evaluation - Research

**Researched:** 2026-05-13
**Domain:** Azure AI Foundry Agent SDK (additional_instructions) + Azure Content Understanding (custom analyzers for scoring)
**Confidence:** MEDIUM-HIGH

## Summary

Phase 24 addresses two distinct but complementary enhancements: (1) injecting Skill SOP instructions at the thread-run level so the Agent dynamically focuses on the current Skill's content during a training session without modifying the Agent definition, and (2) replacing the current LLM-based scoring_engine with Azure Content Understanding custom analyzers for both content and voice evaluation.

The Azure AI Foundry Agent SDK (`azure-ai-projects>=2.0.1`, already installed) supports `additional_instructions` as a parameter on `runs.create_and_process()`, which appends to the agent's base instructions for that specific run. This is confirmed by the official quickstart documentation. For the Voice Live agent mode, the equivalent mechanism must be verified against the Voice Live SDK's session configuration.

Azure Content Understanding (CU) provides custom analyzers with configurable `fieldSchema` that can define "generate" fields for scoring and evaluation. It supports audio inputs (with transcription + diarization) and document/text inputs. The submit-then-poll async pattern already exists in the codebase (`AzureContentUnderstandingAdapter`).

**Primary recommendation:** Build a `SkillFocusService` for constructing dynamic additional_instructions per run, and a `CUEvaluationService` that creates/manages custom analyzers from ScoringRubric dimensions and invokes them for scoring.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Azure Foundry Thread-level `additional_instructions` for Skill Focus injection. Thread creation passes it in, only affects current thread. Agent definition unchanged.
- **D-02:** Injection content = full Skill SOP text + Focus constraint instructions.
- **D-03:** Thread ID binding guarantees isolation (new session = new thread). DB records `focus_instruction` snapshot per session for audit/replay.
- **D-04:** Graded off-topic handling -- mild deviation (still related to product/therapeutic area) gets gentle redirect; completely unrelated topics get hard block.
- **D-05:** Dynamic SOP progress awareness -- backend tracks current SOP step, each run's additional_instructions includes "currently should be at step X" hint.
- **D-06:** SOP progress tracking via LLM -- after each user message, LLM analyzes conversation vs SOP steps to determine current step. Extra LLM call per message.
- **D-07:** Fully replace existing LLM scoring_engine.py -- all scoring (content + voice) via Azure Content Understanding.
- **D-08:** Evaluation dimensions read dynamically from ScoringRubric (Phase 21 system).
- **D-09:** Rubric save pre-creates CU Custom Analyzer -- admin saves Rubric = sync creates/updates corresponding CU Analyzer with fieldSchema and scoring prompts.
- **D-10:** Two separate CU calls -- content evaluation (transcript JSON input) + voice evaluation (audio input). Results merged.
- **D-11:** Layered merge -- content dimensions total + voice dimensions total, weighted by category (e.g., content 60% + voice 40%).
- **D-12:** Category weights in ScoringRubric -- new `content_weight` and `voice_weight` fields (default 60:40), admin-configurable per Rubric.
- **D-13:** Text-only sessions -- only content evaluation, no voice. Final score = content only.
- **D-14:** Voice/digital human sessions -- CU re-transcribes audio for content eval + audio used for voice eval. Dual-dimension scoring.
- **D-15:** Text content coverage (key messages delivery) is the core metric regardless of mode.
- **D-16:** Voice transcription unified via CU re-transcription (not real-time VL transcript), ensuring evaluation quality consistency.

### Claude's Discretion
- CU Custom Analyzer fieldSchema definition specifics
- SOP progress judgment LLM prompt design
- Focus instruction wording templates
- Off-topic boundary detection logic
- DB focus_instruction snapshot storage format
- CU Analyzer create/update API implementation details
- Score result loading UI (loading state)
- Legacy scoring_engine deprecation/migration strategy

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| azure-ai-projects | >=2.0.1 | Agent SDK: thread runs with additional_instructions | Already installed; official MS SDK for Foundry Agent Service [VERIFIED: pyproject.toml] |
| httpx | (existing) | CU REST API calls (custom analyzer CRUD + analyze) | Already used in AzureContentUnderstandingAdapter [VERIFIED: codebase] |
| openai | (existing) | LLM calls for SOP progress tracking | Already used for scoring_engine LLM calls [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| azure-ai-contentunderstanding | latest | Python SDK for CU (alternative to raw REST) | Optional -- raw httpx REST is already established pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw httpx for CU | azure-ai-contentunderstanding SDK | SDK adds dependency but provides type safety; raw REST matches existing adapter pattern and avoids new dep |
| LLM for SOP progress | Rule-based keyword matching | LLM is more accurate for semantic step matching but adds latency/cost per message |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
pip install azure-ai-projects>=2.0.1  # Already in pyproject.toml
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/services/
├── skill_focus_service.py       # NEW: Skill Focus instruction composition + SOP progress tracking
├── cu_evaluation_service.py     # NEW: CU analyzer CRUD + scoring orchestration (replaces scoring_engine.py)
├── scoring_service.py           # MODIFIED: call cu_evaluation_service instead of scoring_engine
├── scoring_engine.py            # DEPRECATED: keep as fallback during transition, then remove
├── voice_scoring_service.py     # MODIFIED: delegate to cu_evaluation_service for voice
├── skill_manager.py             # EXISTING: compose_instructions() reused for focus text
└── session_service.py           # MODIFIED: add focus_instruction snapshot on create
```

### Pattern 1: Thread-Level additional_instructions Injection
**What:** Pass `additional_instructions` to `runs.create_and_process()` or equivalent. Appends to agent instructions for that run only.
**When to use:** Every time a message is processed in agent mode.
**Example:**
```python
# Source: Azure AI Foundry Agents quickstart (official docs)
# For text-based sessions (via AIProjectClient SDK):
run = project_client.agents.runs.create_and_process(
    thread_id=thread.id,
    agent_id=agent.id,
    additional_instructions=focus_instruction,  # Skill SOP + progress hint
)

# For SSE text sessions (via chat completions adapter):
# Prepend focus_instruction to the system prompt in CoachRequest.scenario_context
```
[VERIFIED: learn.microsoft.com/en-us/azure/ai-services/agents/quickstart - Python example shows additional_instructions on create_and_process]

### Pattern 2: CU Custom Analyzer Creation (REST API)
**What:** Create a custom analyzer with fieldSchema defining scoring dimensions as "generate" fields.
**When to use:** When admin saves/updates a ScoringRubric.
**Example:**
```python
# Source: Azure CU REST API docs (api-version=2025-11-01)
# PUT {endpoint}/contentunderstanding/analyzers/{analyzer_id}?api-version=2025-11-01
analyzer_body = {
    "description": f"Content scoring for rubric: {rubric.name}",
    "baseAnalyzerId": "prebuilt-callCenter",  # For audio; "prebuilt-document" for text
    "fieldSchema": {
        "fields": {
            "dimension_key_message": {
                "type": "object",
                "method": "generate",
                "description": "Score 0-100 for key message delivery. Criteria: ...",
                "valueObject": {
                    "score": {"type": "number", "method": "generate", "description": "Score 0-100"},
                    "strengths": {"type": "array", "method": "generate", "description": "List of strengths"},
                    "weaknesses": {"type": "array", "method": "generate", "description": "List of weaknesses"},
                    "suggestions": {"type": "array", "method": "generate", "description": "Improvement suggestions"}
                }
            }
            # ... more dimensions from rubric
        }
    }
}
```
[CITED: learn.microsoft.com/en-us/azure/ai-services/content-understanding/tutorial/create-custom-analyzer]

### Pattern 3: CU Submit-Then-Poll Analysis
**What:** Submit content for analysis, poll Operation-Location URL until Succeeded.
**When to use:** Post-session scoring (both content and voice).
**Example:**
```python
# Already implemented in AzureContentUnderstandingAdapter
# POST {endpoint}/contentunderstanding/analyzers/{analyzer_id}:analyze?api-version=2025-11-01
# Body: {"inputs": [{"url": "audio_blob_url"}]}  OR  {"inputs": [{"base64Source": "..."}]}
# Response: 202 with Operation-Location header
# Poll GET until status == "Succeeded"
# Result: {"contents": [{"fields": {...scoring dimensions...}}]}
```
[VERIFIED: codebase azure_content.py already implements this exact pattern]

### Pattern 4: SOP Progress Tracking via LLM
**What:** After each user message, call LLM to classify which SOP step the conversation is at.
**When to use:** Every user message during a focused session.
**Example:**
```python
# Lightweight classification prompt
SOP_PROGRESS_PROMPT = """Given the following SOP steps and conversation history,
determine which step the conversation is currently at.

## SOP Steps:
{sop_steps_numbered}

## Conversation so far:
{conversation_transcript}

Return ONLY the step number (integer). If conversation hasn't started the SOP yet, return 0.
If the conversation has completed all steps, return the last step number."""
```
[ASSUMED]

### Anti-Patterns to Avoid
- **Modifying Agent definition per session:** Agent definitions are shared across all users. Never mutate agent instructions -- use additional_instructions at run level.
- **Synchronous CU calls in request path:** CU analysis takes 30-120s. Always run as async background task.
- **Single monolithic scoring prompt:** Replacing one LLM scoring call with one CU call that does everything. Instead, use structured fieldSchema with per-dimension fields.
- **Tight coupling between focus service and voice live:** The focus mechanism should work identically regardless of session mode (text, voice, digital human).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio transcription for scoring | Custom STT pipeline | CU prebuilt-callCenter analyzer | CU handles diarization, speaker roles, timestamps automatically |
| Scoring prompt engineering | Complex manual prompts | CU fieldSchema with "generate" fields | CU handles contextualization, confidence scores, source grounding |
| Agent instruction isolation | Custom thread management | Azure Agent SDK additional_instructions | Thread-level isolation is built into the SDK |
| Async job management | Custom queue system | asyncio.create_task with durable DB session pattern | Already established in voice_scoring_service.py |

**Key insight:** The CU service eliminates the need for hand-crafted scoring prompts (current scoring_engine.py). By defining dimensions as fieldSchema fields with descriptions and criteria, CU handles the prompt engineering internally and returns structured JSON with confidence scores.

## Common Pitfalls

### Pitfall 1: additional_instructions Scope Confusion
**What goes wrong:** Developers assume additional_instructions persists across all runs in a thread, or that it replaces agent instructions.
**Why it happens:** The parameter name is ambiguous about append vs. override semantics.
**How to avoid:** additional_instructions APPENDS to agent-level instructions for that single run only. Each new run needs the additional_instructions passed again. Test by verifying agent behavior without the parameter still works normally.
**Warning signs:** Agent behaves the same with and without additional_instructions = likely not being passed correctly.
[VERIFIED: Official quickstart shows it as run-level parameter, not thread-level persistent state]

### Pitfall 2: CU Analyzer Creation vs. Invocation Confusion
**What goes wrong:** Trying to create a new analyzer for each scoring invocation.
**Why it happens:** Conflating "analyzer definition" (schema) with "analyzer invocation" (actual analysis).
**How to avoid:** Create analyzers once when Rubric is saved (D-09). Invoke the pre-existing analyzer at scoring time. Store analyzer_id in ScoringRubric model.
**Warning signs:** Slow scoring due to analyzer creation overhead on every session end.

### Pitfall 3: CU API Version Mismatch
**What goes wrong:** Using older API version that doesn't support custom fieldSchema.
**Why it happens:** Copy-pasting from older examples.
**How to avoid:** Always use `api-version=2025-11-01` (GA version). The existing adapter already uses this.
**Warning signs:** 400 Bad Request with "fieldSchema not supported" errors.
[VERIFIED: Existing adapter uses 2025-11-01]

### Pitfall 4: SOP Progress LLM Call Latency
**What goes wrong:** User perceives significant delay between their message and HCP response because of the extra LLM call for progress tracking.
**Why it happens:** Sequential execution: progress check LLM call -> update additional_instructions -> HCP response LLM call.
**How to avoid:** Run the SOP progress check in parallel with early processing, or use a fast/cheap model (gpt-4.1-mini) for classification. The progress result is used in the NEXT run's additional_instructions, not the current one.
**Warning signs:** Response time doubles compared to non-focused sessions.

### Pitfall 5: Voice Session Audio URL Availability
**What goes wrong:** CU scoring fails because audio_url is a local file path or expired SAS token.
**Why it happens:** Audio storage may use local filesystem in dev, Azure Blob in production.
**How to avoid:** For CU analysis, audio must be accessible via a publicly-reachable URL or the same Azure resource. Use `base64Source` input as fallback for local storage.
**Warning signs:** CU returns "Failed to fetch input" errors.

### Pitfall 6: Rubric Weight Fields Migration
**What goes wrong:** Existing rubrics lack `content_weight`/`voice_weight` fields, causing NullPointerError during scoring.
**Why it happens:** New fields added without proper default handling.
**How to avoid:** Use server_default in Alembic migration (project convention for SQLite compat). Default to 60/40 as specified in D-12.
**Warning signs:** 500 errors on sessions using old rubrics.

## Code Examples

### Skill Focus Instruction Composition
```python
# Source: project pattern (skill_manager.py compose_instructions)
def compose_focus_instruction(
    skill_content: SkillContent,
    current_step: int,
    total_steps: int,
    sop_steps: list[str],
) -> str:
    """Build the additional_instructions for a focused session run."""
    parts = [
        "== SKILL FOCUS MODE ==",
        f"Skill: {skill_content.name} (v:{skill_content.version_id[:8]})",
        "",
        "## SOP Content (MUST stay within this scope):",
        skill_content.content,
        "",
        "## Current Progress:",
        f"Conversation is at step {current_step} of {total_steps}.",
        f"Current step topic: {sop_steps[current_step - 1] if current_step > 0 else 'Not started'}",
        f"Next expected: Guide user toward step {min(current_step + 1, total_steps)} content.",
        "",
        "## Focus Rules:",
        "1. ONLY discuss topics within the SOP content above.",
        "2. If user slightly deviates but stays in product/therapeutic domain, gently redirect.",
        "3. If user discusses completely unrelated topics, firmly state: 'Let us focus on [current topic].'",
        "4. Track which SOP steps have been covered and guide toward uncovered steps.",
    ]
    return "\n".join(parts)
```

### CU Custom Analyzer fieldSchema from Rubric Dimensions
```python
# Source: CU REST API pattern (fieldSchema structure from official docs)
def build_content_analyzer_schema(rubric_dimensions: list[dict]) -> dict:
    """Convert ScoringRubric dimensions to CU fieldSchema for content analysis."""
    fields = {}
    for dim in rubric_dimensions:
        dim_key = dim["name"].replace(" ", "_").lower()
        criteria_text = "; ".join(dim.get("criteria", []))
        fields[f"dim_{dim_key}"] = {
            "type": "object",
            "method": "generate",
            "description": (
                f"Evaluate the MR's performance on '{dim['name']}' (weight: {dim['weight']}%). "
                f"Criteria: {criteria_text}. "
                f"Score from 0-100 based on conversation evidence."
            ),
        }
    # Add overall summary field
    fields["feedback_summary"] = {
        "type": "string",
        "method": "generate",
        "description": "2-3 sentence overall assessment of MR performance across all dimensions.",
    }
    return {"fields": fields}
```

### CU Scoring Invocation (Content)
```python
# Source: Existing AzureContentUnderstandingAdapter pattern + CU docs
async def score_content_with_cu(
    endpoint: str,
    api_key: str,
    analyzer_id: str,
    transcript_json: str,
) -> dict:
    """Submit transcript to CU content analyzer and poll for results."""
    import base64
    
    url = f"{endpoint}/contentunderstanding/analyzers/{analyzer_id}:analyze?api-version=2025-11-01"
    headers = {"Ocp-Apim-Subscription-Key": api_key, "Content-Type": "application/json"}
    
    # Encode transcript as base64 for inline submission
    b64_content = base64.b64encode(transcript_json.encode()).decode()
    body = {"inputs": [{"base64Source": b64_content}]}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, json=body)
        if response.status_code != 202:
            raise RuntimeError(f"CU submit failed: {response.status_code}")
        
        operation_url = response.headers["Operation-Location"]
        
        # Poll until complete (reuse existing bounded polling pattern)
        for _ in range(60):  # 120s max
            await asyncio.sleep(2)
            poll_resp = await client.get(operation_url, headers={"Ocp-Apim-Subscription-Key": api_key})
            result = poll_resp.json()
            if result["status"] == "Succeeded":
                return result["result"]["contents"][0]["fields"]
            if result["status"] in ("Failed", "Cancelled"):
                raise RuntimeError(f"CU analysis {result['status']}")
        
        raise RuntimeError("CU analysis timed out")
```

### SOP Progress Detection
```python
# Source: project pattern (LLM call via openai)
async def detect_sop_step(
    conversation_history: list[dict],
    sop_steps: list[str],
    endpoint: str,
    api_key: str,
    deployment: str = "gpt-4o-mini",
) -> int:
    """Determine which SOP step the conversation is currently at."""
    from openai import AsyncAzureOpenAI
    
    steps_text = "\n".join(f"{i+1}. {step}" for i, step in enumerate(sop_steps))
    transcript = "\n".join(
        f"{'MR' if m['role'] == 'user' else 'HCP'}: {m['content']}"
        for m in conversation_history[-10:]  # Last 10 messages for efficiency
    )
    
    client = AsyncAzureOpenAI(azure_endpoint=endpoint, api_key=api_key, api_version="2024-06-01")
    response = await client.chat.completions.create(
        model=deployment,
        messages=[{
            "role": "user",
            "content": f"SOP Steps:\n{steps_text}\n\nConversation:\n{transcript}\n\n"
                       "Which step number is the conversation currently at? Return ONLY the integer."
        }],
        temperature=0,
        max_completion_tokens=10,
    )
    try:
        return int(response.choices[0].message.content.strip())
    except (ValueError, AttributeError):
        return 0
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LLM scoring prompts (scoring_engine.py) | CU custom analyzers with fieldSchema | Phase 24 | Structured scoring with confidence scores, source grounding |
| Agent-level instruction modification | Thread-run additional_instructions | Phase 24 | Runtime isolation without agent definition changes |
| Mock voice scoring | CU audio analysis (prebuilt-callCenter base) | Phase 24 | Real voice quality evaluation with transcription |
| Static agent behavior | Dynamic SOP progress tracking | Phase 24 | Agent awareness of conversation flow state |

**Deprecated/outdated:**
- `scoring_engine.py` LLM prompt-based scoring: Replaced by CU custom analyzer approach
- `MockVoiceScoringBackend`: Replaced by real CU audio analyzer
- Static skill injection at agent creation: Supplemented by dynamic per-run injection

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | additional_instructions appends (not replaces) agent instructions | Architecture Patterns | If it replaces, need to include full agent instructions in every run |
| A2 | CU custom analyzer supports "generate" method with object-type fields for scoring dimensions | Architecture Patterns | If only flat string fields, need different schema design |
| A3 | CU can accept base64-encoded text/JSON as input (not just URLs) | Code Examples | If only URL inputs, need to upload transcript to Blob first |
| A4 | CU audio analyzer also provides transcript in response (for content eval from audio) | Architecture Patterns | If not, need separate transcription step before content scoring |
| A5 | gpt-4o-mini or equivalent fast model available for SOP progress classification | Common Pitfalls | If only gpt-4o available, progress check will be slower/costlier |
| A6 | Voice Live agent mode supports additional_instructions equivalent | Architecture Patterns | If not, focus injection only works for text-mode sessions through SDK runs |

## Open Questions (RESOLVED)

1. **Voice Live Agent Mode + additional_instructions**
   - What we know: Text-based agent runs support additional_instructions via SDK. Voice Live sessions connect directly from frontend to Azure.
   - What's unclear: Whether the Voice Live WebSocket connection supports passing additional_instructions. The VL SDK may handle this differently.
   - Recommendation: Investigate if `azure-ai-voicelive` SDK has an equivalent parameter. If not, the focus injection for voice sessions may need to be baked into the agent definition at session start (via create_version with temporary instructions).
   - **RESOLVED:** Text SSE mode uses system prompt prepend via `additional_instructions` (appended to scenario_context). Voice Live agent mode is deferred to runtime investigation -- if VL SDK does not support an equivalent parameter, the system falls back to text mode for focused sessions (per existing fallback pattern in codebase). Plans implement text-mode injection only; VL support is a runtime enhancement, not a blocker.

2. **CU Custom Analyzer for text/JSON content scoring**
   - What we know: CU clearly supports audio (prebuilt-callCenter) and documents (prebuilt-document). Text/JSON transcript is not a standard input type.
   - What's unclear: Whether transcript JSON can be submitted as a "document" (it should be able to since CU accepts various content types).
   - Recommendation: Test submitting a JSON transcript as plain text file input. If unsupported, format as markdown document.
   - **RESOLVED:** Submit transcript as base64-encoded JSON via `base64Source` input field in the analyze request body. Content type is set to `application/json`. This approach is implemented in Plan 03 (CUEvaluationService) using `base64.b64encode(transcript_json.encode()).decode()` for inline submission without requiring Blob upload.

3. **CU Analyzer ID persistence**
   - What we know: Analyzers are created via PUT request with a user-specified ID.
   - What's unclear: The exact lifecycle management (do analyzers expire? can they be updated in-place?).
   - Recommendation: Store `cu_content_analyzer_id` and `cu_voice_analyzer_id` in ScoringRubric model. Implement create-or-update pattern.
   - **RESOLVED:** Store `cu_content_analyzer_id` and `cu_voice_analyzer_id` as nullable String columns in the ScoringRubric model (Plan 01 migration). Use PUT for create-or-update pattern -- PUT with the same analyzer_id overwrites the existing definition (idempotent). Analyzer IDs are UUID-based (format: `rubric-{rubric_id}-content` / `rubric-{rubric_id}-voice`). Plan 03 implements the sync logic on Rubric save.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| azure-ai-projects | Agent SDK runs | Yes | >=2.0.1 | -- |
| httpx | CU REST API | Yes | (existing) | -- |
| openai | SOP progress LLM | Yes | (existing) | -- |
| Azure CU endpoint | Scoring | Config-dependent | -- | Mock fallback (existing pattern) |
| Azure Foundry Agent | additional_instructions | Config-dependent | -- | SSE text mode fallback |

**Missing dependencies with no fallback:**
- None (all packages already installed)

**Missing dependencies with fallback:**
- Azure CU endpoint not configured in dev: Use mock scoring fallback (existing `_generate_mock_scores`)
- Agent not synced for HCP: Use text-mode SSE with system prompt injection (existing pattern)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Existing JWT auth covers all endpoints |
| V3 Session Management | No | Existing session middleware |
| V4 Access Control | Yes | Admin-only for Rubric/Analyzer CRUD; user-only for own sessions |
| V5 Input Validation | Yes | Pydantic v2 schemas for all new fields; validate SOP content length |
| V6 Cryptography | No | CU API key stored encrypted (existing config_service pattern) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via SOP content | Tampering | SOP content from admin-controlled Skill; not user-modifiable |
| Audio URL manipulation | Tampering | Validate audio_url points to same Azure storage account |
| CU Analyzer ID enumeration | Information Disclosure | Use UUID-based analyzer IDs, not sequential |
| Excessive LLM calls (SOP tracking) | Denial of Service | Rate limit per session; cap at max_messages per session |

## Sources

### Primary (HIGH confidence)
- [Azure AI Foundry Agents Quickstart](https://learn.microsoft.com/en-us/azure/ai-services/agents/quickstart) - Confirmed `additional_instructions` parameter on `runs.create_and_process()` with Python example
- [Azure Content Understanding Overview](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/overview) - GA service, custom analyzers, fieldSchema, audio/document support
- [Azure CU Audio Overview](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/audio/overview) - prebuilt-callCenter analyzer, transcription+diarization, custom field extraction from audio
- [Azure CU REST API Quickstart](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/quickstart/use-rest-api) - API patterns, submit-poll, response structure
- Codebase: `backend/app/services/agents/adapters/azure_content.py` - Existing CU adapter with submit-poll pattern
- Codebase: `backend/app/services/scoring_engine.py` - Current LLM scoring (to be replaced)
- Codebase: `backend/app/services/voice_scoring_service.py` - Current mock voice scoring
- Codebase: `backend/app/services/skill_manager.py` - Skill instruction composition pattern
- Codebase: `backend/pyproject.toml` - azure-ai-projects>=2.0.1 confirmed

### Secondary (MEDIUM confidence)
- [Azure CU Custom Analyzer Tutorial](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/tutorial/create-custom-analyzer) - fieldSchema structure with extract/generate/classify methods

### Tertiary (LOW confidence)
- Voice Live SDK additional_instructions support - Not directly verified in docs; assumed based on Agent SDK pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages already installed, APIs confirmed in official docs
- Architecture (Skill Focus): HIGH - additional_instructions confirmed with Python example in official quickstart
- Architecture (CU Scoring): MEDIUM - custom analyzer fieldSchema confirmed but exact scoring use case is novel
- Pitfalls: MEDIUM - based on API behavior documentation and codebase patterns

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (30 days - stable Azure GA APIs)
