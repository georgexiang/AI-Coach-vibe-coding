"""Content Understanding 评分管道端到端验证测试.

验证完整的评分流程：提交 transcript → 轮询 → 解析结果。
认证优先级：Entra ID (DefaultAzureCredential) > API Key。

需要设置环境变量：
  CU_ENDPOINT — CU 服务端点（必须）
  CU_ANALYZER_ID — 已创建的 Content Analyzer ID（必须，如 rubricContent5c32107a）
  CU_API_KEY — API Key（可选，如果 Entra ID 可用则不需要）

运行：
  cd docs/content-understanding/tests
  python -m pytest test_cu_scoring_pipeline.py -v
"""

import base64
import json
import os
import time

import httpx
import pytest

CU_ENDPOINT = os.environ.get("CU_ENDPOINT", "").rstrip("/")
CU_API_KEY = os.environ.get("CU_API_KEY", "")
CU_ANALYZER_ID = os.environ.get("CU_ANALYZER_ID", "")
CU_API_VERSION = "2025-05-01-preview"

MAX_POLL_ATTEMPTS = 60
POLL_INTERVAL = 2.0


def _has_entra_id() -> bool:
    """Check if Entra ID is available."""
    try:
        from azure.identity import DefaultAzureCredential

        credential = DefaultAzureCredential()
        credential.get_token("https://cognitiveservices.azure.com/.default")
        credential.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not CU_ENDPOINT or not CU_ANALYZER_ID or (not CU_API_KEY and not _has_entra_id()),
    reason="CU_ENDPOINT and CU_ANALYZER_ID must be set, and either CU_API_KEY or Entra ID available",
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


def _build_sample_transcript() -> str:
    """Build a sample MR-HCP conversation transcript."""
    transcript = {
        "session_type": "f2f",
        "hcp_specialty": "oncology",
        "conversation": [
            {
                "role": "mr",
                "content": "Good morning Dr. Wang. Thank you for meeting with me today. "
                "I'd like to share some recent clinical data about our immunotherapy product.",
            },
            {
                "role": "hcp",
                "content": "Good morning. Yes, I've been hearing about the Phase III results. "
                "What's the overall survival benefit compared to standard chemotherapy?",
            },
            {
                "role": "mr",
                "content": "The Phase III BEACON trial showed a significant improvement in overall survival. "
                "Median OS was 14.2 months vs 10.1 months with standard care, "
                "that's a 4.1 month improvement with an HR of 0.68. "
                "The safety profile was also manageable with the most common side effects being fatigue and nausea.",
            },
            {
                "role": "hcp",
                "content": "That's encouraging. What about patients with PD-L1 high expression?",
            },
            {
                "role": "mr",
                "content": "Great question. In the PD-L1 high subgroup, the benefit was even more pronounced "
                "with a median OS of 18.5 months. I have the subgroup analysis data here if you'd like to review it.",
            },
        ],
    }
    return json.dumps(transcript, ensure_ascii=False)


class TestContentScoringPipeline:
    """Test the complete content scoring pipeline."""

    def test_01_submit_transcript_for_analysis(self):
        """Test: 提交 transcript 到 Content Analyzer 并获取 Operation-Location."""
        transcript_json = _build_sample_transcript()
        b64_content = base64.b64encode(transcript_json.encode()).decode()

        url = (
            f"{CU_ENDPOINT}/contentunderstanding/analyzers/{CU_ANALYZER_ID}:analyze"
            f"?api-version={CU_API_VERSION}"
        )
        # Preview API uses {"data": "<base64>"} format
        body = {"data": b64_content}

        with httpx.Client(timeout=30) as client:
            response = client.post(url, headers=_get_headers(), json=body)

        print(f"Submit status: {response.status_code}")
        print(f"Submit headers: {dict(response.headers)}")
        print(f"Submit body: {response.text[:500]}")

        assert response.status_code == 202, f"Expected 202, got {response.status_code}: {response.text}"
        assert "operation-location" in {k.lower(): v for k, v in response.headers.items()}

    def test_02_full_scoring_flow(self):
        """Test: 完整评分流程 — 提交 → 轮询 → 解析结果."""
        transcript_json = _build_sample_transcript()
        b64_content = base64.b64encode(transcript_json.encode()).decode()

        # Step 1: Submit
        url = (
            f"{CU_ENDPOINT}/contentunderstanding/analyzers/{CU_ANALYZER_ID}:analyze"
            f"?api-version={CU_API_VERSION}"
        )
        # Preview API uses {"data": "<base64>"} format
        body = {"data": b64_content}

        with httpx.Client(timeout=30) as client:
            response = client.post(url, headers=_get_headers(), json=body)

        assert response.status_code == 202
        operation_location = response.headers.get(
            "operation-location", response.headers.get("Operation-Location", "")
        )
        assert operation_location, "No Operation-Location header in response"
        print(f"Operation-Location: {operation_location}")

        # Step 2: Poll until complete
        headers = _get_headers()
        result = None
        for attempt in range(MAX_POLL_ATTEMPTS):
            time.sleep(POLL_INTERVAL)
            with httpx.Client(timeout=30) as client:
                poll_response = client.get(operation_location, headers=headers)

            assert poll_response.status_code == 200, f"Poll failed: {poll_response.status_code}"
            poll_data = poll_response.json()
            status = poll_data.get("status", "").lower()
            print(f"Poll attempt {attempt + 1}: status={status}")

            if status == "succeeded":
                result = poll_data
                break
            elif status in ("failed", "cancelled"):
                pytest.fail(f"Analysis failed: {poll_data}")
            # else: notstarted / running → continue

        assert result is not None, f"Timed out after {MAX_POLL_ATTEMPTS} attempts"

        # Step 3: Parse results
        print(f"\n=== RESULT ===")
        print(json.dumps(result, indent=2, ensure_ascii=False)[:2000])

        # Verify structure: Preview API returns result.contents[].fields
        assert "result" in result
        content = result["result"]
        assert "contents" in content, f"Expected 'contents' in result, got keys: {list(content.keys())}"
        contents = content["contents"]
        assert len(contents) > 0, "Expected at least one content item"
        assert "fields" in contents[0], f"Expected 'fields' in content[0], got: {list(contents[0].keys())}"

    def test_03_analyzer_not_found(self):
        """Test: 向不存在的 Analyzer 提交分析应返回 404."""
        b64_content = base64.b64encode(b'{"test": true}').decode()

        url = (
            f"{CU_ENDPOINT}/contentunderstanding/analyzers/nonExistentAnalyzer9999:analyze"
            f"?api-version={CU_API_VERSION}"
        )
        body = {"data": b64_content}

        with httpx.Client(timeout=30) as client:
            response = client.post(url, headers=_get_headers(), json=body)

        print(f"404 test status: {response.status_code}")
        assert response.status_code == 404


class TestScoreMergeLogic:
    """Test score merge calculation logic (offline, no API needed)."""

    pytestmark = []  # Override class-level skipif

    def _merge_scores(
        self,
        content_scores: dict[str, float],
        voice_scores: dict[str, float] | None,
        content_weight: int = 60,
        voice_weight: int = 40,
    ) -> float:
        """Replicate the score merge logic from cu_evaluation_service."""
        content_total = sum(content_scores.values()) / len(content_scores) if content_scores else 0

        if voice_scores is None:
            # D-13: text-only session
            return content_total

        # D-14: voice session — weighted merge
        voice_total = sum(voice_scores.values()) / len(voice_scores) if voice_scores else 0
        return (content_total * content_weight / 100) + (voice_total * voice_weight / 100)

    def test_text_only_session(self):
        """Test D-13: 纯文本 session 只用 content score."""
        content = {"key_message": 85, "communication": 90, "product_knowledge": 80}
        result = self._merge_scores(content, None)
        expected = (85 + 90 + 80) / 3
        assert abs(result - expected) < 0.01
        print(f"Text-only score: {result:.2f} (expected {expected:.2f})")

    def test_voice_session_default_weights(self):
        """Test D-14: 语音 session 使用默认权重 (60/40) 合并."""
        content = {"key_message": 85, "communication": 90}
        voice = {"fluency": 70, "tone": 75, "pace": 80, "pronunciation": 85}

        result = self._merge_scores(content, voice)
        content_avg = (85 + 90) / 2  # 87.5
        voice_avg = (70 + 75 + 80 + 85) / 4  # 77.5
        expected = content_avg * 0.6 + voice_avg * 0.4  # 52.5 + 31 = 83.5
        assert abs(result - expected) < 0.01
        print(f"Voice session score: {result:.2f} (expected {expected:.2f})")

    def test_custom_weights(self):
        """Test: 自定义权重 (80/20)."""
        content = {"key_message": 80}
        voice = {"fluency": 60}
        result = self._merge_scores(content, voice, content_weight=80, voice_weight=20)
        expected = 80 * 0.8 + 60 * 0.2  # 64 + 12 = 76
        assert abs(result - expected) < 0.01
        print(f"Custom weight score: {result:.2f} (expected {expected:.2f})")
