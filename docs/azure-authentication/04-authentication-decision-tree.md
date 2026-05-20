# 04 — 认证决策树

> 新增 Azure 服务时的认证方式选择指南。Agent 和开发者在添加新的 Azure 服务调用时，参考本决策树。

---

## 1. 决策流程图

```
你要调用一个 Azure 服务
         │
         ▼
该服务有 Python SDK 吗？
    │              │
    Yes            No
    │              │
    ▼              ▼
SDK 是否接受      需要 REST API 调用
Credential 对象？  → 使用 get_auth_headers()
    │    │
    Yes  No (接受 endpoint + key)
    │    │
    ▼    ▼
特殊生命周期？    使用 get_azure_openai_client()
(WebSocket/长连接)  或其模式
    │    │
    Yes  No
    │    │
    ▼    ▼
可保留独立     使用 get_azure_openai_client()
认证逻辑       标准模式
(需文档说明)
```

---

## 2. 选择哪个函数？

| 场景 | 使用的函数 | 示例服务 |
|------|-----------|---------|
| 调用 Azure OpenAI (Chat/Completions) | `get_azure_openai_client()` | scoring_engine, skill_* |
| REST API 调用 (Content Understanding) | `get_auth_headers()` | cu_evaluation_service |
| Speech SDK (需要原始 token) | `get_bearer_token()` | TTS/STT 服务 |
| 需要 credential 对象的 SDK | `get_azure_credential()` | 特殊 SDK |
| WebSocket 长连接 | 保留独立实现 | voice_live_websocket |

---

## 3. 具体场景指南

### 场景 A: 新增一个 LLM 调用服务

```python
# ✓ 正确做法
from app.services.azure_auth import get_azure_openai_client
from app.services import config_service

async def my_new_llm_service(db, prompt: str) -> str:
    endpoint = await config_service.get_effective_endpoint(db, "azure_openai")
    api_key = await config_service.get_effective_key(db, "azure_openai")
    
    client = await get_azure_openai_client(endpoint, api_key)
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content
```

### 场景 B: 调用 Azure REST API (非 OpenAI)

```python
# ✓ 正确做法
from app.services.azure_auth import get_auth_headers
import httpx

async def call_azure_rest_api(endpoint: str, api_key: str, payload: dict) -> dict:
    headers = await get_auth_headers(api_key=api_key)
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{endpoint}/analyze",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        return response.json()
```

### 场景 C: 使用 Azure Speech SDK

```python
# ✓ 正确做法
from app.services.azure_auth import get_bearer_token
import azure.cognitiveservices.speech as speechsdk

async def create_speech_config(region: str, api_key: str) -> speechsdk.SpeechConfig:
    token = await get_bearer_token()
    if token:
        # AAD token 模式
        return speechsdk.SpeechConfig(
            auth_token=f"aad#{region}#{token}",
            region=region,
        )
    else:
        # Key fallback
        return speechsdk.SpeechConfig(
            subscription=api_key,
            region=region,
        )
```

### 场景 D: 长连接 / WebSocket（保留独立认证）

```python
# 这种场景允许保留独立认证，但必须:
# 1. 仍然遵循 AAD-first + Key-fallback 策略
# 2. 在代码注释中说明为什么不用 azure_auth 模块
# 3. 在本文档中注册为例外

# 例如 voice_live_websocket.py:
# 需要将 credential 传递给 SDK 的 session builder，
# SDK 内部管理 token 刷新，不适合预取 token 的模式。
```

---

## 4. Agent 开发规则

当 AI Agent 在本项目中添加新的 Azure 服务调用时，**必须**遵循：

### 必须做 ✓

1. 使用 `from app.services.azure_auth import ...` 导入认证函数
2. 不要直接 import `AsyncAzureOpenAI` 或 `DefaultAzureCredential`
3. 传入 `api_key` 参数作为 fallback（从 config_service 获取）
4. 所有认证错误应让 `azure_auth` 模块处理（它会 debug 日志并降级）

### 禁止做 ❌

1. ❌ 直接 `AsyncAzureOpenAI(api_key=...)` 创建客户端
2. ❌ 硬编码 API Key 在源代码中
3. ❌ 直接 import `DefaultAzureCredential` 自行实现认证逻辑
4. ❌ 跳过 fallback 直接 raise（除非确认是无 Key 场景）

### 例外情况

如果你的服务确实无法使用统一模块（如特殊 SDK 生命周期要求），必须：
1. 在代码中注释说明原因
2. 仍然实现 AAD-first + Key-fallback 策略
3. 在本文档「例外列表」中注册

---

## 5. 当前例外列表

| 服务 | 文件 | 例外原因 |
|------|------|----------|
| Voice Live WebSocket | `voice_live_websocket.py` | WebSocket SDK 需要持有 credential 对象进行长连接 token 刷新 |
| Agent Sync Service | `agent_sync_service.py` | AIProjectClient SDK 接受 credential 对象而非 token |

---

## 6. 检查命令

验证项目中没有未迁移的直接认证代码：

```bash
# 搜索直接创建 Azure 客户端的代码（应该只在 azure_auth.py 和例外列表中出现）
grep -rn "AsyncAzureOpenAI\|AzureOpenAI" backend/app/services/ \
  --include="*.py" \
  | grep -v "azure_auth.py" \
  | grep -v "voice_live" \
  | grep -v "agent_sync" \
  | grep -v "# legacy"

# 如果有输出，说明有未迁移的服务
```
