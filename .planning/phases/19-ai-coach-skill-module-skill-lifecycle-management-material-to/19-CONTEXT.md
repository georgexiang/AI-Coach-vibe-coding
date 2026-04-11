# Phase 19: AI Coach Skill Module - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

构建 AI Coach Skill 模块，实现 Skill 全生命周期管理（创建、编辑、发布、归档）。用户可上传培训材料（文档、PPT等），系统自动将其转换为结构化的 SKILL.md 格式培训技能包（含 SOP、考核内容、知识点）。Skill Hub 集中展示所有可用 Skill。管理员可将 Skill 关联到 Scenario，训练过程中 HCP Agent 依据 Skill SOP 内容与 MR 用户交互。

本阶段不包含 Dry Run 模拟测试（Phase 20）。

</domain>

<decisions>
## Implementation Decisions

### SOP 结构格式
- **D-01:** SOP 内容格式对齐 agentskills.io 的 SKILL.md 规范 — YAML frontmatter (name, description) + Markdown body (Coaching Protocol)。数据库存储 Skill content (Markdown body)，导出时生成标准 SKILL.md 文件
- **D-02:** 每个 SOP 步骤包含完整字段集：标题、描述、要点提示(key_points)、常见异议(objections)、考核标准(assessment_criteria)、知识点(knowledge_points)、时间建议(suggested_duration)。这些字段在 Markdown body 内用结构化的 Coaching Protocol 格式组织
- **D-03:** 材料转 Skill 采用异步转换 + 实时状态轮询 — 上传后异步处理，前端轮询状态 (pending→processing→completed/failed)，大文件不卡 UI
- **D-04:** SOP 支持双轨编辑模式 — Admin 可手动编辑 SOP 内容，也可通过 AI 反馈式修改（输入修改意见，AI 根据意见重新生成）

### 质量门控交互
- **D-05:** L1 结构检查在 SOP 生成后自动触发（即时规则引擎），L2 AI 质量评估由 Admin 手动触发（异步处理）
- **D-06:** L2 六维度评分用雷达图 + 详情卡片展示 — 复用已有评分组件模式（类似 Scoring Rubrics 展示），每个维度可展开查看详细评价和改进建议
- **D-07:** 发布门控：L1 必须 PASS + L2 >= 50 分方可发布。50-69 分显示警告弹窗：展示低分维度及改进建议，Admin 可选"仍然发布"或"返回修改"。<50 分阻止发布

### Skill Hub 与管理 UI
- **D-08:** Skill Hub 列表页采用卡片网格布局 — 类似 Scenario 选择页风格，每张卡片展示名称、产品、状态徽章、质量评分、标签
- **D-09:** Skill 作为独立管理模块，与 Scenario 通过关联关系连接 — Admin 在 Scenario 编辑时可选择关联一个 Skill
- **D-10:** Skill Hub 是纯 Admin 功能 — MR 用户不直接接触 Skill 模块，MR 只通过选择 Scenario 间接使用 Skill。不需要 MR 用户视图

### Skill 分配与 SOP 驱动
- **D-11:** Skill 与 Scenario 为一对一关联 — 一个 Scenario 关联一个 Skill，训练时 Agent 按该 Skill 的 SOP 执行。后期可扩展为多对多
- **D-12:** 训练时 Skill content（Markdown body）注入到 Agent 的 system prompt/instructions 中 — 复用现有 prompt_builder.py 模式，参考 azure_foundary_hosted_agents-main 的 SkillManager.compose_instructions() 方法
- **D-13:** Skill 导入/导出采用 ZIP 包格式，包含 SKILL.md + 关联材料文件 — 与 agentskills.io 规范兼容

### L2 质量评估与 Scoring Rubrics 的关系
- **D-14:** L2 质量评估（Skill 内容质量）与 Scoring Rubrics（MR 训练表现评分）是独立的两个系统。L2 评的是"Skill 设计得好不好"（六维度：SOP完整性/考核覆盖度/知识准确性/难度合理性/对话逻辑性/可执行性），Scoring Rubrics 评的是"MR 做得好不好"

### Claude's Discretion
- SOP 步骤层级的自适应策略（根据材料复杂度决定两层/扁平结构）
- Skill 编辑器的具体 UI 组件选择
- L1 结构检查的具体规则集
- Skill 卡片的信息密度和布局细节
- ZIP 包的内部目录结构

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent Framework Skill 模式（核心参考）
- `azure_foundary_hosted_agents-main/agent-framework/agent-with-skills/skill_manager.py` — SkillManager 实现：Skill 加载、解析、compose_instructions() 方法
- `azure_foundary_hosted_agents-main/agent-framework/agent-with-skills/main.py` — Agent 创建流程：Skill 加载 → instructions 组合 → Agent 初始化
- `azure_foundary_hosted_agents-main/agent-framework/agent-with-skills/skills/azure-ai-fundamentals-coaching/SKILL.md` — Coaching Skill 范例：YAML frontmatter + Coaching Protocol 格式

### 已有模型和服务（复用模式）
- `backend/app/models/material.py` — TrainingMaterial/MaterialVersion 模型，Skill 的材料关联基础
- `backend/app/services/material_service.py` — 材料上传模式：upload_material() 异步文件处理
- `backend/app/services/agent_sync_service.py` — Agent 同步服务，Skill 注入 Agent instructions 的集成点
- `backend/app/services/prompt_builder.py` — Prompt 构建，Skill SOP 内容注入位置
- `backend/app/models/scoring_rubric.py` — ScoringRubric 模型，L2 评估可参考的维度存储模式
- `backend/app/services/scoring_engine.py` — 评分引擎，L2 AI 评估的 prompt 构造可参考
- `backend/app/models/scenario.py` — Scenario 模型，需新增 skill_id 外键

### 前端模式参考
- `frontend/src/pages/admin/scenarios.tsx` — 卡片网格布局模式，Skill Hub 可参考
- `frontend/src/pages/admin/training-materials.tsx` — 材料上传页面，Skill 材料上传可复用
- `frontend/src/pages/admin/hcp-profile-editor.tsx` — Admin 编辑器模式，Skill 编辑器可参考

### Phase 19 研究
- `.planning/phases/19-ai-coach-skill-module-skill-lifecycle-management-material-to/19-RESEARCH.md` — 技术研究：数据模型、架构模式、依赖库

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TrainingMaterial` 模型 + `material_service.py` — 文件上传/版本管理模式可直接复用
- `prompt_builder.py` — Skill SOP 内容注入 Agent instructions 的集成点
- `scoring_engine.py` — L2 AI 评估的 prompt 构造模式可参考
- `ScoringRubric` 模型 — 维度/权重存储的 JSON 字段模式可参考
- Scenario 卡片页面 — Skill Hub 卡片布局可复用
- react-dropzone — 材料拖放上传已有
- react-hook-form + zod — 表单验证已有

### Established Patterns
- 所有模型使用 TimestampMixin（UUID id + created_at + updated_at）
- 服务层用 async def + db.flush()
- Pydantic v2 schemas with ConfigDict(from_attributes=True)
- TanStack Query hooks per domain
- i18n namespace per module (skill.json)
- Alembic migration with server_default for SQLite compatibility

### Integration Points
- `Scenario` 模型需新增 `skill_id` 外键（可选，nullable）
- `agent_sync_service.py` 需扩展：同步 Agent 时包含关联 Skill 的 SOP content
- `prompt_builder.py` 需扩展：训练时将 Skill content 拼入 system prompt
- Admin 侧边栏导航需新增 "Skill Hub" 入口
- 路由需新增 `/admin/skills`, `/admin/skills/:id/edit`

</code_context>

<specifics>
## Specific Ideas

- 参考 `azure_foundary_hosted_agents-main/agent-framework/agent-with-skills/` 的 SKILL.md 规范和 SkillManager 实现
- Skill 内容的 Coaching Protocol 格式参考 `skills/azure-ai-fundamentals-coaching/SKILL.md` — 包含 Capabilities、Protocol Steps、Assessment Rubric 等结构
- AI 反馈式修改：Admin 输入修改意见后 AI 重新生成 SOP，类似 ChatGPT 对话式优化的交互模式
- L2 六维度评估的展示风格与现有 Scoring Rubrics 评分展示保持视觉一致性

</specifics>

<deferred>
## Deferred Ideas

- Dry Run 模拟测试（AI 扮演 MR+HCP 自动对话验证 SOP 可执行性）— Phase 20
- Skill 多对多关联 Scenario — 后期扩展
- MR 用户 Skill Hub 浏览视图 — 当前不需要，MR 通过 Scenario 间接使用
- Skill 版本对比/diff 功能 — 后期增强
- 客户预览链接与反馈收集 — 待评估是否纳入本阶段

</deferred>

---

*Phase: 19-ai-coach-skill-module-skill-lifecycle-management-material-to*
*Context gathered: 2026-04-11*
