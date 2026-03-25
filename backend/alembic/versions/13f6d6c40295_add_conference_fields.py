"""add conference fields

Revision ID: 13f6d6c40295
Revises: b148c6bf1d9b
Create Date: 2026-03-25 18:14:23.619584

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "13f6d6c40295"
down_revision: Union[str, None] = "b148c6bf1d9b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create conference_audience_hcps table
    op.create_table(
        "conference_audience_hcps",
        sa.Column("scenario_id", sa.String(length=36), nullable=False),
        sa.Column("hcp_profile_id", sa.String(length=36), nullable=False),
        sa.Column("role_in_conference", sa.String(length=50), nullable=False),
        sa.Column("voice_id", sa.String(length=100), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["hcp_profile_id"], ["hcp_profiles.id"]),
        sa.ForeignKeyConstraint(["scenario_id"], ["scenarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # Add conference columns to coaching_sessions
    with op.batch_alter_table("coaching_sessions", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "session_type",
                sa.String(length=20),
                nullable=False,
                server_default=sa.text("'f2f'"),
            )
        )
        batch_op.add_column(
            sa.Column(
                "sub_state",
                sa.String(length=20),
                nullable=False,
                server_default=sa.text("''"),
            )
        )
        batch_op.add_column(sa.Column("presentation_topic", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("audience_config", sa.Text(), nullable=True))

    # Add speaker attribution columns to session_messages
    with op.batch_alter_table("session_messages", schema=None) as batch_op:
        batch_op.add_column(sa.Column("speaker_id", sa.String(length=36), nullable=True))
        batch_op.add_column(
            sa.Column(
                "speaker_name",
                sa.String(length=255),
                nullable=False,
                server_default=sa.text("''"),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("session_messages", schema=None) as batch_op:
        batch_op.drop_column("speaker_name")
        batch_op.drop_column("speaker_id")

    with op.batch_alter_table("coaching_sessions", schema=None) as batch_op:
        batch_op.drop_column("audience_config")
        batch_op.drop_column("presentation_topic")
        batch_op.drop_column("sub_state")
        batch_op.drop_column("session_type")

    op.drop_table("conference_audience_hcps")
