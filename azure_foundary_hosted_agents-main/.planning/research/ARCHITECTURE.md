# Architecture Patterns

**Domain:** Azure AI Foundry Hosted Agent 示例集合
**Researched:** 2026-04-03

## Overall Architecture: 适配器模式 (Adapter Pattern)

所有项目的核心架构都遵循同一个模式：**用户代理逻辑 → AgentServer 适配器 → HTTP 服务（OpenAI Responses 协议）**

```
                    ┌─────────────────────────────────────────────┐
                    │            Azure AI Foundry Platform         │
                    │                                             │
                    │   ┌───────────────────────────────────────┐ │
                    │   │     OpenAI Responses Protocol API      │ │
                    │   │         (REST Endpoint)                │ │
                    │   └──────────────┬────────────────────────┘ │
                    │                  │                           │
                    │   ┌──────────────┴────────────────────────┐ │
                    │   │     AgentServer SDK Adapter Layer      │ │
                    │   │                                        │ │
                    │   │  ┌─────────────┬──────────┬─────────┐ │ │
                    │   │  │ from_agent  │ from_    │ Foundry │ │ │
                    │   │  │ _framework  │ langgraph│ CBAgent │ │ │
                    │   │  └──────┬──────┴────┬─────┴────┬────┘ │ │
                    │   └─────────┼───────────┼──────────┼──────┘ │
                    │             │           │          │         │
                    │   ┌─────────┴──┐ ┌──────┴───┐ ┌───┴──────┐ │
                    │   │  Agent     │ │ LangGraph│ │  Custom  │ │
                    │   │  Framework │ │ StateGraph│ │ Agent   │ │
                    │   │  (8 agents)│ │ (3 agents)│ │ (1 agent)│ │
                    │   └────────────┘ └──────────┘ └──────────┘ │
                    │                                             │
                    │   Container (Docker) on Azure               │
                    └─────────────────────────────────────────────┘
```

## 三种适配器路径

### Path 1: Agent Framework → from_agent_framework()

```python
# 最高抽象级别
agent = ChatAgent(chat_client=..., tools=[...], instructions="...")
from_agent_framework(agent).run()  # → HTTP server on :8088
```

**组件边界:**

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `BaseAgent` / `ChatAgent` | 代理核心逻辑（run/run_stream） | ChatClient, Tools |
| `AzureAIAgentClient` | Azure AI 模型调用客户端 | Azure OpenAI Service |
| `AzureOpenAIChatClient` | OpenAI 兼容聊天客户端 | Azure OpenAI Endpoint |
| `ContextProvider` | 注入上下文（RAG） | Agent (pre-invocation hook) |
| `FoundryToolsChatMiddleware` | Foundry 平台工具中间件 | Foundry Tools API |
| `ConcurrentBuilder` | 并发工作流编排 | Multiple Agents |
| `WorkflowBuilder` | 有向图工作流编排 | Executor nodes |
| `from_agent_framework()` | 适配到 HTTP 服务 | Agent/Builder |

### Path 2: LangGraph → from_langgraph()

```python
# 中等抽象级别
graph = StateGraph(MessagesState)
graph.add_node("agent", call_model)
graph.add_node("action", tool_node)
app = graph.compile(checkpointer=MemorySaver())
from_langgraph(app).run()  # → HTTP server
```

**组件边界:**

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `StateGraph` | 状态图定义 | Nodes, Edges |
| `MessagesState` | 消息状态容器 | Graph Nodes |
| `ToolNode` | 工具执行节点 | LangChain Tools |
| `init_chat_model` | LLM 初始化 | Azure OpenAI |
| `MemorySaver` / `InMemorySaver` | 检查点存储 | StateGraph |
| `use_foundry_tools()` | Foundry 工具中间件 | Foundry API |
| `from_langgraph()` | 适配到 HTTP 服务 | Compiled Graph |

### Path 3: Custom → FoundryCBAgent

```python
# 最低抽象级别
class MyAgent(FoundryCBAgent):
    async def agent_run(self, context: AgentRunContext):
        # 手动实现 tool-calling loop
        # 手动构建 OpenAI Response 对象
        # 手动处理流式事件
        ...
```

**组件边界:**

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `FoundryCBAgent` | 底层代理基类 | AgentServer Core |
| `AgentRunContext` | 请求上下文 | Agent |
| `AzureOpenAI` / `AIProjectClient` | 模型调用 | Azure OpenAI |
| `OpenAIResponse` | 响应对象 | REST API |
| `ResponseStreamEvent` 系列 | 流式事件 | REST API |
| 手动 tool-calling loop | 工具调用循环 | OpenAI API + 工具函数 |

## 数据流模式

### 标准请求流

```
Client Request (OpenAI Responses Protocol)
    → AgentServer Adapter (deserialize)
        → Agent Logic (process)
            → LLM Call (Azure OpenAI)
                ← LLM Response
            → Tool Call (if needed)
                ← Tool Result
            → LLM Call (with tool result)
                ← Final Response
        ← Agent Response
    ← HTTP Response (OpenAI Responses Protocol)
```

### HITL (Human-in-the-Loop) 流

```
Agent Framework HITL:
    Client Request → Agent → Tool Call (needs approval)
        → Agent pauses, returns approval request
        Client sends approval → Agent resumes

LangGraph HITL:
    Client Request → Graph → interrupt()
        → Graph pauses at checkpoint, returns question
        Client sends response → Graph resumes from checkpoint

Workflow HITL:
    Client Request → Worker → Reviewer → ctx.request_info()
        → Workflow pauses, returns HumanReviewRequest
        Client sends ReviewResponse → Workflow resumes
```

### 多代理并发流 (agents-in-workflow)

```
User Message
    → ConcurrentBuilder
        → Researcher Agent  ─┐
        → Marketer Agent     ├─ parallel execution
        → Legal Agent       ─┘
    → Aggregated Response
```

## Patterns to Follow

### Pattern 1: 统一入口模式

所有代理的 main.py 都遵循相同模式：

```python
# Agent Framework
def create_agent():
    agent = ChatAgent(...)
    return agent

if __name__ == "__main__":
    from_agent_framework(create_agent()).run()

# LangGraph
app = build_graph()
if __name__ == "__main__":
    from_langgraph(app).run()
```

### Pattern 2: agent.yaml 声明式配置

```yaml
name: agent-name
template:
  kind: hosted           # 托管模式
  protocols:
    - protocol: responses  # OpenAI Responses 协议
  environment_variables:
    - name: AZURE_AI_PROJECT_ENDPOINT
      value: ${AZURE_AI_PROJECT_ENDPOINT}
resources:
  - kind: model
    id: gpt-4o-mini
    name: chat
```

### Pattern 3: 统一 Dockerfile

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY . user_agent/
WORKDIR /app/user_agent
RUN pip install -r requirements.txt
EXPOSE 8088
CMD ["python", "main.py"]
```

### Pattern 4: 认证统一使用 DefaultAzureCredential

```python
from azure.identity import DefaultAzureCredential
credential = DefaultAzureCredential()
# 本地开发用 Azure CLI 登录，生产环境自动使用 Managed Identity
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: 混用不同 SDK 路径
**What:** 在同一个代理中同时使用 `agentserver-agentframework` 和 `agentserver-core`
**Why bad:** 两套 SDK 有不同的生命周期管理和响应格式
**Instead:** 选择一个框架路径并坚持使用

### Anti-Pattern 2: 硬编码 API Key
**What:** 在代码中直接写入 API Key 或连接字符串
**Why bad:** 安全风险，不适合容器化部署
**Instead:** 使用 DefaultAzureCredential + 环境变量 + agent.yaml 配置

### Anti-Pattern 3: 忽略检查点/线程持久化
**What:** HITL 场景中不配置持久化存储
**Why bad:** 容器重启后丢失所有会话状态
**Instead:** 使用 JsonLocalFileAgentThreadRepository 或 FileCheckpointRepository

## 项目独特之处: code-interpreter-custom

`code-interpreter-custom` 项目与其他 11 个项目架构不同：
- 不使用 AgentServer 适配器，而是直接使用 `azure-ai-projects` SDK
- 使用 PromptAgentDefinition 定义代理（声明式）
- 通过 MCP 协议连接到 Container Apps 动态会话池
- 提供 Bicep 基础设施模板用于部署会话池
- 是脚本式运行（创建代理 → 调用 → 删除），而非持久化托管服务

## Sources

- 所有 12 个子项目的 main.py 源码分析
- agent.yaml 和 Dockerfile 配置分析
- requirements.txt 依赖分析
