# Domain Pitfalls

**Domain:** Azure AI Foundry Hosted Agent 示例集合
**Researched:** 2026-04-03

## Critical Pitfalls

### Pitfall 1: SDK Beta 版本不稳定

**What goes wrong:** `azure-ai-agentserver-*` 系列包版本为 1.0.0b10（beta），API 可能在版本间发生破坏性变更。
**Why it happens:** SDK 尚未 GA，Microsoft 可能频繁调整接口。
**Consequences:** 升级 SDK 版本后代码无法编译或运行异常；生产部署后需要紧急修复。
**Prevention:** 锁定 requirements.txt 中的精确版本号；升级前在测试环境验证。
**Detection:** 定期检查 PyPI 变更日志；CI 中固定版本。

### Pitfall 2: 三种框架路径混淆

**What goes wrong:** 选择了不合适的框架路径，导致开发效率低下或需要重写。
**Why it happens:** 项目提供了 Agent Framework、LangGraph、Custom 三种路径，各有不同的抽象级别和适用场景。
**Consequences:** 用 Custom (FoundryCBAgent) 实现简单聊天代理浪费大量时间；用 ChatAgent 实现复杂状态流程能力不足。
**Prevention:**
- 简单对话/工具调用 → Agent Framework (ChatAgent)
- 复杂状态流/条件分支 → LangGraph (StateGraph)  
- 需要完全控制响应格式/协议 → Custom (FoundryCBAgent)
**Detection:** 如果发现需要绕过框架做大量底层操作，说明选错了路径。

### Pitfall 3: code-interpreter-custom 的架构差异

**What goes wrong:** 将 code-interpreter-custom 当作与其他项目相同的架构来理解或复制。
**Why it happens:** 该项目使用 `azure-ai-projects` SDK 而非 AgentServer 适配器，是脚本式运行而非持久托管。
**Consequences:** 无法正确部署或集成到托管平台。
**Prevention:** 明确区分两种模式：AgentServer 托管模式（其它 11 个项目）vs AI Projects 脚本模式（code-interpreter-custom）。
**Detection:** 检查 import 是否使用 `azure.ai.agentserver` 还是 `azure.ai.projects`。

## Moderate Pitfalls

### Pitfall 4: 环境变量命名不统一

**What goes wrong:** 不同项目使用不同的环境变量名称指向同一资源。
**Prevention:**
| 资源 | 变量名 (varies by project) |
|------|---------------------------|
| 项目端点 | `AZURE_AI_PROJECT_ENDPOINT` / `PROJECT_ENDPOINT` |
| 模型部署 | `AZURE_AI_MODEL_DEPLOYMENT_NAME` / `MODEL_DEPLOYMENT_NAME` / `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME` |
| OpenAI 端点 | `AZURE_OPENAI_ENDPOINT` / `AZURE_ENDPOINT` |

每个项目的 agent.yaml 定义了它需要的环境变量，以此为准。

### Pitfall 5: 异步/同步客户端混用

**What goes wrong:** 部分项目用 `azure.identity.aio.DefaultAzureCredential`（异步），部分用 `azure.identity.DefaultAzureCredential`（同步），混用导致错误。
**Prevention:** 检查项目是否使用 `async def main()` / `asyncio.run()`；异步入口用 `.aio` 版本，同步入口用同步版本。

### Pitfall 6: HITL 持久化缺失

**What goes wrong:** 配置了 HITL 审批流程但未配置持久化，容器重启后丢失等待审批的请求。
**Prevention:**
- Agent Thread HITL: 必须配置 `JsonLocalFileAgentThreadRepository` 或其他 ThreadRepository
- Workflow HITL: 必须配置 `FileCheckpointRepository` 或其他 CheckpointRepository
- LangGraph HITL: `InMemorySaver` 仅适用于开发，生产需用持久化后端

### Pitfall 7: LangGraph 模型初始化时机

**What goes wrong:** LangGraph 项目中在模块级别初始化 LLM（如 `llm = initialize_llm()`），如果环境变量未设置会导致 import 失败。
**Prevention:** 使用延迟初始化或在 `if __name__ == "__main__"` 中初始化；或确保容器启动时环境变量已就绪。

## Minor Pitfalls

### Pitfall 8: Dockerfile 端口固定为 8088

**What goes wrong:** 所有 Dockerfile 暴露 8088 端口，文档中未说明是否可配置。
**Prevention:** 确认 AgentServer SDK 默认监听端口；如需修改，检查 SDK 是否支持端口配置。

### Pitfall 9: .env 文件的 override 行为

**What goes wrong:** 部分项目 `load_dotenv(override=True)`，部分 `load_dotenv(override=False)`，在部署环境中可能覆盖平台注入的环境变量。
**Prevention:** 部署环境中不包含 .env 文件；本地开发时理解 override 参数的含义。

### Pitfall 10: system-utility-agent 运行 psutil 的容器限制

**What goes wrong:** psutil 在容器中只能看到容器内的进程/资源，而非宿主机。
**Prevention:** system-utility-agent 已内置容器检测（`_is_running_in_container()`）和 cgroup 限制读取，但使用者需理解这一限制。

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| 基础代理 | 环境变量未配置 | 仔细对照 agent.yaml 中的 environment_variables |
| 工具集成 | Bing/MCP Connection ID 配置错误 | 在 Azure AI Foundry Portal 中确认连接 ID |
| 多代理工作流 | 并发执行顺序不确定 | ConcurrentBuilder 的结果合并由框架处理 |
| HITL | 持久化未配置 | 生产环境必须配置非内存持久化 |
| LangGraph | 模块级初始化失败 | 延迟初始化 or 确保环境变量 |
| Custom Agent | 响应格式不符合协议 | 严格遵循 OpenAI Responses 协议的事件格式 |
| Code Interpreter | Bicep 部署失败 | 确认 location 参数支持（仅 eastus/swedencentral/northeurope） |

## Sources

- 代码审查中发现的模式差异和潜在问题
- 环境变量和配置分析
- 框架选择的经验判断
