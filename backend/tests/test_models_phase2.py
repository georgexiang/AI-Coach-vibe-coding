"""Tests for Phase 2 ORM models: creation, defaults, relationships, and methods."""

import json

from app.models.hcp_profile import HcpProfile
from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.score import ScoreDetail, SessionScore
from app.models.session import CoachingSession
from app.models.user import User
from app.services.auth import get_password_hash


async def _seed_user(db) -> User:
    """Create and return a test user."""
    user = User(
        username="modeluser",
        email="model@test.com",
        hashed_password=get_password_hash("pass"),
        full_name="Model User",
        role="admin",
    )
    db.add(user)
    await db.flush()
    return user


class TestHcpProfileModel:
    """Tests for HcpProfile ORM model."""

    async def test_create_with_defaults(self, db_session):
        user = await _seed_user(db_session)
        profile = HcpProfile(
            name="Dr. Test",
            specialty="Oncology",
            created_by=user.id,
        )
        db_session.add(profile)
        await db_session.flush()

        assert profile.id is not None
        assert profile.personality_type == "friendly"
        assert profile.emotional_state == 50
        assert profile.is_active is True

    async def test_to_prompt_dict(self, db_session):
        user = await _seed_user(db_session)
        profile = HcpProfile(
            name="Dr. Zhang",
            specialty="Oncology",
            hospital="Beijing Hospital",
            title="Chief Physician",
            personality_type="skeptical",
            emotional_state=70,
            communication_style=40,
            expertise_areas=json.dumps(["immunotherapy"]),
            objections=json.dumps(["Cost concerns"]),
            probe_topics=json.dumps(["Outcomes"]),
            prescribing_habits="Conservative",
            concerns="Safety",
            difficulty="hard",
            created_by=user.id,
        )
        db_session.add(profile)
        await db_session.flush()

        prompt_dict = profile.to_prompt_dict()
        assert prompt_dict["name"] == "Dr. Zhang"
        assert prompt_dict["personality_type"] == "skeptical"
        assert prompt_dict["expertise_areas"] == ["immunotherapy"]
        assert prompt_dict["objections"] == ["Cost concerns"]
        assert prompt_dict["hospital"] == "Beijing Hospital"

    async def test_has_created_at_and_updated_at(self, db_session):
        user = await _seed_user(db_session)
        profile = HcpProfile(
            name="Dr. X", specialty="Neuro", created_by=user.id,
        )
        db_session.add(profile)
        await db_session.flush()

        assert profile.created_at is not None
        assert profile.updated_at is not None


class TestScenarioModel:
    """Tests for Scenario ORM model."""

    async def test_create_with_defaults(self, db_session):
        user = await _seed_user(db_session)
        hcp = HcpProfile(name="Dr. A", specialty="Onc", created_by=user.id)
        db_session.add(hcp)
        await db_session.flush()

        scenario = Scenario(
            name="Test Scenario",
            product="Brukinsa",
            hcp_profile_id=hcp.id,
            created_by=user.id,
        )
        db_session.add(scenario)
        await db_session.flush()

        assert scenario.id is not None
        assert scenario.mode == "f2f"
        assert scenario.status == "draft"
        assert scenario.weight_key_message == 30
        assert scenario.pass_threshold == 70

    async def test_get_scoring_weights(self, db_session):
        user = await _seed_user(db_session)
        hcp = HcpProfile(name="Dr. B", specialty="Onc", created_by=user.id)
        db_session.add(hcp)
        await db_session.flush()

        scenario = Scenario(
            name="S",
            product="Drug",
            hcp_profile_id=hcp.id,
            created_by=user.id,
            weight_key_message=40,
            weight_objection_handling=20,
            weight_communication=20,
            weight_product_knowledge=10,
            weight_scientific_info=10,
        )
        db_session.add(scenario)
        await db_session.flush()

        weights = scenario.get_scoring_weights()
        assert weights == {
            "key_message": 40,
            "objection_handling": 20,
            "communication": 20,
            "product_knowledge": 10,
            "scientific_info": 10,
        }

    async def test_hcp_profile_relationship(self, db_session):
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        user = await _seed_user(db_session)
        hcp = HcpProfile(name="Dr. C", specialty="Card", created_by=user.id)
        db_session.add(hcp)
        await db_session.flush()

        scenario = Scenario(
            name="S", product="Drug", hcp_profile_id=hcp.id, created_by=user.id,
        )
        db_session.add(scenario)
        await db_session.flush()

        result = await db_session.execute(
            select(Scenario).options(selectinload(Scenario.hcp_profile)).where(Scenario.id == scenario.id)
        )
        loaded = result.scalar_one()
        assert loaded.hcp_profile.name == "Dr. C"


class TestCoachingSessionModel:
    """Tests for CoachingSession ORM model."""

    async def test_create_with_defaults(self, db_session):
        user = await _seed_user(db_session)
        hcp = HcpProfile(name="Dr. D", specialty="Onc", created_by=user.id)
        db_session.add(hcp)
        await db_session.flush()

        scenario = Scenario(
            name="S", product="Drug", hcp_profile_id=hcp.id, created_by=user.id,
        )
        db_session.add(scenario)
        await db_session.flush()

        session = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
        )
        db_session.add(session)
        await db_session.flush()

        assert session.id is not None
        assert session.status == "created"
        assert session.started_at is None
        assert session.completed_at is None
        assert session.overall_score is None

    async def test_nullable_fields(self, db_session):
        user = await _seed_user(db_session)
        hcp = HcpProfile(name="Dr. E", specialty="Onc", created_by=user.id)
        db_session.add(hcp)
        await db_session.flush()

        scenario = Scenario(
            name="S", product="Drug", hcp_profile_id=hcp.id, created_by=user.id,
        )
        db_session.add(scenario)
        await db_session.flush()

        session = CoachingSession(
            user_id=user.id, scenario_id=scenario.id,
        )
        db_session.add(session)
        await db_session.flush()

        assert session.duration_seconds is None
        assert session.passed is None


class TestSessionMessageModel:
    """Tests for SessionMessage ORM model."""

    async def test_create_message(self, db_session):
        user = await _seed_user(db_session)
        hcp = HcpProfile(name="Dr. F", specialty="Onc", created_by=user.id)
        db_session.add(hcp)
        await db_session.flush()

        scenario = Scenario(
            name="S", product="Drug", hcp_profile_id=hcp.id, created_by=user.id,
        )
        db_session.add(scenario)
        await db_session.flush()

        session = CoachingSession(user_id=user.id, scenario_id=scenario.id)
        db_session.add(session)
        await db_session.flush()

        msg = SessionMessage(
            session_id=session.id,
            role="user",
            content="Hello doctor",
            message_index=0,
        )
        db_session.add(msg)
        await db_session.flush()

        assert msg.id is not None
        assert msg.role == "user"
        assert msg.content == "Hello doctor"
        assert msg.message_index == 0


class TestScoreModels:
    """Tests for SessionScore and ScoreDetail models."""

    async def test_create_session_score(self, db_session):
        user = await _seed_user(db_session)
        hcp = HcpProfile(name="Dr. G", specialty="Onc", created_by=user.id)
        db_session.add(hcp)
        await db_session.flush()

        scenario = Scenario(
            name="S", product="Drug", hcp_profile_id=hcp.id, created_by=user.id,
        )
        db_session.add(scenario)
        await db_session.flush()

        session = CoachingSession(user_id=user.id, scenario_id=scenario.id)
        db_session.add(session)
        await db_session.flush()

        score = SessionScore(
            session_id=session.id,
            overall_score=82.5,
            passed=True,
            feedback_summary="Good performance",
        )
        db_session.add(score)
        await db_session.flush()

        assert score.id is not None
        assert score.overall_score == 82.5
        assert score.passed is True

    async def test_create_score_detail(self, db_session):
        user = await _seed_user(db_session)
        hcp = HcpProfile(name="Dr. H", specialty="Onc", created_by=user.id)
        db_session.add(hcp)
        await db_session.flush()

        scenario = Scenario(
            name="S", product="Drug", hcp_profile_id=hcp.id, created_by=user.id,
        )
        db_session.add(scenario)
        await db_session.flush()

        session = CoachingSession(user_id=user.id, scenario_id=scenario.id)
        db_session.add(session)
        await db_session.flush()

        score = SessionScore(
            session_id=session.id, overall_score=80, passed=True, feedback_summary="Good",
        )
        db_session.add(score)
        await db_session.flush()

        detail = ScoreDetail(
            score_id=score.id,
            dimension="key_message",
            score=85.0,
            weight=30,
            strengths=json.dumps([{"text": "Good delivery", "quote": "example"}]),
            weaknesses=json.dumps([]),
            suggestions=json.dumps(["Improve pacing"]),
        )
        db_session.add(detail)
        await db_session.flush()

        assert detail.id is not None
        assert detail.dimension == "key_message"
        assert json.loads(detail.strengths)[0]["text"] == "Good delivery"

    async def test_score_detail_relationship(self, db_session):
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        user = await _seed_user(db_session)
        hcp = HcpProfile(name="Dr. I", specialty="Onc", created_by=user.id)
        db_session.add(hcp)
        await db_session.flush()

        scenario = Scenario(
            name="S", product="Drug", hcp_profile_id=hcp.id, created_by=user.id,
        )
        db_session.add(scenario)
        await db_session.flush()

        session = CoachingSession(user_id=user.id, scenario_id=scenario.id)
        db_session.add(session)
        await db_session.flush()

        score = SessionScore(
            session_id=session.id, overall_score=80, passed=True, feedback_summary="OK",
        )
        db_session.add(score)
        await db_session.flush()

        detail = ScoreDetail(
            score_id=score.id, dimension="communication", score=75, weight=20,
        )
        db_session.add(detail)
        await db_session.flush()

        result = await db_session.execute(
            select(SessionScore)
            .options(selectinload(SessionScore.details))
            .where(SessionScore.id == score.id)
        )
        loaded = result.scalar_one()
        assert len(loaded.details) == 1
        assert loaded.details[0].dimension == "communication"
