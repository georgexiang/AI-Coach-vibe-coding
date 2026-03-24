"""Tests for rubric_service: CRUD operations and default rubric management."""

import json

import pytest

from app.models.scoring_rubric import ScoringRubric
from app.models.user import User
from app.schemas.scoring_rubric import DimensionConfig, RubricCreate, RubricUpdate
from app.services.auth import get_password_hash
from app.services.rubric_service import (
    create_rubric,
    delete_rubric,
    get_default_rubric,
    get_rubric,
    list_rubrics,
    update_rubric,
)
from app.utils.exceptions import NotFoundException


async def _create_user(db, username="rubric_admin") -> User:
    """Create a test user for rubric ownership."""
    user = User(
        username=username,
        email=f"{username}@test.com",
        hashed_password=get_password_hash("pass"),
        full_name="Test Admin",
        role="admin",
    )
    db.add(user)
    await db.flush()
    return user


def _make_dimensions(count=3) -> list[DimensionConfig]:
    """Create test dimensions that sum to 100 weight."""
    weights = [40, 35, 25] if count == 3 else [50, 50]
    dims = []
    for i in range(count):
        dims.append(
            DimensionConfig(
                name=f"dimension_{i}",
                weight=weights[i],
                criteria=[f"criterion_{i}_a", f"criterion_{i}_b"],
                max_score=100.0,
            )
        )
    return dims


class TestCreateRubric:
    """Tests for create_rubric function."""

    async def test_create_rubric_stores_with_json_dimensions(self, db_session):
        user = await _create_user(db_session)
        dims = _make_dimensions()
        data = RubricCreate(
            name="Test Rubric",
            description="A test rubric",
            scenario_type="f2f",
            dimensions=dims,
            is_default=False,
        )
        rubric = await create_rubric(db_session, data, user.id)

        assert isinstance(rubric, ScoringRubric)
        assert rubric.name == "Test Rubric"
        assert rubric.description == "A test rubric"
        assert rubric.scenario_type == "f2f"
        assert rubric.created_by == user.id

        # Dimensions stored as JSON
        parsed = json.loads(rubric.dimensions)
        assert len(parsed) == 3
        assert parsed[0]["name"] == "dimension_0"
        assert parsed[0]["weight"] == 40

    async def test_create_rubric_with_is_default_unsets_other_defaults(self, db_session):
        user = await _create_user(db_session)
        dims = _make_dimensions()

        # Create first default rubric
        data1 = RubricCreate(
            name="Default 1",
            scenario_type="f2f",
            dimensions=dims,
            is_default=True,
        )
        rubric1 = await create_rubric(db_session, data1, user.id)
        assert rubric1.is_default is True

        # Create second default rubric for same scenario_type
        data2 = RubricCreate(
            name="Default 2",
            scenario_type="f2f",
            dimensions=dims,
            is_default=True,
        )
        rubric2 = await create_rubric(db_session, data2, user.id)
        assert rubric2.is_default is True

        # First rubric should no longer be default
        await db_session.refresh(rubric1)
        assert rubric1.is_default is False


class TestGetRubric:
    """Tests for get_rubric function."""

    async def test_get_rubric_returns_by_id(self, db_session):
        user = await _create_user(db_session)
        data = RubricCreate(
            name="Find Me",
            dimensions=_make_dimensions(),
        )
        created = await create_rubric(db_session, data, user.id)

        found = await get_rubric(db_session, created.id)
        assert found.id == created.id
        assert found.name == "Find Me"

    async def test_get_rubric_raises_for_missing(self, db_session):
        with pytest.raises(NotFoundException):
            await get_rubric(db_session, "nonexistent-id")


class TestListRubrics:
    """Tests for list_rubrics function."""

    async def test_list_rubrics_returns_all(self, db_session):
        user = await _create_user(db_session)
        for name in ["R1", "R2", "R3"]:
            await create_rubric(
                db_session,
                RubricCreate(name=name, dimensions=_make_dimensions()),
                user.id,
            )

        rubrics = await list_rubrics(db_session)
        assert len(rubrics) == 3

    async def test_list_rubrics_filtered_by_scenario_type(self, db_session):
        user = await _create_user(db_session)
        await create_rubric(
            db_session,
            RubricCreate(name="F2F", scenario_type="f2f", dimensions=_make_dimensions()),
            user.id,
        )
        await create_rubric(
            db_session,
            RubricCreate(name="Conf", scenario_type="conference", dimensions=_make_dimensions()),
            user.id,
        )

        f2f_rubrics = await list_rubrics(db_session, scenario_type="f2f")
        assert len(f2f_rubrics) == 1
        assert f2f_rubrics[0].name == "F2F"


class TestUpdateRubric:
    """Tests for update_rubric function."""

    async def test_update_rubric_partial_fields(self, db_session):
        user = await _create_user(db_session)
        created = await create_rubric(
            db_session,
            RubricCreate(name="Original", description="Old desc", dimensions=_make_dimensions()),
            user.id,
        )

        updated = await update_rubric(
            db_session,
            created.id,
            RubricUpdate(name="Updated Name"),
        )
        assert updated.name == "Updated Name"
        assert updated.description == "Old desc"  # unchanged

    async def test_update_rubric_dimensions_reserializes_json(self, db_session):
        user = await _create_user(db_session)
        created = await create_rubric(
            db_session,
            RubricCreate(name="R", dimensions=_make_dimensions(3)),
            user.id,
        )

        new_dims = _make_dimensions(2)
        updated = await update_rubric(
            db_session,
            created.id,
            RubricUpdate(dimensions=new_dims),
        )
        parsed = json.loads(updated.dimensions)
        assert len(parsed) == 2

    async def test_update_rubric_with_is_default_unsets_others(self, db_session):
        user = await _create_user(db_session)
        r1 = await create_rubric(
            db_session,
            RubricCreate(
                name="R1", scenario_type="f2f", dimensions=_make_dimensions(), is_default=True
            ),
            user.id,
        )
        r2 = await create_rubric(
            db_session,
            RubricCreate(name="R2", scenario_type="f2f", dimensions=_make_dimensions()),
            user.id,
        )

        await update_rubric(db_session, r2.id, RubricUpdate(is_default=True))
        await db_session.refresh(r1)
        assert r1.is_default is False


class TestDeleteRubric:
    """Tests for delete_rubric function."""

    async def test_delete_rubric_removes_record(self, db_session):
        user = await _create_user(db_session)
        created = await create_rubric(
            db_session,
            RubricCreate(name="Delete Me", dimensions=_make_dimensions()),
            user.id,
        )

        await delete_rubric(db_session, created.id)

        with pytest.raises(NotFoundException):
            await get_rubric(db_session, created.id)

    async def test_delete_rubric_raises_for_missing(self, db_session):
        with pytest.raises(NotFoundException):
            await delete_rubric(db_session, "nonexistent-id")


class TestGetDefaultRubric:
    """Tests for get_default_rubric function."""

    async def test_returns_default_rubric_for_scenario_type(self, db_session):
        user = await _create_user(db_session)
        await create_rubric(
            db_session,
            RubricCreate(
                name="Default F2F",
                scenario_type="f2f",
                dimensions=_make_dimensions(),
                is_default=True,
            ),
            user.id,
        )
        await create_rubric(
            db_session,
            RubricCreate(
                name="Non-default",
                scenario_type="f2f",
                dimensions=_make_dimensions(),
                is_default=False,
            ),
            user.id,
        )

        rubric = await get_default_rubric(db_session, "f2f")
        assert rubric is not None
        assert rubric.name == "Default F2F"

    async def test_returns_none_when_no_default(self, db_session):
        rubric = await get_default_rubric(db_session, "f2f")
        assert rubric is None
