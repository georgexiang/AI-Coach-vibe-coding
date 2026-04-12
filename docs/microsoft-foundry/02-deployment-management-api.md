# 02 — 模型部署管理 API

> **目标读者**：后端开发、Vibe Coding Agent
>
> **前置知识**：已阅读 01，了解 AI Foundry 端点结构与项目概念

---

## 1. 核心问题

> 如何获取用户在 AI Foundry 上实际部署的模型列表？

Azure AI Foundry Portal 的 **Models → Deployments** 页面显示用户的模型部署。
我们需要通过 API 获取同样的列表，用于前端模型选择器下拉框。

---

## 2. API 路径实测（2026-04-12）

### 2.1 测试环境

| 配置项 | 值 |
|--------|---|
| 端点 | `https://ai-foundary-hu-sweden-central2.services.ai.azure.com` |
| 项目 | `avarda-demo-prj` |
| 认证 | API Key |
| 实际部署 | `gpt-5.4-mini`、`gpt-4.1-mini`、`gpt-4o-mini` |

### 2.2 测试结果

| API 路径 | 状态 | 结果 |
|---------|------|------|
| `GET /openai/deployments?api-version=2024-10-21` | **404** | AI Foundry 端点不支持此路径 |
| `GET /openai/deployments?api-version=2025-06-01` | **404** | 所有 api-version 均返回 404 |
| `GET /openai/models?api-version=2024-10-21` | **200** | 返回 313 个模型（区域目录，非用户部署） |
| `GET /api/projects/{project}/deployments?api-version=v1` | **200** | 返回 3 个部署（正确！） |
| `GET /deployments?api-version=v1` | **404** | 缺少项目路径 |

### 2.3 结论

```
✗  /openai/deployments              → 仅在 .openai.azure.com 端点有效
✗  /openai/models                   → 返回区域目录（313+ 模型），不是用户部署
✓  /api/projects/{project}/deployments  → 正确路径，返回用户实际部署
```

---

## 3. 正确的 API 调用

### 3.1 请求格式

```http
GET /api/projects/{project}/deployments?api-version=v1 HTTP/1.1
Host: {resource}.services.ai.azure.com
api-key: {your-api-key}
```

### 3.2 响应格式

```json
{
  "data": [
    {
      "name": "gpt-4o-mini",
      "type": "ModelDeployment",
      "modelName": "gpt-4o-mini",
      "modelVersion": "2024-07-18",
      "modelPublisher": "OpenAI",
      "capabilities": {
        "chat_completion": "true"
      },
      "sku": {
        "name": "GlobalStandard",
        "capacity": 408
      }
    },
    {
      "name": "gpt-4.1-mini",
      "type": "ModelDeployment",
      "modelName": "gpt-4.1-mini",
      "modelVersion": "2025-04-14",
      "modelPublisher": "OpenAI",
      "capabilities": {
        "chat_completion": "true"
      },
      "sku": {
        "name": "GlobalStandard",
        "capacity": 576
      }
    },
    {
      "name": "gpt-5.4-mini",
      "type": "ModelDeployment",
      "modelName": "gpt-5.4-mini",
      "modelVersion": "2026-03-17",
      "modelPublisher": "OpenAI",
      "capabilities": {
        "chat_completion": "true"
      },
      "sku": {
        "name": "GlobalStandard",
        "capacity": 215
      }
    }
  ]
}
```

### 3.3 响应字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| `name` | 部署名称（用于 API 调用时作为 deployment name） | `gpt-4o-mini` |
| `type` | 部署类型 | `ModelDeployment` |
| `modelName` | 底层模型名称 | `gpt-4o-mini` |
| `modelVersion` | 模型版本日期 | `2024-07-18` |
| `modelPublisher` | 模型发布方 | `OpenAI` |
| `capabilities` | 模型能力标签 | `{"chat_completion": "true"}` |
| `sku.name` | SKU 类型 | `GlobalStandard` |
| `sku.capacity` | 配额容量（TPM / 1000） | `408` |

---

## 4. SDK 等价方式

`azure-ai-projects>=2.0.1` 的 `DeploymentsOperations.list()` 调用相同的底层 API：

```python
from azure.ai.projects import AIProjectClient

# SDK 要求 TokenCredential，不直接支持 API Key
client = AIProjectClient(
    endpoint="https://{resource}.services.ai.azure.com/api/projects/{project}",
    credential=default_azure_credential,
)

for deployment in client.deployments.list():
    print(f"{deployment.name} → {deployment.model_name}")
```

> **注意**：SDK 的 `AIProjectClient` 构造函数需要 `TokenCredential`，
> 不接受 `AzureKeyCredential`。如果只有 API Key，需要直接使用 HTTP 调用。

### 4.1 SDK 底层 URL 构造

```python
# SDK 内部构造的请求
# build_deployments_list_request() 生成：
GET /deployments?api-version=v1

# 然后拼接 endpoint：
# {endpoint}/deployments?api-version=v1
# 其中 endpoint 包含完整的 project 路径
```

---

## 5. 验证单个部署是否存在

如果不需要列表，只想验证某个 deployment name 是否有效：

```http
POST /openai/deployments/{name}/chat/completions?api-version=2024-10-21
Host: {resource}.services.ai.azure.com
api-key: {your-api-key}
Content-Type: application/json

{"messages": [{"role": "user", "content": "hi"}], "max_completion_tokens": 1}
```

| 响应码 | 含义 |
|--------|------|
| `200` / `400` (参数错误) | 部署存在 |
| `404` (`DeploymentNotFound`) | 部署不存在 |

---

## 6. 管理平面 API（参考）

Azure ARM 管理平面也提供部署列表 API，但需要 AAD 认证和订阅信息：

```http
GET https://management.azure.com/subscriptions/{subId}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/deployments?api-version=2025-06-01
Authorization: Bearer {aad-token}
```

此路径使用 `azure-mgmt-cognitiveservices` SDK 或 `CognitiveServicesManagementClient`。
**在 AI Coach 平台中不使用此方式**，因为项目采用 API Key 认证。

---

## 7. 常见错误与排查

| 症状 | 原因 | 解决 |
|------|------|------|
| `404 Resource not found` | 使用了 `/openai/deployments` 而非 `/api/projects/.../deployments` | 改用项目级 API |
| `400 API version not supported` | api-version 传了日期格式（如 `2024-10-21`） | 改为 `v1` |
| `404 Resource not found`（有 project） | project name 拼写错误 | 检查 `default_project` 配置 |
| 返回 313 个模型但找不到自己的部署 | 使用了 `/openai/models`（区域目录） | 改用 `/api/projects/.../deployments` |
| SDK 报 `AttributeError: 'AzureKeyCredential' object has no attribute 'get_token'` | SDK 要求 TokenCredential | 用 httpx 直接调用，或配置 AAD |
