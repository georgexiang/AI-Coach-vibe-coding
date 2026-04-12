# 04 — 服务认证与路由

> **目标读者**：后端开发、Vibe Coding Agent
>
> **前置知识**：已阅读 01-03，了解三种域名类型和 API 差异

---

## 1. AI Foundry 多服务共享密钥

AI Foundry 项目下的所有 AI 服务共享**同一个 API Key**：

```
AI Foundry Hub
  └── API Key: Cq6jJl...
        ├── OpenAI (Chat/Embeddings/Realtime)
        ├── Speech (STT/TTS)
        ├── Avatar
        ├── Content Understanding
        └── Agent Service
```

> 一个 Key 访问所有服务，区别在于 **请求路径** 和 **认证头格式**。

---

## 2. 认证头规则

### 2.1 按端点类型区分

| 端点域名 | 认证头名称 | 值 |
|---------|-----------|---|
| `.services.ai.azure.com` | `api-key` | 共享 Key |
| `.openai.azure.com` | `api-key` | 同一个 Key |
| `.cognitiveservices.azure.com` | `Ocp-Apim-Subscription-Key` | 同一个 Key |
| Regional Speech (e.g. `swedencentral.tts.speech.microsoft.com`) | `Ocp-Apim-Subscription-Key` | 同一个 Key |

### 2.2 常见错误

```python
# ✗ 错误：在 .services.ai.azure.com 上使用 Cognitive Services 头
headers = {"Ocp-Apim-Subscription-Key": api_key}
# → 401 Unauthorized

# ✓ 正确：在 .services.ai.azure.com 上使用 api-key 头
headers = {"api-key": api_key}
# → 200 OK
```

### 2.3 自动适配逻辑

```python
def get_auth_header(endpoint: str, api_key: str) -> dict[str, str]:
    """根据端点类型返回正确的认证头。"""
    if ".services.ai.azure.com" in endpoint or ".openai.azure.com" in endpoint:
        return {"api-key": api_key}
    else:
        # .cognitiveservices.azure.com 和 regional 端点
        return {"Ocp-Apim-Subscription-Key": api_key}
```

---

## 3. Speech 服务路由

### 3.1 AI Foundry 统一端点上的 Speech API

```python
base = "https://ai-foundary-hu-sweden-central2.services.ai.azure.com"

# STT：列出基础语音模型
GET {base}/speechtotext/v3.2/models/base
Headers: api-key: {key}

# TTS：列出可用语音
GET {base}/cognitiveservices/voices/list
Headers: api-key: {key}
```

### 3.2 传统 Regional 端点上的 Speech API

```python
# STT
GET https://swedencentral.api.cognitive.microsoft.com/speechtotext/v3.2/models/base
Headers: Ocp-Apim-Subscription-Key: {key}

# TTS
GET https://swedencentral.tts.speech.microsoft.com/cognitiveservices/voices/list
Headers: Ocp-Apim-Subscription-Key: {key}
```

### 3.3 STS Token 端点

> **陷阱**：AI Foundry 自定义域名上的 STS Token 端点 (`/sts/v1.0/issueToken`) 返回 401。
> Speech SDK 实时语音识别（WebSocket）需要使用 API Key 直接认证，不能走 STS Token 交换。

---

## 4. Avatar 服务路由

### 4.1 获取可用 Avatar 列表

```http
GET {base}/cognitiveservices/avatar/list/v1
Headers: api-key: {key}
```

### 4.2 获取 Relay Token

```http
GET {base}/cognitiveservices/avatar/relay/token/v1
Headers: api-key: {key}
```

> Avatar 缩略图必须通过 Azure API 返回的 URL 获取，不能使用静态图片。

---

## 5. Per-Service Endpoint Override

当 AI Foundry Hub 的 resource name 与目标服务不同时，必须单独配置端点：

### 5.1 何时需要 Override

```
场景：用户的 AI Foundry Hub 和 OpenAI 资源是独立的
  - AI Foundry: ai-foundary-hu-sweden-central2.services.ai.azure.com
  - OpenAI:     openai-hu-swendencentral2.openai.azure.com
  - 共享同一个 API Key，但 resource name 不同
```

### 5.2 Override 规则

| 服务 | 是否需要 Override | 说明 |
|------|:---:|------|
| Content Understanding (CU) | **必须** | 只能用 `.services.ai.azure.com` |
| Speech / Avatar | 视情况 | 优先用 `.services.ai.azure.com`，也可用 `.cognitiveservices.azure.com` |
| OpenAI / Realtime | 视情况 | 优先用 `.services.ai.azure.com`，也可用 `.openai.azure.com` |
| Agent Service | **必须** | 只能用 `.services.ai.azure.com` |

### 5.3 AI Coach 平台实现

```
DB: service_configs 表
  ├── master (is_master=true): endpoint = ai-foundary-hu-sweden-central2.services.ai.azure.com
  ├── openai:        endpoint = "" (空 → 使用 master)
  ├── speech_stt:    endpoint = "" (空 → 使用 master)
  ├── speech_tts:    endpoint = "" (空 → 使用 master)
  ├── avatar:        endpoint = "" (空 → 使用 master)
  ├── content_understanding: endpoint = "" (空 → 使用 master)
  └── voice_live:    endpoint = "" (空 → 使用 master)

获取有效端点：
  effective_endpoint = service.endpoint or master.endpoint
```

---

## 6. 连接测试策略

针对每个服务的连接测试探针：

| 服务 | 测试路径 | 成功标准 |
|------|---------|---------|
| OpenAI | `POST /openai/deployments/{model}/chat/completions` | 200 或 400 (非 401/404) |
| Speech STT | `GET /speechtotext/v3.2/models/base` | 200 |
| Speech TTS | `GET /cognitiveservices/voices/list` | 200 |
| Avatar | `GET /cognitiveservices/avatar/list/v1` | 200 |
| Content Understanding | 服务特定 API | 200 |
| Agent | `GET /api/projects/{project}/agents?api-version=v1` | 200 |

测试时需要尝试两种认证头（`api-key` 和 `Ocp-Apim-Subscription-Key`），以第一个成功的为准。
