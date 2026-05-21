# 01 — 认证策略与架构设计

> AI Coach 平台的 Azure 认证核心策略：**AAD Token 优先，API Key 降级**。

---

## 1. 设计动机

### 1.1 问题背景

在 2026-05-20 的重构之前，平台存在认证碎片化问题：

| 服务 | 认证方式 | 问题 |
|------|----------|------|
| `scoring_engine.py` | 仅 API Key | Azure 禁用 Key 后 403 |
| `skill_conversion_service.py` | 仅 API Key | 同上 |
| `skill_creator_service.py` | 仅 API Key | 同上 |
| `skill_focus_service.py` | 仅 API Key | 同上 |
| `connection_tester.py` | 仅 API Key | 同上 |
| `AzureOpenAIAdapter` | 仅 API Key | 同上 |
| `voice_live_websocket.py` | AAD Token ✓ | 已正确 |
| `agent_sync_service.py` | AAD Token ✓ | 已正确 |

**根因**：没有集中的认证模块，每个服务各自实现认证逻辑。

### 1.2 设计目标

1. **单一认证入口** — 所有 Azure 认证逻辑集中在一个模块
2. **AAD 优先** — 符合 Azure 安全最佳实践，支持 RBAC 和审计
3. **无缝降级** — AAD 不可用时自动使用 API Key，不影响服务
4. **零配置本地** — `az login` 后即可运行，无需手动配置 Key
5. **生产就绪** — Managed Identity 自动生效，无需密钥管理

---

## 2. 认证优先级策略

```
┌──────────────────────────────────────────────────────┐
│              DefaultAzureCredential 链                 │
│  (按顺序尝试，第一个成功的方式即为最终认证)              │
├──────────────────────────────────────────────────────┤
│                                                      │
│  1. Environment Variables                            │
│     AZURE_CLIENT_ID + AZURE_CLIENT_SECRET            │
│     + AZURE_TENANT_ID                                │
│     → 适用于 CI/CD、Service Principal                 │
│                                                      │
│  2. Managed Identity                                 │
│     → 适用于 Azure Container Apps / VM               │
│     → 自动获取，无需任何配置                           │
│                                                      │
│  3. Azure CLI (az login)                             │
│     → 适用于本地开发                                  │
│     → 开发者运行 `az login` 后自动生效                 │
│                                                      │
│  4. Azure PowerShell                                 │
│     → 适用于 Windows 开发者                           │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  ❌ 以上全部失败                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                      │
│  5. API Key Fallback (我们的扩展)                     │
│     → 从管理面板 config_service 读取                  │
│     → 仅当 AAD 完全不可用时使用                       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 3. 架构图

### 3.1 调用流程

```
┌─────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│  Service A  │────>│                          │────>│  Azure OpenAI   │
│ (scoring)   │     │   azure_auth.py          │     │                 │
├─────────────┤     │                          │     ├─────────────────┤
│  Service B  │────>│  get_azure_openai_client  │────>│  Azure Speech   │
│ (skills)    │     │  get_auth_headers         │     │                 │
├─────────────┤     │  get_bearer_token         │     ├─────────────────┤
│  Service C  │────>│                          │────>│  Azure CU       │
│ (CU eval)   │     └──────────────────────────┘     │                 │
└─────────────┘              │                        └─────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
              ┌─────▼─────┐    ┌─────▼─────┐
              │   AAD      │    │  API Key   │
              │   Token    │    │  Fallback  │
              │ (primary)  │    │ (backup)   │
              └───────────┘    └───────────┘
```

### 3.2 认证决策时序

```
Service 请求认证
       │
       ▼
get_azure_openai_client(endpoint, api_key)
       │
       ├── 1. try DefaultAzureCredential
       │       │
       │       ├── Success: get_token("https://cognitiveservices.azure.com/.default")
       │       │       │
       │       │       ├── Token OK → 返回 AsyncAzureOpenAI(azure_ad_token=token)
       │       │       │
       │       │       └── Token Fail → goto step 2
       │       │
       │       └── Import Error / Init Error → goto step 2
       │
       ├── 2. if api_key:
       │       └── 返回 AsyncAzureOpenAI(api_key=api_key)
       │
       └── 3. raise RuntimeError("No credentials available")
```

---

## 4. 各环境认证方式

| 环境 | 认证方式 | 配置要求 |
|------|----------|----------|
| 本地开发 | `az login` → DefaultAzureCredential | 只需运行 `az login` |
| Azure Container Apps | Managed Identity → DefaultAzureCredential | 启用 System/User Assigned MI |
| GitHub Actions CI | Service Principal env vars → DefaultAzureCredential | 设置 AZURE_CLIENT_ID/SECRET/TENANT_ID |
| 离线/无网络 | API Key fallback | 管理面板配置 Key |

---

## 5. 安全考量

### 5.1 为什么 AAD 优先？

| 维度 | API Key | AAD Token |
|------|---------|-----------|
| 身份识别 | ❌ 无法区分调用者 | ✓ 精确到 user/service |
| 权限粒度 | 资源级别(全有或全无) | RBAC 角色细粒度控制 |
| 审计追踪 | ❌ 无法追溯 | ✓ Azure Activity Log |
| 密钥管理 | 需要安全存储和轮换 | 自动管理(MI/CLI) |
| 泄露风险 | Key 泄露 = 全部权限 | Token 短期有效(~1h) |

### 5.2 API Key Fallback 的存在意义

- **开发便利**：新开发者加入时，可能未配置 `az login`，Key 允许快速启动
- **离线场景**：某些测试环境无法连接 AAD
- **渐进迁移**：从 Key-only 迁移到 AAD-first 时的过渡机制
- **灾难恢复**：AAD 服务暂时不可用时的降级方案

### 5.3 安全建议

1. 生产环境**禁用** API Key（在 Azure Portal 设置 `disableLocalAuth: true`）
2. 仅在开发/测试环境保留 Key 作为 fallback
3. 定期轮换未禁用的 Key（90 天周期）
4. 使用 Azure Key Vault 存储 Key（不要硬编码在 .env）
