"""LLM-based scoring engine for multi-dimensional coaching evaluation.

Calls Azure OpenAI (or compatible endpoint) with structured JSON output
to produce real scoring based on conversation transcript, HCP profile,
scenario objectives, and key message delivery status.

Falls back to mock scoring when no LLM is configured.
"""

import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import config_service

logger = logging.getLogger(__name__)

SCORING_PROMPT_TEMPLATE = """You are an expert pharmaceutical sales training evaluator.

Analyze the following Medical Representative (MR) conversation with a
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

## Conversation Transcript
{transcript}

## Scoring Dimensions and Weights
{dimensions_config}

## Instructions

Score each dimension from 0-100 based on the actual conversation content. Be specific:
- Reference actual quotes from the MR's responses in strengths/weaknesses
- For key_message dimension, consider which key messages were delivered and how naturally
- For objection_handling, evaluate how the MR responded to HCP resistance or concerns
- For communication, evaluate tone, active listening, professional language, adaptation to HCP style
- For product_knowledge, evaluate accuracy and depth of product information shared
- For scientific_info, evaluate use of clinical data, study references, and evidence-based arguments

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


def build_scoring_prompt(
    scenario_data: dict,
    messages: list[dict],
    key_messages_status: list[dict],
    weights: dict[str, int],
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

    # Format dimensions config
    dim_config_lines = []
    dim_names = {
        "key_message": "Key Message Delivery",
        "objection_handling": "Objection Handling",
        "communication": "Communication Skills",
        "product_knowledge": "Product Knowledge",
        "scientific_info": "Scientific Information",
    }
    for dim_key, weight in weights.items():
        label = dim_names.get(dim_key, dim_key)
        dim_config_lines.append(f"- {dim_key} ({label}): weight={weight}%")
    dims_config = "\n".join(dim_config_lines)

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
    )


async def score_with_llm(
    db: AsyncSession,
    scenario_data: dict,
    messages: list[dict],
    key_messages_status: list[dict],
    weights: dict[str, int],
    pass_threshold: int = 70,
) -> dict | None:
    """Score a session using LLM. Returns None if LLM is unavailable.

    Uses the Azure OpenAI endpoint configured in the admin panel (service_name="azure_openai")
    or falls back to the master AI Foundry endpoint.
    """
    endpoint = await config_service.get_effective_endpoint(db, "azure_openai")
    api_key = await config_service.get_effective_key(db, "azure_openai")

    if not endpoint or not api_key:
        logger.info("LLM scoring unavailable: no Azure OpenAI endpoint/key configured")
        return None

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
        logger.warning("openai package not installed, cannot use LLM scoring")
        return None

    prompt = build_scoring_prompt(scenario_data, messages, key_messages_status, weights)

    try:
        response = await client.chat.completions.create(
            model=deployment,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a pharmaceutical sales training evaluator. "
                        "Return ONLY valid JSON, no markdown fences."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_completion_tokens=2048,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        if not content:
            logger.error("LLM scoring returned empty content")
            return None

        result = json.loads(content)
    except Exception as e:
        logger.error("LLM scoring failed: %s", e, exc_info=True)
        return None

    # Validate and compute overall score
    dimensions = result.get("dimensions", [])
    if not dimensions:
        logger.error("LLM scoring returned no dimensions")
        return None

    # Ensure weights match what we provided
    for dim in dimensions:
        expected_weight = weights.get(dim.get("dimension", ""), 0)
        if expected_weight:
            dim["weight"] = expected_weight

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
