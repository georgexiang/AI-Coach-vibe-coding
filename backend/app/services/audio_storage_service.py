"""Audio file storage service for session recordings.

Uses the existing StorageBackend protocol (ARCH-01 pluggable pattern).
Audio files stored under audio/sessions/{session_id}/ directory.
"""

import logging

from app.services.storage import get_storage

logger = logging.getLogger(__name__)

AUDIO_BASE_PATH = "audio/sessions"


async def upload_session_audio(
    session_id: str, audio_data: bytes, filename: str = "recording.webm"
) -> str:
    """Upload session audio recording to storage.

    Returns the storage path (usable as audio_url in CoachingSession).
    """
    storage = get_storage()
    path = f"{AUDIO_BASE_PATH}/{session_id}/{filename}"
    url = await storage.save(path, audio_data)
    logger.info(f"Audio uploaded for session {session_id}: {path}")
    return url


async def get_audio_url(session_id: str, filename: str = "recording.webm") -> str | None:
    """Get the audio URL for a session, or None if not exists."""
    storage = get_storage()
    path = f"{AUDIO_BASE_PATH}/{session_id}/{filename}"
    if await storage.exists(path):
        return path
    return None


async def get_audio_content(session_id: str, filename: str = "recording.webm") -> bytes | None:
    """Read audio file content from storage."""
    storage = get_storage()
    path = f"{AUDIO_BASE_PATH}/{session_id}/{filename}"
    if await storage.exists(path):
        return await storage.read(path)
    return None
