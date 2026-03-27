"""Fernet encryption helpers for API key storage."""

from cryptography.fernet import Fernet

from app.config import get_settings

_fernet_instance: Fernet | None = None


def _get_fernet() -> Fernet:
    """Get or create a Fernet instance.

    If settings.encryption_key is empty, generates a new key and stores it
    on the settings instance for the process lifetime.
    """
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    settings = get_settings()
    if not settings.encryption_key:
        # Generate a key for this process lifetime
        settings.encryption_key = Fernet.generate_key().decode()

    _fernet_instance = Fernet(settings.encryption_key.encode())
    return _fernet_instance


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

    Returns empty string if input is empty.
    """
    if not token:
        return ""
    fernet = _get_fernet()
    return fernet.decrypt(token.encode()).decode()
