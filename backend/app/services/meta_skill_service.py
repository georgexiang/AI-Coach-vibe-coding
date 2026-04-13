"""Meta Skill configuration service — CRUD + Azure Agent sync.

Manages the creator and evaluator meta-skill agents. Reuses the same
agent_sync_service functions (create_agent, update_agent) used by HCP profiles.
"""

import io
import logging
import zipfile
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

    Reads SKILL.md (or SKILL_zh.md for Chinese) **preserving the YAML
    frontmatter** per the MS Agent Framework skill spec, then appends all
    reference file contents.
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

    # Preserve original SKILL.md content (including YAML frontmatter)
    skill_content = skill_file.read_text(encoding="utf-8").strip()

    # Read reference files
    refs_dir = skill_dir / "references"
    references: dict[str, str] = {}
    if refs_dir.is_dir():
        for ref_file in sorted(refs_dir.iterdir()):
            if ref_file.suffix in _REFERENCE_EXTENSIONS and ref_file.is_file():
                references[ref_file.name] = ref_file.read_text(encoding="utf-8")

    # Compose: SKILL.md verbatim + reference materials
    parts: list[str] = [skill_content]

    if references:
        parts.append("\n---\n\n## Reference Materials\n")
        for filename, content in references.items():
            parts.append(f"### {filename}\n\n{content}")

    composed = "\n\n".join(parts)
    token_estimate = len(composed) // 4
    if token_estimate > 30000:
        logger.warning(
            "Composed instructions for '%s' are very large: ~%d tokens",
            skill_type,
            token_estimate,
        )

    return composed


_CONTENT_TYPE_MAP: dict[str, str] = {
    ".md": "text/markdown",
    ".json": "application/json",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".csv": "text/csv",
    ".xml": "application/xml",
    ".txt": "text/plain",
    ".py": "text/x-python",
    ".js": "application/javascript",
    ".sh": "text/x-shellscript",
}

_SCRIPT_EXTENSIONS = {".py", ".js", ".sh", ".ps1", ".cs", ".csx"}


def _safe_filename(filename: str) -> bool:
    """Validate that a filename is safe (no path traversal)."""
    return (
        bool(filename)
        and "/" not in filename
        and "\\" not in filename
        and ".." not in filename
        and filename == Path(filename).name
    )


def list_meta_skill_resources(skill_type: str) -> list[dict]:
    """Enumerate reference and script files for a meta-skill type.

    Returns a list of dicts compatible with MetaSkillResourceOut schema.
    """
    dir_name = _SKILL_DIR_MAP.get(skill_type)
    if not dir_name:
        return []

    skill_dir = _TEMPLATE_DIR / dir_name
    if not skill_dir.is_dir():
        return []

    resources: list[dict] = []

    for sub, rtype in [("references", "reference"), ("scripts", "script")]:
        sub_dir = skill_dir / sub
        if not sub_dir.is_dir():
            continue
        allowed_ext = _REFERENCE_EXTENSIONS if rtype == "reference" else _SCRIPT_EXTENSIONS
        for f in sorted(sub_dir.iterdir()):
            if not f.is_file() or f.suffix not in allowed_ext:
                continue
            stat = f.stat()
            mtime = datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat()
            resources.append(
                {
                    "id": f"{rtype[:3]}__{f.name}",
                    "resource_type": rtype,
                    "filename": f.name,
                    "content_type": _CONTENT_TYPE_MAP.get(f.suffix, "application/octet-stream"),
                    "file_size": stat.st_size,
                    "created_at": mtime,
                    "updated_at": mtime,
                }
            )

    return resources


def get_meta_skill_resource_content(
    skill_type: str,
    resource_type: str,
    filename: str,
) -> tuple[str, bytes] | None:
    """Read a specific resource file from disk.

    Returns (content_type, file_bytes) or None if not found.
    Validates filename to prevent path traversal.
    """
    if resource_type not in ("reference", "script"):
        return None
    if not _safe_filename(filename):
        return None

    dir_name = _SKILL_DIR_MAP.get(skill_type)
    if not dir_name:
        return None

    sub = "references" if resource_type == "reference" else "scripts"
    file_path = _TEMPLATE_DIR / dir_name / sub / filename

    # Verify resolved path is still within the expected directory
    try:
        file_path.resolve().relative_to((_TEMPLATE_DIR / dir_name / sub).resolve())
    except ValueError:
        return None

    if not file_path.is_file():
        return None

    content_type = _CONTENT_TYPE_MAP.get(file_path.suffix, "application/octet-stream")
    return content_type, file_path.read_bytes()


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


def export_meta_skill_zip(skill_type: str) -> tuple[str, bytes] | None:
    """Export a meta-skill directory as a ZIP archive.

    Returns (zip_filename, zip_bytes) or None if the skill type is unknown.
    ZIP structure mirrors the on-disk layout:
        SKILL.md
        references/<files>
        scripts/<files>
    """
    dir_name = _SKILL_DIR_MAP.get(skill_type)
    if not dir_name:
        return None

    skill_dir = _TEMPLATE_DIR / dir_name
    if not skill_dir.is_dir():
        return None

    buf = io.BytesIO()
    file_count = 0
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        # Add SKILL.md at root
        skill_md = skill_dir / "SKILL.md"
        if skill_md.is_file():
            zf.writestr("SKILL.md", skill_md.read_bytes())
            file_count += 1

        # Add language variants (e.g. SKILL_zh.md)
        for variant in sorted(skill_dir.glob("SKILL_*.md")):
            if variant.is_file():
                zf.writestr(variant.name, variant.read_bytes())
                file_count += 1

        # Add references/ and scripts/ subdirectories
        for sub_name in ("references", "scripts"):
            sub_dir = skill_dir / sub_name
            if not sub_dir.is_dir():
                continue
            allowed_ext = _REFERENCE_EXTENSIONS if sub_name == "references" else _SCRIPT_EXTENSIONS
            for f in sorted(sub_dir.iterdir()):
                if not f.is_file() or f.suffix not in allowed_ext:
                    continue
                arc_path = f"{sub_name}/{f.name}"
                zf.writestr(arc_path, f.read_bytes())
                file_count += 1

    if file_count == 0:
        return None

    zip_filename = f"{dir_name}.zip"
    logger.info(
        "Exported meta-skill '%s' as ZIP (%d files, %d bytes)",
        skill_type,
        file_count,
        buf.tell(),
    )
    return zip_filename, buf.getvalue()


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

    # Migrate legacy underscore names → hyphen format
    for row in existing_rows:
        if "_" in row.name:
            old_name = row.name
            row.name = row.name.replace("_", "-")
            logger.info("ensure_defaults: migrated name '%s' → '%s'", old_name, row.name)

    # Build lookup for existing rows by skill_type
    existing_by_type = {row.skill_type: row for row in existing_rows}

    for cfg in _DEFAULT_CONFIGS:
        template = _load_default_template(cfg["skill_type"], cfg["template_language"])
        row = existing_by_type.get(cfg["skill_type"])
        if row is not None:
            # Update existing row if template content changed (e.g. references added)
            if row.template_content != template:
                row.template_content = template
                logger.info(
                    "ensure_defaults: updated template for '%s' (content changed on disk)",
                    cfg["name"],
                )
        else:
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
