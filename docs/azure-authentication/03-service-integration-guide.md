# 03 — 服务集成指南

> 各后端服务如何从「各自认证」迁移到「统一认证模块」的实操指南。

---

## 1. 重构前后对比

### 1.1 评分引擎 (`scoring_engine.py`)

**重构前** ❌：
```python
from openai import AsyncAzureOpenAI

endpoint = await config_service.get_effective_endpoint(db, "azure_openai")
api_key = await config_service.get_effective_key(db, "azure_openai")

client = AsyncAzureOpenAI(
    azure_endpoint=endpoint,
    api_key=api_key,           # 直接用 Key，AAD 不可用时 403
    api_version="2024-06-01",
)
```

**重构后** ✓：
```python
from app.services.azure_auth import get_azure_openai_client

endpoint = await config_service.get_effective_endpoint(db, "azure_openai")
api_key = await config_service.get_effective_key(db, "azure_openai")

client = await get_azure_openai_client(endpoint, api_key)
# 自动: AAD token 优先 → Key fallback
```

---

### 1.2 技能转换服务 (`skill_conversion_service.py`)

**重构前** ❌：
```python
from openai import AsyncAzureOpenAI

client = AsyncAzureOpenAI(
    azure_endpoint=endpoint,
    api_key=api_key,
    api_version="2024-06-01",
)
response = await client.chat.completions.create(...)
```

**重构后** ✓：
```python
from app.services.azure_auth import get_azure_openai_client

client = await get_azure_openai_client(endpoint, api_key)
response = await client.chat.completions.create(...)
```

---

### 1.3 Content Understanding 评估 (`cu_evaluation_service.py`)

**重构前** ❌：
```python
# 内联的 AAD 逻辑 + fallback
try:
    from azure.identity.aio import DefaultAzureCredential
    credential = DefaultAzureCredential()
    token = await credential.get_token("https://cognitiveservices.azure.com/.default")
    headers = {"Authorization": f"Bearer {token.token}", ...}
except:
    headers = {"Ocp-Apim-Subscription-Key": api_key, ...}
```

**重构后** ✓：
```python
from app.services.azure_auth import get_auth_headers

headers = await get_auth_headers(api_key=api_key)
# 一行搞定，逻辑完全一致
```

---

### 1.4 连接测试器 (`connection_tester.py`)

**重构前** ❌：
```python
from openai import AsyncAzureOpenAI

client = AsyncAzureOpenAI(
    azure_endpoint=endpoint,
    api_key=api_key,
    api_version="2024-06-01",
    timeout=10.0,
)
```

**重构后** ✓：
```python
from app.services.azure_auth import get_azure_openai_client

client = await get_azure_openai_client(endpoint, api_key, timeout=10.0)
```

---

### 1.5 Azure OpenAI Adapter (`azure_openai.py`)

**重构前** ❌：
```python
class AzureOpenAIAdapter(BaseCoachingAdapter):
    def __init__(self):
        self.client = AsyncAzureOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
        )
```

**重构后** ✓：
```python
class AzureOpenAIAdapter(BaseCoachingAdapter):
    def __init__(self):
        self._client = None  # Lazy init (async)

    async def _get_client(self):
        if self._client is None:
            from app.services.azure_auth import get_azure_openai_client
            self._client = await get_azure_openai_client(
                endpoint=settings.azure_openai_endpoint,
                api_key=settings.azure_openai_api_key or "",
            )
        return self._client
```

---

## 2. 迁移检查清单

当你发现任何服务直接创建 Azure 客户端时，按以下步骤迁移：

### Step 1: 识别认证代码

搜索以下模式：
```bash
grep -rn "AsyncAzureOpenAI\|AzureOpenAI\|api_key.*azure\|Ocp-Apim-Subscription-Key" app/services/
```

### Step 2: 替换为统一模块

| 原始模式 | 替换为 |
|----------|--------|
| `AsyncAzureOpenAI(endpoint=..., api_key=...)` | `await get_azure_openai_client(endpoint, api_key)` |
| `{"Ocp-Apim-Subscription-Key": key}` | `await get_auth_headers(api_key=key)` |
| 内联 `DefaultAzureCredential` + fallback | `await get_azure_openai_client(...)` 或 `await get_auth_headers(...)` |

### Step 3: 更新 import

```python
# 删除这些
from openai import AsyncAzureOpenAI
from azure.identity.aio import DefaultAzureCredential

# 替换为
from app.services.azure_auth import get_azure_openai_client  # 或 get_auth_headers
```

### Step 4: 处理同步 → 异步

注意 `get_azure_openai_client()` 是 `async` 的。如果原始代码在 `__init__` 中创建客户端：
- 改为 lazy init 模式（在第一次使用时 `await` 初始化）
- 或使用 factory pattern

---

## 3. 不需要迁移的服务

以下服务有特殊的认证需求，保留独立实现：

| 服务 | 原因 |
|------|------|
| `voice_live_websocket.py` | WebSocket 连接需要特殊的 credential 生命周期管理 |
| `agent_sync_service.py` | 使用 `AIProjectClient` SDK，有自己的 credential 管理 |

这些服务已经正确使用 AAD token，且其 SDK 要求特定的 credential 传递方式。

---

## 4. 常见错误和解决方案

### 4.1 `RuntimeError: No Azure credentials available`

**原因**：AAD 和 API Key 都不可用

**解决**：
```bash
# 本地开发 — 确保 az login
az login
az account set --subscription <your-subscription-id>

# 或在管理面板配置 API Key 作为 fallback
```

### 4.2 `403 AuthenticationTypeDisabled`

**原因**：Azure 资源禁用了 API Key，但代码仍在用 Key

**解决**：确保使用 `get_azure_openai_client()` 而非直接 `AsyncAzureOpenAI(api_key=...)`

### 4.3 `401 Unauthorized` (AAD token)

**原因**：
- Token 过期（>1小时）
- 用户没有资源的 RBAC 角色

**解决**：
```bash
# 刷新 token
az login

# 检查角色分配
az role assignment list --assignee <your-email> --scope <resource-id>
# 需要: Cognitive Services OpenAI User / Contributor
```

### 4.4 Import Error for azure-identity

**原因**：`azure-identity` 未安装

**行为**：自动 fallback 到 API Key（不会 crash）

**解决**：
```bash
pip install azure-identity>=1.17.0
```
