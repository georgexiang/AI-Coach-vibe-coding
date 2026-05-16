# 05 — Portal 访问方式

> Content Understanding 的 Portal 可视化管理只在经典 Foundry 门户中支持。本文记录所有已知访问方式和 URL 格式。

---

## 1. 门户版本差异

| 特性 | 经典 Foundry | 新版 Foundry (nextgen) |
|------|-------------|----------------------|
| CU 可见性 | ✅ 左侧导航有 "Content Understanding" | ❌ 无此选项 |
| URL 格式 | `ai.azure.com/resource/...` | `ai.azure.com/nextgen/r/...` |
| API 版本 | `2025-05-01-preview` | N/A |
| 切换方式 | 关闭 "New Foundry" 开关 | 开启 "New Foundry" 开关 |

> **结论**：如需通过 Portal 管理 CU Analyzer，必须关闭 "New Foundry" 开关，使用经典版。

## 2. 访问方式一：经典 Foundry Portal（推荐）

### URL 格式

```
https://ai.azure.com/resource/contentunderstanding/analyzer-list
  ?wsid=/subscriptions/{subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.CognitiveServices/accounts/{resource_name}/projects/{project_name}
  &tid={tenant_id}
```

### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `wsid` | ARM 资源路径（URL encoded） | `/subscriptions/7a03e9b8-.../resourceGroups/ai-foundary-rg/providers/Microsoft.CognitiveServices/accounts/ai-foundary-hu-sweden-central2/projects/avarda-demo-prj` |
| `tid` | Azure 租户 ID | `16b3c013-d300-468d-ac64-7eda0820b6d3` |

### 完整示例

```
https://ai.azure.com/resource/contentunderstanding/analyzer-list?wsid=%2Fsubscriptions%2F7a03e9b8-18d6-48e7-b186-0ec68da9e86f%2FresourceGroups%2Fai-foundary-rg%2Fproviders%2FMicrosoft.CognitiveServices%2Faccounts%2Fai-foundary-hu-sweden-central2%2Fprojects%2Favarda-demo-prj&tid=16b3c013-d300-468d-ac64-7eda0820b6d3
```

### 获取参数的方式

1. **subscription_id** — 从 ARM 连接信息解析（`get_portal_url_components`）
2. **resource_group** — 同上
3. **resource_name** — Cognitive Services 资源名称
4. **project_name** — AI Foundry 项目名称
5. **tenant_id** — 环境变量 `AZURE_TENANT_ID`

## 3. 访问方式二：专用 CU Portal

### URL 格式

```
https://contentunderstanding.ai.azure.com/build?tab=analyzerList&tenantId={tenant_id}
```

### 参数

| 参数 | 说明 |
|------|------|
| `tab` | 页面标签：`analyzerList`, `overview`, `tryItOut` |
| `tenantId` | Azure 租户 ID |

### 示例

```
https://contentunderstanding.ai.azure.com/build?tab=analyzerList&tenantId=16b3c013-d300-468d-ac64-7eda0820b6d3
```

### 限制

- 此门户为租户级别，不限定到特定项目/资源
- 可能需要额外注册或权限
- Analyzer 是否显示取决于 API 版本兼容性

## 4. 访问方式三：通用入口

### URL

```
https://ai.azure.com/explore/aiservices/vision/contentunderstanding
```

- 从这里可以选择项目，然后进入 CU 管理
- 适合初次访问时定位正确的项目

## 5. 手动导航路径

如果直接 URL 不可用，手动路径为：

1. 访问 [ai.azure.com](https://ai.azure.com)
2. **关闭** "New Foundry" 开关（右上角切换）
3. 选择项目（如 `avarda-demo-prj`）
4. 左侧导航 → "Build and customize" → **Content Understanding**
5. 选择 "Analyzer list" 标签

## 6. AI Coach 中的 Portal URL 生成

### 代码实现

```python
# backend/app/api/rubrics.py

# 从 connections API 获取 ARM 资源路径组件
components = await agent_sync_service.get_portal_url_components(db)
sub_id = components.get("subscription_id", "")
rg = components.get("resource_group", "")
resource_name = components.get("resource_name", "")
project_name = components.get("project_name", "")
tenant_id = os.environ.get("AZURE_TENANT_ID", "")

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

`cu-status-section.tsx` 组件在 Rubric 编辑页底部显示：
- Content Analyzer ID（如 `rubricContent5c32107a`）
- Voice Analyzer ID（如 `rubricVoice5c32107a`）
- CU Endpoint
- "Open in AI Foundry (Classic)" 按钮 → 跳转到 Portal

## 7. 与 HCP Agent Portal 的对比

| 方面 | HCP Agent | CU Analyzer |
|------|-----------|-------------|
| Portal 版本 | 新版 Foundry (nextgen) | 经典 Foundry (classic) |
| URL 格式 | `ai.azure.com/nextgen/r/{hash},{rg},,{name},{proj}/build/agents/{id}` | `ai.azure.com/resource/contentunderstanding/analyzer-list?wsid=...&tid=...` |
| 所需参数 | subscription_hash, rg, resource_name, project_name, agent_id | subscription_id, rg, resource_name, project_name, tenant_id |
| 直达 Analyzer | ✅ 可以直接打开特定 Agent | ❌ 只能打开列表页，用户自行查找 |

## 8. 已知问题

### 问题一：Analyzer 在 Portal 中不显示

**现象**：通过 REST API (`2025-11-01` GA) 创建的 Analyzer 在经典 Portal 的 Analyzer List 中不显示。

**可能原因**：
1. 经典 Portal 使用 `2025-05-01-preview` API 列出 Analyzer
2. GA 和 Preview 版本之间的 Analyzer 可能不共享同一个存储
3. 创建时使用了不同的资源端点

**验证步骤**：
1. 使用 REST API `GET /contentunderstanding/analyzers` 确认 Analyzer 是否存在
2. 尝试用 `2025-05-01-preview` API 版本列出 Analyzer
3. 确认 endpoint 与 Portal 查看的是同一个资源

### 问题二：专用 CU Portal 也不显示

**现象**：`contentunderstanding.ai.azure.com` 的 Analyzer List 也为空。

**可能原因**：
1. 此门户可能有自己的 Analyzer 注册机制
2. 需要通过门户 UI "Build analyzer" 创建的才会显示
3. 资源或项目范围不匹配
