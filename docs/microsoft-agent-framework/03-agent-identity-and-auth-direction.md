# 03 — Agent Identity 与认证方向

> Agent 有自己的 Identity，但它不能用于入站认证。理解认证方向是避免架构误解的关键。

---

## 1. 两个不同方向的认证

在 Azure AI Agent 的调用链中，存在两个完全独立的认证环节：

```
方向 ①（入站认证）              方向 ②（出站认证）
谁在调用 Agent？                Agent 访问自己的资源

你的后端  ───────>  Azure Voice Live  ───────>  Agent  ───────>  知识库 / 工具
            │                          │                  │
     API Key 或                  验证调用方权限      Agent 的 Managed Identity
     Entra ID Token              (Key 验证或          (Agent 自己的身份)
     (你的凭证)                   RBAC 检查)
```

### 方向 ① — 入站认证："调用方有权限吗？"

- **参与者**：你的后端 → Azure Voice Live 服务
- **问题**：Azure 需要验证"这个请求有没有权限调用这个 Agent？"
- **使用的凭证**：
  - **API Key**（资源级别验证，不区分调用者身份）— SDK 1.2.0b5+ 实测可行
  - **Entra ID Token**（身份级别验证，细粒度 RBAC）— 多租户推荐
- **由谁配置**：Key 模式只需资源的 API Key；Entra ID 需在 Azure Portal 分配 RBAC 角色

### 方向 ② — 出站认证："Agent 要访问资源"

- **参与者**：Agent → Azure Search（知识库）、Azure Functions（工具）等
- **问题**：Agent 运行时需要读取知识库、调用工具，这些资源需要验证 Agent 的身份
- **使用的身份**：**Agent 的 Managed Identity**（Azure 自动管理）
- **由谁配置**：**Azure AI Foundry** 自动管理，开发者不直接接触

---

## 2. Agent Identity 的作用范围

### 2.1 Agent Identity 是什么？

每个 Azure AI Foundry Agent 在运行时有一个内部 Managed Identity，用于：

```
Agent "王医生" 运行时
  │
  ├── 使用 Agent Identity 访问 Azure AI Search（读取产品知识库）
  ├── 使用 Agent Identity 调用 Azure Functions（执行自定义工具）
  ├── 使用 Agent Identity 访问 Blob Storage（读取培训文档）
  └── 使用 Agent Identity 记录对话日志
```

### 2.2 Agent Identity 不能做什么？

Agent Identity 是 Azure **内部运行时**使用的，具有以下限制：

| | 说明 |
|---|---|
| **不暴露给外部** | 你看不到、也拿不到 Agent 的 credential |
| **不能用于入站认证** | 外部调用者不能用 Agent 的身份来调用 Agent 本身 |
| **Azure 自动管理** | 创建、轮换、销毁都由 Azure 负责 |
| **作用域有限** | 只在 Agent 运行的上下文中有效 |

### 2.3 为什么不能用 Agent Identity 做入站认证？

**类比**：

> 你要去医院找王医生看病（调用 Agent）：
>
> - 王医生有**医院工牌**（Agent Identity）→ 凭工牌可以进实验室、查病历系统、开处方
> - 你不能拿王医生的工牌说"我是王医生，让我进去"
> - 你需要出示**你自己的挂号单**（Entra ID Token）→ 前台验证后安排你去找王医生

**技术原因**：

1. **身份混淆**：如果外部调用者能使用 Agent 的 Identity，就无法区分"Agent 自己的操作"和"外部调用者的请求"
2. **权限泄露**：Agent Identity 有权访问知识库和工具，暴露给外部等于把这些权限一起暴露
3. **无法审计**：所有调用都显示为 Agent 自己的操作，无法追踪真实调用者
4. **设计原则**：入站和出站使用不同的 Identity 是零信任架构（Zero Trust）的基本要求

---

## 3. 完整的认证链路

### 一次 Agent 模式的 Voice Live 调用的完整认证过程：

有两条认证路径，都经过实测验证：

#### 路径 A — API Key 认证（简单，开发推荐）

```
步骤 1: 使用 API Key 凭证
  ┌─────────────────────────────────────────────────────┐
  │ credential = AzureKeyCredential(api_key)             │
  └─────────────────────────────────────────────────────┘
                          │
                          ▼
步骤 2: 连接 Azure Voice Live + Agent 配置
  ┌─────────────────────────────────────────────────────┐
  │ connect(                                             │
  │     endpoint=endpoint,                               │
  │     credential=credential,  # API Key                │
  │     agent_config={                                   │
  │         "agent_name": "Dr-Wang-Fang",                │
  │         "project_name": "ai-coach-project",          │
  │     }                                                │
  │ )                                                    │
  │ # SDK 将 agent-name + agent-project-name 编入        │
  │ # WebSocket URL query params                         │
  └─────────────────────────────────────────────────────┘
                          │
                          ▼
步骤 3: Azure Voice Live 验证
  ┌─────────────────────────────────────────────────────┐
  │ 1. 验证 API Key → "Key 属于此 Cognitive Services 资源" │
  │ 2. 从 URL params 提取 agent-name, project-name        │
  │ 3. 资源级别放行（不做身份级 RBAC 检查）                │
  └─────────────────────────────────────────────────────┘
                          │
                          ▼
步骤 4: Azure 内部调用 Agent（使用 Agent Identity）
  ┌─────────────────────────────────────────────────────┐
  │ Agent "Dr-Wang-Fang" 被唤起                           │
  │  ├── 读取 instructions（预配置的人格、沟通风格）        │
  │  ├── 使用 Agent Identity 查询 Azure AI Search 知识库   │
  │  ├── 使用 Agent Identity 调用配置的 Function Tools     │
  │  └── 生成回复，通过 Voice Live 返回给你的后端           │
  └─────────────────────────────────────────────────────┘
```

#### 路径 B — Entra ID 认证（安全，多租户生产推荐）

```
步骤 1: 获取 Entra ID Token
  ┌─────────────────────────────────────────────────────┐
  │ credential = DefaultAzureCredential()                │
  │ # 自动选择: 环境变量 SP → Managed Identity → az login │
  └─────────────────────────────────────────────────────┘
                          │
                          ▼
步骤 2: 连接 Azure Voice Live + Agent 配置（同上）
  ┌─────────────────────────────────────────────────────┐
  │ connect(                                             │
  │     endpoint=endpoint,                               │
  │     credential=credential,  # Entra ID               │
  │     agent_config={...}                               │
  │ )                                                    │
  └─────────────────────────────────────────────────────┘
                          │
                          ▼
步骤 3: Azure Voice Live 验证（比 API Key 更严格）
  ┌─────────────────────────────────────────────────────┐
  │ 1. 验证 Token 签名 → 确认 Token 来自 Entra ID        │
  │ 2. 提取身份信息 → "这是 SP ai-coach-backend"          │
  │ 3. 检查 RBAC → 该身份在此 Project 上有角色吗？         │
  │ 4. 有 → 放行；没有 → 403 Forbidden                   │
  └─────────────────────────────────────────────────────┘
                          │
                          ▼
步骤 4: Azure 内部调用 Agent（同上）
```

> **何时选择哪条路径？**
> - **开发/单租户**：路径 A（API Key）— 零额外配置
> - **多租户/合规要求**：路径 B（Entra ID）— 细粒度访问控制 + 审计日志

---

## 4. 常见误解澄清

### 误解 1："Agent 有 Identity，应该可以用来认证"

**事实**：Agent Identity 是**出站**用的（Agent → 资源），不是**入站**用的（调用方 → Agent）。这是两个完全不同的认证方向。

### 误解 2："API Key 换成 STS Token（Bearer Token）就能用 Agent 模式"

**错误**（2026-04-08 实测确认）。STS Token Exchange（`/sts/v1.0/issueToken`）可以将 API Key 换成 Bearer Token，但这个 Token：
- 签发者是 Cognitive Services STS，**不是 Entra ID**
- 没有身份声明（没有 oid、appid、角色）
- 当作为 Bearer Token 发送时，Azure 用 Entra ID 验证管道检查 → **签名/签发者不匹配 → 401**

STS Token 和 Entra ID Token 走的是**完全不同的验证通道**，STS Token 不能冒充 Entra ID Token。

> 实测：STS Token + Agent 模式 → WebSocket 连接阶段就被 401 拒绝。

### 误解 3："只有 Service Principal 才能用 Entra ID"

**事实**：`DefaultAzureCredential` 支持多种身份来源：
- **本地开发**：`az login` 的用户账号
- **CI/CD**：Service Principal（环境变量）
- **Azure 上运行**：Managed Identity（零配置）

本地开发只需要 `az login` 并确保账号有正确的 RBAC 角色即可。

### ~~误解 4："Agent 模式不支持 Key 是一个 bug"~~ → 已修正

**原始说法**（已过时）：微软文档声称 "Key-based authentication isn't supported in Agent mode"。

**实测结果（2026-04-08）**：`azure-ai-voicelive==1.2.0b5`（API `2026-01-01-preview`）下，
API Key + `AgentSessionConfig` **可以成功连接、建立会话、并完成 Agent 对话**。

可能的解释：
1. 微软在后续 API 版本中放开了 Agent 模式对 API Key 的限制
2. SDK 1.2.0b5 通过 URL query params（而非 Bearer Token 通道）传递 Agent 配置，绕过了身份验证要求
3. 文档尚未更新以反映最新的 API 行为

**结论**：API Key + Agent 在技术上可行，但多租户隔离场景仍推荐 Entra ID（安全粒度更细）。

---

## 5. RBAC 角色配置（仅 Entra ID 认证需要）

> **API Key 模式不需要 RBAC 配置** — API Key 本身就代表资源级别的访问权限。
> 以下配置仅在选择 Entra ID 认证路径时需要。

要让你的后端通过 Entra ID + Agent 模式调用 Voice Live，需要以下 RBAC 配置：

| 身份 | 目标资源 | 所需角色 | 用途 |
|------|---------|---------|------|
| 你的 Service Principal / 用户账号 | AI Foundry Project | `Azure AI User` | 调用 Project 下的 Agent |
| 你的 Service Principal / 用户账号 | Cognitive Services 资源 | `Cognitive Services User` | 访问 Voice Live 服务 |

配置方式（Azure CLI）：

```bash
# 给 Service Principal 分配角色
az role assignment create \
  --assignee <your-sp-client-id> \
  --role "Cognitive Services User" \
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<resource>

az role assignment create \
  --assignee <your-sp-client-id> \
  --role "Azure AI User" \
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.MachineLearningServices/workspaces/<project>
```
