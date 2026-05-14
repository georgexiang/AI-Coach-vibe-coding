"""Sync existing scoring rubrics to create CU content + voice analyzers.

Usage:
    cd backend
    python scripts/sync_cu_analyzers.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.scoring_rubric import ScoringRubric
from app.services.cu_evaluation_service import sync_rubric_analyzers


async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ScoringRubric))
        rubrics = result.scalars().all()

        if not rubrics:
            print("No scoring rubrics found in database.")
            return

        print(f"Found {len(rubrics)} rubrics. Syncing CU analyzers...\n")

        success = 0
        for rubric in rubrics:
            print(f"  [{rubric.id[:8]}] {rubric.name}")
            try:
                await sync_rubric_analyzers(db, rubric)
                print(f"    -> content: {rubric.cu_content_analyzer_id}")
                print(f"    -> voice:   {rubric.cu_voice_analyzer_id}")
                success += 1
            except Exception as e:
                print(f"    -> FAILED: {e}")

        await db.commit()
        print(f"\nDone. {success}/{len(rubrics)} rubrics synced successfully.")


if __name__ == "__main__":
    asyncio.run(main())
