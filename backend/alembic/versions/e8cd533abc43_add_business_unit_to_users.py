"""add business_unit to users

Revision ID: e8cd533abc43
Revises: 13f6d6c40295
Create Date: 2026-03-25 22:08:43.042279

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e8cd533abc43"
down_revision: str | None = "13f6d6c40295"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("business_unit", sa.String(length=100), server_default="", nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("business_unit")
