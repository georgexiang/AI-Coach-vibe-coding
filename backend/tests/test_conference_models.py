"""Tests for conference ORM models: ConferenceAudienceHcp and CoachingSession."""

import json

from app.models.conference import ConferenceAudienceHcp
from app.models.hcp_profile import HcpProfile
from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.session import CoachingSession
from app.models.user import User
from app.services.auth import get_password_hash
from tests.conftest import TestSessionLocal


async def _seed_user_and_scenario(session, *, mode: str = "conference") -> tuple[str, str, str]:
    """Create required parent records. Returns (user_id, hcp_id, scenario_id)."""
    user = User(
        username="conftest-user",
        email="conftest@test.com",
        hashed_password=get_password_hash("pass"),
        full_name="Test User",
        role="user",
    )
    session.add(user)
    await session.flush()

    hcp = HcpProfile(
        name="Dr. Li",
        specialty="Oncology",
        personality_type="analytical",
        created_by=user.id,
    )
    session.add(hcp)
    await session.flush()

    scenario = Scenario(
        name="Test Scenario",
        product="TestDrug",
        mode=mode,
        hcp_profile_id=hcp.id,
        created_by=user.id,
        key_messages=json.dumps(["msg1", "msg2"]),
    )
    session.add(scenario)
    await session.flush()

    return user.id, hcp.id, scenario.id


class TestConferenceAudienceHcp:
    """Tests for ConferenceAudienceHcp ORM model."""

    async def test_create_and_read(self):
        """Create a ConferenceAudienceHcp and verify all columns are stored."""
        async with TestSessionLocal() as session:
            user_id, hcp_id, scenario_id = await _seed_user_and_scenario(session)

            audience_hcp = ConferenceAudienceHcp(
                scenario_id=scenario_id,
                hcp_profile_id=hcp_id,
                role_in_conference="moderator",
                voice_id="zh-CN-YunxiNeural",
                sort_order=1,
            )
            session.add(audience_hcp)
            await session.flush()

            assert audience_hcp.id is not None
            assert audience_hcp.scenario_id == scenario_id
            assert audience_hcp.hcp_profile_id == hcp_id
            assert audience_hcp.role_in_conference == "moderator"
            assert audience_hcp.voice_id == "zh-CN-YunxiNeural"
            assert audience_hcp.sort_order == 1

    async def test_default_values(self):
        """Default role_in_conference='audience', voice_id='', sort_order=0."""
        async with TestSessionLocal() as session:
            user_id, hcp_id, scenario_id = await _seed_user_and_scenario(session)

            audience_hcp = ConferenceAudienceHcp(
                scenario_id=scenario_id,
                hcp_profile_id=hcp_id,
            )
            session.add(audience_hcp)
            await session.flush()

            assert audience_hcp.role_in_conference == "audience"
            assert audience_hcp.voice_id == ""
            assert audience_hcp.sort_order == 0


class TestCoachingSessionConferenceFields:
    """Tests for conference-specific fields on CoachingSession."""

    async def test_conference_session_type(self):
        """Create conference session; verify session_type, sub_state, topic, audience."""
        async with TestSessionLocal() as session:
            user_id, hcp_id, scenario_id = await _seed_user_and_scenario(session)

            audience_config = json.dumps(
                [{"hcp_profile_id": hcp_id, "name": "Dr. Li", "role": "audience"}]
            )
            coaching = CoachingSession(
                user_id=user_id,
                scenario_id=scenario_id,
                session_type="conference",
                sub_state="presenting",
                presentation_topic="New cancer treatment data",
                audience_config=audience_config,
            )
            session.add(coaching)
            await session.flush()

            assert coaching.session_type == "conference"
            assert coaching.sub_state == "presenting"
            assert coaching.presentation_topic == "New cancer treatment data"
            loaded = json.loads(coaching.audience_config)
            assert len(loaded) == 1
            assert loaded[0]["name"] == "Dr. Li"

    async def test_defaults_f2f(self):
        """Default session_type is 'f2f' (backward compatibility)."""
        async with TestSessionLocal() as session:
            user_id, hcp_id, scenario_id = await _seed_user_and_scenario(session, mode="f2f")

            coaching = CoachingSession(
                user_id=user_id,
                scenario_id=scenario_id,
            )
            session.add(coaching)
            await session.flush()

            assert coaching.session_type == "f2f"
            assert coaching.sub_state == ""
            assert coaching.presentation_topic is None
            assert coaching.audience_config is None


class TestSessionMessageSpeakerFields:
    """Tests for conference speaker attribution fields on SessionMessage."""

    async def test_speaker_fields(self):
        """Create a message with speaker_id and speaker_name and verify."""
        async with TestSessionLocal() as session:
            user_id, hcp_id, scenario_id = await _seed_user_and_scenario(session)

            coaching = CoachingSession(
                user_id=user_id,
                scenario_id=scenario_id,
                session_type="conference",
                sub_state="qa",
            )
            session.add(coaching)
            await session.flush()

            msg = SessionMessage(
                session_id=coaching.id,
                role="assistant",
                content="What about the safety profile?",
                message_index=0,
                speaker_id=hcp_id,
                speaker_name="Dr. Li",
            )
            session.add(msg)
            await session.flush()

            assert msg.speaker_id == hcp_id
            assert msg.speaker_name == "Dr. Li"
            assert msg.role == "assistant"

    async def test_speaker_defaults(self):
        """Default speaker_id=None, speaker_name='' (backward compat with F2F messages)."""
        async with TestSessionLocal() as session:
            user_id, hcp_id, scenario_id = await _seed_user_and_scenario(session)

            coaching = CoachingSession(
                user_id=user_id,
                scenario_id=scenario_id,
            )
            session.add(coaching)
            await session.flush()

            msg = SessionMessage(
                session_id=coaching.id,
                role="user",
                content="Hello",
                message_index=0,
            )
            session.add(msg)
            await session.flush()

            assert msg.speaker_id is None
            assert msg.speaker_name == ""
