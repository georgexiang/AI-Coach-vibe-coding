"""L2 AI quality evaluation service for Skill quality gates.

Runs asynchronously when admin triggers it. Evaluates skill content
across 6 dimensions using Azure OpenAI, binds scores to content hash
for staleness detection.

Independent from Scoring Rubrics system (D-13):
- L2 evaluates "is the Skill well-designed?" (content quality)
- Scoring Rubrics evaluate "did the MR perform well?" (training performance)
"""

import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.skill import Skill
from app.services import config_service
from app.services.skill_validation_service import _compute_content_hash

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Six evaluation dimensions (D-13)
# ---------------------------------------------------------------------------

EVALUATION_DIMENSIONS = [
    "sop_completeness",
    "assessment_coverage",
    "knowledge_accuracy",
    "difficulty_calibration",
    "conversation_logic",
    "executability",
]

# Human-readable descriptions for each dimension (transparency for admins)
DIMENSION_DESCRIPTIONS: dict[str, str] = {
    "sop_completeness": (
        "Are all required SOP stages present (opening, product discussion, closing)? "
        "Are steps detailed with key points, objections, and time guidance?"
    ),
    "assessment_coverage": (
        "Are assessment/evaluation criteria comprehensive? Do they cover all SOP steps? "
        "Are scoring rubrics clear and measurable?"
    ),
    "knowledge_accuracy": (
        "Are product knowledge points accurate and relevant? "
        "Are clinical references and data mentioned? Is terminology correct?"
    ),
    "difficulty_calibration": (
        "Is the difficulty level appropriate for the target audience? "
        "Are objection scenarios realistic? Is there progressive difficulty?"
    ),
    "conversation_logic": (
        "Does the conversation flow logically from opening to closing? "
        "Are transitions between topics natural? Are branching paths considered?"
    ),
    "executability": (
        "Can an AI agent execute this SOP effectively? "
        "Are instructions clear and unambiguous? Are edge cases handled?"
    ),
}

# ---------------------------------------------------------------------------
# L2 evaluation prompt
# ---------------------------------------------------------------------------

SKILL_EVALUATION_PROMPT = (
    "You are an expert coaching skill content evaluator "
    "for pharmaceutical sales training.\n\n"
    "Evaluate the following Skill content objectively "
    "and provide specific rationale for each score.\n\n"
    "## Skill Metadata\n"
    "- Name: {skill_name}\n"
    "- Description: {skill_description}\n"
    "- Product: {skill_product}\n"
    "- Therapeutic Area: {skill_therapeutic_area}\n\n"
    "## Skill Content (Coaching Protocol / SOP)\n"
    "{skill_content}\n\n"
    "## Reference Materials Summary\n"
    "{reference_summaries}\n\n"
    "## Evaluation Dimensions\n\n"
    "Score each of the following 6 dimensions from 0 to 100. "
    "For each dimension, provide:\n"
    "- score: integer 0-100\n"
    "- strengths: list of specific strong points "
    "(with evidence from content)\n"
    "- improvements: list of specific actionable improvements\n"
    "- critical_issues: list of critical problems "
    "that must be fixed (empty if none)\n"
    "- rationale: 1-2 sentence explanation of the score\n\n"
    "### Dimensions:\n"
    "1. **sop_completeness** - Are all required SOP stages "
    "present (opening, product discussion, closing)? "
    "Are steps detailed with key points, objections, "
    "and time guidance?\n"
    "2. **assessment_coverage** - Are assessment/evaluation "
    "criteria comprehensive? Do they cover all SOP steps? "
    "Are scoring rubrics clear and measurable?\n"
    "3. **knowledge_accuracy** - Are product knowledge points "
    "accurate and relevant? Are clinical references and data "
    "mentioned? Is terminology correct?\n"
    "4. **difficulty_calibration** - Is the difficulty level "
    "appropriate for the target audience? Are objection "
    "scenarios realistic? Is there progressive difficulty?\n"
    "5. **conversation_logic** - Does the conversation flow "
    "logically from opening to closing? Are transitions "
    "between topics natural? Are branching paths considered?\n"
    "6. **executability** - Can an AI agent execute this SOP "
    "effectively? Are instructions clear and unambiguous? "
    "Are edge cases handled?\n\n"
    "## Output Format\n\n"
    "Return a JSON object with this exact structure:\n"
    "{{\n"
    '  "overall_score": <weighted average 0-100>,\n'
    '  "overall_verdict": '
    '"<PASS if >= 70, NEEDS_REVIEW if 50-69, FAIL if < 50>",\n'
    '  "dimensions": [\n'
    "    {{\n"
    '      "name": "<dimension_name>",\n'
    '      "score": <0-100>,\n'
    '      "verdict": "<PASS|NEEDS_REVIEW|FAIL>",\n'
    '      "strengths": ["<specific strength>"],\n'
    '      "improvements": ["<specific improvement>"],\n'
    '      "critical_issues": '
    '["<critical issue or empty list>"],\n'
    '      "rationale": "<1-2 sentence explanation>"\n'
    "    }}\n"
    "  ],\n"
    '  "summary": "<2-3 sentence overall assessment>",\n'
    '  "top_3_improvements": '
    '["<improvement 1>", "<improvement 2>", "<improvement 3>"]\n'
    "}}\n\n"
    "Evaluate objectively. "
    "Be constructive but honest about weaknesses.\n"
    "{language_instruction}"
)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class DimensionScore:
    """Score for a single evaluation dimension."""

    name: str
    score: int
    verdict: str
    strengths: list[str] = field(default_factory=list)
    improvements: list[str] = field(default_factory=list)
    critical_issues: list[str] = field(default_factory=list)
    rationale: str = ""


@dataclass
class SkillEvaluationResult:
    """Complete L2 evaluation result."""

    overall_score: int
    overall_verdict: str
    dimensions: list[DimensionScore] = field(default_factory=list)
    summary: str = ""
    top_improvements: list[str] = field(default_factory=list)
    content_hash: str = ""
    evaluated_at: str = ""
    # Transparency metadata
    evaluation_status: str = "ai_success"  # ai_success | ai_unavailable | ai_error
    model_used: str = ""
    error_detail: str = ""


# ---------------------------------------------------------------------------
# Verdict helpers
# ---------------------------------------------------------------------------


def _get_eval_language_instruction() -> str:
    """Return language instruction for evaluation prompts based on skill_sop_language."""
    from app.config import get_settings

    lang = get_settings().skill_sop_language
    if lang == "zh":
        return "IMPORTANT: Write all text content (summary, strengths, improvements, rationale) in Chinese (中文)."
    return ""


def _compute_verdict(score: int) -> str:
    """Determine verdict from score: PASS >= 70, NEEDS_REVIEW 50-69, FAIL < 50."""
    if score >= 70:
        return "PASS"
    if score >= 50:
        return "NEEDS_REVIEW"
    return "FAIL"


# ---------------------------------------------------------------------------
# Main evaluation function
# ---------------------------------------------------------------------------


async def evaluate_skill_quality(
    db: AsyncSession,
    skill_id: str,
) -> SkillEvaluationResult:
    """Run L2 AI quality evaluation on a skill.

    Calls Azure OpenAI to evaluate skill content across 6 dimensions.
    Stores result in skill's quality fields with content_hash binding.
    """
    # Load skill with resources
    result = await db.execute(
        select(Skill).options(selectinload(Skill.resources)).where(Skill.id == skill_id)
    )
    skill = result.scalar_one_or_none()
    if skill is None:
        raise ValueError(f"Skill {skill_id} not found")

    content = skill.content or ""
    content_hash = _compute_content_hash(content)

    # Build reference material summaries
    ref_summaries = []
    for resource in skill.resources:
        if resource.resource_type == "reference" and resource.text_content:
            summary = resource.text_content[:5000]
            ref_summaries.append(f"### {resource.filename}\n{summary}")
    reference_text = "\n\n".join(ref_summaries) if ref_summaries else "No reference materials."

    # Truncate content to 50000 chars for prompt
    truncated_content = content[:50000]
    if len(content) > 50000:
        truncated_content += "\n\n... (content truncated for evaluation)"

    prompt = SKILL_EVALUATION_PROMPT.format(
        skill_name=skill.name or "Untitled",
        skill_description=skill.description or "No description",
        skill_product=skill.product or "Not specified",
        skill_therapeutic_area=skill.therapeutic_area or "Not specified",
        skill_content=truncated_content,
        reference_summaries=reference_text,
        language_instruction=_get_eval_language_instruction(),
    )

    # Try evaluator agent first, fall back to direct OpenAI
    from app.services import meta_skill_service

    evaluator_meta = await meta_skill_service.get_meta_skill(db, "evaluator")
    if evaluator_meta and evaluator_meta.agent_id:
        ai_call = await _call_agent_for_evaluation(
            db, prompt, evaluator_meta.agent_id,
            evaluator_meta.agent_version, evaluator_meta.model,
        )
    else:
        ai_call = await _call_openai_for_evaluation(db, prompt)
    evaluated_at = datetime.now(tz=UTC).isoformat()

    if ai_call.data is None:
        # Fallback: return a result that clearly signals AI was not available
        logger.warning(
            "AI evaluation unavailable for skill %s (status=%s): %s",
            skill_id, ai_call.status, ai_call.error_detail,
        )
        eval_result = SkillEvaluationResult(
            overall_score=0,
            overall_verdict="FAIL",
            dimensions=[
                DimensionScore(
                    name=dim,
                    score=0,
                    verdict="FAIL",
                    rationale="AI evaluation service unavailable",
                )
                for dim in EVALUATION_DIMENSIONS
            ],
            summary="AI evaluation service is not configured or unavailable.",
            top_improvements=["Configure Azure OpenAI endpoint for quality evaluation."],
            content_hash=content_hash,
            evaluated_at=evaluated_at,
            evaluation_status=ai_call.status,
            model_used=ai_call.model_used,
            error_detail=ai_call.error_detail,
        )
    else:
        eval_result = _parse_evaluation_result(ai_call.data, content_hash, evaluated_at)
        eval_result.evaluation_status = "ai_success"
        eval_result.model_used = ai_call.model_used

    # Store in skill fields
    skill.quality_score = eval_result.overall_score
    skill.quality_verdict = eval_result.overall_verdict
    details_dict = {
        **asdict(eval_result),
        "content_hash": content_hash,
        "evaluated_at": evaluated_at,
    }
    # Add agent audit trail if evaluator agent was used
    if evaluator_meta and evaluator_meta.agent_id:
        details_dict["evaluator_agent"] = {
            "agent_id": evaluator_meta.agent_id,
            "agent_version": evaluator_meta.agent_version,
            "model": evaluator_meta.model,
            "method": "agent",
        }
    else:
        details_dict["evaluator_agent"] = {"method": "direct_openai"}
    skill.quality_details = json.dumps(details_dict, ensure_ascii=False)
    await db.flush()

    return eval_result


@dataclass
class _AICallResult:
    """Internal result from the AI call attempt."""

    data: dict | None
    status: str  # "ai_success" | "ai_unavailable" | "ai_error"
    model_used: str = ""
    error_detail: str = ""


async def _call_agent_for_evaluation(
    db: AsyncSession, prompt: str, agent_id: str, agent_version: str, model: str
) -> _AICallResult:
    """Call the evaluator agent via Responses API. Same pattern as agent_chat_service."""
    from app.services.agent_sync_service import (
        _get_project_client,
        get_project_endpoint,
    )

    try:
        project_endpoint, api_key = await get_project_endpoint(db)
        client = _get_project_client(project_endpoint, api_key)
        openai_client = client.get_openai_client()

        response = openai_client.responses.create(
            model=model,
            input=[{"role": "user", "content": prompt}],
            extra_body={
                "agent_reference": {
                    "name": agent_id,
                    "version": agent_version or "1",
                    "type": "agent_reference",
                }
            },
        )
        content = response.output_text
        if not content:
            return _AICallResult(
                data=None, status="ai_error", model_used=model,
                error_detail="Agent returned empty content",
            )
        return _AICallResult(data=json.loads(content), status="ai_success", model_used=model)
    except Exception as e:
        logger.error("Agent evaluation failed: %s", e, exc_info=True)
        return _AICallResult(
            data=None, status="ai_error", model_used=model,
            error_detail=str(e)[:500],
        )


async def _call_openai_for_evaluation(db: AsyncSession, prompt: str) -> _AICallResult:
    """Call Azure OpenAI for skill evaluation. Returns structured result with status."""
    endpoint = await config_service.get_effective_endpoint(db, "azure_openai")
    api_key = await config_service.get_effective_key(db, "azure_openai")

    if not endpoint or not api_key:
        logger.info("L2 evaluation unavailable: no Azure OpenAI endpoint/key configured")
        return _AICallResult(
            data=None,
            status="ai_unavailable",
            error_detail="Azure OpenAI endpoint or API key not configured",
        )

    config = await config_service.get_config(db, "azure_openai")
    from app.config import get_settings

    settings = get_settings()
    deployment = (
        config.model_or_deployment
        if config and config.model_or_deployment
        else settings.default_chat_model
    )

    try:
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=settings.skill_ai_api_version,
        )
    except ImportError:
        logger.warning("openai package not installed, cannot run L2 evaluation")
        return _AICallResult(
            data=None,
            status="ai_unavailable",
            model_used=deployment,
            error_detail="openai package not installed",
        )

    try:
        response = await client.chat.completions.create(
            model=deployment,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a coaching skill content evaluator. "
                        "Return ONLY valid JSON, no markdown fences."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=settings.skill_ai_temperature,
            max_completion_tokens=settings.skill_ai_max_tokens,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        if not content:
            logger.error("L2 evaluation returned empty content")
            return _AICallResult(
                data=None,
                status="ai_error",
                model_used=deployment,
                error_detail="AI returned empty content",
            )

        return _AICallResult(
            data=json.loads(content),
            status="ai_success",
            model_used=deployment,
        )
    except Exception as e:
        error_msg = str(e)[:500]
        logger.error("L2 evaluation failed: %s", e, exc_info=True)
        return _AICallResult(
            data=None,
            status="ai_error",
            model_used=deployment,
            error_detail=error_msg,
        )


def _parse_evaluation_result(
    ai_result: dict,
    content_hash: str,
    evaluated_at: str,
) -> SkillEvaluationResult:
    """Parse and validate AI evaluation response into SkillEvaluationResult."""
    dimensions: list[DimensionScore] = []

    ai_dimensions = ai_result.get("dimensions", [])
    # Build a lookup from AI response
    ai_dim_map: dict[str, dict] = {}
    for d in ai_dimensions:
        name = d.get("name", "")
        if name:
            ai_dim_map[name] = d

    # Ensure all 6 dimensions are present
    for dim_name in EVALUATION_DIMENSIONS:
        if dim_name in ai_dim_map:
            d = ai_dim_map[dim_name]
            score = max(0, min(100, int(d.get("score", 0))))
            dimensions.append(
                DimensionScore(
                    name=dim_name,
                    score=score,
                    verdict=_compute_verdict(score),
                    strengths=d.get("strengths", []),
                    improvements=d.get("improvements", []),
                    critical_issues=d.get("critical_issues", []),
                    rationale=d.get("rationale", ""),
                )
            )
        else:
            # Missing dimension from AI response -- score 0
            dimensions.append(
                DimensionScore(
                    name=dim_name,
                    score=0,
                    verdict="FAIL",
                    rationale="Dimension not evaluated by AI",
                )
            )

    # Compute overall score as average of all dimensions
    if dimensions:
        overall_score = round(sum(d.score for d in dimensions) / len(dimensions))
    else:
        overall_score = 0

    overall_verdict = _compute_verdict(overall_score)

    return SkillEvaluationResult(
        overall_score=overall_score,
        overall_verdict=overall_verdict,
        dimensions=dimensions,
        summary=ai_result.get("summary", ""),
        top_improvements=ai_result.get("top_3_improvements", [])[:3],
        content_hash=content_hash,
        evaluated_at=evaluated_at,
    )


# ---------------------------------------------------------------------------
# Staleness detection (T-19-13: prevent quality gate bypass via stale scores)
# ---------------------------------------------------------------------------


def is_evaluation_stale(skill: Skill) -> bool:
    """Check if the stored evaluation is stale (content changed since evaluation).

    Returns True if content_hash in quality_details differs from current content hash.
    Returns True if no evaluation exists (no quality_details).
    """
    quality_details_raw = skill.quality_details or "{}"
    try:
        details = json.loads(quality_details_raw)
    except (json.JSONDecodeError, TypeError):
        return True

    stored_hash = details.get("content_hash", "")
    if not stored_hash:
        return True

    current_hash = _compute_content_hash(skill.content or "")
    return stored_hash != current_hash
