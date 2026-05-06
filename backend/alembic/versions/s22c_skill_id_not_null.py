"""Make skill_id NOT NULL on scenarios table.

Prerequisites: All scenarios must have a skill_id assigned.
If any scenario has NULL skill_id, this migration will fail with a helpful message.

Revision ID: s22c_skill_id_not_null
Revises: q20a_add_dry_run_tables
Create Date: 2026-05-06
"""

import sqlalchemy as sa

from alembic import op

revision = "s22c_skill_id_not_null"
down_revision = "s22b00000001"
branch_labels = None
depends_on = None


def upgrade():
    # Pre-check: ensure no NULL skill_ids exist
    conn = op.get_bind()
    null_count = conn.execute(
        sa.text("SELECT COUNT(*) FROM scenarios WHERE skill_id IS NULL")
    ).scalar()

    if null_count > 0:
        # Fetch names for helpful error message
        nulls = conn.execute(
            sa.text("SELECT id, name FROM scenarios WHERE skill_id IS NULL LIMIT 10")
        ).fetchall()
        names = ", ".join(f"'{r[1]}' (id={r[0]})" for r in nulls)
        suffix = f" (and {null_count - 10} more)" if null_count > 10 else ""
        raise Exception(
            f"\n\nMIGRATION BLOCKED: {null_count} scenario(s) have no skill assigned:\n"
            f"  {names}{suffix}\n\n"
            f"ACTION REQUIRED: Assign a published skill to all scenarios via the admin UI "
            f"before running this migration.\n"
            f"  URL: /admin/scenarios (edit each scenario and select a Skill)\n"
        )

    # All clear - alter column to NOT NULL and change ondelete from SET NULL to RESTRICT
    with op.batch_alter_table("scenarios") as batch_op:
        batch_op.alter_column("skill_id", existing_type=sa.String(36), nullable=False)
        batch_op.drop_constraint("fk_scenarios_skill_id_skills", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_scenarios_skill_id_skills",
            "skills",
            ["skill_id"],
            ["id"],
            ondelete="RESTRICT",
        )


def downgrade():
    with op.batch_alter_table("scenarios") as batch_op:
        batch_op.alter_column("skill_id", existing_type=sa.String(36), nullable=True)
        batch_op.drop_constraint("fk_scenarios_skill_id_skills", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_scenarios_skill_id_skills",
            "skills",
            ["skill_id"],
            ["id"],
            ondelete="SET NULL",
        )
