# Research Summary: Azure AI Foundry Hosted Agents

**Domain:** AI Agent 托管平台示例集合 (Azure AI Foundry Hosted Agent Samples)
**Researched:** 2026-04-03
**Overall confidence:** HIGH

## Executive Summary

本项目是一个 Azure AI Foundry 托管代理（Hosted Agent）的示例集合，展示了如何使用三种不同的框架/模式构建可部署到 Microsoft Foundry 的 AI 代理。项目通过 Azure AI AgentServer SDK 系列包实现统一托管，并使用 Azure Developer CLI (`azd`) 的 `ai agent` 扩展进行部署。

项目包含 **12 个独立的代理子项目**，分布在 4 个顶层目录中，覆盖了从最简单的 Echo 回显代理到复杂的多代理工作流、人机协作（HITL）模式、RAG 检索增强等多种场景。每个子项目是一个完整的可部署单元，包含 `main.py`（入口）、`agent.yaml`（部署配置）、`Dockerfile`（容器化）和 `requirements.txt`（依赖）。

整个项目围绕 Azure AI AgentServer 的三个 SDK 适配器包构建：
- `azure-ai-agentserver-agentframework`：适配 Microsoft Agent Framework
- `azure-ai-agentserver-langgraph`：适配 LangGraph
- `azure-ai-agentserver-core`：底层核心 SDK，用于完全自定义实现

## Key Findings

**Stack:** Python 3.12 + Azure AI AgentServer SDK (1.0.0b10) + Microsoft Agent Framework / LangGraph / Custom FoundryCBAgent
**Architecture:** 每个代理是独立的容器化微服务，通过 OpenAI Responses 协议暴露 REST API，部署到 Azure AI Foundry
**Critical pitfall:** SDK 处于 beta 阶段（1.0.0b10），API 可能频繁变化；三种框架的集成方式差异大，需按场景选择

## Implications for Roadmap

基于研究，建议的学习/开发路径结构：

1. **基础代理入门** - 从 echo-agent 和 web-search-agent 开始
   - 掌握 BaseAgent 和 ChatAgent 的基本结构
   - 理解 `from_agent_framework()` 适配器模式
   - 理解 agent.yaml 部署配置

2. **工具集成** - agent-with-local-tools 和 agent-with-foundry-tools
   - 本地自定义工具（`@ai_function` / 函数工具）
   - Foundry 平台工具（web_search_preview, MCP）
   - FoundryToolsChatMiddleware 中间件模式

3. **RAG 与上下文增强** - agent-with-text-search-rag
   - ContextProvider 模式
   - 检索增强生成实现

4. **多代理与工作流** - agents-in-workflow
   - ConcurrentBuilder 并发工作流
   - 多代理协作编排

5. **人机协作（HITL）** - 两个 HITL 子项目 + LangGraph HITL
   - 工具审批模式（approval_mode）
   - 工作流检查点与反思模式
   - LangGraph interrupt 机制

6. **LangGraph 集成** - calculator-agent 和 react-agent
   - StateGraph 构建
   - ReAct 模式
   - Foundry 工具适配

7. **自定义底层代理** - system-utility-agent
   - FoundryCBAgent 底层 API
   - OpenAI Responses 协议手动实现
   - 流式响应事件构建

8. **代码解释器** - code-interpreter-custom
   - Container Apps 动态会话池
   - MCP 服务器集成
   - Bicep 基础设施模板

**Phase ordering rationale:**
- 从简单到复杂，逐步增加概念
- 先掌握 Agent Framework （最高抽象），再学 LangGraph（中等抽象），最后 Custom（最底层）
- HITL 和工作流依赖对基础代理的理解

**Research flags for phases:**
- Phase 5 (HITL): 需要深入理解 checkpoint 和 thread 持久化机制
- Phase 7 (Custom): 底层 API 较复杂，需参考 AgentServer Core 文档
- Phase 8 (Code Interpreter): 需要额外的 Azure 基础设施部署知识

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 直接从代码和 requirements.txt 提取 |
| Features | HIGH | 所有功能从代码实现中验证 |
| Architecture | HIGH | 架构模式从代码结构和适配器模式中推导 |
| Pitfalls | MEDIUM | 部分基于 beta SDK 的一般性风险推断 |

## Gaps to Address

- SDK 版本 1.0.0b10 的完整 API 文档未验证（beta 阶段文档可能不完整）
- `azd ai agent` 扩展的具体部署流程未在代码中完整体现
- code-interpreter-custom 项目使用不同的 SDK 模式（`azure-ai-projects` 而非 AgentServer），需确认其部署路径
