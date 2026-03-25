"""Prompt builders for HCP system prompts, scoring, key message detection, and conference."""

import json
from typing import Any

from app.models.hcp_profile import HcpProfile
from app.models.scenario import Scenario


def build_hcp_system_prompt(
    hcp_profile: HcpProfile,
    scenario: Scenario,
    key_messages: list[str],
    material_context: list[str] | None = None,
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

    if material_context:
        prompt_parts.extend(
            [
                "",
                "# Product Training Materials (Reference Knowledge)",
                "Use the following product information to inform your responses "
                "when relevant to the discussion:",
            ]
        )
        for i, chunk in enumerate(material_context, 1):
            prompt_parts.append(f"\n--- Material Excerpt {i} ---\n{chunk}")

    return "\n".join(prompt_parts)


def build_scoring_prompt(
    scenario: Scenario, transcript: list[dict], key_messages: list[str]
) -> str:
    """Build the scoring analysis prompt for post-session evaluation.

    Instructs the AI to analyze the conversation transcript against 5 scoring
    dimensions and return structured JSON results.
    """
    weights = scenario.get_scoring_weights()

    # Format transcript
    transcript_lines = []
    for msg in transcript:
        role_label = "MR" if msg.get("role") == "user" else "HCP"
        transcript_lines.append(f"{role_label}: {msg.get('content', '')}")
    formatted_transcript = "\n".join(transcript_lines)

    prompt = f"""# Scoring Analysis Task

You are an expert medical sales training evaluator. Analyze the following conversation
between a Medical Representative (MR) and a Healthcare Professional (HCP).

## Scoring Dimensions and Weights

1. **Key Message Delivery** (weight: {weights["key_message"]}%)
   - Did the MR deliver the required key messages?
   - Were they presented clearly and persuasively?

2. **Objection Handling** (weight: {weights["objection_handling"]}%)
   - How well did the MR respond to HCP objections and concerns?
   - Were responses evidence-based and professional?

3. **Communication Skills** (weight: {weights["communication"]}%)
   - Was the MR's communication clear, professional, and appropriate?
   - Did they listen actively and adapt to the HCP's style?

4. **Product Knowledge** (weight: {weights["product_knowledge"]}%)
   - Did the MR demonstrate strong knowledge of the product?
   - Were claims supported by data and evidence?

5. **Scientific Information** (weight: {weights["scientific_info"]}%)
   - Did the MR reference relevant clinical data and studies?
   - Was the scientific information accurate and well-presented?

## Key Messages Expected
{chr(10).join(f"{i + 1}. {msg}" for i, msg in enumerate(key_messages))}

## Conversation Transcript
{formatted_transcript}

## Required Output Format

Return ONLY valid JSON in the following format:
{{
  "overall_feedback": "2-3 sentence summary of the MR's performance",
  "dimensions": [
    {{
      "dimension": "key_message",
      "score": <0-100>,
      "weight": {weights["key_message"]},
      "strengths": [
        {{"text": "description", "quote": "exact quote from transcript or null"}}
      ],
      "weaknesses": [
        {{"text": "description", "quote": "exact quote from transcript or null"}}
      ],
      "suggestions": ["actionable suggestion 1", "actionable suggestion 2"]
    }},
    {{
      "dimension": "objection_handling",
      "score": <0-100>,
      "weight": {weights["objection_handling"]},
      "strengths": [...],
      "weaknesses": [...],
      "suggestions": [...]
    }},
    {{
      "dimension": "communication",
      "score": <0-100>,
      "weight": {weights["communication"]},
      "strengths": [...],
      "weaknesses": [...],
      "suggestions": [...]
    }},
    {{
      "dimension": "product_knowledge",
      "score": <0-100>,
      "weight": {weights["product_knowledge"]},
      "strengths": [...],
      "weaknesses": [...],
      "suggestions": [...]
    }},
    {{
      "dimension": "scientific_info",
      "score": <0-100>,
      "weight": {weights["scientific_info"]},
      "strengths": [...],
      "weaknesses": [...],
      "suggestions": [...]
    }}
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
    scenario: Scenario, messages: list[dict], audience_config: list[dict]
) -> str:
    """Build scoring prompt adapted for conference presentation evaluation.

    Maps existing 5 dimensions to conference context:
    - key_message -> presentation completeness
    - objection_handling -> Q&A handling
    - communication -> presentation delivery
    - product_knowledge -> product knowledge depth
    - scientific_info -> scientific rigor
    """
    weights = scenario.get_scoring_weights()
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

    prompt = f"""# Conference Presentation Scoring Task

You are an expert medical sales training evaluator. Analyze the following conference
presentation by a Medical Representative (MR) to an audience of Healthcare Professionals.

## Audience
{audience_info}

## Scoring Dimensions and Weights (adapted for conference)

1. **Presentation Completeness (key_message)** (weight: {weights["key_message"]}%)
   - Did the MR cover all required key messages during the presentation?
   - Were they woven naturally into the presentation flow?

2. **Q&A Handling (objection_handling)** (weight: {weights["objection_handling"]}%)
   - How well did the MR handle audience questions?
   - Were responses specific, evidence-based, and addressed to the questioner?

3. **Presentation Delivery (communication)** (weight: {weights["communication"]}%)
   - Was the presentation clear, structured, and engaging?
   - Did the MR maintain audience engagement?

4. **Product Knowledge** (weight: {weights["product_knowledge"]}%)
   - Did the MR demonstrate deep product knowledge under audience questioning?

5. **Scientific Rigor (scientific_info)** (weight: {weights["scientific_info"]}%)
   - Were clinical references accurate and well-cited?
   - Did the MR handle scientific challenges from the audience competently?

## Key Messages Expected
{chr(10).join(f"{i + 1}. {msg}" for i, msg in enumerate(key_messages))}

## Conference Transcript
{formatted_transcript}

## Required Output Format

Return ONLY valid JSON matching the standard scoring format with dimensions:
key_message, objection_handling, communication, product_knowledge, scientific_info.
Each with score (0-100), weight, strengths, weaknesses, and suggestions arrays."""

    return prompt
