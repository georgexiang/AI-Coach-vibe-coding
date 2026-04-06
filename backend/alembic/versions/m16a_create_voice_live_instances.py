"""create voice_live_instances table and add FK on hcp_profiles

Revision ID: m16a00000001
Revises: l15a00000001
Create Date: 2026-04-05 14:00:00.000000

"""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "m16a00000001"
down_revision: str | None = "l15a00000001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create voice_live_instances table
    op.create_table(
        "voice_live_instances",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column(
            "voice_live_model", sa.String(50), server_default=sa.text("'gpt-4o'"), nullable=False
        ),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("1"), nullable=False),
        sa.Column(
            "voice_name",
            sa.String(200),
            server_default=sa.text("'en-US-AvaNeural'"),
            nullable=False,
        ),
        sa.Column(
            "voice_type",
            sa.String(50),
            server_default=sa.text("'azure-standard'"),
            nullable=False,
        ),
        sa.Column("voice_temperature", sa.Float(), server_default=sa.text("0.9"), nullable=False),
        sa.Column("voice_custom", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "avatar_character",
            sa.String(100),
            server_default=sa.text("'lori'"),
            nullable=False,
        ),
        sa.Column(
            "avatar_style", sa.String(100), server_default=sa.text("'casual'"), nullable=False
        ),
        sa.Column("avatar_customized", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "turn_detection_type",
            sa.String(50),
            server_default=sa.text("'server_vad'"),
            nullable=False,
        ),
        sa.Column("noise_suppression", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("echo_cancellation", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("eou_detection", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "recognition_language",
            sa.String(20),
            server_default=sa.text("'auto'"),
            nullable=False,
        ),
        sa.Column(
            "agent_instructions_override", sa.Text(), server_default=sa.text("''"), nullable=False
        ),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_vli_created_by", "voice_live_instances", ["created_by"])

    # 2. Add voice_live_instance_id FK to hcp_profiles
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.add_column(
            sa.Column("voice_live_instance_id", sa.String(36), nullable=True)
        )
        batch_op.create_index("ix_hcp_voice_live_instance", ["voice_live_instance_id"])
        batch_op.create_foreign_key(
            "fk_hcp_voice_live_instance",
            "voice_live_instances",
            ["voice_live_instance_id"],
            ["id"],
        )

    # 3. Data migration: create VoiceLiveInstance for each HcpProfile with voice config
    conn = op.get_bind()
    profiles = conn.execute(sa.text("SELECT * FROM hcp_profiles")).fetchall()

    now = datetime.now(UTC).isoformat()
    for profile in profiles:
        # Use dict-style access for Row objects
        profile_dict = profile._mapping
        instance_id = str(uuid.uuid4())
        profile_name = profile_dict["name"]

        conn.execute(
            sa.text(
                """INSERT INTO voice_live_instances
                (id, name, description, voice_live_model, enabled,
                 voice_name, voice_type, voice_temperature, voice_custom,
                 avatar_character, avatar_style, avatar_customized,
                 turn_detection_type, noise_suppression, echo_cancellation,
                 eou_detection, recognition_language, agent_instructions_override,
                 created_by, created_at, updated_at)
                VALUES
                (:id, :name, :description, :model, :enabled,
                 :voice_name, :voice_type, :voice_temp, :voice_custom,
                 :avatar_char, :avatar_style, :avatar_custom,
                 :turn_det, :noise_sup, :echo_cancel,
                 :eou_det, :recog_lang, :agent_instr,
                 :created_by, :created_at, :updated_at)"""
            ),
            {
                "id": instance_id,
                "name": f"VL-{profile_name}",
                "description": f"Auto-migrated from HCP Profile: {profile_name}",
                "model": profile_dict.get("voice_live_model", "gpt-4o") or "gpt-4o",
                "enabled": profile_dict.get("voice_live_enabled", True),
                "voice_name": profile_dict.get("voice_name", "en-US-AvaNeural")
                or "en-US-AvaNeural",
                "voice_type": profile_dict.get("voice_type", "azure-standard") or "azure-standard",
                "voice_temp": profile_dict.get("voice_temperature", 0.9) or 0.9,
                "voice_custom": profile_dict.get("voice_custom", False),
                "avatar_char": profile_dict.get("avatar_character", "lori") or "lori",
                "avatar_style": profile_dict.get("avatar_style", "casual") or "casual",
                "avatar_custom": profile_dict.get("avatar_customized", False),
                "turn_det": profile_dict.get("turn_detection_type", "server_vad") or "server_vad",
                "noise_sup": profile_dict.get("noise_suppression", False),
                "echo_cancel": profile_dict.get("echo_cancellation", False),
                "eou_det": profile_dict.get("eou_detection", False),
                "recog_lang": profile_dict.get("recognition_language", "auto") or "auto",
                "agent_instr": profile_dict.get("agent_instructions_override", "") or "",
                "created_by": profile_dict["created_by"],
                "created_at": now,
                "updated_at": now,
            },
        )

        # Link HcpProfile to its new VoiceLiveInstance
        conn.execute(
            sa.text(
                "UPDATE hcp_profiles SET voice_live_instance_id = :instance_id WHERE id = :pid"
            ),
            {"instance_id": instance_id, "pid": profile_dict["id"]},
        )


def downgrade() -> None:
    with op.batch_alter_table("hcp_profiles") as batch_op:
        batch_op.drop_constraint("fk_hcp_voice_live_instance", type_="foreignkey")
        batch_op.drop_index("ix_hcp_voice_live_instance")
        batch_op.drop_column("voice_live_instance_id")

    op.drop_index("ix_vli_created_by", "voice_live_instances")
    op.drop_table("voice_live_instances")
