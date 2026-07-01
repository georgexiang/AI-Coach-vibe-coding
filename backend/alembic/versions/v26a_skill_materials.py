"""Ensure skill_source_materials table exists.

Revision ID: v26a_skill_materials
Revises: v25a_ensure_meta_skills_table
Create Date: 2026-06-03
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "v26a_skill_materials"
down_revision: str = "v25a_ensure_meta_skills_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _create_skill_source_materials_table() -> None:
    op.create_table(
        "skill_source_materials",
        sa.Column("skill_id", sa.String(36), nullable=False),
        sa.Column("material_id", sa.String(36), nullable=False),
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["material_id"], ["training_materials.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("skill_id", "material_id", name="uq_skill_source_material"),
    )
    op.create_index(
        "ix_skill_source_materials_skill_id",
        "skill_source_materials",
        ["skill_id"],
        unique=False,
    )
    op.create_index(
        "ix_skill_source_materials_material_id",
        "skill_source_materials",
        ["material_id"],
        unique=False,
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("skill_source_materials"):
        _create_skill_source_materials_table()


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("skill_source_materials"):
        op.drop_index("ix_skill_source_materials_material_id", table_name="skill_source_materials")
        op.drop_index("ix_skill_source_materials_skill_id", table_name="skill_source_materials")
        op.drop_table("skill_source_materials")
