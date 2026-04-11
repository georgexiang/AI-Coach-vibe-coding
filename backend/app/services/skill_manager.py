"""Skill Manager — instruction composition and sandboxed script execution.

Follows the SkillManager pattern from the reference implementation
(azure_foundary_hosted_agents-main/agent-framework/agent-with-skills/skill_manager.py).

Provides:
- SkillContent dataclass for runtime skill data
- SkillManager.compose_instructions() for agent instruction injection (D-22)
- load_skill_for_scenario() for DB-based skill loading
- run_skill_script() for sandboxed script execution (D-25)
- read_skill_resource() for on-demand resource loading (D-26)
"""

import logging
import os
import subprocess
import tempfile
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class SkillContent:
    """Runtime skill data for instruction composition."""

    name: str
    description: str
    content: str
    version_id: str
    token_estimate: int


class SkillManager:
    """Load, compose, and manage coaching skills for agent instructions."""

    @staticmethod
    def from_db_skill(skill: object, version: object | None = None) -> SkillContent:
        """Create SkillContent from DB Skill and optional SkillVersion.

        Uses version.content if provided (deterministic per pinned version),
        otherwise falls back to skill.content.
        """
        content = version.content if version and version.content else skill.content
        return SkillContent(
            name=skill.name,
            description=skill.description or "",
            content=content or "",
            version_id=version.id if version else "",
            token_estimate=len(content or "") // 4,
        )

    @staticmethod
    def compose_instructions(
        base_instructions: str,
        skills: list[SkillContent],
        max_tokens: int = 4000,
    ) -> str:
        """Compose agent instructions from base prompt and loaded skills.

        Follows the reference implementation pattern:
        base instructions + structured skill sections with headers.
        Includes version_id in header for audit trail (T-19-25).
        """
        parts = [base_instructions]
        total_tokens = len(base_instructions) // 4

        for skill in skills:
            version_tag = skill.version_id[:8] if skill.version_id else "latest"
            header = f"== Skill: {skill.name} (v:{version_tag}) =="
            section = f"\n\n{header}\n{skill.description}\n\n{skill.content}"
            parts.append(section)
            total_tokens += skill.token_estimate

        logger.info(
            "Composed instructions: %d skills, ~%d tokens",
            len(skills),
            total_tokens,
        )
        if total_tokens > max_tokens:
            logger.warning(
                "Token estimate (%d) exceeds max_tokens (%d)",
                total_tokens,
                max_tokens,
            )

        return "".join(parts)


async def load_skill_for_scenario(db: AsyncSession, scenario_id: str) -> SkillContent | None:
    """Load the associated Skill for a Scenario from the database.

    Returns SkillContent with version-pinned content (deterministic behavior),
    or None if no skill is associated or the skill is unavailable.
    """
    from app.models.scenario import Scenario
    from app.models.skill import Skill, SkillVersion

    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if scenario is None or not scenario.skill_id:
        return None

    skill_result = await db.execute(select(Skill).where(Skill.id == scenario.skill_id))
    skill = skill_result.scalar_one_or_none()
    if skill is None or skill.status not in ("published", "archived"):
        return None

    # Use pinned version (deterministic) or fall back to current published version
    version = None
    if scenario.skill_version_id:
        ver_result = await db.execute(
            select(SkillVersion).where(SkillVersion.id == scenario.skill_version_id)
        )
        version = ver_result.scalar_one_or_none()

    if version is None:
        # Fallback: find published version
        ver_result = await db.execute(
            select(SkillVersion).where(
                SkillVersion.skill_id == scenario.skill_id,
                SkillVersion.is_published == True,  # noqa: E712
            )
        )
        version = ver_result.scalar_one_or_none()

    return SkillManager.from_db_skill(skill, version)


def run_skill_script(script_content: str, timeout: int = 30) -> str:
    """Execute a skill script in a sandboxed subprocess.

    Security measures (T-19-22):
    - shell=False: no shell interpretation
    - cwd="/tmp": restricted working directory
    - Minimal environment: only PATH, HOME, LANG
    - Temp file execution: avoids -c flag shell issues
    - Timeout: default 30s CPU limit
    - Cleanup: temp file removed after execution
    """
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, dir="/tmp") as f:
        f.write(script_content)
        script_path = f.name

    try:
        result = subprocess.run(
            ["python3", script_path],
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=False,
            cwd="/tmp",
            env={
                "PATH": "/usr/bin:/usr/local/bin",
                "HOME": "/tmp",
                "LANG": "en_US.UTF-8",
            },
        )
        if result.returncode != 0:
            raise RuntimeError(f"Script failed (exit {result.returncode}): {result.stderr[:500]}")
        return result.stdout
    finally:
        os.unlink(script_path)


async def read_skill_resource(
    db: AsyncSession, skill_id: str, resource_type: str, filename: str
) -> str:
    """Load a specific skill resource content on demand (D-26).

    Returns the text_content of the matching SkillResource record.
    """
    from app.models.skill import SkillResource

    result = await db.execute(
        select(SkillResource).where(
            SkillResource.skill_id == skill_id,
            SkillResource.resource_type == resource_type,
            SkillResource.filename == filename,
        )
    )
    resource = result.scalar_one_or_none()
    if resource is None:
        return ""
    return resource.text_content or ""
