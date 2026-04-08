"""
⚠️ 已废弃 — 请使用 test_agent_auth_v2.py（SDK 1.2.0b5）

本文件使用 azure-ai-voicelive 1.1.0 的 session.agent 字段传递 Agent 配置，
该方式在服务端不被接受。SDK 1.2.0b5 改为通过 connect(agent_config=...) 传递
Agent 配置（编码为 WebSocket URL query params），这是唯一正确的方式。

已知问题：
  - Agent 配置方式错误（session.update 中的 agent 字段，服务端返回 error）
  - 使用 whisper-1 作为 input_audio_transcription model（服务端仅接受 azure-speech / mai-transcribe-1）
  - 未使用 AgentSessionConfig（1.1.0 没有此类型）
  - connect() 仍传 model= 参数（Agent 模式应不指定 model，只传 agent_config）

正确测试：test_agent_auth_v2.py（2026-04-08 POC 验证通过）

───────────────────────────────────────────────────────────────
以下为原始代码，仅供历史参考，不应再运行。
───────────────────────────────────────────────────────────────

Azure Voice Live Agent 模式深度对话验证（SDK 1.1.0 版 — 已过时）

验证 API Key 和 Entra ID 两种认证方式下，Agent 模式是否能完成完整对话：
  - 发送文本消息给 Agent
  - Agent 是否使用了知识库（RAG）回复
  - Agent 回复是否基于其 instructions 中的人格

运行方式：
  cd backend
  .venv/bin/python3 ../docs/microsoft-agent-framework/tests/test_agent_conversation.py
"""

import asyncio
import json
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

# 测试用的文本消息 —— 故意问与 Agent 知识库相关的问题
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


async def run_agent_conversation(credential, auth_label: str, use_agent: bool):
    """运行一次完整的 Agent/Model 对话并收集所有事件。"""
    from azure.ai.voicelive.aio import connect

    mode_label = "Agent 模式" if use_agent else "Model 模式（对照组）"
    print_header(f"{auth_label} + {mode_label}")
    print_info(f"测试消息: {TEST_MESSAGE}")

    events_collected = []
    text_response = ""
    got_session_created = False
    got_session_updated = False
    got_response = False
    got_error = False
    error_detail = ""

    try:
        async with connect(
            endpoint=ENDPOINT,
            credential=credential,
            model=MODEL,
        ) as connection:
            print_result(True, "WebSocket 连接建立")

            # 构建 session.update
            session_config = {
                "modalities": ["text"],  # 只用文本，避免音频复杂性
                "input_audio_transcription": {"model": "whisper-1"},
            }

            if use_agent:
                session_config["agent"] = {
                    "type": "agent",
                    "name": AGENT_NAME,
                    "agent_id": AGENT_NAME,
                    "thread_id": f"test-conv-{int(time.time())}",
                }
                print_info(f"Agent 配置: name={AGENT_NAME}, thread_id={session_config['agent']['thread_id']}")
            else:
                session_config["instructions"] = (
                    "你是王芳医生(Dr. Wang Fang)，一位资深的肿瘤科专家。"
                    "你对百济神州的产品非常了解，尤其是泽布替尼(zanubrutinib)。"
                    "请用中文回答。"
                )
                print_info("Model 模式: 使用 inline instructions 作为对照")

            # 发送 session.update
            await connection.send({
                "type": "session.update",
                "session": session_config,
            })
            print_info("session.update 已发送")

            # 等待 session.created 和 session.updated
            for _ in range(10):
                try:
                    event = await asyncio.wait_for(connection.recv(), timeout=10.0)
                    event_type = getattr(event, "type", "unknown")
                    events_collected.append(event_type)

                    if event_type == "session.created":
                        got_session_created = True
                        print_event(event_type, "会话已创建")
                    elif event_type == "session.updated":
                        got_session_updated = True
                        # 检查 session.updated 中是否包含 agent 配置
                        event_dict = {}
                        try:
                            if hasattr(event, "__dict__"):
                                event_dict = event.__dict__
                            elif hasattr(event, "as_dict"):
                                event_dict = event.as_dict()
                        except Exception:
                            pass
                        session_data = event_dict.get("session", {})
                        if isinstance(session_data, dict) and session_data.get("agent"):
                            print_event(event_type, f"会话已更新（含 Agent 配置: {session_data['agent']}）")
                        else:
                            print_event(event_type, "会话已更新")
                        break
                    elif "error" in event_type:
                        got_error = True
                        error_detail = str(getattr(event, "error", event))
                        print_event(event_type, f"收到错误: {error_detail}")
                        break
                    else:
                        print_event(event_type, "")
                except asyncio.TimeoutError:
                    print_info("等待事件超时")
                    break

            if got_error:
                print_result(False, f"Agent 配置被拒绝: {error_detail}")
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

            # 发送用户消息（文本方式）
            await connection.send({
                "type": "conversation.item.create",
                "item": {
                    "type": "message",
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": TEST_MESSAGE,
                        }
                    ],
                },
            })
            print_info("用户消息已发送")

            # 请求 Agent 回复
            await connection.send({
                "type": "response.create",
                "response": {
                    "modalities": ["text"],
                },
            })
            print_info("response.create 已发送，等待 Agent 回复...")

            # 收集回复事件
            response_done = False
            for _ in range(50):  # 最多等 50 个事件
                try:
                    event = await asyncio.wait_for(connection.recv(), timeout=15.0)
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
                        print_event(event_type, f"文本回复完成（长度={len(text_response)}）")
                    elif event_type == "response.done":
                        response_done = True
                        print_event(event_type, "回复流结束")
                        break
                    elif "error" in event_type:
                        got_error = True
                        error_detail = str(getattr(event, "error", event))
                        print_event(event_type, f"错误: {error_detail}")
                        break
                    # 其他事件静默收集

                except asyncio.TimeoutError:
                    print_info("等待回复超时（15秒）")
                    break

            # 输出结果
            if got_error:
                print_result(False, f"对话过程出错: {error_detail}")
            elif got_response and text_response:
                print_result(True, "收到 Agent 文本回复!")
                print()
                print(f"  ┌─ Agent 回复 {'─'*50}")
                # 每行最多 60 字符
                for i in range(0, len(text_response), 60):
                    print(f"  │ {text_response[i:i+60]}")
                print(f"  └{'─'*62}")
                print()
            elif text_response:
                print_result(True, f"收到部分回复（长度={len(text_response)}），但未完整结束")
            else:
                print_result(False, "未收到任何文本回复")

            # 输出事件摘要
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
        print_result(False, f"连接失败: {type(e).__name__}: {error_msg[:200]}")
        return {
            "auth": auth_label, "mode": mode_label,
            "connected": False, "session_ok": False,
            "response": "", "error": error_msg,
            "events": events_collected,
        }


async def main():
    print("\n" + "=" * 70)
    print("  Azure Voice Live Agent 对话深度验证")
    print("=" * 70)
    print(f"\n  Endpoint:  {ENDPOINT}")
    print(f"  Agent:     {AGENT_NAME}")
    print(f"  Model:     {MODEL}")
    print(f"  Message:   {TEST_MESSAGE}")

    if not ENDPOINT or not API_KEY:
        print("\n  ❌ 缺少配置")
        sys.exit(1)

    from azure.core.credentials import AzureKeyCredential

    results = []

    # Test A: API Key + Model 模式（对照组）
    key_cred = AzureKeyCredential(API_KEY)
    results.append(await run_agent_conversation(key_cred, "API Key", use_agent=False))

    # Test B: API Key + Agent 模式（关键测试）
    key_cred2 = AzureKeyCredential(API_KEY)
    results.append(await run_agent_conversation(key_cred2, "API Key", use_agent=True))

    # Test C: Entra ID + Agent 模式（标准方式）
    try:
        from azure.identity.aio import DefaultAzureCredential
        entra_cred = DefaultAzureCredential()
        results.append(await run_agent_conversation(entra_cred, "Entra ID", use_agent=True))
        await entra_cred.close()
    except Exception as e:
        print_header("Entra ID + Agent 模式")
        print_result(False, f"Entra ID 初始化失败: {e}")

    # 汇总
    print_header("对话验证汇总")
    print()
    print("  | 认证 | 模式 | 连接 | 会话 | 回复 | 回复长度 | 错误 |")
    print("  |------|------|------|------|------|---------|------|")
    for r in results:
        conn = "✅" if r["connected"] else "❌"
        sess = "✅" if r["session_ok"] else "❌"
        resp = "✅" if r.get("got_response") else ("⚠️" if r["response"] else "❌")
        length = len(r["response"]) if r["response"] else 0
        err = r["error"][:30] if r["error"] else "-"
        print(f"  | {r['auth']:6s} | {r['mode'][:12]:12s} | {conn} | {sess} | {resp} | {length:>7d} | {err} |")

    print()

    # 关键结论
    api_key_agent = next((r for r in results if r["auth"] == "API Key" and "Agent" in r["mode"]), None)
    entra_agent = next((r for r in results if r["auth"] == "Entra ID" and "Agent" in r["mode"]), None)

    print("  关键结论:")
    if api_key_agent and api_key_agent.get("got_response"):
        print("  🔑 API Key + Agent 模式：可以完成完整对话")
    elif api_key_agent and api_key_agent["session_ok"] and not api_key_agent.get("got_response"):
        print("  🔑 API Key + Agent 模式：连接成功但对话失败")
    elif api_key_agent:
        print(f"  🔑 API Key + Agent 模式：失败 ({api_key_agent.get('error', 'unknown')[:50]})")

    if entra_agent and entra_agent.get("got_response"):
        print("  🆔 Entra ID + Agent 模式：可以完成完整对话")
    elif entra_agent:
        print(f"  🆔 Entra ID + Agent 模式：{entra_agent.get('error', 'unknown')[:50]}")

    print()


if __name__ == "__main__":
    asyncio.run(main())
