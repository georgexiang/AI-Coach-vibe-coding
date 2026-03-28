"""add_service_config_table

Revision ID: 35e15f5ae427
Revises: e8cd533abc43
Create Date: 2026-03-27 11:14:14.737678

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '35e15f5ae427'
down_revision: str | None = 'e8cd533abc43'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('service_configs',
    sa.Column('service_name', sa.String(length=50), nullable=False),
    sa.Column('display_name', sa.String(length=100), nullable=False),
    sa.Column('endpoint', sa.String(length=500), server_default='', nullable=False),
    sa.Column('api_key_encrypted', sa.Text(), server_default='', nullable=False),
    sa.Column('model_or_deployment', sa.String(length=100), server_default='', nullable=False),
    sa.Column('region', sa.String(length=50), server_default='', nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default=sa.text('0'), nullable=False),
    sa.Column('updated_by', sa.String(length=36), server_default='', nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('service_configs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_service_configs_service_name'), ['service_name'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('service_configs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_service_configs_service_name'))

    op.drop_table('service_configs')
