"""
Azure Voice Live SDK 1.2.0b5 Agent 模式认证 POC 验证

使用新 SDK 的 AgentSessionConfig + connect(agent_config=...) 验证：
  Test 1: API Key + Model 模式（对照组，应成功）
  Test 2: API Key + Agent 模式（Key 认证是否被 Agent 模式接受？）
  Test 3: Entra ID + Agent 模式（标准方式，应成功）
  Test 4: STS Token + Agent 模式（STS 换取的 Bearer Token 能否用？）

运行方式：
  cd backend
  .venv/bin/python3 ../docs/microsoft-agent-framework/tests/test_agent_auth_v2.py
"""

import asyncio
import os
import sys
import time
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

load_dotenv(backend_dir / ".env")

ENDPOINT = os.getenv("AZURE_FOUNDRY_ENDPOINT", "").rstrip("/")
API_KEY = os.getenv("AZURE_FOUNDRY_API_KEY", "")
PROJECT_NAME = os.getenv("AZURE_FOUNDRY_DEFAULT_PROJECT", "avarda-demo-prj")
AGENT_NAME = "Dr-Wang-Fang"
MODEL = "gpt-4o"

# 测试用的文本消息
TEST_MESSAGE = "你好王医生，请问你的专业领域是什么？你对百济神州的产品了解多少？"


def print_header(title: str):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


def print_result(success: bool, message: str):
    icon = "✅" if success else "❌"
    print(f"  {icon} {message}")


def print_info(message: str):
    print(f"  ℹ️  {message}")


def print_event(event_type: str, detail: str):
    print(f"  📨 [{event_type}] {detail}")


async def run_test(credential, auth_label: str, use_agent: bool, send_message: bool = True):
    """运行一次完整的连接+对话测试。"""
    from azure.ai.voicelive.aio import AgentSessionConfig, connect

    mode_label = "Agent 模式" if use_agent else "Model 模式"
    print_header(f"{auth_label} + {mode_label}")

    events_collected = []
    text_response = ""
    got_session_created = False
    got_session_updated = False
    got_response = False
    got_error = False
    error_detail = ""

    try:
        # 构建 connect 参数
        connect_kwargs = {
            "endpoint": ENDPOINT,
            "credential": credential,
        }

        if use_agent:
            agent_config: AgentSessionConfig = {
                "agent_name": AGENT_NAME,
                "project_name": PROJECT_NAME,
            }
            connect_kwargs["agent_config"] = agent_config
            print_info(f"AgentSessionConfig: agent_name={AGENT_NAME}, project_name={PROJECT_NAME}")
        else:
            connect_kwargs["model"] = MODEL
            print_info(f"Model 模式: model={MODEL}")

        async with connect(**connect_kwargs) as connection:
            print_result(True, "WebSocket 连接建立")

            # 构建 session.update（Agent 模式不需要 instructions）
            session_config = {
                "modalities": ["text"],
            }
            if not use_agent:
                session_config["instructions"] = (
                    "你是王芳医生(Dr. Wang Fang)，一位资深的肿瘤科专家。"
                    "你对百济神州的产品非常了解，尤其是泽布替尼(zanubrutinib)。"
                    "请用中文回答。"
                )

            await connection.send({
                "type": "session.update",
                "session": session_config,
            })
            print_info("session.update 已发送")

            # 等待 session.created 和 session.updated
            for _ in range(10):
                try:
                    event = await asyncio.wait_for(connection.recv(), timeout=15.0)
                    event_type = getattr(event, "type", "unknown")
                    events_collected.append(event_type)

                    if event_type == "session.created":
                        got_session_created = True
                        # 检查是否包含 Agent 信息
                        session_data = getattr(event, "session", None)
                        agent_info = getattr(session_data, "agent", None) if session_data else None
                        if agent_info:
                            print_event(event_type, f"会话已创建 (Agent: name={getattr(agent_info, 'name', '?')}, id={getattr(agent_info, 'agent_id', '?')})")
                        else:
                            print_event(event_type, "会话已创建")

                    elif event_type == "session.updated":
                        got_session_updated = True
                        session_data = getattr(event, "session", None)
                        agent_info = getattr(session_data, "agent", None) if session_data else None
                        if agent_info:
                            print_event(event_type, f"会话已更新 (Agent: {getattr(agent_info, 'name', '?')})")
                        else:
                            print_event(event_type, "会话已更新")
                        break

                    elif "error" in event_type:
                        got_error = True
                        error_detail = str(getattr(event, "error", event))
                        print_event(event_type, f"错误: {error_detail}")
                        break
                    else:
                        print_event(event_type, "")

                except asyncio.TimeoutError:
                    print_info("等待事件超时 (15秒)")
                    break

            if got_error:
                print_result(False, f"会话配置被拒绝: {error_detail}")
                return {
                    "auth": auth_label, "mode": mode_label,
                    "connected": True, "session_ok": False,
                    "response": "", "error": error_detail,
                    "events": events_collected,
                }

            if not got_session_created:
                print_result(False, "未收到 session.created")
                return {
                    "auth": auth_label, "mode": mode_label,
                    "connected": True, "session_ok": False,
                    "response": "", "error": "no session.created",
                    "events": events_collected,
                }

            print_result(True, "会话配置成功")

            if not send_message:
                return {
                    "auth": auth_label, "mode": mode_label,
                    "connected": True, "session_ok": True,
                    "response": "", "error": "",
                    "got_response": False,
                    "events": events_collected,
                }

            # 发送用户消息
            await connection.send({
                "type": "conversation.item.create",
                "item": {
                    "type": "message",
                    "role": "user",
                    "content": [{"type": "input_text", "text": TEST_MESSAGE}],
                },
            })
            print_info(f"用户消息已发送: {TEST_MESSAGE[:30]}...")

            # 请求回复
            await connection.send({
                "type": "response.create",
                "response": {"modalities": ["text"]},
            })
            print_info("response.create 已发送，等待回复...")

            # 收集回复
            for _ in range(200):
                try:
                    event = await asyncio.wait_for(connection.recv(), timeout=60.0)
                    event_type = getattr(event, "type", "unknown")
                    events_collected.append(event_type)

                    if event_type == "response.text.delta":
                        delta = getattr(event, "delta", "")
                        text_response += delta
                    elif event_type == "response.text.done":
                        full_text = getattr(event, "text", "")
                        if full_text:
                            text_response = full_text
                        got_response = True
                        print_event(event_type, f"文本回复完成 (长度={len(text_response)})")
                    elif event_type == "response.done":
                        print_event(event_type, "回复流结束")
                        break
                    elif "error" in event_type:
                        got_error = True
                        error_detail = str(getattr(event, "error", event))
                        print_event(event_type, f"错误: {error_detail}")
                        break
                except asyncio.TimeoutError:
                    print_info("等待回复超时 (20秒)")
                    break

            # 输出结果
            if got_error:
                print_result(False, f"对话出错: {error_detail}")
            elif got_response and text_response:
                print_result(True, "收到完整文本回复!")
                print()
                print(f"  ┌─ 回复 {'─'*55}")
                for i in range(0, len(text_response), 60):
                    print(f"  │ {text_response[i:i+60]}")
                print(f"  └{'─'*62}")
            elif text_response:
                print_result(True, f"收到部分回复 (长度={len(text_response)})")
                print()
                preview = text_response[:200]
                print(f"  ┌─ 回复预览 {'─'*50}")
                for i in range(0, len(preview), 60):
                    print(f"  │ {preview[i:i+60]}")
                print(f"  └{'─'*62}")
            else:
                print_result(False, "未收到任何文本回复")

            from collections import Counter
            event_counts = Counter(events_collected)
            print_info(f"事件统计: {dict(event_counts)}")

            return {
                "auth": auth_label, "mode": mode_label,
                "connected": True, "session_ok": got_session_created,
                "response": text_response, "error": error_detail,
                "got_response": got_response,
                "events": events_collected,
            }

    except Exception as e:
        error_msg = str(e)
        print_result(False, f"连接失败: {type(e).__name__}: {error_msg[:300]}")
        return {
            "auth": auth_label, "mode": mode_label,
            "connected": False, "session_ok": False,
            "response": "", "error": error_msg,
            "events": events_collected,
        }


async def main():
    import azure.ai.voicelive as vl_pkg

    print("\n" + "=" * 70)
    print("  Azure Voice Live SDK Agent 认证 POC 验证")
    print("=" * 70)
    print(f"\n  SDK Version:  {getattr(vl_pkg, '__version__', vl_pkg._version.VERSION)}")
    print(f"  Endpoint:     {ENDPOINT}")
    print(f"  Project:      {PROJECT_NAME}")
    print(f"  Agent:        {AGENT_NAME}")
    print(f"  Model:        {MODEL}")

    if not ENDPOINT or not API_KEY:
        print("\n  ❌ 缺少配置：请确认 .env 中设置了 AZURE_FOUNDRY_ENDPOINT 和 AZURE_FOUNDRY_API_KEY")
        sys.exit(1)

    from azure.core.credentials import AzureKeyCredential

    results = []

    # ─── Test 1: API Key + Model 模式（对照组） ───
    key_cred1 = AzureKeyCredential(API_KEY)
    results.append(await run_test(key_cred1, "API Key", use_agent=False))

    # ─── Test 2: API Key + Agent 模式 ───
    key_cred2 = AzureKeyCredential(API_KEY)
    results.append(await run_test(key_cred2, "API Key", use_agent=True))

    # ─── Test 3: Entra ID + Agent 模式 ───
    try:
        from azure.identity.aio import DefaultAzureCredential
        entra_cred = DefaultAzureCredential()
        results.append(await run_test(entra_cred, "Entra ID", use_agent=True))
        await entra_cred.close()
    except Exception as e:
        print_header("Entra ID + Agent 模式")
        print_result(False, f"Entra ID 初始化失败: {e}")

    # ─── Test 4: STS Token + Agent 模式 ───
    try:
        import httpx
        from azure.core.credentials import AccessToken

        print_header("STS Token 交换")
        sts_url = f"{ENDPOINT}/sts/v1.0/issueToken"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                sts_url,
                headers={"Ocp-Apim-Subscription-Key": API_KEY},
                content=b"",
            )
            resp.raise_for_status()
            sts_token = resp.text
            print_info(f"STS Token 获取成功: 长度={len(sts_token)}")

        class StsTokenCredential:
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

        sts_cred = StsTokenCredential(sts_token)
        results.append(await run_test(sts_cred, "STS Token", use_agent=True))

    except Exception as e:
        print_header("STS Token + Agent 模式")
        print_result(False, f"STS Token 测试失败: {e}")

    # ─── 汇总 ───
    print_header("测试结果汇总")
    print()
    print("  | # | 认证方式 | 模式   | 连接 | 会话 | 对话 | 回复长度 | 错误 |")
    print("  |---|---------|--------|------|------|------|---------|------|")

    for i, r in enumerate(results, 1):
        conn = "✅" if r["connected"] else "❌"
        sess = "✅" if r.get("session_ok") else "❌"
        resp = "✅" if r.get("got_response") else ("⚠️" if r["response"] else "❌")
        length = len(r["response"]) if r["response"] else 0
        err = r["error"][:35] if r["error"] else "-"
        auth = r["auth"]
        mode = "Agent" if "Agent" in r["mode"] else "Model"
        print(f"  | {i} | {auth:9s} | {mode:6s} | {conn} | {sess} | {resp} | {length:>7d} | {err} |")

    print()
    print("  关键结论:")

    api_key_agent = next((r for r in results if r["auth"] == "API Key" and "Agent" in r["mode"]), None)
    entra_agent = next((r for r in results if r["auth"] == "Entra ID" and "Agent" in r["mode"]), None)
    sts_agent = next((r for r in results if r["auth"] == "STS Token" and "Agent" in r["mode"]), None)

    if api_key_agent:
        if api_key_agent.get("got_response"):
            print("  🔑 API Key + Agent: ✅ 可以完成对话")
        elif api_key_agent.get("session_ok"):
            print("  🔑 API Key + Agent: ⚠️ 连接成功但对话未完成")
        else:
            print(f"  🔑 API Key + Agent: ❌ 失败 ({api_key_agent.get('error', '')[:60]})")

    if entra_agent:
        if entra_agent.get("got_response"):
            print("  🆔 Entra ID + Agent: ✅ 可以完成对话")
        elif entra_agent.get("session_ok"):
            print("  🆔 Entra ID + Agent: ⚠️ 连接成功但对话未完成")
        else:
            print(f"  🆔 Entra ID + Agent: ❌ 失败 ({entra_agent.get('error', '')[:60]})")

    if sts_agent:
        if sts_agent.get("got_response"):
            print("  🎫 STS Token + Agent: ✅ 可以完成对话")
        elif sts_agent.get("session_ok"):
            print("  🎫 STS Token + Agent: ⚠️ 连接成功但对话未完成")
        else:
            print(f"  🎫 STS Token + Agent: ❌ 失败 ({sts_agent.get('error', '')[:60]})")

    print()


if __name__ == "__main__":
    asyncio.run(main())
