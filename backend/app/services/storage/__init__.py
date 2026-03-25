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
    # For MVP, always use local storage.
    # In production, check for Azure Blob config and return AzureBlobStorageBackend.
    from app.services.storage.local import LocalStorageBackend

    return LocalStorageBackend(base_path=settings.material_storage_path)
