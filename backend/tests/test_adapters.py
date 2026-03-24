"""Tests for STT, TTS, Avatar adapters and ServiceRegistry."""

from app.services.agents.avatar.mock import MockAvatarAdapter
from app.services.agents.registry import ServiceRegistry
from app.services.agents.stt.mock import MockSTTAdapter
from app.services.agents.tts.mock import MockTTSAdapter

# --- STT Adapter Tests ---


class TestMockSTTAdapter:
    async def test_transcribe_returns_nonempty_string(self):
        adapter = MockSTTAdapter()
        result = await adapter.transcribe(b"audio_data", "zh-CN")
        assert isinstance(result, str)
        assert len(result) > 0

    async def test_is_available_returns_true(self):
        adapter = MockSTTAdapter()
        assert await adapter.is_available() is True

    async def test_name_is_mock(self):
        adapter = MockSTTAdapter()
        assert adapter.name == "mock"

    async def test_transcribe_includes_language(self):
        adapter = MockSTTAdapter()
        result = await adapter.transcribe(b"audio_data", "zh-CN")
        assert "zh-CN" in result

    async def test_get_supported_languages(self):
        adapter = MockSTTAdapter()
        languages = await adapter.get_supported_languages()
        assert "zh-CN" in languages
        assert "en-US" in languages


# --- TTS Adapter Tests ---


class TestMockTTSAdapter:
    async def test_synthesize_returns_nonempty_bytes(self):
        adapter = MockTTSAdapter()
        result = await adapter.synthesize("hello", "zh-CN")
        assert isinstance(result, bytes)
        assert len(result) > 0

    async def test_is_available_returns_true(self):
        adapter = MockTTSAdapter()
        assert await adapter.is_available() is True

    async def test_name_is_mock(self):
        adapter = MockTTSAdapter()
        assert adapter.name == "mock"

    async def test_list_voices_returns_list(self):
        adapter = MockTTSAdapter()
        voices = await adapter.list_voices("zh-CN")
        assert isinstance(voices, list)
        assert len(voices) > 0
        assert "id" in voices[0]


# --- Avatar Adapter Tests ---


class TestMockAvatarAdapter:
    async def test_is_available_returns_true(self):
        adapter = MockAvatarAdapter()
        assert await adapter.is_available() is True

    async def test_create_session_returns_dict_with_session_id(self):
        adapter = MockAvatarAdapter()
        session = await adapter.create_session()
        assert isinstance(session, dict)
        assert "session_id" in session

    async def test_send_text_returns_dict(self):
        adapter = MockAvatarAdapter()
        result = await adapter.send_text("session-1", "Hello doctor")
        assert isinstance(result, dict)
        assert "status" in result

    async def test_close_session_does_not_raise(self):
        adapter = MockAvatarAdapter()
        await adapter.close_session("session-1")  # Should not raise

    async def test_name_is_mock(self):
        adapter = MockAvatarAdapter()
        assert adapter.name == "mock"


# --- ServiceRegistry Tests ---


class TestServiceRegistry:
    def setup_method(self):
        """Reset singleton state before each test."""
        ServiceRegistry._instance = None
        ServiceRegistry._categories = {}

    async def test_register_and_get(self):
        reg = ServiceRegistry()
        mock_stt = MockSTTAdapter()
        reg.register("stt", mock_stt)
        assert reg.get("stt", "mock") is mock_stt

    async def test_get_returns_none_for_missing(self):
        reg = ServiceRegistry()
        assert reg.get("stt", "nonexistent") is None

    async def test_list_category(self):
        reg = ServiceRegistry()
        mock_stt = MockSTTAdapter()
        reg.register("stt", mock_stt)
        assert reg.list_category("stt") == ["mock"]

    async def test_list_category_empty(self):
        reg = ServiceRegistry()
        assert reg.list_category("nonexistent") == []

    async def test_discover_category(self):
        reg = ServiceRegistry()
        mock_stt = MockSTTAdapter()
        reg.register("stt", mock_stt)
        available = await reg.discover_category("stt")
        assert available == ["mock"]

    async def test_multiple_categories_independent(self):
        reg = ServiceRegistry()
        mock_stt = MockSTTAdapter()
        mock_tts = MockTTSAdapter()
        mock_avatar = MockAvatarAdapter()
        reg.register("stt", mock_stt)
        reg.register("tts", mock_tts)
        reg.register("avatar", mock_avatar)
        assert reg.list_category("stt") == ["mock"]
        assert reg.list_category("tts") == ["mock"]
        assert reg.list_category("avatar") == ["mock"]
        assert reg.get("stt", "mock") is mock_stt
        assert reg.get("tts", "mock") is mock_tts

    async def test_list_all_categories(self):
        reg = ServiceRegistry()
        reg.register("stt", MockSTTAdapter())
        reg.register("tts", MockTTSAdapter())
        all_cats = reg.list_all_categories()
        assert "stt" in all_cats
        assert "tts" in all_cats
        assert all_cats["stt"] == ["mock"]
        assert all_cats["tts"] == ["mock"]
