"""Unit tests for skill_creator_service — agent-based skill creation."""

import json

from unittest.mock import patch

from tests.conftest import TestSessionLocal

from app.models.meta_skill import MetaSkill
from app.models.skill import Skill, SkillResource
from app.models.user import User
from app.services import skill_creator_service
from app.services.skill_creator_service import CreationResult, _parse_creator_response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_user() -> str:
    """Create a test user and return user_id."""
    from app.services.auth import get_password_hash

    async with TestSessionLocal() as session:
        user = User(
            username="test_creator",
            email="creator@test.com",
            hashed_password=get_password_hash("pass123"),
            role="admin",
            is_active=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user.id


async def _seed_skill_with_resources(user_id: str) -> str:
    """Create a skill with a reference resource and return skill_id."""
    async with TestSessionLocal() as session:
        skill = Skill(
            name="Test Skill",
            description="Test",
            status="draft",
            created_by=user_id,
            product="TestProduct",
            therapeutic_area="Oncology",
        )
        session.add(skill)
        await session.flush()

        resource = SkillResource(
            skill_id=skill.id,
            resource_type="reference",
            filename="material.txt",
            storage_path="skills/test/material.txt",
            text_content="This is a training material about product A.",
            extraction_status="completed",
        )
        session.add(resource)
        await session.commit()
        await session.refresh(skill)
        return skill.id


async def _seed_meta_skill_creator(
    agent_id: str = "",
    template_content: str = "Create a skill from the materials.",
    model: str = "gpt-4o",
) -> None:
    """Seed a creator meta skill."""
    async with TestSessionLocal() as session:
        meta = MetaSkill(
            name="skill-creator",
            display_name="Skill Creator",
            skill_type="creator",
            model=model,
            template_content=template_content,
            template_language="en",
            agent_id=agent_id,
        )
        session.add(meta)
        await session.commit()


# ---------------------------------------------------------------------------
# _parse_creator_response
# ---------------------------------------------------------------------------


class TestParseCreatorResponse:
    def test_valid_json(self):
        raw = json.dumps({
            "name": "Test Skill",
            "description": "A test skill",
            "product": "Product A",
        })
        result = _parse_creator_response(raw)
        assert result["name"] == "Test Skill"
        assert result["description"] == "A test skill"

    def test_json_in_markdown_block(self):
        raw = 'Here is the result:\n```json\n{"name": "Skill B", "summary": "blah"}\n```\n'
        result = _parse_creator_response(raw)
        assert result["name"] == "Skill B"

    def test_plain_text_fallback(self):
        raw = "This is plain text without JSON"
        result = _parse_creator_response(raw)
        assert "content" in result
        assert result["content"] == raw

    def test_empty_json_object(self):
        raw = "{}"
        result = _parse_creator_response(raw)
        assert result == {}

    def test_nested_json(self):
        raw = json.dumps({
            "name": "Nested",
            "steps": [{"step": 1, "action": "do thing"}],
        })
        result = _parse_creator_response(raw)
        assert result["name"] == "Nested"
        assert len(result["steps"]) == 1


# ---------------------------------------------------------------------------
# CreationResult dataclass
# ---------------------------------------------------------------------------


class TestCreationResult:
    def test_defaults(self):
        r = CreationResult()
        assert r.status == "pending"
        assert r.skill_id == ""
        assert r.agent_id == ""

    def test_error_result(self):
        r = CreationResult(status="error", error_detail="something broke")
        assert r.status == "error"
        assert r.error_detail == "something broke"


# ---------------------------------------------------------------------------
# _collect_material_texts
# ---------------------------------------------------------------------------


class TestCollectMaterialTexts:
    async def test_returns_texts_from_resources(self, db_session):
        user_id = await _seed_user()
        skill_id = await _seed_skill_with_resources(user_id)
        texts = await skill_creator_service._collect_material_texts(db_session, skill_id)
        assert len(texts) >= 1
        filename, content = texts[0]
        assert filename == "material.txt"
        assert "training material" in content

    async def test_no_resources_returns_empty(self, db_session):
        user_id = await _seed_user()
        async with TestSessionLocal() as s:
            skill = Skill(
                name="Empty Skill",
                description="No resources",
                status="draft",
                created_by=user_id,
            )
            s.add(skill)
            await s.commit()
            await s.refresh(skill)
            skill_id = skill.id

        texts = await skill_creator_service._collect_material_texts(db_session, skill_id)
        assert texts == []


# ---------------------------------------------------------------------------
# create_skill_via_agent
# ---------------------------------------------------------------------------


class TestCreateSkillViaAgent:
    async def test_error_when_no_materials(self, db_session):
        """Returns error when skill has no reference materials."""
        user_id = await _seed_user()
        await _seed_meta_skill_creator()
        async with TestSessionLocal() as s:
            skill = Skill(
                name="No Materials",
                description="Test",
                status="draft",
                created_by=user_id,
            )
            s.add(skill)
            await s.commit()
            await s.refresh(skill)
            skill_id = skill.id

        result = await skill_creator_service.create_skill_via_agent(db_session, skill_id)
        assert result.status == "error"
        assert "No text" in result.error_detail

    async def test_error_when_no_creator_configured(self, db_session):
        """Returns error when no creator meta skill exists."""
        user_id = await _seed_user()
        skill_id = await _seed_skill_with_resources(user_id)
        result = await skill_creator_service.create_skill_via_agent(db_session, skill_id)
        assert result.status == "error"
        assert "not configured" in result.error_detail

    @patch("app.services.skill_creator_service._call_direct_openai")
    async def test_fallback_to_direct_openai_when_no_agent_id(
        self, mock_direct, db_session
    ):
        """When meta skill has no agent_id, falls back to direct OpenAI."""
        user_id = await _seed_user()
        skill_id = await _seed_skill_with_resources(user_id)
        await _seed_meta_skill_creator(agent_id="")

        mock_direct.return_value = CreationResult(
            status="success",
            model_used="gpt-4o",
            raw_response=json.dumps({"name": "Generated Skill", "description": "Gen desc"}),
        )

        result = await skill_creator_service.create_skill_via_agent(db_session, skill_id)
        assert mock_direct.called
        assert result.status == "success"

    @patch("app.services.skill_creator_service._call_creator_agent")
    async def test_uses_agent_when_agent_id_set(
        self, mock_agent, db_session
    ):
        """When meta skill has agent_id, uses agent path."""
        user_id = await _seed_user()
        skill_id = await _seed_skill_with_resources(user_id)
        await _seed_meta_skill_creator(agent_id="agent-xyz")

        mock_agent.return_value = CreationResult(
            status="success",
            agent_id="agent-xyz",
            agent_version="1",
            model_used="gpt-4o",
            raw_response=json.dumps({"name": "Agent Skill", "description": "From agent"}),
        )

        result = await skill_creator_service.create_skill_via_agent(db_session, skill_id)
        assert mock_agent.called
        assert result.status == "success"
        assert result.skill_id == skill_id

    @patch("app.services.skill_creator_service._call_direct_openai")
    async def test_updates_skill_on_success(self, mock_direct, db_session):
        """On success, skill record is updated with generated content."""
        user_id = await _seed_user()
        skill_id = await _seed_skill_with_resources(user_id)
        await _seed_meta_skill_creator(agent_id="")

        mock_direct.return_value = CreationResult(
            status="success",
            model_used="gpt-4o",
            raw_response=json.dumps({
                "name": "Updated Name",
                "description": "Updated desc",
                "product": "ProductX",
                "therapeutic_area": "Immunology",
            }),
        )

        result = await skill_creator_service.create_skill_via_agent(db_session, skill_id)
        assert result.status == "success"

        # Verify skill was updated
        async with TestSessionLocal() as s:
            from sqlalchemy import select
            stmt = select(Skill).where(Skill.id == skill_id)
            res = await s.execute(stmt)
            skill = res.scalar_one()
            assert skill.name == "Updated Name"
            assert skill.conversion_status == "completed"
            # Audit trail should be in metadata
            meta = json.loads(skill.metadata_json or "{}")
            assert "creation_audit" in meta

    @patch("app.services.skill_creator_service._call_direct_openai")
    async def test_sets_failed_status_on_error(self, mock_direct, db_session):
        """On error, skill conversion_status is set to 'failed'."""
        user_id = await _seed_user()
        skill_id = await _seed_skill_with_resources(user_id)
        await _seed_meta_skill_creator(agent_id="")

        mock_direct.return_value = CreationResult(
            status="error",
            model_used="gpt-4o",
            error_detail="API timeout",
        )

        result = await skill_creator_service.create_skill_via_agent(db_session, skill_id)
        assert result.status == "error"

        # Verify skill conversion_status set to failed
        async with TestSessionLocal() as s:
            from sqlalchemy import select
            stmt = select(Skill).where(Skill.id == skill_id)
            res = await s.execute(stmt)
            skill = res.scalar_one()
            assert skill.conversion_status == "failed"
            assert skill.conversion_error == "API timeout"
