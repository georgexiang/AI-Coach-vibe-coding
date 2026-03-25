"""Unit tests for conference_service: session creation, questions, respond, end."""

import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.conference import ConferenceAudienceHcp
from app.models.hcp_profile import HcpProfile
from app.models.scenario import Scenario
from app.models.user import User
from app.services.agents.base import CoachEvent, CoachEventType
from app.services.auth import get_password_hash
from app.services.conference_service import (
    _compute_relevance_score,
    _serialize_queue,
    create_conference_session,
    end_conference_session,
    generate_hcp_questions,
    transition_sub_state,
)
from app.services.turn_manager import QueuedQuestion, TurnManager
from app.utils.exceptions import AppException, NotFoundException
from tests.conftest import TestSessionLocal


async def _seed_conference_fixture(session, *, mode="conference", audience_count=3) -> dict:
    """Create User, HcpProfiles, Scenario, and ConferenceAudienceHcp records."""
    user = User(
        username="conf-svc-user",
        email="confsvc@test.com",
        hashed_password=get_password_hash("pass"),
        full_name="Conference Tester",
        role="user",
    )
    session.add(user)
    await session.flush()

    hcps = []
    for i in range(audience_count):
        hcp = HcpProfile(
            name=f"Dr. HCP-{i}",
            specialty="Oncology",
            personality_type="analytical",
            created_by=user.id,
        )
        session.add(hcp)
        hcps.append(hcp)
    await session.flush()

    scenario = Scenario(
        name="Conference Test Scenario",
        product="TestDrug",
        mode=mode,
        hcp_profile_id=hcps[0].id,
        created_by=user.id,
        key_messages=json.dumps(["Safety profile", "Efficacy data"]),
        description="Cancer treatment data presentation",
    )
    session.add(scenario)
    await session.flush()

    audience_hcps = []
    for i, hcp in enumerate(hcps):
        ah = ConferenceAudienceHcp(
            scenario_id=scenario.id,
            hcp_profile_id=hcp.id,
            role_in_conference="audience",
            voice_id=f"voice-{i}",
            sort_order=i,
        )
        session.add(ah)
        audience_hcps.append(ah)
    await session.flush()

    return {
        "user": user,
        "hcps": hcps,
        "scenario": scenario,
        "audience_hcps": audience_hcps,
    }


class TestCreateConferenceSession:
    """Tests for create_conference_session service function."""

    async def test_success(self):
        """Creates session with conference fields populated."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db)
            session = await create_conference_session(db, data["scenario"].id, data["user"].id)
            assert session.session_type == "conference"
            assert session.sub_state == "presenting"
            assert session.status == "created"
            # audience_config should be populated JSON
            config = json.loads(session.audience_config)
            assert len(config) == 3
            assert config[0]["name"] == "Dr. HCP-0"

    async def test_non_conference_scenario_raises_409(self):
        """Scenario with mode='f2f' raises 409."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db, mode="f2f")
            with pytest.raises(AppException) as exc:
                await create_conference_session(db, data["scenario"].id, data["user"].id)
            assert exc.value.status_code == 409
            assert exc.value.code == "NOT_CONFERENCE_SCENARIO"

    async def test_insufficient_audience_raises_409(self):
        """Scenario with fewer than 2 audience HCPs raises 409."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db, audience_count=1)
            with pytest.raises(AppException) as exc:
                await create_conference_session(db, data["scenario"].id, data["user"].id)
            assert exc.value.status_code == 409
            assert exc.value.code == "INSUFFICIENT_AUDIENCE"

    async def test_missing_scenario_raises_404(self):
        """Non-existent scenario raises NotFoundException."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db)
            with pytest.raises(NotFoundException):
                await create_conference_session(db, "non-existent-id", data["user"].id)


class TestTransitionSubState:
    """Tests for transition_sub_state service function."""

    async def test_transition_to_qa(self):
        """Sub-state transitions from 'presenting' to 'qa'."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db)
            session = await create_conference_session(db, data["scenario"].id, data["user"].id)
            assert session.sub_state == "presenting"

            await transition_sub_state(db, session.id, "qa")
            await db.refresh(session)
            assert session.sub_state == "qa"

    async def test_missing_session_raises_404(self):
        """Non-existent session raises NotFoundException."""
        async with TestSessionLocal() as db:
            await _seed_conference_fixture(db)
            with pytest.raises(NotFoundException):
                await transition_sub_state(db, "no-session", "qa")


class TestEndConferenceSession:
    """Tests for end_conference_session service function."""

    @patch("app.services.conference_service.turn_manager")
    async def test_end_sets_completed(self, mock_tm):
        """Ending session sets status='completed' and cleans up turn_manager."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db)
            session = await create_conference_session(db, data["scenario"].id, data["user"].id)
            # Set started_at so duration can be calculated
            session.started_at = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
            session.status = "in_progress"
            await db.flush()

            # Patch score_session at the module where it's lazily imported
            with patch(
                "app.services.scoring_service.score_session",
                new_callable=AsyncMock,
            ):
                result = await end_conference_session(db, session.id, data["user"].id)
            assert result.status == "completed"
            assert result.completed_at is not None
            mock_tm.cleanup_session.assert_called_once_with(session.id)

    async def test_end_wrong_user_raises_403(self):
        """Ending session with wrong user raises 403."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db)
            session = await create_conference_session(db, data["scenario"].id, data["user"].id)
            with pytest.raises(AppException) as exc:
                await end_conference_session(db, session.id, "wrong-user-id")
            assert exc.value.status_code == 403

    async def test_end_already_completed_raises_409(self):
        """Ending an already-completed session raises 409."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db)
            session = await create_conference_session(db, data["scenario"].id, data["user"].id)
            session.status = "completed"
            await db.flush()

            with pytest.raises(AppException) as exc:
                await end_conference_session(db, session.id, data["user"].id)
            assert exc.value.status_code == 409

    async def test_end_nonexistent_session_raises_404(self):
        """Ending non-existent session raises NotFoundException."""
        async with TestSessionLocal() as db:
            await _seed_conference_fixture(db)
            with pytest.raises(NotFoundException):
                await end_conference_session(db, "no-id", "user-id")


class TestGenerateHcpQuestions:
    """Tests for generate_hcp_questions with mocked LLM adapter."""

    async def test_generates_questions_from_llm(self):
        """Mock LLM generates questions that are added to turn_manager."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db)
            session = await create_conference_session(db, data["scenario"].id, data["user"].id)

            # Create mock adapter that returns question text
            mock_adapter = MagicMock()

            async def mock_execute(request):
                yield CoachEvent(
                    type=CoachEventType.TEXT,
                    content="What about side effects?",
                )
                yield CoachEvent(type=CoachEventType.DONE, content="")

            mock_adapter.execute = mock_execute

            # Patch both the registry and turn_manager
            fresh_tm = TurnManager()
            with (
                patch("app.services.conference_service.registry") as mock_registry,
                patch(
                    "app.services.conference_service.turn_manager",
                    fresh_tm,
                ),
            ):
                mock_registry.get.return_value = mock_adapter
                questions = await generate_hcp_questions(
                    db, session, "Our drug shows great efficacy"
                )

            assert len(questions) == 3  # one per HCP
            for q in questions:
                assert q.question == "What about side effects?"
                assert q.status == "waiting"

    async def test_empty_audience_returns_empty(self):
        """Session with empty audience_config returns no questions."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db)
            session = await create_conference_session(db, data["scenario"].id, data["user"].id)
            session.audience_config = "[]"
            await db.flush()

            questions = await generate_hcp_questions(db, session, "Some text")
            assert questions == []

    async def test_skips_empty_questions(self):
        """Questions that are empty or 'no question' are skipped."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db)
            session = await create_conference_session(db, data["scenario"].id, data["user"].id)

            mock_adapter = MagicMock()

            async def mock_execute(request):
                yield CoachEvent(type=CoachEventType.TEXT, content="no question")
                yield CoachEvent(type=CoachEventType.DONE, content="")

            mock_adapter.execute = mock_execute

            fresh_tm = TurnManager()
            with (
                patch("app.services.conference_service.registry") as mock_registry,
                patch(
                    "app.services.conference_service.turn_manager",
                    fresh_tm,
                ),
            ):
                mock_registry.get.return_value = mock_adapter
                questions = await generate_hcp_questions(db, session, "Our drug data")

            assert len(questions) == 0


class TestHandleRespond:
    """Tests for handle_respond with mocked LLM adapter."""

    async def test_handle_respond_no_waiting_question(self):
        """Respond to an HCP with no waiting question yields error event."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db)
            session = await create_conference_session(db, data["scenario"].id, data["user"].id)

            from app.services.conference_service import handle_respond

            events = []
            fresh_tm = TurnManager()
            with patch(
                "app.services.conference_service.turn_manager",
                fresh_tm,
            ):
                async for event in handle_respond(db, session, "hcp-nonexistent", "My response"):
                    events.append(event)

            assert len(events) == 1
            assert events[0]["event"] == "error"

    async def test_handle_respond_with_question(self):
        """Respond to HCP with a waiting question streams HCP follow-up."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db)
            session = await create_conference_session(db, data["scenario"].id, data["user"].id)

            hcp_id = data["hcps"][0].id

            # Set up turn_manager with a queued question
            fresh_tm = TurnManager()
            q = QueuedQuestion(
                hcp_profile_id=hcp_id,
                hcp_name=data["hcps"][0].name,
                question="What about side effects?",
                relevance_score=0.8,
                queued_at=datetime.now(UTC),
            )
            fresh_tm.add_question(session.id, q)

            # Mock LLM adapter for follow-up
            mock_adapter = MagicMock()

            async def mock_execute(request):
                yield CoachEvent(
                    type=CoachEventType.TEXT,
                    content="Follow-up response text",
                )
                yield CoachEvent(type=CoachEventType.DONE, content="")

            mock_adapter.execute = mock_execute

            from app.services.conference_service import handle_respond

            events = []
            with (
                patch(
                    "app.services.conference_service.turn_manager",
                    fresh_tm,
                ),
                patch("app.services.conference_service.registry") as mock_registry,
            ):
                mock_registry.get.return_value = mock_adapter
                async for event in handle_respond(db, session, hcp_id, "Here is my response"):
                    events.append(event)

            # Should have: turn_change, speaker_text, turn_change, queue_update
            event_types = [e["event"] for e in events]
            assert "turn_change" in event_types
            assert "speaker_text" in event_types
            assert "queue_update" in event_types

    async def test_handle_respond_no_adapter(self):
        """Respond with no LLM adapter yields error event."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db)
            session = await create_conference_session(db, data["scenario"].id, data["user"].id)

            hcp_id = data["hcps"][0].id
            fresh_tm = TurnManager()
            q = QueuedQuestion(
                hcp_profile_id=hcp_id,
                hcp_name="Dr. Test",
                question="Question?",
                relevance_score=0.8,
                queued_at=datetime.now(UTC),
            )
            fresh_tm.add_question(session.id, q)

            from app.services.conference_service import handle_respond

            events = []
            with (
                patch(
                    "app.services.conference_service.turn_manager",
                    fresh_tm,
                ),
                patch("app.services.conference_service.registry") as mock_registry,
            ):
                mock_registry.get.return_value = None
                async for event in handle_respond(db, session, hcp_id, "Response"):
                    events.append(event)

            assert any(e["event"] == "error" for e in events)


class TestEndConferenceEdgeCases:
    """Edge case tests for end_conference_session."""

    @patch("app.services.conference_service.turn_manager")
    async def test_end_with_naive_started_at(self, mock_tm):
        """Naive datetime started_at gets UTC tzinfo before duration calc."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db)
            session = await create_conference_session(db, data["scenario"].id, data["user"].id)
            # Set a naive datetime (no tzinfo) for started_at
            session.started_at = datetime(2026, 1, 1, 12, 0, 0)
            session.status = "in_progress"
            await db.flush()

            with patch(
                "app.services.scoring_service.score_session",
                new_callable=AsyncMock,
            ):
                result = await end_conference_session(db, session.id, data["user"].id)
            assert result.status == "completed"
            assert result.duration_seconds is not None
            assert result.duration_seconds > 0

    @patch("app.services.conference_service.turn_manager")
    async def test_end_scoring_exception_caught(self, mock_tm):
        """Scoring failure does not prevent session from completing."""
        async with TestSessionLocal() as db:
            data = await _seed_conference_fixture(db)
            session = await create_conference_session(db, data["scenario"].id, data["user"].id)
            session.status = "in_progress"
            await db.flush()

            with patch(
                "app.services.scoring_service.score_session",
                new_callable=AsyncMock,
                side_effect=AppException(
                    status_code=400,
                    code="NO_MESSAGES",
                    message="No messages to score",
                ),
            ):
                result = await end_conference_session(db, session.id, data["user"].id)
            # Session should still be completed despite scoring failure
            assert result.status == "completed"


class TestComputeRelevanceScore:
    """Tests for the _compute_relevance_score helper."""

    def test_full_overlap(self):
        """Identical words give score close to 1.0."""
        score = _compute_relevance_score("hello world", "hello world")
        assert score >= 0.9

    def test_no_overlap(self):
        """No word overlap gives base score 0.3."""
        score = _compute_relevance_score("alpha beta", "gamma delta")
        assert score == 0.3

    def test_partial_overlap(self):
        """Partial overlap gives score between 0.3 and 1.0."""
        score = _compute_relevance_score("hello world test", "hello foo bar")
        assert 0.3 < score < 1.0

    def test_empty_strings(self):
        """Empty inputs return default 0.5."""
        assert _compute_relevance_score("", "") == 0.5
        assert _compute_relevance_score("", "hello") == 0.5

    def test_single_word_overlap(self):
        """Single word in both gives intermediate score."""
        score = _compute_relevance_score("hello", "hello")
        assert score == 1.0


class TestSerializeQueue:
    """Tests for the _serialize_queue helper."""

    def test_serializes_questions(self):
        """Queue items are serialized with expected keys."""
        queue = [
            QueuedQuestion(
                hcp_profile_id="hcp-1",
                hcp_name="Dr. A",
                question="Question?",
                relevance_score=0.8,
                queued_at=datetime.now(UTC),
            )
        ]
        result = _serialize_queue(queue)
        assert len(result) == 1
        assert result[0]["hcp_profile_id"] == "hcp-1"
        assert result[0]["hcp_name"] == "Dr. A"
        assert result[0]["question"] == "Question?"
        assert result[0]["relevance_score"] == 0.8
        assert result[0]["status"] == "waiting"

    def test_empty_queue(self):
        """Empty queue returns empty list."""
        assert _serialize_queue([]) == []
