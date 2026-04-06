"""add performance indexes on frequently queried columns

Revision ID: l15a00000001
Revises: k14a00000001
Create Date: 2026-04-05 10:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "l15a00000001"
down_revision: str | None = "k14a00000001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # coaching_sessions — most queried table in analytics/scoring
    with op.batch_alter_table("coaching_sessions") as batch_op:
        batch_op.create_index("ix_sessions_user_id", ["user_id"])
        batch_op.create_index("ix_sessions_scenario_id", ["scenario_id"])
        batch_op.create_index("ix_sessions_status", ["status"])
        batch_op.create_index("ix_sessions_user_status", ["user_id", "status"])

    # session_messages — always queried by session_id + ordered by message_index
    with op.batch_alter_table("session_messages") as batch_op:
        batch_op.create_index("ix_messages_session_id", ["session_id"])
        batch_op.create_index("ix_messages_session_index", ["session_id", "message_index"])

    # score_details — parent FK lookup
    with op.batch_alter_table("score_details") as batch_op:
        batch_op.create_index("ix_score_details_score_id", ["score_id"])

    # scenarios — FK + status lookups
    with op.batch_alter_table("scenarios") as batch_op:
        batch_op.create_index("ix_scenarios_hcp_profile_id", ["hcp_profile_id"])

    # conference_audience_hcps — FK lookups
    with op.batch_alter_table("conference_audience_hcps") as batch_op:
        batch_op.create_index("ix_conf_audience_scenario_id", ["scenario_id"])
        batch_op.create_index("ix_conf_audience_hcp_profile_id", ["hcp_profile_id"])

    # hcp_profiles — created_by FK
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.create_index("ix_hcp_profiles_created_by", ["created_by"])


def downgrade() -> None:
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.drop_index("ix_hcp_profiles_created_by")

    with op.batch_alter_table("conference_audience_hcps") as batch_op:
        batch_op.drop_index("ix_conf_audience_hcp_profile_id")
        batch_op.drop_index("ix_conf_audience_scenario_id")

    with op.batch_alter_table("scenarios") as batch_op:
        batch_op.drop_index("ix_scenarios_hcp_profile_id")

    with op.batch_alter_table("score_details") as batch_op:
        batch_op.drop_index("ix_score_details_score_id")

    with op.batch_alter_table("session_messages") as batch_op:
        batch_op.drop_index("ix_messages_session_index")
        batch_op.drop_index("ix_messages_session_id")

    with op.batch_alter_table("coaching_sessions") as batch_op:
        batch_op.drop_index("ix_sessions_user_status")
        batch_op.drop_index("ix_sessions_status")
        batch_op.drop_index("ix_sessions_scenario_id")
        batch_op.drop_index("ix_sessions_user_id")
