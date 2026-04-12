# 03 — Azure OpenAI vs AI Foundry 数据平面 API 差异

> **目标读者**：后端开发、Vibe Coding Agent
>
> **前置知识**：已阅读 01-02，了解端点架构和部署管理 API

---

## 1. 为什么需要区分？

AI Coach 平台需要同时兼容两种端点类型：
- **传统 Azure OpenAI**：`.openai.azure.com`（部分客户的存量资源）
- **AI Foundry 统一端点**：`.services.ai.azure.com`（推荐的新架构）

两者在**模型调用**层面高度兼容，但在**管理 API**层面存在显著差异。

---

## 2. API 兼容性矩阵

### 2.1 模型调用 API（高度兼容）

| API | `.openai.azure.com` | `.services.ai.azure.com` |
|-----|:---:|:---:|
| `POST /openai/deployments/{name}/chat/completions` | ✓ | ✓ |
| `POST /openai/deployments/{name}/embeddings` | ✓ | ✓ |
| `POST /openai/deployments/{name}/completions` | ✓ | ✓ |
| `POST /openai/deployments/{name}/images/generations` | ✓ | ✓ |
| WebSocket `/openai/realtime` | ✓ | ✓ |

> 模型调用 API 在两种端点上路径和参数完全一致，可以无缝切换。

### 2.2 管理/列表 API（差异显著）

| API | `.openai.azure.com` | `.services.ai.azure.com` | 说明 |
|-----|:---:|:---:|------|
| `GET /openai/deployments` | ✓ 返回用户部署 | ✗ 404 | AI Foundry 不支持 |
| `GET /openai/models` | ✓ 区域目录 | ✓ 区域目录 | 返回 313+ 模型，非用户部署 |
| `GET /api/projects/{p}/deployments` | ✗ 不存在 | ✓ 返回用户部署 | AI Foundry 独有 |
| `GET /api/projects/{p}/agents` | ✗ 不存在 | ✓ Agent 列表 | AI Foundry 独有 |

### 2.3 辅助服务 API

| API | `.openai.azure.com` | `.services.ai.azure.com` |
|-----|:---:|:---:|
| `GET /speechtotext/v3.2/models/base` | ✗ | ✓ |
| `GET /cognitiveservices/voices/list` | ✗ | ✓ |
| `GET /cognitiveservices/avatar/relay/token/v1` | ✗ | ✓ |

---

## 3. 端点类型检测

```python
def detect_endpoint_type(endpoint: str) -> str:
    """检测端点类型以选择正确的 API 路径。"""
    if ".services.ai.azure.com" in endpoint:
        return "ai_foundry"
    elif ".openai.azure.com" in endpoint:
        return "azure_openai"
    elif ".cognitiveservices.azure.com" in endpoint:
        return "cognitive_services"
    else:
        return "unknown"
```

---

## 4. 部署列表获取策略

基于端点类型选择正确的 API：

```python
async def list_deployments(endpoint: str, api_key: str, project: str | None) -> list[dict]:
    """三级策略获取部署列表。"""
    base = endpoint.rstrip("/")

    async with httpx.AsyncClient(timeout=10.0) as client:
        headers = {"api-key": api_key}

        # 策略 1：AI Foundry 项目级 API（推荐）
        if project:
            url = f"{base}/api/projects/{project}/deployments?api-version=v1"
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                items = resp.json().get("data", [])
                return [
                    {"value": d["name"], "label": f"{d['name']} ({d.get('modelName', '')})"}
                    for d in items if d.get("name")
                ]

        # 策略 2：传统 Azure OpenAI API
        url = f"{base}/openai/deployments?api-version=2024-10-21"
        resp = await client.get(url, headers=headers)
        if resp.status_code == 200:
            items = resp.json().get("data", [])
            return [
                {"value": d["id"], "label": f"{d['id']} ({d.get('model', '')})"}
                for d in items if d.get("id")
            ]

    return []  # 两种策略均失败
```

---

## 5. api-version 差异

| 端点类型 | API 路径 | api-version 格式 |
|---------|---------|-----------------|
| Azure OpenAI | `/openai/...` | 日期格式：`2024-10-21` |
| AI Foundry 项目级 | `/api/projects/...` | 简单版本：`v1` |
| ARM 管理平面 | `management.azure.com/...` | 日期格式：`2025-06-01` |

> **陷阱**：AI Foundry 项目级 API 使用 `api-version=v1`，传入日期格式会返回 `400 Bad Request`。

---

## 6. 响应数据格式差异

### 6.1 部署列表字段映射

| 含义 | Azure OpenAI (`/openai/deployments`) | AI Foundry (`/api/projects/.../deployments`) |
|------|------|------|
| 部署名 | `d["id"]` | `d["name"]` |
| 模型名 | `d["model"]` | `d["modelName"]` |
| 模型版本 | `d["model_version"]` | `d["modelVersion"]` |
| 状态 | `d["status"]` | 无（返回的都是已成功部署） |
| 配额 | 无 | `d["sku"]["capacity"]` |
| 发布方 | 无 | `d["modelPublisher"]` |
| 能力标签 | 无 | `d["capabilities"]` |

### 6.2 响应包装

```json
// 两种 API 都使用 "data" 数组包装
{
  "data": [ ... ]
}
```

---

## 7. 迁移注意事项

从 `.openai.azure.com` 迁移到 `.services.ai.azure.com`：

| 步骤 | 改动 |
|------|------|
| 模型调用 | 替换 endpoint，API 路径不变 |
| 部署列表 | 从 `/openai/deployments` 改为 `/api/projects/{project}/deployments` |
| 认证头 | 保持 `api-key`（两者相同） |
| 配置 | 新增 `default_project` 参数 |
| api-version | 项目级 API 使用 `v1`，OpenAI 兼容路径仍用日期格式 |
