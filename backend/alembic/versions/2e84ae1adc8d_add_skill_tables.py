"""add skill tables

Revision ID: 2e84ae1adc8d
Revises: d8179cc74fe2
Create Date: 2026-04-11 14:57:09.683409

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e84ae1adc8d'
down_revision: Union[str, None] = 'd8179cc74fe2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create skills table
    op.create_table('skills',
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), server_default='', nullable=False),
    sa.Column('product', sa.String(length=255), server_default='', nullable=False),
    sa.Column('therapeutic_area', sa.String(length=255), server_default='', nullable=False),
    sa.Column('compatibility', sa.String(length=255), server_default='', nullable=False),
    sa.Column('metadata_json', sa.Text(), server_default='{}', nullable=False),
    sa.Column('tags', sa.Text(), server_default='', nullable=False),
    sa.Column('content', sa.Text(), server_default='', nullable=False),
    sa.Column('status', sa.String(length=20), server_default='draft', nullable=False),
    sa.Column('current_version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('created_by', sa.String(length=36), nullable=False),
    sa.Column('updated_by', sa.String(length=36), server_default='', nullable=False),
    sa.Column('structure_check_passed', sa.Boolean(), nullable=True),
    sa.Column('structure_check_details', sa.Text(), server_default='{}', nullable=False),
    sa.Column('quality_score', sa.Integer(), nullable=True),
    sa.Column('quality_verdict', sa.String(length=20), nullable=True),
    sa.Column('quality_details', sa.Text(), server_default='{}', nullable=False),
    sa.Column('conversion_status', sa.String(length=20), nullable=True),
    sa.Column('conversion_error', sa.Text(), server_default='', nullable=False),
    sa.Column('conversion_job_id', sa.String(length=36), nullable=True),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('skills', schema=None) as batch_op:
        batch_op.create_index('ix_skills_created_at', ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_skills_product'), ['product'], unique=False)
        batch_op.create_index(batch_op.f('ix_skills_status'), ['status'], unique=False)
        batch_op.create_index('ix_skills_status_product', ['status', 'product'], unique=False)

    # Create skill_versions table
    op.create_table('skill_versions',
    sa.Column('skill_id', sa.String(length=36), nullable=False),
    sa.Column('version_number', sa.Integer(), nullable=False),
    sa.Column('content', sa.Text(), server_default='', nullable=False),
    sa.Column('metadata_json', sa.Text(), server_default='{}', nullable=False),
    sa.Column('change_notes', sa.Text(), server_default='', nullable=False),
    sa.Column('is_published', sa.Boolean(), server_default='0', nullable=False),
    sa.Column('created_by', sa.String(length=36), server_default='', nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('skill_versions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_skill_versions_skill_id'), ['skill_id'], unique=False)

    # Create skill_resources table
    op.create_table('skill_resources',
    sa.Column('skill_id', sa.String(length=36), nullable=False),
    sa.Column('version_id', sa.String(length=36), nullable=True),
    sa.Column('resource_type', sa.String(length=20), nullable=False),
    sa.Column('filename', sa.String(length=255), nullable=False),
    sa.Column('storage_path', sa.String(length=500), nullable=False),
    sa.Column('content_type', sa.String(length=100), server_default='', nullable=False),
    sa.Column('file_size', sa.Integer(), server_default='0', nullable=False),
    sa.Column('text_content', sa.Text(), server_default='', nullable=False),
    sa.Column('extraction_status', sa.String(length=20), nullable=True),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['version_id'], ['skill_versions.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('skill_resources', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_skill_resources_skill_id'), ['skill_id'], unique=False)
        batch_op.create_index('ix_skill_resources_skill_type', ['skill_id', 'resource_type'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('skill_resources', schema=None) as batch_op:
        batch_op.drop_index('ix_skill_resources_skill_type')
        batch_op.drop_index(batch_op.f('ix_skill_resources_skill_id'))

    op.drop_table('skill_resources')
    with op.batch_alter_table('skill_versions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_skill_versions_skill_id'))

    op.drop_table('skill_versions')
    with op.batch_alter_table('skills', schema=None) as batch_op:
        batch_op.drop_index('ix_skills_status_product')
        batch_op.drop_index(batch_op.f('ix_skills_status'))
        batch_op.drop_index(batch_op.f('ix_skills_product'))
        batch_op.drop_index('ix_skills_created_at')

    op.drop_table('skills')
