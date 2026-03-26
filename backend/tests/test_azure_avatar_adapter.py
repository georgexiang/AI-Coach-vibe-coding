"""Tests for AzureAvatarAdapter stub implementation."""

from app.services.agents.avatar.azure import AzureAvatarAdapter


class TestAzureAvatarAdapter:
    """Tests for the Azure Avatar adapter stub."""

    def test_name_attribute(self):
        """Adapter name is 'azure'."""
        adapter = AzureAvatarAdapter()
        assert adapter.name == "azure"

    async def test_is_available_returns_false(self):
        """Stub adapter is not available."""
        adapter = AzureAvatarAdapter()
        result = await adapter.is_available()
        assert result is False

    async def test_create_session_returns_stub(self):
        """create_session returns unavailable stub dict."""
        adapter = AzureAvatarAdapter()
        result = await adapter.create_session()
        assert isinstance(result, dict)
        assert result["status"] == "unavailable"
        assert "session_id" in result

    async def test_create_session_with_custom_avatar_id(self):
        """create_session accepts avatar_id parameter."""
        adapter = AzureAvatarAdapter()
        result = await adapter.create_session(avatar_id="custom-avatar")
        assert isinstance(result, dict)
        assert result["status"] == "unavailable"

    async def test_send_text_returns_stub(self):
        """send_text returns unavailable stub dict with zero duration."""
        adapter = AzureAvatarAdapter()
        result = await adapter.send_text("session-1", "Hello world")
        assert isinstance(result, dict)
        assert result["status"] == "unavailable"
        assert result["duration_ms"] == 0

    async def test_close_session_is_noop(self):
        """close_session completes without error."""
        adapter = AzureAvatarAdapter()
        # Should not raise
        result = await adapter.close_session("session-1")
        assert result is None

    def test_constructor_accepts_credentials(self):
        """Constructor stores endpoint and key."""
        adapter = AzureAvatarAdapter(endpoint="https://test.azure.com", key="secret")
        assert adapter._endpoint == "https://test.azure.com"
        assert adapter._key == "secret"

    def test_constructor_defaults(self):
        """Constructor has empty string defaults."""
        adapter = AzureAvatarAdapter()
        assert adapter._endpoint == ""
        assert adapter._key == ""
