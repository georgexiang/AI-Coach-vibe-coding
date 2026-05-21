# Phase 24: 用户评估模块重构 - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

两大核心改进：
1. **Session 中 Skill Focus** — 在培训 session 过程中，Agent 动态聚焦当前 Skill SOP 内容，通过 session 级 instruction 注入（不修改 Agent 定义），有效性仅限当前培训 session。包括 SOP 进度跟踪和分级偏题处理。
2. **Session 后评估重构** — 统一使用 Azure Content Understanding 评估所有维度（替代现有 LLM scoring_engine）。内容评估走 CU（transcript JSON 输入），语音评估走 CU（音频输入）。分层合并为综合评分。

</domain>

<decisions>
## Implementation Decisions

### Session 级 Instruction 注入机制
- **D-01:** 使用 Azure Foundry Thread 级 `additional_instructions` 注入 Skill Focus 指令。创建 conversation thread 时传入，仅影响当前 thread，Agent 定义不变。
- **D-02:** 注入内容为 Skill SOP 全文 + Focus 约束指令。将完整 Skill SOP 内容放入 additional_instructions，附加"仅围绕此 SOP 内容讨论"的约束。
- **D-03:** Thread ID 绑定保证运行时隔离（新 session = 新 thread），同时在 DB 中记录每个 session 的 `focus_instruction` 快照，便于审计和重放。

### Skill Focus 指令设计
- **D-04:** 分级偏题处理 — 轻微偏离（仍与产品/治疗领域相关）用温和引导回 SOP；完全无关话题（闲聊天气等）用硬性阻断（"我们今天专注于 XX 主题"）。
- **D-05:** 动态 SOP 进度感知 — 后端跟踪当前 SOP 步骤，每次 run 的 additional_instructions 包含"当前应在步骤 X，应引导用户讨论 XX"提示。
- **D-06:** SOP 进度跟踪方式 — 每次用户发消息后，用 LLM 分析对话历史与 SOP 步骤的匹配度，确定当前所在步骤。每次 run 会多一个 LLM 调用判断进度。

### Azure CU 统一评估
- **D-07:** 完全替代现有 LLM scoring_engine.py — 所有评分（内容+语音）统一走 Azure Content Understanding。废弃 scoring_engine 的 LLM 评分 prompt 逻辑。
- **D-08:** 评估维度从 ScoringRubric 动态读取 — 复用 Phase 21 的 Rubric 动态维度系统。Rubric 中同时定义内容维度和语音维度。
- **D-09:** Rubric 保存时预创建 CU Custom Analyzer — 管理员保存 Rubric 时同步创建/更新对应的 CU Analyzer（包含 fieldSchema 和评分 prompt）。Session 结束时直接调用已有 analyzer。
- **D-10:** 分开两次 CU 调用 — 内容评估传 transcript JSON 给 CU content analyzer；语音评估传音频文件给 CU voice analyzer。结果分别返回后合并。

### 评分合并策略
- **D-11:** 分层合并 — 先分别计算内容维度总分和语音维度总分，再按大类权重（如内容 60% + 语音 40%）加权合并为综合分。
- **D-12:** 大类权重在 ScoringRubric 中配置 — 扩展 Rubric 模型新增 `content_weight` 和 `voice_weight` 字段（默认 60:40），管理员可按 Rubric 自定义。

### 多模式评估策略
- **D-13:** 纯文本 session — 仅做内容评估（输入为对话 messages），无语音评估。最终评分仅含内容维度。
- **D-14:** 语音/数字人 session — CU 重新转录音频获得 transcript 用于内容评估，同时音频文件用于语音评估。双维度评分。
- **D-15:** 文本内容覆盖率是核心指标 — 无论何种模式，key messages 是否完整传递都必须评估。语音 session 通过 CU 转录后同样检查内容覆盖完整性。
- **D-16:** 语音转文本统一用 CU 重新转录 — 不依赖会话中的实时 transcript（Voice Live 的实时转录），确保评估质量一致性。

### Claude's Discretion
- CU Custom Analyzer 的具体 fieldSchema 定义
- SOP 进度判断 LLM prompt 的具体设计
- Focus 指令的具体措辞模板
- 分级偏题处理的边界判定逻辑
- DB 中 focus_instruction 快照的存储格式
- CU Analyzer 创建/更新的具体 API 调用实现
- 评分结果延迟展示的 UI 处理（loading 状态）
- 旧 scoring_engine 代码的迁移/废弃策略

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Skill 注入与管理
- `backend/app/services/skill_manager.py` — SkillManager.compose_instructions() 实现，Skill 加载和注入模式
- `backend/app/services/prompt_builder.py` — build_skill_augmented_instructions() 当前 Skill 注入入口
- `backend/app/services/agent_sync_service.py:710-770` — 当前 agent 创建时 Skill 注入流程

### 评分系统（将被重构）
- `backend/app/services/scoring_service.py` — 当前评分编排服务
- `backend/app/services/scoring_engine.py` — LLM 评分 prompt 构建（将被 CU 替代）
- `backend/app/services/voice_scoring_service.py` — 当前语音评分 mock 实现
- `backend/app/models/scoring_rubric.py` — ScoringRubric 模型（动态维度）

### Azure Content Understanding
- `backend/app/services/agents/adapters/azure_content.py` — 现有 CU adapter（文档分析，需扩展为语音/文本评估）

### Session 服务
- `backend/app/services/session_service.py` — Session 生命周期管理
- `backend/app/api/sessions.py:308-329` — 当前音频上传和语音评分触发逻辑
- `backend/app/models/session.py` — Session 模型（voice_score_status 字段）

### Phase 21 评分重构
- `.planning/phases/21-scoring-criteria-refactor/21-CONTEXT.md` — Rubric 作为评分唯一权威来源的决策

### Phase 23 统一会话
- `.planning/phases/23-complete-training-session-with-digital-human-full-implementa/23-CONTEXT.md` — 双维度评分、异步评价、音频存储的决策

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SkillManager.compose_instructions()` — Skill 内容注入 agent instructions 的成熟模式
- `load_skill_for_scenario()` — 从 DB 加载 Scenario 关联 Skill 的逻辑
- `VoiceScoringBackend` Protocol — 可插拔的语音评分后端接口
- `save_voice_score_details()` — 评分结果保存到 ScoreDetail 的模式
- `AzureContentUnderstandingAdapter` — CU REST API 的 submit-then-poll 模式
- `ScoringRubric` model — 已有 `dimensions` JSON 字段支持动态维度

### Established Patterns
- 异步后台任务模式：`trigger_voice_scoring()` 使用独立 DB session 的 durable task
- 可插拔后端 Protocol 模式：`VoiceScoringBackend` Protocol + Factory
- Agent sync with skill: `build_skill_augmented_instructions()` → `SkillManager.compose_instructions()`
- Session 状态机: created → in_progress → completed → scored
- ScoreDetail category 区分: 'content' vs 'voice'

### Integration Points
- Session 创建时：需新增 Thread 创建 + additional_instructions 注入
- 每次用户消息后：需新增 LLM 进度判断 + 更新 run 的 additional_instructions
- Session 结束时：需替换 scoring_engine 调用为两次 CU 调用
- Rubric 保存时：需新增 CU Analyzer 同步创建/更新
- ScoringRubric 模型：需新增 content_weight/voice_weight 字段
- CoachingSession 模型：需新增 focus_instruction 字段

</code_context>

<specifics>
## Specific Ideas

- 文本内容覆盖完整性是最重要的评估指标 — 无论什么模式，key messages 传递情况必须评估
- 语音 session 统一用 CU 重新转录音频（不用实时 transcript），保证评估质量一致
- Agent 定义（Azure Foundry 上的 agent）完全不修改，Skill Focus 指令仅通过 Thread 级 additional_instructions 注入
- SOP 进度是动态的，通过 LLM 分析对话确定当前步骤，agent 回复时已知"当前应在步骤 X"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-1-session-skill-agent-focus-skill-instruction-agent-session-*
*Context gathered: 2026-05-13*
