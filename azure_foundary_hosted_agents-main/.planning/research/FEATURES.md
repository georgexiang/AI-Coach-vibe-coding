# Feature Landscape

**Domain:** Azure AI Foundry Hosted Agent 示例集合
**Researched:** 2026-04-03

## 项目子模块清单

共 12 个独立代理子项目，按框架分类：

### Agent Framework 系列 (8 个)

| # | 子项目 | 核心功能 | 复杂度 | 框架类 |
|---|--------|----------|--------|--------|
| 1 | echo-agent | 自定义 BaseAgent 回显消息 | Low | BaseAgent |
| 2 | web-search-agent | Bing Grounding 网络搜索 | Low | ChatAgent + HostedWebSearchTool |
| 3 | agent-with-foundry-tools | Foundry 平台工具集成 | Med | AzureOpenAIChatClient + FoundryToolsChatMiddleware |
| 4 | agent-with-local-tools | 本地自定义函数工具 | Med | AzureAIAgentClient + 函数工具 |
| 5 | agent-with-text-search-rag | RAG 检索增强生成 | Med | AzureOpenAIChatClient + ContextProvider |
| 6 | agents-in-workflow | 多代理并发工作流 | Med | ConcurrentBuilder |
| 7 | agent-with-thread-and-hitl | 人机协作+线程持久化 | High | ChatAgent + @ai_function(approval_mode) |
| 8 | workflow-agent-with-checkpoint-and-hitl | 工作流检查点+HITL+反思 | High | WorkflowBuilder + Executor + Checkpoint |

### LangGraph 系列 (3 个)

| # | 子项目 | 核心功能 | 复杂度 | 框架类 |
|---|--------|----------|--------|--------|
| 9 | calculator-agent | 算术计算工具调用 | Low | StateGraph + @tool |
| 10 | react-agent-with-foundry-tools | ReAct + Foundry 工具 | Med | create_agent + use_foundry_tools |
| 11 | human-in-the-loop (LangGraph) | LangGraph 人机协作 | High | StateGraph + interrupt() |

### Custom 系列 (1 个)

| # | 子项目 | 核心功能 | 复杂度 | 框架类 |
|---|--------|----------|--------|--------|
| 12 | system-utility-agent | 系统工具代理 | High | FoundryCBAgent (底层) |

### 独立项目 (1 个)

| # | 子项目 | 核心功能 | 复杂度 | 模式 |
|---|--------|----------|--------|------|
| 13 | code-interpreter-custom | 自定义代码解释器 | High | azure-ai-projects SDK + Bicep |

## 按功能维度分析

### 基础能力

| Feature | 涉及项目 | 说明 |
|---------|----------|------|
| 自定义 Agent 实现 | echo-agent | 继承 BaseAgent, 实现 run() 和 run_stream() |
| 聊天代理 | web-search-agent, local-tools, text-search-rag, thread-hitl | 使用 ChatAgent 高级封装 |
| 环境变量配置 | 所有项目 | 通过 agent.yaml 和 .env 管理 |
| 容器化部署 | 所有 agent-framework + langgraph | 统一 Dockerfile 模板 |

### 工具集成模式

| Feature | 涉及项目 | 实现方式 |
|---------|----------|----------|
| Bing 网络搜索 | web-search-agent | HostedWebSearchTool + BING_GROUNDING_CONNECTION_ID |
| Foundry web_search_preview | agent-with-foundry-tools | FoundryToolsChatMiddleware |
| MCP 协议工具 | agent-with-foundry-tools, react-agent | project_connection_id 配置 |
| 本地函数工具 | agent-with-local-tools | Python 函数 + Annotated 类型注解 |
| LangChain @tool | calculator-agent, langgraph-hitl | LangChain tool 装饰器 |
| OpenAI 风格 JSON 工具 | system-utility-agent | JSON schema 定义 + 手动分发 |
| code_interpreter | react-agent-with-foundry-tools | Foundry code_interpreter 类型 |

### 工作流与编排

| Feature | 涉及项目 | 实现方式 |
|---------|----------|----------|
| 并发多代理 | agents-in-workflow | ConcurrentBuilder + participants |
| 顺序工作流 | workflow-checkpoint-hitl | WorkflowBuilder + add_edge |
| 状态图编排 | calculator-agent, langgraph-hitl | StateGraph + 条件边 |
| ReAct 模式 | react-agent-with-foundry-tools | langchain create_agent |

### 人机协作 (HITL)

| Feature | 涉及项目 | 实现方式 |
|---------|----------|----------|
| 工具审批 | agent-with-thread-and-hitl | @ai_function(approval_mode="always_require") |
| 工作流人工审核 | workflow-checkpoint-hitl | ctx.request_info() → ReviewResponse |
| LangGraph 中断 | langgraph/human-in-the-loop | interrupt() + AskHuman schema |

### 持久化与检查点

| Feature | 涉及项目 | 实现方式 |
|---------|----------|----------|
| 线程持久化 (JSON) | agent-with-thread-and-hitl | JsonLocalFileAgentThreadRepository |
| 自定义消息存储 | agent-with-thread-and-hitl | CustomChatMessageStore (ChatMessageStoreProtocol) |
| 工作流检查点 | workflow-checkpoint-hitl | FileCheckpointRepository |
| 内存检查点 | langgraph/calculator, react-agent | MemorySaver / InMemorySaver |
| 执行器检查点 | workflow-checkpoint-hitl | on_checkpoint_save / on_checkpoint_restore |

### 基础设施

| Feature | 涉及项目 | 实现方式 |
|---------|----------|----------|
| Bicep 模板 | code-interpreter-custom | Container Apps 环境 + Session Pool |
| 动态会话池 | code-interpreter-custom | Azure Container Apps Dynamic Sessions |
| 自定义容器镜像 | code-interpreter-custom | MCR code interpreter 镜像 |

## Anti-Features (明确不包含)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| 前端 UI | 示例集中于后端代理逻辑 | 使用 OpenAI 兼容客户端或 Azure AI Foundry Portal 交互 |
| 数据库集成 | 保持示例简洁 | 生产环境可扩展 ContextProvider 或自定义工具 |
| 多语言实现 | Python 是 Azure AI SDK 主要支持语言 | 未来可能支持 .NET/JS |
| 认证/授权机制 | 由 Azure AI Foundry 平台统一处理 | 依赖 Foundry 平台的安全层 |

## Feature Dependencies

```
echo-agent (基础) → web-search-agent (工具) → agent-with-local-tools (自定义工具)
                                              → agent-with-foundry-tools (平台工具)
                                              → agent-with-text-search-rag (RAG)
agent-with-local-tools → agent-with-thread-and-hitl (HITL + 线程)
agents-in-workflow → workflow-checkpoint-hitl (工作流 + HITL + 检查点 + 反思)
calculator-agent (LangGraph 基础) → react-agent (ReAct) → langgraph-hitl (HITL)
system-utility-agent (独立，底层 API)
code-interpreter-custom (独立，不同 SDK 路径)
```

## Sources

- 直接从 12 个子项目的 main.py, agent.yaml, requirements.txt 代码分析
