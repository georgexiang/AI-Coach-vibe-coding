"""Skill conversion service tests (mocked AI calls)."""

from unittest.mock import AsyncMock, patch

from app.models.skill import Skill, SkillResource
from tests.conftest import TestSessionLocal


async def _seed_user() -> str:
    """Create a test admin user and return the user_id."""
    from app.models.user import User
    from app.services.auth import get_password_hash

    async with TestSessionLocal() as session:
        user = User(
            username="conv_test_admin",
            email="conv_admin@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Conv Admin",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user.id


# Mock extraction result matching the expected dict schema
MOCK_EXTRACTION_RESULT = {
    "sop_steps": [
        {
            "title": "Opening",
            "description": "Greet the HCP",
            "key_points": ["Introduce yourself"],
            "time_minutes": 5,
        },
        {
            "title": "Product Discussion",
            "description": "Discuss product efficacy",
            "key_points": ["Clinical data"],
            "time_minutes": 10,
        },
        {
            "title": "Closing",
            "description": "Summarize and next steps",
            "key_points": ["Schedule follow-up"],
            "time_minutes": 5,
        },
    ],
    "assessment_criteria": [
        {
            "name": "Communication",
            "description": "Clear communication",
            "weight": 50,
        },
        {
            "name": "Product Knowledge",
            "description": "Accurate product info",
            "weight": 50,
        },
    ],
    "key_knowledge_points": [
        {"topic": "Mechanism of action"},
        {"topic": "Clinical trial results"},
    ],
}


class TestConversionService:
    """Test skill conversion pipeline (AI calls mocked)."""

    async def test_start_conversion_completes(self, db_session):
        """Conversion updates skill content when AI returns valid SOP."""
        from app.schemas.skill import SkillCreate
        from app.services import skill_service

        user_id = await _seed_user()

        # Create a skill
        data = SkillCreate(name="Conversion Skill", product="TestProd")
        skill = await skill_service.create_skill(db_session, data, user_id)

        # Add a reference resource with text content
        resource = SkillResource(
            skill_id=skill.id,
            resource_type="reference",
            filename="guide.txt",
            storage_path=f"skills/{skill.id}/references/guide.txt",
            content_type="text/plain",
            file_size=100,
            text_content=(
                "Opening: greet the HCP and introduce yourself. "
                "Product: discuss efficacy data from clinical trials. "
                "Closing: summarize and schedule next steps."
            ),
            extraction_status="completed",
        )
        db_session.add(resource)
        await db_session.flush()

        # Mock _call_sop_extraction to return valid extraction result
        with patch(
            "app.services.skill_conversion_service._call_sop_extraction",
            new_callable=AsyncMock,
            return_value=MOCK_EXTRACTION_RESULT,
        ):
            from app.services import skill_conversion_service

            await skill_conversion_service.start_conversion(db_session, skill.id)
            await db_session.commit()

        # Verify skill content was updated
        from sqlalchemy import select

        result = await db_session.execute(select(Skill).where(Skill.id == skill.id))
        updated_skill = result.scalar_one()
        assert updated_skill.content != ""
        assert updated_skill.conversion_status == "completed"
        assert "Opening" in updated_skill.content
