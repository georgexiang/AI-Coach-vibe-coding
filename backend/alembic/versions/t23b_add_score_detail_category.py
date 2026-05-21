"""Add category column to score_details for content/voice distinction.

Revision ID: t23b_score_detail_category
Revises: t23a_audio_voice_scoring
Create Date: 2026-05-07
"""

import sqlalchemy as sa

from alembic import op

revision = "t23b_score_detail_category"
down_revision = "t23a_audio_voice_scoring"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("score_details") as batch_op:
        batch_op.add_column(
            sa.Column("category", sa.String(20), server_default="content")
        )


def downgrade() -> None:
    with op.batch_alter_table("score_details") as batch_op:
        batch_op.drop_column("category")
