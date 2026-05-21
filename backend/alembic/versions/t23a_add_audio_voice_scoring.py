"""Add audio_url and voice_score_status to coaching_sessions.

Revision ID: t23a_audio_voice_scoring
Revises: aec832a08e5c
Create Date: 2026-05-07
"""

import sqlalchemy as sa

from alembic import op

revision = "t23a_audio_voice_scoring"
down_revision = "aec832a08e5c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("coaching_sessions") as batch_op:
        batch_op.add_column(sa.Column("audio_url", sa.Text(), nullable=True))
        batch_op.add_column(
            sa.Column("voice_score_status", sa.String(20), server_default="none", nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("coaching_sessions") as batch_op:
        batch_op.drop_column("voice_score_status")
        batch_op.drop_column("audio_url")
