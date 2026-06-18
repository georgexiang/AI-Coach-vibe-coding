"""Tests for session report endpoint."""

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.models.hcp_profile import HcpProfile
from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.scoring_rubric import ScoringRubric
from app.models.session import CoachingSession
from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from app.services.scoring_service import score_session
from tests.conftest import TestSessionLocal

_MOCK_LLM_RESULT = {
    "overall_score": 75.0,
    "passed": True,
    "feedback_summary": "Good performance overall.",
    "dimensions": [
        {
            "dimension": "key_message",
            "score": 80,
            "weight": 30,
            "category": "content",
            "strengths": [{"text": "Good delivery", "quote": None}],
            "weaknesses": [{"text": "Could improve", "quote": None}],
            "suggestions": ["Try harder"],
        },
        {
            "dimension": "objection_handling",
            "score": 70,
            "weight": 25,
            "category": "content",
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        {
            "dimension": "communication",
            "score": 75,
            "weight": 20,
            "category": "content",
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        {
            "dimension": "product_knowledge",
            "score": 72,
            "weight": 15,
            "category": "content",
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        {
            "dimension": "scientific_info",
            "score": 68,
            "weight": 10,
            "category": "content",
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
    ],
}


@pytest.fixture(autouse=True)
def mock_llm_scoring():
    """Mock LLM scoring for all tests (no Azure OpenAI in test env)."""
    with patch(
        "app.services.scoring_service.score_with_llm",
        new_callable=AsyncMock,
        return_value=_MOCK_LLM_RESULT,
    ):
        yield


async def _seed_scored_session_and_token() -> tuple[str, str, str]:
    """Create a scored session and return (user_id, session_id, token)."""
    async with TestSessionLocal() as db:
        user = User(
            username="report_user",
            email="report@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Report User",
            role="user",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        hcp = HcpProfile(
            name="Dr. Report",
            specialty="Oncology",
            created_by=user.id,
        )
        db.add(hcp)
        await db.commit()
        await db.refresh(hcp)

        rubric = ScoringRubric(
            name="Test Rubric",
            scenario_type="f2f",
            dimensions=json.dumps(
                [
                    {"name": "key_message", "weight": 30, "criteria": [], "max_score": 100.0},
                    {
                        "name": "objection_handling",
                        "weight": 25,
                        "criteria": [],
                        "max_score": 100.0,
                    },
                    {"name": "communication", "weight": 20, "criteria": [], "max_score": 100.0},
                    {"name": "product_knowledge", "weight": 15, "criteria": [], "max_score": 100.0},
                    {"name": "scientific_info", "weight": 10, "criteria": [], "max_score": 100.0},
                ]
            ),
            is_default=True,
            created_by=user.id,
        )
        db.add(rubric)
        await db.commit()
        await db.refresh(rubric)

        scenario = Scenario(
            name="Report Scenario",
            hcp_profile_id=hcp.id,
            key_messages=json.dumps(["Key 1", "Key 2"]),
            skill_id="test-skill-id",
            status="active",
            created_by=user.id,
            rubric_id=rubric.id,
        )
        db.add(scenario)
        await db.commit()
        await db.refresh(scenario)

        session = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
            status="completed",
            key_messages_status=json.dumps(
                [
                    {"message": "Key 1", "delivered": True, "detected_at": "2024-01-01T00:00:00"},
                    {"message": "Key 2", "delivered": False, "detected_at": None},
                ]
            ),
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        msg = SessionMessage(
            session_id=session.id,
            role="user",
            content="TestDrug has great efficacy data.",
            message_index=0,
        )
        db.add(msg)
        await db.commit()

        # Score the session
        await score_session(db, session.id)
        await db.commit()

        token = create_access_token(data={"sub": user.id})
        return user.id, session.id, token


async def _seed_unscored_session_and_token() -> tuple[str, str, str]:
    """Create a completed but unscored session and return (user_id, session_id, token)."""
    async with TestSessionLocal() as db:
        user = User(
            username="unscored_user",
            email="unscored@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Unscored User",
            role="user",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        hcp = HcpProfile(
            name="Dr. Unscored",
            specialty="Derm",
            created_by=user.id,
        )
        db.add(hcp)
        await db.commit()
        await db.refresh(hcp)

        scenario = Scenario(
            name="Unscored Scenario",
            hcp_profile_id=hcp.id,
            key_messages=json.dumps([]),
            skill_id="test-skill-id",
            status="active",
            created_by=user.id,
            rubric_id="test-rubric-id",
        )
        db.add(scenario)
        await db.commit()
        await db.refresh(scenario)

        session = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
            status="completed",
            key_messages_status=json.dumps([]),
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        token = create_access_token(data={"sub": user.id})
        return user.id, session.id, token


class TestGetSessionReport:
    """Tests for GET /api/v1/sessions/{id}/report."""

    async def test_returns_report_for_scored_session(self, client):
        _, session_id, token = await _seed_scored_session_and_token()
        response = await client.get(
            f"/api/v1/sessions/{session_id}/report",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session_id
        assert "overall_score" in data
        assert "passed" in data
        assert "dimensions" in data
        assert len(data["dimensions"]) > 0
        assert "strengths" in data
        assert "weaknesses" in data
        assert "improvements" in data

    async def test_returns_409_for_unscored_session(self, client):
        _, session_id, token = await _seed_unscored_session_and_token()
        response = await client.get(
            f"/api/v1/sessions/{session_id}/report",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 409
