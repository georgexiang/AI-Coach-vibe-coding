# 04 — AI Coach 平台集成策略

> 基于前三节的认证模型理解，本节描述 AI Coach 平台如何实现 Model/Agent 双模式切换。

---

## 1. 当前实现现状

### 1.1 架构概览

```
前端 (React)                    后端 (FastAPI)                     Azure
    │                               │                               │
    │── WebSocket ──>  /api/v1/voice-live/ws                        │
    │                               │                               │
    │                               │── AzureKeyCredential ──>      │
    │                               │   connect(model="gpt-4o")     │
    │                               │                               │
    │<── 语音/文本回复 ───────────── │<── 模型推理结果 ──────────── │
```

### 1.2 现状总结

| 组件 | 当前状态 |
|------|---------|
| WebSocket 代理 (`voice_live_websocket.py`) | **只支持 Model 模式**，使用 `AzureKeyCredential` |
| Token Broker (`voice_live_service.py`) | 能检测 agent/model 模式，但只返回元数据 |
| STS Token 交换函数 | 已写好但未调用（死代码） |
| `azure-identity` 包 | 已安装，`agent_sync_service.py` 在用 |
| Agent 同步 (`agent_sync_service.py`) | 支持 `DefaultAzureCredential` fallback |
| HCP Profile | 有 `agent_id` 和 `agent_sync_status` 字段 |
| 前端模式选择器 | 有 `realtime_agent` 模式定义，但后端不区分处理 |

### 1.3 代码中的关键注释

`voice_live_websocket.py` 中有三处注释说明为什么只用 Model 模式：

> "Agent mode requires Azure AD/Entra ID auth which is not available in API-key-based deployments."

**更新（2026-04-08）**：POC 实测证明 API Key **可以**用于 Agent 模式（SDK 1.2.0b5+）。
这些注释将在 Phase 16 中被移除。

---

## 2. 双模式切换设计（更新版）

> **核心简化**：实测证明 API Key + Agent 可行，因此**不需要改认证架构**，
> 只需升级 SDK 并在 `connect()` 中添加 `agent_config` 参数。

### 2.1 切换逻辑

```python
# 伪代码
if hcp_profile.agent_id and hcp_profile.agent_sync_status == "synced":
    # Agent 模式：同样使用 API Key，但传 agent_config 而非 model
    mode = "agent"
else:
    # Model 模式：使用 API Key + model（当前行为不变）
    mode = "model"
```

**决策依据**：
- HCP Profile 是否已同步到 AI Foundry Agent（Phase 11 实现的功能）
- 有 `agent_id` 且状态为 `synced` → Agent 已就绪，可以用 Agent 模式
- 否则 → 退回 Model 模式（当前行为不变）

### 2.2 WebSocket 代理改造

```
改造前（只有 Model 模式）:
  credential = AzureKeyCredential(api_key)
  connect(credential=credential, model=model)

改造后（双模式 — 认证方式不变！）:
  credential = AzureKeyCredential(api_key)        # ← 始终用 API Key
  if agent_mode:
      connect(                                     # Agent 模式
          credential=credential,
          agent_config={
              "agent_name": agent_name,
              "project_name": project_name,
          },
      )
  else:
      connect(                                     # Model 模式
          credential=credential,
          model=model,
      )
```

**与之前方案的关键区别**：
- 之前：Agent 模式需要 `DefaultAzureCredential()`（Entra ID），改动大
- 现在：Agent 模式继续用 `AzureKeyCredential`，只需传 `agent_config`，改动极小

### 2.3 Fallback 链

```
尝试 Agent 模式
    │
    ├── 成功 → 使用 Agent 模式（知识库 + 工具 + 预配置 instructions）
    │
    └── 失败（Agent 服务异常 / Agent 不存在 / 配置错误）
        │
        └── 自动降级到 Model 模式（API Key + instructions from HCP Profile）
            │
            └── 记录 warning 日志 + 通知前端降级状态
```

---

## 3. 需要的配置变更

### 3.1 环境变量（`.env`）

```bash
# 现有（不变 — Agent 模式也使用同一个 API Key）
AZURE_FOUNDRY_ENDPOINT=https://xxx.cognitiveservices.azure.com/
AZURE_FOUNDRY_API_KEY=xxx
AZURE_FOUNDRY_DEFAULT_PROJECT=ai-coach-project

# 不再需要 Entra ID 配置！（POC 实测 API Key + Agent 可行）
# 如果未来需要多租户隔离，再考虑 Entra ID
```

### 3.2 SDK 升级（必须）

```bash
# pyproject.toml 中更新
pip install "azure-ai-voicelive>=1.2.0b5"   # 必须 >= 1.2.0b5
# 1.1.0 没有 AgentSessionConfig，无法使用 Agent 模式
```

### 3.3 config.py 变更

```python
# 新增配置项
voice_live_agent_mode_enabled: bool = True   # 是否启用 Agent 模式（当 HCP 有 synced agent 时）
```

---

## 4. 不需要变更的部分

| 组件 | 为什么不需要变 |
|------|---------------|
| 前端 WebSocket 连接 | 前端始终连后端代理，Agent 切换对前端透明 |
| 前端模式选择器 | 已有 `realtime_agent` 模式定义 |
| HCP Profile 数据模型 | 已有 `agent_id` 和 `agent_sync_status` 字段 |
| Agent 同步服务 | 已实现（Phase 11） |
| **认证方式** | **API Key 继续使用，不需要引入 Entra ID**（SDK 1.2.0b5 实测确认） |
| `azure-identity` 依赖 | 已安装（备用，Agent 模式暂不需要） |
| Token Broker | Agent 模式检测逻辑已存在，需小幅更新 |

---

## 5. Agent 模式带来的业务价值

当 HCP 以 Agent 模式运行时：

| 能力 | Model 模式 | Agent 模式 |
|------|-----------|-----------|
| 知识库检索（RAG） | 不支持（instructions token 有限） | 支持（Azure AI Search 自动检索） |
| 工具调用 | 不支持 | 支持（Function Calling） |
| 对话记忆 | 无（每次全新） | 可配置 |
| 人格一致性 | 依赖 instructions 质量 | 由 Agent 预配置保证 |
| 运维更新 | 改代码 / 改数据库 | 在 AI Foundry Portal 直接修改 |

**对 BeiGene 的关键价值**：MR 训练时，AI HCP 能够基于真实的产品知识库回答问题（而不是仅靠 instructions 中的有限描述），训练效果更接近真实场景。

---

## 6. 参考链接

| 资源 | 链接 |
|------|------|
| Voice Live Agents 快速入门 | https://learn.microsoft.com/azure/ai-services/speech-service/voice-live-agents-quickstart |
| Voice Live API 使用指南 | https://learn.microsoft.com/azure/ai-services/speech-service/voice-live-how-to |
| azure.ai.voicelive Python SDK | https://learn.microsoft.com/python/api/azure-ai-voicelive/ |
| DefaultAzureCredential 文档 | https://learn.microsoft.com/python/api/azure-identity/azure.identity.defaultazurecredential |
| Azure AI Foundry Agent Service | https://learn.microsoft.com/azure/ai-services/agents/ |
| RBAC 角色分配 | https://learn.microsoft.com/azure/role-based-access-control/role-assignments |
