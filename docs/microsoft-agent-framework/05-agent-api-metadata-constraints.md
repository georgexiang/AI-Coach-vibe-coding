# 05 — Agent Registry API：Endpoint、Metadata 格式与限制

> **目标读者**：后端开发、Vibe Coding Agent
>
> **前置知识**：已阅读 01-04，了解 API Key / Entra ID 认证和 Agent 模式基础

---

## 1. API Endpoint 构造

### 1.1 Endpoint 结构

Azure AI Foundry Agent Registry API 的 endpoint 格式：

```
https://<resource-name>.services.ai.azure.com/api/projects/<project-name>
```

| 组成部分 | 说明 | 示例 |
|---------|------|------|
| `resource-name` | AI Foundry 资源名 | `my-ai-foundry` |
| `project-name` | 项目名（在 Foundry Portal 中创建） | `my-agent-project` |

### 1.2 Endpoint 拼接逻辑

```python
base = base_endpoint.rstrip("/")
if "/api/projects/" in base:
    project_endpoint = base                       # 已经包含完整路径
elif project_name:
    project_endpoint = f"{base}/api/projects/{project_name}"
else:
    project_endpoint = base                       # 缺少 project，会 404
```

**配置优先级**（从高到低）：
1. 管理后台配置的 `default_project`（DB）
2. Voice Live 配置中 agent mode JSON 的 `project_name`
3. 环境变量 `AZURE_FOUNDRY_DEFAULT_PROJECT`

### 1.3 SDK 客户端初始化

使用 `azure-ai-projects>=2.0.1` 的 `AIProjectClient`：

```python
from azure.ai.projects import AIProjectClient

# API Key 认证（需要 AzureKeyCredentialPolicy hack）
client = AIProjectClient(
    endpoint=project_endpoint,
    credential=token_credential_stub,
    authentication_policy=AzureKeyCredentialPolicy(
        credential=AzureKeyCredential(api_key),
        name="api-key",
    ),
)

# Entra ID 认证（标准方式）
client = AIProjectClient(
    endpoint=project_endpoint,
    credential=DefaultAzureCredential(),
)
```

> **注意**：API Key 模式下，SDK 构造函数要求 `TokenCredential` 类型的 credential，但实际认证通过 `api-key` HTTP header 完成。需要提供一个空壳 `TokenCredential` 实现绕过类型检查。详见 `agent_sync_service._ApiKeyTokenCredential`。

---

## 2. Agent 版本模型

Azure AI Foundry Agent 采用**不可变版本**模型：

```
Agent Name → Version 1, Version 2, Version 3, ...
```

- **创建**：`client.agents.create_version(agent_name, definition, metadata)`
- **更新**：同样调用 `create_version`（创建新版本，不是修改原版本）
- **读取**：`client.agents.get(agent_name)` 返回最新版本信息
- **删除**：`client.agents.delete(agent_name)` 删除整个 agent（含所有版本）

### 2.1 版本号权威来源

```python
result = client.agents.create_version(agent_name=name, definition=def_, metadata=meta)
authoritative_version = result.version  # ← 以此为准，不要用 +1 逻辑
```

**关键原则**：每次调用 `create_version` 后，必须用返回的 `result.version` 更新本地数据库，不要自己计算版本号。原因：
- Portal 端的手动保存也会递增版本
- 并发调用可能导致版本跳跃
- 不同来源（代码 sync + Portal 操作 + metadata 更新）都会创建新版本

### 2.2 查询最新版本

```python
agent = client.agents.get(agent_name=agent_id)
latest = agent.versions.get("latest", {})
version = latest.get("version")
definition = latest.get("definition", {})
metadata = latest.get("metadata", {})  # 版本级 metadata
```

---

## 3. Metadata 格式与约束

### 3.1 基本格式

Agent metadata 是 `dict[str, str]` 类型的键值对（key-value pairs），存储在**版本级别**。

```python
metadata = {
    "microsoft.voice-live.enabled": "true",
    "microsoft.voice-live.configuration": '{"session":{...}}',
    "description": "HCP Agent: Dr. Wang",
    "modified_at": "1712700000",
}
```

### 3.2 关键约束：512 字符限制（2026-04 实测）

| 约束 | 详情 |
|------|------|
| **Value 类型** | 只能是 `str`（字符串） |
| **Value 最大长度** | **512 字符**（超过会被 API 拒绝） |
| **Key 最大长度** | 未明确记录，建议 < 256 字符 |
| **总 metadata 大小** | 未明确限制，实测数十个 key 无问题 |
| **错误消息** | `(invalid_payload) Invalid value for key 'xxx'. Must not exceed maximum length of 512 characters` |

> **重要发现**：Azure AI Foundry Portal 自身保存 Voice Live 配置时，也将 JSON 写入 `microsoft.voice-live.configuration` metadata key。Portal 可能使用**内部 API 端点**，不受公开 SDK 的 512 字符限制。但通过公开的 Agent Registry REST API（`azure-ai-projects` SDK），此限制是**硬性强制**的。

### 3.3 错误的解决方案：分块（Chunking）

曾尝试将 >512 字符的 value 分成多个 key（如 `.configuration`、`.configuration.1`、`.configuration.2`），但 **Foundry Portal 无法识别和重组分块的 key**，导致 Voice mode 显示为关闭。

```python
# ❌ 错误做法 — Portal 无法重组
{
    "microsoft.voice-live.configuration": "前512字符...",
    "microsoft.voice-live.configuration.1": "后续字符...",
}
```

### 3.4 正确的解决方案：精简 JSON（省略默认值）

**核心策略**：只序列化非 null、非默认值的字段。Foundry Portal/服务端会自动填充默认值。

#### 可安全省略的字段清单

| 字段路径 | 默认值 | 省略条件 | 节省字符 |
|---------|--------|---------|---------|
| `session.voice.type` | `"azure-standard"` | 等于默认值时 | ~25 |
| `session.voice.temperature` | `0.8` | 等于默认值时 | ~18 |
| `session.voice.rate` | `"1.0"` | 等于默认值时 | ~12 |
| `session.voice.isHdVoice` | `false` | 为 false 时 | ~18 |
| `session.inputAudioTranscription` | 整个 section | language="auto-detect" 时（默认） | ~60 |
| `session.inputAudioTranscription.model` | `"azure-speech"` | 始终省略（唯一选项） | ~22 |
| `session.turnDetection.endOfUtteranceDetection` | `null` | EOU 未启用时 | ~50 |
| `session.turnDetection.removeFillerWords` | `true` | 始终省略（默认 true） | ~24 |
| `session.inputAudioNoiseReduction` | `null` | 未启用时整个省略 | ~32 |
| `session.inputAudioEchoCancellation` | `null` | 未启用时整个省略 | ~34 |
| `session.fillerResponse` | `null` | 始终省略 | ~21 |
| `session.avatar.customized` | `false` | 为 false 时 | ~17 |
| `session.proactiveEngagement` | `false` | 为 false 时 | ~24 |

#### 效果对比

```
Lisa avatar + casual-sitting（最长配置）:
  优化前: 607 字符 ❌ 超出限制
  优化后: 267 字符 ✅ 远低于限制

极端场景（所有功能开启 + 最长名称）:
  优化后: 488 字符 ✅ 仍在限制内
```

#### 精简后的 JSON 示例

```json
{"session":{"voice":{"name":"zh-CN-XiaoxiaoMultilingualNeural"},
"turnDetection":{"type":"azure_semantic_vad"},
"avatar":{"character":"lisa","style":"casual-sitting"}}}
```

对比完整格式（含所有默认值和 null）：

```json
{"session":{"voice":{"name":"zh-CN-XiaoxiaoMultilingualNeural","type":"azure-standard",
"temperature":0.8,"rate":"1.0","isHdVoice":false},
"inputAudioTranscription":{"model":"azure-speech","language":"auto-detect"},
"turnDetection":{"type":"azure_semantic_vad","endOfUtteranceDetection":null,
"removeFillerWords":true},"inputAudioNoiseReduction":null,
"inputAudioEchoCancellation":null,"fillerResponse":null,
"avatar":{"character":"lisa","style":"casual-sitting","customized":false},
"proactiveEngagement":false}}
```

### 3.5 Voice Live Metadata Key 说明

| Key | 说明 | 值类型 |
|-----|------|--------|
| `microsoft.voice-live.enabled` | Voice mode 开关 | `"true"` / `"false"` |
| `microsoft.voice-live.configuration` | Voice/Avatar/TurnDetection 配置 JSON | JSON 字符串 (≤512 chars) |
| `description` | Agent 描述 | 字符串 |
| `modified_at` | 最后修改时间戳 | Unix timestamp 字符串 |

---

## 4. Voice Live 架构真相

### 4.1 两个独立服务

```
┌─────────────────────┐    ┌─────────────────────────┐
│  Agent Registry API  │    │   Voice Live Service     │
│  (azure-ai-projects) │    │   (azure-ai-voicelive)   │
│                     │    │                         │
│  - Agent CRUD       │    │  - WebSocket 实时语音    │
│  - Instructions     │    │  - session.update 配置   │
│  - Model / Tools    │    │  - Avatar 渲染          │
│  - Metadata (KV)    │    │  - STT/TTS 自动编排     │
└─────────────────────┘    └─────────────────────────┘
        ↑                           ↑
        │                           │
   create_version()           WebSocket connect
   get() / delete()         session.update(config)
```

- **Agent Registry**：管理 Agent 定义（instructions、model、tools、metadata）
- **Voice Live**：WebSocket 实时语音 API，在连接时通过 `session.update` 接收 voice/avatar 配置

**Voice mode 是运行时概念**，不是 Agent 属性。Metadata 中的 `microsoft.voice-live.*` 是 Portal UI 的约定标记，不是 Voice Live 服务的输入。

### 4.2 Metadata 的真实作用

- **Portal UI 识别**：Portal 读取 metadata 来显示 Voice mode 开/关状态
- **配置持久化**：将 voice/avatar 配置存储在 Agent 上，供 Portal 编辑器回显
- **不影响运行时**：Voice Live WebSocket 连接不读取 Agent metadata

---

## 5. 守护测试

项目中有专门的单元测试保护 512 字符限制：

```python
# backend/tests/test_agent_sync_service.py
def test_build_voice_live_metadata_fits_512_char_limit_worst_case():
    """极端配置（所有功能开启 + 最长名称）验证 JSON ≤512 字符"""
```

**任何新增字段**必须同时更新此测试的 mock 数据，确保最坏情况仍在 512 字符以内。

### 5.2 Postman 测试集合

提供了预配置好 endpoint、API Key 和测试 payload 的 Postman Collection，可快速手动验证 API 行为：

```
docs/microsoft-agent-framework/tests/agent-metadata-api.postman_collection.json
```

**包含 5 组测试**：

| # | 测试组 | 用途 |
|---|-------|------|
| 01 | Metadata Round-Trip | 创建→读回→验证 metadata 一致性 |
| 02 | 512-Char Limit | 512/513/1024 字符边界测试 |
| 03 | Voice Live Format | 精简 vs 完整格式对比（≤512 vs >512） |
| 04 | Version Tracking | 版本号递增验证 |
| 05 | Error Cases | 认证错误、404、缺字段等异常场景 |

**使用方法**：
1. 导入 Postman Collection JSON
2. 检查 Collection Variables 中的 `base_endpoint`、`api_key`、`project_name` 是否正确
3. 按序号依次运行，或使用 Collection Runner 批量执行
4. 每组测试自带 test script，自动验证响应

> **安全提示**：Collection 中包含真实 API Key，分享前请替换为占位符或使用 Postman Environment 变量。

---

## 6. 未来重构指南

### 6.1 如果 Azure 放宽 512 字符限制

当 Azure Agent Registry API 放宽或取消 metadata value 长度限制后：

1. **更新 `build_voice_live_metadata()`**：恢复完整 JSON 格式（包含所有 null 字段和默认值），与 Portal 格式完全一致
2. **更新守护测试**：调整 `test_build_voice_live_metadata_fits_512_char_limit_worst_case` 中的断言阈值
3. **代码简化**：去除条件省略逻辑，改为直接序列化全量字段

```python
# 未来简化版本（限制解除后）
session = {
    "voice": {"name": ..., "type": ..., "temperature": ..., "rate": ..., "isHdVoice": ...},
    "inputAudioTranscription": {"model": "azure-speech", "language": ...},
    "turnDetection": {"type": ..., "endOfUtteranceDetection": ..., "removeFillerWords": True},
    "inputAudioNoiseReduction": ... or None,
    "inputAudioEchoCancellation": ... or None,
    "fillerResponse": None,
    "avatar": {"character": ..., "style": ..., "customized": ...},
    "proactiveEngagement": ...,
}
```

### 6.2 如果需要存储更多 metadata

若未来 Agent 需要存储更多复杂配置（如 knowledge base、memory 设置等），策略选择：

| 策略 | 适用场景 | 实现方式 |
|------|---------|---------|
| **多 key 分散** | 不同配置模块互不关联 | `microsoft.knowledge.config`、`microsoft.memory.config` 各自 ≤512 |
| **数据库侧存储** | 配置 >512 且 Portal 不需要读取 | 存本地 DB，不写入 metadata |
| **引用模式** | 指向外部配置源 | metadata 只存引用 ID，实际配置存其他服务 |

### 6.3 版本同步最佳实践

```python
# ✅ 正确：使用 API 返回的版本号
result = client.agents.create_version(...)
profile.agent_version = str(result.version)

# ❌ 错误：自行递增
profile.agent_version = str(int(profile.agent_version) + 1)

# ❌ 错误：不更新版本号
await update_agent_metadata_only(db, agent_id, metadata)
# 忘记更新 profile.agent_version → 版本不一致
```

---

## 7. 常见陷阱速查表

| # | 陷阱 | 解决方案 |
|---|------|---------|
| 1 | Metadata value >512 字符被 API 拒绝 | 省略 null/默认值字段，用 `json.dumps(separators=(",",":"))` |
| 2 | 分块 metadata（`.1`, `.2`）Portal 无法识别 | 不要分块，压缩 JSON 到 512 以内 |
| 3 | Avatar style 较长（如 `casual-sitting`）导致超限 | 验证最长 avatar 组合仍 ≤512（有单元测试守护） |
| 4 | 版本号不一致（平台 vs Foundry） | 每次 `create_version` 后用返回值更新本地版本 |
| 5 | `client.agents.get()` 返回的 metadata 在 versions 里 | `agent.versions["latest"]["metadata"]` 不是 `agent.metadata` |
| 6 | SDK 需要 `TokenCredential` 但用的是 API Key | 提供空壳 `_ApiKeyTokenCredential` + `AzureKeyCredentialPolicy` |
| 7 | SQLAlchemy async 丢失 relationship | 用 `selectinload` 而非 `db.refresh()` 重新加载关联 |
| 8 | 并发写 metadata 和 sync 导致版本竞态 | 所有写入路径都从 Foundry 响应获取版本号 |

---

## 附录 A：相关代码文件

| 文件 | 作用 |
|------|------|
| `backend/app/services/agent_sync_service.py` | Agent CRUD、metadata 构建、版本同步 |
| `backend/app/services/voice_live_instance_service.py` | VL 实例管理、HCP 分配、metadata 触发同步 |
| `backend/app/services/hcp_profile_service.py` | HCP Profile CRUD → 触发 agent sync |
| `backend/tests/test_agent_sync_service.py` | 512 字符守护测试、metadata 格式验证 |
