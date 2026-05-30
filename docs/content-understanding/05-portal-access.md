# 05 — Portal 访问方式

> Content Understanding 的 Portal 可视化管理只在经典 Foundry 门户中支持。本文记录所有已知访问方式和 URL 格式。

---

## 1. 门户版本差异

| 特性 | 经典 Foundry | 新版 Foundry (nextgen) |
|------|-------------|----------------------|
| CU 可见性 | 左侧导航有 "Content Understanding" | 无此选项 |
| URL 格式 | `ai.azure.com/resource/...` | `ai.azure.com/nextgen/r/...` |
| API 版本 | `2025-05-01-preview` | N/A |
| 切换方式 | 关闭 "New Foundry" 开关 | 开启 "New Foundry" 开关 |

> **结论**：如需通过 Portal 管理 CU Analyzer，必须关闭 "New Foundry" 开关，使用经典版。

## 2. 经典 Foundry Portal URL（当前使用）

### URL 格式

```
https://ai.azure.com/resource/contentunderstanding/analyzer-list
  ?wsid=/subscriptions/{subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.CognitiveServices/accounts/{resource_name}/projects/{project_name}
  &tid={tenant_id}
```

### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `wsid` | ARM 资源路径（URL encoded），必须包含 project | `/subscriptions/7a03e9b8-.../accounts/ai-foundary-hu-sweden-central2/projects/avarda-demo-prj` |
| `tid` | Azure 租户 ID（**必须是拥有该资源的租户**） | `16b3c013-d300-468d-ac64-7eda0820b6d3` |

### 完整示例（已验证可用）

```
https://ai.azure.com/resource/contentunderstanding/analyzer-list?wsid=%2Fsubscriptions%2F7a03e9b8-18d6-48e7-b186-0ec68da9e86f%2FresourceGroups%2Fai-foundary-rg%2Fproviders%2FMicrosoft.CognitiveServices%2Faccounts%2Fai-foundary-hu-sweden-central2%2Fprojects%2Favarda-demo-prj&tid=16b3c013-d300-468d-ac64-7eda0820b6d3
```

### 关键注意事项

> **`tid` 必须是资源所属租户的 ID，不是用户登录租户的 ID！**
>
> - 正确: `tid=16b3c013-d300-468d-ac64-7eda0820b6d3`（资源所属租户）
> - 错误: `tid=72f988bf-86f1-41af-91ab-2d7cd011db47`（Microsoft 企业租户）
>
> 使用错误的 tid 会导致 "Could not load resource 'avarda-demo-prj'" 错误页面。

### 获取参数的方式

1. **subscription_id** — 从 ARM 连接信息解析（`get_portal_url_components`）
2. **resource_group** — 同上
3. **resource_name** — Cognitive Services 资源名称
4. **project_name** — AI Foundry 项目名称
5. **tenant_id** — 环境变量 `AZURE_TENANT_ID`（配置在 `.env` 和 `Settings` 类中）

## 3. 配置要求

### 环境变量

| 变量 | 值 | 说明 |
|------|-----|------|
| `AZURE_TENANT_ID` | `16b3c013-d300-468d-ac64-7eda0820b6d3` | 资源所属的 Azure 租户 ID |

在 `backend/.env` 中设置：
```
AZURE_TENANT_ID=16b3c013-d300-468d-ac64-7eda0820b6d3
```

对应的 Settings 字段：`backend/app/config.py` → `Settings.azure_tenant_id`

### CU 与 Project 的关系

- **CU REST API** 是在 Cognitive Services **账户级别**操作的（endpoint 如 `https://ai-foundary-hu-sweden-central2.services.ai.azure.com`）
- **CU Portal 页面**需要在 AI Foundry **项目上下文**中访问（wsid 需要包含 `/projects/{name}`）
- 两者不矛盾：API 不需要 project，但 Portal 导航需要 project 作为入口

## 4. 手动导航路径

如果直接 URL 不可用，手动路径为：

1. 访问 [ai.azure.com](https://ai.azure.com)
2. **关闭** "New Foundry" 开关（右上角切换）
3. 选择项目（如 `avarda-demo-prj`）
4. 左侧导航 → "Build and customize" → **Content Understanding**
5. 选择 "Analyzer list" 标签

## 5. AI Coach 中的 Portal URL 生成

### 代码实现

```python
# backend/app/api/rubrics.py

from app.config import get_settings
from app.services import agent_sync_service

settings = get_settings()

# 从 connections API 获取 ARM 资源路径组件
components = await agent_sync_service.get_portal_url_components(db)
sub_id = components.get("subscription_id", "")
rg = components.get("resource_group", "")
resource_name = components.get("resource_name", "")
project_name = components.get("project_name", "")
tenant_id = settings.azure_tenant_id  # 从 .env AZURE_TENANT_ID 读取

# 构建经典 Foundry CU Portal URL
wsid = (
    f"/subscriptions/{sub_id}/resourceGroups/{rg}"
    f"/providers/Microsoft.CognitiveServices"
    f"/accounts/{resource_name}/projects/{project_name}"
)
params = {"wsid": wsid}
if tenant_id:
    params["tid"] = tenant_id
portal_url = (
    "https://ai.azure.com/resource/contentunderstanding/analyzer-list?"
    + urllib.parse.urlencode(params)
)
```

### 前端显示

`cu-status-section.tsx` 组件在 Rubric 编辑页显示：
- Content Analyzer ID（如 `rubricContent5c32107a`）
- Voice Analyzer ID（如 `rubricVoice5c32107a`）
- CU Endpoint
- "Open in AI Foundry (Classic)" 按钮 → 跳转到 Portal

## 6. 与 HCP Agent Portal 的对比

| 方面 | HCP Agent | CU Analyzer |
|------|-----------|-------------|
| Portal 版本 | 新版 Foundry (nextgen) | 经典 Foundry (classic) |
| URL 格式 | `ai.azure.com/nextgen/r/{hash},{rg},,{name},{proj}/build/agents/{id}` | `ai.azure.com/resource/contentunderstanding/analyzer-list?wsid=...&tid=...` |
| 所需参数 | subscription_hash, rg, resource_name, project_name, agent_id | subscription_id, rg, resource_name, project_name, tenant_id |
| 直达 Analyzer | 可以直接打开特定 Agent | 只能打开列表页，用户自行查找 |
| Project 要求 | 需要 project | 需要 project（Portal 导航入口） |
| tid 要求 | 不需要 | **必须**（必须是资源所属租户） |

## 7. API 版本与 Portal 可见性

### 关键规则

> **通过 `2025-05-01-preview` API 版本创建的 Analyzer 会显示在 Portal 中。**

| API 版本 | Portal 可见性 | 推荐用途 |
|----------|-------------|---------|
| `2025-05-01-preview` | Portal 可见 | AI Coach 当前使用（兼顾 API + Portal） |
| `2025-11-01` (GA) | Portal 不可见 | 仅 API 调用场景 |

AI Coach 代码当前使用 `2025-05-01-preview`：
```python
# backend/app/services/cu_evaluation_service.py
CU_API_VERSION = "2025-05-01-preview"
```

## 8. 故障排除

### 问题一："Could not load resource" 错误

**现象**：点击 CU Portal 链接后，页面显示 "Error loading resource - Could not load resource 'avarda-demo-prj'"

**原因**：`tid` 参数使用了错误的租户 ID

**解决**：
1. 确认 `AZURE_TENANT_ID` 设置为资源所属租户 `16b3c013-d300-468d-ac64-7eda0820b6d3`
2. 不要使用用户登录租户（如 Microsoft 企业租户 `72f988bf-86f1-41af-91ab-2d7cd011db47`）
3. 在 `backend/.env` 中配置正确的值

### 问题二：Portal 中 Analyzer List 为空

**现象**：CU Portal 页面正常加载，但 Analyzer list 显示 "Build your analyzer by clicking the button above."

**可能原因**：
1. 尚未保存过 Rubric（Analyzer 在 Rubric 保存时自动创建）
2. CU endpoint/key 未正确配置（Admin → Azure Config → Content Understanding）
3. 使用了 `2025-11-01` GA 版本创建的 Analyzer（Portal 使用 preview 版本列出）

**验证步骤**：
```bash
# 通过 REST API 确认 Analyzer 是否存在
curl -s -H "Ocp-Apim-Subscription-Key: {YOUR_KEY}" \
  "{ENDPOINT}/contentunderstanding/analyzers?api-version=2025-05-01-preview" | jq .
```

### 问题三：Portal 页面 404

**现象**：CU Portal URL 返回 404

**原因**：使用了新版 Foundry（nextgen）

**解决**：关闭 "New Foundry" 开关，切换到经典版

## 9. 资源信息汇总

| 属性 | 值 |
|------|-----|
| Subscription ID | `7a03e9b8-18d6-48e7-b186-0ec68da9e86f` |
| Resource Group | `ai-foundary-rg` |
| Resource Name | `ai-foundary-hu-sweden-central2` |
| Project Name | `avarda-demo-prj` |
| Tenant ID (资源所属) | `16b3c013-d300-468d-ac64-7eda0820b6d3` |
| CU Endpoint | `https://ai-foundary-hu-sweden-central2.services.ai.azure.com` |
| Region | swedencentral |
| API Version | `2025-05-01-preview` |
