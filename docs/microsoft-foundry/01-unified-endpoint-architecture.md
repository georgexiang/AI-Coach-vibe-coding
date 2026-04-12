# 01 — AI Foundry 统一端点架构

> Azure AI Foundry 通过 `.services.ai.azure.com` 提供统一的多服务端点。理解它与传统 Azure OpenAI 端点的区别是正确集成的前提。

---

## 1. 三种域名类型

Azure AI 服务存在三种不同的域名格式，它们**不是同一个端点的不同写法**，而是独立的资源入口：

| 域名格式 | 服务范围 | 示例 |
|----------|---------|------|
| `{name}.services.ai.azure.com` | AI Foundry 统一端点（所有服务） | `ai-foundary-hu-sweden-central2.services.ai.azure.com` |
| `{name}.openai.azure.com` | 仅 Azure OpenAI 服务 | `openai-hu-swendencentral2.openai.azure.com` |
| `{name}.cognitiveservices.azure.com` | Cognitive Services（Speech/Vision 等） | `ai-foundary-hu-sweden-central2.cognitiveservices.azure.com` |

### 1.1 关键差异

```
                    ┌─────────────────────────────────┐
                    │   Azure AI Foundry Portal        │
                    │   (avarda-demo-prj)              │
                    └──────────┬──────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
    .services.ai.azure.com   .openai.azure.com   .cognitiveservices.azure.com
    ┌─────────────────┐   ┌──────────────┐   ┌──────────────────────┐
    │ 统一端点         │   │ OpenAI 专用   │   │ Cognitive Services   │
    │ • OpenAI         │   │ • Chat/Compl │   │ • Speech (STT/TTS)   │
    │ • Speech         │   │ • Embeddings │   │ • Avatar             │
    │ • Avatar         │   │ • DALL-E     │   │ • Vision / CU        │
    │ • Agent          │   │ • Realtime   │   │                      │
    │ • Project API    │   │              │   │                      │
    └─────────────────┘   └──────────────┘   └──────────────────────┘
```

### 1.2 resource name 可能不同

> **陷阱**：不能通过替换域名后缀来互推端点。

```
# 这两个是不同的 resource name，虽然都在同一个 Foundry 项目下
ai-foundary-hu-sweden-central2.services.ai.azure.com    ← Foundry 统一端点
openai-hu-swendencentral2.openai.azure.com              ← OpenAI 独立资源
```

**resource name 不同** → 域名不可互推 → 必须分别配置。

---

## 2. 统一端点的 API 路由

`.services.ai.azure.com` 是一个**多服务网关**，通过 URL path 前缀路由到不同的子服务：

| URL 路径前缀 | 路由目标 | 示例 |
|-------------|---------|------|
| `/openai/deployments/{name}/...` | Azure OpenAI 数据平面 | Chat Completions、Embeddings |
| `/openai/models` | 区域模型目录（只读） | 列出区域内所有可用模型 |
| `/api/projects/{project}/...` | AI Foundry 项目级 API | 部署列表、Agent 管理 |
| `/speechtotext/v3.2/...` | Speech-to-Text REST API | 语音模型列表 |
| `/cognitiveservices/voices/list` | Text-to-Speech 语音列表 | TTS 可用语音 |
| `/cognitiveservices/avatar/...` | Avatar 服务 | Avatar 列表、Relay Token |

### 2.1 路由特征

```python
base = "https://ai-foundary-hu-sweden-central2.services.ai.azure.com"

# OpenAI 兼容路径 — 与 .openai.azure.com 相同的 API
f"{base}/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-10-21"

# Foundry 项目级 API — 只有 .services.ai.azure.com 端点支持
f"{base}/api/projects/avarda-demo-prj/deployments?api-version=v1"

# Speech 路径 — 与 .cognitiveservices.azure.com 相同的 API
f"{base}/speechtotext/v3.2/models/base"
```

---

## 3. 认证头规则

所有路径统一使用 `api-key` 头：

| 端点类型 | 认证头 | 值 |
|---------|--------|---|
| `.services.ai.azure.com` | `api-key` | 共享 API Key |
| `.openai.azure.com` | `api-key` | 同一个 Key |
| `.cognitiveservices.azure.com` | `Ocp-Apim-Subscription-Key` | 同一个 Key |
| Regional Speech (e.g. `swedencentral.tts.speech.microsoft.com`) | `Ocp-Apim-Subscription-Key` | 同一个 Key |

> **注意**：`.services.ai.azure.com` 上的 Speech API 使用 `api-key` 头，
> 而传统 Regional Speech 端点使用 `Ocp-Apim-Subscription-Key` 头。

---

## 4. 项目（Project）概念

AI Foundry 在资源层之上引入了**项目**作为逻辑隔离单元：

```
Azure Subscription
  └── Resource Group
        └── AI Foundry Hub (资源层)
              ├── API Key（资源级共享）
              ├── Model Deployments（资源级）
              └── Projects（逻辑隔离）
                    ├── avarda-demo-prj
                    │     ├── Agents
                    │     ├── Evaluations
                    │     └── Deployments（项目视图）
                    └── another-project
                          └── ...
```

### 4.1 项目级 API 路径

```
{endpoint}/api/projects/{project_name}/{operation}?api-version=v1
```

项目级 API 需要在路径中包含项目名称，这是 AI Foundry 独有的概念，传统 Azure OpenAI 没有项目层级。

### 4.2 配置优先级

在 AI Coach 平台中，项目名的获取优先级：

1. DB `service_configs` 表 master 行的 `default_project` 字段
2. 环境变量 `AZURE_FOUNDRY_DEFAULT_PROJECT`
3. 前端管理后台配置

---

## 5. 配置建议

### 5.1 必须配置项

```env
# .env
AZURE_FOUNDRY_ENDPOINT=https://ai-foundary-hu-sweden-central2.services.ai.azure.com/
AZURE_FOUNDRY_API_KEY=<your-api-key>
AZURE_FOUNDRY_DEFAULT_PROJECT=avarda-demo-prj
```

### 5.2 当 resource name 不同时

如果 OpenAI 资源和 Foundry 资源的 resource name 不同，需要在管理后台为以下服务配置独立的 endpoint：

- **Content Understanding (CU)**：必须用 `.services.ai.azure.com`
- **Speech / Avatar**：可用 `.services.ai.azure.com` 或 `.cognitiveservices.azure.com`
- **OpenAI / Realtime**：可用 `.services.ai.azure.com` 或 `.openai.azure.com`
