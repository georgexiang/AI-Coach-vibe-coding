"""Delete legacy rubricContent* analyzers from Azure Content Understanding.

After Phase 26 refactor, content scoring is handled by LLM.
CU is only used for voice scoring (rubricVoice* analyzers).
This script removes the orphaned text analyzers.

Usage:
    cd backend
    python scripts/cleanup_content_analyzers.py
"""

import asyncio
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import AsyncSessionLocal
from app.services import config_service
from app.services.cu_evaluation_service import (
    REQUEST_TIMEOUT,
    _get_auth_headers,
    _get_cu_api_version,
)

CU_SERVICE_NAME = "content_understanding"


async def list_analyzers(endpoint: str, api_key: str) -> list[dict]:
    """List all CU analyzers."""
    url = f"{endpoint}/contentunderstanding/analyzers?api-version={_get_cu_api_version()}"
    headers = await _get_auth_headers(api_key)

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        return data.get("value", [])


async def delete_analyzer(endpoint: str, api_key: str, analyzer_id: str) -> bool:
    """Delete a single CU analyzer by ID."""
    url = (
        f"{endpoint}/contentunderstanding/analyzers/{analyzer_id}"
        f"?api-version={_get_cu_api_version()}"
    )
    headers = await _get_auth_headers(api_key)

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.delete(url, headers=headers)
        if response.status_code in (200, 204):
            return True
        print(f"    DELETE failed: HTTP {response.status_code} - {response.text}")
        return False


async def main():
    async with AsyncSessionLocal() as db:
        endpoint = await config_service.get_effective_endpoint(db, CU_SERVICE_NAME)
        api_key = await config_service.get_effective_key(db, CU_SERVICE_NAME)

    if not endpoint or not api_key:
        print("ERROR: CU endpoint/key not configured. Cannot proceed.")
        sys.exit(1)

    endpoint = endpoint.rstrip("/")
    print(f"CU Endpoint: {endpoint}")
    print(f"API Version: {_get_cu_api_version()}\n")

    print("Listing all analyzers...")
    analyzers = await list_analyzers(endpoint, api_key)

    content_analyzers = [
        a for a in analyzers if a.get("analyzerId", "").startswith("rubricContent")
    ]

    if not content_analyzers:
        print("No rubricContent* analyzers found. Nothing to clean up.")
        return

    print(f"Found {len(content_analyzers)} content analyzers to delete:\n")
    for a in content_analyzers:
        print(f"  - {a.get('analyzerId')} ({a.get('description', 'no description')})")

    print("\nDeleting...")
    deleted = 0
    for a in content_analyzers:
        aid = a.get("analyzerId", "")
        if not aid:
            continue
        print(f"  Deleting {aid}...", end=" ")
        if await delete_analyzer(endpoint, api_key, aid):
            print("OK")
            deleted += 1
        else:
            print("FAILED")

    print(f"\nDone. Deleted {deleted}/{len(content_analyzers)} content analyzers.")


if __name__ == "__main__":
    asyncio.run(main())
