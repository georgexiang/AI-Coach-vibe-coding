"""add agent_version to hcp_profiles

Revision ID: h12a00000001
Revises: g11a00000001
Create Date: 2026-03-31 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "h12a00000001"
down_revision: str | None = "g11a00000001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.add_column(
            sa.Column("agent_version", sa.String(50), server_default="", nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.drop_column("agent_version")
