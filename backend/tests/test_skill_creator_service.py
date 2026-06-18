"""Unit tests for skill_creator_service — agent-based skill creation."""

import json
from unittest.mock import patch

from app.models.meta_skill import MetaSkill
from app.models.skill import Skill, SkillResource
from app.models.user import User
from app.services import skill_creator_service
from app.services.skill_creator_service import (
    CreationResult,
    PackageManifest,
    _build_package_manifest,
    _parse_raw_json,
)
from tests.conftest import TestSessionLocal

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
# _parse_raw_json / _build_package_manifest
# ---------------------------------------------------------------------------


class TestParseRawJson:
    def test_valid_json(self):
        raw = json.dumps({"name": "Test", "skill_md": "# Content"})
        result = _parse_raw_json(raw)
        assert result["name"] == "Test"

    def test_json_in_markdown_block(self):
        raw = 'Here is the result:\n```json\n{"name": "Skill B", "summary": "blah"}\n```\n'
        result = _parse_raw_json(raw)
        assert result["name"] == "Skill B"

    def test_plain_text_fallback(self):
        raw = "This is plain text without JSON"
        result = _parse_raw_json(raw)
        assert result["skill_md"] == raw

    def test_empty_json_object(self):
        raw = "{}"
        result = _parse_raw_json(raw)
        assert result == {}


class TestBuildPackageManifest:
    def test_v3_format_with_skill_md(self):
        parsed = {
            "metadata": {
                "name": "test",
                "description": "desc",
                "product": "P",
                "therapeutic_area": "Onc",
            },
            "skill_md": "# Skill\n\n## SOP Steps\n\n### Step 1: Opening",
            "references": {"kb.md": "# Knowledge"},
            "scripts": {"validate.py": "def validate(): pass"},
            "assets": {"tips.md": "# Tips"},
            "summary": "Test summary",
        }
        m = _build_package_manifest(parsed)
        assert isinstance(m, PackageManifest)
        assert m.metadata["name"] == "test"
        assert "## SOP Steps" in m.skill_md
        assert "kb.md" in m.references
        assert "validate.py" in m.scripts
        assert m.summary == "Test summary"

    def test_v2_legacy_format_with_sop_steps(self):
        parsed = {
            "name": "legacy",
            "description": "Legacy desc",
            "product": "LegacyP",
            "therapeutic_area": "Hematology",
            "sop_steps": [
                {
                    "title": "Opening",
                    "description": "Greet",
                    "key_points": ["Hi"],
                    "assessment_criteria": ["Tone"],
                },
            ],
            "modules": [],
            "scoring": {"pass_threshold": 70, "weights": {}},
            "summary": "Legacy test",
        }
        m = _build_package_manifest(parsed)
        assert m.metadata["name"] == "legacy"
        assert "### Step 1: Opening" in m.skill_md
        assert m.references == {}

    def test_raw_text_fallback(self):
        m = _build_package_manifest({"content": "# Raw markdown", "summary": "Fallback"})
        assert m.skill_md == "# Raw markdown"
        assert m.summary == "Fallback"

    def test_v3_metadata_fallback_from_top_level(self):
        """When metadata dict is empty, extract from top-level keys."""
        parsed = {
            "name": "top-level",
            "description": "From top",
            "skill_md": "# Content",
            "references": {},
            "scripts": {},
            "assets": {},
            "summary": "Sum",
        }
        m = _build_package_manifest(parsed)
        assert m.metadata["name"] == "top-level"


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
    async def test_fallback_to_direct_openai_when_no_agent_id(self, mock_direct, db_session):
        """When meta skill has no agent_id, falls back to direct OpenAI."""
        user_id = await _seed_user()
        skill_id = await _seed_skill_with_resources(user_id)
        await _seed_meta_skill_creator(agent_id="")

        mock_direct.return_value = CreationResult(
            status="success",
            model_used="gpt-4o",
            raw_response=json.dumps(
                {
                    "metadata": {
                        "name": "generated-skill",
                        "description": "Gen desc",
                        "product": "P",
                        "therapeutic_area": "Onc",
                    },
                    "skill_md": "# Generated\n\n## SOP Steps\n\n### Step 1: Opening\nContent.",
                    "references": {},
                    "scripts": {},
                    "assets": {},
                    "summary": "Generated skill.",
                }
            ),
        )

        result = await skill_creator_service.create_skill_via_agent(db_session, skill_id)
        assert mock_direct.called
        assert result.status == "success"

    @patch("app.services.skill_creator_service._call_creator_agent")
    async def test_uses_agent_when_agent_id_set(self, mock_agent, db_session):
        """When meta skill has agent_id, uses agent path."""
        user_id = await _seed_user()
        skill_id = await _seed_skill_with_resources(user_id)
        await _seed_meta_skill_creator(agent_id="agent-xyz")

        mock_agent.return_value = CreationResult(
            status="success",
            agent_id="agent-xyz",
            agent_version="1",
            model_used="gpt-4o",
            raw_response=json.dumps(
                {
                    "metadata": {
                        "name": "agent-skill",
                        "description": "From agent",
                        "product": "P",
                        "therapeutic_area": "Onc",
                    },
                    "skill_md": "# Agent Skill\n\nContent.",
                    "references": {},
                    "scripts": {},
                    "assets": {},
                    "summary": "From agent.",
                }
            ),
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
            raw_response=json.dumps(
                {
                    "metadata": {
                        "name": "Updated Name",
                        "description": "Updated desc",
                        "product": "ProductX",
                        "therapeutic_area": "Immunology",
                    },
                    "skill_md": "# Updated Skill\n\n## SOP Steps\n\nFull content.",
                    "references": {"kb.md": "# Knowledge base content here."},
                    "scripts": {"validate.py": "def validate(): pass"},
                    "assets": {},
                    "summary": "Updated skill summary.",
                }
            ),
        )

        result = await skill_creator_service.create_skill_via_agent(db_session, skill_id)
        assert result.status == "success"

        # Verify skill was updated
        async with TestSessionLocal() as s:
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload

            stmt = select(Skill).options(selectinload(Skill.resources)).where(Skill.id == skill_id)
            res = await s.execute(stmt)
            skill = res.scalar_one()
            assert skill.name == "Updated Name"
            assert skill.conversion_status == "completed"
            # Content should be Markdown, not raw JSON
            assert skill.content.startswith("# Updated Skill")
            assert "## SOP Steps" in skill.content
            # Audit trail should be in metadata
            meta = json.loads(skill.metadata_json or "{}")
            assert "creation_audit" in meta
            assert meta["creation_audit"]["format"] == "package_manifest_v3"
            # Resources should have been created from manifest
            ref_resources = [r for r in skill.resources if r.resource_type == "reference"]
            script_resources = [r for r in skill.resources if r.resource_type == "script"]
            assert len(ref_resources) >= 1
            assert len(script_resources) >= 1

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
