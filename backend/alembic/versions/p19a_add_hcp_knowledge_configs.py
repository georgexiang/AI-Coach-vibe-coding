"""add hcp_knowledge_configs table for multi-KB per HCP

Revision ID: p19a00000001
Revises: o18a00000001
Create Date: 2026-04-10 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "p19a00000001"
down_revision: str = "o18a00000001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "hcp_knowledge_configs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "hcp_profile_id",
            sa.String(36),
            sa.ForeignKey("hcp_profiles.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("connection_name", sa.String(255), nullable=False),
        sa.Column("connection_target", sa.String(500), server_default="", nullable=False),
        sa.Column("index_name", sa.String(255), nullable=False),
        sa.Column("server_label", sa.String(255), server_default="", nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("hcp_knowledge_configs")
