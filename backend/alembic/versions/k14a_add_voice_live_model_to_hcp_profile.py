"""add voice_live_model column to hcp_profiles

Revision ID: k14a00000001
Revises: i12b00000001
Create Date: 2026-04-03 08:42:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "k14a00000001"
down_revision: str | None = "i12b00000001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.add_column(
            sa.Column(
                "voice_live_model",
                sa.String(50),
                server_default=sa.text("'gpt-4o'"),
                nullable=False,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.drop_column("voice_live_model")
