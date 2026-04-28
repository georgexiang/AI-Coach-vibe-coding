"""merge rubric_id migration with agent_audit

Revision ID: ed6e59a95958
Revises: 294a0e3dcd41, h21a00000001
Create Date: 2026-04-28 09:07:10.578293

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ed6e59a95958'
down_revision: Union[str, None] = ('294a0e3dcd41', 'h21a00000001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
