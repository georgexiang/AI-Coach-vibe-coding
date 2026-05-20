"""认证模式测试用例 — 展示正确和错误的认证模式。

这些测试用例作为文档的一部分，展示:
1. 正确的认证模式（应该这样写）
2. 错误的认证模式（不应该这样写）
3. 边界情况处理

注意: 这些是文档性质的测试，实际可运行的测试在 backend/tests/test_azure_auth.py
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ============================================================
# 正确模式 - 使用集中认证模块
# ============================================================


class TestCorrectPattern_OpenAIClient:
    """展示创建 Azure OpenAI 客户端的正确方式。"""

    async def test_correct_scoring_engine_pattern(self):
        """
        正确模式: scoring_engine.py

        从 config_service 获取 endpoint 和 key，
        通过 get_azure_openai_client 创建客户端。
        客户端自动选择 AAD token 或 Key fallback。
        """
        mock_token = MagicMock()
        mock_token.token = "aad-token"
        mock_cred = AsyncMock()
        mock_cred.get_token = AsyncMock(return_value=mock_token)
        mock_cred.close = AsyncMock()

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_cred),
            patch("openai.AsyncAzureOpenAI") as mock_client_cls,
        ):
            from app.services.azure_auth import get_azure_openai_client

            client = await get_azure_openai_client(
                endpoint="https://my-resource.openai.azure.com",
                api_key="fallback-key-from-config",
            )

            # 验证: 使用了 AAD token（不是 API key）
            call_kwargs = mock_client_cls.call_args.kwargs
            assert "azure_ad_token" in call_kwargs
            assert "api_key" not in call_kwargs

    async def test_correct_fallback_pattern(self):
        """
        正确模式: 当 AAD 不可用时自动降级到 API Key。

        开发者不需要手动处理 try/except，
        get_azure_openai_client 内部处理降级逻辑。
        """
        mock_cred = AsyncMock()
        mock_cred.get_token = AsyncMock(side_effect=Exception("no az login"))
        mock_cred.close = AsyncMock()

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_cred),
            patch("openai.AsyncAzureOpenAI") as mock_client_cls,
        ):
            from app.services.azure_auth import get_azure_openai_client

            client = await get_azure_openai_client(
                endpoint="https://my-resource.openai.azure.com",
                api_key="my-api-key",
            )

            # 验证: 降级使用了 API key
            call_kwargs = mock_client_cls.call_args.kwargs
            assert call_kwargs["api_key"] == "my-api-key"
            assert "azure_ad_token" not in call_kwargs


class TestCorrectPattern_RestAPI:
    """展示 REST API 调用的正确认证方式。"""

    async def test_correct_cu_service_pattern(self):
        """
        正确模式: Content Understanding 服务调用。

        使用 get_auth_headers 获取认证头，
        无需关心底层是 Bearer token 还是 Subscription Key。
        """
        with patch(
            "app.services.azure_auth.get_bearer_token",
            new=AsyncMock(return_value="aad-bearer-token"),
        ):
            from app.services.azure_auth import get_auth_headers

            headers = await get_auth_headers(api_key="fallback")

            # 验证: 返回 Bearer Authorization（AAD 优先）
            assert headers["Authorization"] == "Bearer aad-bearer-token"
            assert "Ocp-Apim-Subscription-Key" not in headers


# ============================================================
# 错误模式 - 不应该这样写（反面教材）
# ============================================================


class TestWrongPatterns:
    """展示不应该使用的认证模式（反面教材）。"""

    def test_wrong_direct_api_key(self):
        """
        ❌ 错误模式: 直接用 API Key 创建客户端。

        这是重构前的写法，当 Azure 资源禁用 Key 时会 403。

        错误代码:
            from openai import AsyncAzureOpenAI
            client = AsyncAzureOpenAI(
                azure_endpoint=endpoint,
                api_key=api_key,  # ← 没有 AAD fallback！
            )
        """
        # 这个测试只是文档，验证我们理解错误模式
        # 实际代码中不应出现此模式
        pass

    def test_wrong_inline_credential(self):
        """
        ❌ 错误模式: 在每个服务中内联认证逻辑。

        即使实现了 AAD，也不应该在每个服务中重复：

        错误代码:
            try:
                from azure.identity.aio import DefaultAzureCredential
                credential = DefaultAzureCredential()
                token = await credential.get_token("...")
                headers = {"Authorization": f"Bearer {token.token}"}
            except:
                headers = {"Ocp-Apim-Subscription-Key": api_key}

        正确做法: 使用 get_auth_headers(api_key=key)
        """
        pass

    def test_wrong_hardcoded_key(self):
        """
        ❌ 错误模式: 硬编码 API Key。

        错误代码:
            client = AsyncAzureOpenAI(
                azure_endpoint="https://...",
                api_key="Cq6jJljI...",  # ← 硬编码密钥！
            )

        正确做法: 从 config_service 获取
        """
        pass


# ============================================================
# 边界情况
# ============================================================


class TestEdgeCases:
    """认证模块的边界情况处理。"""

    async def test_no_credentials_raises_clear_error(self):
        """当 AAD 和 Key 都不可用时，应该抛出清晰的错误信息。"""
        mock_cred = AsyncMock()
        mock_cred.get_token = AsyncMock(side_effect=Exception("not logged in"))
        mock_cred.close = AsyncMock()

        with patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_cred):
            from app.services.azure_auth import get_azure_openai_client

            with pytest.raises(RuntimeError) as exc_info:
                await get_azure_openai_client(
                    endpoint="https://test.openai.azure.com",
                    api_key="",  # 空 key
                )

            # 错误信息应该指导用户如何修复
            assert "az login" in str(exc_info.value)
            assert "API key" in str(exc_info.value)

    async def test_token_used_not_key_when_both_available(self):
        """当 AAD 和 Key 都可用时，必须优先使用 AAD token。"""
        mock_token = MagicMock()
        mock_token.token = "aad-token"
        mock_cred = AsyncMock()
        mock_cred.get_token = AsyncMock(return_value=mock_token)
        mock_cred.close = AsyncMock()

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_cred),
            patch("openai.AsyncAzureOpenAI") as mock_cls,
        ):
            from app.services.azure_auth import get_azure_openai_client

            await get_azure_openai_client(
                endpoint="https://test.openai.azure.com",
                api_key="perfectly-valid-key",  # Key 可用但不应使用
            )

            # 验证: AAD token 被使用，Key 被忽略
            call_kwargs = mock_cls.call_args.kwargs
            assert call_kwargs["azure_ad_token"] == "aad-token"
            assert "api_key" not in call_kwargs
