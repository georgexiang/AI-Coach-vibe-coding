# Microsoft AI Foundry — 平台集成说明书

> 本目录包含 Azure AI Foundry 统一端点架构、数据平面 API 行为、模型部署管理，以及 AI Coach 平台的集成实践。
>
> **阅读顺序**：按编号从 01 到 05 依次阅读，每层知识建立在前一层之上。

## 文档索引

| 编号 | 文档 | 内容 | 适用人群 |
|------|------|------|---------|
| 01 | [统一端点架构](./01-unified-endpoint-architecture.md) | `.services.ai.azure.com` 端点结构、三种域名类型、服务路由规则 | 全体开发 |
| 02 | [模型部署管理 API](./02-deployment-management-api.md) | 部署列表 API 路径、数据格式、三级获取策略、实测验证 | 后端开发 |
| 03 | [Azure OpenAI vs AI Foundry API 差异](./03-openai-vs-foundry-api.md) | 数据平面 API 路径差异、兼容性陷阱、迁移注意事项 | 后端开发 |
| 04 | [服务认证与路由](./04-service-auth-and-routing.md) | 多服务共享密钥、Speech/Avatar/CU 路由、认证头差异 | 后端开发 |
| 05 | [AI Coach 模型选择器集成](./05-ai-coach-model-selector.md) | 系统级 ModelSelector 组件设计、后端 API、前端复用方案 | 项目开发 |
| T1 | [部署列表 API 探测测试](./tests/test_foundry_deployments.py) | 实测脚本：三种 API 路径对比 + 响应数据格式验证 | 开发/验证 |

## 核心结论速查（2026-04-12 实测验证）

> 以下结论基于 `azure-ai-projects==2.0.1` + AI Foundry 端点实测。

1. **`/openai/deployments` 在 AI Foundry 上返回 404** — 这是标准 Azure OpenAI 的 API，不适用于 `.services.ai.azure.com` 端点
2. **正确路径：`/api/projects/{project}/deployments?api-version=v1`** — 这是 AI Foundry 数据平面的部署列表 API，使用 API Key 认证
3. **`/openai/models` 返回全量目录（313+ 模型）** — 这是区域可用模型目录，不是用户的部署列表
4. **单个部署可通过 `/openai/deployments/{name}/chat/completions` 验证** — 部署存在返回正常响应，不存在返回 `DeploymentNotFound`
5. **`azure-ai-projects` SDK 2.0.1 的 `DeploymentsOperations.list()` 使用相同路径** — SDK 底层调用 `GET /deployments?api-version=v1`，需要 project-scoped endpoint
6. **三种域名不可互推** — `.services.ai.azure.com`、`.openai.azure.com`、`.cognitiveservices.azure.com` 的 resource name 可能不同

## 与 Agent Framework 文档的关系

```
microsoft-agent-framework/          microsoft-foundry/
├── 01 认证模型                      ├── 01 端点架构 ◄── 本目录
├── 02 Model vs Agent 模式           ├── 02 部署管理 API
├── 03 Agent Identity                ├── 03 OpenAI vs Foundry 差异
├── 04 集成策略                      ├── 04 服务认证与路由
├── 05 Metadata 约束                 └── 05 模型选择器集成
└── 06 Tools & Knowledge

Agent Framework = HOW to use agents (Agent 怎么用)
AI Foundry      = WHERE agents live (Foundry 平台本身的行为)
```
