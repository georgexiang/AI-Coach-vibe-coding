"""add session mode column

Revision ID: a1b2c3d4e5f6
Revises: 35e15f5ae427
Create Date: 2026-03-27 15:14:50.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "35e15f5ae427"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "coaching_sessions",
        sa.Column("mode", sa.String(20), server_default="text", nullable=False),
    )


def downgrade() -> None:
    with op.batch_alter_table("coaching_sessions") as batch_op:
        batch_op.drop_column("mode")
