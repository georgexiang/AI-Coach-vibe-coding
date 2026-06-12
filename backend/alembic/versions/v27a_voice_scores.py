"""Create separate voice score tables.

Revision ID: v27a_voice_scores
Revises: v26a_skill_materials
Create Date: 2026-06-11
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "v27a_voice_scores"
down_revision: str = "v26a_skill_materials"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("voice_scores"):
        op.create_table(
            "voice_scores",
            sa.Column("session_id", sa.String(36), nullable=False),
            sa.Column("overall_voice_score", sa.Float(), nullable=False),
            sa.Column("feedback_summary", sa.Text(), nullable=False, server_default=""),
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["session_id"], ["coaching_sessions.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("session_id"),
        )
        op.create_index("ix_voice_scores_session_id", "voice_scores", ["session_id"])

    if not inspector.has_table("voice_score_details"):
        op.create_table(
            "voice_score_details",
            sa.Column("voice_score_id", sa.String(36), nullable=False),
            sa.Column("dimension", sa.String(50), nullable=False),
            sa.Column("score", sa.Float(), nullable=False),
            sa.Column("weight", sa.Integer(), nullable=False),
            sa.Column("strengths", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("weaknesses", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("suggestions", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("category", sa.String(20), nullable=False, server_default="voice"),
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["voice_score_id"], ["voice_scores.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_voice_score_details_voice_score_id",
            "voice_score_details",
            ["voice_score_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("voice_score_details"):
        op.drop_index("ix_voice_score_details_voice_score_id", table_name="voice_score_details")
        op.drop_table("voice_score_details")
    if inspector.has_table("voice_scores"):
        op.drop_index("ix_voice_scores_session_id", table_name="voice_scores")
        op.drop_table("voice_scores")
