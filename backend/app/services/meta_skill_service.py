"""Meta Skill configuration service — CRUD + Azure Agent sync.

Manages the creator and evaluator meta-skill agents. Reuses the same
agent_sync_service functions (create_agent, update_agent) used by HCP profiles.
"""

import logging
from datetime import UTC, datetime
from pathlib import Path

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meta_skill import MetaSkill

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Template / Skill directory loading
# ---------------------------------------------------------------------------

_TEMPLATE_DIR = Path(__file__).parent / "meta_skill_templates"

# Mapping from skill_type to the skill directory name
_SKILL_DIR_MAP: dict[str, str] = {
    "creator": "skill-creator",
    "evaluator": "skill-evaluator",
}

# Legacy flat-file templates (fallback)
_DEFAULT_TEMPLATES: dict[str, dict[str, str]] = {
    "creator": {
        "en": "creator_en.md",
        "zh": "creator_zh.md",
    },
    "evaluator": {
        "en": "evaluator_en.md",
        "zh": "evaluator_zh.md",
    },
}

_REFERENCE_EXTENSIONS = {".md", ".json", ".yaml", ".yml", ".csv", ".xml", ".txt"}


def _parse_skill_md(path: Path) -> tuple[str, str, str]:
    """Parse a SKILL.md file with YAML frontmatter.

    Returns (name, description, body) tuple.
    """
    text = path.read_text(encoding="utf-8")

    # Split frontmatter (---\n...\n---) from body
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            fm_raw = parts[1].strip()
            body = parts[2].strip()
            try:
                fm = yaml.safe_load(fm_raw) or {}
            except yaml.YAMLError:
                logger.warning("Failed to parse YAML frontmatter in %s", path)
                fm = {}
            return (
                fm.get("name", ""),
                fm.get("description", ""),
                body,
            )

    # No frontmatter — treat entire content as body
    return ("", "", text.strip())


def _load_skill_directory(skill_type: str, language: str = "en") -> str:
    """Load a skill directory and compose instructions.

    Reads SKILL.md (or SKILL_zh.md for Chinese), reads all reference files,
    and composes them into a single instructions string::

        == Skill: {name} ==
        {description}

        {skill_body}

        == Reference Materials ==
        ### filename.md
        {content}
        ...
    """
    dir_name = _SKILL_DIR_MAP.get(skill_type)
    if not dir_name:
        return ""

    skill_dir = _TEMPLATE_DIR / dir_name
    if not skill_dir.is_dir():
        return ""

    # Choose SKILL file: prefer language-specific, fallback to SKILL.md
    skill_file = skill_dir / f"SKILL_{language}.md"
    if not skill_file.exists() or language == "en":
        skill_file = skill_dir / "SKILL.md"
    if not skill_file.exists():
        logger.warning("SKILL.md not found in %s", skill_dir)
        return ""

    name, description, body = _parse_skill_md(skill_file)

    # Read reference files
    refs_dir = skill_dir / "references"
    references: dict[str, str] = {}
    if refs_dir.is_dir():
        for ref_file in sorted(refs_dir.iterdir()):
            if ref_file.suffix in _REFERENCE_EXTENSIONS and ref_file.is_file():
                references[ref_file.name] = ref_file.read_text(encoding="utf-8")

    # Compose instructions (same pattern as POC test_agent_with_skills.py)
    parts: list[str] = []
    parts.append(f"== Skill: {name} ==\n{description}\n\n{body}")

    if references:
        parts.append("\n\n== Reference Materials ==")
        parts.append("The following reference documents are available for this skill:\n")
        for filename, content in references.items():
            parts.append(f"### {filename}\n\n{content}")

    composed = "\n\n".join(parts)
    token_estimate = len(composed) // 4
    if token_estimate > 30000:
        logger.warning(
            "Composed instructions for '%s' are very large: ~%d tokens",
            skill_type, token_estimate,
        )

    return composed


def get_validation_script_path(skill_type: str) -> Path | None:
    """Return the path to the validation script for a skill type, or None."""
    dir_name = _SKILL_DIR_MAP.get(skill_type)
    if not dir_name:
        return None
    scripts_dir = _TEMPLATE_DIR / dir_name / "scripts"
    if not scripts_dir.is_dir():
        return None
    # Convention: validate_{type}_output.py
    type_label = dir_name.replace("skill-", "")  # "creator" or "evaluator"
    script = scripts_dir / f"validate_{type_label}_output.py"
    return script if script.exists() else None


def _load_default_template(skill_type: str, language: str = "en") -> str:
    """Load composed instructions from skill directory, with flat-file fallback."""
    # Try new skill directory pattern first
    composed = _load_skill_directory(skill_type, language)
    if composed:
        return composed

    # Fallback to legacy flat files
    templates = _DEFAULT_TEMPLATES.get(skill_type, {})
    filename = templates.get(language, templates.get("en", ""))
    if not filename:
        return ""
    path = _TEMPLATE_DIR / filename
    if not path.exists():
        logger.warning("Default template not found: %s", path)
        return ""
    return path.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


async def get_meta_skill(db: AsyncSession, skill_type: str) -> MetaSkill | None:
    """Get the active meta skill config by type ('creator' or 'evaluator')."""
    stmt = select(MetaSkill).where(
        MetaSkill.skill_type == skill_type,
        MetaSkill.is_active.is_(True),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_all_meta_skills(db: AsyncSession) -> list[MetaSkill]:
    """List all meta skill configurations."""
    stmt = select(MetaSkill).order_by(MetaSkill.skill_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_meta_skill(
    db: AsyncSession,
    skill_type: str,
    *,
    model: str | None = None,
    template_content: str | None = None,
    template_language: str | None = None,
    is_active: bool | None = None,
) -> MetaSkill | None:
    """Update a meta skill configuration. Returns updated row or None."""
    meta = await get_meta_skill(db, skill_type)
    if not meta:
        return None

    if model is not None:
        meta.model = model
    if template_content is not None:
        meta.template_content = template_content
    if template_language is not None:
        meta.template_language = template_language
    if is_active is not None:
        meta.is_active = is_active

    await db.commit()
    await db.refresh(meta)
    return meta


async def reset_to_default(db: AsyncSession, skill_type: str) -> MetaSkill | None:
    """Reset a meta skill's template to the bundled default."""
    meta = await get_meta_skill(db, skill_type)
    if not meta:
        return None
    meta.template_content = _load_default_template(skill_type, meta.template_language)
    await db.commit()
    await db.refresh(meta)
    return meta


# ---------------------------------------------------------------------------
# Azure Agent sync (reuses agent_sync_service)
# ---------------------------------------------------------------------------


async def sync_meta_skill_agent(db: AsyncSession, skill_type: str) -> MetaSkill | None:
    """Create or update the Azure Agent for a meta skill.

    Reuses agent_sync_service.create_agent / update_agent — the same functions
    used for HCP profile agents.
    """
    from app.services.agent_sync_service import (
        create_agent,
        get_project_endpoint,
        update_agent,
    )

    meta = await get_meta_skill(db, skill_type)
    if not meta:
        logger.warning("sync_meta_skill_agent: no meta skill found for type=%s", skill_type)
        return None

    if not meta.template_content:
        logger.warning("sync_meta_skill_agent: empty template for type=%s", skill_type)
        return None

    endpoint, api_key = await get_project_endpoint(db)

    try:
        if meta.agent_id:
            result = await update_agent(
                db,
                agent_id=meta.agent_id,
                name=meta.name,
                instructions=meta.template_content,
                model=meta.model,
                endpoint_override=endpoint,
                key_override=api_key,
            )
        else:
            result = await create_agent(
                db,
                name=meta.name,
                instructions=meta.template_content,
                model=meta.model,
                endpoint_override=endpoint,
                key_override=api_key,
            )

        meta.agent_id = result["id"]
        meta.agent_version = result["version"]
        meta.last_synced_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(meta)
        logger.info(
            "sync_meta_skill_agent: type=%s, agent_id=%s, version=%s",
            skill_type,
            meta.agent_id,
            meta.agent_version,
        )
    except Exception:
        logger.exception("sync_meta_skill_agent failed for type=%s", skill_type)
        raise

    return meta


# ---------------------------------------------------------------------------
# Startup seeding
# ---------------------------------------------------------------------------

_DEFAULT_CONFIGS = [
    {
        "name": "skill-creator",
        "display_name": "Skill Creator",
        "skill_type": "creator",
        "model": "gpt-4o",
        "template_language": "en",
    },
    {
        "name": "skill-evaluator",
        "display_name": "Skill Evaluator",
        "skill_type": "evaluator",
        "model": "gpt-4o",
        "template_language": "en",
    },
]


async def ensure_defaults(db: AsyncSession) -> None:
    """Seed default meta skill rows if table is empty. Called during app startup.

    Also migrates legacy underscore names (e.g. "skill_creator") to hyphen format
    ("skill-creator") to comply with Azure AI Foundry naming rules.
    """
    stmt = select(MetaSkill)
    result = await db.execute(stmt)
    existing_rows = list(result.scalars().all())
    existing = {row.skill_type for row in existing_rows}

    # Migrate legacy underscore names → hyphen format
    for row in existing_rows:
        if "_" in row.name:
            old_name = row.name
            row.name = row.name.replace("_", "-")
            logger.info("ensure_defaults: migrated name '%s' → '%s'", old_name, row.name)

    for cfg in _DEFAULT_CONFIGS:
        if cfg["skill_type"] in existing:
            continue
        template = _load_default_template(cfg["skill_type"], cfg["template_language"])
        meta = MetaSkill(
            name=cfg["name"],
            display_name=cfg["display_name"],
            skill_type=cfg["skill_type"],
            model=cfg["model"],
            template_content=template,
            template_language=cfg["template_language"],
        )
        db.add(meta)
        logger.info("ensure_defaults: seeded meta skill '%s'", cfg["name"])

    await db.commit()
