"""Fernet encryption helpers for API key storage."""

import logging
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings

logger = logging.getLogger(__name__)

_fernet_instance: Fernet | None = None


def _get_fernet() -> Fernet:
    """Get or create a Fernet instance.

    If settings.encryption_key is empty, generates a new key, stores it on
    the settings instance, and attempts to persist it to the .env file so
    encrypted data survives server restarts.
    """
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    settings = get_settings()
    if not settings.encryption_key:
        new_key = Fernet.generate_key().decode()
        settings.encryption_key = new_key
        logger.warning(
            "ENCRYPTION_KEY not set — generated a new key. "
            "Add ENCRYPTION_KEY=%s to your .env to persist across restarts.",
            new_key,
        )
        # Best-effort: append to .env so next restart reuses the same key
        _persist_key_to_env(new_key)

    _fernet_instance = Fernet(settings.encryption_key.encode())
    return _fernet_instance


def _persist_key_to_env(key: str) -> None:
    """Append ENCRYPTION_KEY to the .env file if not already present."""
    env_path = Path(__file__).resolve().parents[2] / ".env"
    try:
        if env_path.exists():
            content = env_path.read_text()
            if "ENCRYPTION_KEY=" in content:
                return
        with env_path.open("a") as f:
            f.write(f"\nENCRYPTION_KEY={key}\n")
        logger.info("Persisted ENCRYPTION_KEY to %s", env_path)
    except OSError:
        logger.warning("Could not persist ENCRYPTION_KEY to %s", env_path)


def encrypt_value(plaintext: str) -> str:
    """Encrypt a string value, returning base64 Fernet token.

    Returns empty string if input is empty.
    """
    if not plaintext:
        return ""
    fernet = _get_fernet()
    return fernet.encrypt(plaintext.encode()).decode()


def decrypt_value(token: str) -> str:
    """Decrypt a Fernet token back to plaintext.

    Returns empty string if input is empty or decryption fails
    (e.g. key changed after server restart).
    """
    if not token:
        return ""
    fernet = _get_fernet()
    try:
        return fernet.decrypt(token.encode()).decode()
    except (InvalidToken, Exception):
        logger.warning(
            "Failed to decrypt value — encryption key may have changed. "
            "Re-save credentials to re-encrypt with the current key."
        )
        return ""
