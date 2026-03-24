"""Authentication service and endpoint tests."""

import pytest
from jose import jwt

from app.config import get_settings

settings = get_settings()


# === Unit tests for auth service ===


class TestPasswordHashing:
    """Tests for password hashing utilities."""

    async def test_verify_password_returns_true_for_matching(self):
        from app.services.auth import get_password_hash, verify_password

        hashed = get_password_hash("mysecretpassword")
        assert verify_password("mysecretpassword", hashed) is True

    async def test_verify_password_returns_false_for_non_matching(self):
        from app.services.auth import get_password_hash, verify_password

        hashed = get_password_hash("mysecretpassword")
        assert verify_password("wrongpassword", hashed) is False

    async def test_get_password_hash_returns_bcrypt_hash(self):
        from app.services.auth import get_password_hash

        hashed = get_password_hash("testpassword")
        assert hashed.startswith("$2b$")


class TestJWTCreation:
    """Tests for JWT token creation."""

    async def test_create_access_token_returns_decodable_jwt(self):
        from app.services.auth import create_access_token

        token = create_access_token(data={"sub": "user-123"})
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["sub"] == "user-123"
        assert "exp" in payload

    async def test_create_access_token_with_custom_expires_delta(self):
        from datetime import timedelta

        from app.services.auth import create_access_token

        token = create_access_token(data={"sub": "user-456"}, expires_delta=timedelta(minutes=5))
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["sub"] == "user-456"


class TestAuthenticateUser:
    """Tests for user authentication."""

    async def test_authenticate_user_returns_user_for_valid_credentials(self, db_session):
        from app.models.user import User
        from app.services.auth import authenticate_user, get_password_hash

        user = User(
            username="testuser",
            email="test@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Test User",
            role="user",
        )
        db_session.add(user)
        await db_session.commit()

        result = await authenticate_user(db_session, "testuser", "password123")
        assert result.username == "testuser"

    async def test_authenticate_user_raises_for_wrong_password(self, db_session):
        from app.models.user import User
        from app.services.auth import authenticate_user, get_password_hash
        from app.utils.exceptions import AppException

        user = User(
            username="testuser",
            email="test@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Test User",
            role="user",
        )
        db_session.add(user)
        await db_session.commit()

        with pytest.raises(AppException) as exc_info:
            await authenticate_user(db_session, "testuser", "wrongpassword")
        assert exc_info.value.status_code == 401

    async def test_authenticate_user_raises_for_nonexistent_user(self, db_session):
        from app.services.auth import authenticate_user
        from app.utils.exceptions import AppException

        with pytest.raises(AppException) as exc_info:
            await authenticate_user(db_session, "nonexistent", "password")
        assert exc_info.value.status_code == 401


# === Integration tests for auth endpoints ===


async def _create_test_user(client, username="testuser", password="password123", role="user"):
    """Helper: create a user via direct DB insert and return user data."""
    from app.models.user import User
    from app.services.auth import get_password_hash
    from tests.conftest import TestSessionLocal

    async with TestSessionLocal() as session:
        user = User(
            username=username,
            email=f"{username}@test.com",
            hashed_password=get_password_hash(password),
            full_name=f"Test {username}",
            role=role,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return {"id": user.id, "username": user.username, "role": user.role}


class TestLoginEndpoint:
    """Tests for POST /api/v1/auth/login."""

    async def test_login_with_valid_credentials_returns_token(self, client):
        await _create_test_user(client, username="admin", password="admin123", role="admin")
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "admin123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_with_wrong_password_returns_401(self, client):
        await _create_test_user(client, username="admin", password="admin123")
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "wrong"},
        )
        assert response.status_code == 401

    async def test_login_with_nonexistent_user_returns_401(self, client):
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "nobody", "password": "whatever"},
        )
        assert response.status_code == 401


class TestMeEndpoint:
    """Tests for GET /api/v1/auth/me."""

    async def test_me_with_valid_token_returns_user_profile(self, client):
        await _create_test_user(client, username="mruser", password="pass123", role="user")
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "mruser", "password": "pass123"},
        )
        token = login_resp.json()["access_token"]

        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "mruser"
        assert data["role"] == "user"
        assert "id" in data
        assert "hashed_password" not in data

    async def test_me_without_token_returns_401(self, client):
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401

    async def test_me_with_invalid_token_returns_401(self, client):
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401


class TestRoleBasedAccess:
    """Tests for role-based access control via require_role dependency."""

    async def test_admin_endpoint_rejects_user_role_with_403(self, client):
        """User with role='user' should get 403 on admin-only endpoint."""
        await _create_test_user(client, username="regularuser", password="pass", role="user")

        # The /me endpoint doesn't require admin role, so we test with
        # a hypothetical admin endpoint. Since none exists yet, we verify
        # the require_role dependency directly by checking that the role
        # checker raises 403 for non-admin users.
        from app.dependencies import require_role
        from app.utils.exceptions import AppException

        admin_checker = require_role("admin")

        # Decode token to get user, then test the checker
        from app.models.user import User
        from tests.conftest import TestSessionLocal

        async with TestSessionLocal() as session:
            from sqlalchemy import select

            result = await session.execute(select(User).where(User.username == "regularuser"))
            user = result.scalar_one()

        with pytest.raises(AppException) as exc_info:
            await admin_checker(user=user)
        assert exc_info.value.status_code == 403

    async def test_admin_endpoint_allows_admin_role(self, client):
        """User with role='admin' should pass the admin role checker."""
        await _create_test_user(client, username="adminuser", password="pass", role="admin")

        from app.dependencies import require_role
        from app.models.user import User
        from tests.conftest import TestSessionLocal

        admin_checker = require_role("admin")

        async with TestSessionLocal() as session:
            from sqlalchemy import select

            result = await session.execute(select(User).where(User.username == "adminuser"))
            user = result.scalar_one()

        # Should not raise
        returned_user = await admin_checker(user=user)
        assert returned_user.role == "admin"
