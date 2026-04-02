"""add voice/avatar/conversation fields to hcp_profiles

Revision ID: i12b00000001
Revises: b820e86271f8
Create Date: 2026-04-02 17:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "i12b00000001"
down_revision: str | None = "b820e86271f8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("hcp_profiles") as batch_op:
        # Voice settings
        batch_op.add_column(
            sa.Column(
                "voice_name", sa.String(200), server_default="en-US-AvaNeural", nullable=False
            )
        )
        batch_op.add_column(
            sa.Column("voice_type", sa.String(50), server_default="azure-standard", nullable=False)
        )
        batch_op.add_column(
            sa.Column("voice_temperature", sa.Float, server_default="0.9", nullable=False)
        )
        batch_op.add_column(
            sa.Column("voice_custom", sa.Boolean, server_default=sa.text("0"), nullable=False)
        )

        # Avatar settings
        batch_op.add_column(
            sa.Column("avatar_character", sa.String(100), server_default="lori", nullable=False)
        )
        batch_op.add_column(
            sa.Column("avatar_style", sa.String(100), server_default="casual", nullable=False)
        )
        batch_op.add_column(
            sa.Column("avatar_customized", sa.Boolean, server_default=sa.text("0"), nullable=False)
        )

        # Conversation parameters
        batch_op.add_column(
            sa.Column(
                "turn_detection_type",
                sa.String(50),
                server_default="server_vad",
                nullable=False,
            )
        )
        batch_op.add_column(
            sa.Column("noise_suppression", sa.Boolean, server_default=sa.text("0"), nullable=False)
        )
        batch_op.add_column(
            sa.Column("echo_cancellation", sa.Boolean, server_default=sa.text("0"), nullable=False)
        )
        batch_op.add_column(
            sa.Column("eou_detection", sa.Boolean, server_default=sa.text("0"), nullable=False)
        )
        batch_op.add_column(
            sa.Column("recognition_language", sa.String(20), server_default="auto", nullable=False)
        )

        # Agent instruction override (D-02)
        batch_op.add_column(
            sa.Column("agent_instructions_override", sa.Text, server_default="", nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.drop_column("agent_instructions_override")
        batch_op.drop_column("recognition_language")
        batch_op.drop_column("eou_detection")
        batch_op.drop_column("echo_cancellation")
        batch_op.drop_column("noise_suppression")
        batch_op.drop_column("turn_detection_type")
        batch_op.drop_column("avatar_customized")
        batch_op.drop_column("avatar_style")
        batch_op.drop_column("avatar_character")
        batch_op.drop_column("voice_custom")
        batch_op.drop_column("voice_temperature")
        batch_op.drop_column("voice_type")
        batch_op.drop_column("voice_name")
