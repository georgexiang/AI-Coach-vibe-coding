"""add skill audit trail to coaching sessions

Revision ID: df6cb9a8d3c1
Revises: 089e4862b719
Create Date: 2026-04-11 22:01:13.395659

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'df6cb9a8d3c1'
down_revision: Union[str, None] = '089e4862b719'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('coaching_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('skill_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('skill_version_id', sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            'fk_session_skill_id', 'skills', ['skill_id'], ['id'], ondelete='SET NULL'
        )
        batch_op.create_foreign_key(
            'fk_session_skill_version_id', 'skill_versions',
            ['skill_version_id'], ['id'], ondelete='SET NULL'
        )


def downgrade() -> None:
    with op.batch_alter_table('coaching_sessions', schema=None) as batch_op:
        batch_op.drop_constraint('fk_session_skill_version_id', type_='foreignkey')
        batch_op.drop_constraint('fk_session_skill_id', type_='foreignkey')
        batch_op.drop_column('skill_version_id')
        batch_op.drop_column('skill_id')
