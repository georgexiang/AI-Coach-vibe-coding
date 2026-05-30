"""Unit tests for storage backend factory selection."""

from types import SimpleNamespace

import pytest

from app.services.storage import get_storage
from app.services.storage.azure_blob import AzureBlobStorageBackend
from app.services.storage.local import LocalStorageBackend


def settings(**overrides):
    values = {
        "storage_backend": "local",
        "material_storage_path": "./storage/materials",
        "azure_storage_connection_string": "",
        "azure_storage_account_url": "",
        "azure_storage_container_name": "materials",
        "azure_storage_blob_prefix": "",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_get_storage_defaults_to_local(monkeypatch):
    """Local storage remains the default for local development."""
    monkeypatch.setattr("app.services.storage.get_settings", lambda: settings())

    storage = get_storage()

    assert isinstance(storage, LocalStorageBackend)
    assert storage.base_path == "./storage/materials"


def test_get_storage_selects_azure_blob_with_managed_identity(monkeypatch):
    """Azure Blob can be selected with account URL for managed identity auth."""
    monkeypatch.setattr(
        "app.services.storage.get_settings",
        lambda: settings(
            storage_backend="azure_blob",
            azure_storage_account_url="https://account.blob.core.windows.net",
            azure_storage_container_name="materials",
            azure_storage_blob_prefix="prod",
        ),
    )

    storage = get_storage()

    assert isinstance(storage, AzureBlobStorageBackend)
    assert storage.account_url == "https://account.blob.core.windows.net"
    assert storage.container_name == "materials"
    assert storage.blob_prefix == "prod"


def test_get_storage_selects_azure_blob_with_connection_string(monkeypatch):
    """Azure Blob can also use a connection string fallback."""
    monkeypatch.setattr(
        "app.services.storage.get_settings",
        lambda: settings(
            storage_backend="blob",
            azure_storage_connection_string="DefaultEndpointsProtocol=https;...",
        ),
    )

    storage = get_storage()

    assert isinstance(storage, AzureBlobStorageBackend)
    assert storage.connection_string == "DefaultEndpointsProtocol=https;..."


def test_get_storage_rejects_azure_blob_without_auth(monkeypatch):
    """Cloud Blob mode fails fast when neither MI account URL nor connection string is set."""
    monkeypatch.setattr(
        "app.services.storage.get_settings",
        lambda: settings(storage_backend="azure_blob"),
    )

    with pytest.raises(ValueError, match="AZURE_STORAGE_CONNECTION_STRING"):
        get_storage()


def test_get_storage_rejects_unknown_backend(monkeypatch):
    """Unknown storage backend names fail explicitly."""
    monkeypatch.setattr(
        "app.services.storage.get_settings",
        lambda: settings(storage_backend="s3"),
    )

    with pytest.raises(ValueError, match="Unsupported storage backend"):
        get_storage()
