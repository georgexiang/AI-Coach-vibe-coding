"""Pluggable file storage backend for training materials."""

from typing import Protocol

from app.config import get_settings


class StorageBackend(Protocol):
    """Protocol for file storage backends (ARCH-01 pluggable pattern)."""

    async def save(self, path: str, content: bytes) -> str:
        """Save file content to storage. Returns the storage URL/path."""
        ...

    async def read(self, path: str) -> bytes:
        """Read file content from storage."""
        ...

    async def delete(self, path: str) -> None:
        """Delete a file from storage."""
        ...

    async def exists(self, path: str) -> bool:
        """Check if a file exists in storage."""
        ...


def get_storage() -> StorageBackend:
    """Factory that returns the appropriate storage backend based on config."""
    settings = get_settings()
    backend = settings.storage_backend.lower().strip()

    if backend == "local":
        from app.services.storage.local import LocalStorageBackend

        return LocalStorageBackend(base_path=settings.material_storage_path)

    if backend in {"azure_blob", "blob"}:
        from app.services.storage.azure_blob import AzureBlobStorageBackend

        if not settings.azure_storage_connection_string and not settings.azure_storage_account_url:
            raise ValueError(
                "Azure Blob storage requires AZURE_STORAGE_CONNECTION_STRING "
                "or AZURE_STORAGE_ACCOUNT_URL"
            )

        return AzureBlobStorageBackend(
            connection_string=settings.azure_storage_connection_string,
            account_url=settings.azure_storage_account_url,
            container_name=settings.azure_storage_container_name,
            blob_prefix=settings.azure_storage_blob_prefix,
        )

    raise ValueError(f"Unsupported storage backend: {settings.storage_backend}")


__all__ = ["StorageBackend", "get_storage"]
