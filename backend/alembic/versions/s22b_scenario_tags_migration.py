"""Add tags column, migrate data from product/therapeutic_area, drop old columns.

Revision ID: s22b00000001
Revises: ed6e59a95958
Create Date: 2026-05-06 08:00:00.000000

"""

import json
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "s22b00000001"
down_revision: str = "ed6e59a95958"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Step 1: Add tags column
    with op.batch_alter_table("scenarios") as batch_op:
        batch_op.add_column(sa.Column("tags", sa.Text(), server_default="[]", nullable=False))

    # Step 2: Migrate existing data from product/therapeutic_area to tags
    conn = op.get_bind()
    scenarios = conn.execute(sa.text("SELECT id, product, therapeutic_area FROM scenarios"))
    for row in scenarios:
        tags = []
        if row.product:
            tags.append(f"product:{row.product}")
        if row.therapeutic_area:
            tags.append(f"therapeutic_area:{row.therapeutic_area}")
        conn.execute(
            sa.text("UPDATE scenarios SET tags = :tags WHERE id = :id"),
            {"tags": json.dumps(tags), "id": row.id},
        )

    # Step 3: Drop old columns
    with op.batch_alter_table("scenarios") as batch_op:
        batch_op.drop_column("product")
        batch_op.drop_column("therapeutic_area")


def downgrade() -> None:
    # Reverse: add old columns back, migrate tags data back, drop tags
    with op.batch_alter_table("scenarios") as batch_op:
        batch_op.add_column(sa.Column("product", sa.String(255), server_default=""))
        batch_op.add_column(sa.Column("therapeutic_area", sa.String(255), server_default=""))

    conn = op.get_bind()
    scenarios = conn.execute(sa.text("SELECT id, tags FROM scenarios"))
    for row in scenarios:
        tags = json.loads(row.tags) if row.tags else []
        product = ""
        therapeutic_area = ""
        for tag in tags:
            if tag.startswith("product:"):
                product = tag.split(":", 1)[1]
            elif tag.startswith("therapeutic_area:"):
                therapeutic_area = tag.split(":", 1)[1]
        conn.execute(
            sa.text(
                "UPDATE scenarios SET product = :product, therapeutic_area = :area WHERE id = :id"
            ),
            {"product": product, "area": therapeutic_area, "id": row.id},
        )

    with op.batch_alter_table("scenarios") as batch_op:
        batch_op.drop_column("tags")
