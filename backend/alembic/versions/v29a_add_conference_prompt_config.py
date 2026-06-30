"""Add conference prompt config to scenarios.

Revision ID: v29a_conference_prompt_config
Revises: v28b_restore_default_rubric
Create Date: 2026-06-26
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "v29a_conference_prompt_config"
down_revision: str | None = "v28b_restore_default_rubric"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("scenarios") as batch_op:
        batch_op.add_column(
            sa.Column("conference_prompt_config", sa.Text(), nullable=False, server_default="{}")
        )


def downgrade() -> None:
    with op.batch_alter_table("scenarios") as batch_op:
        batch_op.drop_column("conference_prompt_config")
