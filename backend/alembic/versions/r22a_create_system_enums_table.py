"""create system_enums table with seed data

Revision ID: r22a00000001
Revises: q20a00000001
Create Date: 2026-05-06 08:00:00.000000

"""

import uuid
from collections.abc import Sequence
from datetime import datetime

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "r22a00000001"
down_revision: str = "q20a00000001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _seed_enums() -> list[dict]:
    """Generate seed data for system_enums table."""
    now = datetime.utcnow().isoformat()
    enums = []

    def add(category: str, value: str, label_en: str, label_zh: str, sort_order: int):
        enums.append(
            {
                "id": str(uuid.uuid4()),
                "category": category,
                "value": value,
                "label_en": label_en,
                "label_zh": label_zh,
                "sort_order": sort_order,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
        )

    # Products
    add("product", "tislelizumab", "Tislelizumab", "替雷利珠单抗", 1)
    add("product", "zanubrutinib", "Zanubrutinib", "泽布替尼", 2)
    add("product", "pamiparib", "Pamiparib", "帕米帕利", 3)
    add("product", "lifirafenib", "Lifirafenib", "利非雷尼", 4)
    add("product", "ociperlimab", "Ociperlimab", "欧司珀利单抗", 5)

    # Therapeutic Areas
    add("therapeutic_area", "oncology", "Oncology", "肿瘤学", 1)
    add("therapeutic_area", "hematology", "Hematology", "血液学", 2)
    add("therapeutic_area", "immunology", "Immunology", "免疫学", 3)
    add("therapeutic_area", "solid_tumors", "Solid Tumors", "实体肿瘤", 4)

    # Specialties
    add("specialty", "oncology", "Oncology", "肿瘤科", 1)
    add("specialty", "hematology", "Hematology", "血液科", 2)
    add("specialty", "immunology", "Immunology", "免疫科", 3)
    add("specialty", "neurology", "Neurology", "神经科", 4)
    add("specialty", "cardiology", "Cardiology", "心内科", 5)
    add("specialty", "endocrinology", "Endocrinology", "内分泌科", 6)
    add("specialty", "dermatology", "Dermatology", "皮肤科", 7)
    add("specialty", "gastroenterology", "Gastroenterology", "消化科", 8)
    add("specialty", "general_practice", "General Practice", "全科", 9)

    # Difficulties
    add("difficulty", "easy", "Easy", "简单", 1)
    add("difficulty", "medium", "Medium", "中等", 2)
    add("difficulty", "hard", "Hard", "困难", 3)

    # Modes
    add("mode", "f2f", "Face to Face", "面对面", 1)
    add("mode", "conference", "Conference", "会议", 2)

    return enums


def upgrade() -> None:
    # Create the system_enums table
    op.create_table(
        "system_enums",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("category", sa.String(50), nullable=False, index=True),
        sa.Column("value", sa.String(255), nullable=False),
        sa.Column("label_en", sa.String(255), nullable=False),
        sa.Column("label_zh", sa.Text(), server_default="", nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("category", "value", name="uq_system_enum_category_value"),
    )

    # Seed initial data
    table = sa.table(
        "system_enums",
        sa.column("id", sa.String),
        sa.column("category", sa.String),
        sa.column("value", sa.String),
        sa.column("label_en", sa.String),
        sa.column("label_zh", sa.Text),
        sa.column("sort_order", sa.Integer),
        sa.column("is_active", sa.Boolean),
        sa.column("created_at", sa.String),
        sa.column("updated_at", sa.String),
    )
    op.bulk_insert(table, _seed_enums())


def downgrade() -> None:
    op.drop_table("system_enums")
