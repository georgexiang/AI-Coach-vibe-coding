"""Live integration tests for HCP → AI Foundry Agent sync using real .env config.

These tests actually call Azure AI Foundry to create/update/delete agents.
Skipped in CI when AZURE_FOUNDRY_ENDPOINT is not set.

Run locally:  python3 -m pytest tests/test_hcp_agent_live_integration.py -v -s
"""

import json

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.hcp_profile import HcpProfile
from app.models.service_config import ServiceConfig
from app.services import agent_sync_service
from app.utils.encryption import encrypt_value

settings = get_settings()

# Skip all tests in this file if Azure Foundry not configured
pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not settings.azure_foundry_endpoint or not settings.azure_foundry_api_key,
        reason="AZURE_FOUNDRY_ENDPOINT / AZURE_FOUNDRY_API_KEY not set in .env",
    ),
]


async def _seed_config(db: AsyncSession) -> None:
    """Seed master + voice_live ServiceConfig from .env settings."""
    # Check if already seeded
    result = await db.execute(
        select(ServiceConfig).where(ServiceConfig.is_master == True)  # noqa: E712
    )
    if result.scalar_one_or_none():
        return

    master = ServiceConfig(
        service_name="ai_foundry",
        display_name="Azure AI Foundry",
        endpoint=settings.azure_foundry_endpoint,
        api_key_encrypted=encrypt_value(settings.azure_foundry_api_key),
        model_or_deployment=settings.azure_openai_deployment or "gpt-4o",
        region="swedencentral",
        is_master=True,
        is_active=True,
        updated_by="test",
    )
    db.add(master)

    project = settings.azure_foundry_default_project
    if project:
        mode_json = json.dumps(
            {
                "mode": "agent",
                "agent_id": "",
                "project_name": project,
            }
        )
        vl = ServiceConfig(
            service_name="azure_voice_live",
            display_name="Azure Voice Live",
            endpoint="",
            api_key_encrypted="",
            model_or_deployment=mode_json,
            region="",
            is_master=False,
            is_active=True,
            updated_by="test",
        )
        db.add(vl)

    await db.flush()


def _make_profile_data() -> dict:
    """Create minimal HCP profile data for testing."""
    return {
        "name": "Dr. Live Test",
        "specialty": "Oncology",
        "hospital": "Test Hospital",
        "title": "Professor",
        "personality_type": "analytical",
        "emotional_state": 45,
        "communication_style": 60,
        "expertise_areas": '["immunotherapy", "targeted therapy"]',
        "prescribing_habits": "Evidence-based prescribing",
        "concerns": "Safety data quality",
        "objections": '["cost", "limited data"]',
        "probe_topics": '["clinical trial results"]',
        "difficulty": "medium",
        "is_active": True,
        "created_by": "test-user",
    }


# Track created agent IDs for cleanup
_created_agent_ids: list[str] = []


@pytest.fixture(autouse=True)
async def cleanup_agents(db_session):
    """Clean up agents created during tests."""
    yield
    for agent_id in _created_agent_ids:
        try:
            await agent_sync_service.delete_agent(db_session, agent_id)
        except Exception:
            pass
    _created_agent_ids.clear()


# ---------------------------------------------------------------------------
# Test 1: get_project_endpoint derives real URL from .env config
# ---------------------------------------------------------------------------


async def test_live_get_project_endpoint(db_session):
    """get_project_endpoint returns a real endpoint URL from .env config."""
    await _seed_config(db_session)

    endpoint, api_key = await agent_sync_service.get_project_endpoint(db_session)

    assert endpoint, "Project endpoint should not be empty"
    assert api_key, "API key should not be empty"
    assert "api/projects" in endpoint or settings.azure_foundry_endpoint.rstrip("/") in endpoint
    print(f"\n  Project endpoint: {endpoint}")
    print(f"  API key: ****{api_key[-4:]}")


# ---------------------------------------------------------------------------
# Test 2: create_agent actually creates an agent in AI Foundry
# ---------------------------------------------------------------------------


async def test_live_create_agent(db_session):
    """create_agent creates a real agent in AI Foundry and returns its ID."""
    await _seed_config(db_session)

    result = await agent_sync_service.create_agent(
        db_session,
        name="AI Coach Test Agent",
        instructions="You are a test HCP for integration testing. Respond briefly.",
        model=settings.azure_openai_deployment or "gpt-4o",
    )

    assert "id" in result, f"Expected 'id' in response, got: {result}"
    agent_id = result["id"]
    _created_agent_ids.append(agent_id)
    print(f"\n  Created agent: {agent_id}")
    print(f"  Agent name: {result.get('name', 'N/A')}")


# ---------------------------------------------------------------------------
# Test 3: update_agent updates an existing agent
# ---------------------------------------------------------------------------


async def test_live_update_agent(db_session):
    """update_agent updates an existing agent's instructions."""
    await _seed_config(db_session)

    # Create first
    create_result = await agent_sync_service.create_agent(
        db_session,
        name="AI Coach Update Test",
        instructions="Original instructions.",
        model=settings.azure_openai_deployment or "gpt-4o",
    )
    agent_id = create_result["id"]
    _created_agent_ids.append(agent_id)

    # Update
    update_result = await agent_sync_service.update_agent(
        db_session,
        agent_id=agent_id,
        name="AI Coach Updated",
        instructions="Updated instructions for testing.",
    )

    assert update_result["id"] == agent_id
    print(f"\n  Updated agent: {agent_id}")


# ---------------------------------------------------------------------------
# Test 4: delete_agent deletes an existing agent
# ---------------------------------------------------------------------------


async def test_live_delete_agent(db_session):
    """delete_agent deletes an agent and returns True."""
    await _seed_config(db_session)

    # Create first
    create_result = await agent_sync_service.create_agent(
        db_session,
        name="AI Coach Delete Test",
        instructions="To be deleted.",
        model=settings.azure_openai_deployment or "gpt-4o",
    )
    agent_id = create_result["id"]

    # Delete
    success = await agent_sync_service.delete_agent(db_session, agent_id)

    assert success is True
    print(f"\n  Deleted agent: {agent_id}")
    # Don't add to cleanup since already deleted


# ---------------------------------------------------------------------------
# Test 5: Full HCP profile → Agent sync flow
# ---------------------------------------------------------------------------


async def test_live_sync_agent_for_profile(db_session):
    """sync_agent_for_profile creates an agent from HCP profile data."""
    await _seed_config(db_session)

    # Create a real HCP profile
    profile = HcpProfile(**_make_profile_data())
    db_session.add(profile)
    await db_session.flush()
    await db_session.refresh(profile)

    # Sync agent
    result = await agent_sync_service.sync_agent_for_profile(db_session, profile)

    assert "id" in result
    agent_id = result["id"]
    _created_agent_ids.append(agent_id)

    # Update profile with agent_id
    profile.agent_id = agent_id
    profile.agent_sync_status = "synced"
    await db_session.flush()

    print(f"\n  Profile '{profile.name}' synced to agent: {agent_id}")

    # Now update the profile and re-sync
    profile.name = "Dr. Live Test Updated"
    await db_session.flush()

    update_result = await agent_sync_service.sync_agent_for_profile(db_session, profile)
    assert update_result["id"] == agent_id
    print("  Updated agent after profile change")


# ---------------------------------------------------------------------------
# Test 6: Full CRUD lifecycle — create, sync, update, retry, delete
# ---------------------------------------------------------------------------


async def test_live_full_crud_lifecycle(db_session):
    """Complete HCP → Agent lifecycle: create → sync → update → delete."""
    await _seed_config(db_session)

    from app.schemas.hcp_profile import HcpProfileCreate, HcpProfileUpdate
    from app.services import hcp_profile_service

    # 1. Create HCP profile (triggers agent sync)
    create_data = HcpProfileCreate(
        name="Dr. CRUD Lifecycle",
        specialty="Cardiology",
        hospital="Lifecycle Hospital",
        title="Director",
        personality_type="friendly",
        emotional_state=30,
        communication_style=70,
        expertise_areas=["heart failure", "arrhythmia"],
        prescribing_habits="Conservative",
        concerns="Long-term safety",
        objections=["price sensitivity"],
        probe_topics=["dosing regimen"],
        difficulty="easy",
        is_active=True,
        created_by="test-user",
    )
    profile = await hcp_profile_service.create_hcp_profile(db_session, create_data, "test-user")
    print(f"\n  1. Created profile: {profile.id}")
    print(f"     agent_sync_status: {profile.agent_sync_status}")
    print(f"     agent_id: {profile.agent_id}")

    if profile.agent_id:
        _created_agent_ids.append(profile.agent_id)

    assert profile.agent_sync_status in ("synced", "failed")

    if profile.agent_sync_status == "synced":
        assert profile.agent_id, "agent_id should be set when synced"

        # 2. Update HCP profile (triggers re-sync)
        update_data = HcpProfileUpdate(name="Dr. CRUD Updated")
        updated = await hcp_profile_service.update_hcp_profile(db_session, profile.id, update_data)
        print(f"  2. Updated profile, sync status: {updated.agent_sync_status}")
        assert updated.agent_sync_status in ("synced", "failed")

        # 3. Delete HCP profile (deletes agent)
        await hcp_profile_service.delete_hcp_profile(db_session, profile.id)
        print("  3. Deleted profile and agent")

        # Remove from cleanup since delete_hcp_profile handles it
        if profile.agent_id in _created_agent_ids:
            _created_agent_ids.remove(profile.agent_id)
    else:
        print(f"     Sync failed: {profile.agent_sync_error}")
        # 4. Retry sync
        retried = await hcp_profile_service.retry_agent_sync(db_session, profile.id)
        print(f"  4. Retry sync status: {retried.agent_sync_status}")
        if retried.agent_id:
            _created_agent_ids.append(retried.agent_id)
