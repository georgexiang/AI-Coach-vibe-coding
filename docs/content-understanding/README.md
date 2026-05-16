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

## 核心结论速查（2026-05 实测验证）

1. **Content Understanding 仅在经典 Foundry 门户中可见** — 新版 Foundry（nextgen）左侧导航无此选项
2. **经典 Foundry Portal URL** = `https://ai.azure.com/resource/contentunderstanding/analyzer-list?wsid={ARM_PATH}&tid={TENANT_ID}`
3. **专用 CU Portal** = `https://contentunderstanding.ai.azure.com/build?tab=analyzerList&tenantId={TENANT_ID}`
4. **GA API 版本** = `2025-11-01`，经典 Foundry Portal 使用 `2025-05-01-preview`
5. **认证优先** = Entra ID (DefaultAzureCredential) > API Key (Ocp-Apim-Subscription-Key)
6. **Analyzer 命名** = `rubricContent{id8}` / `rubricVoice{id8}`（不含连字符）
7. **通过 REST API 创建的 Analyzer 可能不在 Portal 中显示** — 需确认 API 版本兼容性和资源归属

## 关键限制

| 限制 | 说明 |
|------|------|
| Portal 显示 | CU 只在经典 Foundry 中可见，新版 Foundry 无此功能 |
| API 版本 | GA (`2025-11-01`) 和 Preview (`2025-05-01-preview`) 可能创建的 Analyzer 不互通 |
| Analyzer ID | 仅支持字母数字，不支持连字符 |
| 资源归属 | Analyzer 绑定到特定 Cognitive Services 资源，非项目级 |

## 外部参考文档

- [Create CU tasks in Foundry (classic)](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/how-to/content-understanding-foundry-classic?tabs=standard) — 微软官方教程
- [Content Understanding REST API](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/quickstart/use-rest-api) — API 快速入门
- [Service Limits](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/service-limits) — 限制说明
- [Analyzer Templates](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/concepts/analyzer-templates) — 预设模板

## 待验证事项

- [ ] 通过 GA API 创建的 Analyzer 是否在经典 Portal 中可见
- [ ] 通过 Preview API 创建的 Analyzer 是否在 GA API 中可查询
- [ ] `contentunderstanding.ai.azure.com` 专用门户是否需要特定注册
- [ ] 配置正确的 CU endpoint 后，`sync_rubric_analyzers` 能否成功创建
