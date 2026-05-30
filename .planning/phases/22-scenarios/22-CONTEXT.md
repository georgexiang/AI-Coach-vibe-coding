# Phase 22: Scenarios 模块二次重构 - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

对 Scenarios 模块进行二次重构：Editor 全页化、I18N 完整化、元数据改为标签系统、状态机完善、关联关系强化、全局硬编码消除。同时对整个前端进行 I18N 审计和硬编码枚举可配置化。

</domain>

<decisions>
## Implementation Decisions

### D-01: Editor 全页化 — 对齐 HCP Editor 风格
- 废弃当前 Dialog 弹窗编辑模式，改为独立路由全页面编辑器
- 路由：`/admin/scenarios/new` 和 `/admin/scenarios/:id`
- 布局：单页 + Tabs（基本信息 / 关联配置 / 评分规则），左上角返回按钮
- 使用 `useParams` + `useNavigate`，表单保存后返回列表页
- 参考 `frontend/src/pages/admin/hcp-profile-editor.tsx` 的架构

### D-02: I18N 全局审计
- 扫描所有前端页面和组件，找出所有硬编码文本（英文/中文混写）
- 确保 `en-US` 和 `zh-CN` 两套 locale JSON 完整对应，无遗漏
- 消除代码中直接写死的文本（如 "Name *", "Select product", "Configure scenario details"）
- 所有用户可见文本必须通过 `useTranslation` 的 `t()` 函数获取
- 范围：全部前端模块（不仅限 Scenarios），按模块分批执行

### D-03: 元数据 → 标签系统
- 删除 `product` 和 `therapeutic_area` 固定字段
- 替换为 `tags` 标签系统（预定义 + 自定义）
- 管理员可预定义标签分类（如"产品"、"治疗领域"、"场景类型"）
- 用户创建 Scenario 时从预定义标签选择，也可添加自定义标签
- 数据库：Scenario 模型的 product/therapeutic_area 列迁移为 tags JSON 数组或关联表

### D-04: 状态机完善 — draft → active → archived
- 三态线性流转：draft → active → archived
- archived 状态：不可编辑，可查看、可克隆
- 列表页需要支持按状态筛选（包括 archived）
- 归档操作需要确认对话框

### D-05: Skill 关联强化 — 变为必选
- `skill_id` 从 nullable 改为 NOT NULL（必选）
- 版本锁定保持不变（`skill_version_id` 指向 published version）
- Skill 必须处于 published 状态才可关联（archived 不可选）
- 新建 Scenario 时必须选择一个 published 的 Skill
- Alembic 迁移：现有无 skill 的 Scenario 需要处理（可能需要管理员手动补全或设默认值）

### D-06: 全局硬编码消除 — 数据库配置表
- 全局扫描所有模块中的硬编码枚举值（PRODUCTS、THERAPEUTIC_AREAS、SPECIALTIES、difficulty 等）
- 新建数据库表（如 `system_enums` 或 `config_options`）存储可配置枚举
- 管理员通过 Admin UI 维护枚举值（CRUD）
- 前端从 API 动态获取枚举列表，不再硬编码数组
- 后端提供枚举管理 API（按 category 分组）

### D-07: 工作方式约束
- 一个功能做完 → 全部 testcase 覆盖 → E2E Playwright 测试 → 提交代码 → 开始下一个功能
- 不允许跨功能并行开发，严格串行交付

### Claude's Discretion
- Tags 表设计细节（单表 JSON vs 关联表 vs 多态标签）
- 数据库迁移策略（现有 product/therapeutic_area 数据如何转换为 tags）
- 现有无 Skill 关联的 Scenario 的迁移处理策略
- 系统枚举表的具体 schema 设计
- Tab 内的具体字段分组和布局细节
- E2E 测试的具体覆盖场景

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scenario 模块（当前实现）
- `backend/app/models/scenario.py` — Scenario ORM 模型，当前字段结构
- `backend/app/schemas/scenario.py` — Pydantic schemas (Create/Update/Response)
- `backend/app/services/scenario_service.py` — CRUD + skill pin + agent resync 逻辑
- `backend/app/api/scenarios.py` — API 路由
- `frontend/src/pages/admin/scenarios.tsx` — 列表页（需重构为路由跳转）
- `frontend/src/components/admin/scenario-editor.tsx` — 当前 Dialog 编辑器（将废弃）
- `frontend/src/components/admin/scenario-table.tsx` — 表格组件
- `frontend/src/types/scenario.ts` — TypeScript 类型定义
- `frontend/src/hooks/use-scenarios.ts` — TanStack Query hooks
- `frontend/src/api/scenarios.ts` — API 客户端

### 参考实现（全页编辑器模式）
- `frontend/src/pages/admin/hcp-profile-editor.tsx` — HCP 全页编辑器（对标模板）
- `frontend/src/pages/admin/skill-editor.tsx` — Skill 编辑器

### I18N 系统
- `frontend/src/i18n/index.ts` — i18n 配置（命名空间列表）
- `frontend/public/locales/en-US/admin.json` — 英文 admin 翻译
- `frontend/public/locales/zh-CN/admin.json` — 中文 admin 翻译

### 关联实体
- `backend/app/models/scoring_rubric.py` — ScoringRubric 模型
- `backend/app/services/rubric_service.py` — Rubric CRUD
- `backend/app/models/skill.py` — Skill 模型（status: draft/published/archived）
- `frontend/src/hooks/use-rubrics.ts` — Rubric hooks
- `frontend/src/hooks/use-skills.ts` — Skills hooks (usePublishedSkills)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hcp-profile-editor.tsx`: 全页编辑器参考模板（Tabs + Form + useParams）
- `useRubrics` / `usePublishedSkills` hooks: 已有的关联数据获取
- `ObjectionList` 组件: 可复用的列表编辑组件
- `ScenarioTable`: 表格组件（需适配 archived 状态显示）
- i18n HttpBackend + LanguageDetector: 已配置的国际化基础设施

### Established Patterns
- 全页编辑器: `useParams` 获取 ID → `useForm` + `zodResolver` → Tabs 分区 → 保存后 navigate 回列表
- TanStack Query hooks per domain: `use-scenarios.ts`, `use-hcp-profiles.ts`
- 状态筛选: `Select` + query params 模式（已有 draft/active 筛选）
- Alembic batch operations for SQLite (Gotcha #1)

### Integration Points
- Router: 需要注册 `/admin/scenarios/:id` 路由
- Scenario model: 需要 Alembic 迁移（删 product/therapeutic_area, 加 tags, skill_id NOT NULL）
- Admin sidebar: 场景管理链接不变
- 关联查询: `selectinload(Scenario.hcp_profile)` → 可能需要 eager load tags

</code_context>

<specifics>
## Specific Ideas

- Editor 对齐 HCP Profile Editor 的交互风格，保持一致性
- 标签系统用于替代固定字段分类，更灵活
- 全局硬编码扫描应覆盖 `PRODUCTS`, `THERAPEUTIC_AREAS`, `SPECIALTIES`, `DIFFICULTIES` 等所有前端硬编码数组
- 一个功能完整交付（含测试）后再开始下一个，确保质量

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-scenarios*
*Context gathered: 2026-05-06*
