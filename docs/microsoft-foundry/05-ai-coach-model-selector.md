# 05 — AI Coach 模型选择器集成

> **目标读者**：项目开发、前端/后端开发
>
> **前置知识**：已阅读 01-04，了解 AI Foundry API 行为和认证规则

---

## 1. 需求

AI Coach 平台多个页面需要**模型选择下拉框**：

| 页面 | 用途 |
|------|------|
| 技能 AI 配置 (`/admin/meta-skills`) | 选择 Skill Creator / Evaluator 使用的模型 |
| 评分标准配置 | 选择评分引擎的模型 |
| HCP Profile 配置 | 选择对话模型 |

**要求**：
- 系统级可复用组件
- 从 AI Foundry 动态获取部署列表
- 所有页面共享同一个数据源

---

## 2. 架构设计

```
┌──────────────────────────────────────────────────────────┐
│  前端                                                      │
│                                                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│  │ Meta Skills │  │ 评分配置    │  │ HCP Profile│          │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘          │
│        └───────────────┼───────────────┘                  │
│                        ▼                                   │
│            ┌──────────────────────┐                        │
│            │  <ModelSelector />   │  ◄── 系统级复用组件     │
│            │  shared/model-       │                        │
│            │  selector.tsx        │                        │
│            └──────────┬───────────┘                        │
│                       │ GET /azure-config/model-deployments│
└───────────────────────┼──────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────┐
│  后端                                                      │
│                                                            │
│  GET /api/v1/azure-config/model-deployments               │
│  ┌─────────────────────────────────────────────┐          │
│  │ 三级获取策略                                  │          │
│  │                                               │          │
│  │ 1. AI Foundry 项目级 API                      │          │
│  │    GET /api/projects/{project}/deployments     │          │
│  │    ?api-version=v1                             │          │
│  │         ↓ 失败                                 │          │
│  │ 2. Azure OpenAI API                           │          │
│  │    GET /openai/deployments                     │          │
│  │    ?api-version=2024-10-21                     │          │
│  │         ↓ 失败                                 │          │
│  │ 3. DB 兜底                                    │          │
│  │    master config 的 model_or_deployment        │          │
│  └─────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│  Azure AI Foundry                                         │
│  https://{resource}.services.ai.azure.com                 │
│  /api/projects/{project}/deployments?api-version=v1       │
│                                                            │
│  → [gpt-5.4-mini, gpt-4.1-mini, gpt-4o-mini]            │
└──────────────────────────────────────────────────────────┘
```

---

## 3. 后端实现

### 3.1 API 端点

**文件**：`backend/app/api/azure_config.py` — `list_model_deployments()`

```python
@router.get("/model-deployments")
async def list_model_deployments(db, _admin):
    """三级策略获取模型部署列表。"""

    master = await config_service.get_master_config(db)

    # 策略 1：AI Foundry 项目级 API
    if master.endpoint and master.default_project:
        url = f"{base}/api/projects/{project}/deployments?api-version=v1"
        # 返回 [{"value": "gpt-4o-mini", "label": "gpt-4o-mini (gpt-4o-mini)"}]

    # 策略 2：传统 Azure OpenAI API
    url = f"{base}/openai/deployments?api-version=2024-10-21"

    # 策略 3：DB 兜底
    return [{"value": master.model_or_deployment, "label": master.model_or_deployment}]
```

### 3.2 返回数据格式

```json
[
  {"value": "gpt-4o-mini",  "label": "gpt-4o-mini (gpt-4o-mini)"},
  {"value": "gpt-4.1-mini", "label": "gpt-4.1-mini (gpt-4.1-mini)"},
  {"value": "gpt-5.4-mini", "label": "gpt-5.4-mini (gpt-5.4-mini)"}
]
```

| 字段 | 用途 |
|------|------|
| `value` | 部署名（保存到 DB，用于 API 调用） |
| `label` | 显示文本（部署名 + 模型名） |

---

## 4. 前端实现

### 4.1 ModelSelector 组件

**文件**：`frontend/src/components/shared/model-selector.tsx`

```tsx
// 系统级可复用组件 — 所有页面共享
export function ModelSelector({ value, onValueChange, disabled }) {
  // 从后端获取模型列表，使用模块级缓存
  const [options] = useModelOptions();

  return (
    <Select value={value} onValueChange={onValueChange}>
      {options.map(opt => (
        <SelectItem key={opt.value} value={opt.value}>
          {opt.label}
        </SelectItem>
      ))}
    </Select>
  );
}

// Hook：供需要原始数据的页面使用
export function useModelOptions() { ... }
```

### 4.2 缓存机制

```typescript
// 模块级缓存：同一页面内多个 ModelSelector 实例不重复请求
let cachedOptions: ModelOption[] | null = null;
```

- 同一页面多个实例 → 共享缓存
- 页面刷新 → 清除缓存，重新获取
- 无自动过期 → 后端部署变更后需要刷新页面

### 4.3 使用方式

```tsx
import { ModelSelector } from "@/components/shared/model-selector";

// 在任何需要模型选择的页面使用
<ModelSelector
  value={selectedModel}
  onValueChange={setSelectedModel}
  disabled={isLoading}
/>
```

---

## 5. 配置要求

模型选择器正常工作需要以下配置：

### 5.1 必须配置

| 配置项 | 位置 | 说明 |
|--------|------|------|
| AI Foundry Endpoint | 管理后台 Azure 配置 / `.env` | 必须是 `.services.ai.azure.com` 格式 |
| API Key | 管理后台 Azure 配置 / `.env` | AI Foundry 共享 Key |
| Default Project | 管理后台 Azure 配置 / `.env` | AI Foundry 项目名 |

### 5.2 验证清单

```bash
# 1. 检查后端 API 响应
curl -H "Authorization: Bearer <jwt-token>" \
  http://localhost:8000/api/v1/azure-config/model-deployments

# 期望：返回 JSON 数组，包含实际的 Foundry 部署

# 2. 检查 Foundry API 直连
curl -H "api-key: <key>" \
  "https://<resource>.services.ai.azure.com/api/projects/<project>/deployments?api-version=v1"

# 期望：返回 {"data": [...]} 包含部署列表
```

---

## 6. 故障排查

| 症状 | 原因 | 解决 |
|------|------|------|
| 下拉框显示 "No models configured" | 后端 API 返回空数组 | 检查 Foundry endpoint/key/project 配置 |
| 显示错误的模型（如 "gpt-5.4-mini (Azure AI Foundry)"） | 使用了 DB fallback 而非 Foundry API | 检查 `default_project` 是否配置 |
| 下拉框显示 "Loading..." 不消失 | 后端 API 超时或报错 | 检查后端日志 + 网络连通性 |
| 只显示 1 个模型 | 进入了策略 3 DB 兜底 | 检查策略 1/2 的报错日志 |
