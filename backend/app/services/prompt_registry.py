"""Prompt registry resolver + idempotent seed.

``get_prompt`` returns the active DB version content for a key, falling back to the
seeded default from :mod:`app.services.prompt_defaults`. ``seed_prompt_registry``
registers every default key as version 1 exactly once.
"""

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prompt_template import PromptTemplate
from app.models.prompt_version import PromptVersion
from app.services.prompt_defaults import PROMPT_DEFAULTS

__all__ = ["get_prompt", "seed_prompt_registry"]


async def get_prompt(db: AsyncSession, key: str) -> str:
    """Return the active version content for ``key``, else the seeded default.

    Raises ``KeyError`` if the key is neither registered nor a known default.
    """
    result = await db.execute(select(PromptTemplate).where(PromptTemplate.key == key))
    template = result.scalar_one_or_none()
    if template is not None and template.active_version_id:
        version_result = await db.execute(
            select(PromptVersion).where(PromptVersion.id == template.active_version_id)
        )
        version = version_result.scalar_one_or_none()
        if version is not None:
            return version.content

    default = PROMPT_DEFAULTS.get(key)
    if default is None:
        raise KeyError(f"Unknown prompt key: {key}")
    return default["content"]


async def seed_prompt_registry(db: AsyncSession) -> int:
    """Idempotently register every default prompt as version 1.

    Creates a :class:`PromptTemplate` plus an active version 1 (``source=seed``) for
    any key not already present. Never modifies existing templates. Returns the number
    of newly created templates.
    """
    created = 0
    for key, spec in PROMPT_DEFAULTS.items():
        existing = await db.execute(select(PromptTemplate).where(PromptTemplate.key == key))
        if existing.scalar_one_or_none() is not None:
            continue

        template = PromptTemplate(
            key=key,
            name=spec.get("name", key),
            category=spec.get("category", "general"),
            description=spec.get("description", ""),
            variables=json.dumps(spec.get("variables", [])),
            is_system=True,
        )
        db.add(template)
        await db.flush()

        version = PromptVersion(
            template_id=template.id,
            version_no=1,
            content=spec["content"],
            source="seed",
            is_active=True,
            created_by=None,
        )
        db.add(version)
        await db.flush()

        template.active_version_id = version.id
        created += 1

    if created:
        await db.commit()
    return created
