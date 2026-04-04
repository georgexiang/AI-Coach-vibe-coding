"""add voice_live_enabled to hcp_profiles

Revision ID: j13a00000001
Revises: i12b00000001
Create Date: 2026-04-03 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "j13a00000001"
down_revision: str | None = "i12b00000001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.add_column(
            sa.Column(
                "voice_live_enabled",
                sa.Boolean,
                server_default=sa.text("1"),
                nullable=False,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.drop_column("voice_live_enabled")
