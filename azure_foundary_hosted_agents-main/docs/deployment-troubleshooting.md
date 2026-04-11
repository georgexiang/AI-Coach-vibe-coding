# Azure AI Foundry Hosted Agent 部署问题排查记录

> 项目：agent-with-skills  
> AI Foundry 账号：ai-foundry-svc2 (eastus2)  
> 目标项目：proj-ai-foundry-svc2  

---

## 问题 1：Resource Group Location 不匹配

**阶段**：`azd up` → Provisioning  
**错误信息**：
```
ERROR: The resource group location conflicts with the deployment.
```

**原因**：  
`azd env` 中 `AZURE_LOCATION` 设为 `eastus`，但目标资源组 `ai-xzh-external` 实际位于 `eastus2`。Azure 要求部署 location 与资源组 location 一致。

**修复**：
```bash
azd env set AZURE_LOCATION eastus2
```

**教训**：使用已有资源组时，必须先确认其 location：
```bash
az group show --name <rg-name> --query location -o tsv
```

---

## 问题 2：Capability Host 创建失败 — VNet 验证错误

**阶段**：`azd up` → Provisioning → Foundry capability host  
**错误信息**：
```
CapabilityHostOperationFailed: The environment network configuration is invalid: 
Invalid vnet resource ID provided, or the virtual network could not be found.
```

**原因**：  
Bicep 模板通过 `capabilityHosts@2025-10-01-preview` API 创建 Capability Host 时，在已有的 AI Foundry 账号上触发了 VNet 验证。即使账号的 `networkAcls` 显示 `defaultAction: Allow` 且无 VNet 规则，内部仍在校验一个不存在的 VNet 资源 ID。

这可能与以下因素有关：
- 之前通过 Portal 创建 AI Foundry 时自动关联了某种 managed network 配置
- Bicep 模板中 `enablePublicHostingEnvironment: true` 参数未被正确传递到后端

**修复**（REST API 手动创建）：
```bash
# 1. 删除 Failed 状态的 Capability Host
az rest --method DELETE \
  --url "https://management.azure.com/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/capabilityHosts/agents?api-version=2025-04-01-preview"

# 2. 通过 REST API 手动创建（不指定网络配置）
az rest --method PUT \
  --url "https://management.azure.com/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/capabilityHosts/agents?api-version=2025-04-01-preview" \
  --body '{"properties": {"capabilityHostKind": "Agents"}}'

# 3. 确认创建成功
az rest --method GET \
  --url "https://management.azure.com/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/capabilityHosts/agents?api-version=2025-04-01-preview" \
  --query "properties.provisioningState" -o tsv
# 输出：Succeeded

# 4. 禁用 Bicep 自动创建 Capability Host，再部署
azd env set ENABLE_CAPABILITY_HOST false
azd up
```

**教训**：
- Capability Host 是 CognitiveServices account 级别的子资源（非 ML Workspace 级别）
- 在已有 Foundry 账号上创建时，REST API 方式比 Bicep 更可控
- 首次创建通常需要 5-15 分钟，如果 Bicep 等待超时，可在后台继续

---

## 问题 3：Failed Capability Host 阻塞后续部署

**阶段**：`azd up` → Deploying → start_container  
**错误信息**：
```json
{
  "code": "bad_request",
  "message": "Capability Host .../capabilityHosts/agents is not in succeeded state, current state Failed"
}
```

**原因**：  
问题 2 中创建失败的 Capability Host 未被清理，停留在 `Failed` 状态。即使 `ENABLE_CAPABILITY_HOST=false` 跳过了 Bicep 创建步骤，deploy 阶段发现已有的 Capability Host 是 Failed 状态，拒绝启动容器。

**修复**：  
必须先删除 Failed 状态的 Capability Host（见问题 2 的修复步骤），再重新创建或部署。

**教训**：  
部署前检查 Capability Host 状态：
```bash
az rest --method GET \
  --url "https://management.azure.com/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/capabilityHosts?api-version=2025-04-01-preview" \
  --query "value[].{name:name, state:properties.provisioningState}" -o table
```

---

## 问题 4：容器启动崩溃 — 缺少环境变量

**阶段**：`azd deploy` 成功，但 agent 无法正常工作  
**错误信息**（容器日志）：
```
AZURE_OPENAI_CHAT_DEPLOYMENT_NAME 未设置，容器启动失败
```

**原因**：  
`agent.yaml` 中只定义了 `AZURE_OPENAI_ENDPOINT` 和 `AZURE_AI_PROJECT_ENDPOINT` 两个环境变量，缺少 `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME`。Hosted agent 容器运行时只会获取 `agent.yaml` 中声明的环境变量。

**修复**：
```yaml
# agent.yaml 中添加缺少的环境变量
environment_variables:
    - name: AZURE_OPENAI_ENDPOINT
      value: ${AZURE_OPENAI_ENDPOINT}
    - name: AZURE_AI_PROJECT_ENDPOINT
      value: ${AZURE_AI_PROJECT_ENDPOINT}
    - name: AZURE_OPENAI_CHAT_DEPLOYMENT_NAME    # 新增
      value: ${AZURE_OPENAI_CHAT_DEPLOYMENT_NAME}
```

然后设置 azd 环境变量并重新部署：
```bash
azd env set AZURE_OPENAI_CHAT_DEPLOYMENT_NAME gpt-5.4
azd deploy
```

**教训**：  
- `agent.yaml` 是容器获取环境变量的唯一声明文件
- `main.py` 中用到的每个环境变量都必须在 `agent.yaml` 中显式声明
- 本地 `.env` 中的变量不会自动传递给云端容器

---

## 问题 5：SDK 版本不兼容 (本地开发)

**阶段**：本地 `python3 main.py` 启动  
**错误信息**：
```
ImportError: cannot import name 'PromptAgentDefinitionText' from 'azure.ai.projects.models'
```

**原因**：  
`azure-ai-agentserver-agentframework==1.0.0b10` 与 `azure-ai-projects==2.0.1` API 不兼容。b10 使用的 `PromptAgentDefinitionText` 在新版 projects SDK 中已移除。

**修复**：  
升级到 `>=1.0.0b17` 并更新 API 调用：
```python
# 旧 API (b10)
from azure.ai.agentserver.agentframework import FoundryToolsChatMiddleware
agent = create_agent(
    middleware=[FoundryToolsChatMiddleware(project_client)]
)

# 新 API (b17+)
from azure.ai.agentserver.agentframework import FoundryToolsContextProvider
agent = agent_definition.as_agent(
    context_providers=[FoundryToolsContextProvider(project_client)]
)
```

---

## 问题 6：403 认证错误 — Key vs Token 认证

**阶段**：本地 `curl` 测试 agent  
**错误信息**：
```
403 Key based authentication is disabled for this resource
```

**原因**：  
Shell 或 `.env` 中设置了 `AZURE_OPENAI_API_KEY`，SDK 优先使用 Key 认证。但 AI Foundry 账号（AIServices kind）的 `disableLocalAuth=true`，不允许 Key 认证。

**修复**：
```bash
unset AZURE_OPENAI_API_KEY  # 清除环境中的 API Key
# SDK 会 fallback 到 DefaultAzureCredential（需先 az login）
```

或切换到启用了 Key 认证的 OpenAI 类型资源。

---

## 部署检查清单

在执行 `azd up` 前，确认以下项：

- [ ] `AZURE_LOCATION` 与目标资源组的 location 一致
- [ ] AI Foundry 账号是 `AIServices` kind（非 `OpenAI` kind）
- [ ] `agent.yaml` 中声明了 `main.py` 需要的所有环境变量
- [ ] `azd env` 中设置了所有 `agent.yaml` 引用的 `${VAR}` 变量
- [ ] Capability Host 不存在或处于 `Succeeded` 状态
- [ ] SDK 版本 `azure-ai-agentserver-agentframework >= 1.0.0b17`
- [ ] 如果使用已有 Foundry 账号，可能需要手动创建 Capability Host

## 问题 7：会话持久化 — Agent 不记住跨轮次上下文

**阶段**：`azd deploy` 成功，Agent 工作正常，但每次对话都丢失上下文  
**现象**：用户告知 Agent 自己的名字后，下一轮对话 Agent 已经忘记

**原因**：  
Agent Framework 默认不启用会话持久化。每次请求创建新的内存会话，轮次间的对话历史不会保存。

**修复**：

1. 在 `main.py` 中配置 `JsonLocalFileAgentSessionRepository`：

```python
from azure.ai.agentserver.agentframework.persistence import (
    JsonLocalFileAgentSessionRepository,
)

session_repo = None
if os.environ.get("ENABLE_SESSION_PERSISTENCE", "").lower() == "true":
    storage_path = os.environ.get("SESSION_STORAGE_PATH", "./thread_storage")
    session_repo = JsonLocalFileAgentSessionRepository(storage_path=storage_path)

app = from_agent_framework(agent, session_repository=session_repo)
```

2. 在 `agent.yaml` 中声明环境变量：

```yaml
environment_variables:
    - name: ENABLE_SESSION_PERSISTENCE
      value: ${ENABLE_SESSION_PERSISTENCE}
    - name: SESSION_STORAGE_PATH
      value: ${SESSION_STORAGE_PATH}
```

3. 设置 azd 环境变量并部署：

```bash
azd env set ENABLE_SESSION_PERSISTENCE true
azd env set SESSION_STORAGE_PATH ./thread_storage
azd deploy
```

**验证方式**：

```bash
# 创建新会话，告诉 Agent 你的名字
azd ai agent invoke "你好，我叫张三" --new-session
# 记录返回的 Session ID

# 在同一会话中继续对话（替换 SESSION_ID）
azd ai agent invoke "你还记得我叫什么吗？" --session <SESSION_ID>
# Agent 应回答"张三"
```

**教训**：
- `from_agent_framework()` 的 `session_repository` 参数控制持久化行为
- `JsonLocalFileAgentSessionRepository` 将会话存储在容器本地文件系统，容器重启后丢失
- 生产环境如需持久化跨重启的会话，需使用外部存储（如 Azure Blob Storage）
- 客户端必须传递 `session_id` 来恢复已有会话

---

## 问题 8：Foundry Portal Traces 页面无数据

**阶段**：Agent 已成功部署并运行，App Insights 有遥测数据，但 Foundry Portal 的 Traces/Tracing 页面显示 "No runs or traces to display"  
**影响版本**：v5 ~ v12

**现象**：
- App Insights 中 `requests`、`dependencies`、`traces`、`customEvents` 表均有数据
- Foundry Portal 的 Traces 页面始终为空
- 只有平台生成的 `customEvents`（Evaluation 结果）包含 `gen_ai.azure_ai_project.id` 属性

### 根因分析

Foundry Portal Traces 页面通过 `gen_ai.azure_ai_project.id` 自定义维度来过滤 span。该属性值必须是 CognitiveServices project 的完整 ARM 资源 ID，格式如下：

```
/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/projects/<project>
```

Agent Framework SDK（`azure-ai-agentserver-agentframework`）生成的遥测 span 默认不包含此属性。只有 Foundry 平台自身写入的 `customEvents`（如 Evaluation 结果）才带有该属性。Portal 查询时过滤条件导致 SDK 生成的 span 全部被排除。

### 排查过程

**尝试 1：绑定 App Insights 到 CognitiveServices 项目（失败）**

通过 REST API 尝试设置 `appInsights` 属性：

```bash
az rest --method PATCH \
  --url "https://management.azure.com/.../accounts/<account>/projects/<project>?api-version=2025-04-01-preview" \
  --body '{"properties":{"appInsights":"/subscriptions/.../Microsoft.Insights/components/<appi>"}}'
```

结果：API 接受请求但静默忽略 `appInsights` 字段，返回值始终为 `null`。这是 CognitiveServices 资源提供程序的 API 限制，不同于 MachineLearningServices Workspace 可以直接绑定 App Insights。

**尝试 2：修改 appi-connection 的 `isSharedToAll`（失败）**

```bash
az rest --method PUT \
  --url "https://management.azure.com/.../projects/<project>/connections/appi-connection?api-version=2025-04-01-preview" \
  --body '{"properties":{"category":"AppInsights","target":"...","isSharedToAll":true}}'
```

结果：API 返回 `isSharedToAll: false`，无论如何设置都不生效。

**尝试 3：移除 `APPLICATIONINSIGHTS_CONNECTION_STRING` 环境变量（无效）**

假设 SDK 自动发现可能表现不同。结果：SDK 的 `logger.py` 中 `get_application_insights_connstr()` 函数会自动从项目连接中发现 App Insights 连接字符串并设置 `os.environ["APPLICATIONINSIGHTS_CONNECTION_STRING"]`，所以移除环境变量没有效果。

**尝试 4：分析 SDK 源码**

关键文件及其作用：

| 文件路径 | 作用 |
|---------|------|
| `azure/ai/agentserver/core/server/base.py` | `AgentRunContextMiddleware.set_run_context_to_context_var()` — 将请求上下文写入 ContextVar |
| `azure/ai/agentserver/agentframework/_agent_framework.py` | `init_tracing()` — 调用 `configure_otel_providers` 初始化 OpenTelemetry |
| `azure/ai/agentserver/core/logger.py` | `get_application_insights_connstr()` — 自动发现 App Insights 连接字符串 |
| `agent_framework/observability.py` | `configure_otel_providers()` — 创建 TracerProvider，resource 设为 `{"service.name": "agent_framework"}` |

关键发现：`AgentRunContextMiddleware` 通过 `request_context` ContextVar 向请求级 span 注入属性，但默认注入的上下文中**没有** `gen_ai.azure_ai_project.id`。

### 解决方案

通过 monkey-patch `AgentRunContextMiddleware.set_run_context_to_context_var` 方法，在请求上下文中注入 `gen_ai.azure_ai_project.id` 属性：

```python
# main.py — Step 9: Inject gen_ai.azure_ai_project.id into trace spans
project_endpoint = os.environ.get("AZURE_AI_PROJECT_ENDPOINT", "")
if project_endpoint:
    from azure.ai.agentserver.core.logger import request_context
    from azure.ai.agentserver.core.server.base import AgentRunContextMiddleware

    # 构造 CognitiveServices project 资源 ID
    project_id = os.environ.get("AZURE_AI_FOUNDRY_PROJECT_ID", "")
    if not project_id:
        from urllib.parse import urlparse
        parsed = urlparse(project_endpoint)
        account_name = parsed.hostname.split(".")[0]
        project_name = parsed.path.rstrip("/").split("/")[-1]
        sub = os.environ.get("AZURE_SUBSCRIPTION_ID", "")
        rg = os.environ.get("AZURE_RESOURCE_GROUP", "")
        project_id = (
            f"/subscriptions/{sub}/resourceGroups/{rg}"
            f"/providers/Microsoft.CognitiveServices"
            f"/accounts/{account_name}/projects/{project_name}"
        )

    # Patch middleware：在请求级上下文中追加 project ID
    _orig_set_ctx = AgentRunContextMiddleware.set_run_context_to_context_var

    def _patched_set_ctx(self, run_context):
        _orig_set_ctx(self, run_context)
        ctx = request_context.get() or {}
        ctx["gen_ai.azure_ai_project.id"] = project_id
        request_context.set(ctx)

    AgentRunContextMiddleware.set_run_context_to_context_var = _patched_set_ctx

    # 同时设置 OTEL 资源属性（覆盖子 span）
    os.environ.setdefault(
        "OTEL_RESOURCE_ATTRIBUTES",
        f"gen_ai.azure_ai_project.id={project_id}",
    )
```

需要在 `agent.yaml` 中添加以下环境变量：

```yaml
environment_variables:
    - name: AZURE_AI_FOUNDRY_PROJECT_ID
      value: ${AZURE_AI_FOUNDRY_PROJECT_ID}
    - name: AZURE_SUBSCRIPTION_ID
      value: ${AZURE_SUBSCRIPTION_ID}
    - name: AZURE_RESOURCE_GROUP
      value: ${AZURE_RESOURCE_GROUP}
```

对应的 azd 环境变量：

```bash
azd env set AZURE_AI_FOUNDRY_PROJECT_ID "/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/projects/<project>"
azd env set AZURE_SUBSCRIPTION_ID "<sub-id>"
azd env set AZURE_RESOURCE_GROUP "<rg>"
azd deploy
```

### 验证

部署后通过 App Insights API 确认 request span 是否携带 `gen_ai.azure_ai_project.id`：

```bash
APP_ID="<app-insights-application-id>"
TOKEN=$(az account get-access-token --resource https://api.applicationinsights.io --query accessToken -o tsv)

curl -sS "https://api.applicationinsights.io/v1/apps/$APP_ID/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"requests | where timestamp > ago(10m) | project timestamp, name, customDimensions | take 3"}' | python3 -c "
import json, sys
d = json.load(sys.stdin)
for tbl in d.get('tables', []):
    for row in tbl['rows']:
        dims = json.loads(row[2] or '{}')
        pid = dims.get('gen_ai.azure_ai_project.id', 'NOT SET')
        print(f'{row[1]}: gen_ai.azure_ai_project.id = {pid}')
"
```

预期输出：`gen_ai.azure_ai_project.id` 值为完整的 ARM 资源 ID。

### 已知限制

- **Request span**：成功注入 `gen_ai.azure_ai_project.id`
- **Dependency span**（如 `chat gpt-4o`、`invoke_agent SkillableAgent`）：属性未注入。`agent_framework` 的 `configure_otel_providers()` 创建的 TracerProvider 使用自定义 resource，忽略 `OTEL_RESOURCE_ATTRIBUTES` 环境变量。这些子 span 由 `ChatTelemetryLayer` / `AgentTelemetryLayer` 生成，不读取 `request_context`。
- 此修复方案是一个 workaround。当 SDK 原生支持 `gen_ai.azure_ai_project.id` 属性注入后，该 monkey-patch 可以移除。

### 失败的中间版本记录

| 版本 | 变更 | 结果 |
|------|------|------|
| v8-v9 | 移除 `APPLICATIONINSIGHTS_CONNECTION_STRING` | 无效 — SDK 自动发现连接字符串 |
| v10 | 恢复配置 | 基准版本 |
| v11 | 尝试 patch `app.set_run_context_to_context_var` | 崩溃 — `AttributeError`：该方法在 `AgentRunContextMiddleware` 上，不在 app 对象上 |
| v12 | 正确 patch `AgentRunContextMiddleware` 类方法 | 成功 — request span 携带 `gen_ai.azure_ai_project.id` |
| v13 | 增加 `OTEL_RESOURCE_ATTRIBUTES` 环境变量 | request span 成功；dependency span 仍无效 |

---

## 问题 9：Skill 部署 — 本地 Skill 未被加载

**阶段**：`azd deploy` 成功，但 Agent 未加载 `skills/` 目录下的 Skill  
**现象**：`skills/azure-ai-fundamentals-coaching/SKILL.md` 存在于项目中，但 Agent 没有该 Skill 的能力

**原因**：  
`AGENT_SKILLS` 环境变量已设置为 `clawhub:wisdom-accountability-coach`。当 `AGENT_SKILLS` 不为空时，Agent 只加载显式列出的 Skill，不会自动扫描 `skills/` 目录。

`main.py` 中的加载逻辑：

```python
if agent_skills_env:
    # 只加载 AGENT_SKILLS 中声明的 skill
    skill_specs = [s.strip() for s in agent_skills_env.split(",") if s.strip()]
    skills = sm.load_skills(skill_specs)
else:
    # AGENT_SKILLS 为空时，自动加载 skills/ 目录下所有 skill
    skills = sm.load_from_directory(skills_dir)
```

**修复**：

在 `AGENT_SKILLS` 中用 `local:` 前缀添加本地 Skill：

```bash
azd env set AGENT_SKILLS "local:azure-ai-fundamentals-coaching,clawhub:wisdom-accountability-coach"
azd deploy
```

**Skill 引用格式**：

| 来源 | 格式 | 示例 |
|------|------|------|
| 本地目录 | `local:<skill-name>` | `local:azure-ai-fundamentals-coaching` |
| ClawHub | `clawhub:<slug>` | `clawhub:wisdom-accountability-coach` |
| Git 仓库 | `git:<repo-url>` | `git:https://github.com/user/repo.git` |
| Git（指定 Skill） | `git:<repo-url>#<name1>,<name2>` | `git:https://github.com/user/repo.git#my-skill` |
| URL | `url:<url>` | `url:https://example.com/SKILL.md` |

多个 Skill 用逗号分隔。`<skill-name>` 必须匹配 `skills/<skill-name>/SKILL.md` 中 frontmatter 的 `name` 字段。

**验证**：

```bash
azd ai agent invoke "我想准备AI-900考试" --new-session
# Agent 应展示 AI-900 模块进度表和学习选项
```

**教训**：
- `AGENT_SKILLS` 的加载行为是排他性的：只要设置了该变量，就必须显式列出所有需要的 Skill
- 如果希望加载 `skills/` 目录下的全部 Skill，不设置 `AGENT_SKILLS` 即可
- 混合使用本地和远程 Skill 时，每个都需要在 `AGENT_SKILLS` 中声明

---

## 部署检查清单

在执行 `azd up` 前，确认以下项：

- [ ] `AZURE_LOCATION` 与目标资源组的 location 一致
- [ ] AI Foundry 账号是 `AIServices` kind（非 `OpenAI` kind）
- [ ] `agent.yaml` 中声明了 `main.py` 需要的所有环境变量
- [ ] `azd env` 中设置了所有 `agent.yaml` 引用的 `${VAR}` 变量
- [ ] Capability Host 不存在或处于 `Succeeded` 状态
- [ ] SDK 版本 `azure-ai-agentserver-agentframework >= 1.0.0b17`
- [ ] 如果使用已有 Foundry 账号，可能需要手动创建 Capability Host
- [ ] `AGENT_SKILLS` 列出了所有需要加载的 Skill（本地和远程）
- [ ] 如需 Portal Traces 显示数据，已配置 `AZURE_AI_FOUNDRY_PROJECT_ID` 等环境变量

## 有用的诊断命令

```bash
# 查看 Capability Host 状态
az rest --method GET \
  --url "https://management.azure.com/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/capabilityHosts?api-version=2025-04-01-preview"

# 查看部署操作状态
az deployment operation group list --resource-group <rg> --name ai-project \
  --query "[].{resource:properties.targetResource.resourceName, state:properties.provisioningState}" -o table

# 查看 azd 环境变量
cat .azure/<env-name>/.env

# 查看 AI Foundry 账号网络配置
az cognitiveservices account show --name <account> --resource-group <rg> \
  --query "{disableLocalAuth:properties.disableLocalAuth, publicAccess:properties.publicNetworkAccess, networkRules:properties.networkAcls}" -o json

# 查询 App Insights 中的 request span 是否携带 project ID
APP_ID="<app-insights-application-id>"
TOKEN=$(az account get-access-token --resource https://api.applicationinsights.io --query accessToken -o tsv)
curl -sS "https://api.applicationinsights.io/v1/apps/$APP_ID/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"requests | where timestamp > ago(1h) | project timestamp, name, customDimensions | take 3"}'

# 检查 Agent 加载了哪些 Skill（查看容器日志）
# 日志中会输出 "Loaded N skill(s): skill1, skill2"
```
