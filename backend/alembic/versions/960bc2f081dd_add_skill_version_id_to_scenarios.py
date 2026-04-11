"""add skill_version_id to scenarios

Revision ID: 960bc2f081dd
Revises: 2e84ae1adc8d
Create Date: 2026-04-11 15:58:26.394728

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "960bc2f081dd"
down_revision: Union[str, None] = "2e84ae1adc8d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("scenarios", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("skill_id", sa.String(length=36), nullable=True, server_default=sa.text("NULL"))
        )
        batch_op.add_column(
            sa.Column(
                "skill_version_id",
                sa.String(length=36),
                nullable=True,
                server_default=sa.text("NULL"),
            )
        )
        batch_op.create_foreign_key(
            "fk_scenarios_skill_id", "skills", ["skill_id"], ["id"], ondelete="SET NULL"
        )
        batch_op.create_foreign_key(
            "fk_scenarios_skill_version_id",
            "skill_versions",
            ["skill_version_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("scenarios", schema=None) as batch_op:
        batch_op.drop_constraint("fk_scenarios_skill_version_id", type_="foreignkey")
        batch_op.drop_constraint("fk_scenarios_skill_id", type_="foreignkey")
        batch_op.drop_column("skill_version_id")
        batch_op.drop_column("skill_id")
