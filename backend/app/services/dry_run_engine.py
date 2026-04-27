"""Dry Run simulation engine — orchestrates AI MR/HCP conversation for SOP coverage testing.

Runs as a durable background task with its own DB session (not tied to the
HTTP request lifecycle). Extracts SOP steps from Skill content, simulates a
multi-turn MR/HCP conversation via Azure OpenAI, tracks which SOP steps are
covered, and produces an executability score.

Launched via ``asyncio.create_task(run_dry_run_simulation(dry_run_id))``
from the POST create endpoint.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import UTC, datetime

from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_TURNS = 20
DRY_RUN_MODEL = "gpt-4o"

# Fallback marker — if the first LLM response contains this, the AI service is down
_FALLBACK_MARKER = "unavailable -- simulation continues"

# Minimum keyword overlap count to consider a message matching a SOP step
_MATCH_THRESHOLD = 2
# Minimum word length to be considered a "meaningful" word for matching
_MIN_WORD_LENGTH = 3

# ---------------------------------------------------------------------------
# System prompt templates
# ---------------------------------------------------------------------------

_MR_SYSTEM_PROMPT = """\
You are a Medical Representative (MR) in a training simulation. Your goal is to \
practice selling a pharmaceutical product to a doctor (HCP).

You must follow the SOP (Standard Operating Procedure) steps below and try to \
cover all of them during the conversation. Be natural, professional, and respond \
to the HCP's questions and objections.

SOP Steps to follow:
{formatted_sop_steps}

Rules:
- Start with a greeting and introduction
- Follow the SOP steps in order when possible
- Respond naturally to HCP questions/objections
- Try to cover ALL SOP steps
- Keep responses concise (2-4 sentences)
- End the conversation after covering all steps or after 20 exchanges"""

_HCP_SYSTEM_PROMPT = """\
You are a Healthcare Professional (HCP/Doctor) in a training simulation. A Medical \
Representative (MR) is visiting you to discuss a pharmaceutical product.

Behave like a realistic doctor:
- You are busy and have limited time (10-15 minutes)
- Ask relevant clinical questions about efficacy, safety, dosing
- Raise common objections (cost, existing treatments, guidelines)
- Show interest when the MR presents compelling data
- Be professional but direct
- Keep responses concise (1-3 sentences)

Product context from the Skill:
{skill_name}: {skill_description}"""

# Phrases that signal the end of a conversation (case-insensitive)
_ENDING_PHRASES = [
    "thank you for your time",
    "thanks for your time",
    "i'll let you go",
    "goodbye",
    "see you next time",
    "have a good day",
    "i should let you get back",
    "it was nice talking",
    "take care",
    "until next time",
]


# ---------------------------------------------------------------------------
# SOP extraction
# ---------------------------------------------------------------------------


def _extract_sop_steps(content: str) -> list[dict]:
    """Extract SOP steps from skill markdown content.

    Recognises:
      - ``## Step N:`` or ``### N.`` style headers
      - Numbered list items ``1. ...``, ``2. ...``

    Returns list of dicts with keys: step_id, step_name, step_content.
    If no steps are found, wraps the entire content as a single step.
    """
    if not content or not content.strip():
        return [{"step_id": "step_1", "step_name": "Full Content", "step_content": content or ""}]

    steps: list[dict] = []

    # Pattern 1: markdown headers like "## Step 1: Introduction" or "### 1. Opening"
    header_pattern = re.compile(
        r"^(?:#{2,3})\s*(?:Step\s+)?(\d+)[.:\s]+(.+?)$",
        re.MULTILINE | re.IGNORECASE,
    )
    headers = list(header_pattern.finditer(content))

    if headers:
        for i, match in enumerate(headers):
            step_num = match.group(1)
            step_name = match.group(2).strip()
            start = match.end()
            end = headers[i + 1].start() if i + 1 < len(headers) else len(content)
            step_content = content[start:end].strip()
            steps.append(
                {
                    "step_id": f"step_{step_num}",
                    "step_name": step_name,
                    "step_content": step_content,
                }
            )
        return steps

    # Pattern 2: numbered list items "1. ...", "2. ..."
    list_pattern = re.compile(r"^(\d+)\.\s+(.+?)$", re.MULTILINE)
    items = list(list_pattern.finditer(content))

    if len(items) >= 2:
        for i, match in enumerate(items):
            step_num = match.group(1)
            step_name = match.group(2).strip()
            start = match.end()
            end = items[i + 1].start() if i + 1 < len(items) else len(content)
            step_content = content[start:end].strip()
            steps.append(
                {
                    "step_id": f"step_{step_num}",
                    "step_name": step_name,
                    "step_content": step_content,
                }
            )
        return steps

    # Fallback: treat whole content as one step
    return [{"step_id": "step_1", "step_name": "Full Content", "step_content": content}]


# ---------------------------------------------------------------------------
# SOP step matching (keyword overlap)
# ---------------------------------------------------------------------------


def _tokenize(text: str) -> set[str]:
    """Tokenize text into a set of lowercase meaningful words (len > _MIN_WORD_LENGTH)."""
    words = re.findall(r"[a-zA-Z\u4e00-\u9fff]+", text.lower())
    return {w for w in words if len(w) > _MIN_WORD_LENGTH}


def _match_sop_step(
    message: str,
    sop_steps: list[dict],
    role: str,
) -> dict | None:
    """Match a message to the best-fitting SOP step using keyword overlap.

    Only matches for MR messages -- HCP responses don't advance SOP coverage.
    Returns the best-matching step dict or None.
    """
    if role != "mr":
        return None

    msg_tokens = _tokenize(message)
    if not msg_tokens:
        return None

    best_step: dict | None = None
    best_score = 0

    for step in sop_steps:
        combined = f"{step['step_name']} {step['step_content']}"
        step_tokens = _tokenize(combined)
        overlap = len(msg_tokens & step_tokens)
        if overlap >= _MATCH_THRESHOLD and overlap > best_score:
            best_score = overlap
            best_step = step

    return best_step


# ---------------------------------------------------------------------------
# Conversation ending detection
# ---------------------------------------------------------------------------


def _is_conversation_ending(message: str, turn_number: int) -> bool:
    """Detect if the conversation should end.

    Returns True when:
      - Turn number is >= 18 (approaching MAX_TURNS)
      - Message contains common ending phrases
    """
    if turn_number >= 18:
        return True
    lower = message.lower()
    return any(phrase in lower for phrase in _ENDING_PHRASES)


# ---------------------------------------------------------------------------
# Coverage computation
# ---------------------------------------------------------------------------


def _compute_sop_coverage(
    sop_steps: list[dict],
    messages: list[dict],
) -> list[dict]:
    """Compute per-step coverage from conversation messages.

    Each message dict has keys: role, content, sop_step_id (may be None).

    Returns list of dicts with:
      step_id, step_name, status ("covered"|"partial"|"not_covered"),
      matched_message_ids (list of sequence indices), details
    """
    # Build map: step_id -> list of matching message indices
    step_matches: dict[str, list[int]] = {s["step_id"]: [] for s in sop_steps}

    for idx, msg in enumerate(messages):
        sid = msg.get("sop_step_id")
        if sid and sid in step_matches:
            step_matches[sid].append(idx)

    coverage: list[dict] = []
    for step in sop_steps:
        matched = step_matches[step["step_id"]]
        if len(matched) >= 1:
            status = "covered"
            details = f"Covered in {len(matched)} message(s)"
        else:
            # Check for weak partial match: any MR message with at least 1 keyword overlap
            partial = False
            for idx, msg in enumerate(messages):
                if msg.get("role") != "mr":
                    continue
                msg_tokens = _tokenize(msg["content"])
                step_tokens = _tokenize(f"{step['step_name']} {step['step_content']}")
                if len(msg_tokens & step_tokens) >= 1:
                    partial = True
                    break
            if partial:
                status = "partial"
                details = "Weak keyword overlap detected but below match threshold"
            else:
                status = "not_covered"
                details = "No matching messages found"

        coverage.append(
            {
                "step_id": step["step_id"],
                "step_name": step["step_name"],
                "status": status,
                "matched_message_ids": matched,
                "details": details,
            }
        )

    return coverage


def _identify_issues(
    coverage_map: list[dict],
    sop_steps: list[dict],
) -> list[dict]:
    """Identify issues from coverage gaps.

    For each not_covered step: create error-severity issue.
    For each partial step: create warning-severity issue.
    """
    # Build name lookup
    step_name_map = {s["step_id"]: s["step_name"] for s in sop_steps}

    issues: list[dict] = []
    for entry in coverage_map:
        sid = entry["step_id"]
        name = step_name_map.get(sid, sid)

        if entry["status"] == "not_covered":
            issues.append(
                {
                    "severity": "error",
                    "step_id": sid,
                    "description": f"SOP step '{name}' was not covered during the simulation",
                    "suggestion": (
                        f"Review step '{name}' -- the MR agent did not address this topic. "
                        "Consider simplifying the step description or adding clearer keywords."
                    ),
                }
            )
        elif entry["status"] == "partial":
            issues.append(
                {
                    "severity": "warning",
                    "step_id": sid,
                    "description": f"SOP step '{name}' was only partially covered",
                    "suggestion": (
                        f"Step '{name}' had weak coverage. "
                        "Consider making the step content more specific or "
                        "adding example phrases the MR should use."
                    ),
                }
            )

    return issues


def _compute_executability_score(
    coverage_map: list[dict],
    num_messages: int,
) -> int:
    """Compute an executability score (0-100) from coverage results.

    Base score: (covered * 100 + partial * 50) / total_steps
    Conversation quality bonus: up to 10 points if num_messages >= 8
    Capped at 100.
    """
    total = len(coverage_map)
    if total == 0:
        return 0

    covered = sum(1 for c in coverage_map if c["status"] == "covered")
    partial = sum(1 for c in coverage_map if c["status"] == "partial")

    base_score = (covered * 100 + partial * 50) / total

    # Conversation quality bonus
    quality_bonus = 0
    if num_messages >= 8:
        quality_bonus = min(10, (num_messages - 8) * 2)

    return min(100, round(base_score + quality_bonus))


# ---------------------------------------------------------------------------
# LLM call helper
# ---------------------------------------------------------------------------


async def _call_llm(
    system_prompt: str,
    conversation: list[dict],
    agent_name: str,
    *,
    project_endpoint: str,
    api_key: str,
) -> str:
    """Call Azure AI Foundry Responses API for a conversation turn.

    Uses the same client infrastructure as skill_evaluation_service
    (get_project_endpoint + _get_project_client + openai_client.responses.create).

    Returns the assistant response text, or a fallback message on failure.
    """
    from app.services.agent_sync_service import _get_project_client

    try:
        client = _get_project_client(project_endpoint, api_key)
        openai_client = client.get_openai_client()

        # Build input messages for the Responses API
        input_messages = [{"role": "system", "content": system_prompt}]
        for msg in conversation:
            # Alternate user/assistant from the current agent's perspective
            if msg["role"] == agent_name.lower():
                input_messages.append({"role": "assistant", "content": msg["content"]})
            else:
                input_messages.append({"role": "user", "content": msg["content"]})

        response = openai_client.responses.create(
            model=DRY_RUN_MODEL,
            input=input_messages,
        )
        content = response.output_text or ""
        # Truncate to 500 chars for safety (T-20-08)
        return content[:500]
    except Exception as e:
        logger.warning("_call_llm failed for %s: %s", agent_name, e)
        return f"[{agent_name} unavailable -- simulation continues]"


# ---------------------------------------------------------------------------
# Main simulation orchestrator
# ---------------------------------------------------------------------------


async def run_dry_run_simulation(dry_run_id: str) -> None:
    """Run a full dry-run simulation as a durable background task.

    Creates its own DB session via AsyncSessionLocal (not tied to the
    HTTP request that spawned it). Updates the DryRun record with
    results or error state on completion.
    """
    from app.models.dry_run import DryRun, DryRunMessage
    from app.models.skill import Skill
    from app.services.agent_sync_service import get_project_endpoint

    async with AsyncSessionLocal() as db:
        try:
            # 1. Load DryRun and Skill
            dry_run = await db.get(DryRun, dry_run_id)
            if not dry_run:
                logger.error("run_dry_run_simulation: DryRun %s not found", dry_run_id)
                return

            skill = await db.get(Skill, dry_run.skill_id)
            if not skill:
                dry_run.status = "failed"
                dry_run.error_message = "Associated skill not found"
                await db.commit()
                return

            # 2. Set status to running
            dry_run.status = "running"
            start_time = datetime.now(tz=UTC)
            await db.flush()

            # 3. Extract SOP steps
            sop_steps = _extract_sop_steps(skill.content or "")
            dry_run.total_sop_steps = len(sop_steps)
            await db.flush()

            # 4. Build system prompts
            formatted_steps = "\n".join(
                f"  {s['step_id']}: {s['step_name']}\n    {s['step_content'][:200]}"
                for s in sop_steps
            )
            mr_system_prompt = _MR_SYSTEM_PROMPT.format(formatted_sop_steps=formatted_steps)
            hcp_system_prompt = _HCP_SYSTEM_PROMPT.format(
                skill_name=skill.name or "Unnamed Skill",
                skill_description=skill.description or "No description provided",
            )

            # 5. Pre-fetch AI endpoint (avoid DB reads during conversation loop)
            project_endpoint, api_key_val = await get_project_endpoint(db)

            # 6. Simulation loop
            conversation: list[dict] = []
            sequence = 0

            for turn in range(MAX_TURNS):
                current_role = "mr" if turn % 2 == 0 else "hcp"

                if current_role == "mr":
                    response = await _call_llm(
                        mr_system_prompt,
                        conversation,
                        "mr",
                        project_endpoint=project_endpoint,
                        api_key=api_key_val,
                    )
                else:
                    response = await _call_llm(
                        hcp_system_prompt,
                        conversation,
                        "hcp",
                        project_endpoint=project_endpoint,
                        api_key=api_key_val,
                    )

                # Early abort: if first MR turn fails, AI service is unavailable
                if turn == 0 and _FALLBACK_MARKER in response:
                    dry_run.status = "failed"
                    dry_run.error_message = (
                        "AI service unavailable — check Azure AI Foundry configuration. "
                        f"First LLM response: {response[:200]}"
                    )
                    await db.commit()
                    logger.error(
                        "Dry run %s aborted: AI service unavailable on first turn",
                        dry_run_id,
                    )
                    return

                conversation.append({"role": current_role, "content": response})

                # Annotate with SOP step matching
                matched_step = _match_sop_step(response, sop_steps, current_role)

                # Save message to DB
                msg = DryRunMessage(
                    dry_run_id=dry_run_id,
                    sequence_number=sequence,
                    role=current_role,
                    content=response,
                    sop_step_id=matched_step["step_id"] if matched_step else None,
                    sop_step_name=matched_step["step_name"] if matched_step else None,
                )
                db.add(msg)
                sequence += 1

                await db.flush()

                # Check for natural conversation end
                if _is_conversation_ending(response, turn):
                    break

            # 7. Compute coverage report
            # Enrich conversation with sop_step_id for coverage computation
            annotated_msgs: list[dict] = []
            for i, msg_data in enumerate(conversation):
                matched = _match_sop_step(msg_data["content"], sop_steps, msg_data["role"])
                annotated_msgs.append(
                    {
                        "role": msg_data["role"],
                        "content": msg_data["content"],
                        "sop_step_id": matched["step_id"] if matched else None,
                    }
                )

            coverage_map = _compute_sop_coverage(sop_steps, annotated_msgs)
            issues = _identify_issues(coverage_map, sop_steps)
            score = _compute_executability_score(coverage_map, len(conversation))

            # 8. Update DryRun with results
            covered_count = sum(1 for c in coverage_map if c["status"] == "covered")
            partial_count = sum(1 for c in coverage_map if c["status"] == "partial")
            total_steps = len(sop_steps)

            dry_run.status = "completed"
            dry_run.executability_score = score
            dry_run.coverage_percent = (
                round(covered_count * 100 / total_steps) if total_steps else 0
            )
            dry_run.total_sop_steps = total_steps
            dry_run.covered_sop_steps = covered_count
            dry_run.partial_sop_steps = partial_count
            dry_run.issues_count = len(issues)
            dry_run.issues_json = json.dumps(issues, ensure_ascii=False)
            dry_run.sop_coverage_json = json.dumps(coverage_map, ensure_ascii=False)
            dry_run.duration_seconds = int((datetime.now(tz=UTC) - start_time).total_seconds())
            await db.commit()

            logger.info(
                "Dry run %s completed: score=%d, coverage=%d%%, issues=%d, turns=%d",
                dry_run_id,
                score,
                dry_run.coverage_percent,
                len(issues),
                len(conversation),
            )

        except Exception as e:
            logger.exception("Dry run simulation failed for %s", dry_run_id)
            try:
                dry_run = await db.get(DryRun, dry_run_id)
                if dry_run:
                    dry_run.status = "failed"
                    dry_run.error_message = str(e)[:500]
                    await db.commit()
            except Exception:
                logger.exception("Failed to update dry run %s error state", dry_run_id)
