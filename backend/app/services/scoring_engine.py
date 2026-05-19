"""LLM-based content scoring engine for multi-dimensional coaching evaluation.

Primary content scoring engine using Azure OpenAI (GPT-4o) with structured JSON output.
Produces real scoring based on conversation transcript, HCP profile, scenario objectives,
key message delivery status, and skill-specific criteria.

Voice scoring is handled separately by cu_evaluation_service.score_voice_with_cu().
"""

import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import config_service
from app.utils.exceptions import ScoringUnavailableException

logger = logging.getLogger(__name__)

SCORING_PROMPT_TEMPLATE = """You are an expert pharmaceutical sales training evaluator for BeiGene.
You evaluate ONLY the Medical Representative (MR, role="user") performance.
DO NOT evaluate the HCP (role="assistant") performance.

Key rules:
- If key messages are NOT DELIVERED, key_message score MUST be below 30.
- If MR's messages are unrelated to the product/therapeutic area, ALL scores MUST be below 50.
- Reference actual MR quotes in strengths/weaknesses.
- Be strict: vague or off-topic responses deserve low scores.

Analyze the following MR conversation with a
Healthcare Professional (HCP) and provide a detailed multi-dimensional scoring.

## HCP Profile
- Name: {hcp_name}
- Specialty: {hcp_specialty}
- Personality: {hcp_personality}
- Communication Style: {hcp_comm_style}

## Scenario
- Product: {product}
- Therapeutic Area: {therapeutic_area}
- Difficulty: {difficulty}

## Key Messages to Deliver
{key_messages_list}

## Key Message Delivery Status
{key_messages_status}

{skill_criteria_section}## Conversation Transcript
{transcript}

## Scoring Dimensions and Weights
{dimensions_config}

## Instructions

Score each dimension from 0-100 based on the actual conversation content. Be specific:
- Reference actual quotes from the MR's responses in strengths/weaknesses
- Use the dimension criteria provided above as your scoring guide for each dimension
- Evaluate how well the MR addressed the HCP's concerns and delivered the required information

Return a JSON object with this exact structure:
{{
  "dimensions": [
    {{
      "dimension": "<dimension_name>",
      "score": <0-100>,
      "weight": <weight_from_config>,
      "strengths": [{{"text": "<observation>", "quote": "<MR quote or null>"}}],
      "weaknesses": [{{"text": "<observation>", "quote": "<MR quote or null>"}}],
      "suggestions": ["<actionable suggestion>"]
    }}
  ],
  "feedback_summary": "<2-3 sentence overall assessment>"
}}"""


def build_dimensions_instructions(rubric_dimensions: list[dict]) -> str:
    """Build dimension config text from rubric dimensions for the scoring prompt."""
    lines = []
    for dim in rubric_dimensions:
        name = dim["name"]
        weight = dim["weight"]
        criteria = dim.get("criteria", [])
        lines.append(f"- {name} (weight={weight}%)")
        if criteria:
            for criterion in criteria:
                lines.append(f"  * {criterion}")
    return "\n".join(lines)


def build_scoring_prompt(
    scenario_data: dict,
    messages: list[dict],
    key_messages_status: list[dict],
    rubric_dimensions: list[dict],
    skill_criteria: str = "",
) -> str:
    """Build the scoring prompt from session data."""
    # Format transcript
    transcript_lines = []
    for msg in messages:
        role_label = "MR" if msg["role"] == "user" else "HCP"
        transcript_lines.append(f"{role_label}: {msg['content']}")
    transcript = "\n".join(transcript_lines)

    # Format key messages list
    key_messages = scenario_data.get("key_messages", [])
    if isinstance(key_messages, str):
        key_messages = json.loads(key_messages)
    km_list = "\n".join(f"- {km}" for km in key_messages) if key_messages else "None specified"

    # Format delivery status
    km_status_lines = []
    for km in key_messages_status:
        status = "DELIVERED" if km.get("delivered") else "NOT DELIVERED"
        km_status_lines.append(f"- [{status}] {km.get('message', '')}")
    km_status = "\n".join(km_status_lines) if km_status_lines else "No tracking data"

    # Format dimensions config from rubric dimensions
    dims_config = build_dimensions_instructions(rubric_dimensions)

    # Format Skill-specific assessment criteria section
    if skill_criteria:
        skill_section = (
            "## Skill-Specific Assessment Criteria\n\n"
            "The following assessment criteria are defined by the assigned coaching skill. "
            "Use these criteria as additional guidance when scoring each dimension — "
            "they represent what the training designer considers most important.\n\n"
            f"{skill_criteria}\n\n"
        )
    else:
        skill_section = ""

    hcp = scenario_data.get("hcp_profile", {})

    return SCORING_PROMPT_TEMPLATE.format(
        hcp_name=hcp.get("name", "Unknown"),
        hcp_specialty=hcp.get("specialty", "Unknown"),
        hcp_personality=hcp.get("personality_type", "neutral"),
        hcp_comm_style=hcp.get("communication_style", "50"),
        product=scenario_data.get("product", "Unknown"),
        therapeutic_area=scenario_data.get("therapeutic_area", ""),
        difficulty=scenario_data.get("difficulty", "medium"),
        key_messages_list=km_list,
        key_messages_status=km_status,
        transcript=transcript,
        dimensions_config=dims_config,
        skill_criteria_section=skill_section,
    )


async def score_with_llm(
    db: AsyncSession,
    scenario_data: dict,
    messages: list[dict],
    key_messages_status: list[dict],
    rubric_dimensions: list[dict],
    pass_threshold: int = 70,
    skill_criteria: str = "",
) -> dict:
    """Score a session using LLM (primary content scoring engine).

    Uses the Azure OpenAI endpoint configured in the admin panel (service_name="azure_openai")
    or falls back to the master AI Foundry endpoint.

    Raises ScoringUnavailableException if LLM is not configured or call fails.
    """
    endpoint = await config_service.get_effective_endpoint(db, "azure_openai")
    api_key = await config_service.get_effective_key(db, "azure_openai")

    if not endpoint or not api_key:
        raise ScoringUnavailableException(
            "Content scoring unavailable: no Azure OpenAI endpoint/key configured"
        )

    # Get deployment/model name
    config = await config_service.get_config(db, "azure_openai")
    from app.config import get_settings

    deployment = (
        config.model_or_deployment
        if config and config.model_or_deployment
        else get_settings().voice_live_default_model
    )

    try:
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version="2024-06-01",
        )
    except ImportError:
        raise ScoringUnavailableException(
            "Content scoring unavailable: openai package not installed"
        )

    # Build weights lookup from rubric dimensions for post-validation
    weights = {dim["name"]: dim["weight"] for dim in rubric_dimensions}

    prompt = build_scoring_prompt(
        scenario_data, messages, key_messages_status, rubric_dimensions, skill_criteria
    )

    try:
        response = await client.chat.completions.create(
            model=deployment,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a pharmaceutical sales training evaluator for BeiGene. "
                        "You evaluate ONLY the MR (role=user) performance, NOT the HCP. "
                        "Return ONLY valid JSON, no markdown fences."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_completion_tokens=2048,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        if not content:
            raise ScoringUnavailableException("LLM scoring returned empty content")

        result = json.loads(content)
    except ScoringUnavailableException:
        raise
    except Exception as e:
        logger.error("LLM scoring failed: %s", e, exc_info=True)
        raise ScoringUnavailableException(f"Content scoring failed: {e}") from e

    # Validate and compute overall score
    dimensions = result.get("dimensions", [])
    if not dimensions:
        raise ScoringUnavailableException("LLM scoring returned no dimensions")

    # Ensure weights match what we provided and tag category
    for dim in dimensions:
        expected_weight = weights.get(dim.get("dimension", ""), 0)
        if expected_weight:
            dim["weight"] = expected_weight
        dim["category"] = "content"

    overall_score = sum(dim["score"] * dim["weight"] / 100 for dim in dimensions)
    overall_score = round(overall_score, 1)
    passed = overall_score >= pass_threshold

    feedback_summary = result.get("feedback_summary", "")
    if not feedback_summary:
        delivered_count = sum(1 for km in key_messages_status if km.get("delivered"))
        total_count = len(key_messages_status)
        feedback_summary = (
            f"Overall score: {overall_score}. "
            f"Delivered {delivered_count}/{total_count} key messages."
        )

    return {
        "overall_score": overall_score,
        "passed": passed,
        "feedback_summary": feedback_summary,
        "dimensions": dimensions,
    }
