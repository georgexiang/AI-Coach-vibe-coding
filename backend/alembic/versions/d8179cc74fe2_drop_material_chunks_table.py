"""drop_material_chunks_table

Revision ID: d8179cc74fe2
Revises: p19a00000001
Create Date: 2026-04-11 10:01:44.566432

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d8179cc74fe2"
down_revision: Union[str, None] = "p19a00000001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("material_chunks", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_material_chunks_version_id"))
        batch_op.drop_index(batch_op.f("ix_material_chunks_material_id"))

    op.drop_table("material_chunks")


def downgrade() -> None:
    op.create_table(
        "material_chunks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("material_id", sa.String(length=36), nullable=False),
        sa.Column("version_id", sa.String(length=36), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("page_label", sa.String(length=100), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["material_id"], ["training_materials.id"]),
        sa.ForeignKeyConstraint(["version_id"], ["material_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("material_chunks", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_material_chunks_material_id"), ["material_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_material_chunks_version_id"), ["version_id"], unique=False)
