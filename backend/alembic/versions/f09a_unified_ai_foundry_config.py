"""unified AI Foundry config + expand session mode to 7 values

Revision ID: f09a00000001
Revises: a1b2c3d4e5f6
Create Date: 2026-03-28 13:27:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f09a00000001"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add is_master column to service_configs (unified AI Foundry master row flag)
    with op.batch_alter_table("service_configs") as batch_op:
        batch_op.add_column(
            sa.Column("is_master", sa.Boolean(), server_default=sa.text("0"), nullable=False)
        )

    # Expand coaching_sessions.mode from String(20) to String(40)
    # to accommodate longer mode values like "digital_human_realtime_agent"
    with op.batch_alter_table("coaching_sessions") as batch_op:
        batch_op.alter_column(
            "mode",
            existing_type=sa.String(20),
            type_=sa.String(40),
            existing_server_default="text",
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("coaching_sessions") as batch_op:
        batch_op.alter_column(
            "mode",
            existing_type=sa.String(40),
            type_=sa.String(20),
            existing_server_default="text",
            existing_nullable=False,
        )

    with op.batch_alter_table("service_configs") as batch_op:
        batch_op.drop_column("is_master")
