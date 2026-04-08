# 01 — Azure 服务认证模型

> Azure 服务的两种主要认证方式：API Key 和 Entra ID（原 Azure AD）。理解它们的本质区别是使用 Agent Framework 的前提。

---

## 1. 两种认证方式对比

### 1.1 API Key 认证

**本质**：一个共享密钥，证明"请求方有权访问此资源"。

```
调用方  ──[api-key: abc123]──>  Azure 服务
                                  │
                                  └──>  验证：Key 有效吗？ → 有效 → 放行
```

**特点**：
- 只回答一个问题："这个请求有没有权限访问这个资源？"
- 不区分调用者身份 — 所有持有 Key 的人权限相同
- 资源级别粒度 — 有 Key 就能访问该资源下的所有功能
- 无审计追踪 — 无法知道具体是哪个系统/用户在调用

**类比**：大楼的门禁卡 — 有卡就能进大楼，但不知道谁进来的。

### 1.2 Entra ID 认证（Azure AD）

**本质**：基于身份的认证，证明"我是谁，并且我有权做什么"。

```
调用方  ──[Bearer Token: eyJ...]──>  Azure 服务
                                       │
                                       ├──>  验证 Token 签名
                                       ├──>  识别调用者身份（Service Principal / User / Managed Identity）
                                       ├──>  检查 RBAC 角色（该身份在此资源上有什么权限？）
                                       └──>  记录审计日志（谁、什么时间、做了什么）
```

**特点**：
- 回答三个问题："谁在调用？有什么权限？做了什么？"
- 精确的身份识别 — 每个调用者都有独立身份
- 细粒度权限控制 — 通过 RBAC 角色控制到 Project / Agent 级别
- 完整审计追踪 — 所有操作记录在 Azure Activity Log

**类比**：身份证 + 门禁系统 — 知道谁进来了，能控制谁能进哪个房间，有完整的进出记录。

---

## 2. 认证方式的选择标准

核心判断标准：

> **Azure 侧有没有需要按调用者区分访问权限的数据或资源？**

### 决策树

```
Azure 服务收到请求后，需要访问什么？
    │
    ├── 只需要算力（模型推理、语音转换等）
    │   └── 所有调用者获得的是相同的服务
    │       └── ✅ API Key 够用
    │
    ├── 需要访问有主的数据/资源（知识库、工具、用户数据等）
    │   ├── 该服务有自己的内部权限系统？（如数据库的 GRANT/REVOKE）
    │   │   └── ✅ 连接字符串 + 内部权限 也可以 work
    │   │       （但 Azure 推荐迁移到 Entra ID）
    │   │
    │   ├── 需要多租户/多调用者隔离？
    │   │   └── ⚠️ 推荐 Entra ID（细粒度 RBAC 按身份分配权限）
    │   │       （但技术上 API Key 可能也被接受——需实测确认）
    │   │
    │   └── 单租户且不需要区分调用者？
    │       └── ✅ API Key 可能可行（如 Voice Live Agent 模式）
    │           （实测确认 SDK 1.2.0b5+ 支持）
    │
    └── 需要管理 Azure 资源本身（创建/删除/修改）
        └── ❌ 必须使用 Entra ID
```

> **实测补充**：决策树中"需要访问有主的数据"不一定等于"必须 Entra ID"。
> Azure 服务是否在技术层面强制要求 Entra ID 取决于具体的 API 实现。
> 例如 Voice Live Agent 模式在微软文档中声称需要 Entra ID，
> 但 SDK 1.2.0b5 实测 API Key 也可以（见 [02-model-vs-agent-mode.md](./02-model-vs-agent-mode.md) 第 3 节）。

---

## 3. Azure 服务认证分类

### 3.1 API Key 足够的服务（纯计算，无需区分调用者）

| 服务 | 说明 | 为什么 Key 够用 |
|------|------|----------------|
| Azure OpenAI（Chat/Embeddings） | 模型推理 | 只用算力，不涉及调用者特定数据 |
| Azure Speech（STT/TTS） | 语音识别/合成 | 纯音频处理，无持久化数据 |
| Azure Content Understanding | 文档分析 | 分析传入的内容，不访问其他数据 |
| Voice Live **Model 模式** | 直接与模型对话 | 调用者自带 system prompt，Azure 侧无需保护的数据 |
| Voice Live **Agent 模式** | 通过 Voice Live 调用 Agent | SDK 1.2.0b5+ 实测可行（见注释） |
| Azure Translator | 文本翻译 | 纯计算 |
| Azure Computer Vision | 图像分析 | 纯计算 |

> **Agent 模式注释（2026-04-08 实测更新）**：微软文档声称 Agent 模式不支持 API Key，
> 但 `azure-ai-voicelive==1.2.0b5`（API `2026-01-01-preview`）POC 实测确认
> API Key + AgentSessionConfig 可以成功连接、建立会话、并完成对话。
> API Key 在功能上可行，但安全粒度较粗（资源级别而非 Project 级别）。
> 多租户隔离场景仍建议 Entra ID。

### 3.2 推荐 Entra ID 的服务（涉及有主的数据/资源）

> 以下服务在技术层面可能接受 API Key，但从安全最佳实践角度**推荐** Entra ID。

| 服务 | 说明 | 为什么推荐身份认证 |
|------|------|-----------------|
| AI Foundry **Agent 调用** | 调用配置了知识库/工具的 Agent | 细粒度 RBAC：按 Project/Agent 控制访问权限 |
| Azure Key Vault | 密钥/证书管理 | 必须精确控制谁能读取哪些密钥 |
| Azure Resource Manager (ARM) | 资源生命周期管理 | 创建/删除/修改资源必须知道操作者身份 |
| Microsoft Graph | 用户/组织数据 | 涉及用户隐私数据 |
| Azure Storage（细粒度） | Blob/Table/Queue | 需要容器/对象级别的访问控制时 |

### 3.3 有内部权限系统的服务（连接字符串可用，但推荐迁向 Entra ID）

| 服务 | 传统方式 | 现代方式（Azure 推荐） | 为什么传统方式能 work |
|------|---------|---------------------|---------------------|
| Azure SQL Database | 连接字符串 (user/password) | Entra ID + Managed Identity | 数据库自带 GRANT/REVOKE 权限系统 |
| Azure PostgreSQL Flexible Server | 连接字符串 | Entra ID 认证 | PostgreSQL 自带角色和权限 |
| Azure Cache for Redis | Access Key + 连接字符串 | Entra ID（2024 新增） | Redis 自带 ACL |
| Azure Cosmos DB | Primary Key / 连接字符串 | Entra ID (RBAC) | Cosmos 自带资源级权限 |

> **注意**：数据库的连接字符串之所以 work，是因为数据库有**自己的内部权限层**作为第二道防线。API Key 认证的 Cognitive Services 没有这个内部权限层，所以当需要细粒度控制时，只能依赖 Entra ID + RBAC。

---

## 4. Entra ID 的三种身份类型

在 Entra ID 认证中，"调用方"可以是以下三种身份之一：

| 身份类型 | 适用场景 | 获取方式 |
|---------|---------|---------|
| **用户账号** | 本地开发、手动测试 | `az login` 后，`DefaultAzureCredential` 自动使用 |
| **Service Principal** | CI/CD、跨环境部署 | Azure Portal 创建 App Registration，配置 `AZURE_CLIENT_ID` + `AZURE_CLIENT_SECRET` + `AZURE_TENANT_ID` 环境变量 |
| **Managed Identity** | Azure 上运行的服务 | 在 Azure Container Apps / VM 上启用，无需管理密钥，自动获取 Token |

`DefaultAzureCredential` 会按顺序尝试这些身份，找到可用的就使用：

```
DefaultAzureCredential 尝试顺序：
  1. 环境变量（Service Principal）
  2. Managed Identity（Azure 上运行时）
  3. Azure CLI（az login，本地开发时）
  4. Visual Studio Code credential
  5. Interactive Browser（最后回退）
```

---

## 5. 关键概念总结

| 概念 | 一句话解释 |
|------|-----------|
| **API Key** | "我有钥匙" — 资源级别访问，不区分身份 |
| **Entra ID Token** | "我是谁，我能做什么" — 身份级别访问，细粒度控制 |
| **RBAC** | Role-Based Access Control — 给身份分配角色（如 "Cognitive Services User"），角色决定权限 |
| **Scope** | Token 的作用范围，Azure AI 服务统一使用 `https://cognitiveservices.azure.com/.default` |
| **DefaultAzureCredential** | Azure SDK 提供的"万能钥匙"，自动按优先级尝试多种认证方式 |
