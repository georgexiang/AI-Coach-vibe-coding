"""Local filesystem storage backend for development."""

import os

import aiofiles
import aiofiles.os


class LocalStorageBackend:
    """Store files on local filesystem. Used for development."""

    def __init__(self, base_path: str = "./storage/materials"):
        self.base_path = base_path

    def _full_path(self, path: str) -> str:
        return os.path.join(self.base_path, path)

    async def save(self, path: str, content: bytes) -> str:
        full_path = self._full_path(path)
        dir_path = os.path.dirname(full_path)
        await aiofiles.os.makedirs(dir_path, exist_ok=True)
        async with aiofiles.open(full_path, "wb") as f:
            await f.write(content)
        return full_path

    async def read(self, path: str) -> bytes:
        full_path = self._full_path(path)
        async with aiofiles.open(full_path, "rb") as f:
            return await f.read()

    async def delete(self, path: str) -> None:
        full_path = self._full_path(path)
        if await aiofiles.os.path.exists(full_path):
            await aiofiles.os.remove(full_path)

    async def exists(self, path: str) -> bool:
        full_path = self._full_path(path)
        return await aiofiles.os.path.exists(full_path)
