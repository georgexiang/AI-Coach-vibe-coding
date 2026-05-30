# 02 — 集中认证模块实现

> `backend/app/services/azure_auth.py` — 所有 Azure 服务认证的唯一入口。

---

## 1. 模块位置

```
backend/app/services/azure_auth.py
```

## 2. 对外 API

### 2.1 `get_azure_openai_client()`

创建 `AsyncAzureOpenAI` 客户端，自动处理认证。

```python
async def get_azure_openai_client(
    endpoint: str,
    api_key: str = "",
    api_version: str = "2024-06-01",
    timeout: float | None = None,
) -> AsyncAzureOpenAI:
```

**参数**：
- `endpoint`: Azure OpenAI 资源的 endpoint URL
- `api_key`: 来自 config_service 的 API Key（仅作 fallback）
- `api_version`: API 版本字符串
- `timeout`: 可选的请求超时（秒）

**返回**：配置好认证的 `AsyncAzureOpenAI` 客户端实例

**异常**：
- `RuntimeError`: AAD 和 API Key 都不可用
- `ImportError`: openai 包未安装

**认证优先级**：
1. DefaultAzureCredential → `azure_ad_token` 参数
2. API Key fallback → `api_key` 参数

**使用示例**：
```python
from app.services.azure_auth import get_azure_openai_client
from app.services import config_service

# 获取配置
endpoint = await config_service.get_effective_endpoint(db, "azure_openai")
api_key = await config_service.get_effective_key(db, "azure_openai")

# 创建客户端（自动 AAD 优先）
client = await get_azure_openai_client(endpoint, api_key)

# 正常使用
response = await client.chat.completions.create(
    model="gpt-4o",
    messages=[...],
)
```

---

### 2.2 `get_auth_headers()`

获取 HTTP 认证头，用于 REST API 调用（如 Content Understanding）。

```python
async def get_auth_headers(api_key: str = "") -> dict[str, str]:
```

**参数**：
- `api_key`: fallback 用的 API Key

**返回**：
- AAD 成功时: `{"Authorization": "Bearer <token>", "Content-Type": "application/json"}`
- Key fallback: `{"Ocp-Apim-Subscription-Key": "<key>", "Content-Type": "application/json"}`

**使用示例**：
```python
from app.services.azure_auth import get_auth_headers
import httpx

headers = await get_auth_headers(api_key=config_key)
async with httpx.AsyncClient() as client:
    response = await client.post(url, headers=headers, json=payload)
```

---

### 2.3 `get_bearer_token()`

获取原始 AAD Bearer Token 字符串。

```python
async def get_bearer_token(
    scope: str = "https://cognitiveservices.azure.com/.default"
) -> str | None:
```

**参数**：
- `scope`: Token 的目标 scope（默认 Cognitive Services）

**返回**：Token 字符串，或 `None`（AAD 不可用时）

**使用示例**：
```python
from app.services.azure_auth import get_bearer_token

# 用于 Speech SDK 等需要原始 token 的场景
token = await get_bearer_token("https://cognitiveservices.azure.com/.default")
if token:
    speech_config = SpeechConfig(auth_token=f"aad#{region}#{token}")
```

---

### 2.4 `get_azure_credential()`

获取 async DefaultAzureCredential 实例（低级 API）。

```python
async def get_azure_credential() -> DefaultAzureCredential | None:
```

**返回**：credential 实例或 `None`

**注意**：调用方需要自行管理 credential 的生命周期（`await credential.close()`）

---

## 3. 内部实现细节

### 3.1 Credential 缓存

```python
# 同步版本使用 TTL 单例（30分钟刷新）
_credential_instance: Any = None
_credential_lock_time: float = 0.0
_CREDENTIAL_TTL_SECONDS = 1800

# 异步版本每次创建新实例（依赖 SDK 内部 token 缓存）
```

**设计选择**：
- 同步 credential 使用 TTL 单例，避免频繁初始化开销
- 异步 credential 每次新建，因为 async context manager 生命周期管理更复杂
- SDK 内部已有 token 缓存，重复创建 credential 不会触发重复 AAD 请求

### 3.2 Token Scope

```python
COGNITIVE_SERVICES_SCOPE = "https://cognitiveservices.azure.com/.default"
```

这个 scope 覆盖：
- Azure OpenAI
- Azure Speech Services
- Azure Content Understanding
- Azure AI Agent Service
- Azure Cognitive Services (统一入口)

### 3.3 错误处理策略

```python
# AAD 失败 → 不抛异常，静默降级到 Key
try:
    credential = AsyncDefaultAzureCredential()
    token = await credential.get_token(scope)
    # ... 使用 token
except Exception as exc:
    logger.debug("AAD unavailable: %s, falling back to API Key", exc)
    # 降级到 api_key

# Key 也没有 → 抛 RuntimeError
if not api_key:
    raise RuntimeError("No credentials available")
```

---

## 4. 完整源代码

完整源代码位于：`backend/app/services/azure_auth.py`

关键设计点：
- 所有函数都是 `async` 的（适配整个后端的异步架构）
- 使用 `logger.debug` 记录认证路径（不暴露敏感信息）
- `finally` 块确保 credential 资源释放
- type hint 使用 `Any` 避免对 `azure-identity` 的强依赖

---

## 5. 依赖要求

```toml
# backend/pyproject.toml
[project]
dependencies = [
    "azure-identity>=1.17.0",  # DefaultAzureCredential
    "openai>=1.50.0",          # AsyncAzureOpenAI
]
```

`azure-identity` 是**必须**依赖。如果未安装，`get_azure_openai_client()` 会直接
fallback 到 API Key（不会 crash）。
