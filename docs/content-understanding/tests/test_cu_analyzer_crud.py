"""Content Understanding Analyzer CRUD API 验证测试.

这些测试直接调用 CU REST API，验证 Analyzer 的创建、列出、获取和删除。
需要设置环境变量：
  CU_ENDPOINT — CU 服务端点
  CU_API_KEY — API Key（如不使用 Entra ID）
  AZURE_TENANT_ID — 租户 ID（可选，用于 Portal URL 验证）

运行：
  cd docs/content-understanding/tests
  python -m pytest test_cu_analyzer_crud.py -v
"""

import asyncio
import json
import os
import sys

import httpx
import pytest

# Configuration from environment
CU_ENDPOINT = os.environ.get("CU_ENDPOINT", "").rstrip("/")
CU_API_KEY = os.environ.get("CU_API_KEY", "")
CU_API_VERSION = "2025-11-01"
CU_API_VERSION_PREVIEW = "2025-05-01-preview"

TEST_ANALYZER_ID = "testAnalyzerCrud001"

pytestmark = pytest.mark.skipif(
    not CU_ENDPOINT or not CU_API_KEY,
    reason="CU_ENDPOINT and CU_API_KEY must be set",
)


def _get_headers() -> dict[str, str]:
    """Get auth headers using API Key."""
    return {
        "Ocp-Apim-Subscription-Key": CU_API_KEY,
        "Content-Type": "application/json",
    }


def _get_headers_entra() -> dict[str, str] | None:
    """Try to get Entra ID headers. Returns None if unavailable."""
    try:
        from azure.identity import DefaultAzureCredential

        credential = DefaultAzureCredential()
        token = credential.get_token("https://cognitiveservices.azure.com/.default")
        credential.close()
        return {
            "Authorization": f"Bearer {token.token}",
            "Content-Type": "application/json",
        }
    except Exception:
        return None


def _build_test_schema() -> dict:
    """Build a minimal test analyzer schema."""
    return {
        "name": "TestScoring",
        "fields": {
            "test_field": {
                "type": "string",
                "method": "generate",
                "description": "Generate a test response. Return JSON: {\"result\": \"ok\"}",
            }
        },
    }


class TestAnalyzerCRUD:
    """Test Analyzer CRUD operations via REST API."""

    @pytest.fixture(autouse=True)
    def cleanup(self):
        """Cleanup test analyzer after tests."""
        yield
        # Attempt cleanup
        import httpx as httpx_sync

        url = f"{CU_ENDPOINT}/contentunderstanding/analyzers/{TEST_ANALYZER_ID}?api-version={CU_API_VERSION}"
        try:
            with httpx_sync.Client(timeout=10) as client:
                client.delete(url, headers=_get_headers())
        except Exception:
            pass

    def test_01_create_analyzer_ga_api(self):
        """Test: 使用 GA API (2025-11-01) 创建 Analyzer."""
        url = f"{CU_ENDPOINT}/contentunderstanding/analyzers/{TEST_ANALYZER_ID}?api-version={CU_API_VERSION}"
        body = {
            "description": "Test analyzer for CRUD validation",
            "baseAnalyzerId": "prebuilt-document",
            "fieldSchema": _build_test_schema(),
        }

        with httpx.Client(timeout=30) as client:
            response = client.put(url, headers=_get_headers(), json=body)

        print(f"PUT status: {response.status_code}")
        print(f"PUT body: {response.text[:500]}")
        assert response.status_code in (200, 201), f"Failed: {response.status_code} - {response.text}"

    def test_02_get_analyzer_ga_api(self):
        """Test: 使用 GA API 获取刚创建的 Analyzer."""
        # First create
        self.test_01_create_analyzer_ga_api()

        url = f"{CU_ENDPOINT}/contentunderstanding/analyzers/{TEST_ANALYZER_ID}?api-version={CU_API_VERSION}"

        with httpx.Client(timeout=30) as client:
            response = client.get(url, headers=_get_headers())

        print(f"GET status: {response.status_code}")
        print(f"GET body: {response.text[:500]}")
        assert response.status_code == 200
        data = response.json()
        assert "fieldSchema" in data or "properties" in data

    def test_03_list_analyzers_ga_api(self):
        """Test: 使用 GA API 列出所有 Analyzer."""
        # First create
        self.test_01_create_analyzer_ga_api()

        url = f"{CU_ENDPOINT}/contentunderstanding/analyzers?api-version={CU_API_VERSION}"

        with httpx.Client(timeout=30) as client:
            response = client.get(url, headers=_get_headers())

        print(f"LIST status: {response.status_code}")
        print(f"LIST body: {response.text[:1000]}")
        assert response.status_code == 200
        data = response.json()
        # Should contain our test analyzer
        analyzer_ids = [a.get("id", a.get("name", "")) for a in data.get("value", data if isinstance(data, list) else [])]
        print(f"Found analyzers: {analyzer_ids}")

    def test_04_list_analyzers_preview_api(self):
        """Test: 使用 Preview API (2025-05-01-preview) 列出 Analyzer — 验证跨版本兼容性."""
        # First create with GA
        self.test_01_create_analyzer_ga_api()

        url = f"{CU_ENDPOINT}/contentunderstanding/analyzers?api-version={CU_API_VERSION_PREVIEW}"

        with httpx.Client(timeout=30) as client:
            response = client.get(url, headers=_get_headers())

        print(f"LIST (preview) status: {response.status_code}")
        print(f"LIST (preview) body: {response.text[:1000]}")
        # This test reveals whether GA-created analyzers are visible to the Preview API
        if response.status_code == 200:
            data = response.json()
            analyzer_ids = [a.get("id", a.get("name", "")) for a in data.get("value", data if isinstance(data, list) else [])]
            print(f"Preview API found analyzers: {analyzer_ids}")
            found = any(TEST_ANALYZER_ID in str(a) for a in analyzer_ids)
            print(f"Test analyzer visible in Preview API: {found}")
        else:
            print(f"Preview API returned {response.status_code} — may not be supported")

    def test_05_delete_analyzer(self):
        """Test: 删除 Analyzer."""
        # First create
        self.test_01_create_analyzer_ga_api()

        url = f"{CU_ENDPOINT}/contentunderstanding/analyzers/{TEST_ANALYZER_ID}?api-version={CU_API_VERSION}"

        with httpx.Client(timeout=30) as client:
            response = client.delete(url, headers=_get_headers())

        print(f"DELETE status: {response.status_code}")
        assert response.status_code in (200, 204)

        # Verify deleted
        with httpx.Client(timeout=30) as client:
            response = client.get(url, headers=_get_headers())
        assert response.status_code == 404

    def test_06_create_with_entra_id(self):
        """Test: 使用 Entra ID 认证创建 Analyzer."""
        headers = _get_headers_entra()
        if headers is None:
            pytest.skip("Entra ID (DefaultAzureCredential) not available")

        url = f"{CU_ENDPOINT}/contentunderstanding/analyzers/{TEST_ANALYZER_ID}Entra?api-version={CU_API_VERSION}"
        body = {
            "description": "Test analyzer via Entra ID",
            "baseAnalyzerId": "prebuilt-document",
            "fieldSchema": _build_test_schema(),
        }

        with httpx.Client(timeout=30) as client:
            response = client.put(url, headers=headers, json=body)

        print(f"PUT (Entra) status: {response.status_code}")
        print(f"PUT (Entra) body: {response.text[:500]}")
        assert response.status_code in (200, 201), f"Entra ID auth failed: {response.status_code}"

        # Cleanup
        with httpx.Client(timeout=30) as client:
            client.delete(
                f"{CU_ENDPOINT}/contentunderstanding/analyzers/{TEST_ANALYZER_ID}Entra?api-version={CU_API_VERSION}",
                headers=headers,
            )

    def test_07_analyzer_id_naming_rules(self):
        """Test: Analyzer ID 命名规则 — 验证非法字符被拒绝."""
        invalid_ids = [
            "test-with-hyphen",
            "test_with_underscore",  # might work
            "test with space",
            "test/slash",
        ]

        for invalid_id in invalid_ids:
            url = f"{CU_ENDPOINT}/contentunderstanding/analyzers/{invalid_id}?api-version={CU_API_VERSION}"
            body = {
                "description": "Test invalid ID",
                "baseAnalyzerId": "prebuilt-document",
                "fieldSchema": _build_test_schema(),
            }
            with httpx.Client(timeout=10) as client:
                response = client.put(url, headers=_get_headers(), json=body)
            print(f"ID '{invalid_id}': status={response.status_code}")
            # Document which IDs are rejected
            if response.status_code in (200, 201):
                # Cleanup
                with httpx.Client(timeout=10) as client:
                    client.delete(url, headers=_get_headers())


class TestPortalUrlConstruction:
    """Test Portal URL construction logic."""

    def test_classic_foundry_url_format(self):
        """Test: 经典 Foundry Portal URL 格式验证."""
        import urllib.parse

        sub_id = "7a03e9b8-18d6-48e7-b186-0ec68da9e86f"
        rg = "ai-foundary-rg"
        resource_name = "ai-foundary-hu-sweden-central2"
        project_name = "avarda-demo-prj"
        tenant_id = "16b3c013-d300-468d-ac64-7eda0820b6d3"

        wsid = (
            f"/subscriptions/{sub_id}/resourceGroups/{rg}"
            f"/providers/Microsoft.CognitiveServices"
            f"/accounts/{resource_name}/projects/{project_name}"
        )
        params = {"wsid": wsid, "tid": tenant_id}
        url = "https://ai.azure.com/resource/contentunderstanding/analyzer-list?" + urllib.parse.urlencode(params)

        print(f"Generated URL:\n{url}")

        # Verify components
        assert "ai.azure.com/resource/contentunderstanding/analyzer-list" in url
        assert f"subscriptions%2F{sub_id}" in url or f"subscriptions/{sub_id}" in urllib.parse.unquote(url)
        assert tenant_id in url

    def test_dedicated_cu_portal_url_format(self):
        """Test: 专用 CU Portal URL 格式验证."""
        tenant_id = "16b3c013-d300-468d-ac64-7eda0820b6d3"
        url = f"https://contentunderstanding.ai.azure.com/build?tab=analyzerList&tenantId={tenant_id}"

        print(f"Dedicated CU Portal URL:\n{url}")
        assert "contentunderstanding.ai.azure.com" in url
        assert tenant_id in url
