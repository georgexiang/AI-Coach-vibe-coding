"""Tests for HCP profile service: CRUD operations."""

import json

import pytest

from app.models.hcp_profile import HcpProfile
from app.models.user import User
from app.schemas.hcp_profile import HcpProfileCreate, HcpProfileUpdate
from app.services.auth import get_password_hash
from app.services.hcp_profile_service import (
    create_hcp_profile,
    delete_hcp_profile,
    get_hcp_profile,
    get_hcp_profiles,
    update_hcp_profile,
)
from app.utils.exceptions import NotFoundException


async def _seed_user(db) -> str:
    """Create a test user and return user_id."""
    user = User(
        username="hcpuser",
        email="hcp@test.com",
        hashed_password=get_password_hash("pass"),
        full_name="HCP User",
        role="admin",
    )
    db.add(user)
    await db.flush()
    return user.id


class TestCreateHcpProfile:
    """Tests for create_hcp_profile."""

    async def test_creates_profile_with_required_fields(self, db_session):
        user_id = await _seed_user(db_session)
        data = HcpProfileCreate(
            name="Dr. Zhang",
            specialty="Oncology",
            created_by=user_id,
        )
        profile = await create_hcp_profile(db_session, data, user_id)

        assert profile.name == "Dr. Zhang"
        assert profile.specialty == "Oncology"
        assert profile.created_by == user_id
        assert profile.id is not None

    async def test_serializes_list_fields_to_json(self, db_session):
        user_id = await _seed_user(db_session)
        data = HcpProfileCreate(
            name="Dr. Li",
            specialty="Cardiology",
            created_by=user_id,
            expertise_areas=["interventional", "heart failure"],
            objections=["Cost concerns"],
            probe_topics=["Long-term data"],
        )
        profile = await create_hcp_profile(db_session, data, user_id)

        # In DB, list fields are stored as JSON strings
        assert json.loads(profile.expertise_areas) == ["interventional", "heart failure"]
        assert json.loads(profile.objections) == ["Cost concerns"]
        assert json.loads(profile.probe_topics) == ["Long-term data"]

    async def test_defaults_are_applied(self, db_session):
        user_id = await _seed_user(db_session)
        data = HcpProfileCreate(
            name="Dr. A",
            specialty="Derm",
            created_by=user_id,
        )
        profile = await create_hcp_profile(db_session, data, user_id)

        assert profile.personality_type == "friendly"
        assert profile.emotional_state == 50
        assert profile.communication_style == 50
        assert profile.is_active is True


class TestGetHcpProfiles:
    """Tests for get_hcp_profiles (list with search/filter)."""

    async def test_returns_all_profiles(self, db_session):
        user_id = await _seed_user(db_session)
        for name in ["Dr. Zhang", "Dr. Li"]:
            data = HcpProfileCreate(name=name, specialty="Oncology", created_by=user_id)
            await create_hcp_profile(db_session, data, user_id)

        profiles, total = await get_hcp_profiles(db_session)
        assert total == 2
        assert len(profiles) == 2

    async def test_search_by_name(self, db_session):
        user_id = await _seed_user(db_session)
        await create_hcp_profile(
            db_session,
            HcpProfileCreate(name="Dr. Zhang", specialty="Oncology", created_by=user_id),
            user_id,
        )
        await create_hcp_profile(
            db_session,
            HcpProfileCreate(name="Dr. Li", specialty="Cardiology", created_by=user_id),
            user_id,
        )

        profiles, total = await get_hcp_profiles(db_session, search="Zhang")
        assert total == 1
        assert profiles[0].name == "Dr. Zhang"

    async def test_filter_by_is_active(self, db_session):
        user_id = await _seed_user(db_session)
        await create_hcp_profile(
            db_session,
            HcpProfileCreate(
                name="Active", specialty="Onc", created_by=user_id, is_active=True
            ),
            user_id,
        )
        await create_hcp_profile(
            db_session,
            HcpProfileCreate(
                name="Inactive", specialty="Onc", created_by=user_id, is_active=False
            ),
            user_id,
        )

        profiles, total = await get_hcp_profiles(db_session, is_active=True)
        assert total == 1
        assert profiles[0].name == "Active"


class TestGetHcpProfile:
    """Tests for get_hcp_profile (single by ID)."""

    async def test_returns_profile_by_id(self, db_session):
        user_id = await _seed_user(db_session)
        data = HcpProfileCreate(name="Dr. X", specialty="Neuro", created_by=user_id)
        created = await create_hcp_profile(db_session, data, user_id)

        fetched = await get_hcp_profile(db_session, created.id)
        assert fetched.name == "Dr. X"

    async def test_raises_not_found(self, db_session):
        with pytest.raises(NotFoundException):
            await get_hcp_profile(db_session, "nonexistent-id")


class TestUpdateHcpProfile:
    """Tests for update_hcp_profile."""

    async def test_updates_partial_fields(self, db_session):
        user_id = await _seed_user(db_session)
        data = HcpProfileCreate(name="Dr. Old", specialty="Onc", created_by=user_id)
        profile = await create_hcp_profile(db_session, data, user_id)

        update = HcpProfileUpdate(name="Dr. New", personality_type="skeptical")
        updated = await update_hcp_profile(db_session, profile.id, update)

        assert updated.name == "Dr. New"
        assert updated.personality_type == "skeptical"
        assert updated.specialty == "Onc"  # unchanged

    async def test_updates_list_fields(self, db_session):
        user_id = await _seed_user(db_session)
        data = HcpProfileCreate(name="Dr. Y", specialty="Onc", created_by=user_id)
        profile = await create_hcp_profile(db_session, data, user_id)

        update = HcpProfileUpdate(expertise_areas=["new_area_1", "new_area_2"])
        updated = await update_hcp_profile(db_session, profile.id, update)

        assert json.loads(updated.expertise_areas) == ["new_area_1", "new_area_2"]


class TestDeleteHcpProfile:
    """Tests for delete_hcp_profile."""

    async def test_deletes_existing_profile(self, db_session):
        user_id = await _seed_user(db_session)
        data = HcpProfileCreate(name="Dr. Del", specialty="Onc", created_by=user_id)
        profile = await create_hcp_profile(db_session, data, user_id)

        await delete_hcp_profile(db_session, profile.id)

        with pytest.raises(NotFoundException):
            await get_hcp_profile(db_session, profile.id)

    async def test_raises_for_nonexistent(self, db_session):
        with pytest.raises(NotFoundException):
            await delete_hcp_profile(db_session, "nonexistent")
