"""merge heads

Revision ID: 095eed0918dc
Revises: 50811ca8b0f6, q20a00000001
Create Date: 2026-04-27 09:04:04.546212

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '095eed0918dc'
down_revision: Union[str, None] = ('50811ca8b0f6', 'q20a00000001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
