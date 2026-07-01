"""add meta_skills table

Revision ID: 50811ca8b0f6
Revises: df6cb9a8d3c1
Create Date: 2026-04-11 23:37:33.020793

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "50811ca8b0f6"
down_revision: str | None = "df6cb9a8d3c1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "meta_skills",
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("skill_type", sa.String(20), nullable=False),
        sa.Column("agent_id", sa.String(100), server_default="", nullable=False),
        sa.Column("agent_version", sa.String(50), server_default="", nullable=False),
        sa.Column("model", sa.String(100), server_default="gpt-4o", nullable=False),
        sa.Column("template_content", sa.Text(), server_default="", nullable=False),
        sa.Column("template_language", sa.String(10), server_default="en", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_meta_skills_name", "meta_skills", ["name"], unique=True)
    op.create_index("ix_meta_skills_skill_type", "meta_skills", ["skill_type"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_meta_skills_skill_type", table_name="meta_skills")
    op.drop_index("ix_meta_skills_name", table_name="meta_skills")
    op.drop_table("meta_skills")
