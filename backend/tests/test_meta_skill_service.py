"""Unit tests for meta_skill_service — CRUD, template loading, ensure_defaults."""

from unittest.mock import AsyncMock, patch

from tests.conftest import TestSessionLocal

from app.models.meta_skill import MetaSkill
from app.services import meta_skill_service
from app.services.meta_skill_service import _load_default_template


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_meta_skill(
    skill_type: str = "creator",
    name: str = "skill_creator",
    display_name: str = "Skill Creator",
    model: str = "gpt-4o",
    template_language: str = "en",
    template_content: str = "default template",
    agent_id: str = "",
    agent_version: str = "",
) -> str:
    """Insert a MetaSkill row directly and return its id."""
    async with TestSessionLocal() as s:
        meta = MetaSkill(
            name=name,
            display_name=display_name,
            skill_type=skill_type,
            model=model,
            template_content=template_content,
            template_language=template_language,
            agent_id=agent_id,
            agent_version=agent_version,
        )
        s.add(meta)
        await s.commit()
        await s.refresh(meta)
        return meta.id


# ---------------------------------------------------------------------------
# Template loading
# ---------------------------------------------------------------------------


class TestLoadDefaultTemplate:
    def test_load_creator_en(self):
        text = _load_default_template("creator", "en")
        assert text, "creator_en template should not be empty"
        assert "skill" in text.lower() or "Skill" in text

    def test_load_evaluator_en(self):
        text = _load_default_template("evaluator", "en")
        assert text

    def test_load_creator_zh(self):
        text = _load_default_template("creator", "zh")
        assert text

    def test_load_evaluator_zh(self):
        text = _load_default_template("evaluator", "zh")
        assert text

    def test_load_unknown_type_returns_empty(self):
        assert _load_default_template("unknown", "en") == ""

    def test_load_unknown_language_falls_back_to_en(self):
        text = _load_default_template("creator", "fr")
        # Falls back to "en" key
        assert text


# ---------------------------------------------------------------------------
# CRUD — get / get_all / update / reset
# ---------------------------------------------------------------------------


class TestGetMetaSkill:
    async def test_returns_none_when_empty(self, db_session):
        result = await meta_skill_service.get_meta_skill(db_session, "creator")
        assert result is None

    async def test_returns_creator(self, db_session):
        await _seed_meta_skill(skill_type="creator")
        result = await meta_skill_service.get_meta_skill(db_session, "creator")
        assert result is not None
        assert result.skill_type == "creator"
        assert result.name == "skill_creator"

    async def test_returns_evaluator(self, db_session):
        await _seed_meta_skill(
            skill_type="evaluator",
            name="skill_evaluator",
            display_name="Skill Evaluator",
        )
        result = await meta_skill_service.get_meta_skill(db_session, "evaluator")
        assert result is not None
        assert result.skill_type == "evaluator"

    async def test_inactive_not_returned(self, db_session):
        await _seed_meta_skill(skill_type="creator")
        # Deactivate it
        meta = await meta_skill_service.get_meta_skill(db_session, "creator")
        meta.is_active = False
        await db_session.commit()

        # Now fetch returns None since inactive
        async with TestSessionLocal() as s:
            result = await meta_skill_service.get_meta_skill(s, "creator")
            assert result is None


class TestGetAllMetaSkills:
    async def test_empty_table(self, db_session):
        result = await meta_skill_service.get_all_meta_skills(db_session)
        assert result == []

    async def test_returns_all(self, db_session):
        await _seed_meta_skill(skill_type="creator")
        await _seed_meta_skill(
            skill_type="evaluator",
            name="skill_evaluator",
            display_name="Skill Evaluator",
        )
        result = await meta_skill_service.get_all_meta_skills(db_session)
        assert len(result) == 2
        types = {m.skill_type for m in result}
        assert types == {"creator", "evaluator"}


class TestUpdateMetaSkill:
    async def test_update_model(self, db_session):
        await _seed_meta_skill()
        result = await meta_skill_service.update_meta_skill(
            db_session, "creator", model="gpt-4o-mini"
        )
        assert result is not None
        assert result.model == "gpt-4o-mini"

    async def test_update_template_content(self, db_session):
        await _seed_meta_skill()
        result = await meta_skill_service.update_meta_skill(
            db_session, "creator", template_content="new template"
        )
        assert result is not None
        assert result.template_content == "new template"

    async def test_update_language(self, db_session):
        await _seed_meta_skill()
        result = await meta_skill_service.update_meta_skill(
            db_session, "creator", template_language="zh"
        )
        assert result is not None
        assert result.template_language == "zh"

    async def test_update_nonexistent_returns_none(self, db_session):
        result = await meta_skill_service.update_meta_skill(
            db_session, "creator", model="gpt-4o-mini"
        )
        assert result is None

    async def test_partial_update_preserves_other_fields(self, db_session):
        await _seed_meta_skill(model="gpt-4o", template_content="original")
        result = await meta_skill_service.update_meta_skill(
            db_session, "creator", model="gpt-4.1"
        )
        assert result.model == "gpt-4.1"
        assert result.template_content == "original"


class TestResetToDefault:
    async def test_reset_restores_bundled_template(self, db_session):
        await _seed_meta_skill(template_content="custom content")
        result = await meta_skill_service.reset_to_default(db_session, "creator")
        assert result is not None
        # After reset, content should be the bundled default (not "custom content")
        assert result.template_content != "custom content"
        assert len(result.template_content) > 0

    async def test_reset_nonexistent_returns_none(self, db_session):
        result = await meta_skill_service.reset_to_default(db_session, "nonexistent")
        assert result is None


# ---------------------------------------------------------------------------
# ensure_defaults — startup seeding
# ---------------------------------------------------------------------------


class TestEnsureDefaults:
    async def test_seeds_both_types(self, db_session):
        await meta_skill_service.ensure_defaults(db_session)
        all_skills = await meta_skill_service.get_all_meta_skills(db_session)
        types = {m.skill_type for m in all_skills}
        assert "creator" in types
        assert "evaluator" in types

    async def test_does_not_duplicate_on_rerun(self, db_session):
        await meta_skill_service.ensure_defaults(db_session)
        await meta_skill_service.ensure_defaults(db_session)  # second call
        all_skills = await meta_skill_service.get_all_meta_skills(db_session)
        assert len(all_skills) == 2

    async def test_seeded_creator_has_template(self, db_session):
        await meta_skill_service.ensure_defaults(db_session)
        creator = await meta_skill_service.get_meta_skill(db_session, "creator")
        assert creator is not None
        assert len(creator.template_content) > 100  # real template, not empty

    async def test_seeded_evaluator_has_template(self, db_session):
        await meta_skill_service.ensure_defaults(db_session)
        evaluator = await meta_skill_service.get_meta_skill(db_session, "evaluator")
        assert evaluator is not None
        assert len(evaluator.template_content) > 100


# ---------------------------------------------------------------------------
# sync_meta_skill_agent
# ---------------------------------------------------------------------------


class TestSyncMetaSkillAgent:
    async def test_returns_none_when_no_meta_skill(self, db_session):
        result = await meta_skill_service.sync_meta_skill_agent(db_session, "creator")
        assert result is None

    async def test_returns_none_when_empty_template(self, db_session):
        await _seed_meta_skill(template_content="")
        result = await meta_skill_service.sync_meta_skill_agent(db_session, "creator")
        assert result is None

    async def test_creates_new_agent(self, db_session):
        """When no agent_id, sync calls create_agent and stores result."""
        await _seed_meta_skill(template_content="some template", agent_id="")

        mock_create = AsyncMock(return_value={"id": "agent-123", "version": "1"})
        mock_update = AsyncMock()
        mock_endpoint = AsyncMock(return_value=("https://ai.example.com", "test-key"))

        with patch(
            "app.services.agent_sync_service.create_agent", mock_create
        ), patch(
            "app.services.agent_sync_service.update_agent", mock_update
        ), patch(
            "app.services.agent_sync_service.get_project_endpoint", mock_endpoint
        ):
            result = await meta_skill_service.sync_meta_skill_agent(db_session, "creator")
            assert result is not None
            assert result.agent_id == "agent-123"
            assert result.agent_version == "1"
            assert result.last_synced_at is not None
            mock_create.assert_called_once()
            mock_update.assert_not_called()

    async def test_updates_existing_agent(self, db_session):
        """When agent_id is set, sync calls update_agent, not create_agent."""
        await _seed_meta_skill(
            template_content="template",
            agent_id="existing-agent-id",
            agent_version="1",
        )

        mock_create = AsyncMock()
        mock_update = AsyncMock(return_value={"id": "existing-agent-id", "version": "2"})
        mock_endpoint = AsyncMock(return_value=("https://ai.example.com", "test-key"))

        with patch(
            "app.services.agent_sync_service.create_agent", mock_create
        ), patch(
            "app.services.agent_sync_service.update_agent", mock_update
        ), patch(
            "app.services.agent_sync_service.get_project_endpoint", mock_endpoint
        ):
            result = await meta_skill_service.sync_meta_skill_agent(db_session, "creator")
            assert result is not None
            assert result.agent_version == "2"
            mock_update.assert_called_once()
            mock_create.assert_not_called()
        # This test verifies the sync function structure — the lazy imports
        # make full mock-based testing complex. Integration tests cover the full path.
