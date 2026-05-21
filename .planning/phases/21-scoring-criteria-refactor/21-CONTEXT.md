# Phase 21: Scoring Criteria Refactor — 评分标准模块重构，动态维度驱动 - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

重构 MR 会话评分（Session Scoring）的硬编码 5 维度系统，使 ScoringRubric 成为评分的唯一权威来源（Single Source of Truth）。管理员可自由定义评分维度名称/数量/权重/评分标准，所有评分流程（LLM 评分、Mock 评分、前端展示）统一从 Rubric 动态读取。

**不在范围内：** Dry Run Scoring（SOP 覆盖度评分）和 Skill Quality Evaluation（Skill 内容质量评分）保持不变——它们评估的是完全不同的东西。

</domain>

<decisions>
## Implementation Decisions

### D-01: 重构范围 — 仅 Session Scoring
- 只重构 MR 会话评分的 5 个硬编码维度 → Rubric 动态
- Dry Run Scoring（`dry_run_engine.py`）和 Skill Quality Evaluation（`skill_evaluation_service.py`）不受影响
- Skill 的 `## Assessment Rubric` 自由文本注入 LLM prompt 的机制保留不变

### D-02: Skill 叠加模式 — 自定义评分标准在 Rubric 中添加
- 管理员可以在 ScoringRubric 中基于默认维度添加自定义维度（如"临床数据引用准确性"）
- 不同 Skill/Scenario 可以关联不同的 Rubric，实现不同 Skill 有不同评分标准
- Skill markdown 中的 `## Assessment Rubric` 继续作为 LLM 的额外评分指导文本

### D-03: 维度完全自由
- 管理员可以自由添加/删除/编辑 Rubric 中的任何维度，包括默认的 5 个
- 无锁定维度，最大灵活性
- Rubric 的 `dimensions` JSON 格式保持现有：`[{name, weight, criteria[], max_score}]`
- 权重总和必须等于 100（现有 schema 校验已支持）

### D-04: 数据迁移 — 删除旧列
- Alembic 迁移将现有 Scenario 的 5 个 `weight_*` 列数据转换为 Rubric 记录
- 为每个现有 Scenario 自动创建对应的 Rubric（保留原有权重配置）
- 添加 `rubric_id` FK 到 Scenario 模型
- 迁移后删除旧的 `weight_key_message`、`weight_objection_handling`、`weight_communication`、`weight_product_knowledge`、`weight_scientific_info` 列
- 删除 `get_scoring_weights()` 方法

### D-05: 强制关联 Rubric
- 每个 Scenario 必须关联一个 Rubric（`rubric_id` NOT NULL）
- 迁移时自动为现有 Scenario 创建 Rubric 并关联
- 新建 Scenario 时必须选择或创建 Rubric
- 不再需要 `get_default_rubric()` 回退机制（但可保留为新建 Scenario 时的默认推荐）

### D-06: 评分 Prompt 完全动态化
- 删除 `scoring_engine.py` 中的 `dim_names` 硬编码字典
- 删除 Instructions 中对 5 个具体维度的描述（key_message、objection_handling 等）
- 维度名称、权重、评分指南全部从 Rubric 的 `dimensions` JSON 动态生成
- Rubric 的 `criteria[]` 字段直接注入为每个维度的评分指导

### D-07: 前端 ScoringWeights 组件完全动态化
- 删除 `WEIGHT_KEYS` 硬编码数组和 `I18N_KEYS` 映射
- ScoringWeights 调用 Rubric API 获取维度列表，动态生成滑块
- Scenario Editor 中选择 Rubric 后显示对应维度的权重配置
- 现有 Rubric 管理页 `/admin/scoring-rubrics` 继续作为独立的 Rubric CRUD 入口

### D-08: Mock 评分生成器动态化
- `_generate_mock_scores()` 不再硬编码 5 个维度块
- 从 Rubric 的 dimensions 动态生成任意数量的维度评分
- 每个维度的 mock 分数、strengths、weaknesses、suggestions 基于通用模板动态生成

### Claude's Discretion
- Alembic migration 的具体实现细节（batch mode for SQLite etc.）
- Mock 评分生成器中通用 strengths/weaknesses 文案模板设计
- Rubric 选择 UI 在 Scenario Editor 中的具体交互设计（下拉框 vs 弹窗）
- 前端 i18n 处理（自定义维度名称是否需要 i18n）
- 测试结构和 mock 数据模式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 评分引擎（Session Scoring）
- `backend/app/services/scoring_engine.py` — LLM 评分 prompt 构建，dim_names 硬编码位置
- `backend/app/services/scoring_service.py` — 评分编排，mock 生成器，rubric 权重解析逻辑
- `backend/app/services/rubric_service.py` — Rubric CRUD，get_default_rubric()

### 数据模型
- `backend/app/models/scenario.py` — Scenario 模型，5个 weight_* 列，get_scoring_weights()
- `backend/app/models/scoring_rubric.py` — ScoringRubric 模型，JSON dimensions
- `backend/app/schemas/scoring_rubric.py` — Rubric Pydantic schemas，权重校验
- `backend/app/schemas/scenario.py` — Scenario schemas（需要移除 weight 字段，添加 rubric_id）

### 前端评分组件
- `frontend/src/components/admin/scoring-weights.tsx` — 硬编码 WEIGHT_KEYS，需重构为动态
- `frontend/src/components/scoring/radar-chart.tsx` — 已动态（接收 ScorePoint[]）
- `frontend/src/components/scoring/dimension-bars.tsx` — 已动态（接收 ScoreDetail[]）
- `frontend/src/components/scoring/feedback-card.tsx` — 评分反馈卡片
- `frontend/src/pages/admin/scoring-rubrics.tsx` — Rubric 管理页

### Skill 评分集成
- `backend/app/services/scoring_service.py:235` — `_extract_skill_criteria()` 函数（保持不变）

### 迁移
- `backend/alembic/versions/16f9f0ba6e9d_add_scoring_rubrics_table.py` — 现有 Rubric 迁移

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScoringRubric` model: 已存在，`dimensions` JSON 格式 `[{name, weight, criteria[], max_score}]` 已支持动态维度
- `rubric_service.py`: CRUD 已完整（create/get/list/update/delete）
- `RadarChart` + `DimensionBars`: 已接收动态数据（`ScorePoint[]` / `ScoreDetail[]`），无需大改
- `/admin/scoring-rubrics` 页面: Rubric 管理 UI 已存在
- Rubric schema 校验: `DimensionConfig` 已校验权重总和 = 100

### Established Patterns
- Service layer: 业务逻辑在 `services/*.py`，router 只做 HTTP
- Pydantic v2: `ConfigDict(from_attributes=True)`，field validators
- Alembic: batch operations for SQLite (Gotcha #1)
- TanStack Query hooks per domain

### Integration Points
- `scoring_service.py:69-77` — 当前 rubric vs scenario weights 解析逻辑，需改为强制 rubric
- `scoring_engine.py:103-113` — `dim_names` 字典和 dimensions_config 生成，需改为动态
- `scoring_service.py:298-440` — Mock 评分的 5 个硬编码维度块
- `scenario.py:52-60` — `get_scoring_weights()` 和 5 个 weight_* 列
- Scenario Editor (`frontend/src/components/admin/scenario-editor.tsx`) — 需要添加 Rubric 选择器

</code_context>

<specifics>
## Specific Ideas

- 不同 Skill 可以关联不同的 Rubric，实现"同一场景用不同 Skill 时评分标准不同"的需求
- HCP 对评分的影响仅通过 LLM prompt 上下文，无需数值修改器
- 4 种评分场景完全独立：Session Scoring（本次重构）、Dry Run（SOP 覆盖度）、Skill Criteria Injection（文本注入）、Skill Quality Eval（内容质量）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-scoring-criteria-refactor*
*Context gathered: 2026-04-27*
