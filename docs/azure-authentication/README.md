# Azure 认证统一架构 — AI Coach 平台实现指南

> 本目录包含 AI Coach 平台中 Azure 服务认证的架构设计、实现细节、测试用例和最佳实践。
>
> **阅读顺序**：按编号从 01 到 05 依次阅读，每层知识建立在前一层之上。

## 文档索引

| 编号 | 文档 | 内容 | 适用人群 |
|------|------|------|---------|
| 01 | [认证策略与架构](./01-authentication-strategy.md) | AAD-first + Key-fallback 策略、设计动机、架构图 | 全体开发 |
| 02 | [集中认证模块实现](./02-centralized-auth-module.md) | `azure_auth.py` 完整实现、API 设计、使用方法 | 后端开发 |
| 03 | [服务集成指南](./03-service-integration-guide.md) | 各服务如何调用认证模块、重构前后对比 | 后端开发 |
| 04 | [认证决策树](./04-authentication-decision-tree.md) | 新增 Azure 服务时的认证方式选择指南 | 架构师 / Agent |
| 05 | [测试与验证](./05-testing-and-verification.md) | 单元测试、集成测试、故障排查 | 开发/验证 |
| -- | [tests/](./tests/) | 测试代码和验证脚本 | 开发/验证 |

## 核心原则

```
┌─────────────────────────────────────────────────────────────┐
│                    认证优先级策略                              │
├─────────────────────────────────────────────────────────────┤
│  1. DefaultAzureCredential (AAD Token)                      │
│     ├── 本地开发: az login                                   │
│     ├── Azure VM: Managed Identity                          │
│     └── CI/CD: Service Principal (env vars)                 │
│                                                             │
│  2. API Key Fallback (仅当 AAD 不可用时)                     │
│     └── 从 config_service (管理面板) 读取                    │
└─────────────────────────────────────────────────────────────┘
```

## 核心结论速查（2026-05-20 重构验证）

1. **单一入口** — 所有 Azure 服务认证必须通过 `app.services.azure_auth` 模块
2. **AAD 优先** — DefaultAzureCredential 是第一选择，API Key 是 fallback
3. **credential 缓存** — 使用 TTL 单例模式避免重复初始化
4. **错误时降级** — AAD 失败不应阻止服务启动，自动降级到 Key
5. **统一接口** — `get_azure_openai_client()` / `get_auth_headers()` / `get_bearer_token()` 三个函数覆盖所有场景
6. **零配置本地开发** — 只要 `az login` 过，无需任何 API Key 即可运行

## 适用的 Azure 服务

| 服务 | 调用方式 | 使用的认证函数 |
|------|----------|---------------|
| Azure OpenAI (Chat/Scoring) | SDK Client | `get_azure_openai_client()` |
| Azure Content Understanding | REST API | `get_auth_headers()` |
| Azure Speech (TTS/STT) | SDK | `get_bearer_token()` |
| Azure AI Avatar | REST API | `get_auth_headers()` |
| Azure AI Agent Service | SDK Client | `get_azure_openai_client()` |

## 快速参考

```python
# 推荐用法 — 创建 Azure OpenAI 客户端
from app.services.azure_auth import get_azure_openai_client

client = await get_azure_openai_client(
    endpoint="https://your-resource.openai.azure.com",
    api_key="fallback-key-from-config",  # 仅当 AAD 不可用时使用
)

# 推荐用法 — REST API 调用
from app.services.azure_auth import get_auth_headers

headers = await get_auth_headers(api_key="fallback-key")
# headers = {"Authorization": "Bearer <AAD-token>", ...}
# 或 headers = {"Ocp-Apim-Subscription-Key": "<key>", ...}
```

## 与 microsoft-agent-framework 文档的关系

本目录聚焦于 **平台实现层面** 的认证架构——即代码中如何统一管理认证。
关于 Azure 认证模型的 **概念理解**（API Key vs Entra ID 的区别、RBAC 角色等），
请参考 [`docs/microsoft-agent-framework/01-azure-authentication-model.md`](../microsoft-agent-framework/01-azure-authentication-model.md)。
