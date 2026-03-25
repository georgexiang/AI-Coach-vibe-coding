"""Unit tests for AzureBlobStorageBackend stub."""

import pytest

from app.services.storage.azure_blob import AzureBlobStorageBackend


class TestAzureBlobStorageBackend:
    """Tests that the Azure Blob stub raises NotImplementedError for all methods."""

    def test_init_defaults(self):
        """Constructor stores connection_string and container_name."""
        backend = AzureBlobStorageBackend()
        assert backend.connection_string == ""
        assert backend.container_name == "materials"

    def test_init_custom_args(self):
        """Constructor accepts custom connection_string and container_name."""
        backend = AzureBlobStorageBackend(
            connection_string="DefaultEndpointsProtocol=https;...",
            container_name="custom-container",
        )
        assert backend.connection_string == "DefaultEndpointsProtocol=https;..."
        assert backend.container_name == "custom-container"

    async def test_save_raises_not_implemented(self):
        """save() raises NotImplementedError."""
        backend = AzureBlobStorageBackend()
        with pytest.raises(NotImplementedError, match="Azure Blob Storage not yet implemented"):
            await backend.save("test/file.pdf", b"content")

    async def test_read_raises_not_implemented(self):
        """read() raises NotImplementedError."""
        backend = AzureBlobStorageBackend()
        with pytest.raises(NotImplementedError, match="Azure Blob Storage not yet implemented"):
            await backend.read("test/file.pdf")

    async def test_delete_raises_not_implemented(self):
        """delete() raises NotImplementedError."""
        backend = AzureBlobStorageBackend()
        with pytest.raises(NotImplementedError, match="Azure Blob Storage not yet implemented"):
            await backend.delete("test/file.pdf")

    async def test_exists_raises_not_implemented(self):
        """exists() raises NotImplementedError."""
        backend = AzureBlobStorageBackend()
        with pytest.raises(NotImplementedError, match="Azure Blob Storage not yet implemented"):
            await backend.exists("test/file.pdf")
