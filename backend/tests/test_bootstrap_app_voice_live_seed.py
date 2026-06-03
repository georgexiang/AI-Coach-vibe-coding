"""Tests for deployment bootstrap Voice Live Instance samples."""

from sqlalchemy import select

from app.models.user import User
from app.models.voice_live_instance import VoiceLiveInstance
from app.services.auth import get_password_hash
from scripts.bootstrap_app import seed_voice_live_instances


async def test_seed_voice_live_instances_creates_four_idempotent_video_samples(db_session):
    admin = User(
        username="admin",
        email="admin@aicoach.com",
        hashed_password=get_password_hash("admin123"),
        role="admin",
    )
    db_session.add(admin)
    await db_session.commit()

    await seed_voice_live_instances(db_session)
    await seed_voice_live_instances(db_session)

    result = await db_session.execute(
        select(VoiceLiveInstance).where(VoiceLiveInstance.name.like("Sample Voice Live - %"))
    )
    instances = result.scalars().all()

    assert len(instances) == 4
    assert {instance.voice_live_model for instance in instances} == {"gpt-realtime"}
    assert {instance.recognition_language for instance in instances} == {"zh-CN", "en-US"}
    assert {instance.avatar_character for instance in instances} == {"lori", "max"}
    assert all(instance.avatar_enabled for instance in instances)
    assert all(not instance.auto_detect_language for instance in instances)
