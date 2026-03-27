"""Tests for Fernet encryption utility."""

from app.utils.encryption import decrypt_value, encrypt_value


def test_encrypt_decrypt_round_trip():
    """Encrypted value should decrypt back to original."""
    plaintext = "my-secret-api-key-12345"
    encrypted = encrypt_value(plaintext)
    decrypted = decrypt_value(encrypted)
    assert decrypted == plaintext


def test_encrypt_value_empty_returns_empty():
    """Empty string input should return empty string."""
    assert encrypt_value("") == ""


def test_decrypt_value_empty_returns_empty():
    """Empty string input should return empty string."""
    assert decrypt_value("") == ""


def test_encrypted_differs_from_plaintext():
    """Encrypted value should not match the plaintext."""
    plaintext = "super-secret"
    encrypted = encrypt_value(plaintext)
    assert encrypted != plaintext
    assert len(encrypted) > 0
