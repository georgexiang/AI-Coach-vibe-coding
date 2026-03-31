"""add agent_id, agent_sync_status, agent_sync_error to hcp_profiles

Revision ID: g11a00000001
Revises: f09a00000001
Create Date: 2026-03-31 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "g11a00000001"
down_revision: str | None = "f09a00000001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.add_column(
            sa.Column("agent_id", sa.String(100), server_default="", nullable=False)
        )
        batch_op.add_column(
            sa.Column("agent_sync_status", sa.String(20), server_default="none", nullable=False)
        )
        batch_op.add_column(
            sa.Column("agent_sync_error", sa.Text(), server_default="", nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.drop_column("agent_sync_error")
        batch_op.drop_column("agent_sync_status")
        batch_op.drop_column("agent_id")
