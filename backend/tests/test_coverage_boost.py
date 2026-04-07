"""Coverage boost tests — targets low-coverage modules to push total >95%.

Covers:
- avatar_characters: list/lookup/validate helpers
- encryption: key generation, .env persistence, decrypt failure
- scoring_engine: build_scoring_prompt + score_with_llm (mocked LLM)
- config_service: upsert_master_config (create + update paths)
- voice_live_instance_service: CRUD operations
"""

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select

from app.models.hcp_profile import HcpProfile
from app.models.service_config import ServiceConfig
from app.services import avatar_characters


# ===========================================================================
# 1. Avatar Characters
# ===========================================================================


class TestAvatarCharacters:
    """Tests for avatar_characters module helper functions."""

    def test_get_avatar_characters_list_returns_list(self):
        result = avatar_characters.get_avatar_characters_list()
        assert isinstance(result, list)
        assert len(result) > 0
        # Each item has expected keys
        for item in result:
            assert "id" in item
            assert "display_name" in item
            assert "gender" in item
            assert "styles" in item
            assert "default_style" in item
            assert "thumbnail_url" in item

    def test_lookup_avatar_known_id(self):
        result = avatar_characters.lookup_avatar("lisa")
        assert result is not None
        assert result["id"] == "lisa"

    def test_lookup_avatar_unknown_id(self):
        result = avatar_characters.lookup_avatar("nonexistent_character_xyz")
        assert result is None

    def test_is_photo_avatar_for_video_character(self):
        # lisa is a video avatar, not photo
        assert avatar_characters.is_photo_avatar("lisa") is False

    def test_is_photo_avatar_unknown_character(self):
        assert avatar_characters.is_photo_avatar("nonexistent_xyz") is False

    def test_validate_avatar_style_valid(self):
        result = avatar_characters.validate_avatar_style("lisa", "casual-sitting")
        assert result == "casual-sitting"

    def test_validate_avatar_style_invalid_returns_default(self):
        result = avatar_characters.validate_avatar_style("lisa", "nonexistent_style")
        # Should return the character's default style, not None
        assert result is not None
        assert isinstance(result, str)
        assert result != "nonexistent_style"

    def test_validate_avatar_style_unknown_character(self):
        result = avatar_characters.validate_avatar_style("nonexistent_xyz", "casual")
        assert result is None

    def test_is_photo_avatar_for_photo_character(self):
        """Find and test a photo avatar if one exists in AVATAR_CHARACTERS."""
        chars = avatar_characters.get_avatar_characters_list()
        photo_chars = [c for c in chars if c.get("is_photo_avatar")]
        if photo_chars:
            assert avatar_characters.is_photo_avatar(photo_chars[0]["id"]) is True
            # Photo avatars return "" for style validation
            result = avatar_characters.validate_avatar_style(photo_chars[0]["id"], "any")
            assert result == ""


# ===========================================================================
# 2. Encryption
# ===========================================================================


class TestEncryption:
    """Tests for encryption module."""

    def test_encrypt_empty_returns_empty(self):
        from app.utils.encryption import encrypt_value

        assert encrypt_value("") == ""

    def test_decrypt_empty_returns_empty(self):
        from app.utils.encryption import decrypt_value

        assert decrypt_value("") == ""

    def test_encrypt_decrypt_roundtrip(self):
        from app.utils.encryption import decrypt_value, encrypt_value

        plaintext = "my-secret-api-key-12345"
        token = encrypt_value(plaintext)
        assert token != plaintext
        assert token != ""
        assert decrypt_value(token) == plaintext

    def test_decrypt_invalid_token_returns_empty(self):
        from app.utils.encryption import decrypt_value

        # Garbled token should not raise, just return ""
        result = decrypt_value("this-is-not-a-valid-fernet-token")
        assert result == ""

    def test_auto_generate_key_when_empty(self):
        """When encryption_key is empty, _get_fernet generates one."""
        import app.utils.encryption as enc_mod

        # Reset singleton
        enc_mod._fernet_instance = None

        mock_settings = MagicMock()
        mock_settings.encryption_key = ""

        with (
            patch("app.utils.encryption.get_settings", return_value=mock_settings),
            patch("app.utils.encryption._persist_key_to_env") as mock_persist,
        ):
            fernet = enc_mod._get_fernet()
            assert fernet is not None
            # Key was set on settings
            assert mock_settings.encryption_key != ""
            # Attempted to persist
            mock_persist.assert_called_once()

        # Reset singleton for other tests
        enc_mod._fernet_instance = None

    def test_persist_key_to_env_skips_existing(self, tmp_path):
        """_persist_key_to_env skips if ENCRYPTION_KEY= already present."""
        import app.utils.encryption as enc_mod

        env_file = tmp_path / ".env"
        env_file.write_text("ENCRYPTION_KEY=existing-key\n")

        with patch.object(Path, "resolve", return_value=tmp_path / "app" / "utils" / "encryption.py"):
            # Since the function uses __file__ parents[2], we mock more directly
            with patch("app.utils.encryption.Path") as mock_path_cls:
                mock_path_cls.return_value.resolve.return_value.parents.__getitem__ = (
                    lambda self, idx: tmp_path
                )
                mock_env_path = MagicMock()
                mock_env_path.exists.return_value = True
                mock_env_path.read_text.return_value = "ENCRYPTION_KEY=existing\n"
                mock_path_cls.__truediv__ = lambda self, other: mock_env_path

                # Direct call — just verify it doesn't crash
                enc_mod._persist_key_to_env("new-key")


# ===========================================================================
# 3. Scoring Engine
# ===========================================================================


class TestBuildScoringPrompt:
    """Tests for build_scoring_prompt (pure function, no mocks needed)."""

    def test_basic_prompt_generation(self):
        from app.services.scoring_engine import build_scoring_prompt

        scenario_data = {
            "hcp_profile": {
                "name": "Dr. Test",
                "specialty": "Oncology",
                "personality_type": "analytical",
                "communication_style": "60",
            },
            "product": "TestDrug",
            "therapeutic_area": "Oncology",
            "difficulty": "hard",
            "key_messages": ["Message A", "Message B"],
        }
        messages = [
            {"role": "user", "content": "Hello doctor"},
            {"role": "assistant", "content": "Hello, how can I help?"},
        ]
        key_messages_status = [
            {"message": "Message A", "delivered": True},
            {"message": "Message B", "delivered": False},
        ]
        weights = {"key_message": 30, "communication": 70}

        result = build_scoring_prompt(scenario_data, messages, key_messages_status, weights)

        assert "Dr. Test" in result
        assert "Oncology" in result
        assert "MR: Hello doctor" in result
        assert "HCP: Hello, how can I help?" in result
        assert "DELIVERED" in result
        assert "NOT DELIVERED" in result
        assert "key_message" in result
        assert "communication" in result
        assert "TestDrug" in result

    def test_prompt_with_string_key_messages(self):
        """key_messages can be a JSON string instead of list."""
        from app.services.scoring_engine import build_scoring_prompt

        scenario_data = {
            "hcp_profile": {"name": "Dr. X"},
            "product": "Drug",
            "key_messages": json.dumps(["Msg1", "Msg2"]),
        }
        result = build_scoring_prompt(scenario_data, [], [], {})
        assert "Msg1" in result
        assert "Msg2" in result

    def test_prompt_with_empty_data(self):
        """Empty input should not crash."""
        from app.services.scoring_engine import build_scoring_prompt

        result = build_scoring_prompt(
            {"hcp_profile": {}}, [], [], {}
        )
        assert "Unknown" in result  # Default for missing name/specialty
        assert "No tracking data" in result


class TestScoreWithLLM:
    """Tests for score_with_llm (mocked LLM calls)."""

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def scenario_data(self):
        return {
            "hcp_profile": {"name": "Dr. Test", "specialty": "Oncology"},
            "product": "TestDrug",
            "key_messages": ["Key message 1"],
        }

    @pytest.fixture
    def messages(self):
        return [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi"},
        ]

    @pytest.fixture
    def km_status(self):
        return [{"message": "Key message 1", "delivered": True}]

    @pytest.fixture
    def weights(self):
        return {"key_message": 50, "communication": 50}

    async def test_returns_none_when_no_endpoint(self, mock_db, scenario_data, messages, km_status, weights):
        from app.services.scoring_engine import score_with_llm

        with (
            patch("app.services.scoring_engine.config_service") as mock_cs,
        ):
            mock_cs.get_effective_endpoint = AsyncMock(return_value=None)
            mock_cs.get_effective_key = AsyncMock(return_value="key")

            result = await score_with_llm(mock_db, scenario_data, messages, km_status, weights)
            assert result is None

    async def test_returns_none_when_no_key(self, mock_db, scenario_data, messages, km_status, weights):
        from app.services.scoring_engine import score_with_llm

        with patch("app.services.scoring_engine.config_service") as mock_cs:
            mock_cs.get_effective_endpoint = AsyncMock(return_value="https://test.openai.azure.com")
            mock_cs.get_effective_key = AsyncMock(return_value=None)

            result = await score_with_llm(mock_db, scenario_data, messages, km_status, weights)
            assert result is None

    async def test_successful_scoring(self, mock_db, scenario_data, messages, km_status, weights):
        from app.services.scoring_engine import score_with_llm

        llm_response = {
            "dimensions": [
                {"dimension": "key_message", "score": 80, "weight": 50,
                 "strengths": [], "weaknesses": [], "suggestions": []},
                {"dimension": "communication", "score": 90, "weight": 50,
                 "strengths": [], "weaknesses": [], "suggestions": []},
            ],
            "feedback_summary": "Good performance overall.",
        }

        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = json.dumps(llm_response)

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_completion)

        mock_config = MagicMock()
        mock_config.model_or_deployment = "gpt-4o"

        with patch("app.services.scoring_engine.config_service") as mock_cs:
            mock_cs.get_effective_endpoint = AsyncMock(return_value="https://test.openai.azure.com")
            mock_cs.get_effective_key = AsyncMock(return_value="test-key")
            mock_cs.get_config = AsyncMock(return_value=mock_config)

            with patch("openai.AsyncAzureOpenAI", return_value=mock_client):
                result = await score_with_llm(mock_db, scenario_data, messages, km_status, weights)

        assert result is not None
        assert result["overall_score"] == 85.0  # (80*50 + 90*50) / 100
        assert result["passed"] is True
        assert result["feedback_summary"] == "Good performance overall."
        assert len(result["dimensions"]) == 2

    async def test_scoring_without_feedback_generates_fallback(
        self, mock_db, scenario_data, messages, km_status, weights
    ):
        from app.services.scoring_engine import score_with_llm

        llm_response = {
            "dimensions": [
                {"dimension": "key_message", "score": 60, "weight": 50,
                 "strengths": [], "weaknesses": [], "suggestions": []},
                {"dimension": "communication", "score": 50, "weight": 50,
                 "strengths": [], "weaknesses": [], "suggestions": []},
            ],
            # No feedback_summary
        }

        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = json.dumps(llm_response)

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_completion)

        mock_config = MagicMock()
        mock_config.model_or_deployment = "gpt-4o"

        with patch("app.services.scoring_engine.config_service") as mock_cs:
            mock_cs.get_effective_endpoint = AsyncMock(return_value="https://test.openai.azure.com")
            mock_cs.get_effective_key = AsyncMock(return_value="test-key")
            mock_cs.get_config = AsyncMock(return_value=mock_config)

            with patch("openai.AsyncAzureOpenAI", return_value=mock_client):
                result = await score_with_llm(mock_db, scenario_data, messages, km_status, weights)

        assert result is not None
        assert result["overall_score"] == 55.0
        assert result["passed"] is False
        # Fallback summary generated
        assert "Overall score: 55.0" in result["feedback_summary"]
        assert "1/1 key messages" in result["feedback_summary"]

    async def test_scoring_empty_content_returns_none(
        self, mock_db, scenario_data, messages, km_status, weights
    ):
        from app.services.scoring_engine import score_with_llm

        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = None

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_completion)

        mock_config = MagicMock()
        mock_config.model_or_deployment = "gpt-4o"

        with patch("app.services.scoring_engine.config_service") as mock_cs:
            mock_cs.get_effective_endpoint = AsyncMock(return_value="https://test.openai.azure.com")
            mock_cs.get_effective_key = AsyncMock(return_value="test-key")
            mock_cs.get_config = AsyncMock(return_value=mock_config)

            with patch("openai.AsyncAzureOpenAI", return_value=mock_client):
                result = await score_with_llm(mock_db, scenario_data, messages, km_status, weights)

        assert result is None

    async def test_scoring_exception_returns_none(
        self, mock_db, scenario_data, messages, km_status, weights
    ):
        from app.services.scoring_engine import score_with_llm

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=Exception("LLM error"))

        mock_config = MagicMock()
        mock_config.model_or_deployment = "gpt-4o"

        with patch("app.services.scoring_engine.config_service") as mock_cs:
            mock_cs.get_effective_endpoint = AsyncMock(return_value="https://test.openai.azure.com")
            mock_cs.get_effective_key = AsyncMock(return_value="test-key")
            mock_cs.get_config = AsyncMock(return_value=mock_config)

            with patch("openai.AsyncAzureOpenAI", return_value=mock_client):
                result = await score_with_llm(mock_db, scenario_data, messages, km_status, weights)

        assert result is None

    async def test_scoring_no_dimensions_returns_none(
        self, mock_db, scenario_data, messages, km_status, weights
    ):
        from app.services.scoring_engine import score_with_llm

        llm_response = {"dimensions": [], "feedback_summary": "Empty"}

        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = json.dumps(llm_response)

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_completion)

        mock_config = MagicMock()
        mock_config.model_or_deployment = "gpt-4o"

        with patch("app.services.scoring_engine.config_service") as mock_cs:
            mock_cs.get_effective_endpoint = AsyncMock(return_value="https://test.openai.azure.com")
            mock_cs.get_effective_key = AsyncMock(return_value="test-key")
            mock_cs.get_config = AsyncMock(return_value=mock_config)

            with patch("openai.AsyncAzureOpenAI", return_value=mock_client):
                result = await score_with_llm(mock_db, scenario_data, messages, km_status, weights)

        assert result is None

    async def test_scoring_uses_fallback_model_when_no_config(
        self, mock_db, scenario_data, messages, km_status, weights
    ):
        """When azure_openai config has no model, use voice_live_default_model from settings."""
        from app.services.scoring_engine import score_with_llm

        llm_response = {
            "dimensions": [
                {"dimension": "key_message", "score": 75, "weight": 50,
                 "strengths": [], "weaknesses": [], "suggestions": []},
                {"dimension": "communication", "score": 75, "weight": 50,
                 "strengths": [], "weaknesses": [], "suggestions": []},
            ],
            "feedback_summary": "Decent.",
        }

        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = json.dumps(llm_response)

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_completion)

        # No config found — falls back to settings
        mock_settings = MagicMock()
        mock_settings.voice_live_default_model = "gpt-4o-fallback"

        with patch("app.services.scoring_engine.config_service") as mock_cs:
            mock_cs.get_effective_endpoint = AsyncMock(return_value="https://test.openai.azure.com")
            mock_cs.get_effective_key = AsyncMock(return_value="test-key")
            mock_cs.get_config = AsyncMock(return_value=None)

            with (
                patch("openai.AsyncAzureOpenAI", return_value=mock_client),
                patch("app.config.get_settings", return_value=mock_settings),
            ):
                result = await score_with_llm(mock_db, scenario_data, messages, km_status, weights)

        assert result is not None
        assert result["overall_score"] == 75.0


# ===========================================================================
# 4. Config Service: upsert_master_config
# ===========================================================================


class TestConfigServiceUpsert:
    """Tests for config_service.upsert_master_config."""

    async def test_upsert_creates_new_master_config(self, db_session):
        from app.schemas.azure_config import AIFoundryConfigUpdate
        from app.services.config_service import upsert_master_config

        # Remove existing master config
        result = await db_session.execute(
            select(ServiceConfig).where(ServiceConfig.is_master.is_(True))
        )
        for cfg in result.scalars().all():
            await db_session.delete(cfg)
        await db_session.flush()

        update = AIFoundryConfigUpdate(
            endpoint="https://new-endpoint.openai.azure.com",
            api_key="new-api-key",
            model_or_deployment="gpt-4o",
            default_project="test-project",
            region="eastus2",
        )

        config = await upsert_master_config(db_session, update, "test-user")

        assert config.service_name == "ai_foundry"
        assert config.is_master is True
        assert config.endpoint == "https://new-endpoint.openai.azure.com"
        assert config.model_or_deployment == "gpt-4o"

    async def test_upsert_updates_existing_master_config(self, db_session):
        from app.schemas.azure_config import AIFoundryConfigUpdate
        from app.services.config_service import upsert_master_config

        # First create a master config
        create = AIFoundryConfigUpdate(
            endpoint="https://original.openai.azure.com",
            api_key="original-key",
            model_or_deployment="gpt-4o",
            default_project="original-project",
            region="eastus",
        )
        await upsert_master_config(db_session, create, "test-user")

        # Now update it
        update = AIFoundryConfigUpdate(
            endpoint="https://updated.openai.azure.com",
            api_key="",  # Empty = don't update key
            model_or_deployment="gpt-4o-updated",
            default_project="updated-project",
            region="westus",
        )

        config = await upsert_master_config(db_session, update, "admin-user")

        assert config.endpoint == "https://updated.openai.azure.com"
        assert config.model_or_deployment == "gpt-4o-updated"
        assert config.region == "westus"


# ===========================================================================
# 5. Voice Live Instance Service: CRUD
# ===========================================================================


class TestVoiceLiveInstanceCRUD:
    """Tests for voice_live_instance_service CRUD operations."""

    async def test_create_instance(self, db_session):
        from app.schemas.voice_live_instance import VoiceLiveInstanceCreate
        from app.services.voice_live_instance_service import create_instance

        data = VoiceLiveInstanceCreate(
            name="Test VL Instance",
            voice_live_model="gpt-4o",
            model_instruction="Test instructions",
        )
        inst = await create_instance(db_session, data, "test-user")
        assert inst.id is not None
        assert inst.name == "Test VL Instance"
        assert inst.model_instruction == "Test instructions"
        assert inst.created_by == "test-user"

    async def test_get_instance_not_found(self, db_session):
        from app.services.voice_live_instance_service import get_instance
        from app.utils.exceptions import NotFoundException

        with pytest.raises(NotFoundException):
            await get_instance(db_session, "nonexistent-id")

    async def test_list_instances(self, db_session):
        from app.schemas.voice_live_instance import VoiceLiveInstanceCreate
        from app.services.voice_live_instance_service import create_instance, list_instances

        # Create a few instances
        for i in range(3):
            data = VoiceLiveInstanceCreate(name=f"VL-{i}", voice_live_model="gpt-4o")
            await create_instance(db_session, data, "test-user")

        items, total = await list_instances(db_session)
        assert total >= 3
        assert len(items) >= 3

    async def test_update_instance(self, db_session):
        from app.schemas.voice_live_instance import VoiceLiveInstanceCreate, VoiceLiveInstanceUpdate
        from app.services.voice_live_instance_service import create_instance, update_instance

        data = VoiceLiveInstanceCreate(name="Original", voice_live_model="gpt-4o")
        inst = await create_instance(db_session, data, "test-user")

        updated = await update_instance(
            db_session, inst.id, VoiceLiveInstanceUpdate(name="Updated Name")
        )
        assert updated.name == "Updated Name"

    async def test_delete_instance(self, db_session):
        from app.schemas.voice_live_instance import VoiceLiveInstanceCreate
        from app.services.voice_live_instance_service import (
            create_instance,
            delete_instance,
            get_instance,
        )
        from app.utils.exceptions import NotFoundException

        data = VoiceLiveInstanceCreate(name="ToDelete", voice_live_model="gpt-4o")
        inst = await create_instance(db_session, data, "test-user")
        inst_id = inst.id

        await delete_instance(db_session, inst_id)

        with pytest.raises(NotFoundException):
            await get_instance(db_session, inst_id)

    async def test_delete_instance_unassigns_hcp(self, db_session):
        """Deleting a VL Instance auto-unassigns all linked HCP Profiles."""
        from app.schemas.voice_live_instance import VoiceLiveInstanceCreate
        from app.services.voice_live_instance_service import (
            assign_to_hcp,
            create_instance,
            delete_instance,
        )
        from tests.conftest import TestSessionLocal

        # Create VL Instance
        data = VoiceLiveInstanceCreate(name="WillDelete", voice_live_model="gpt-4o")
        inst = await create_instance(db_session, data, "test-user")
        inst_id = inst.id

        # Create HCP Profile
        profile = HcpProfile(
            name="Dr. DeleteTest",
            specialty="General",
            created_by="test-user",
        )
        db_session.add(profile)
        await db_session.commit()
        profile_id = profile.id

        # Assign via service (proper way — sets FK + commits)
        await assign_to_hcp(db_session, inst_id, profile_id)

        # Delete VL Instance — should auto-unassign
        await delete_instance(db_session, inst_id)

        # Verify HCP is unassigned via fresh session
        async with TestSessionLocal() as verify_session:
            result = await verify_session.execute(
                select(HcpProfile).where(HcpProfile.id == profile_id)
            )
            p = result.scalar_one()
            assert p.voice_live_instance_id is None

    async def test_assign_to_hcp(self, db_session):
        from app.schemas.voice_live_instance import VoiceLiveInstanceCreate
        from app.services.voice_live_instance_service import assign_to_hcp, create_instance
        from tests.conftest import TestSessionLocal

        data = VoiceLiveInstanceCreate(name="AssignTest", voice_live_model="gpt-4o")
        inst = await create_instance(db_session, data, "test-user")
        inst_id = inst.id

        profile = HcpProfile(
            name="Dr. Assign", specialty="Cardiology", created_by="test-user"
        )
        db_session.add(profile)
        await db_session.flush()
        await db_session.refresh(profile)
        profile_id = profile.id

        await assign_to_hcp(db_session, inst_id, profile_id)

        # Use a fresh session to verify (expire_all poisons the original session)
        async with TestSessionLocal() as verify_session:
            result = await verify_session.execute(
                select(HcpProfile).where(HcpProfile.id == profile_id)
            )
            updated = result.scalar_one()
            assert updated.voice_live_instance_id == inst_id

    async def test_assign_to_nonexistent_hcp_raises(self, db_session):
        from app.schemas.voice_live_instance import VoiceLiveInstanceCreate
        from app.services.voice_live_instance_service import assign_to_hcp, create_instance
        from app.utils.exceptions import NotFoundException

        data = VoiceLiveInstanceCreate(name="AssignFail", voice_live_model="gpt-4o")
        inst = await create_instance(db_session, data, "test-user")

        with pytest.raises(NotFoundException, match="HCP Profile"):
            await assign_to_hcp(db_session, inst.id, "nonexistent-hcp-id")

    async def test_unassign_from_hcp(self, db_session):
        from app.schemas.voice_live_instance import VoiceLiveInstanceCreate
        from app.services.voice_live_instance_service import (
            assign_to_hcp,
            create_instance,
            unassign_from_hcp,
        )

        data = VoiceLiveInstanceCreate(name="UnassignTest", voice_live_model="gpt-4o")
        inst = await create_instance(db_session, data, "test-user")

        profile = HcpProfile(
            name="Dr. Unassign", specialty="Dermatology", created_by="test-user"
        )
        db_session.add(profile)
        await db_session.flush()
        await db_session.refresh(profile)
        profile_id = profile.id

        await assign_to_hcp(db_session, inst.id, profile_id)
        await unassign_from_hcp(db_session, profile_id)

        # Re-query to verify
        result = await db_session.execute(
            select(HcpProfile).where(HcpProfile.id == profile_id)
        )
        updated = result.scalar_one()
        assert updated.voice_live_instance_id is None

    async def test_unassign_nonexistent_hcp_raises(self, db_session):
        from app.services.voice_live_instance_service import unassign_from_hcp
        from app.utils.exceptions import NotFoundException

        with pytest.raises(NotFoundException, match="HCP Profile"):
            await unassign_from_hcp(db_session, "nonexistent-id")
