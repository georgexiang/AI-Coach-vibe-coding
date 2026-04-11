"""Seed training materials for BeiGene products (Zanubrutinib, Tislelizumab).

Creates TrainingMaterial and MaterialVersion records with placeholder PDF files.

Idempotent -- skips materials that already exist (by name).
Run with: python3 scripts/seed_materials.py
"""

import asyncio
import os
import sys
import uuid
from pathlib import Path

# Add backend root to path so 'app' package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models.base import Base
from app.models.material import MaterialVersion, TrainingMaterial
from app.models.user import User

settings = get_settings()


SEED_MATERIALS = [
    {
        "name": "Zanubrutinib (泽布替尼) Product Training Manual",
        "product": "Zanubrutinib",
        "therapeutic_area": "Oncology / Hematology",
        "tags": "BTK,CLL,MCL,WM,MZL,ALPINE,SEQUOIA",
        "filename": "zanubrutinib_training_manual_v1.pdf",
        "content_type": "application/pdf",
        "file_size": 2_048_000,
    },
    {
        "name": "Tislelizumab (替雷利珠单抗) Product Training Manual",
        "product": "Tislelizumab",
        "therapeutic_area": "Oncology / Immunotherapy",
        "tags": "PD-1,NSCLC,ESCC,HCC,cHL,RATIONALE",
        "filename": "tislelizumab_training_manual_v1.pdf",
        "content_type": "application/pdf",
        "file_size": 1_856_000,
    },
]

# Minimal valid PDF placeholder
_PLACEHOLDER_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]"
    b"/Parent 2 0 R/Resources<<>>>>endobj\n"
    b"xref\n0 4\n"
    b"0000000000 65535 f \n"
    b"0000000009 00000 n \n"
    b"0000000058 00000 n \n"
    b"0000000115 00000 n \n"
    b"trailer<</Size 4/Root 1 0 R>>\n"
    b"startxref\n206\n%%EOF"
)


async def seed_materials() -> None:
    """Create seed training materials with versions and placeholder files."""
    engine = create_async_engine(settings.database_url, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Get admin user for created_by
        result = await session.execute(select(User).where(User.role == "admin"))
        admin = result.scalar_one_or_none()
        if admin is None:
            print("  [error] No admin user found. Run seed_data.py first.")
            await engine.dispose()
            return

        admin_id = admin.id

        print("Seeding training materials...")
        for mat_data in SEED_MATERIALS:
            name = mat_data["name"]
            result = await session.execute(
                select(TrainingMaterial).where(TrainingMaterial.name == name)
            )
            if result.scalar_one_or_none() is not None:
                print(f"  [skip] Material '{name}' already exists")
                continue

            # Create TrainingMaterial
            material_id = str(uuid.uuid4())
            material = TrainingMaterial(
                id=material_id,
                name=name,
                product=mat_data["product"],
                therapeutic_area=mat_data["therapeutic_area"],
                tags=mat_data["tags"],
                is_archived=False,
                current_version=1,
                created_by=admin_id,
            )
            session.add(material)

            # Create MaterialVersion
            version_id = str(uuid.uuid4())
            storage_url = f"materials/{material_id}/v1/{mat_data['filename']}"
            version = MaterialVersion(
                id=version_id,
                material_id=material_id,
                version_number=1,
                filename=mat_data["filename"],
                file_size=mat_data["file_size"],
                content_type=mat_data["content_type"],
                storage_url=storage_url,
                is_active=True,
            )
            session.add(version)

            # Write placeholder PDF file so download/preview works
            file_dir = os.path.join(
                settings.material_storage_path, "materials", material_id, "v1"
            )
            os.makedirs(file_dir, exist_ok=True)
            file_path = os.path.join(file_dir, mat_data["filename"])
            if not os.path.exists(file_path):
                with open(file_path, "wb") as f:
                    f.write(_PLACEHOLDER_PDF)

            print(f"  [created] Material '{name}' ({mat_data['product']})")

        await session.commit()

    await engine.dispose()
    print("Materials seed complete.")


if __name__ == "__main__":
    asyncio.run(seed_materials())
