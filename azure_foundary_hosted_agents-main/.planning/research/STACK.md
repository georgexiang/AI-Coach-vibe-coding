# Technology Stack

**Project:** Azure AI Foundry Hosted Agents
**Researched:** 2026-04-03

## Recommended Stack (项目实际使用)

### Core Runtime

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Python | 3.12 | 运行时 | Dockerfile 指定，Azure AI SDK 推荐版本 |
| Docker | - | 容器化 | 所有代理通过容器部署到 Azure |

### Azure AI AgentServer SDK 系列

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `azure-ai-agentserver-agentframework` | 1.0.0b10 | Agent Framework 适配器 | 将 Agent Framework 代理转为托管服务 |
| `azure-ai-agentserver-langgraph` | 1.0.0b10 | LangGraph 适配器 | 将 LangGraph 图转为托管服务 |
| `azure-ai-agentserver-core` | 1.0.0b10 | 底层核心 SDK | 完全自定义代理实现（FoundryCBAgent） |

### AI 框架层

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Microsoft Agent Framework (`agent_framework`) | - | 高级代理框架 | 提供 ChatAgent, BaseAgent, WorkflowBuilder 等高级抽象 |
| LangGraph | - | 状态图框架 | 提供 StateGraph、ToolNode 等图编排能力 |
| LangChain | - | LLM 工具链 | init_chat_model, create_agent 等 LLM 集成 |

### Azure 服务 SDK

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `azure-identity` | 1.25.1 | 认证 | DefaultAzureCredential 统一认证 |
| `azure-ai-projects` | 2.0.0b2 | Azure AI 项目客户端 | 用于 code-interpreter-custom 和 system-utility-agent |
| `openai` | 2.14.0 | OpenAI API 客户端 | system-utility-agent 中直接调用 |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `python-dotenv` | 1.0.0-1.1.1 | 环境变量加载 | 本地开发时dari .env 加载配置 |
| `psutil` | 5.9.4 | 系统信息 | system-utility-agent 获取进程/资源信息 |
| `azure-monitor-opentelemetry` | 1.8.1 | 遥测 | 可选，用于监控和追踪 |
| `pydantic` | - | 数据模型 | LangGraph HITL 中定义 AskHuman schema |
| `pytest` | 8.4.2 | 测试 | 单元测试框架 |

## 三种框架的对比

| Aspect | Agent Framework | LangGraph | Custom (FoundryCBAgent) |
|--------|----------------|-----------|------------------------|
| 抽象级别 | 高 | 中 | 低 |
| 适配器函数 | `from_agent_framework()` | `from_langgraph()` | 继承 `FoundryCBAgent` |
| SDK 包 | `agentserver-agentframework` | `agentserver-langgraph` | `agentserver-core` |
| 工具定义 | 函数 / `@ai_function` | `@tool` 装饰器 | JSON schema + 函数映射 |
| 工作流 | `ConcurrentBuilder` / `WorkflowBuilder` | `StateGraph` | 手动循环 |
| HITL | `approval_mode` / `request_info` | `interrupt()` | 手动实现 |
| 适用场景 | 标准代理、多代理协作 | 复杂状态流程 | 需要完全控制 |

## Alternatives Considered

| Category | Used | Alternative | Why Not |
|----------|------|-------------|---------|
| Agent Framework | Microsoft Agent Framework | Semantic Kernel | Foundry 原生集成更紧密 |
| Graph Framework | LangGraph | AutoGen | LangGraph 有 AgentServer 官方适配器 |
| Auth | DefaultAzureCredential | API Key | 生产环境推荐 Managed Identity |
| Container | Docker | Podman | Docker 是 Azure 生态标准 |

## Installation (per-project)

```bash
# Agent Framework 项目
pip install azure-ai-agentserver-agentframework==1.0.0b10

# LangGraph 项目
pip install azure-ai-agentserver-langgraph==1.0.0b10

# Custom 项目
pip install azure-ai-agentserver-core==1.0.0b10 azure-ai-projects==2.0.0b2 openai==2.14.0

# Common
pip install azure-identity python-dotenv
```

## Sources

- 直接从项目代码和 requirements.txt 提取
- agent.yaml 配置文件分析
