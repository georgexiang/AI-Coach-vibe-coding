"""Add Phase 24 focus_instruction, sop_current_step, weight and CU analyzer fields.

Revision ID: u24a_focus_cu_fields
Revises: t23b_score_detail_category
Create Date: 2026-05-13
"""

import sqlalchemy as sa

from alembic import op

revision = "u24a_focus_cu_fields"
down_revision = "t23b_score_detail_category"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # CoachingSession: focus_instruction and sop_current_step
    with op.batch_alter_table("coaching_sessions") as batch_op:
        batch_op.add_column(
            sa.Column("focus_instruction", sa.Text(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("sop_current_step", sa.Integer(), nullable=True, server_default="0")
        )

    # ScoringRubrics: content_weight, voice_weight, cu_content_analyzer_id, cu_voice_analyzer_id
    with op.batch_alter_table("scoring_rubrics") as batch_op:
        batch_op.add_column(
            sa.Column("content_weight", sa.Integer(), nullable=False, server_default="60")
        )
        batch_op.add_column(
            sa.Column("voice_weight", sa.Integer(), nullable=False, server_default="40")
        )
        batch_op.add_column(
            sa.Column("cu_content_analyzer_id", sa.String(255), nullable=True)
        )
        batch_op.add_column(
            sa.Column("cu_voice_analyzer_id", sa.String(255), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("scoring_rubrics") as batch_op:
        batch_op.drop_column("cu_voice_analyzer_id")
        batch_op.drop_column("cu_content_analyzer_id")
        batch_op.drop_column("voice_weight")
        batch_op.drop_column("content_weight")

    with op.batch_alter_table("coaching_sessions") as batch_op:
        batch_op.drop_column("sop_current_step")
        batch_op.drop_column("focus_instruction")
