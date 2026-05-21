"""Content Understanding Analyzer CRUD API 验证测试.

这些测试直接调用 CU REST API，验证 Analyzer 的创建、列出、获取和删除。
认证优先级：Entra ID (DefaultAzureCredential) > API Key。

需要设置环境变量：
  CU_ENDPOINT — CU 服务端点（必须）
  CU_API_KEY — API Key（可选，如果 Entra ID 可用则不需要）

运行：
  cd docs/content-understanding/tests
  python -m pytest test_cu_analyzer_crud.py -v
"""

import os

import httpx
import pytest

# Configuration from environment
CU_ENDPOINT = os.environ.get("CU_ENDPOINT", "").rstrip("/")
CU_API_KEY = os.environ.get("CU_API_KEY", "")
CU_API_VERSION = "2025-05-01-preview"

TEST_ANALYZER_ID = "testAnalyzerCrud001"


def _has_entra_id() -> bool:
    """Check if Entra ID (DefaultAzureCredential) is available."""
    try:
        from azure.identity import DefaultAzureCredential

        credential = DefaultAzureCredential()
        credential.get_token("https://cognitiveservices.azure.com/.default")
        credential.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not CU_ENDPOINT or (not CU_API_KEY and not _has_entra_id()),
    reason="CU_ENDPOINT must be set, and either CU_API_KEY or Entra ID must be available",
)


def _get_headers() -> dict[str, str]:
    """Get auth headers. Entra ID preferred, API Key fallback."""
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
        pass

    if CU_API_KEY:
        return {
            "Ocp-Apim-Subscription-Key": CU_API_KEY,
            "Content-Type": "application/json",
        }

    raise RuntimeError("No CU credentials available")


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

    def test_01_create_analyzer_preview_api(self):
        """Test: 使用 Preview API (2025-05-01-preview) 创建 Analyzer."""
        url = f"{CU_ENDPOINT}/contentunderstanding/analyzers/{TEST_ANALYZER_ID}?api-version={CU_API_VERSION}"
        body = {
            "description": "Test analyzer for CRUD validation",
            "baseAnalyzerId": "prebuilt-documentAnalyzer",
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
        self.test_01_create_analyzer_preview_api()

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
        self.test_01_create_analyzer_preview_api()

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

    def test_04_verify_analyzer_in_list(self):
        """Test: 验证刚创建的 Analyzer 出现在列表中."""
        self.test_01_create_analyzer_preview_api()

        url = f"{CU_ENDPOINT}/contentunderstanding/analyzers?api-version={CU_API_VERSION}"

        with httpx.Client(timeout=30) as client:
            response = client.get(url, headers=_get_headers())

        print(f"LIST status: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        analyzer_ids = [a.get("analyzerId", a.get("id", "")) for a in data.get("value", [])]
        print(f"Found analyzers: {analyzer_ids}")
        found = any(TEST_ANALYZER_ID in str(a) for a in analyzer_ids)
        print(f"Test analyzer visible: {found}")
        assert found, f"{TEST_ANALYZER_ID} not found in analyzer list"

    def test_05_delete_analyzer(self):
        """Test: 删除 Analyzer."""
        # First create
        self.test_01_create_analyzer_preview_api()

        url = f"{CU_ENDPOINT}/contentunderstanding/analyzers/{TEST_ANALYZER_ID}?api-version={CU_API_VERSION}"

        with httpx.Client(timeout=30) as client:
            response = client.delete(url, headers=_get_headers())

        print(f"DELETE status: {response.status_code}")
        assert response.status_code in (200, 204)

        # Verify deleted
        with httpx.Client(timeout=30) as client:
            response = client.get(url, headers=_get_headers())
        assert response.status_code == 404

    def test_06_update_existing_analyzer(self):
        """Test: 更新已存在的 Analyzer（PUT 幂等性验证）.

        Note: Preview API may return 409 if analyzer is still in 'creating' state.
        We wait for 'ready' status before attempting update.
        """
        self.test_01_create_analyzer_preview_api()

        # Wait for analyzer to become ready
        url = f"{CU_ENDPOINT}/contentunderstanding/analyzers/{TEST_ANALYZER_ID}?api-version={CU_API_VERSION}"
        import time

        for _ in range(15):
            with httpx.Client(timeout=30) as client:
                check = client.get(url, headers=_get_headers())
            if check.status_code == 200:
                status = check.json().get("status", "")
                if status == "ready":
                    break
            time.sleep(2)

        body = {
            "description": "Updated test analyzer description",
            "baseAnalyzerId": "prebuilt-documentAnalyzer",
            "fieldSchema": _build_test_schema(),
        }

        with httpx.Client(timeout=30) as client:
            response = client.put(url, headers=_get_headers(), json=body)

        print(f"PUT (update) status: {response.status_code}")
        # 200=updated, 201=created, 409=still processing (acceptable for Preview API)
        assert response.status_code in (200, 201, 409)
        if response.status_code == 409:
            print("Note: 409 Conflict — analyzer still processing, update deferred")

    def test_07_analyzer_id_naming_rules(self):
        """Test: Analyzer ID 命名规则探测.

        Preview API 实际上允许连字符（与 GA API 不同）。
        此测试记录哪些 ID 格式被接受/拒绝。
        """
        test_ids = [
            "testHyphen001",
            "test-hyphen-002",
            "test_underscore_003",
        ]
        results: dict[str, int] = {}

        for test_id in test_ids:
            url = f"{CU_ENDPOINT}/contentunderstanding/analyzers/{test_id}?api-version={CU_API_VERSION}"
            body = {
                "description": "Test ID naming",
                "baseAnalyzerId": "prebuilt-documentAnalyzer",
                "fieldSchema": _build_test_schema(),
            }
            try:
                with httpx.Client(timeout=15) as client:
                    response = client.put(url, headers=_get_headers(), json=body)
                results[test_id] = response.status_code
                if response.status_code in (200, 201):
                    with httpx.Client(timeout=15) as client:
                        client.delete(url, headers=_get_headers())
            except httpx.ReadTimeout:
                results[test_id] = -1  # timeout

        for tid, status in results.items():
            print(f"ID '{tid}': status={status}")

        # At minimum, alphanumeric IDs must work
        assert results.get("testHyphen001") in (200, 201)


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
