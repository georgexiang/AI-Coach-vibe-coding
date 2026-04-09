"""Agent Metadata API 探测测试 — 真实 Azure 连接

用途：
  快速验证 Azure AI Foundry Agent Registry API 对 metadata 的行为，包括：
  1. metadata 读写 round-trip
  2. 512 字符限制验证（当前是否仍然存在）
  3. 版本号追踪
  4. Voice Live metadata 格式验证
  5. null / 默认值行为

运行前置：
  pip install azure-ai-projects>=2.0.1
  设置环境变量：
    AZURE_FOUNDRY_ENDPOINT=https://<resource>.services.ai.azure.com
    AZURE_FOUNDRY_API_KEY=<your-api-key>
    AZURE_FOUNDRY_PROJECT=<project-name>

运行：
  cd docs/microsoft-agent-framework/tests
  python test_agent_metadata_api.py

注意：此脚本会创建和删除临时 Agent，不会影响已有 Agent。
"""

import json
import os
import sys
import time

# ---------------------------------------------------------------------------
# 配置（从环境变量读取，不硬编码）
# ---------------------------------------------------------------------------
ENDPOINT = os.getenv("AZURE_FOUNDRY_ENDPOINT", "")
API_KEY = os.getenv("AZURE_FOUNDRY_API_KEY", "")
PROJECT = os.getenv("AZURE_FOUNDRY_PROJECT", "")

if not ENDPOINT or not API_KEY or not PROJECT:
    print("❌ 请设置以下环境变量:")
    print("   AZURE_FOUNDRY_ENDPOINT")
    print("   AZURE_FOUNDRY_API_KEY")
    print("   AZURE_FOUNDRY_PROJECT")
    sys.exit(1)

PROJECT_ENDPOINT = f"{ENDPOINT.rstrip('/')}/api/projects/{PROJECT}"

# ---------------------------------------------------------------------------
# SDK 客户端初始化（API Key 模式）
# ---------------------------------------------------------------------------


class _StubCredential:
    """空壳 TokenCredential — SDK 构造函数要求此类型，但实际用 api-key header。"""

    def __init__(self, key: str):
        self._key = key

    def get_token(self, *scopes, **kwargs):
        from azure.core.credentials import AccessToken

        return AccessToken(self._key, int(time.time()) + 86400)


def get_client():
    from azure.ai.projects import AIProjectClient
    from azure.core.credentials import AzureKeyCredential
    from azure.core.pipeline.policies import AzureKeyCredentialPolicy

    return AIProjectClient(
        endpoint=PROJECT_ENDPOINT,
        credential=_StubCredential(API_KEY),
        authentication_policy=AzureKeyCredentialPolicy(
            credential=AzureKeyCredential(API_KEY),
            name="api-key",
        ),
    )


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------
TEMP_AGENT_PREFIX = "metadata-test-"


def create_temp_agent(client, suffix="basic", metadata=None):
    """创建临时测试 Agent，返回 (name, version)。"""
    from azure.ai.projects.models import PromptAgentDefinition

    name = f"{TEMP_AGENT_PREFIX}{suffix}-{int(time.time())}"
    definition = PromptAgentDefinition(
        model="gpt-4o",
        instructions="Temporary agent for metadata API testing.",
    )
    result = client.agents.create_version(
        agent_name=name,
        definition=definition,
        description="Metadata test agent",
        metadata=metadata,
    )
    return name, result.version


def delete_temp_agent(client, name):
    """安全删除临时 Agent。"""
    try:
        client.agents.delete(agent_name=name)
        print(f"  🗑️  已删除临时 Agent: {name}")
    except Exception as e:
        print(f"  ⚠️  删除失败: {name} — {e}")


def read_agent_metadata(client, name):
    """读取 Agent 最新版本的 metadata。"""
    agent = client.agents.get(agent_name=name)
    latest = getattr(agent, "versions", {}).get("latest", {})
    return latest.get("metadata", {})


# ===========================================================================
# 测试用例
# ===========================================================================


def test_01_metadata_roundtrip():
    """测试 1：Metadata 基本读写 round-trip"""
    print("\n" + "=" * 60)
    print("测试 1：Metadata 基本读写 round-trip")
    print("=" * 60)

    client = get_client()
    metadata = {
        "custom-key-1": "hello",
        "custom-key-2": "world",
        "number-as-string": "42",
    }
    name, version = create_temp_agent(client, "roundtrip", metadata)
    print(f"  ✅ Agent 创建成功: {name} (version {version})")

    # 读回 metadata
    read_meta = read_agent_metadata(client, name)
    print(f"  📖 读回 metadata: {json.dumps(read_meta, indent=2)}")

    # 验证
    for key, value in metadata.items():
        if read_meta.get(key) == value:
            print(f"  ✅ {key} = {value}")
        else:
            print(f"  ❌ {key}: 期望 {value!r}, 实际 {read_meta.get(key)!r}")

    delete_temp_agent(client, name)


def test_02_512_char_limit():
    """测试 2：验证 512 字符限制是否仍然存在"""
    print("\n" + "=" * 60)
    print("测试 2：验证 512 字符限制")
    print("=" * 60)

    client = get_client()

    # 2a: 正好 512 字符 — 应该成功
    value_512 = "A" * 512
    print(f"  📏 测试 512 字符 value (len={len(value_512)})...")
    try:
        name, version = create_temp_agent(client, "512ok", {"test-key": value_512})
        print(f"  ✅ 512 字符 — 成功 (version {version})")
        delete_temp_agent(client, name)
    except Exception as e:
        print(f"  ❌ 512 字符 — 失败: {e}")

    # 2b: 513 字符 — 应该被拒绝
    value_513 = "A" * 513
    print(f"  📏 测试 513 字符 value (len={len(value_513)})...")
    try:
        name, version = create_temp_agent(client, "513fail", {"test-key": value_513})
        print(f"  ⚠️  513 字符 — 居然成功了！限制可能已放宽 (version {version})")
        delete_temp_agent(client, name)
    except Exception as e:
        error_msg = str(e)
        if "512" in error_msg or "maximum length" in error_msg.lower():
            print(f"  ✅ 513 字符 — 被拒绝 (符合预期): {error_msg[:200]}")
        else:
            print(f"  ❌ 513 字符 — 意外错误: {error_msg[:200]}")

    # 2c: 1024 字符
    value_1024 = "B" * 1024
    print(f"  📏 测试 1024 字符 value (len={len(value_1024)})...")
    try:
        name, version = create_temp_agent(client, "1024", {"test-key": value_1024})
        print(f"  ⚠️  1024 字符 — 成功！限制已彻底放宽 (version {version})")
        delete_temp_agent(client, name)
    except Exception as e:
        print(f"  ✅ 1024 字符 — 被拒绝: {str(e)[:200]}")


def test_03_version_tracking():
    """测试 3：版本号追踪 — 每次 create_version 版本号递增"""
    print("\n" + "=" * 60)
    print("测试 3：版本号追踪")
    print("=" * 60)

    client = get_client()
    from azure.ai.projects.models import PromptAgentDefinition

    name, v1 = create_temp_agent(client, "version")
    print(f"  版本 1: {v1}")

    # 创建版本 2
    definition = PromptAgentDefinition(model="gpt-4o", instructions="Updated instructions v2.")
    r2 = client.agents.create_version(
        agent_name=name,
        definition=definition,
        metadata={"step": "2"},
    )
    v2 = r2.version
    print(f"  版本 2: {v2}")

    # 创建版本 3（只改 metadata）
    r3 = client.agents.create_version(
        agent_name=name,
        definition=definition,
        metadata={"step": "3", "extra": "data"},
    )
    v3 = r3.version
    print(f"  版本 3: {v3}")

    # 验证版本递增
    versions = [int(v1), int(v2), int(v3)]
    if versions == sorted(versions) and len(set(versions)) == 3:
        print(f"  ✅ 版本严格递增: {versions}")
    else:
        print(f"  ⚠️  版本号: {versions} — 检查是否连续递增")

    # 读取最新版本
    agent = client.agents.get(agent_name=name)
    latest = getattr(agent, "versions", {}).get("latest", {})
    latest_ver = latest.get("version")
    latest_meta = latest.get("metadata", {})
    print(f"  📖 get() 返回最新版本: {latest_ver}")
    print(f"  📖 最新 metadata: {json.dumps(latest_meta, indent=2)}")

    delete_temp_agent(client, name)


def test_04_voice_live_metadata_format():
    """测试 4：Voice Live metadata 格式 — 验证 Portal 可识别的格式"""
    print("\n" + "=" * 60)
    print("测试 4：Voice Live metadata 格式")
    print("=" * 60)

    client = get_client()

    # 精简格式（省略 null 和默认值）
    config = {
        "session": {
            "voice": {"name": "zh-CN-XiaoxiaoMultilingualNeural"},
            "turnDetection": {"type": "azure_semantic_vad"},
            "avatar": {"character": "lisa", "style": "casual-sitting"},
        }
    }
    config_json = json.dumps(config, separators=(",", ":"))

    metadata = {
        "microsoft.voice-live.enabled": "true",
        "microsoft.voice-live.configuration": config_json,
        "description": "VL Test Agent",
        "modified_at": str(int(time.time())),
    }

    print(f"  📏 config JSON 长度: {len(config_json)} 字符")
    print(f"  📄 config JSON: {config_json}")

    name, version = create_temp_agent(client, "vl-format", metadata)
    print(f"  ✅ Agent 创建成功: {name} (version {version})")

    # 读回验证
    read_meta = read_agent_metadata(client, name)
    vl_enabled = read_meta.get("microsoft.voice-live.enabled")
    vl_config = read_meta.get("microsoft.voice-live.configuration")

    print(f"  📖 voice-live.enabled: {vl_enabled}")
    if vl_config:
        parsed = json.loads(vl_config)
        print(f"  📖 voice-live.configuration: {json.dumps(parsed, indent=2)}")
        if parsed == config:
            print("  ✅ config round-trip 完全一致")
        else:
            print("  ❌ config round-trip 不一致")
    else:
        print("  ❌ voice-live.configuration 读回为空")

    print(f"\n  💡 现在可以去 AI Foundry Portal 查看 Agent '{name}' 的 Voice mode 状态")
    delete_temp_agent(client, name)


def test_05_metadata_merge_behavior():
    """测试 5：Metadata 合并行为 — 新版本是否保留/覆盖旧 metadata"""
    print("\n" + "=" * 60)
    print("测试 5：Metadata 合并行为")
    print("=" * 60)

    client = get_client()
    from azure.ai.projects.models import PromptAgentDefinition

    # v1: 设置 key-a 和 key-b
    name, v1 = create_temp_agent(client, "merge", {"key-a": "alpha", "key-b": "beta"})
    print(f"  v{v1} metadata: key-a=alpha, key-b=beta")

    # v2: 只传 key-c — 看 key-a/key-b 是否保留
    definition = PromptAgentDefinition(model="gpt-4o", instructions="Test merge.")
    r2 = client.agents.create_version(
        agent_name=name,
        definition=definition,
        metadata={"key-c": "gamma"},
    )
    meta2 = read_agent_metadata(client, name)
    print(f"  v{r2.version} metadata (只传 key-c): {json.dumps(meta2, indent=2)}")

    if "key-a" in meta2:
        print("  ⚠️  旧 key 被保留 — metadata 是合并模式 (merge)")
    else:
        print("  ✅ 旧 key 被替换 — metadata 是覆盖模式 (replace)")

    # v3: 传空 metadata
    r3 = client.agents.create_version(
        agent_name=name,
        definition=definition,
        metadata={},
    )
    meta3 = read_agent_metadata(client, name)
    print(f"  v{r3.version} metadata (传空 {{}}): {json.dumps(meta3, indent=2)}")

    # v4: 不传 metadata (None)
    r4 = client.agents.create_version(
        agent_name=name,
        definition=definition,
    )
    meta4 = read_agent_metadata(client, name)
    print(f"  v{r4.version} metadata (不传 metadata): {json.dumps(meta4, indent=2)}")

    delete_temp_agent(client, name)


def test_06_agent_get_structure():
    """测试 6：agent.get() 返回结构探测 — 了解 metadata 存放位置"""
    print("\n" + "=" * 60)
    print("测试 6：agent.get() 返回结构")
    print("=" * 60)

    client = get_client()
    metadata = {"test-key": "test-value"}
    name, version = create_temp_agent(client, "structure", metadata)

    agent = client.agents.get(agent_name=name)

    # 探测顶层属性
    print(f"  agent.name: {agent.name}")
    print(f"  type(agent): {type(agent).__name__}")

    # 顶层 metadata?
    top_meta = getattr(agent, "metadata", "NOT_FOUND")
    print(f"  agent.metadata: {top_meta}")

    # versions 结构
    versions = getattr(agent, "versions", "NOT_FOUND")
    if isinstance(versions, dict):
        print(f"  agent.versions keys: {list(versions.keys())}")
        latest = versions.get("latest", {})
        if isinstance(latest, dict):
            print(f"  agent.versions.latest keys: {list(latest.keys())}")
            print(f"  agent.versions.latest.version: {latest.get('version')}")
            print(f"  agent.versions.latest.metadata: {latest.get('metadata')}")
            defn = latest.get("definition", {})
            if isinstance(defn, dict):
                print(f"  agent.versions.latest.definition keys: {list(defn.keys())}")
        else:
            print(f"  agent.versions.latest type: {type(latest)}")
    else:
        print(f"  agent.versions type: {type(versions)}")

    # 尝试 as_dict() 如果可用
    if hasattr(agent, "as_dict"):
        full = agent.as_dict()
        print(f"\n  📄 agent.as_dict() 完整输出:")
        print(json.dumps(full, indent=2, default=str)[:2000])
    elif hasattr(agent, "__dict__"):
        print(f"\n  📄 agent.__dict__ keys: {list(agent.__dict__.keys())}")

    delete_temp_agent(client, name)


# ===========================================================================
# 主执行
# ===========================================================================

if __name__ == "__main__":
    print("🔬 Azure AI Foundry Agent Metadata API 探测测试")
    print(f"📍 Endpoint: {PROJECT_ENDPOINT}")
    print(f"🔑 API Key: {'*' * 8}...{API_KEY[-4:]}" if len(API_KEY) > 4 else "🔑 API Key: ***")

    tests = [
        test_01_metadata_roundtrip,
        test_02_512_char_limit,
        test_03_version_tracking,
        test_04_voice_live_metadata_format,
        test_05_metadata_merge_behavior,
        test_06_agent_get_structure,
    ]

    # 支持选择性运行: python test_agent_metadata_api.py 2 4
    if len(sys.argv) > 1:
        selected = [int(x) for x in sys.argv[1:]]
        tests = [t for i, t in enumerate(tests, 1) if i in selected]

    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"\n  💥 测试异常: {e}")

    print("\n" + "=" * 60)
    print("✅ 所有测试完成")
    print("=" * 60)
