"""Add scoring prompt template fields to rubrics.

Revision ID: v28a_scoring_prompt_template
Revises: v27a_voice_scores
Create Date: 2026-06-25
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "v28a_scoring_prompt_template"
down_revision: str = "v27a_voice_scores"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("scoring_rubrics") as batch_op:
        batch_op.add_column(
            sa.Column("prompt_template", sa.Text(), nullable=False, server_default="")
        )
        batch_op.add_column(
            sa.Column("prompt_version", sa.Integer(), nullable=False, server_default="1")
        )


def downgrade() -> None:
    with op.batch_alter_table("scoring_rubrics") as batch_op:
        batch_op.drop_column("prompt_version")
        batch_op.drop_column("prompt_template")
