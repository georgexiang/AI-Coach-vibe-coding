# 09 — Agent API 版本演进与 Breaking Change 记录

> 记录 Azure AI Foundry Agent Service API 版本变迁、两代架构差异、以及对 AI Coach 平台的影响。
>
> **最后更新**：2026-04-25

---

## 背景

2026 年 4 月测试 `agent-metadata-api.http` 时发现原有 API 版本 `2025-05-01` 返回 `UnsupportedApiVersion` 错误，触发了对 API 版本演进的调查。

---

## 核心发现：两代架构并存

Azure AI Foundry 存在**两代完全独立的 Agent Service**，它们不兼容、不互通：

| | Foundry Classic（旧一代） | New Foundry（新一代） |
|---|---|---|
| **API 版本** | 月度参数 `api-version=2025-05-01` | `v1` stable routes，新版本体系 |
| **协议** | Assistants API | **Responses API**（OpenAI 兼容） |
| **Agent 创建** | `create_agent()` | `create_version()`（版本化管理） |
| **对话模型** | Threads + Messages | **Conversations + Items** |
| **执行模型** | Runs（异步轮询） | **Responses**（默认同步） |
| **SDK** | `azure-ai-projects` 1.x + `azure-ai-agents` | `azure-ai-projects` **2.x**（统一 SDK） |
| **状态** | **2026-05-22 退役** | 当前推荐，已 GA |

> **关键点**：`2025-05-01` 没有被"移除"——它仍在 [Azure REST API spec repo](https://github.com/azure/azure-rest-api-specs/blob/main/specification/ai/data-plane/Azure.AI.Agents/readme.md) 中列为 stable。但我们的 Sweden Central 端点已运行在新一代架构上，所以不认识旧版本号。这不是版本废弃，而是**架构换代导致的版本体系不兼容**。

### 为什么我们的端点是新架构？

**资源创建时间决定架构版本**。Azure 的标准做法是：新创建的资源默认使用最新架构，旧资源保持在旧架构直到退役期限。

| 资源创建时间 | 默认架构 | 支持的 API 版本 |
|-------------|---------|----------------|
| 新一代 GA（2026-03）之前 | Foundry Classic | `2025-05-01`（旧 GA） |
| 新一代 GA（2026-03）之后 | **New Foundry** | `1.0` / `2025-05-15-preview` / `2025-11-15-preview` |

我们的端点 `ai-foundary-hu-sweden-central2.services.ai.azure.com` 是在新一代 GA 之后创建的，因此默认运行在 New Foundry 架构上。佐证：

1. **端点名称**：后缀 `2` 暗示这是第二个（更新的）资源
2. **项目 SDK 标准**：已使用 `azure-ai-projects>=2.0.1`（2.x = 新架构 SDK）
3. **Agent 创建方式**：代码中使用 `client.agents.create_version()`（新架构 API），而非旧架构的 `create_agent()`
4. **API 响应 header**：`api-supported-versions: 1.0, 2025-05-15-preview, 2025-11-15-preview` — 完全是新架构的版本体系

> **实践意义**：如果需要在旧架构资源上测试，需要使用 2026-03 之前创建的 AI Foundry 资源。旧资源仍支持 `2025-05-01`，但将在 **2026-05-22 退役**。

---

## 版本演进时间线

| 时间 | 事件 | 影响 |
|------|------|------|
| 2025-05 | `2025-05-01` 作为 Foundry Classic Agent Service 的 GA 版本发布 | REST API spec 中标记为 stable/v1 |
| 2025-05 | `2025-05-15-preview` 同期发布 | Preview 版本，包含更多实验性功能 |
| 2025-12 ~ 2026-01 | SDK 快速迭代（Python/JS/.NET 多个 beta） | 类名大量重命名，对齐 OpenAI 命名规范 |
| 2026-02 | **Foundry REST API GA** | 核心端点（chat completions, responses, embeddings 等）正式 GA |
| 2026-02 | 新 Foundry Portal 上线（ai.azure.com "New Foundry" 开关） | v1/v2 资源视图分离，Classic 和新一代 Agent 不共享面板 |
| 2026-03 | **新一代 Foundry Agent Service GA** | 基于 OpenAI Responses API，wire-compatible with OpenAI agents |
| 2026-03 | SDK GA：Python/JS/Java `2.0.0`，.NET `2.0.0`（4月1日） | `azure-ai-agents` 依赖被移除，统一到 `AIProjectClient` |
| 2026-04 | 迁移文档发布：旧后端 **2026-05-22 退役** | 旧部署不会自动迁移 |
| 2026-04-25 | 我们的端点返回 `UnsupportedApiVersion` for `2025-05-01` | 确认端点已在新一代架构上 |

---

## 新一代端点支持的 API 版本（2026-04-25 实测）

通过 API 错误响应的 `api-supported-versions` header 确认：

```
api-supported-versions: 1.0, 2025-05-15-preview, 2025-11-15-preview
```

| 版本 | 类型 | Metadata 支持 | 说明 |
|------|------|--------------|------|
| `1.0` | GA（新一代） | **有限制** | 迁移文档标注 "Non-versioned metadata updates (description, tags) — Not yet available via SDK" |
| `2025-05-15-preview` | Preview | 支持 | 最接近原 `2025-05-01` 的版本 |
| `2025-11-15-preview` | Preview | **完整支持** | 功能最全，推荐用于 metadata 相关测试和开发 |

> **注意**：新一代的 `2025-05-15-preview` 和旧一代的 `2025-05-01` 虽然日期接近，但属于**不同版本体系**，不能混用。

---

## 新一代 Agent Service 关键变化

### 版本体系变化

| 旧一代 | 新一代 | 说明 |
|--------|--------|------|
| `api-version=2025-05-01`（URL query 参数） | `v1` stable routes | 新一代不再需要 `api-version` 参数（用于 GA 端点） |
| 月度日期格式 | `1.0` + preview 后缀 | 新 GA 版本号是 `1.0` |
| URL 中无版本前缀 | `/openai/v1/responses` | `v1` 是 OpenAI 路由前缀，不是 Foundry 版本号 |

### SDK 变化

- **统一 SDK**：`azure-ai-agents` 包被移除，所有功能合并到 `azure-ai-projects` (`AIProjectClient`)
- **类名对齐 OpenAI**：GA 工具用 `Tool` 后缀，Preview 工具用 `PreviewTool` 后缀
  ```python
  # 旧一代
  from azure.ai.agents import AzureAISearchAgentTool
  
  # 新一代
  from azure.ai.projects.models import AzureAISearchTool        # GA
  from azure.ai.projects.models import BrowserAutomationPreviewTool  # Preview
  ```
- **Agent 创建方式变化**：
  ```python
  # 旧一代
  agent = client.create_agent(model="gpt-4o", instructions="...")
  
  # 新一代
  version = client.agents.create_version("my-agent", definition=PromptAgentDefinition(...))
  ```
- **SDK 版本**：
  - 旧一代：`azure-ai-projects` 1.x
  - 新一代：`azure-ai-projects` 2.0.0+（Python 2026-03-06 GA），需要 `>= 2.1.0` for hosted agents

### Token Audience 变化（2026-04-25 实测确认）

新一代 Foundry 的 Bearer Token audience **不再是** `https://cognitiveservices.azure.com`：

| | Foundry Classic（旧一代） | New Foundry（新一代） |
|---|---|---|
| **Token audience** | `https://cognitiveservices.azure.com` | **`https://ai.azure.com`** |
| **获取命令** | `az account get-access-token --resource https://cognitiveservices.azure.com` | `az account get-access-token --resource https://ai.azure.com` |

> **实测**：用 `https://cognitiveservices.azure.com` 的 token 访问新一代端点返回 401：
> `"audience is incorrect (https://ai.azure.com)"`。
> 换成 `https://ai.azure.com` 后成功。

这影响所有使用 Entra ID 认证的场景：
- **`DefaultAzureCredential`**：SDK 内部已处理，无需手动指定 audience
- **REST API 直接调用**：必须用 `--resource https://ai.azure.com` 获取 token
- **Service Principal / Managed Identity**：scope 应为 `https://ai.azure.com/.default`

### API 端点变化

- **Hosted Agent 端点需要特殊 header**：`Foundry-Features: HostedAgents=V1Preview`（SDK 会自动设置）
- **Agent 端点路径**：`{project_endpoint}/agents/{name}/endpoint/protocols/openai/v1/{responses|conversations}`
- **两代 Agent 不互通**：Classic 创建的 Agent 在 New Foundry 中不可见，反之亦然

### 迁移已知缺失功能

| 功能 | 状态 | 替代方案 |
|------|------|---------|
| `az cognitiveservices agent` CLI 命令 | 已移除 | 用 `az rest` 或 `azd ai agent` |
| 非版本化 metadata 更新 (description, tags) | SDK 暂不支持 | 用 `az rest --method PATCH` 直接调 REST API |
| 显式副本扩缩容 (min/max replicas) | 被会话自动扩缩替代 | 无需配置 |
| 删除部署而不删除版本 | 暂不支持 | 直接删除版本 |
| `tools=[...]` 在 HostedAgentDefinition 中 | 已移除 | 使用 Foundry Toolbox MCP 端点 |

---

## API Key 认证无法创建新 Agent（关键限制）

### 问题

新一代 Foundry Agent Service 中，**API Key 认证可以更新已有 Agent，但无法创建全新 Agent**（返回 HTTP 500）。这是 Azure 的平台限制，不是代码 bug。

项目代码 `agent_sync_service.py:453-456` 已记录此限制：

```
Azure AI Foundry limitation: API Key auth can update existing agents but
may fail (HTTP 500) when creating brand-new agent registrations.
```

### 各认证方式对 Agent 操作的支持

| 操作 | API Key (`api-key` header) | Entra ID (Bearer Token) |
|------|---------------------------|------------------------|
| 创建新 Agent | **500 失败** | 正常 |
| 更新已有 Agent（创建新版本） | 正常 | 正常 |
| 读取 Agent | 正常 | 正常 |
| 删除 Agent | 正常 | 正常 |

### 部署场景决策树

根据是否需要在服务器上自动创建新 Agent，选择不同的部署方案：

```
服务器需要创建新 Agent？
├── 否（只更新已有 Agent）
│   └── 只配 API Key 即可
│       ├── Foundry endpoint + API Key 配到环境变量
│       ├── 不需要 Managed Identity
│       ├── 不需要 RBAC 配置
│       └── 新 Agent 在 Foundry Portal 手动创建
│
└── 是（需要持续自动创建）
    └── 必须启用 Entra ID 认证
        ├── CI/CD 中启用 Managed Identity
        ├── CI/CD 中自动赋予 Azure AI User 角色（RBAC）
        ├── 需要新增 GitHub Variables: FOUNDRY_ACCOUNT, FOUNDRY_PROJECT
        ├── 代码改用 DefaultAzureCredential（自动选择 MI/az login/SP）
        └── API Key 可保留作为 fallback（读取/更新操作）
```

> **核心矛盾**：API Key 不需要 RBAC 但无法创建新 Agent；Entra ID 能创建新 Agent 但必须配 RBAC。如果服务器上需要持续创建新 Agent，RBAC 配置**绕不开**——这是 Azure 平台的设计，创建 Agent 属于数据面写操作，必须通过 Entra ID 认证 + RBAC 授权。

### 认证架构演进方案

**当前状态**：全部使用 API Key 认证，新 Agent 需先在 Foundry Portal 手动创建。

**目标状态**：Agent 创建路径改用 `DefaultAzureCredential`（Entra ID），其余操作可保持 API Key 或全部切换。

`DefaultAzureCredential` 会自动按优先级选择可用的认证方式：

| 运行环境 | 自动使用的认证方式 | 配置要求 |
|---------|-------------------|---------|
| **本地开发** | Azure CLI 凭据 | 运行一次 `az login` |
| **CI/CD** | 环境变量 Service Principal | 配置 `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_TENANT_ID` |
| **Azure Container Apps** | System Managed Identity | 在 Portal 启用 Managed Identity，并赋予 AI Foundry 的 RBAC 角色 |

代码示例：

```python
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

# 同一行代码，本地/CI/生产三个环境都能用
credential = DefaultAzureCredential()
client = AIProjectClient(endpoint=project_endpoint, credential=credential)

# 创建新 Agent — 不会再 500
result = client.agents.create_version(
    agent_name="new-agent",
    definition=PromptAgentDefinition(model=model, instructions=instructions),
    metadata=metadata,
)
```

### RBAC 权限要求

Agent 创建需要的最小权限是 **`Azure AI User`** 角色，授予在 **Foundry 项目级别**。

> **注意**：`Owner` / `Contributor` 角色**不够用**！它们是控制面角色，不含 Agent 数据面权限 (`Microsoft.CognitiveServices/accounts/AIServices/agents/write`)。

| 操作 | 所需权限 | 推荐角色 |
|------|---------|---------|
| 创建 Agent 版本 | `agents/write` | **Azure AI User** (project scope) |
| 读取 Agent | `agents/read` | Azure AI User |
| 创建 Agent 部署 | `agentDeployments/write` | Azure AI Project Manager |
| 调用已发布 Agent | `applications/invoke/action` | Azure AI User (application scope) |

### 迁移步骤（详细）

#### 步骤 1-2：CI/CD 中启用 Managed Identity + 自动赋权

项目 CI/CD 已在 `.github/workflows/ci.yml` 中通过 OIDC 登录 Azure 并部署 Container App。MI 启用和 RBAC 赋权应集成到现有 deploy job 中，在 `Deploy Backend` 步骤之后添加：

```yaml
# ci.yml deploy job 中新增步骤（在 Deploy Backend 之后）

- name: Ensure Managed Identity & RBAC
  run: |
    # 1. 启用 System Assigned Managed Identity（幂等，已启用则无副作用）
    az containerapp identity assign \
      --name ai-coach-backend \
      --resource-group ${{ vars.RESOURCE_GROUP }} \
      --system-assigned

    # 2. 获取 MI 的 principalId
    MI_PRINCIPAL_ID=$(az containerapp identity show \
      --name ai-coach-backend \
      --resource-group ${{ vars.RESOURCE_GROUP }} \
      --query principalId -o tsv)

    # 3. 赋予 Azure AI User 角色（幂等，已存在则跳过）
    # scope = Foundry 项目级别
    FOUNDRY_SCOPE="/subscriptions/${{ secrets.AZURE_SUBSCRIPTION_ID }}/resourceGroups/${{ vars.RESOURCE_GROUP }}/providers/Microsoft.CognitiveServices/accounts/${{ vars.FOUNDRY_ACCOUNT }}/projects/${{ vars.FOUNDRY_PROJECT }}"

    az role assignment create \
      --role "Azure AI User" \
      --assignee-object-id $MI_PRINCIPAL_ID \
      --assignee-principal-type ServicePrincipal \
      --scope "$FOUNDRY_SCOPE" \
      2>/dev/null || echo "Role assignment already exists, skipping"
```

需要在 GitHub repo 中新增的 variables/secrets：

| 名称 | 类型 | 值 | 说明 |
|------|------|---|------|
| `FOUNDRY_ACCOUNT` | Variable | `ai-foundary-hu-sweden-central2` | Foundry 资源名称 |
| `FOUNDRY_PROJECT` | Variable | `avarda-demo-prj` | Foundry 项目名称 |

> **幂等性**：`az containerapp identity assign` 和 `az role assignment create` 都是幂等的，重复执行不会报错，适合放在每次部署中运行。

#### 步骤 3（可选）：Bicep 模板化

如果后续需要多环境部署（staging/prod），可以把上述逻辑迁移到 Bicep 模板：

```bicep
// Azure AI User 角色 ID（固定值）
var azureAiUserRoleId = 'a97b65f3-24c7-4388-baec-2e87135dc908'

// 自动赋予 Azure AI User 角色
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(foundryProject.id, containerApp.id, azureAiUserRoleId)
  scope: foundryProject
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', azureAiUserRoleId)
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

#### 步骤 4：代码改造 `_get_project_client()`

```python
def _get_project_client(project_endpoint: str, api_key: str = "") -> AIProjectClient:
    """支持双模式认证：优先 DefaultAzureCredential，fallback API Key。"""
    
    # 优先尝试 Entra ID（Managed Identity / az login / SP）
    try:
        from azure.identity import DefaultAzureCredential
        credential = DefaultAzureCredential()
        return AIProjectClient(endpoint=project_endpoint, credential=credential)
    except Exception:
        pass
    
    # Fallback 到 API Key（保持向后兼容）
    if api_key:
        return AIProjectClient(
            endpoint=project_endpoint,
            credential=AzureKeyCredential(api_key),
        )
    
    raise ValueError("No valid credential available")
```

#### 步骤 5：本地开发配置

开发者只需确保已 `az login`，`DefaultAzureCredential` 自动使用 Azure CLI 凭据：

```bash
# 一次性操作（大多数开发者已经做过）
az login

# 验证：应该能看到正确的订阅
az account show
```

#### 步骤 6：验证与逐步迁移

1. **本地验证**：`az login` 后测试创建新 Agent → 确认不再 500
2. **Container Apps 验证**：部署后检查日志，确认 MI 认证成功
3. **逐步推广**：先在 `create_agent()` 路径使用 Entra ID，`update_agent()` / `get()` 保持 API Key
4. **全量切换**：验证稳定后，所有 Agent 操作统一使用 `DefaultAzureCredential`
5. **移除 API Key 依赖**：最终可以不再需要 API Key 环境变量（可选）

> **优先级**：此改动直接影响生产环境自动创建 Agent 的能力，建议在下一迭代中规划实施。
>
> **风险提示**：社区有报告在某些 Managed Application 场景下，即使赋予了 `Azure AI User` 角色，Agent 写操作仍被 deny assignment 阻止。如遇此情况，需检查是否有 `deny assignment` 覆盖了 `dataActions`，可能需要在 `allowedDataActions` 中显式添加 `Microsoft.CognitiveServices/accounts/AIServices/agents/*`。

---

## 对 AI Coach 平台的影响

### 测试文件修复（已完成）

`tests/agent-metadata-api.http` 已修改：

1. **API 版本**：`2025-05-01` → `2025-11-15-preview`
2. **环境变量名**：`AZURE_FOUNDRY_PROJECT` → `AZURE_FOUNDRY_DEFAULT_PROJECT`（与 `.env` 对齐）
3. **定义字段**：`"type": "prompt"` → `"kind": "prompt"`（新架构格式）
4. **模型配置化**：`"gpt-4o"` → `{{modelName}}`（从 `.env` 读取 `AZURE_FOUNDRY_MODEL`）

> **注意**：使用 API Key 认证时，创建全新 Agent 的测试（Test 1a, 2a, 3a, 4a, 6a）会返回 500。这是平台限制，不是测试 bug。需先在 Foundry Portal 预创建对应 Agent 名称，或改用 Bearer Token 认证。

### 后续建议

1. **短期**：使用 `2025-11-15-preview` 进行 metadata 相关开发和测试
2. **短期**：规划 API Key → Entra ID (DefaultAzureCredential) 认证迁移（见上文方案）
3. **中期**：关注微软何时将 metadata 完整功能合入 `1.0` GA 版本
4. **长期**：当 `1.0` 支持 metadata 后，迁移到 GA 版本以获得 SLA 保障
5. **退役期限**：旧后端 **2026-05-22** 停服，确保所有代码路径不依赖旧 API

---

## 参考资料

- [What's new in Microsoft Foundry — March 2026](https://devblogs.microsoft.com/foundry/whats-new-in-microsoft-foundry-mar-2026/) — 新一代 Agent Service GA 公告
- [What's new in Microsoft Foundry — February 2026](https://devblogs.microsoft.com/foundry/whats-new-in-microsoft-foundry-feb-2026/) — Foundry REST API GA
- [Migrate from the Foundry (classic) portal](https://learn.microsoft.com/en-us/azure/foundry/how-to/navigate-from-classic) — 两代架构对比表
- [Migrate hosted agents to the refreshed public preview](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/migrate-hosted-agent-preview) — 迁移指南，含退役时间
- [Azure REST API Specs — Latest Releases](https://azure.github.io/azure-sdk/releases/latest/specs.html) — spec repo 中 `2025-05-01` 仍列为 stable
- [What's new in Microsoft Foundry — Dec 2025 & Jan 2026](https://devblogs.microsoft.com/foundry/whats-new-in-microsoft-foundry-dec-2025-jan-2026/) — SDK 迭代历史
- [New vs Old Foundry Q&A](https://learn.microsoft.com/en-us/answers/questions/5867512/new-azure-ai-foundry-vs-old-azure-ai-foundry) — 社区确认两代不互通
