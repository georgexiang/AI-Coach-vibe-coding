# 03 — 认证与授权

> CU 服务支持两种认证方式：Entra ID (DefaultAzureCredential) 和 API Key。

---

## 1. 认证优先级

AI Coach 平台实现的认证优先级：

```
1. Entra ID (DefaultAzureCredential)    ← 优先
     │
     ├── 本地开发：az login 获取的 token
     └── 服务器：Managed Identity
     
2. API Key (Ocp-Apim-Subscription-Key)  ← 后备
     │
     └── 从 config_service 获取的密钥
```

## 2. Entra ID 认证

### Token Scope

```
https://cognitiveservices.azure.com/.default
```

### Header 格式

```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

### 代码实现

```python
from azure.identity.aio import DefaultAzureCredential

credential = DefaultAzureCredential()
token = await credential.get_token("https://cognitiveservices.azure.com/.default")
headers = {
    "Authorization": f"Bearer {token.token}",
    "Content-Type": "application/json",
}
```

### DefaultAzureCredential 尝试顺序

1. `EnvironmentCredential` — 检查 `AZURE_CLIENT_ID` + `AZURE_CLIENT_SECRET` + `AZURE_TENANT_ID`
2. `WorkloadIdentityCredential` — Kubernetes workload identity
3. `ManagedIdentityCredential` — Azure VM/Container Apps Managed Identity
4. `AzureCliCredential` — `az login` 获取的 token
5. `AzurePowerShellCredential`
6. `AzureDeveloperCliCredential`

> **本地开发**：确保已运行 `az login` 且当前账户有 Cognitive Services 的 RBAC 权限。

### 必需 RBAC 角色

| 角色 | 权限 |
|------|------|
| `Cognitive Services User` | 调用 Analyzer（读/写/分析） |
| `Cognitive Services Contributor` | 创建/删除 Analyzer |

## 3. API Key 认证

### Header 格式

```http
Ocp-Apim-Subscription-Key: {api_key}
Content-Type: application/json
```

### Key 来源

从 Azure Portal 获取：
1. Azure Portal → Cognitive Services 资源 → Keys and Endpoint
2. 复制 Key 1 或 Key 2

在 AI Coach 中配置：
- Admin → Azure Config → Content Understanding → API Key

### 代码实现

```python
headers = {
    "Ocp-Apim-Subscription-Key": api_key,
    "Content-Type": "application/json",
}
```

## 4. AI Coach 配置要求

CU 服务依赖以下配置才能正常工作：

### 4.1 必需配置

| 配置项 | 来源 | 示例值 |
|--------|------|--------|
| CU Endpoint | `config_service.get_effective_endpoint(db, "content_understanding")` | `https://ai-foundary-hu-sweden-central2.services.ai.azure.com` |
| CU API Key | `config_service.get_effective_key(db, "content_understanding")` | (加密存储) |

### 4.2 配置来源优先级

```
per-service config (azure_service_configs 表中 service_name="content_understanding")
     │
     └── 如无 → master config (azure_master_configs 表的 endpoint/key)
               │
               └── 如无 → 返回空字符串（sync 静默跳过）
```

### 4.3 环境变量

| 变量 | 用途 | 必需 |
|------|------|------|
| `AZURE_TENANT_ID` | Portal URL 构建中的 tenant_id 参数 | Portal 链接需要 |
| `AZURE_CLIENT_ID` | Entra ID 认证（如使用 Service Principal） | 否（有 az login 即可） |
| `AZURE_CLIENT_SECRET` | Entra ID 认证（如使用 Service Principal） | 否 |

## 5. 故障排除

| 症状 | 原因 | 解决 |
|------|------|------|
| `sync_rubric_analyzers` 静默跳过 | endpoint 或 key 为空 | 在 Admin 配置 CU endpoint/key |
| 401 Unauthorized | Token 过期或 Key 无效 | 重新 `az login` 或更新 Key |
| 403 Forbidden | RBAC 权限不足 | 为用户分配 Cognitive Services Contributor 角色 |
| DefaultAzureCredential 失败后 API Key 也失败 | az login 过期 + Key 配置错误 | 检查两种认证源 |

## 6. 安全最佳实践

1. **生产环境用 Managed Identity** — 无需管理密钥
2. **Key 加密存储** — AI Coach 使用 `config_service` 加密存储
3. **最小权限** — 只授予 `Cognitive Services User`（如不需创建 Analyzer）
4. **定期轮换** — API Key 定期更换
