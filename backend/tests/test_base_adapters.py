"""Tests for abstract base adapter default methods."""

from app.services.agents.base import BaseCoachingAdapter, CoachEvent, CoachEventType
from app.services.agents.stt.base import BaseSTTAdapter
from app.services.agents.tts.base import BaseTTSAdapter


class ConcreteCoachingAdapter(BaseCoachingAdapter):
    """Minimal concrete implementation for testing base class defaults."""

    name = "test"

    async def execute(self, request):
        yield CoachEvent(type=CoachEventType.DONE, content="done")

    async def is_available(self):
        return True


class ConcreteTTSAdapter(BaseTTSAdapter):
    """Minimal concrete implementation for testing base class defaults."""

    name = "test-tts"

    async def synthesize(self, text, language="zh-CN", voice=None):
        return b"audio"

    async def is_available(self):
        return True


class ConcreteSTTAdapter(BaseSTTAdapter):
    """Minimal concrete implementation for testing base class defaults."""

    name = "test-stt"

    async def transcribe(self, audio_data, language="zh-CN"):
        return "text"

    async def is_available(self):
        return True


class TestBaseCoachingAdapterDefaults:
    async def test_get_version_returns_none(self):
        adapter = ConcreteCoachingAdapter()
        version = await adapter.get_version()
        assert version is None


class TestBaseTTSAdapterDefaults:
    async def test_list_voices_returns_empty_list(self):
        adapter = ConcreteTTSAdapter()
        voices = await adapter.list_voices()
        assert voices == []

    async def test_list_voices_with_language(self):
        adapter = ConcreteTTSAdapter()
        voices = await adapter.list_voices(language="en-US")
        assert voices == []


class TestBaseSTTAdapterDefaults:
    async def test_get_supported_languages_returns_defaults(self):
        adapter = ConcreteSTTAdapter()
        languages = await adapter.get_supported_languages()
        assert "zh-CN" in languages
        assert "en-US" in languages
