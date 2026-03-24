"""Tests for score history with dimension trends."""

import json
from datetime import UTC, datetime, timedelta

from app.models.hcp_profile import HcpProfile
from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.score import ScoreDetail, SessionScore
from app.models.session import CoachingSession
from app.models.user import User
from app.services.auth import get_password_hash
from app.services.scoring_service import get_score_history


async def _seed_scored_sessions(db, count=2) -> tuple[str, list[str]]:
    """Create a user with multiple scored sessions and return (user_id, session_ids)."""
    user = User(
        username="history_user",
        email="history@test.com",
        hashed_password=get_password_hash("pass"),
        full_name="History User",
        role="user",
    )
    db.add(user)
    await db.flush()

    hcp = HcpProfile(
        name="Dr. History",
        specialty="Oncology",
        created_by=user.id,
    )
    db.add(hcp)
    await db.flush()

    scenario = Scenario(
        name="History Scenario",
        product="TestDrug",
        hcp_profile_id=hcp.id,
        key_messages=json.dumps(["Msg 1", "Msg 2"]),
        status="active",
        created_by=user.id,
    )
    db.add(scenario)
    await db.flush()

    session_ids = []
    base_time = datetime(2024, 6, 1, tzinfo=UTC)

    for i in range(count):
        session = CoachingSession(
            user_id=user.id,
            scenario_id=scenario.id,
            status="scored",
            completed_at=base_time + timedelta(days=i),
            key_messages_status=json.dumps([]),
        )
        db.add(session)
        await db.flush()

        # Add a message
        msg = SessionMessage(
            session_id=session.id,
            role="user",
            content=f"Message for session {i}",
            message_index=0,
        )
        db.add(msg)
        await db.flush()

        # Score: session 0 scores lower, session 1 scores higher
        base_score = 70.0 + i * 5.0
        score = SessionScore(
            session_id=session.id,
            overall_score=base_score,
            passed=base_score >= 70,
            feedback_summary=f"Session {i} feedback",
        )
        db.add(score)
        await db.flush()

        # Add dimension details
        dim_names = ["key_message", "objection_handling", "communication"]
        weights = [40, 35, 25]
        for j, dim_name in enumerate(dim_names):
            detail = ScoreDetail(
                score_id=score.id,
                dimension=dim_name,
                score=base_score + j * 2,  # slightly different per dimension
                weight=weights[j],
                strengths=json.dumps([{"text": f"Strength {j}", "quote": None}]),
                weaknesses=json.dumps([{"text": f"Weakness {j}", "quote": None}]),
                suggestions=json.dumps([f"Suggestion {j}"]),
            )
            db.add(detail)

        session.overall_score = base_score
        session.passed = base_score >= 70
        session_ids.append(session.id)
        await db.flush()

    return user.id, session_ids


class TestGetScoreHistory:
    """Tests for get_score_history function."""

    async def test_returns_scored_sessions_ordered_by_date(self, db_session):
        user_id, session_ids = await _seed_scored_sessions(db_session, count=3)
        history = await get_score_history(db_session, user_id, limit=10)

        assert len(history) == 3
        # Most recent first (session 2 completed latest)
        assert history[0]["session_id"] == session_ids[2]
        assert history[1]["session_id"] == session_ids[1]
        assert history[2]["session_id"] == session_ids[0]

    async def test_returns_dimension_scores(self, db_session):
        user_id, _ = await _seed_scored_sessions(db_session, count=1)
        history = await get_score_history(db_session, user_id, limit=10)

        assert len(history) == 1
        entry = history[0]
        assert "dimensions" in entry
        assert len(entry["dimensions"]) == 3
        assert entry["dimensions"][0]["dimension"] == "key_message"
        assert "score" in entry["dimensions"][0]
        assert "weight" in entry["dimensions"][0]

    async def test_computes_trend_improvement_pct(self, db_session):
        user_id, _ = await _seed_scored_sessions(db_session, count=2)
        history = await get_score_history(db_session, user_id, limit=10)

        # Most recent (session 1, base_score=75) vs previous (session 0, base_score=70)
        # For key_message dimension: session1=75+0=75, session0=70+0=70, improvement=5.0
        most_recent = history[0]
        assert "dimensions" in most_recent
        for dim in most_recent["dimensions"]:
            assert "improvement_pct" in dim

        # Verify the first dimension (key_message) has positive improvement
        km_dim = next(d for d in most_recent["dimensions"] if d["dimension"] == "key_message")
        assert km_dim["improvement_pct"] == 5.0

    async def test_oldest_session_has_no_trend(self, db_session):
        user_id, _ = await _seed_scored_sessions(db_session, count=2)
        history = await get_score_history(db_session, user_id, limit=10)

        # Oldest session (last in list) has no previous to compare
        oldest = history[-1]
        for dim in oldest["dimensions"]:
            assert dim["improvement_pct"] is None

    async def test_respects_limit(self, db_session):
        user_id, _ = await _seed_scored_sessions(db_session, count=3)
        history = await get_score_history(db_session, user_id, limit=2)
        assert len(history) == 2

    async def test_returns_empty_for_user_with_no_scored_sessions(self, db_session):
        user = User(
            username="empty_user",
            email="empty@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Empty User",
            role="user",
        )
        db_session.add(user)
        await db_session.flush()

        history = await get_score_history(db_session, user.id, limit=10)
        assert history == []
