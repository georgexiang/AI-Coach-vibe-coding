"""Unit tests for the prompt registry: seed, idempotency, resolver, fallback, snapshots."""

import json

import pytest
from sqlalchemy import func, select

from app.models.prompt_template import PromptTemplate
from app.models.prompt_version import PromptVersion
from app.services.prompt_defaults import PROMPT_DEFAULTS, PROMPT_KEYS
from app.services.prompt_registry import get_prompt, seed_prompt_registry
from app.services.scoring_engine import SCORING_PROMPT_TEMPLATE


@pytest.fixture
async def session(db_session):
    return db_session


async def test_seed_creates_all_nine_templates(session):
    created = await seed_prompt_registry(session)
    assert created == 9

    template_count = await session.scalar(select(func.count()).select_from(PromptTemplate))
    assert template_count == 9

    # Every template has exactly one active version_no=1
    for key in PROMPT_KEYS:
        template = (
            await session.execute(select(PromptTemplate).where(PromptTemplate.key == key))
        ).scalar_one()
        assert template.active_version_id is not None
        assert template.is_system is True

        versions = (
            (
                await session.execute(
                    select(PromptVersion).where(PromptVersion.template_id == template.id)
                )
            )
            .scalars()
            .all()
        )
        assert len(versions) == 1
        assert versions[0].version_no == 1
        assert versions[0].source == "seed"
        assert versions[0].is_active is True
        assert versions[0].id == template.active_version_id


async def test_seed_is_idempotent(session):
    first = await seed_prompt_registry(session)
    assert first == 9
    second = await seed_prompt_registry(session)
    assert second == 0

    template_count = await session.scalar(select(func.count()).select_from(PromptTemplate))
    version_count = await session.scalar(select(func.count()).select_from(PromptVersion))
    assert template_count == 9
    assert version_count == 9


async def test_seed_stores_variables_as_json_list(session):
    await seed_prompt_registry(session)
    template = (
        await session.execute(select(PromptTemplate).where(PromptTemplate.key == "scoring.base"))
    ).scalar_one()
    variables = json.loads(template.variables)
    assert isinstance(variables, list)
    assert "transcript" in variables


async def test_get_prompt_returns_default_when_no_db_row(session):
    # No seeding performed: resolver falls back to PROMPT_DEFAULTS
    content = await get_prompt(session, "scoring.base")
    assert content == SCORING_PROMPT_TEMPLATE


async def test_get_prompt_returns_default_after_seed(session):
    await seed_prompt_registry(session)
    content = await get_prompt(session, "hcp.system")
    assert content == PROMPT_DEFAULTS["hcp.system"]["content"]


async def test_get_prompt_returns_active_override_version(session):
    await seed_prompt_registry(session)
    template = (
        await session.execute(select(PromptTemplate).where(PromptTemplate.key == "scoring.base"))
    ).scalar_one()

    # Deactivate the seed version, add an active override version 2
    seed_version = (
        await session.execute(
            select(PromptVersion).where(PromptVersion.id == template.active_version_id)
        )
    ).scalar_one()
    seed_version.is_active = False

    override = PromptVersion(
        template_id=template.id,
        version_no=2,
        content="OVERRIDDEN SCORING PROMPT",
        source="manual",
        is_active=True,
    )
    session.add(override)
    await session.flush()
    template.active_version_id = override.id
    await session.commit()

    content = await get_prompt(session, "scoring.base")
    assert content == "OVERRIDDEN SCORING PROMPT"


async def test_get_prompt_unknown_key_raises(session):
    with pytest.raises(KeyError):
        await get_prompt(session, "does.not.exist")


async def test_default_content_matches_original_hardcoded_strings(session):
    # scoring.base is a real module constant -- snapshot equality guards against drift.
    assert PROMPT_DEFAULTS["scoring.base"]["content"] == SCORING_PROMPT_TEMPLATE

    # hcp.system has no single source constant; assert its stable canonical skeleton.
    hcp_content = PROMPT_DEFAULTS["hcp.system"]["content"]
    assert hcp_content.startswith("# HCP Identity")
    assert "# Personality & Communication" in hcp_content

    # Round-trip: seeded content is byte-identical to the default catalog.
    await seed_prompt_registry(session)
    for key in PROMPT_KEYS:
        assert await get_prompt(session, key) == PROMPT_DEFAULTS[key]["content"]
