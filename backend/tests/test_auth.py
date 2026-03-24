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
