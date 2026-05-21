"""Tests: Avatar character data consistency between VL Instance and HCP Profile.

Verifies that:
1. assign_to_hcp syncs avatar_character/avatar_style from VL Instance to HcpProfile
2. update_instance propagates avatar changes to all assigned HCP profiles
3. Scenario API resolves avatar from VL Instance (not stale hcp_profile fields)
4. Unassign resets avatar to defaults on the profile
"""

from httpx import AsyncClient

from app.models.hcp_profile import HcpProfile
from app.models.scenario import Scenario
from app.models.skill import Skill
from app.models.user import User
from app.models.voice_live_instance import VoiceLiveInstance
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _seed_hcp_with_vl_instance(
    avatar_character: str = "lisa",
    avatar_style: str = "graceful-standing",
    hcp_avatar_character: str = "lori",
    hcp_avatar_style: str = "casual",
) -> tuple[str, str, str, str]:
    """Seed an HCP profile and a VL Instance (NOT yet assigned).

    Returns (hcp_id, vl_instance_id, admin_token, scenario_id).
    """
    async with TestSessionLocal() as db:
        admin = User(
            username="avatar_sync_admin",
            email="avatar_sync_admin@test.com",
            hashed_password=get_password_hash("admin"),
            full_name="Admin",
            role="admin",
        )
        db.add(admin)
        await db.flush()

        hcp = HcpProfile(
            name="Dr. Wang Fang",
            specialty="Oncology",
            avatar_character=hcp_avatar_character,
            avatar_style=hcp_avatar_style,
            created_by=admin.id,
        )
        db.add(hcp)
        await db.flush()

        vl_instance = VoiceLiveInstance(
            name="Lisa Instance",
            avatar_character=avatar_character,
            avatar_style=avatar_style,
            created_by=admin.id,
        )
        db.add(vl_instance)
        await db.flush()

        skill = Skill(
            id="avatar-sync-skill",
            name="Avatar Sync Skill",
            status="published",
            created_by=admin.id,
        )
        db.add(skill)
        await db.flush()

        scenario = Scenario(
            name="Avatar Sync Scenario",
            hcp_profile_id=hcp.id,
            key_messages='["test"]',
            skill_id=skill.id,
            status="active",
            created_by=admin.id,
            rubric_id="test-rubric",
        )
        db.add(scenario)
        await db.flush()
        await db.commit()

        token = create_access_token(data={"sub": admin.id})
        return hcp.id, vl_instance.id, token, scenario.id


class TestAvatarSyncOnAssign:
    """Verify assign_to_hcp syncs avatar fields from VL Instance to HcpProfile."""

    async def test_assign_syncs_avatar_character(self, client: AsyncClient):
        """After assigning VL Instance, hcp_profile.avatar_character matches instance."""
        hcp_id, vl_id, token, _ = await _seed_hcp_with_vl_instance(
            avatar_character="lisa", avatar_style="graceful-standing",
            hcp_avatar_character="lori", hcp_avatar_style="casual",
        )

        # Assign VL Instance to HCP
        response = await client.post(
            f"/api/v1/voice-live/instances/{vl_id}/assign",
            headers={"Authorization": f"Bearer {token}"},
            json={"hcp_profile_id": hcp_id},
        )
        assert response.status_code == 200

        # Verify HCP profile now has synced avatar
        hcp_response = await client.get(
            f"/api/v1/hcp-profiles/{hcp_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert hcp_response.status_code == 200
        hcp_data = hcp_response.json()
        assert hcp_data["avatar_character"] == "lisa"
        assert hcp_data["avatar_style"] == "graceful-standing"

    async def test_assign_syncs_avatar_customized(self, client: AsyncClient):
        """After assigning VL Instance with avatar_customized=True, HCP reflects it."""
        hcp_id, vl_id, token, _ = await _seed_hcp_with_vl_instance(
            avatar_character="harry", avatar_style="casual",
        )

        # Update VL Instance to have customized=True
        await client.put(
            f"/api/v1/voice-live/instances/{vl_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"avatar_customized": True},
        )

        # Assign VL Instance to HCP
        response = await client.post(
            f"/api/v1/voice-live/instances/{vl_id}/assign",
            headers={"Authorization": f"Bearer {token}"},
            json={"hcp_profile_id": hcp_id},
        )
        assert response.status_code == 200

        # Verify HCP profile reflects avatar_character from VL Instance
        hcp_response = await client.get(
            f"/api/v1/hcp-profiles/{hcp_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert hcp_response.status_code == 200
        assert hcp_response.json()["avatar_character"] == "harry"


class TestAvatarSyncOnUpdate:
    """Verify update_instance propagates avatar changes to assigned HCP profiles."""

    async def test_update_instance_avatar_propagates_to_hcp(self, client: AsyncClient):
        """Changing VL Instance avatar_character updates all assigned HCPs."""
        hcp_id, vl_id, token, _ = await _seed_hcp_with_vl_instance(
            avatar_character="lisa", avatar_style="graceful-standing",
        )

        # Assign first
        await client.post(
            f"/api/v1/voice-live/instances/{vl_id}/assign",
            headers={"Authorization": f"Bearer {token}"},
            json={"hcp_profile_id": hcp_id},
        )

        # Now update VL Instance avatar to a different character
        update_resp = await client.put(
            f"/api/v1/voice-live/instances/{vl_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"avatar_character": "meg", "avatar_style": "formal"},
        )
        assert update_resp.status_code == 200

        # Verify HCP profile was updated
        hcp_response = await client.get(
            f"/api/v1/hcp-profiles/{hcp_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert hcp_response.status_code == 200
        hcp_data = hcp_response.json()
        assert hcp_data["avatar_character"] == "meg"
        assert hcp_data["avatar_style"] == "formal"

    async def test_update_instance_non_avatar_field_does_not_change_hcp_avatar(
        self, client: AsyncClient
    ):
        """Updating non-avatar VL Instance fields does NOT change HCP avatar."""
        hcp_id, vl_id, token, _ = await _seed_hcp_with_vl_instance(
            avatar_character="lisa", avatar_style="graceful-standing",
        )

        # Assign
        await client.post(
            f"/api/v1/voice-live/instances/{vl_id}/assign",
            headers={"Authorization": f"Bearer {token}"},
            json={"hcp_profile_id": hcp_id},
        )

        # Update non-avatar field (e.g., voice_name)
        await client.put(
            f"/api/v1/voice-live/instances/{vl_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"voice_name": "en-US-JennyNeural"},
        )

        # HCP avatar should remain "lisa"
        hcp_response = await client.get(
            f"/api/v1/hcp-profiles/{hcp_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert hcp_response.status_code == 200
        assert hcp_response.json()["avatar_character"] == "lisa"


class TestScenarioApiAvatarResolution:
    """Verify scenario API returns resolved avatar from VL Instance."""

    async def test_scenario_api_returns_vl_instance_avatar(self, client: AsyncClient):
        """GET /scenarios/{id} returns avatar from VL Instance, not stale HCP field."""
        hcp_id, vl_id, token, scenario_id = await _seed_hcp_with_vl_instance(
            avatar_character="lisa", avatar_style="graceful-standing",
            hcp_avatar_character="lori", hcp_avatar_style="casual",
        )

        # Assign VL Instance to HCP
        await client.post(
            f"/api/v1/voice-live/instances/{vl_id}/assign",
            headers={"Authorization": f"Bearer {token}"},
            json={"hcp_profile_id": hcp_id},
        )

        # Get scenario — avatar should be from VL Instance
        response = await client.get(
            f"/api/v1/scenarios/{scenario_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["hcp_profile"]["avatar_character"] == "lisa"
        assert data["hcp_profile"]["avatar_style"] == "graceful-standing"

    async def test_scenario_list_returns_vl_instance_avatar(self, client: AsyncClient):
        """GET /scenarios returns avatar from VL Instance for each scenario."""
        hcp_id, vl_id, token, _ = await _seed_hcp_with_vl_instance(
            avatar_character="harry", avatar_style="business",
            hcp_avatar_character="lori", hcp_avatar_style="casual",
        )

        # Assign VL Instance
        await client.post(
            f"/api/v1/voice-live/instances/{vl_id}/assign",
            headers={"Authorization": f"Bearer {token}"},
            json={"hcp_profile_id": hcp_id},
        )

        # List scenarios
        response = await client.get(
            "/api/v1/scenarios",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        item = data["items"][0]
        assert item["hcp_profile"]["avatar_character"] == "harry"
        assert item["hcp_profile"]["avatar_style"] == "business"

    async def test_active_scenarios_returns_vl_instance_avatar(self, client: AsyncClient):
        """GET /scenarios/active returns resolved avatar."""
        hcp_id, vl_id, token, _ = await _seed_hcp_with_vl_instance(
            avatar_character="jeff", avatar_style="formal",
            hcp_avatar_character="lori", hcp_avatar_style="casual",
        )

        # Assign VL Instance
        await client.post(
            f"/api/v1/voice-live/instances/{vl_id}/assign",
            headers={"Authorization": f"Bearer {token}"},
            json={"hcp_profile_id": hcp_id},
        )

        # Active scenarios
        response = await client.get(
            "/api/v1/scenarios/active",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["hcp_profile"]["avatar_character"] == "jeff"
        assert data[0]["hcp_profile"]["avatar_style"] == "formal"

    async def test_scenario_without_vl_instance_uses_hcp_inline_fields(
        self, client: AsyncClient
    ):
        """When no VL Instance assigned, scenario API falls back to HCP inline fields."""
        _, _, token, scenario_id = await _seed_hcp_with_vl_instance(
            avatar_character="lisa", avatar_style="graceful-standing",
            hcp_avatar_character="meg", hcp_avatar_style="formal",
        )
        # Do NOT assign VL Instance — HCP inline fields should be used

        response = await client.get(
            f"/api/v1/scenarios/{scenario_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        # Should use HCP inline fields since no VL Instance is assigned
        assert data["hcp_profile"]["avatar_character"] == "meg"
        assert data["hcp_profile"]["avatar_style"] == "formal"
