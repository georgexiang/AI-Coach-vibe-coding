# Azure Content Understanding (CU) — 使用前置说明书

> 本目录包含 Azure AI Content Understanding 服务的架构理解、API 规范、认证模型、Portal 访问方式、以及与 AI Coach 平台的集成决策。
>
> **阅读顺序**：按编号从 01 到 06 依次阅读，每层知识建立在前一层之上。

## 文档索引

| 编号 | 文档 | 内容 | 适用人群 |
|------|------|------|---------|
| 01 | [CU 服务概述与架构](./01-service-overview.md) | 什么是 Content Understanding、与 AI Coach 的集成架构、双 Analyzer 设计 | 全体开发 |
| 02 | [REST API 规范](./02-rest-api-specification.md) | API 端点格式、版本（GA vs Preview）、Analyzer CRUD、Submit-Poll 模式 | 后端开发 |
| 03 | [认证与授权](./03-authentication.md) | Entra ID vs API Key、DefaultAzureCredential 优先级、Header 格式 | 后端开发 |
| 04 | [Analyzer Schema 设计](./04-analyzer-schema.md) | Content/Voice Analyzer 的 fieldSchema 结构、命名规范、base analyzer | 后端开发 |
| 05 | [Portal 访问方式](./05-portal-access.md) | 经典 Foundry vs 新版 Foundry、专用 CU Portal、URL 格式、限制说明 | 全体开发 |
| 06 | [AI Coach 集成实现](./06-ai-coach-integration.md) | sync_rubric_analyzers 流程、评分管道、分数合并、配置要求 | 项目开发 |

## 测试文件索引

| 文件 | 内容 |
|------|------|
| [test_cu_analyzer_crud.py](./tests/test_cu_analyzer_crud.py) | Analyzer 创建/更新/列表 API 测试 |
| [test_cu_scoring_pipeline.py](./tests/test_cu_scoring_pipeline.py) | 内容评分 + 语音评分完整管道测试 |
| [cu-analyzer-api.http](./tests/cu-analyzer-api.http) | VS Code REST Client 测试：Analyzer CRUD + 评分提交 |

## 核心结论速查（2026-05-16 实测验证）

1. **Content Understanding 仅在经典 Foundry 门户中可见** — 新版 Foundry（nextgen）左侧导航无此选项
2. **经典 Foundry Portal URL** = `https://ai.azure.com/resource/contentunderstanding/analyzer-list?wsid={ARM_PATH}&tid={TENANT_ID}`
3. **专用 CU Portal** = `https://contentunderstanding.ai.azure.com/build?tab=analyzerList&tenantId={TENANT_ID}`
4. **⚠️ GA 和 Preview API 的 Analyzer 存储完全隔离** — GA 创建的 Analyzer 在 Preview API 中不可见，反之亦然（已实测验证）
5. **Portal 使用 Preview API** — 经典 Foundry Portal 和专用 CU Portal 均使用 `2025-05-01-preview`
6. **当前后端使用 Preview API** (`2025-05-01-preview`) — 确保 Portal 可见性
7. **认证优先** = Entra ID (DefaultAzureCredential) > API Key (Ocp-Apim-Subscription-Key)
8. **API Key 认证可能被禁用** — `ai-foundary-hu-sweden-central2` 资源已禁用 Key-based auth，必须用 Entra ID
9. **Analyzer 命名** = `rubricContent{id8}` / `rubricVoice{id8}`（不含连字符）
10. **Base Analyzer 名称差异** — Preview: `prebuilt-documentAnalyzer` / `prebuilt-audioAnalyzer`；GA: `prebuilt-document` / `prebuilt-audio`
11. **提交格式差异** — Preview: `{"data": "<base64>"}`；GA: `{"inputs": [{"base64Source": "<base64>"}]}`
12. **Preview API 允许连字符 ID** — GA 文档说不支持，但 Preview API 实测接受 `test-hyphen` 格式（仍建议用纯字母数字）
13. **专用 CU Portal 需绑定正确资源** — 需在 Portal 中创建 project 并连接到 `ai-foundary-hu-sweden-central2` 资源才能看到 Analyzer
14. **Preview API 将于 2026-06-30 退役** — 响应头 `azure-deprecating` 提示需迁移到 GA（见 https://aka.ms/cu-ga-migrate）

## 关键限制

| 限制 | 说明 |
|------|------|
| Portal 显示 | CU 只在经典 Foundry 中可见，新版 Foundry 无此功能 |
| **API 版本隔离** | GA (`2025-11-01`) 和 Preview (`2025-05-01-preview`) 创建的 Analyzer **完全不互通**（已验证） |
| Analyzer ID | 仅支持字母数字，不支持连字符 |
| 资源归属 | Analyzer 绑定到特定 Cognitive Services 资源，非项目级 |
| 认证限制 | 部分资源禁用 API Key，仅支持 Entra ID |

## 外部参考文档

- [Create CU tasks in Foundry (classic)](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/how-to/content-understanding-foundry-classic?tabs=standard) — 微软官方教程
- [Content Understanding REST API](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/quickstart/use-rest-api) — API 快速入门
- [Service Limits](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/service-limits) — 限制说明
- [Analyzer Templates](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/concepts/analyzer-templates) — 预设模板

## 已验证事项（2026-05-16）

- [x] 通过 GA API 创建的 Analyzer 是否在经典 Portal 中可见 → **❌ 不可见**（Portal 用 Preview API，存储隔离）
- [x] 通过 Preview API 创建的 Analyzer 是否在 GA API 中可查询 → **❌ 不可查**（双向隔离已确认）
- [x] `contentunderstanding.ai.azure.com` 专用门户是否需要特定注册 → **需要创建 project 并绑定正确资源**（不需要额外注册，但必须连接到同一个 Cognitive Services 资源）
- [x] 配置正确的 CU endpoint 后，`sync_rubric_analyzers` 能否成功创建 → **✅ 成功**（已用 GA API 创建 8 个 analyzer；改用 Preview API 后也正常）

## 后续 TODO（需持续关注）

- [ ] **提交 Azure Support Ticket**：向 Azure CU 产品组确认 GA/Preview API 存储隔离是否为已知设计，以及 Portal 何时支持 GA API 创建的 Analyzer。需确认产品组 roadmap。
- [ ] **切换回 GA API**（⚠️ 截止 2026-06-30）：一旦 Portal 支持 GA analyzer 可见性，将后端 `CU_API_VERSION` 从 `2025-05-01-preview` 切回 `2025-11-01`，同时 base analyzer 名称从 `prebuilt-documentAnalyzer`/`prebuilt-audioAnalyzer` 改回 `prebuilt-document`/`prebuilt-audio`。Preview API 将于 2026-06-30 退役，此迁移为强制。
- [x] ~~**专用 CU Portal 绑定**~~：不再需要。后端已使用 Preview API，经典 Foundry Portal 直接可见 Analyzer，无需额外绑定专用 Portal。
- [x] ~~**清理 GA API 遗留 Analyzer**~~：已于 2026-05-16 通过 GA API 删除全部 8 个遗留 analyzer（rubricContent*/rubricVoice*），验证清理完毕。
