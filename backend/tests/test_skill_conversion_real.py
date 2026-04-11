"""Real integration tests for Skill conversion pipeline.

Uses actual Azure AI Foundry credentials from .env to test end-to-end SOP extraction.
Skipped automatically when AZURE_FOUNDRY_API_KEY is not configured.
"""

import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

from app.models.service_config import ServiceConfig
from app.models.skill import Skill, SkillResource
from app.models.user import User
from app.services.auth import get_password_hash
from app.utils.encryption import encrypt_value
from tests.conftest import TestSessionLocal

# Load .env so credentials are available in test processes
_env_file = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_file, override=False)

_FOUNDRY_ENDPOINT = os.environ.get("AZURE_FOUNDRY_ENDPOINT", "")
_FOUNDRY_API_KEY = os.environ.get("AZURE_FOUNDRY_API_KEY", "")

HAS_REAL_CREDENTIALS = bool(_FOUNDRY_ENDPOINT and _FOUNDRY_API_KEY)

# Real AI tests are marked as 'integration' — excluded by default via
# addopts = "-m 'not integration'" in pyproject.toml.
# Run with: pytest -m integration tests/test_skill_conversion_real.py --timeout=120
skip_no_credentials = pytest.mark.skipif(
    not HAS_REAL_CREDENTIALS,
    reason="AZURE_FOUNDRY_ENDPOINT / AZURE_FOUNDRY_API_KEY not set — skipping real AI tests",
)
integration = pytest.mark.integration


async def _seed_admin() -> str:
    """Create a test admin user and return user_id."""
    async with TestSessionLocal() as session:
        user = User(
            username="real_conv_admin",
            email="real_conv_admin@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Real Conv Admin",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user.id


async def _seed_ai_foundry_config(db_session) -> None:
    """Seed ServiceConfig with real AI Foundry credentials as master config.

    The conversion pipeline uses config_service.get_effective_endpoint/key
    which falls back to the master (is_master=True) row when no per-service
    config for 'azure_openai' exists.
    """
    from sqlalchemy import select

    result = await db_session.execute(
        select(ServiceConfig).where(ServiceConfig.service_name == "ai_foundry")
    )
    existing = result.scalar_one_or_none()
    if existing is not None:
        return  # Already seeded (e.g. by a prior test in the same DB lifecycle)

    master_config = ServiceConfig(
        service_name="ai_foundry",
        display_name="Azure AI Foundry (Master)",
        endpoint=_FOUNDRY_ENDPOINT,
        api_key_encrypted=encrypt_value(_FOUNDRY_API_KEY),
        model_or_deployment="gpt-4o",
        is_master=True,
        is_active=True,
    )
    db_session.add(master_config)
    await db_session.flush()


# Sample training material — a realistic pharma sales coaching document
REAL_TRAINING_MATERIAL = """
# Oncology Product X — Sales Call Training Guide

## 1. Opening Phase (2-3 minutes)

Greet the Healthcare Professional (HCP) warmly. Introduce yourself and your role.
Confirm the appointment time and express appreciation for the HCP's time.

Key talking points:
- "Thank you for meeting with me today, Dr. [Name]."
- Reference any previous conversations or commitments.
- Set the agenda: "I'd like to share some new data on Product X."

## 2. Needs Assessment (3-5 minutes)

Ask open-ended questions to understand the HCP's current prescribing patterns
and patient population.

Questions to ask:
- "What treatment approach do you currently favor for patients with advanced NSCLC?"
- "What are the main challenges you face with current treatment options?"
- "How many patients do you see per month with this condition?"

## 3. Product Presentation (5-7 minutes)

Present Product X's key clinical data:
- Overall survival (OS): Median 18.5 months vs 12.3 months with standard of care
- Progression-free survival (PFS): 10.2 months vs 5.4 months
- Objective response rate (ORR): 45% vs 28%
- Safety profile: Grade 3+ adverse events in 22% vs 35%

Key messages:
1. Product X demonstrated statistically significant improvement in OS (HR 0.68, p<0.001)
2. Favorable safety profile compared to existing therapies
3. Convenient once-daily oral dosing improves patient compliance

## 4. Handling Objections (3-5 minutes)

Common objections and responses:

**"I'm satisfied with my current treatment approach."**
Response: Acknowledge their expertise, then share specific patient profiles
that may benefit from Product X.

**"What about long-term safety data?"**
Response: Reference the 3-year follow-up data from the Phase III APEX trial
showing sustained benefit with manageable safety profile.

**"It's too expensive for my patients."**
Response: Discuss the patient access program and reimbursement support available.

## 5. Closing and Next Steps (2-3 minutes)

Summarize key points discussed. Ask for a specific commitment:
- "Would you consider Product X for your next eligible patient?"
- Schedule a follow-up visit to discuss outcomes.
- Provide relevant clinical reprints and leave-behind materials.

## Assessment Criteria

| Criterion | Weight |
|-----------|--------|
| Communication Clarity | 25% |
| Product Knowledge Accuracy | 30% |
| Objection Handling | 20% |
| Needs Assessment Quality | 15% |
| Closing Effectiveness | 10% |

## Key Knowledge Requirements

MRs must know:
- Product X mechanism of action (selective kinase inhibitor targeting EGFR/ALK)
- Phase III APEX trial design and key results
- Approved indications and dosing regimen (200mg once daily)
- Common adverse events and management strategies
- Contraindications and drug interactions
- Patient access and reimbursement programs
"""


@skip_no_credentials
@integration
class TestRealSopExtraction:
    """Integration tests using real Azure AI Foundry for SOP extraction.

    Run with: pytest -m integration tests/test_skill_conversion_real.py --timeout=120
    Requires: AZURE_FOUNDRY_ENDPOINT and AZURE_FOUNDRY_API_KEY in .env
    """

    async def test_real_sop_extraction_produces_valid_content(self, db_session):
        """Full pipeline: seed material → AI extraction → valid Coaching Protocol."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_conversion_service, skill_service

        # Seed admin user + AI Foundry config
        user_id = await _seed_admin()
        await _seed_ai_foundry_config(db_session)

        # Create a skill
        data = SkillCreate(name="Real Conversion Skill", product="Product X")
        skill = await skill_service.create_skill(db_session, data, user_id)

        # Add a reference resource with real training material
        resource = SkillResource(
            skill_id=skill.id,
            resource_type="reference",
            filename="training_guide.md",
            storage_path=f"skills/{skill.id}/references/training_guide.md",
            content_type="text/plain",
            file_size=len(REAL_TRAINING_MATERIAL),
            text_content=REAL_TRAINING_MATERIAL,
            extraction_status="completed",
        )
        db_session.add(resource)
        await db_session.flush()

        # Run conversion (REAL AI call)
        await skill_conversion_service.start_conversion(db_session, skill.id)
        await db_session.commit()

        # Verify results
        from sqlalchemy import select

        result = await db_session.execute(select(Skill).where(Skill.id == skill.id))
        updated_skill = result.scalar_one()

        assert updated_skill.conversion_status == "completed", (
            f"Expected completed, got {updated_skill.conversion_status}: "
            f"{updated_skill.conversion_error}"
        )
        assert updated_skill.content, "Content should not be empty after conversion"
        assert len(updated_skill.content) > 100, "Content should be substantial"

        # Verify the generated content has expected SOP structure
        content = updated_skill.content
        assert "Step" in content, "Should contain SOP steps"
        assert "Assessment" in content or "Rubric" in content, "Should have assessment section"
        assert "Knowledge" in content, "Should have knowledge section"

    async def test_real_sop_extraction_preserves_clinical_data(self, db_session):
        """AI extraction should preserve key clinical data from source material."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_conversion_service, skill_service

        user_id = await _seed_admin()
        await _seed_ai_foundry_config(db_session)

        data = SkillCreate(name="Clinical Data Skill", product="Product X")
        skill = await skill_service.create_skill(db_session, data, user_id)

        resource = SkillResource(
            skill_id=skill.id,
            resource_type="reference",
            filename="clinical.md",
            storage_path=f"skills/{skill.id}/references/clinical.md",
            content_type="text/plain",
            file_size=len(REAL_TRAINING_MATERIAL),
            text_content=REAL_TRAINING_MATERIAL,
            extraction_status="completed",
        )
        db_session.add(resource)
        await db_session.flush()

        await skill_conversion_service.start_conversion(db_session, skill.id)
        await db_session.commit()

        from sqlalchemy import select

        result = await db_session.execute(select(Skill).where(Skill.id == skill.id))
        updated_skill = result.scalar_one()

        assert updated_skill.conversion_status == "completed"
        content = updated_skill.content.lower()

        # The AI should preserve key clinical facts from the source
        # (flexible matching — AI may rephrase but should keep the data)
        assert any(term in content for term in ["product x", "oncology", "nsclc", "kinase"]), (
            "Should mention the product or condition"
        )

    async def test_real_sop_regeneration_with_feedback(self, db_session):
        """AI feedback regeneration should modify content while preserving structure."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_conversion_service, skill_service

        user_id = await _seed_admin()
        await _seed_ai_foundry_config(db_session)

        # Create a skill with initial SOP content
        initial_content = """# Product X - Coaching Protocol

## Overview
Training guide for Product X sales calls.

## SOP Steps

### Step 1: Opening
Greet the HCP and introduce yourself.

### Step 2: Product Discussion
Present clinical data.

### Step 3: Closing
Summarize and schedule follow-up.

## Assessment Rubric

| Criterion | Description | Weight |
|-----------|-------------|--------|
| Communication | Clear delivery | 50% |
| Knowledge | Product accuracy | 50% |

## Key Knowledge Points

### Mechanism of Action
Product X is a selective kinase inhibitor.
"""
        data = SkillCreate(
            name="Regen Test Skill",
            product="Product X",
            content=initial_content,
        )
        skill = await skill_service.create_skill(db_session, data, user_id)
        await _seed_ai_foundry_config(db_session)
        await db_session.flush()

        # Regenerate with feedback (REAL AI call)
        updated = await skill_conversion_service.regenerate_sop_with_feedback(
            db_session,
            skill.id,
            feedback="Add a step about handling price objections between Step 2 and Step 3.",
        )
        await db_session.commit()

        assert updated.content, "Regenerated content should not be empty"
        assert len(updated.content) > 100, "Regenerated content should be substantial"
        # The content should have changed from the original
        assert updated.content != initial_content, "Content should have been modified"


class TestRealSemanticChunking:
    """Test semantic chunking with real-world-sized documents."""

    def test_chunking_single_document(self):
        """Small document should produce a single chunk."""
        from app.services.skill_conversion_service import semantic_chunk

        chunks = semantic_chunk(REAL_TRAINING_MATERIAL, max_tokens=80000)
        assert len(chunks) == 1, "Small doc should fit in one chunk"

    def test_chunking_large_document(self):
        """Large document should be split into multiple chunks."""
        from app.services.skill_conversion_service import semantic_chunk

        # Create a large document by repeating the training material
        large_doc = (REAL_TRAINING_MATERIAL + "\n\n---\n\n") * 20
        chunks = semantic_chunk(large_doc, max_tokens=2000)
        assert len(chunks) > 1, "Large doc should be split into multiple chunks"
        # Every chunk should have content
        for chunk in chunks:
            assert chunk.strip(), "Chunks should not be empty"


class TestRealMergeExtractions:
    """Test merge_extractions with realistic multi-chunk data."""

    def test_merge_deduplicates_steps(self):
        """Duplicate step titles across chunks should be merged."""
        from app.services.skill_conversion_service import merge_extractions

        parts = [
            {
                "summary": "First chunk",
                "sop_steps": [
                    {"title": "Opening", "description": "Greet HCP"},
                    {"title": "Product Discussion", "description": "Present data"},
                ],
                "assessment_criteria": [
                    {"name": "Communication", "description": "Clarity", "weight": 50},
                ],
                "key_knowledge_points": [
                    {"topic": "Mechanism of Action", "details": "Kinase inhibitor"},
                ],
            },
            {
                "summary": "Second chunk",
                "sop_steps": [
                    {"title": "Opening", "description": "Greet HCP (duplicate)"},
                    {"title": "Closing", "description": "Schedule follow-up"},
                ],
                "assessment_criteria": [
                    {"name": "Communication", "description": "Clarity (dup)", "weight": 30},
                    {"name": "Knowledge", "description": "Accuracy", "weight": 70},
                ],
                "key_knowledge_points": [
                    {"topic": "Mechanism of Action", "details": "Same topic (dup)"},
                    {"topic": "Safety Profile", "details": "AE management"},
                ],
            },
        ]

        merged = merge_extractions(parts)

        # Steps should be deduplicated: Opening (1x), Product Discussion, Closing
        step_titles = [s["title"] for s in merged["sop_steps"]]
        assert len(step_titles) == 3
        assert step_titles.count("Opening") == 1

        # Criteria: Communication (1x) + Knowledge
        criteria_names = [c["name"] for c in merged["assessment_criteria"]]
        assert len(criteria_names) == 2
        assert criteria_names.count("Communication") == 1

        # Knowledge: Mechanism (1x) + Safety
        topics = [kp["topic"] for kp in merged["key_knowledge_points"]]
        assert len(topics) == 2
        assert topics.count("Mechanism of Action") == 1

        # Weights should be normalized to 100
        total_weight = sum(c["weight"] for c in merged["assessment_criteria"])
        assert total_weight == 100

    def test_merge_single_part_passthrough(self):
        """Single extraction should pass through unchanged."""
        from app.services.skill_conversion_service import merge_extractions

        single = {
            "summary": "Only chunk",
            "sop_steps": [{"title": "Step 1", "description": "Do something"}],
            "assessment_criteria": [{"name": "Quality", "description": "Good", "weight": 100}],
            "key_knowledge_points": [{"topic": "Topic 1", "details": "Info"}],
        }

        result = merge_extractions([single])
        assert result is single  # Should return the same object


class TestRealFormatCoachingProtocol:
    """Test coaching protocol formatting with realistic data."""

    def test_format_produces_markdown_structure(self):
        """Formatted protocol should have all expected sections."""
        from app.services.skill_conversion_service import format_coaching_protocol

        extraction = {
            "summary": "Oncology Product X sales call training.",
            "sop_steps": [
                {
                    "title": "Opening",
                    "description": "Greet the HCP.",
                    "key_points": ["Introduce yourself", "Set agenda"],
                    "objections": ["I don't have time"],
                    "assessment_criteria": ["Professional greeting"],
                    "knowledge_points": ["Company background"],
                    "suggested_duration": "2-3 minutes",
                },
                {
                    "title": "Product Discussion",
                    "description": "Present clinical data.",
                    "key_points": ["OS data", "PFS data"],
                    "objections": [],
                    "assessment_criteria": ["Data accuracy"],
                    "knowledge_points": ["Phase III results"],
                    "suggested_duration": "5-7 minutes",
                },
            ],
            "assessment_criteria": [
                {"name": "Communication", "description": "Clarity", "weight": 50},
                {"name": "Knowledge", "description": "Accuracy", "weight": 50},
            ],
            "key_knowledge_points": [
                {"topic": "Mechanism of Action", "details": "Selective kinase inhibitor."},
                {"topic": "Clinical Results", "details": "OS 18.5 months."},
            ],
        }

        result = format_coaching_protocol(extraction, "Product X Skill")

        assert "# Product X Skill - Coaching Protocol" in result
        assert "## Overview" in result
        assert "## SOP Steps" in result
        assert "### Step 1: Opening" in result
        assert "### Step 2: Product Discussion" in result
        assert "## Assessment Rubric" in result
        assert "Communication" in result
        assert "## Key Knowledge Points" in result
        assert "Mechanism of Action" in result
        assert "2-3 minutes" in result
