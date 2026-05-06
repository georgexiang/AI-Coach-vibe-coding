"""Tests for the scenario service: CRUD operations and scenario cloning."""

import json

import pytest

from app.models.hcp_profile import HcpProfile
from app.models.user import User
from app.schemas.scenario import ScenarioCreate, ScenarioUpdate
from app.services.auth import get_password_hash
from app.services.scenario_service import (
    clone_scenario,
    create_scenario,
    delete_scenario,
    get_scenario,
    get_scenarios,
    update_scenario,
)
from app.utils.exceptions import NotFoundException


async def _seed_user_and_hcp(db) -> tuple[str, str]:
    """Create a user and HCP profile. Returns (user_id, hcp_profile_id)."""
    user = User(
        username="scnuser",
        email="scn@test.com",
        hashed_password=get_password_hash("pass"),
        full_name="Scenario User",
        role="admin",
    )
    db.add(user)
    await db.flush()

    hcp = HcpProfile(
        name="Dr. Test",
        specialty="Oncology",
        created_by=user.id,
    )
    db.add(hcp)
    await db.flush()

    return user.id, hcp.id


class TestCreateScenario:
    """Tests for create_scenario."""

    async def test_creates_scenario_with_required_fields(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="Test Scenario",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
            tags=["product:Brukinsa", "therapeutic_area:Oncology"],
        )
        scenario = await create_scenario(db_session, data, user_id)

        assert scenario.name == "Test Scenario"
        assert scenario.hcp_profile_id == hcp_id
        assert scenario.created_by == user_id
        assert scenario.id is not None

    async def test_serializes_key_messages(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="S",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
            key_messages=["Key msg 1", "Key msg 2"],
        )
        scenario = await create_scenario(db_session, data, user_id)

        assert json.loads(scenario.key_messages) == ["Key msg 1", "Key msg 2"]

    async def test_serializes_tags(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="S",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
            tags=["product:Brukinsa", "therapeutic_area:Oncology"],
        )
        scenario = await create_scenario(db_session, data, user_id)

        assert json.loads(scenario.tags) == [
            "product:Brukinsa",
            "therapeutic_area:Oncology",
        ]

    async def test_tags_defaults_to_empty_list(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="S",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
        )
        scenario = await create_scenario(db_session, data, user_id)

        assert json.loads(scenario.tags) == []

    async def test_raises_for_nonexistent_hcp_profile(self, db_session):
        user_id, _ = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="S",
            hcp_profile_id="nonexistent-hcp",
            rubric_id="test-rubric-id",
        )
        with pytest.raises(NotFoundException):
            await create_scenario(db_session, data, user_id)

    async def test_applies_rubric_id_and_defaults(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="S",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
        )
        scenario = await create_scenario(db_session, data, user_id)

        assert scenario.rubric_id == "test-rubric-id"
        assert scenario.pass_threshold == 70


class TestGetScenarios:
    """Tests for get_scenarios (list with filters)."""

    async def test_returns_all_scenarios(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        for name in ["S1", "S2"]:
            data = ScenarioCreate(
                name=name,
                hcp_profile_id=hcp_id,
                rubric_id="test-rubric-id",
            )
            await create_scenario(db_session, data, user_id)

        scenarios, total = await get_scenarios(db_session)
        assert total == 2
        assert len(scenarios) == 2

    async def test_filters_by_status(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data_draft = ScenarioCreate(
            name="Draft",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
            status="draft",
        )
        data_active = ScenarioCreate(
            name="Active",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
            status="active",
        )
        await create_scenario(db_session, data_draft, user_id)
        await create_scenario(db_session, data_active, user_id)

        scenarios, total = await get_scenarios(db_session, status="active")
        assert total == 1
        assert scenarios[0].name == "Active"

    async def test_filters_by_mode(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        for mode in ["f2f", "conference"]:
            data = ScenarioCreate(
                name=f"Mode {mode}",
                hcp_profile_id=hcp_id,
                rubric_id="test-rubric-id",
                mode=mode,
            )
            await create_scenario(db_session, data, user_id)

        scenarios, total = await get_scenarios(db_session, mode="conference")
        assert total == 1
        assert scenarios[0].mode == "conference"

    async def test_search_by_name(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        await create_scenario(
            db_session,
            ScenarioCreate(
                name="Brukinsa F2F",
                hcp_profile_id=hcp_id,
                rubric_id="test-rubric-id",
            ),
            user_id,
        )
        await create_scenario(
            db_session,
            ScenarioCreate(
                name="Other",
                hcp_profile_id=hcp_id,
                rubric_id="test-rubric-id",
            ),
            user_id,
        )

        scenarios, total = await get_scenarios(db_session, search="Brukinsa")
        assert total == 1

    async def test_filters_by_tag(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        await create_scenario(
            db_session,
            ScenarioCreate(
                name="Tagged",
                hcp_profile_id=hcp_id,
                rubric_id="test-rubric-id",
                tags=["product:Brukinsa", "therapeutic_area:Oncology"],
            ),
            user_id,
        )
        await create_scenario(
            db_session,
            ScenarioCreate(
                name="Other",
                hcp_profile_id=hcp_id,
                rubric_id="test-rubric-id",
                tags=["product:Tislelizumab"],
            ),
            user_id,
        )

        scenarios, total = await get_scenarios(db_session, tag="product:Brukinsa")
        assert total == 1
        assert scenarios[0].name == "Tagged"

    async def test_tag_filter_no_match(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        await create_scenario(
            db_session,
            ScenarioCreate(
                name="S1",
                hcp_profile_id=hcp_id,
                rubric_id="test-rubric-id",
                tags=["product:Brukinsa"],
            ),
            user_id,
        )

        scenarios, total = await get_scenarios(db_session, tag="product:NonExistent")
        assert total == 0


class TestGetScenario:
    """Tests for get_scenario (single by ID)."""

    async def test_returns_scenario_by_id(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="Single",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
        )
        created = await create_scenario(db_session, data, user_id)
        fetched = await get_scenario(db_session, created.id)
        assert fetched.name == "Single"

    async def test_raises_not_found(self, db_session):
        with pytest.raises(NotFoundException):
            await get_scenario(db_session, "nonexistent-id")


class TestUpdateScenario:
    """Tests for update_scenario."""

    async def test_updates_partial_fields(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="Old Name",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
        )
        scenario = await create_scenario(db_session, data, user_id)

        update = ScenarioUpdate(name="New Name", status="active")
        updated = await update_scenario(db_session, scenario.id, update)

        assert updated.name == "New Name"
        assert updated.status == "active"

    async def test_updates_key_messages(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="S",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
        )
        scenario = await create_scenario(db_session, data, user_id)

        update = ScenarioUpdate(key_messages=["New KM 1", "New KM 2"])
        updated = await update_scenario(db_session, scenario.id, update)
        assert json.loads(updated.key_messages) == ["New KM 1", "New KM 2"]

    async def test_updates_tags(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="S",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
            tags=["product:Old"],
        )
        scenario = await create_scenario(db_session, data, user_id)

        update = ScenarioUpdate(tags=["product:New", "therapeutic_area:Hematology"])
        updated = await update_scenario(db_session, scenario.id, update)
        assert json.loads(updated.tags) == ["product:New", "therapeutic_area:Hematology"]

    async def test_validates_new_hcp_profile_exists(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="S",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
        )
        scenario = await create_scenario(db_session, data, user_id)

        update = ScenarioUpdate(hcp_profile_id="nonexistent")
        with pytest.raises(NotFoundException):
            await update_scenario(db_session, scenario.id, update)


class TestDeleteScenario:
    """Tests for delete_scenario."""

    async def test_deletes_existing_scenario(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="Del",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
        )
        scenario = await create_scenario(db_session, data, user_id)
        await delete_scenario(db_session, scenario.id)

        with pytest.raises(NotFoundException):
            await get_scenario(db_session, scenario.id)

    async def test_raises_for_nonexistent(self, db_session):
        with pytest.raises(NotFoundException):
            await delete_scenario(db_session, "nonexistent")


class TestCloneScenario:
    """Tests for clone_scenario."""

    async def test_clones_with_copy_suffix(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="Original",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
            tags=["product:Brukinsa", "therapeutic_area:Oncology"],
            key_messages=["KM 1"],
        )
        original = await create_scenario(db_session, data, user_id)

        clone = await clone_scenario(db_session, original.id, user_id)

        assert clone.name == "Original (Copy)"
        assert clone.id != original.id
        assert json.loads(clone.tags) == ["product:Brukinsa", "therapeutic_area:Oncology"]
        assert clone.status == "draft"
        assert clone.hcp_profile_id == hcp_id

    async def test_clone_preserves_rubric_id(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="With Rubric",
            hcp_profile_id=hcp_id,
            rubric_id="test-rubric-id",
        )
        original = await create_scenario(db_session, data, user_id)
        clone = await clone_scenario(db_session, original.id, user_id)

        assert clone.rubric_id == "test-rubric-id"

    async def test_clone_raises_for_nonexistent(self, db_session):
        with pytest.raises(NotFoundException):
            await clone_scenario(db_session, "nonexistent", "user")
