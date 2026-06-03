"""add dry_runs and dry_run_messages tables for skill simulation

Revision ID: q20a00000001
Revises: p19a00000001
Create Date: 2026-04-26 16:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "q20a00000001"
down_revision: str = "p19a00000001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = "960bc2f081dd"


def upgrade() -> None:
    op.create_table(
        "dry_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "skill_id",
            sa.String(36),
            sa.ForeignKey("skills.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "skill_version_id",
            sa.String(36),
            sa.ForeignKey("skill_versions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False, index=True),
        sa.Column("run_number", sa.Integer(), nullable=False),
        sa.Column("executability_score", sa.Integer(), nullable=True),
        sa.Column("coverage_percent", sa.Integer(), nullable=True),
        sa.Column("total_sop_steps", sa.Integer(), server_default="0", nullable=False),
        sa.Column("covered_sop_steps", sa.Integer(), server_default="0", nullable=False),
        sa.Column("partial_sop_steps", sa.Integer(), server_default="0", nullable=False),
        sa.Column("issues_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("issues_json", sa.Text(), server_default="[]", nullable=False),
        sa.Column("sop_coverage_json", sa.Text(), server_default="[]", nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), server_default="", nullable=False),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_dry_runs_skill_status", "dry_runs", ["skill_id", "status"])
    op.create_index("ix_dry_runs_created_at", "dry_runs", ["created_at"])

    op.create_table(
        "dry_run_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "dry_run_id",
            sa.String(36),
            sa.ForeignKey("dry_runs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sop_step_id", sa.String(50), nullable=True),
        sa.Column("sop_step_name", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("dry_run_messages")
    op.drop_table("dry_runs")
