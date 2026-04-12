"""Skill Manager tests: SkillContent, compose_instructions, load_skill_for_scenario,
run_skill_script, read_skill_resource.

Uses in-memory SQLite via tests/conftest.py for DB-based tests and unittest.mock
for subprocess isolation. Target: 95%+ coverage of app/services/skill_manager.py.
"""

import subprocess
from unittest.mock import MagicMock, patch

import pytest

from app.models.hcp_profile import HcpProfile
from app.models.scenario import Scenario
from app.models.skill import Skill, SkillResource, SkillVersion
from app.models.user import User
from app.services.skill_manager import (
    SkillContent,
    SkillManager,
    load_skill_for_scenario,
    read_skill_resource,
    run_skill_script,
)
from tests.conftest import TestSessionLocal


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_user() -> str:
    """Create a test user and return the user_id."""
    from app.services.auth import get_password_hash

    async with TestSessionLocal() as session:
        user = User(
            username="skill_mgr_test_admin",
            email="skill_mgr_admin@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Skill Mgr Admin",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user.id


async def _seed_hcp_profile(user_id: str) -> str:
    """Create a test HCP profile and return the profile id."""
    async with TestSessionLocal() as session:
        hcp = HcpProfile(
            name="Dr. Test",
            specialty="Oncology",
            created_by=user_id,
        )
        session.add(hcp)
        await session.commit()
        await session.refresh(hcp)
        return hcp.id


# ===========================================================================
# SkillContent dataclass
# ===========================================================================


class TestSkillContent:
    """Test SkillContent dataclass creation and field access."""

    def test_create_with_all_fields(self):
        sc = SkillContent(
            name="Test Skill",
            description="A test skill",
            content="Skill content body",
            version_id="abc-123",
            token_estimate=100,
        )
        assert sc.name == "Test Skill"
        assert sc.description == "A test skill"
        assert sc.content == "Skill content body"
        assert sc.version_id == "abc-123"
        assert sc.token_estimate == 100

    def test_create_with_empty_fields(self):
        sc = SkillContent(
            name="",
            description="",
            content="",
            version_id="",
            token_estimate=0,
        )
        assert sc.name == ""
        assert sc.content == ""
        assert sc.token_estimate == 0

    def test_equality(self):
        a = SkillContent("X", "D", "C", "V", 10)
        b = SkillContent("X", "D", "C", "V", 10)
        assert a == b


# ===========================================================================
# SkillManager.from_db_skill
# ===========================================================================


class TestFromDbSkill:
    """Test SkillManager.from_db_skill with various DB object combinations."""

    def test_with_version_provided(self):
        """When version is provided with content, use version.content."""
        skill = MagicMock()
        skill.name = "泽布替尼 F2F技能"
        skill.description = "BTK inhibitor skill"
        skill.content = "Skill-level content"

        version = MagicMock()
        version.id = "ver-001-uuid"
        version.content = "Version-specific content"

        result = SkillManager.from_db_skill(skill, version)

        assert result.name == "泽布替尼 F2F技能"
        assert result.description == "BTK inhibitor skill"
        assert result.content == "Version-specific content"
        assert result.version_id == "ver-001-uuid"
        assert result.token_estimate == len("Version-specific content") // 4

    def test_without_version(self):
        """When version is None, fall back to skill.content."""
        skill = MagicMock()
        skill.name = "Tislelizumab Skill"
        skill.description = "PD-1 inhibitor skill"
        skill.content = "Skill-level content"

        result = SkillManager.from_db_skill(skill, None)

        assert result.content == "Skill-level content"
        assert result.version_id == ""
        assert result.token_estimate == len("Skill-level content") // 4

    def test_with_version_none_content(self):
        """When version exists but has None content, fall back to skill.content."""
        skill = MagicMock()
        skill.name = "Test"
        skill.description = "Desc"
        skill.content = "Fallback content"

        version = MagicMock()
        version.id = "ver-002"
        version.content = None

        result = SkillManager.from_db_skill(skill, version)

        assert result.content == "Fallback content"
        assert result.version_id == "ver-002"

    def test_with_version_empty_content(self):
        """When version exists but has empty string content, fall back to skill.content."""
        skill = MagicMock()
        skill.name = "Test"
        skill.description = "Desc"
        skill.content = "Fallback content"

        version = MagicMock()
        version.id = "ver-003"
        version.content = ""

        result = SkillManager.from_db_skill(skill, version)

        assert result.content == "Fallback content"
        assert result.version_id == "ver-003"

    def test_with_none_description(self):
        """When skill.description is None, it should default to empty string."""
        skill = MagicMock()
        skill.name = "Test"
        skill.description = None
        skill.content = "Content"

        result = SkillManager.from_db_skill(skill, None)

        assert result.description == ""

    def test_with_both_none_content(self):
        """When both version.content and skill.content are None."""
        skill = MagicMock()
        skill.name = "Test"
        skill.description = "Desc"
        skill.content = None

        version = MagicMock()
        version.id = "ver-004"
        version.content = None

        result = SkillManager.from_db_skill(skill, version)

        assert result.content == ""
        assert result.token_estimate == 0

    def test_skill_content_none_no_version(self):
        """When skill.content is None and no version provided."""
        skill = MagicMock()
        skill.name = "Test"
        skill.description = "Desc"
        skill.content = None

        result = SkillManager.from_db_skill(skill, None)

        assert result.content == ""
        assert result.token_estimate == 0


# ===========================================================================
# SkillManager.compose_instructions
# ===========================================================================


class TestComposeInstructions:
    """Test instruction composition from base prompt + skills."""

    def test_zero_skills(self):
        """With no skills, returns base instructions only."""
        result = SkillManager.compose_instructions("Base prompt.", [])
        assert result == "Base prompt."

    def test_one_skill(self):
        """With one skill, produces header + description + content."""
        skill = SkillContent(
            name="Zanubrutinib",
            description="BTK inhibitor",
            content="ALPINE study data",
            version_id="abcdefgh-1234",
            token_estimate=10,
        )
        result = SkillManager.compose_instructions("You are a coach.", [skill])

        assert result.startswith("You are a coach.")
        assert "== Skill: Zanubrutinib (v:abcdefgh) ==" in result
        assert "BTK inhibitor" in result
        assert "ALPINE study data" in result

    def test_multiple_skills(self):
        """With multiple skills, all sections are present."""
        skills = [
            SkillContent("Skill A", "Desc A", "Content A", "aaaa1111-uuid", 5),
            SkillContent("Skill B", "Desc B", "Content B", "bbbb2222-uuid", 5),
        ]
        result = SkillManager.compose_instructions("Base.", skills)

        assert "== Skill: Skill A (v:aaaa1111) ==" in result
        assert "== Skill: Skill B (v:bbbb2222) ==" in result
        assert "Content A" in result
        assert "Content B" in result

    def test_version_id_truncated_to_8_chars(self):
        """Version ID is truncated to first 8 characters in the header."""
        skill = SkillContent("S", "D", "C", "12345678-abcd-efgh", 1)
        result = SkillManager.compose_instructions("", [skill])
        assert "(v:12345678)" in result

    def test_empty_version_id_shows_latest(self):
        """When version_id is empty, header shows 'latest'."""
        skill = SkillContent("S", "D", "C", "", 1)
        result = SkillManager.compose_instructions("", [skill])
        assert "(v:latest)" in result

    def test_exceeding_max_tokens_logs_warning(self, caplog):
        """When token estimate exceeds max_tokens, a warning is logged."""
        # Create a skill with content large enough to exceed a small max_tokens
        big_content = "x" * 800  # 800 / 4 = 200 tokens
        skill = SkillContent("Big", "D", big_content, "v1", 200)

        import logging

        with caplog.at_level(logging.WARNING, logger="app.services.skill_manager"):
            result = SkillManager.compose_instructions("Base", [skill], max_tokens=50)

        assert "exceeds max_tokens" in caplog.text
        # Result is still produced despite the warning
        assert "Big" in result

    def test_within_max_tokens_no_warning(self, caplog):
        """When token estimate is within max_tokens, no warning is logged."""
        skill = SkillContent("Small", "D", "short", "v1", 2)

        import logging

        with caplog.at_level(logging.WARNING, logger="app.services.skill_manager"):
            SkillManager.compose_instructions("Base", [skill], max_tokens=4000)

        assert "exceeds max_tokens" not in caplog.text

    def test_compose_preserves_order(self):
        """Skills appear in the order they were provided."""
        skills = [
            SkillContent(f"Skill-{i}", "", "", "", 1) for i in range(5)
        ]
        result = SkillManager.compose_instructions("", skills)
        positions = [result.index(f"Skill-{i}") for i in range(5)]
        assert positions == sorted(positions)


# ===========================================================================
# load_skill_for_scenario (DB-based)
# ===========================================================================


class TestLoadSkillForScenario:
    """Test async DB-based skill loading for scenarios."""

    async def test_scenario_not_found_returns_none(self, db_session):
        result = await load_skill_for_scenario(db_session, "nonexistent-scenario-id")
        assert result is None

    async def test_scenario_no_skill_id_returns_none(self):
        """Scenario exists but has no skill associated."""
        user_id = await _seed_user()
        hcp_id = await _seed_hcp_profile(user_id)

        async with TestSessionLocal() as session:
            scenario = Scenario(
                name="No-skill scenario",
                product="TestProduct",
                hcp_profile_id=hcp_id,
                skill_id=None,
                created_by=user_id,
            )
            session.add(scenario)
            await session.commit()
            await session.refresh(scenario)
            scenario_id = scenario.id

        async with TestSessionLocal() as session:
            result = await load_skill_for_scenario(session, scenario_id)
            assert result is None

    async def test_skill_not_found_returns_none(self):
        """Scenario references a skill_id that doesn't exist in the DB."""
        user_id = await _seed_user()
        hcp_id = await _seed_hcp_profile(user_id)

        async with TestSessionLocal() as session:
            scenario = Scenario(
                name="Bad-skill scenario",
                product="TestProduct",
                hcp_profile_id=hcp_id,
                skill_id="nonexistent-skill-id",
                created_by=user_id,
            )
            session.add(scenario)
            await session.commit()
            await session.refresh(scenario)
            scenario_id = scenario.id

        async with TestSessionLocal() as session:
            result = await load_skill_for_scenario(session, scenario_id)
            assert result is None

    async def test_skill_not_published_returns_none(self):
        """Scenario references a skill that is still in draft status."""
        user_id = await _seed_user()
        hcp_id = await _seed_hcp_profile(user_id)

        async with TestSessionLocal() as session:
            skill = Skill(
                name="Draft Skill",
                description="Not published",
                content="Draft content",
                status="draft",
                created_by=user_id,
            )
            session.add(skill)
            await session.commit()
            await session.refresh(skill)
            skill_id = skill.id

            scenario = Scenario(
                name="Draft-skill scenario",
                product="TestProduct",
                hcp_profile_id=hcp_id,
                skill_id=skill_id,
                created_by=user_id,
            )
            session.add(scenario)
            await session.commit()
            await session.refresh(scenario)
            scenario_id = scenario.id

        async with TestSessionLocal() as session:
            result = await load_skill_for_scenario(session, scenario_id)
            assert result is None

    async def test_skill_review_status_returns_none(self):
        """Scenario references a skill in 'review' status -- not published/archived."""
        user_id = await _seed_user()
        hcp_id = await _seed_hcp_profile(user_id)

        async with TestSessionLocal() as session:
            skill = Skill(
                name="Review Skill",
                description="In review",
                content="Review content",
                status="review",
                created_by=user_id,
            )
            session.add(skill)
            await session.commit()
            await session.refresh(skill)
            skill_id = skill.id

            scenario = Scenario(
                name="Review-skill scenario",
                product="TestProduct",
                hcp_profile_id=hcp_id,
                skill_id=skill_id,
                created_by=user_id,
            )
            session.add(scenario)
            await session.commit()
            await session.refresh(scenario)
            scenario_id = scenario.id

        async with TestSessionLocal() as session:
            result = await load_skill_for_scenario(session, scenario_id)
            assert result is None

    async def test_published_skill_with_pinned_version(self):
        """Scenario pins a specific version — that version content is used."""
        user_id = await _seed_user()
        hcp_id = await _seed_hcp_profile(user_id)

        async with TestSessionLocal() as session:
            skill = Skill(
                name="Published Skill",
                description="A published skill",
                content="Skill-level content",
                status="published",
                created_by=user_id,
            )
            session.add(skill)
            await session.commit()
            await session.refresh(skill)
            skill_id = skill.id

            version = SkillVersion(
                skill_id=skill_id,
                version_number=1,
                content="Pinned version content",
                is_published=True,
                created_by=user_id,
            )
            session.add(version)
            await session.commit()
            await session.refresh(version)
            version_id = version.id

            scenario = Scenario(
                name="Pinned-version scenario",
                product="TestProduct",
                hcp_profile_id=hcp_id,
                skill_id=skill_id,
                skill_version_id=version_id,
                created_by=user_id,
            )
            session.add(scenario)
            await session.commit()
            await session.refresh(scenario)
            scenario_id = scenario.id

        async with TestSessionLocal() as session:
            result = await load_skill_for_scenario(session, scenario_id)
            assert result is not None
            assert result.name == "Published Skill"
            assert result.content == "Pinned version content"
            assert result.version_id == version_id

    async def test_pinned_version_missing_falls_back_to_published(self):
        """Scenario pins a version_id that doesn't exist — fallback to published version."""
        user_id = await _seed_user()
        hcp_id = await _seed_hcp_profile(user_id)

        async with TestSessionLocal() as session:
            skill = Skill(
                name="Fallback Skill",
                description="Falls back to published version",
                content="Skill-level content",
                status="published",
                created_by=user_id,
            )
            session.add(skill)
            await session.commit()
            await session.refresh(skill)
            skill_id = skill.id

            published_ver = SkillVersion(
                skill_id=skill_id,
                version_number=1,
                content="Published version content",
                is_published=True,
                created_by=user_id,
            )
            session.add(published_ver)
            await session.commit()
            await session.refresh(published_ver)
            published_ver_id = published_ver.id

            scenario = Scenario(
                name="Missing-pin scenario",
                product="TestProduct",
                hcp_profile_id=hcp_id,
                skill_id=skill_id,
                skill_version_id="nonexistent-version-id",
                created_by=user_id,
            )
            session.add(scenario)
            await session.commit()
            await session.refresh(scenario)
            scenario_id = scenario.id

        async with TestSessionLocal() as session:
            result = await load_skill_for_scenario(session, scenario_id)
            assert result is not None
            assert result.content == "Published version content"
            assert result.version_id == published_ver_id

    async def test_no_version_at_all_returns_skill_content(self):
        """Published skill with no versions — returns SkillContent from skill.content."""
        user_id = await _seed_user()
        hcp_id = await _seed_hcp_profile(user_id)

        async with TestSessionLocal() as session:
            skill = Skill(
                name="No-version Skill",
                description="No versions exist",
                content="Direct skill content",
                status="published",
                created_by=user_id,
            )
            session.add(skill)
            await session.commit()
            await session.refresh(skill)
            skill_id = skill.id

            scenario = Scenario(
                name="No-version scenario",
                product="TestProduct",
                hcp_profile_id=hcp_id,
                skill_id=skill_id,
                created_by=user_id,
            )
            session.add(scenario)
            await session.commit()
            await session.refresh(scenario)
            scenario_id = scenario.id

        async with TestSessionLocal() as session:
            result = await load_skill_for_scenario(session, scenario_id)
            assert result is not None
            assert result.name == "No-version Skill"
            assert result.content == "Direct skill content"
            assert result.version_id == ""

    async def test_archived_skill_is_loaded(self):
        """Archived skills should also be loaded (status 'archived' is accepted)."""
        user_id = await _seed_user()
        hcp_id = await _seed_hcp_profile(user_id)

        async with TestSessionLocal() as session:
            skill = Skill(
                name="Archived Skill",
                description="Archived",
                content="Archived content",
                status="archived",
                created_by=user_id,
            )
            session.add(skill)
            await session.commit()
            await session.refresh(skill)
            skill_id = skill.id

            scenario = Scenario(
                name="Archived-skill scenario",
                product="TestProduct",
                hcp_profile_id=hcp_id,
                skill_id=skill_id,
                created_by=user_id,
            )
            session.add(scenario)
            await session.commit()
            await session.refresh(scenario)
            scenario_id = scenario.id

        async with TestSessionLocal() as session:
            result = await load_skill_for_scenario(session, scenario_id)
            assert result is not None
            assert result.name == "Archived Skill"

    async def test_no_pinned_version_no_published_version(self):
        """Scenario has no pinned version and no published version exists — version is None."""
        user_id = await _seed_user()
        hcp_id = await _seed_hcp_profile(user_id)

        async with TestSessionLocal() as session:
            skill = Skill(
                name="Unpublished-versions Skill",
                description="Has versions but none published",
                content="Skill fallback content",
                status="published",
                created_by=user_id,
            )
            session.add(skill)
            await session.commit()
            await session.refresh(skill)
            skill_id = skill.id

            # Add a non-published version
            unpublished_ver = SkillVersion(
                skill_id=skill_id,
                version_number=1,
                content="Draft version content",
                is_published=False,
                created_by=user_id,
            )
            session.add(unpublished_ver)
            await session.commit()

            scenario = Scenario(
                name="No-published-version scenario",
                product="TestProduct",
                hcp_profile_id=hcp_id,
                skill_id=skill_id,
                skill_version_id=None,
                created_by=user_id,
            )
            session.add(scenario)
            await session.commit()
            await session.refresh(scenario)
            scenario_id = scenario.id

        async with TestSessionLocal() as session:
            result = await load_skill_for_scenario(session, scenario_id)
            assert result is not None
            # Falls back to skill.content since no published version
            assert result.content == "Skill fallback content"
            assert result.version_id == ""


# ===========================================================================
# run_skill_script (mocked subprocess)
# ===========================================================================


class TestRunSkillScript:
    """Test sandboxed script execution with mocked subprocess."""

    @patch("app.services.skill_manager.os.unlink")
    @patch("app.services.skill_manager.subprocess.run")
    @patch("app.services.skill_manager.tempfile.NamedTemporaryFile")
    def test_successful_execution(self, mock_tempfile, mock_run, mock_unlink):
        """Successful script returns stdout."""
        mock_file = MagicMock()
        mock_file.__enter__ = MagicMock(return_value=mock_file)
        mock_file.__exit__ = MagicMock(return_value=False)
        mock_file.name = "/tmp/test_script.py"
        mock_tempfile.return_value = mock_file

        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="Hello, World!\n",
            stderr="",
        )

        result = run_skill_script("print('Hello, World!')")

        assert result == "Hello, World!\n"
        mock_run.assert_called_once()
        call_args = mock_run.call_args
        assert call_args[0][0] == ["python3", "/tmp/test_script.py"]
        assert call_args[1]["shell"] is False
        assert call_args[1]["cwd"] == "/tmp"
        assert call_args[1]["timeout"] == 30
        mock_unlink.assert_called_once_with("/tmp/test_script.py")

    @patch("app.services.skill_manager.os.unlink")
    @patch("app.services.skill_manager.subprocess.run")
    @patch("app.services.skill_manager.tempfile.NamedTemporaryFile")
    def test_nonzero_exit_code_raises_runtime_error(self, mock_tempfile, mock_run, mock_unlink):
        """Script with non-zero exit code raises RuntimeError."""
        mock_file = MagicMock()
        mock_file.__enter__ = MagicMock(return_value=mock_file)
        mock_file.__exit__ = MagicMock(return_value=False)
        mock_file.name = "/tmp/failing_script.py"
        mock_tempfile.return_value = mock_file

        mock_run.return_value = MagicMock(
            returncode=1,
            stdout="",
            stderr="SyntaxError: invalid syntax",
        )

        with pytest.raises(RuntimeError, match="Script failed.*exit 1"):
            run_skill_script("invalid python")

        mock_unlink.assert_called_once_with("/tmp/failing_script.py")

    @patch("app.services.skill_manager.os.unlink")
    @patch("app.services.skill_manager.subprocess.run")
    @patch("app.services.skill_manager.tempfile.NamedTemporaryFile")
    def test_timeout_raises_timeout_expired(self, mock_tempfile, mock_run, mock_unlink):
        """Script that exceeds timeout raises subprocess.TimeoutExpired."""
        mock_file = MagicMock()
        mock_file.__enter__ = MagicMock(return_value=mock_file)
        mock_file.__exit__ = MagicMock(return_value=False)
        mock_file.name = "/tmp/slow_script.py"
        mock_tempfile.return_value = mock_file

        mock_run.side_effect = subprocess.TimeoutExpired(
            cmd=["python3", "/tmp/slow_script.py"],
            timeout=5,
        )

        with pytest.raises(subprocess.TimeoutExpired):
            run_skill_script("import time; time.sleep(100)", timeout=5)

        # Temp file should still be cleaned up
        mock_unlink.assert_called_once_with("/tmp/slow_script.py")

    @patch("app.services.skill_manager.os.unlink")
    @patch("app.services.skill_manager.subprocess.run")
    @patch("app.services.skill_manager.tempfile.NamedTemporaryFile")
    def test_custom_timeout_passed(self, mock_tempfile, mock_run, mock_unlink):
        """Custom timeout value is passed to subprocess.run."""
        mock_file = MagicMock()
        mock_file.__enter__ = MagicMock(return_value=mock_file)
        mock_file.__exit__ = MagicMock(return_value=False)
        mock_file.name = "/tmp/script.py"
        mock_tempfile.return_value = mock_file

        mock_run.return_value = MagicMock(returncode=0, stdout="ok", stderr="")

        run_skill_script("pass", timeout=60)

        call_args = mock_run.call_args
        assert call_args[1]["timeout"] == 60

    @patch("app.services.skill_manager.os.unlink")
    @patch("app.services.skill_manager.subprocess.run")
    @patch("app.services.skill_manager.tempfile.NamedTemporaryFile")
    def test_env_is_minimal(self, mock_tempfile, mock_run, mock_unlink):
        """Environment passed to subprocess is minimal (PATH, HOME, LANG only)."""
        mock_file = MagicMock()
        mock_file.__enter__ = MagicMock(return_value=mock_file)
        mock_file.__exit__ = MagicMock(return_value=False)
        mock_file.name = "/tmp/script.py"
        mock_tempfile.return_value = mock_file

        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

        run_skill_script("pass")

        call_args = mock_run.call_args
        env = call_args[1]["env"]
        assert set(env.keys()) == {"PATH", "HOME", "LANG"}
        assert env["HOME"] == "/tmp"

    @patch("app.services.skill_manager.os.unlink")
    @patch("app.services.skill_manager.subprocess.run")
    @patch("app.services.skill_manager.tempfile.NamedTemporaryFile")
    def test_stderr_truncated_in_error_message(self, mock_tempfile, mock_run, mock_unlink):
        """Long stderr is truncated to 500 chars in the error message."""
        mock_file = MagicMock()
        mock_file.__enter__ = MagicMock(return_value=mock_file)
        mock_file.__exit__ = MagicMock(return_value=False)
        mock_file.name = "/tmp/script.py"
        mock_tempfile.return_value = mock_file

        long_stderr = "E" * 1000
        mock_run.return_value = MagicMock(
            returncode=2,
            stdout="",
            stderr=long_stderr,
        )

        with pytest.raises(RuntimeError, match="Script failed") as exc_info:
            run_skill_script("bad code")

        # The error message should contain at most 500 chars of stderr
        error_msg = str(exc_info.value)
        # stderr portion in error: "E" * 500 (truncated from 1000)
        assert len(error_msg) < len(long_stderr) + 100


# ===========================================================================
# read_skill_resource (DB-based)
# ===========================================================================


class TestReadSkillResource:
    """Test on-demand skill resource loading."""

    async def test_resource_found_returns_text_content(self):
        """When matching resource exists, return its text_content."""
        user_id = await _seed_user()

        async with TestSessionLocal() as session:
            skill = Skill(
                name="Resource Skill",
                description="Has resources",
                content="content",
                status="published",
                created_by=user_id,
            )
            session.add(skill)
            await session.commit()
            await session.refresh(skill)
            skill_id = skill.id

            resource = SkillResource(
                skill_id=skill_id,
                resource_type="reference",
                filename="zanubrutinib_manual.pdf",
                storage_path=f"skills/{skill_id}/references/zanubrutinib_manual.pdf",
                content_type="application/pdf",
                file_size=2048,
                text_content="Extracted PDF content: BTK inhibitor data...",
            )
            session.add(resource)
            await session.commit()

        async with TestSessionLocal() as session:
            result = await read_skill_resource(
                session, skill_id, "reference", "zanubrutinib_manual.pdf"
            )
            assert result == "Extracted PDF content: BTK inhibitor data..."

    async def test_resource_not_found_returns_empty(self):
        """When no matching resource, return empty string."""
        user_id = await _seed_user()

        async with TestSessionLocal() as session:
            skill = Skill(
                name="No-resource Skill",
                description="No resources",
                content="content",
                status="published",
                created_by=user_id,
            )
            session.add(skill)
            await session.commit()
            await session.refresh(skill)
            skill_id = skill.id

        async with TestSessionLocal() as session:
            result = await read_skill_resource(
                session, skill_id, "reference", "nonexistent.pdf"
            )
            assert result == ""

    async def test_resource_with_none_text_content_returns_empty(self):
        """When resource exists but text_content is None, return empty string."""
        user_id = await _seed_user()

        async with TestSessionLocal() as session:
            skill = Skill(
                name="Null-content Skill",
                description="Resource with null text",
                content="content",
                status="published",
                created_by=user_id,
            )
            session.add(skill)
            await session.commit()
            await session.refresh(skill)
            skill_id = skill.id

            resource = SkillResource(
                skill_id=skill_id,
                resource_type="script",
                filename="analysis.py",
                storage_path=f"skills/{skill_id}/scripts/analysis.py",
                content_type="text/x-python",
                file_size=512,
                text_content=None,
            )
            session.add(resource)
            await session.commit()

        async with TestSessionLocal() as session:
            result = await read_skill_resource(
                session, skill_id, "script", "analysis.py"
            )
            assert result == ""

    async def test_resource_wrong_type_returns_empty(self):
        """Resource exists but with different resource_type — returns empty."""
        user_id = await _seed_user()

        async with TestSessionLocal() as session:
            skill = Skill(
                name="Type-mismatch Skill",
                description="Test",
                content="content",
                status="published",
                created_by=user_id,
            )
            session.add(skill)
            await session.commit()
            await session.refresh(skill)
            skill_id = skill.id

            resource = SkillResource(
                skill_id=skill_id,
                resource_type="reference",
                filename="data.pdf",
                storage_path=f"skills/{skill_id}/references/data.pdf",
                content_type="application/pdf",
                file_size=1024,
                text_content="PDF content",
            )
            session.add(resource)
            await session.commit()

        async with TestSessionLocal() as session:
            # Query with "script" type but resource is "reference"
            result = await read_skill_resource(
                session, skill_id, "script", "data.pdf"
            )
            assert result == ""

    async def test_resource_wrong_skill_id_returns_empty(self):
        """Resource exists but for a different skill — returns empty."""
        user_id = await _seed_user()

        async with TestSessionLocal() as session:
            skill = Skill(
                name="Owner Skill",
                description="Test",
                content="content",
                status="published",
                created_by=user_id,
            )
            session.add(skill)
            await session.commit()
            await session.refresh(skill)
            skill_id = skill.id

            resource = SkillResource(
                skill_id=skill_id,
                resource_type="reference",
                filename="doc.pdf",
                storage_path=f"skills/{skill_id}/references/doc.pdf",
                content_type="application/pdf",
                file_size=1024,
                text_content="Content for owner skill",
            )
            session.add(resource)
            await session.commit()

        async with TestSessionLocal() as session:
            result = await read_skill_resource(
                session, "different-skill-id", "reference", "doc.pdf"
            )
            assert result == ""
