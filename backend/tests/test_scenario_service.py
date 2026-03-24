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
            product="Brukinsa",
            hcp_profile_id=hcp_id,
            created_by=user_id,
        )
        scenario = await create_scenario(db_session, data, user_id)

        assert scenario.name == "Test Scenario"
        assert scenario.product == "Brukinsa"
        assert scenario.hcp_profile_id == hcp_id
        assert scenario.created_by == user_id
        assert scenario.id is not None

    async def test_serializes_key_messages(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="S",
            product="Drug",
            hcp_profile_id=hcp_id,
            created_by=user_id,
            key_messages=["Key msg 1", "Key msg 2"],
        )
        scenario = await create_scenario(db_session, data, user_id)

        assert json.loads(scenario.key_messages) == ["Key msg 1", "Key msg 2"]

    async def test_raises_for_nonexistent_hcp_profile(self, db_session):
        user_id, _ = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="S",
            product="Drug",
            hcp_profile_id="nonexistent-hcp",
            created_by=user_id,
        )
        with pytest.raises(NotFoundException):
            await create_scenario(db_session, data, user_id)

    async def test_applies_default_weights(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="S",
            product="Drug",
            hcp_profile_id=hcp_id,
            created_by=user_id,
        )
        scenario = await create_scenario(db_session, data, user_id)

        assert scenario.weight_key_message == 30
        assert scenario.weight_objection_handling == 25
        assert scenario.weight_communication == 20
        assert scenario.weight_product_knowledge == 15
        assert scenario.weight_scientific_info == 10
        assert scenario.pass_threshold == 70


class TestGetScenarios:
    """Tests for get_scenarios (list with filters)."""

    async def test_returns_all_scenarios(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        for name in ["S1", "S2"]:
            data = ScenarioCreate(
                name=name,
                product="Drug",
                hcp_profile_id=hcp_id,
                created_by=user_id,
            )
            await create_scenario(db_session, data, user_id)

        scenarios, total = await get_scenarios(db_session)
        assert total == 2
        assert len(scenarios) == 2

    async def test_filters_by_status(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data_draft = ScenarioCreate(
            name="Draft",
            product="Drug",
            hcp_profile_id=hcp_id,
            created_by=user_id,
            status="draft",
        )
        data_active = ScenarioCreate(
            name="Active",
            product="Drug",
            hcp_profile_id=hcp_id,
            created_by=user_id,
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
                product="Drug",
                hcp_profile_id=hcp_id,
                created_by=user_id,
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
                name="Brukinsa F2F", product="Brukinsa", hcp_profile_id=hcp_id, created_by=user_id
            ),
            user_id,
        )
        await create_scenario(
            db_session,
            ScenarioCreate(
                name="Other", product="Other", hcp_profile_id=hcp_id, created_by=user_id
            ),
            user_id,
        )

        scenarios, total = await get_scenarios(db_session, search="Brukinsa")
        assert total == 1


class TestGetScenario:
    """Tests for get_scenario (single by ID)."""

    async def test_returns_scenario_by_id(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="Single",
            product="Drug",
            hcp_profile_id=hcp_id,
            created_by=user_id,
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
            product="Drug",
            hcp_profile_id=hcp_id,
            created_by=user_id,
        )
        scenario = await create_scenario(db_session, data, user_id)

        update = ScenarioUpdate(name="New Name", status="active")
        updated = await update_scenario(db_session, scenario.id, update)

        assert updated.name == "New Name"
        assert updated.status == "active"
        assert updated.product == "Drug"  # unchanged

    async def test_updates_key_messages(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="S",
            product="Drug",
            hcp_profile_id=hcp_id,
            created_by=user_id,
        )
        scenario = await create_scenario(db_session, data, user_id)

        update = ScenarioUpdate(key_messages=["New KM 1", "New KM 2"])
        updated = await update_scenario(db_session, scenario.id, update)
        assert json.loads(updated.key_messages) == ["New KM 1", "New KM 2"]

    async def test_validates_new_hcp_profile_exists(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="S",
            product="Drug",
            hcp_profile_id=hcp_id,
            created_by=user_id,
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
            product="Drug",
            hcp_profile_id=hcp_id,
            created_by=user_id,
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
            product="Brukinsa",
            hcp_profile_id=hcp_id,
            created_by=user_id,
            key_messages=["KM 1"],
        )
        original = await create_scenario(db_session, data, user_id)

        clone = await clone_scenario(db_session, original.id, user_id)

        assert clone.name == "Original (Copy)"
        assert clone.id != original.id
        assert clone.product == "Brukinsa"
        assert clone.status == "draft"
        assert clone.hcp_profile_id == hcp_id

    async def test_clone_preserves_weights(self, db_session):
        user_id, hcp_id = await _seed_user_and_hcp(db_session)
        data = ScenarioCreate(
            name="Weighted",
            product="Drug",
            hcp_profile_id=hcp_id,
            created_by=user_id,
            weight_key_message=40,
            weight_objection_handling=20,
            weight_communication=20,
            weight_product_knowledge=10,
            weight_scientific_info=10,
        )
        original = await create_scenario(db_session, data, user_id)
        clone = await clone_scenario(db_session, original.id, user_id)

        assert clone.weight_key_message == 40
        assert clone.weight_objection_handling == 20

    async def test_clone_raises_for_nonexistent(self, db_session):
        with pytest.raises(NotFoundException):
            await clone_scenario(db_session, "nonexistent", "user")
