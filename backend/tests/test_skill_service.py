"""Skill service tests: CRUD, lifecycle transitions, file security."""

import pytest

from app.models.skill import VALID_TRANSITIONS
from app.schemas.skill import SkillCreate
from app.services.skill_service import (
    sanitize_filename,
    validate_file_upload,
    validate_status_transition,
)
from app.utils.exceptions import ValidationException
from tests.conftest import TestSessionLocal


async def _seed_user() -> str:
    """Create a test admin user and return the user_id."""
    from app.models.user import User
    from app.services.auth import get_password_hash

    async with TestSessionLocal() as session:
        user = User(
            username="skill_test_admin",
            email="skill_admin@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Skill Admin",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user.id


class TestCreateSkill:
    """Test skill creation via service layer."""

    async def test_create_skill_returns_draft(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        data = SkillCreate(name="Test Skill", description="A test skill", product="TestProduct")
        skill = await skill_service.create_skill(db_session, data, user_id)
        await db_session.commit()

        assert skill.id is not None
        assert skill.name == "Test Skill"
        assert skill.status == "draft"
        assert skill.current_version == 1

    async def test_create_skill_creates_initial_version(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        data = SkillCreate(name="Versioned Skill", content="Initial content")
        skill = await skill_service.create_skill(db_session, data, user_id)
        await db_session.commit()

        assert len(skill.versions) == 1
        assert skill.versions[0].version_number == 1
        assert skill.versions[0].is_published is False


class TestStatusTransitions:
    """Test lifecycle state machine transitions."""

    def test_valid_transitions_all_succeed(self):
        for from_state, to_states in VALID_TRANSITIONS.items():
            for to_state in to_states:
                # Should not raise
                validate_status_transition(from_state, to_state)

    def test_invalid_transition_draft_to_published(self):
        with pytest.raises(ValidationException):
            validate_status_transition("draft", "published")

    def test_invalid_transition_published_to_draft(self):
        with pytest.raises(ValidationException):
            validate_status_transition("published", "draft")

    def test_invalid_transition_archived_to_published(self):
        with pytest.raises(ValidationException):
            validate_status_transition("archived", "published")

    def test_invalid_transition_draft_to_archived(self):
        with pytest.raises(ValidationException):
            validate_status_transition("draft", "archived")


class TestFileSecurity:
    """Test file upload security: extensions, sizes, filename sanitization."""

    def test_sanitize_filename_strips_path_traversal(self):
        with pytest.raises(ValidationException):
            sanitize_filename("../../../etc/passwd")

    def test_sanitize_filename_strips_absolute_path(self):
        with pytest.raises(ValidationException):
            sanitize_filename("/etc/passwd")

    def test_sanitize_filename_returns_basename(self):
        result = sanitize_filename("subdir/file.pdf")
        assert result == "file.pdf"
        assert "/" not in result

    def test_sanitize_filename_rejects_empty(self):
        with pytest.raises(ValidationException):
            sanitize_filename("")

    def test_validate_file_upload_accepts_pdf(self):
        # Should not raise
        validate_file_upload("document.pdf", 1024)

    def test_validate_file_upload_rejects_exe(self):
        with pytest.raises(ValidationException):
            validate_file_upload("malware.exe", 1024)

    def test_validate_file_upload_rejects_oversized(self):
        with pytest.raises(ValidationException):
            validate_file_upload("big.pdf", 60 * 1024 * 1024)  # 60MB > 50MB limit


class TestPublishFlow:
    """Test the complete draft → review → published lifecycle."""

    async def test_draft_to_review_to_published(self, db_session):
        """Full publish flow: draft → review → published with quality gates."""
        from app.services import skill_service

        user_id = await _seed_user()

        # Create skill with content that passes structure check
        content = """# Test Skill - Coaching Protocol

## Overview
Test overview.

## SOP Steps

### Step 1: Opening
Greet the HCP.

### Step 2: Discussion
Present data.

### Step 3: Closing
Schedule follow-up.

## Assessment Rubric

| Criterion | Description | Weight |
|-----------|-------------|--------|
| Communication | Clarity | 50% |
| Knowledge | Accuracy | 50% |

## Key Knowledge Points

### Topic 1
Important details.
"""
        data = SkillCreate(name="Publish Test Skill", product="TestProd", content=content)
        skill = await skill_service.create_skill(db_session, data, user_id)
        await db_session.commit()
        assert skill.status == "draft"

        # Step 1: draft → review (via update_skill with status change)
        from app.schemas.skill import SkillUpdate

        updated = await skill_service.update_skill(
            db_session, skill.id, SkillUpdate(status="review"), user_id
        )
        await db_session.commit()
        assert updated.status == "review"

        # Set quality gates (normally done by evaluation service)
        updated.structure_check_passed = True
        updated.quality_score = 75
        updated.quality_verdict = "good"
        # Set content hash to match current content so not stale
        import json

        from app.services.skill_validation_service import _compute_content_hash

        updated.quality_details = json.dumps({"content_hash": _compute_content_hash(content)})
        await db_session.flush()

        # Step 2: review → published
        published = await skill_service.publish_skill(db_session, skill.id, user_id)
        await db_session.commit()
        assert published.status == "published"

        # Verify published version was created (query SkillVersion directly)
        from sqlalchemy import select

        from app.models.skill import SkillVersion

        result = await db_session.execute(
            select(SkillVersion).where(
                SkillVersion.skill_id == skill.id,
                SkillVersion.is_published == True,  # noqa: E712
            )
        )
        published_versions = result.scalars().all()
        assert len(published_versions) == 1

    async def test_direct_draft_to_published_rejected(self, db_session):
        """Cannot skip review step: draft → published must fail."""
        from app.services import skill_service

        user_id = await _seed_user()
        data = SkillCreate(name="Skip Review Skill", content="Some content")
        skill = await skill_service.create_skill(db_session, data, user_id)
        await db_session.commit()
        assert skill.status == "draft"

        # Set quality gates to pass
        skill.structure_check_passed = True
        skill.quality_score = 80
        skill.quality_details = "{}"
        await db_session.flush()

        # Attempt to publish directly from draft — should fail
        with pytest.raises(ValidationException, match="Invalid status transition"):
            await skill_service.publish_skill(db_session, skill.id, user_id)

    async def test_publish_requires_quality_score(self, db_session):
        """Publish rejected when quality score is below threshold."""
        from app.schemas.skill import SkillUpdate
        from app.services import skill_service

        user_id = await _seed_user()
        data = SkillCreate(name="Low Quality Skill", content="Some content")
        skill = await skill_service.create_skill(db_session, data, user_id)
        await db_session.commit()

        # Transition to review
        await skill_service.update_skill(
            db_session, skill.id, SkillUpdate(status="review"), user_id
        )
        await db_session.commit()

        # Set passing structure but failing quality
        skill.structure_check_passed = True
        skill.quality_score = 30  # Below 50 threshold
        await db_session.flush()

        with pytest.raises(ValidationException, match="Quality score"):
            await skill_service.publish_skill(db_session, skill.id, user_id)
