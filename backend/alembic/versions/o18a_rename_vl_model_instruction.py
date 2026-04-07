"""rename voice_live_instances.agent_instructions_override to model_instruction

VoiceLiveInstance is a model/API configuration, not an agent.
Only HcpProfile has agent_instructions_override (it IS the agent).

Revision ID: o18a00000001
Revises: n17a00000001
Create Date: 2026-04-07 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "o18a00000001"
down_revision: str = "n17a00000001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # SQLite >= 3.25.0 supports ALTER TABLE ... RENAME COLUMN
    with op.batch_alter_table("voice_live_instances") as batch_op:
        batch_op.alter_column(
            "agent_instructions_override",
            new_column_name="model_instruction",
        )


def downgrade() -> None:
    with op.batch_alter_table("voice_live_instances") as batch_op:
        batch_op.alter_column(
            "model_instruction",
            new_column_name="agent_instructions_override",
        )
