"""Unit tests for report_service.generate_report covering all branches."""

import json

import pytest

from app.models.hcp_profile import HcpProfile
from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.session import CoachingSession
from app.models.user import User
from app.services.auth import get_password_hash
from app.services.report_service import generate_report
from app.services.scoring_service import score_session
from app.utils.exceptions import AppException, NotFoundException
from tests.conftest import TestSessionLocal


async def _seed_scored_session() -> tuple[str, str]:
    """Create a scored session directly and return (user_id, session_id)."""
    async with TestSessionLocal() as db:
        user = User(
            username="rpt_svc_user",
            email="rpt_svc@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Report Svc User",
            role="user",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        hcp = HcpProfile(
            name="Dr. Report Svc",
            specialty="Oncology",
            created_by=user.id,
        )
        db.add(hcp)
        await db.commit()
        await db.refresh(hcp)

        scenario = Scenario(
            name="Report Svc Scenario",
            product="TestDrug",
            hcp_profile_id=hcp.id,
            key_messages=json.dumps(["Key 1", "Key 2", "Key 3"]),
            status="active",
            created_by=user.id,
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
                    {"message": "Key 3", "delivered": True, "detected_at": "2024-01-01T00:01:00"},
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
        return user.id, session.id


class TestGenerateReport:
    """Direct unit tests for generate_report service function."""

    async def test_generates_complete_report(self):
        _, session_id = await _seed_scored_session()
        async with TestSessionLocal() as db:
            report = await generate_report(db, session_id)

        assert report.session_id == session_id
        assert report.scenario_name == "Report Svc Scenario"
        assert report.product == "TestDrug"
        assert report.hcp_name == "Dr. Report Svc"
        assert isinstance(report.overall_score, (int, float))
        assert isinstance(report.passed, bool)
        assert len(report.dimensions) > 0
        assert report.key_messages_delivered == 2
        assert report.key_messages_total == 3

    async def test_report_has_strengths_weaknesses_improvements(self):
        _, session_id = await _seed_scored_session()
        async with TestSessionLocal() as db:
            report = await generate_report(db, session_id)

        # Report should have lists (may be empty but should exist)
        assert isinstance(report.strengths, list)
        assert isinstance(report.weaknesses, list)
        assert isinstance(report.improvements, list)

    async def test_report_dimensions_have_correct_fields(self):
        _, session_id = await _seed_scored_session()
        async with TestSessionLocal() as db:
            report = await generate_report(db, session_id)

        for dim in report.dimensions:
            assert hasattr(dim, "dimension")
            assert hasattr(dim, "score")
            assert hasattr(dim, "weight")
            assert hasattr(dim, "strengths")
            assert hasattr(dim, "weaknesses")
            assert hasattr(dim, "suggestions")

    async def test_raises_not_found_for_missing_session(self):
        async with TestSessionLocal() as db:
            with pytest.raises(NotFoundException):
                await generate_report(db, "nonexistent-id")

    async def test_raises_409_for_unscored_session(self):
        async with TestSessionLocal() as db:
            user = User(
                username="rpt_unscored",
                email="rpt_unscored@test.com",
                hashed_password=get_password_hash("pass"),
                full_name="Unscored",
                role="user",
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

            hcp = HcpProfile(
                name="Dr. Unscored2",
                specialty="Derm",
                created_by=user.id,
            )
            db.add(hcp)
            await db.commit()
            await db.refresh(hcp)

            scenario = Scenario(
                name="Unscored2",
                product="Drug",
                hcp_profile_id=hcp.id,
                key_messages=json.dumps([]),
                status="active",
                created_by=user.id,
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

            with pytest.raises(AppException) as exc_info:
                await generate_report(db, session.id)
            assert exc_info.value.status_code == 409
