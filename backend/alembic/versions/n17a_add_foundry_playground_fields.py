"""add AI Foundry Playground alignment fields to voice_live_instances

Revision ID: n17a00000001
Revises: m16a00000001
Create Date: 2026-04-06 16:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "n17a00000001"
down_revision: str | None = "m16a00000001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Image #8 — Response settings
    with op.batch_alter_table("voice_live_instances") as batch_op:
        batch_op.add_column(
            sa.Column("response_temperature", sa.Float(), server_default=sa.text("0.8"), nullable=False)
        )
        batch_op.add_column(
            sa.Column("proactive_engagement", sa.Boolean(), server_default=sa.text("1"), nullable=False)
        )

        # Image #9 — Speech input
        batch_op.add_column(
            sa.Column("auto_detect_language", sa.Boolean(), server_default=sa.text("1"), nullable=False)
        )

        # Image #10 — Speech output
        batch_op.add_column(
            sa.Column("playback_speed", sa.Float(), server_default=sa.text("1.0"), nullable=False)
        )
        batch_op.add_column(
            sa.Column(
                "custom_lexicon_enabled", sa.Boolean(), server_default=sa.text("0"), nullable=False
            )
        )
        batch_op.add_column(
            sa.Column("custom_lexicon_url", sa.String(500), server_default=sa.text("''"), nullable=False)
        )

        # Image #11 — Avatar toggle
        batch_op.add_column(
            sa.Column("avatar_enabled", sa.Boolean(), server_default=sa.text("1"), nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("voice_live_instances") as batch_op:
        batch_op.drop_column("avatar_enabled")
        batch_op.drop_column("custom_lexicon_url")
        batch_op.drop_column("custom_lexicon_enabled")
        batch_op.drop_column("playback_speed")
        batch_op.drop_column("auto_detect_language")
        batch_op.drop_column("proactive_engagement")
        batch_op.drop_column("response_temperature")
