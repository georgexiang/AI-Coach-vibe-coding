"""Clean up abandoned and invalid sessions from the database.

Removes:
1. Sessions with status 'created' that have zero messages (abandoned session attempts)
2. Sessions with status 'scored' that have zero messages (prematurely scored without conversation)

Run with: python scripts/cleanup_abandoned_sessions.py
"""

import asyncio
import sys
from pathlib import Path

# Add backend root to path so 'app' package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, exists, func, not_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models.message import SessionMessage
from app.models.score import ScoreDetail, SessionScore
from app.models.session import CoachingSession

settings = get_settings()


async def main() -> None:
    """Remove abandoned and invalid sessions."""
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Find abandoned "created" sessions with no messages
        has_messages = exists().where(SessionMessage.session_id == CoachingSession.id)

        # Count before cleanup
        created_no_msg = await session.execute(
            select(func.count())
            .select_from(CoachingSession)
            .where(CoachingSession.status == "created", not_(has_messages))
        )
        created_count = created_no_msg.scalar_one()

        scored_no_msg = await session.execute(
            select(func.count())
            .select_from(CoachingSession)
            .where(CoachingSession.status == "scored", not_(has_messages))
        )
        scored_count = scored_no_msg.scalar_one()

        print(f"Found {created_count} abandoned 'created' sessions (0 messages)")
        print(f"Found {scored_count} invalid 'scored' sessions (0 messages)")

        if created_count == 0 and scored_count == 0:
            print("Nothing to clean up.")
            await engine.dispose()
            return

        # Get IDs of sessions to delete
        sessions_to_delete = await session.execute(
            select(CoachingSession.id).where(
                ((CoachingSession.status == "created") | (CoachingSession.status == "scored"))
                & not_(has_messages)
            )
        )
        session_ids = [row[0] for row in sessions_to_delete.all()]

        if not session_ids:
            print("No sessions to delete.")
            await engine.dispose()
            return

        # Delete related score details first (for scored sessions)
        score_ids_result = await session.execute(
            select(SessionScore.id).where(SessionScore.session_id.in_(session_ids))
        )
        score_ids = [row[0] for row in score_ids_result.all()]

        if score_ids:
            await session.execute(
                delete(ScoreDetail).where(ScoreDetail.score_id.in_(score_ids))
            )
            print(f"  Deleted score details for {len(score_ids)} scores")

            await session.execute(
                delete(SessionScore).where(SessionScore.session_id.in_(session_ids))
            )
            print(f"  Deleted {len(score_ids)} session scores")

        # Delete the sessions themselves
        await session.execute(
            delete(CoachingSession).where(CoachingSession.id.in_(session_ids))
        )
        print(f"  Deleted {len(session_ids)} sessions")

        await session.commit()
        print(f"\nCleanup complete: removed {len(session_ids)} abandoned/invalid sessions.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
