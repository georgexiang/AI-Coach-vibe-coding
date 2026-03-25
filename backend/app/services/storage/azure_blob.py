"""Azure Blob Storage backend (stub for production deployment)."""


class AzureBlobStorageBackend:
    """Store files in Azure Blob Storage. Stub -- not yet implemented.

    Will be wired when azure_content_endpoint is configured.
    Follows the same StorageBackend protocol as LocalStorageBackend.
    """

    def __init__(self, connection_string: str = "", container_name: str = "materials"):
        self.connection_string = connection_string
        self.container_name = container_name

    async def save(self, path: str, content: bytes) -> str:
        raise NotImplementedError("Azure Blob Storage not yet implemented")

    async def read(self, path: str) -> bytes:
        raise NotImplementedError("Azure Blob Storage not yet implemented")

    async def delete(self, path: str) -> None:
        raise NotImplementedError("Azure Blob Storage not yet implemented")

    async def exists(self, path: str) -> bool:
        raise NotImplementedError("Azure Blob Storage not yet implemented")
