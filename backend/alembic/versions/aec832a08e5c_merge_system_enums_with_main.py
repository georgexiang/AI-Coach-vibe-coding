"""merge system_enums with main

Revision ID: aec832a08e5c
Revises: ed6e59a95958, s22d_system_enums
Create Date: 2026-05-06 21:22:47.198736

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aec832a08e5c'
down_revision: Union[str, None] = ('ed6e59a95958', 's22d_system_enums')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
