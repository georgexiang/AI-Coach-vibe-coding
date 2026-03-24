"""add scoring_rubrics table

Revision ID: 16f9f0ba6e9d
Revises: 10e15911bf3a
Create Date: 2026-03-24 23:13:36.026983

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "16f9f0ba6e9d"
down_revision: Union[str, None] = "10e15911bf3a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "scoring_rubrics",
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), server_default=""),
        sa.Column("scenario_type", sa.String(50), server_default="f2f"),
        sa.Column("dimensions", sa.Text(), server_default="[]"),
        sa.Column("is_default", sa.Boolean(), server_default=sa.false()),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("scoring_rubrics")
