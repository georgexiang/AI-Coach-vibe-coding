"""Built-in scoring rubric templates and seed helpers."""

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scoring_rubric import ScoringRubric
from app.services.scoring_engine import SCORING_PROMPT_TEMPLATE

DEFAULT_F2F_RUBRIC_NAME = "Default F2F Scoring Rubric"
DEFAULT_F2F_RUBRIC_DESCRIPTION = "Standard 5-dimension scoring rubric for F2F coaching sessions"
DEFAULT_CONTENT_WEIGHT = 60
DEFAULT_VOICE_WEIGHT = 40

DEFAULT_F2F_RUBRIC_DIMENSIONS = [
    {
        "name": "key_message",
        "weight": 25,
        "criteria": [
            "Consider which key messages were delivered and how naturally",
            "Evaluate completeness of message coverage",
            "Assess logical flow of message delivery",
        ],
        "max_score": 100.0,
    },
    {
        "name": "objection_handling",
        "weight": 20,
        "criteria": [
            "Evaluate how the MR responded to HCP resistance or concerns",
            "Assess use of clinical evidence in responses",
            "Evaluate acknowledgment of HCP concerns before countering",
        ],
        "max_score": 100.0,
    },
    {
        "name": "communication",
        "weight": 20,
        "criteria": [
            "Evaluate tone, active listening, professional language",
            "Assess adaptation to HCP communication style",
            "Evaluate use of reflective listening techniques",
        ],
        "max_score": 100.0,
    },
    {
        "name": "product_knowledge",
        "weight": 20,
        "criteria": [
            "Evaluate accuracy and depth of product information shared",
            "Assess dosing and administration knowledge",
            "Evaluate competitive product comparison ability",
        ],
        "max_score": 100.0,
    },
    {
        "name": "scientific_info",
        "weight": 15,
        "criteria": [
            "Evaluate use of clinical data, study references, and evidence-based arguments",
            "Assess ability to cite specific study names and endpoints",
            "Evaluate discussion of patient populations and outcomes",
        ],
        "max_score": 100.0,
    },
]


def get_default_f2f_rubric_template() -> dict:
    """Return the built-in F2F rubric template used by seed and admin UI."""
    return {
        "name": DEFAULT_F2F_RUBRIC_NAME,
        "description": DEFAULT_F2F_RUBRIC_DESCRIPTION,
        "scenario_type": "f2f",
        "dimensions": DEFAULT_F2F_RUBRIC_DIMENSIONS,
        "prompt_template": SCORING_PROMPT_TEMPLATE,
        "is_default": True,
        "content_weight": DEFAULT_CONTENT_WEIGHT,
        "voice_weight": DEFAULT_VOICE_WEIGHT,
    }


async def ensure_default_f2f_rubric(db: AsyncSession, admin_user_id: str) -> ScoringRubric | None:
    """Create the default F2F rubric if no default F2F rubric exists."""
    result = await db.execute(
        select(ScoringRubric)
        .where(
            ScoringRubric.scenario_type == "f2f",
            ScoringRubric.is_default == True,  # noqa: E712
        )
        .limit(1)
    )
    existing = result.scalars().first()
    if existing is not None:
        return None

    template = get_default_f2f_rubric_template()
    rubric = ScoringRubric(
        name=template["name"],
        description=template["description"],
        scenario_type=template["scenario_type"],
        dimensions=json.dumps(template["dimensions"]),
        prompt_template=template["prompt_template"],
        is_default=True,
        content_weight=template["content_weight"],
        voice_weight=template["voice_weight"],
        created_by=admin_user_id,
    )
    db.add(rubric)
    await db.flush()
    return rubric
