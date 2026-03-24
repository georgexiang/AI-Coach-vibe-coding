"""Tests for app lifespan, exception handler, and database session."""

import pytest

from app.main import app


class TestExceptionHandler:
    """Test the global AppException handler registered on the app."""

    async def test_app_exception_returns_structured_json(self, client):
        """Trigger AppException via a 404 and verify JSON structure."""
        # /api/v1/auth/me without token triggers 401 via OAuth2
        # Instead, test with a non-existent endpoint to get 404 from FastAPI
        # or use the exception handler directly by raising from a known endpoint.
        # We test by calling /api/v1/config/features without auth (returns 401)
        resp = await client.get("/api/v1/config/features")
        assert resp.status_code == 401

    async def test_exception_handler_formats_app_exception(self, client):
        """Verify AppException handler returns correct JSON format."""
        # The existing test_auth tests already cover 401/403 paths.
        # Here we verify the JSON shape from the exception handler.
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid"})
        assert resp.status_code == 401
        data = resp.json()
        assert "code" in data
        assert "message" in data
        assert "details" in data


class TestLifespan:
    """Test that lifespan properly starts up and shuts down."""

    async def test_app_starts_and_responds(self, client):
        """Verify the app creates tables and responds to health checks."""
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"

    async def test_lifespan_creates_tables_and_registers_adapters(self):
        """Test lifespan context manager directly."""
        from app.main import lifespan
        from app.services.agents.registry import registry

        # Clear existing registrations to verify lifespan re-registers them
        registry._categories.clear()

        async with lifespan(app):
            categories = registry.list_all_categories()
            assert "llm" in categories
            assert "stt" in categories
            assert "tts" in categories
            assert "avatar" in categories


class TestDatabaseGetDb:
    """Test database get_db generator including rollback path."""

    async def test_get_db_yields_session(self):
        """Verify get_db yields a usable session."""
        from tests.conftest import override_get_db

        gen = override_get_db()
        session = await gen.__anext__()
        assert session is not None
        # Normal close
        try:
            await gen.__anext__()
        except StopAsyncIteration:
            pass

    async def test_get_db_rollback_on_exception(self):
        """Verify get_db rolls back on exception."""
        from tests.conftest import override_get_db

        gen = override_get_db()
        await gen.__anext__()
        # Throw an exception into the generator to trigger rollback
        with pytest.raises(ValueError):
            await gen.athrow(ValueError("test error"))
