"""Azure Blob Storage backend for cloud deployments."""

from collections.abc import Awaitable, Callable
from typing import Any, TypeVar
from urllib.parse import unquote, urlparse

T = TypeVar("T")


class AzureBlobStorageBackend:
    """Store files in Azure Blob Storage.

    Uses a connection string when provided; otherwise uses DefaultAzureCredential
    with an account URL so Container Apps can authenticate via managed identity.
    """

    def __init__(
        self,
        connection_string: str = "",
        account_url: str = "",
        container_name: str = "materials",
        blob_prefix: str = "",
    ):
        self.connection_string = connection_string
        self.account_url = account_url.rstrip("/")
        self.container_name = container_name
        self.blob_prefix = blob_prefix.strip("/")

    def _normalize_path(self, path: str) -> str:
        normalized = path.replace("\\", "/").strip("/")
        parsed = urlparse(normalized)
        if parsed.scheme in {"http", "https"}:
            parts = unquote(parsed.path).strip("/").split("/", 1)
            if parts and parts[0] == self.container_name:
                normalized = parts[1] if len(parts) > 1 else ""
            else:
                normalized = unquote(parsed.path).strip("/")
        return normalized

    def _blob_name(self, path: str) -> str:
        normalized = self._normalize_path(path)
        if not normalized:
            raise ValueError("Storage path must not be empty")
        if self.blob_prefix and not normalized.startswith(f"{self.blob_prefix}/"):
            return f"{self.blob_prefix}/{normalized}"
        return normalized

    async def _with_container(self, operation: Callable[[Any], Awaitable[T]]) -> T:
        try:
            from azure.storage.blob.aio import BlobServiceClient
        except ImportError as exc:
            raise RuntimeError(
                "Azure Blob Storage requires the azure-storage-blob package"
            ) from exc

        if self.connection_string:
            service_client = BlobServiceClient.from_connection_string(self.connection_string)
            async with service_client:
                return await operation(service_client.get_container_client(self.container_name))

        if not self.account_url:
            raise ValueError("Azure Blob storage requires connection_string or account_url")

        try:
            from azure.identity.aio import DefaultAzureCredential
        except ImportError as exc:
            raise RuntimeError(
                "Azure Blob managed identity auth requires the azure-identity package"
            ) from exc

        credential = DefaultAzureCredential()
        service_client = BlobServiceClient(
            account_url=self.account_url,
            credential=credential,
        )
        try:
            async with service_client:
                return await operation(service_client.get_container_client(self.container_name))
        finally:
            await credential.close()

    async def save(self, path: str, content: bytes) -> str:
        blob_name = self._blob_name(path)

        async def upload(container_client: Any) -> str:
            await container_client.upload_blob(
                name=blob_name,
                data=content,
                overwrite=True,
            )
            return container_client.get_blob_client(blob_name).url

        return await self._with_container(upload)

    async def read(self, path: str) -> bytes:
        blob_name = self._blob_name(path)

        async def download(container_client: Any) -> bytes:
            downloader = await container_client.download_blob(blob_name)
            return await downloader.readall()

        return await self._with_container(download)

    async def delete(self, path: str) -> None:
        blob_name = self._blob_name(path)

        async def delete_blob(container_client: Any) -> None:
            blob_client = container_client.get_blob_client(blob_name)
            if await blob_client.exists():
                await container_client.delete_blob(blob_name)

        await self._with_container(delete_blob)

    async def exists(self, path: str) -> bool:
        blob_name = self._blob_name(path)

        async def blob_exists(container_client: Any) -> bool:
            return await container_client.get_blob_client(blob_name).exists()

        return await self._with_container(blob_exists)


__all__ = ["AzureBlobStorageBackend"]
