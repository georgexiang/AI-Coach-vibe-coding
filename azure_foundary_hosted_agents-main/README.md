# Azure AI Foundry 托管代理示例集合

**重要提示！** 本 GitHub 仓库中提供的所有示例和其他资源（"示例"）旨在帮助加速开发各种场景下的代理、解决方案和代理工作流。请仔细审查所有提供的资源，并在您的使用场景中仔细测试输出行为。AI 响应可能不准确，AI 操作应在人工监督下进行监控。了解更多信息请参阅 [代理服务](https://learn.microsoft.com/zh-cn/azure/ai-foundry/responsible-ai/agents/transparency-note) 和 [代理框架](https://github.com/microsoft/agent-framework/blob/main/TRANSPARENCY_FAQ.md) 的透明度文档。

您创建的代理、解决方案或其他输出可能受法律和监管要求的约束，可能需要许可证，或者可能不适合所有行业、场景或用例。使用任何示例即表示您确认使用这些示例创建的任何输出完全由您负责，并且您将遵守所有适用的法律、法规以及相关的安全标准、服务条款和行为准则。

本文件夹中包含的第三方示例受其自己指定的条款约束，Microsoft 或其关联公司未对其进行测试或验证。

Microsoft 对您或他人就这些示例或任何结果输出概不负责。

## 项目概述

本项目是一个全面的 Azure AI Foundry 托管代理示例集合，展示了如何使用 Microsoft Agent Framework 和 LangGraph 构建、托管和部署各种类型的 AI 代理。所有示例都可以通过 [Azure AI AgentServer SDK](https://pypi.org/project/azure-ai-agentserver-agentframework/) 进行托管，并使用 Azure Developer CLI (azd) 的 [ai agent](https://aka.ms/azdaiagent/docs) 扩展部署到 Microsoft Foundry。

## 项目结构

本项目包含三个主要目录，涵盖不同的代理类型和实现方式：

### 📁 agent-framework/
基于 Microsoft Agent Framework 的代理示例集合

#### 基础代理
- **[echo-agent](agent-framework/echo-agent/README.md)** - 简单的回显代理，演示代理的基本结构和部署流程

- **[web-search-agent](agent-framework/web-search-agent/README.md)** - 使用 Bing Grounding 进行网络搜索的代理
  - 集成 Bing Grounding 工具
  - 提供实时网络信息查询能力
  - 支持准确的、有来源的答案

- **[agent-with-foundry-tools](agent-framework/agent-with-foundry-tools/README.md)** - 使用 Foundry 工具的代理
  - 支持 `web_search_preview` (Foundry 配置的工具)
  - 支持 `mcp` (模型上下文协议工具，通过 Foundry 项目连接 ID 配置)
  - 演示如何使用 `FoundryToolsChatMiddleware`

- **[agent-with-local-tools](agent-framework/agent-with-local-tools/README.md)** - 使用本地自定义工具的代理
  - 展示如何定义和使用自定义函数工具
  - 本地工具集成示例

- **[agent-with-text-search-rag](agent-framework/agent-with-text-search-rag/README.md)** - 结合文本搜索的 RAG（检索增强生成）代理
  - 演示检索增强生成模式
  - 集成文本搜索能力

#### 工作流代理
- **[agents-in-workflow](agent-framework/agents-in-workflow/README.md)** - 工作流中的多代理协作
  - 演示如何在工作流中编排多个代理
  - 多代理协作模式

#### 人机协作代理
- **[human-in-the-loop/agent-with-thread-and-hitl](agent-framework/human-in-the-loop/agent-with-thread-and-hitl/README.md)** - 带线程和人机交互的代理
  - 人工审批工作流
  - 使用 `@ai_function` 装饰器，配置 `approval_mode="always_require"`
  - 线程持久化（支持 JSON 本地文件或内存存储）
  - 适用于需要人工确认的敏感操作

- **[human-in-the-loop/workflow-agent-with-checkpoint-and-hitl](agent-framework/human-in-the-loop/workflow-agent-with-checkpoint-and-hitl/README.md)** - 带检查点和人机交互的工作流代理
  - 支持工作流检查点
  - 人机协作审批流程
  - 反思模式（Reflection Pattern）实现

### 📁 langgraph/
基于 LangGraph 框架的代理示例

- **[calculator-agent](langgraph/calculator-agent/README.md)** - 计算器代理
  - 使用 LangGraph 构建
  - 演示基本的工具调用

- **[react-agent-with-foundry-tools](langgraph/react-agent-with-foundry-tools/README.md)** - 使用 Foundry 工具的 ReAct 代理
  - 实现 ReAct（推理 + 行动）模式
  - 集成 Foundry 工具集

- **[human-in-the-loop](langgraph/human-in-the-loop/README.md)** - LangGraph 人机交互代理
  - LangGraph 框架下的人机协作实现

### 📁 custom/
自定义代理实现

- **[system-utility-agent](custom/system-utility-agent/README.md)** - 系统实用工具代理
  - 演示自定义工具的实现
  - 系统级操作集成

### 📁 code-interpreter-custom/
自定义代码解释器

- **[code-interpreter-custom](code-interpreter-custom/README.md)** - 自定义代码解释器与会话池
  - 使用 Container Apps 动态会话池
  - 自定义代码解释器镜像
  - MCP 服务器集成
  - 提供 Bicep 模板用于基础设施部署

## 核心功能特性

### 🚀 代理托管
所有代理都使用 [Azure AI AgentServer SDK](https://pypi.org/project/azure-ai-agentserver-agentframework/) 进行托管，该 SDK 提供：
- 与 OpenAI Responses 协议兼容的 REST API 端点
- 支持使用 OpenAI 兼容客户端进行交互
- 统一的代理服务接口

### ☁️ 部署到 Azure
使用 Azure Developer CLI (azd) 的 [ai agent](https://learn.microsoft.com/zh-cn/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry&tabs=cli#create-a-hosted-agent) 扩展轻松部署：
- 自动构建容器镜像到 Azure Container Registry (ACR)
- 在 Microsoft Foundry 上创建托管代理版本和部署
- 支持本地和云端构建

### 🛠️ 工具集成
支持多种工具类型：
- **Foundry 工具**：Bing 网络搜索、MCP 工具
- **本地工具**：自定义函数和工具
- **RAG 工具**：文本搜索和检索
- **代码解释器**：动态会话池中的代码执行

### 🤝 人机协作
多个示例演示人机交互模式：
- 工具调用前的人工审批
- 线程持久化和对话管理
- 检查点和状态恢复
- 灵活的审批工作流

## 技术栈

- **Python 3.10+**
- **Azure OpenAI Service** - 大语言模型部署（如 gpt-4o-mini、gpt-4）
- **Azure AI Foundry** - 代理托管和管理平台
- **Microsoft Agent Framework** - 代理开发框架
- **LangGraph** - 图形化代理工作流框架
- **Azure Container Registry** - 容器镜像存储
- **Azure Container Apps** - 代码解释器的动态会话池
- **Azure Developer CLI (azd)** - 部署工具

## 快速开始

### 前置要求

1. **Azure 订阅** - 需要有效的 Azure 订阅
2. **Azure AI Foundry 项目** - 在 [Azure AI Foundry](https://learn.microsoft.com/zh-cn/azure/ai-foundry/what-is-foundry?view=foundry#microsoft-foundry-portals) 中创建项目
3. **Azure OpenAI 部署** - 部署聊天模型（如 `gpt-4o-mini` 或 `gpt-4`）
4. **开发工具**
   - Azure CLI - 安装并认证 (`az login`)
   - Python 3.10+ 
   - Docker（可选，用于本地构建）

### 本地运行示例

1. 选择一个示例目录（例如 `agent-framework/web-search-agent`）
2. 创建 `.env` 文件并配置所需的环境变量
3. 安装依赖：
   ```bash
   pip install -r requirements.txt
   ```
4. 运行代理：
   ```bash
   python main.py
   ```

> **注意**：`.env` 文件仅用于本地开发。部署到 Azure AI Foundry 时，请删除 `.env` 文件并在 `agent.yaml` 中配置环境变量。

### 部署到 Azure

使用 Azure Developer CLI 部署：

```bash
# 初始化（首次部署）
azd init

# 部署代理
azd deploy
```

azd 扩展将：
1. 构建容器镜像到 Azure Container Registry
2. 在 Microsoft Foundry 上创建托管代理版本
3. 创建代理部署

## 架构说明

### 代理架构
```
┌─────────────────┐
│   用户/客户端    │
└────────┬────────┘
         │ OpenAI API 兼容请求
         ▼
┌─────────────────────────────┐
│  Azure AI AgentServer SDK   │
│  (REST API 端点)            │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Agent Framework / LangGraph│
│  (代理逻辑)                  │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  工具和服务                  │
│  - Azure OpenAI             │
│  - Bing Grounding           │
│  - MCP 工具                  │
│  - 自定义函数                │
└─────────────────────────────┘
```

### 部署架构
```
┌──────────────────────────────────┐
│  Azure AI Foundry Portal         │
│  (管理和监控)                     │
└──────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────┐
│  Hosted Agent Deployment         │
│  (托管代理部署)                   │
└─────────┬────────────────────────┘
          │
          ▼
┌──────────────────────────────────┐
│  Azure Container Apps            │
│  (运行容器化代理)                 │
└─────────┬────────────────────────┘
          │
          ▼
┌──────────────────────────────────┐
│  Azure Container Registry        │
│  (容器镜像存储)                   │
└──────────────────────────────────┘
```

## 常见问题

### 在 Apple Silicon 或其他 ARM64 机器上构建的镜像无法在服务上运行

**推荐使用 `azd` 云端构建**，它始终使用正确的架构构建镜像。

如果选择**本地构建**，并且您的机器**不是 `linux/amd64`**（例如 Apple Silicon Mac），镜像将**不兼容我们的服务**，会导致运行时失败。

**本地构建的修复方法**：

```bash
docker build --platform=linux/amd64 -t image .
```

这将强制镜像为所需的 `amd64` 架构构建。

## 学习路径建议

### 初学者
1. 从 [echo-agent](agent-framework/echo-agent/README.md) 开始，了解基本结构
2. 尝试 [web-search-agent](agent-framework/web-search-agent/README.md)，学习工具集成
3. 探索 [agent-with-local-tools](agent-framework/agent-with-local-tools/README.md)，创建自定义工具

### 进阶用户
1. 学习 [agent-with-foundry-tools](agent-framework/agent-with-foundry-tools/README.md)，使用 Foundry 工具
2. 实现 [agent-with-text-search-rag](agent-framework/agent-with-text-search-rag/README.md)，掌握 RAG 模式
3. 研究 [agents-in-workflow](agent-framework/agents-in-workflow/README.md)，多代理编排

### 高级用户
1. 实现人机协作：[agent-with-thread-and-hitl](agent-framework/human-in-the-loop/agent-with-thread-and-hitl/README.md)
2. 使用 LangGraph：[react-agent-with-foundry-tools](langgraph/react-agent-with-foundry-tools/README.md)
3. 定制代码解释器：[code-interpreter-custom](code-interpreter-custom/README.md)

## 相关资源

- [Azure AI Foundry 文档](https://learn.microsoft.com/zh-cn/azure/ai-foundry/)
- [Microsoft Agent Framework](https://github.com/microsoft/agent-framework)
- [Azure AI AgentServer SDK](https://pypi.org/project/azure-ai-agentserver-agentframework/)
- [Azure Developer CLI ai agent 扩展](https://aka.ms/azdaiagent/docs)
- [LangGraph 文档](https://langchain-ai.github.io/langgraph/)
- [负责任的 AI - 代理服务透明度说明](https://learn.microsoft.com/zh-cn/azure/ai-foundry/responsible-ai/agents/transparency-note)

## 许可证

请参阅各个示例目录中的许可证文件。

## 贡献

欢迎贡献！请遵循各个示例的贡献指南。

## 支持

如有问题或需要支持，请：
1. 查看各个示例的 README 文件
2. 访问 [Azure AI Foundry 文档](https://learn.microsoft.com/zh-cn/azure/ai-foundry/)
3. 提交 GitHub Issue

---

**最后更新**: 2026年2月
