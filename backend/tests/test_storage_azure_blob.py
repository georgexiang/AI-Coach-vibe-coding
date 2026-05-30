"""Unit tests for AzureBlobStorageBackend."""

import pytest

from app.services.storage.azure_blob import AzureBlobStorageBackend


class FakeDownloader:
    def __init__(self, content: bytes):
        self.content = content

    async def readall(self) -> bytes:
        return self.content


class FakeBlobClient:
    def __init__(self, blobs: dict[str, bytes], name: str, container_name: str):
        self.blobs = blobs
        self.name = name
        self.url = f"https://account.blob.core.windows.net/{container_name}/{name}"

    async def exists(self) -> bool:
        return self.name in self.blobs


class FakeContainerClient:
    def __init__(self, container_name: str = "materials"):
        self.container_name = container_name
        self.blobs: dict[str, bytes] = {}

    async def upload_blob(self, name: str, data: bytes, overwrite: bool) -> None:
        if not overwrite and name in self.blobs:
            raise ValueError("Blob already exists")
        self.blobs[name] = data

    async def download_blob(self, name: str) -> FakeDownloader:
        return FakeDownloader(self.blobs[name])

    async def delete_blob(self, name: str) -> None:
        del self.blobs[name]

    def get_blob_client(self, name: str) -> FakeBlobClient:
        return FakeBlobClient(self.blobs, name, self.container_name)


class FakeAzureBlobStorageBackend(AzureBlobStorageBackend):
    def __init__(self, container_client: FakeContainerClient, **kwargs):
        super().__init__(connection_string="UseDevelopmentStorage=true", **kwargs)
        self.container_client = container_client

    async def _with_container(self, operation):
        return await operation(self.container_client)


class TestAzureBlobStorageBackend:
    """Tests Azure Blob path handling and storage operations via a fake client."""

    def test_init_defaults(self):
        """Constructor stores defaults without creating Azure clients."""
        backend = AzureBlobStorageBackend()
        assert backend.connection_string == ""
        assert backend.account_url == ""
        assert backend.container_name == "materials"
        assert backend.blob_prefix == ""

    def test_init_custom_args(self):
        """Constructor accepts connection string, account URL, container, and prefix."""
        backend = AzureBlobStorageBackend(
            connection_string="DefaultEndpointsProtocol=https;...",
            account_url="https://account.blob.core.windows.net/",
            container_name="custom-container",
            blob_prefix="/tenant-a/",
        )
        assert backend.connection_string == "DefaultEndpointsProtocol=https;..."
        assert backend.account_url == "https://account.blob.core.windows.net"
        assert backend.container_name == "custom-container"
        assert backend.blob_prefix == "tenant-a"

    def test_blob_name_normalizes_relative_paths(self):
        """Relative paths are normalized to Azure blob names."""
        backend = AzureBlobStorageBackend(blob_prefix="prod")
        assert backend._blob_name("\\materials\\a.pdf") == "prod/materials/a.pdf"

    def test_blob_name_accepts_same_container_url(self):
        """Blob URLs from save() can be passed back to read/exists/delete."""
        backend = AzureBlobStorageBackend(container_name="materials", blob_prefix="prod")
        url = "https://account.blob.core.windows.net/materials/prod/a/b.pdf"
        assert backend._blob_name(url) == "prod/a/b.pdf"

    async def test_save_read_exists_delete(self):
        """Storage operations work against the container client contract."""
        container = FakeContainerClient()
        backend = FakeAzureBlobStorageBackend(container)

        url = await backend.save("materials/doc.pdf", b"content")

        assert url == "https://account.blob.core.windows.net/materials/materials/doc.pdf"
        assert await backend.exists(url) is True
        assert await backend.read(url) == b"content"

        await backend.delete(url)
        assert await backend.exists(url) is False

    async def test_delete_missing_blob_does_not_raise(self):
        """Deleting a missing blob is idempotent like the local backend."""
        container = FakeContainerClient()
        backend = FakeAzureBlobStorageBackend(container)

        await backend.delete("missing.pdf")

    async def test_read_missing_blob_raises_key_error_from_client(self):
        """Missing reads surface the storage client error instead of hiding it."""
        container = FakeContainerClient()
        backend = FakeAzureBlobStorageBackend(container)

        with pytest.raises(KeyError):
            await backend.read("missing.pdf")
