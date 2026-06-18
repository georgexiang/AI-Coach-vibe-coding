"""Prompt builders for HCP system prompts, scoring, key message detection, and conference."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from app.models.hcp_profile import HcpProfile
from app.models.scenario import Scenario

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


def build_hcp_system_prompt(
    hcp_profile: HcpProfile,
    scenario: Scenario,
    key_messages: list[str],
) -> str:
    """Build a system prompt that enforces HCP personality for AI coaching.

    Includes identity, personality rules, knowledge background, objections,
    scenario context, and key messages for awareness.
    """
    profile = hcp_profile.to_prompt_dict()
    expertise = profile.get("expertise_areas", [])
    objections = profile.get("objections", [])

    # Personality-specific behavior instructions
    personality_behaviors = {
        "skeptical": (
            "You are SKEPTICAL. Always push back on claims. Demand evidence for every "
            "assertion. Question the validity of clinical trials. Express doubt about "
            "efficacy data. Never accept claims at face value."
        ),
        "friendly": (
            "You are FRIENDLY and approachable. Show genuine interest in the discussion. "
            "Ask follow-up questions with curiosity. Be receptive to well-presented data "
            "but still maintain professional skepticism when appropriate."
        ),
        "busy": (
            "You are BUSY and time-pressed. Keep responses SHORT (1-3 sentences max). "
            "Show impatience with lengthy explanations. Redirect to key points. "
            "Frequently mention time constraints. May cut the conversation short."
        ),
        "analytical": (
            "You are ANALYTICAL. Demand specific data, numbers, and statistics. "
            "Ask about p-values, confidence intervals, NNT. Compare with existing "
            "treatments using quantitative metrics. Do not accept qualitative claims."
        ),
        "cautious": (
            "You are CAUTIOUS about patient safety. Focus heavily on side effects, "
            "contraindications, and drug interactions. Ask about post-marketing "
            "surveillance data. Express concern about switching patients from "
            "established treatments."
        ),
    }

    personality_instruction = personality_behaviors.get(
        profile["personality_type"],
        "Maintain a professional demeanor appropriate to your specialty.",
    )

    prompt_parts = [
        "# HCP Identity",
        f"You are Dr. {profile['name']}, a {profile['specialty']} specialist.",
    ]

    if profile.get("hospital"):
        prompt_parts.append(f"You work at {profile['hospital']}.")
    if profile.get("title"):
        prompt_parts.append(f"Your title is {profile['title']}.")

    prompt_parts.extend(
        [
            "",
            "# Personality & Communication",
            f"Personality type: {profile['personality_type']}",
            f"Emotional state: {profile['emotional_state']}/100 "
            f"(0=calm/neutral, 100=resistant/hostile)",
            f"Communication style: {profile['communication_style']}/100 "
            f"(0=very direct, 100=very indirect)",
            "",
            personality_instruction,
        ]
    )

    if expertise:
        prompt_parts.extend(
            [
                "",
                "# Knowledge & Expertise",
                f"Expertise areas: {', '.join(expertise)}",
            ]
        )
    if profile.get("prescribing_habits"):
        prompt_parts.append(f"Prescribing habits: {profile['prescribing_habits']}")
    if profile.get("concerns"):
        prompt_parts.append(f"Primary concerns: {profile['concerns']}")

    if objections:
        prompt_parts.extend(
            [
                "",
                "# Objections (use naturally in conversation)",
            ]
        )
        for i, objection in enumerate(objections, 1):
            prompt_parts.append(f"{i}. {objection}")

    prompt_parts.extend(
        [
            "",
            "# Scenario Context",
            f"Product under discussion: {scenario.product}",
        ]
    )
    if scenario.therapeutic_area:
        prompt_parts.append(f"Therapeutic area: {scenario.therapeutic_area}")

    if key_messages:
        prompt_parts.extend(
            [
                "",
                "# Key Messages (for your awareness)",
                "The MR should deliver these key messages during the conversation:",
            ]
        )
        for i, msg in enumerate(key_messages, 1):
            prompt_parts.append(f"{i}. {msg}")

    prompt_parts.extend(
        [
            "",
            "# Rules",
            "1. Stay STRICTLY in character as this HCP. Never break character or reveal "
            "you are an AI.",
            "2. Your personality type MUST dictate your behavior throughout the conversation.",
            "3. Reference your medical background and expertise naturally.",
            "4. Use your objections naturally when relevant topics arise.",
            "5. You may end the conversation when you feel the main topics have been "
            "sufficiently covered.",
            "6. Respond in the same language the MR uses (Chinese or English).",
            "7. Do NOT provide coaching feedback. You ARE the HCP, not a coach.",
        ]
    )

    return "\n".join(prompt_parts)


def build_scoring_prompt(
    scenario: Scenario,
    transcript: list[dict],
    key_messages: list[str],
    rubric_dimensions: list[dict] | None = None,
) -> str:
    """Build the scoring analysis prompt for post-session evaluation.

    Instructs the AI to analyze the conversation transcript against rubric-defined
    scoring dimensions and return structured JSON results.

    If rubric_dimensions is provided, uses those. Otherwise falls back to
    a default 5-dimension set (for backward compatibility during transition).
    """
    if rubric_dimensions is None:
        rubric_dimensions = [
            {"name": "key_message", "weight": 30, "criteria": []},
            {"name": "objection_handling", "weight": 25, "criteria": []},
            {"name": "communication", "weight": 20, "criteria": []},
            {"name": "product_knowledge", "weight": 15, "criteria": []},
            {"name": "scientific_info", "weight": 10, "criteria": []},
        ]

    # Format transcript
    transcript_lines = []
    for msg in transcript:
        role_label = "MR" if msg.get("role") == "user" else "HCP"
        transcript_lines.append(f"{role_label}: {msg.get('content', '')}")
    formatted_transcript = "\n".join(transcript_lines)

    # Build dynamic dimensions section
    dim_section_lines = []
    for i, dim in enumerate(rubric_dimensions, 1):
        dim_section_lines.append(f"{i}. **{dim['name']}** (weight: {dim['weight']}%)")
        for criterion in dim.get("criteria", []):
            dim_section_lines.append(f"   - {criterion}")
    dim_section = "\n".join(dim_section_lines)

    # Build dynamic JSON example for output format
    dim_json_examples = []
    for dim in rubric_dimensions:
        dim_json_examples.append(
            f"    {{\n"
            f'      "dimension": "{dim["name"]}",\n'
            f'      "score": <0-100>,\n'
            f'      "weight": {dim["weight"]},\n'
            f'      "strengths": [{{"text": "description", "quote": "quote or null"}}],\n'
            f'      "weaknesses": [{{"text": "description", "quote": "quote or null"}}],\n'
            f'      "suggestions": ["actionable suggestion"]\n'
            f"    }}"
        )
    dim_json_block = ",\n".join(dim_json_examples)

    prompt = f"""# Scoring Analysis Task

You are an expert medical sales training evaluator. Analyze the following conversation
between a Medical Representative (MR) and a Healthcare Professional (HCP).

## Scoring Dimensions and Weights

{dim_section}

## Key Messages Expected
{chr(10).join(f"{i + 1}. {msg}" for i, msg in enumerate(key_messages))}

## Conversation Transcript
{formatted_transcript}

## Required Output Format

Return ONLY valid JSON in the following format:
{{
  "overall_feedback": "2-3 sentence summary of the MR's performance",
  "dimensions": [
{dim_json_block}
  ]
}}

Score each dimension from 0-100 based on the transcript evidence. Be specific in
strengths/weaknesses with actual quotes where possible."""

    return prompt


def build_key_message_detection_prompt(
    key_messages: list[str], mr_message: str, conversation_history: list[dict]
) -> str:
    """Build prompt for detecting which key messages the MR has delivered.

    Returns a prompt that instructs the AI to evaluate the MR's latest message
    against the expected key messages and return detected ones as JSON.
    """
    # Build conversation context (last few messages for context)
    if len(conversation_history) > 6:
        recent_history = conversation_history[-6:]
    else:
        recent_history = conversation_history
    history_lines = []
    for msg in recent_history:
        role_label = "MR" if msg.get("role") == "user" else "HCP"
        history_lines.append(f"{role_label}: {msg.get('content', '')}")
    history_text = "\n".join(history_lines)

    prompt = f"""# Key Message Detection Task

Analyze the MR's latest message in the context of the conversation to determine
which key messages have been delivered.

## Key Messages to Detect
{chr(10).join(f"{i + 1}. {msg}" for i, msg in enumerate(key_messages))}

## Recent Conversation Context
{history_text}

## MR's Latest Message
{mr_message}

## Instructions
- A key message is considered "delivered" if the MR has communicated its core meaning,
  even if not word-for-word.
- Consider the context of the full conversation, not just the latest message.
- Only mark messages as delivered if the MR genuinely conveyed the information.

## Required Output
Return ONLY a JSON array of the key messages that were detected as delivered in this
latest message:

{json.dumps(key_messages[:1])}

Return an empty array [] if no key messages were detected in this message."""

    return prompt


def build_conference_audience_prompt(
    hcp_config: dict[str, Any],
    scenario: Scenario | None,
    presentation_topic: str,
    conversation_history: list[dict],
    other_hcp_questions: list[dict],
) -> str:
    """Build a system prompt for a specific HCP in a conference audience.

    Each HCP generates questions based on:
    1. Their personality and specialty
    2. The MR's presentation content
    3. Questions already asked by other HCPs (to avoid duplication)
    """
    hcp_name = hcp_config.get("name", "Doctor")
    specialty = hcp_config.get("specialty", "General Medicine")
    personality_type = hcp_config.get("personality_type", "friendly")
    role = hcp_config.get("role", "audience")

    # Personality behaviors reused from build_hcp_system_prompt
    personality_behaviors = {
        "skeptical": "You are SKEPTICAL. Question claims and demand evidence.",
        "friendly": "You are FRIENDLY. Ask curious follow-up questions.",
        "busy": "You are BUSY. Ask concise, pointed questions.",
        "analytical": "You are ANALYTICAL. Focus on specific data and numbers.",
        "cautious": "You are CAUTIOUS. Focus on safety and side effects.",
    }
    personality_instruction = personality_behaviors.get(
        personality_type,
        "Maintain a professional demeanor appropriate to your specialty.",
    )

    product = scenario.product if scenario else "the product"
    therapeutic_area = scenario.therapeutic_area if scenario else ""

    prompt_parts = [
        "# Conference Audience Role",
        f"You are Dr. {hcp_name}, a {specialty} specialist attending a medical conference.",
        f"You are a {role} member in the audience.",
        "",
        "# Personality",
        personality_instruction,
        "",
        "# Presentation Context",
        f"The Medical Representative is presenting about: {product}",
    ]

    if therapeutic_area:
        prompt_parts.append(f"Therapeutic area: {therapeutic_area}")

    if presentation_topic:
        prompt_parts.append(f"Presentation topic: {presentation_topic}")

    # Include conversation history
    if conversation_history:
        prompt_parts.extend(["", "# Conversation So Far"])
        for msg in conversation_history[-10:]:
            speaker = msg.get("speaker_name") or ("MR" if msg.get("role") == "user" else "HCP")
            prompt_parts.append(f"{speaker}: {msg.get('content', '')}")

    # Include other HCPs' questions to avoid duplication
    if other_hcp_questions:
        prompt_parts.extend(["", "# Questions Already Asked by Other Audience Members"])
        for q in other_hcp_questions:
            prompt_parts.append(f"- {q['hcp_name']}: {q['question']}")
        prompt_parts.append(
            "Do NOT repeat or closely paraphrase these questions. "
            "You may follow up on them or ask about a different aspect."
        )

    prompt_parts.extend(
        [
            "",
            "# Instructions",
            "Based on the MR's presentation, generate a relevant question from your "
            "perspective as a conference audience member.",
            "- Your question should reflect your specialty and personality.",
            "- If other HCPs have already asked similar questions, focus on a different angle.",
            "- If you have no relevant question, respond with an empty string.",
            "- Respond in the same language the MR uses (Chinese or English).",
            "- Keep your question concise (1-3 sentences).",
            "- Do NOT provide coaching feedback. You ARE a conference attendee.",
        ]
    )

    return "\n".join(prompt_parts)


def build_conference_scoring_prompt(
    scenario: Scenario,
    messages: list[dict],
    audience_config: list[dict],
    rubric_dimensions: list[dict] | None = None,
) -> str:
    """Build scoring prompt adapted for conference presentation evaluation.

    Uses rubric dimensions dynamically. If rubric_dimensions is not provided,
    falls back to a default 5-dimension set for backward compatibility.
    """
    if rubric_dimensions is None:
        rubric_dimensions = [
            {"name": "key_message", "weight": 30, "criteria": []},
            {"name": "objection_handling", "weight": 25, "criteria": []},
            {"name": "communication", "weight": 20, "criteria": []},
            {"name": "product_knowledge", "weight": 15, "criteria": []},
            {"name": "scientific_info", "weight": 10, "criteria": []},
        ]

    key_messages = json.loads(scenario.key_messages)

    # Format transcript with speaker attribution
    transcript_lines = []
    for msg in messages:
        speaker = msg.get("speaker_name", "")
        if msg.get("role") == "user":
            label = "MR"
        elif speaker:
            label = f"HCP ({speaker})"
        else:
            label = "HCP"
        transcript_lines.append(f"{label}: {msg.get('content', '')}")
    formatted_transcript = "\n".join(transcript_lines)

    # Audience info
    audience_info = ", ".join(
        f"Dr. {a.get('name', '?')} ({a.get('specialty', '?')}, {a.get('personality_type', '?')})"
        for a in audience_config
    )

    # Build dynamic dimensions section
    dim_section_lines = []
    for i, dim in enumerate(rubric_dimensions, 1):
        dim_section_lines.append(f"{i}. **{dim['name']}** (weight: {dim['weight']}%)")
        for criterion in dim.get("criteria", []):
            dim_section_lines.append(f"   - {criterion}")
    dim_section = "\n".join(dim_section_lines)

    # Build dimension names for output format instruction
    dim_names = ", ".join(d["name"] for d in rubric_dimensions)

    prompt = f"""# Conference Presentation Scoring Task

You are an expert medical sales training evaluator. Analyze the following conference
presentation by a Medical Representative (MR) to an audience of Healthcare Professionals.

## Audience
{audience_info}

## Scoring Dimensions and Weights (adapted for conference)

{dim_section}

## Key Messages Expected
{chr(10).join(f"{i + 1}. {msg}" for i, msg in enumerate(key_messages))}

## Conference Transcript
{formatted_transcript}

## Required Output Format

Return ONLY valid JSON matching the standard scoring format with dimensions:
{dim_names}.
Each with score (0-100), weight, strengths, weaknesses, and suggestions arrays."""

    return prompt


async def build_skill_augmented_instructions(
    db: AsyncSession,
    profile_dict: dict,
    scenario_id: str | None = None,
    template: str | None = None,
) -> str:
    """Build agent instructions with optional Skill SOP injection.

    Composes base HCP agent instructions (from build_agent_instructions in
    agent_sync_service) augmented with the Scenario's pinned Skill content.
    Falls back to base instructions if no scenario or no skill assigned.
    """
    from app.services.agent_sync_service import build_agent_instructions

    base = build_agent_instructions(profile_dict, template)
    if not scenario_id:
        return base

    from app.services.skill_manager import SkillManager, load_skill_for_scenario

    skill_content = await load_skill_for_scenario(db, scenario_id)
    if skill_content is None:
        return base

    return SkillManager.compose_instructions(base, [skill_content])
