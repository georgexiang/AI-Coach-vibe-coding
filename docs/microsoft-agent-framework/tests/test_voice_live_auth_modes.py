"""
⚠️ 已废弃 — 请使用 test_agent_auth_v2.py（SDK 1.2.0b5）

本文件使用 azure-ai-voicelive 1.1.0 的 session.agent 字段传递 Agent 配置，
该方式在服务端不被接受。SDK 1.2.0b5 改为通过 connect(agent_config=...) 传递
Agent 配置（编码为 WebSocket URL query params），这是唯一正确的方式。

已知问题：
  - API 版本错误（使用 2025-05-01-preview，正确为 SDK 默认的 2026-01-01-preview）
  - Agent 配置方式错误（session.update 中的 agent 字段，服务端返回 error）
  - 测试 4 预期 API Key + Agent 失败，但实测 API Key + Agent 可行
  - 缺少 AgentSessionConfig（1.1.0 没有此类型）

正确测试：test_agent_auth_v2.py（2026-04-08 POC 验证通过）

───────────────────────────────────────────────────────────────
以下为原始代码，仅供历史参考，不应再运行。
───────────────────────────────────────────────────────────────

Azure Voice Live 认证模式验证测试（SDK 1.1.0 版 — 已过时）

验证三种认证方式在 Model 模式和 Agent 模式下的可用性：
  1. API Key (AzureKeyCredential) + Model 模式    → 预期：成功
  2. STS Token Exchange + Agent 模式               → 预期：失败（STS token 无身份信息）
  3. DefaultAzureCredential (Entra ID) + Agent 模式 → 预期：成功

前置条件：
  - backend/.env 中配置了 AZURE_FOUNDRY_ENDPOINT 和 AZURE_FOUNDRY_API_KEY
  - 已执行 az login（DefaultAzureCredential 需要）
  - 已有同步的 Agent（如 Dr-Wang-Fang）
  - pip install azure-ai-voicelive azure-identity

运行方式：
  cd backend
  python3 ../docs/microsoft-agent-framework/tests/test_voice_live_auth_modes.py
"""

import asyncio
import os
import sys
import time
from pathlib import Path

# 确保能 import backend 模块
backend_dir = Path(__file__).resolve().parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

# ── 配置 ─────────────────────────────────────────────────────────────────────

# 从 .env 读取配置（如果在 backend 目录下运行）
from dotenv import load_dotenv  # noqa: E402

load_dotenv(backend_dir / ".env")

ENDPOINT = os.getenv("AZURE_FOUNDRY_ENDPOINT", "").rstrip("/")
API_KEY = os.getenv("AZURE_FOUNDRY_API_KEY", "")
PROJECT_NAME = os.getenv("AZURE_FOUNDRY_DEFAULT_PROJECT", "avarda-demo-prj")
AGENT_NAME = "Dr-Wang-Fang"  # 已同步的 Agent
# Voice Live 有自己的支持模型列表，不是所有 Azure OpenAI 模型都适用
MODEL = "gpt-4o"  # Voice Live 支持的模型（见 voice_live_models.py）
API_VERSION = "2025-05-01-preview"
# 备选 API_VERSION: "2025-10-01" (GA) / "2025-05-01-preview"

# ── 工具函数 ──────────────────────────────────────────────────────────────────


def print_header(title: str):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


def print_result(success: bool, message: str):
    icon = "✅" if success else "❌"
    print(f"  {icon} {message}")


def print_info(message: str):
    print(f"  ℹ️  {message}")


async def exchange_api_key_for_sts_token(endpoint: str, api_key: str) -> str:
    """通过 STS endpoint 将 API Key 换取 Bearer Token。"""
    import httpx

    sts_url = f"{endpoint}/sts/v1.0/issueToken"
    print_info(f"STS endpoint: {sts_url}")

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            sts_url,
            headers={"Ocp-Apim-Subscription-Key": api_key},
            content=b"",
        )
        resp.raise_for_status()
        token = resp.text
        # 显示 token 摘要（不泄露完整内容）
        print_info(f"STS token 获取成功: 长度={len(token)}, 前20字符={token[:20]}...")
        return token


# ── 测试 1: API Key + Model 模式 ─────────────────────────────────────────────


async def test_1_api_key_model_mode():
    """测试 API Key 认证 + Model 模式（预期：成功）"""
    print_header("测试 1: API Key + Model 模式")
    print_info(f"endpoint: {ENDPOINT}")
    print_info(f"model: {MODEL}")
    print_info(f"认证方式: AzureKeyCredential (API Key)")

    try:
        from azure.ai.voicelive.aio import connect
        from azure.core.credentials import AzureKeyCredential

        credential = AzureKeyCredential(API_KEY)

        async with connect(
            endpoint=ENDPOINT,
            credential=credential,
            model=MODEL,
            api_version=API_VERSION,
        ) as connection:
            print_result(True, "连接成功！API Key + Model 模式可用")

            # 发送一个简单的 session.update 验证连接活跃
            await connection.send(
                {
                    "type": "session.update",
                    "session": {
                        "instructions": "你是一个测试助手，请简短回复。",
                        "voice": "alloy",
                        "modalities": ["text", "audio"],
                    },
                }
            )
            print_result(True, "session.update 发送成功")

            # 等待一个事件确认连接正常
            try:
                event = await asyncio.wait_for(connection.recv(), timeout=10.0)
                print_result(True, f"收到事件: type={getattr(event, 'type', 'unknown')}")
            except asyncio.TimeoutError:
                print_result(True, "连接正常（10秒内未收到事件，但连接未断开）")

        return True

    except Exception as e:
        print_result(False, f"连接失败: {type(e).__name__}: {e}")
        return False


# ── 测试 2: STS Token + Agent 模式 ───────────────────────────────────────────


async def test_2_sts_token_agent_mode():
    """测试 STS Token 认证 + Agent 模式（预期：失败）"""
    print_header("测试 2: STS Token + Agent 模式")
    print_info(f"endpoint: {ENDPOINT}")
    print_info(f"agent_name: {AGENT_NAME}")
    print_info(f"project_name: {PROJECT_NAME}")
    print_info(f"认证方式: STS Token (API Key 换取的 Bearer Token)")

    try:
        # 第 1 步：将 API Key 换成 STS Token
        sts_token = await exchange_api_key_for_sts_token(ENDPOINT, API_KEY)
    except Exception as e:
        print_result(False, f"STS Token 获取失败: {type(e).__name__}: {e}")
        return False

    try:
        from azure.ai.voicelive.aio import connect
        from azure.core.credentials import AccessToken

        # 创建一个包装 STS Token 的 TokenCredential
        class StsTokenCredential:
            """将 STS Token 包装为 AsyncTokenCredential 接口。"""

            def __init__(self, token: str):
                self._token = token

            async def get_token(self, *scopes, **kwargs):
                return AccessToken(self._token, int(time.time()) + 600)

            async def close(self):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

        credential = StsTokenCredential(sts_token)

        # SDK v1.1: agent 配置通过 session.update 传递，不是 connect() 参数
        async with connect(
            endpoint=ENDPOINT,
            credential=credential,
            model=MODEL,  # connect 只接受 model 参数
        ) as connection:
            print_result(True, "WebSocket 连接建立（STS Token 被接受）")

            # 发送带 agent 配置的 session.update
            await connection.send(
                {
                    "type": "session.update",
                    "session": {
                        "agent": {
                            "type": "agent",
                            "name": AGENT_NAME,
                            "agent_id": AGENT_NAME,
                            "thread_id": "test-thread-sts",
                        },
                        "modalities": ["text", "audio"],
                    },
                }
            )
            print_info("session.update 已发送（含 agent 配置）")

            try:
                event = await asyncio.wait_for(connection.recv(), timeout=10.0)
                event_type = getattr(event, "type", "unknown")

                if "error" in str(event_type).lower():
                    error_data = getattr(event, "error", event)
                    print_result(False, f"Agent 模式被拒绝: type={event_type}, error={error_data}")
                    return False
                else:
                    print_result(True, f"收到事件: type={event_type}（STS Token + Agent 居然可用！）")
            except asyncio.TimeoutError:
                print_result(True, "连接正常（10秒内未收到事件）")

        return True

    except Exception as e:
        error_msg = str(e)
        print_result(False, f"连接失败: {type(e).__name__}: {error_msg}")

        if "authentication" in error_msg.lower() or "auth" in error_msg.lower():
            print_info("→ 认证被拒绝：STS Token 不被 Agent 模式接受")
        elif "403" in error_msg or "forbidden" in error_msg.lower():
            print_info("→ 权限不足：STS Token 没有所需的身份/角色信息")
        elif "401" in error_msg or "unauthorized" in error_msg.lower():
            print_info("→ 未授权：STS Token 不被识别为有效的 Entra ID 身份")
        else:
            print_info(f"→ 其他错误：{error_msg[:200]}")

        return False


# ── 测试 3: DefaultAzureCredential + Agent 模式 ──────────────────────────────


async def test_3_entra_id_agent_mode():
    """测试 DefaultAzureCredential (Entra ID) + Agent 模式（预期：成功）"""
    print_header("测试 3: DefaultAzureCredential (Entra ID) + Agent 模式")
    print_info(f"endpoint: {ENDPOINT}")
    print_info(f"agent_name: {AGENT_NAME}")
    print_info(f"project_name: {PROJECT_NAME}")
    print_info(f"认证方式: DefaultAzureCredential (Entra ID)")

    try:
        from azure.identity.aio import DefaultAzureCredential

        credential = DefaultAzureCredential()
        token = await credential.get_token("https://cognitiveservices.azure.com/.default")
        print_info(f"Entra ID token 获取成功: 长度={len(token.token)}, 过期={token.expires_on}")

    except Exception as e:
        print_result(False, f"Entra ID token 获取失败: {type(e).__name__}: {e}")
        print_info("→ 请确认已执行 az login 且账号有正确的 RBAC 角色")
        return False

    try:
        from azure.ai.voicelive.aio import connect

        # SDK v1.1: connect() 用 credential + model，agent 配置在 session.update 中
        async with connect(
            endpoint=ENDPOINT,
            credential=credential,
            model=MODEL,
        ) as connection:
            print_result(True, "WebSocket 连接建立（Entra ID 认证通过）")

            # 发送带 agent 配置的 session.update
            await connection.send(
                {
                    "type": "session.update",
                    "session": {
                        "agent": {
                            "type": "agent",
                            "name": AGENT_NAME,
                            "agent_id": AGENT_NAME,
                            "thread_id": "test-thread-entra",
                        },
                        "modalities": ["text", "audio"],
                    },
                }
            )
            print_info("session.update 已发送（含 agent 配置）")

            try:
                event = await asyncio.wait_for(connection.recv(), timeout=10.0)
                event_type = getattr(event, "type", "unknown")

                if "error" in str(event_type).lower():
                    error_data = getattr(event, "error", event)
                    print_result(False, f"Agent 模式配置被拒: type={event_type}, error={error_data}")
                    return False
                else:
                    print_result(True, f"收到事件: type={event_type}")
            except asyncio.TimeoutError:
                print_result(True, "连接正常（10秒内未收到事件）")

        return True

    except Exception as e:
        error_msg = str(e)
        print_result(False, f"连接失败: {type(e).__name__}: {error_msg}")

        if "role" in error_msg.lower() or "rbac" in error_msg.lower():
            print_info("→ RBAC 角色不足：请为当前用户分配 'Cognitive Services User' 和 'Azure AI User' 角色")
        elif "403" in error_msg or "forbidden" in error_msg.lower():
            print_info("→ 权限不足：Entra ID 身份没有足够的角色")
        else:
            print_info(f"→ 其他错误：{error_msg[:200]}")

        return False

    finally:
        await credential.close()


# ── 测试 4 (附加): API Key + Agent 模式 ──────────────────────────────────────


async def test_4_api_key_agent_mode():
    """测试 API Key 认证 + Agent 模式（预期：连接成功但 Agent 配置被拒）"""
    print_header("测试 4 (附加): API Key + Agent 模式")
    print_info(f"endpoint: {ENDPOINT}")
    print_info(f"agent_name: {AGENT_NAME}")
    print_info(f"认证方式: AzureKeyCredential (API Key)")

    try:
        from azure.ai.voicelive.aio import connect
        from azure.core.credentials import AzureKeyCredential

        credential = AzureKeyCredential(API_KEY)

        # SDK v1.1: connect() 只接受 model，agent 配置在 session.update 中
        async with connect(
            endpoint=ENDPOINT,
            credential=credential,
            model=MODEL,
        ) as connection:
            print_result(True, "WebSocket 连接建立（API Key 认证通过）")

            # 发送带 agent 配置的 session.update —— 预期被拒绝
            await connection.send(
                {
                    "type": "session.update",
                    "session": {
                        "agent": {
                            "type": "agent",
                            "name": AGENT_NAME,
                            "agent_id": AGENT_NAME,
                            "thread_id": "test-thread-key",
                        },
                        "modalities": ["text", "audio"],
                    },
                }
            )
            print_info("session.update 已发送（含 agent 配置）")

            try:
                event = await asyncio.wait_for(connection.recv(), timeout=10.0)
                event_type = getattr(event, "type", "unknown")

                if "error" in str(event_type).lower():
                    error_data = getattr(event, "error", event)
                    print_result(False, f"Agent 模式被拒绝: type={event_type}, error={error_data}")
                    print_info("→ 确认：API Key 不支持 Agent 模式")
                    return False
                else:
                    print_result(True, f"收到事件: type={event_type}（API Key + Agent 居然可用！）")
            except asyncio.TimeoutError:
                print_result(True, "连接正常（10秒内未收到事件）")

        return True

    except Exception as e:
        error_msg = str(e)
        print_result(False, f"连接失败: {type(e).__name__}: {error_msg}")

        if "key authentication" in error_msg.lower():
            print_info("→ 确认：Key authentication is not supported in Agent mode")
        elif "authentication" in error_msg.lower():
            print_info("→ 认证方式不被 Agent 模式接受")
        else:
            print_info(f"→ 错误详情：{error_msg[:200]}")

        return False


# ── 主函数 ────────────────────────────────────────────────────────────────────


async def main():
    print("\n" + "=" * 70)
    print("  Azure Voice Live 认证模式验证测试")
    print("=" * 70)
    print(f"\n  Endpoint:     {ENDPOINT}")
    print(f"  Project:      {PROJECT_NAME}")
    print(f"  Agent:        {AGENT_NAME}")
    print(f"  Model:        {MODEL}")
    print(f"  API Version:  {API_VERSION}")

    if not ENDPOINT or not API_KEY:
        print("\n  ❌ 缺少配置：请确认 .env 中设置了 AZURE_FOUNDRY_ENDPOINT 和 AZURE_FOUNDRY_API_KEY")
        sys.exit(1)

    results = {}

    # 按顺序运行测试
    results["test_1_api_key_model"] = await test_1_api_key_model_mode()
    results["test_2_sts_token_agent"] = await test_2_sts_token_agent_mode()
    results["test_3_entra_id_agent"] = await test_3_entra_id_agent_mode()
    results["test_4_api_key_agent"] = await test_4_api_key_agent_mode()

    # 汇总报告
    print_header("测试结果汇总")
    print()
    print("  | # | 认证方式 | 调用模式 | 预期 | 实际 |")
    print("  |---|---------|---------|------|------|")

    expectations = {
        "test_1_api_key_model": ("API Key", "Model", "成功"),
        "test_2_sts_token_agent": ("STS Token", "Agent", "失败"),
        "test_3_entra_id_agent": ("Entra ID", "Agent", "成功"),
        "test_4_api_key_agent": ("API Key", "Agent", "失败"),
    }

    all_match = True
    for key, (auth, mode, expected) in expectations.items():
        actual = "成功" if results.get(key) else "失败"
        match = "✅" if (expected == actual) else "⚠️ 意外"
        if expected != actual:
            all_match = False
        print(f"  | {key[-1]} | {auth:12s} | {mode:6s} | {expected} | {actual} {match} |")

    print()
    if all_match:
        print("  ✅ 所有测试结果符合预期")
    else:
        print("  ⚠️ 部分测试结果与预期不符，需要进一步分析")

    print()


if __name__ == "__main__":
    asyncio.run(main())
