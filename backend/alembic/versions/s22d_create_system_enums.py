"""Create system_enums table with seed data.

Revision ID: s22d_system_enums
Revises: s22c_skill_id_not_null
Create Date: 2026-05-06
"""

import uuid

import sqlalchemy as sa

from alembic import op

revision = "s22d_system_enums"
down_revision = "s22c_skill_id_not_null"
branch_labels = None
depends_on = None


def _seed_enums():
    """Seed initial enum values for all categories."""
    system_enums = sa.table(
        "system_enums",
        sa.column("id", sa.String),
        sa.column("category", sa.String),
        sa.column("value", sa.String),
        sa.column("label_en", sa.String),
        sa.column("label_zh", sa.String),
        sa.column("sort_order", sa.Integer),
        sa.column("is_active", sa.Boolean),
    )

    rows = []

    # Products
    products = [
        ("Tislelizumab", "替雷利珠单抗"),
        ("Zanubrutinib", "泽布替尼"),
        ("Pamiparib", "帕米帕利"),
        ("Lifirafenib", "利非雷尼"),
        ("Ociperlimab", "欧司珀利单抗"),
    ]
    for i, (en, zh) in enumerate(products):
        rows.append(
            {
                "id": str(uuid.uuid4()),
                "category": "product",
                "value": en.lower(),
                "label_en": en,
                "label_zh": zh,
                "sort_order": i,
                "is_active": True,
            }
        )

    # Therapeutic areas
    areas = [
        ("Oncology", "肿瘤学"),
        ("Hematology", "血液学"),
        ("Immunology", "免疫学"),
        ("Solid Tumors", "实体瘤"),
    ]
    for i, (en, zh) in enumerate(areas):
        rows.append(
            {
                "id": str(uuid.uuid4()),
                "category": "therapeutic_area",
                "value": en.lower().replace(" ", "_"),
                "label_en": en,
                "label_zh": zh,
                "sort_order": i,
                "is_active": True,
            }
        )

    # Specialties
    specialties = [
        ("Oncology", "肿瘤科"),
        ("Hematology", "血液科"),
        ("Immunology", "免疫科"),
        ("Neurology", "神经科"),
        ("Cardiology", "心内科"),
        ("Endocrinology", "内分泌科"),
        ("Dermatology", "皮肤科"),
        ("Gastroenterology", "消化科"),
        ("General Practice", "全科"),
    ]
    for i, (en, zh) in enumerate(specialties):
        rows.append(
            {
                "id": str(uuid.uuid4()),
                "category": "specialty",
                "value": en.lower().replace(" ", "_"),
                "label_en": en,
                "label_zh": zh,
                "sort_order": i,
                "is_active": True,
            }
        )

    # Difficulties
    difficulties = [
        ("Easy", "简单"),
        ("Medium", "中等"),
        ("Hard", "困难"),
    ]
    for i, (en, zh) in enumerate(difficulties):
        rows.append(
            {
                "id": str(uuid.uuid4()),
                "category": "difficulty",
                "value": en.lower(),
                "label_en": en,
                "label_zh": zh,
                "sort_order": i,
                "is_active": True,
            }
        )

    op.bulk_insert(system_enums, rows)


def upgrade():
    op.create_table(
        "system_enums",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("category", sa.String(50), nullable=False, index=True),
        sa.Column("value", sa.String(255), nullable=False),
        sa.Column("label_en", sa.String(255), nullable=False),
        sa.Column("label_zh", sa.String(255), server_default=""),
        sa.Column("sort_order", sa.Integer, server_default="0"),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("category", "value", name="uq_system_enum_category_value"),
    )

    _seed_enums()


def downgrade():
    op.drop_table("system_enums")
