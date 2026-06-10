# Session Scoring Rubric 与 SkillHub Assessment Rubric 分析

## 背景

在 Scenario 编辑页中，Scenario 关联了一个 Scoring Rubric，例如：

- 客户问题管理
- 客户期望管理
- 客户运营管理痛点分析
- 客户显性需求挖掘
- 客户隐性需求挖掘

但部分新 Scenario 的最终打分结果中出现了另一组维度：

- `sop_completeness`
- `assessment_coverage`
- `knowledge_accuracy`
- `difficulty_calibration`
- `conversation_logic`
- `executability`

这些维度并不是 Scenario 里选择的 Scoring Rubric 维度。

## 当前代码实际流程

当前 session scoring 是“Scenario Scoring Rubric + SkillHub Skill Assessment Rubric”结合使用。

1. Scenario 关联的 Scoring Rubric 是主配置。
   - 后端从 `scenario.rubric_id` 读取 `scoring_rubrics.dimensions`。
   - 这些维度进入 LLM prompt 的 `## Scoring Dimensions and Weights`。
   - 设计意图上，最终 score detail 的维度应该来自这里。

2. Scenario 关联的 Skill 也会参与评分 prompt。
   - 如果 Scenario 关联了 Skill，后端会从 Skill 内容中提取 `## Assessment Rubric` section。
   - 这段内容被放进 prompt 的 `## Skill-Specific Assessment Criteria`。
   - prompt 文案是：`Use these criteria as additional guidance when scoring each dimension`。

3. 后端没有强制校验 LLM 返回维度必须等于 Scenario Scoring Rubric。
   - `score_with_llm()` 会读取 LLM 返回的 `dimensions`。
   - 如果维度名匹配 Scenario rubric，后端会修正 weight。
   - 如果维度名不匹配，当前代码仍然会继续保存。
   - 因此 LLM 如果返回了 SkillHub 质量评估维度，后端也会写入 `score_details`。

## 旧 Scenario 正常、新 Scenario 异常的原因

旧 Scenario 正常，不代表当前逻辑没有问题，而是因为旧 Scenario 关联的 Skill 内容没有污染评分维度。

旧 seed Skill 的 `## Assessment Rubric` 通常是业务维度，例如：

- 关键信息传递
- 异议处理
- 产品知识
- 沟通技巧

这类内容和 session performance scoring 更接近，所以 LLM 更容易按 Scenario Scoring Rubric 输出正常维度。

新的 Scenario 很可能关联了 Skill Creator / SkillHub 新生成的 Skill。新的 Skill Creator 模板中，`## Assessment Rubric` 示例和规则包含 Skill 质量评估维度：

- `sop_completeness`
- `knowledge_accuracy`
- `conversation_logic`
- `assessment_coverage`
- `difficulty_calibration`
- `executability`

这些本来用于评估“Skill/SOP 设计质量”，不是用于评估“MR 在训练 session 中的表现”。当这段内容被注入 session scoring prompt 后，LLM 可能被带偏，直接返回这些维度。

## 相关代码位置

主要涉及以下代码：

- `backend/app/services/scoring_service.py`
  - `resolve_rubric_dimensions()`：读取 Scenario 关联的 Scoring Rubric。
  - `_extract_skill_criteria()`：从 Skill 内容中提取 `## Assessment Rubric`。
  - `score_session()`：把 rubric dimensions 和 skill criteria 一起传给 LLM scoring。

- `backend/app/services/scoring_engine.py`
  - `build_scoring_prompt()`：组装 prompt。
  - `score_with_llm()`：调用 LLM，并保存其返回的 dimensions。
  - 当前只按 Scenario rubric 修正匹配维度的 weight，没有拒绝额外维度。

- `backend/app/services/meta_skill_templates/skill-creator/SKILL.md`
- `backend/app/services/meta_skill_templates/skill-creator/SKILL_zh.md`
  - Skill Creator 模板中包含 Skill 质量评估维度。

- `backend/app/services/skill_evaluation_service.py`
  - 明确说明 Skill Evaluation 是评估 Skill content quality，独立于 Scoring Rubrics。

## 历史提交线索

关键历史提交：

- `c1e036e add model component`
  - 引入从 Skill 中提取 `## Assessment Rubric` 并注入 session scoring prompt 的逻辑。

- `15d1421 feat: refactor Skill Creator & Evaluator to directory-based skill pattern`
  - 引入 Skill Creator / Skill Evaluator 模板及 6 个 Skill 质量评估维度。

因此，这不是近期 upload limit 或 duplicate scoring fix 引入的问题；它是旧的 SkillHub 与 session scoring 融合逻辑中存在的边界问题，在新生成 Skill 上更容易触发。

## 正确产品语义

推荐语义应当是：

1. Scenario Scoring Rubric 决定最终打分维度和权重。
2. SkillHub Skill 的 `## Assessment Rubric` 只能作为补充评分依据。
3. Skill 的 assessment rubric 不能产生新的 session score dimensions。
4. 最终写入 `score_details.dimension` 的维度必须严格来自 `scenario.rubric_id` 对应的 rubric。

## 建议修复方向

建议在 backend scoring 层做硬约束：

1. Prompt 层明确要求：
   - LLM 必须只返回 `## Scoring Dimensions and Weights` 中列出的维度。
   - `Skill-Specific Assessment Criteria` 只能作为每个维度评分时的参考，不能新增或替换维度。

2. 后端解析层增加白名单校验：
   - 构建 `allowed_dimensions = {dim["name"] for dim in rubric_dimensions}`。
   - 丢弃或拒绝 LLM 返回的非 allowed dimensions。
   - 如果缺少某个 required rubric dimension，应报错重试或生成安全失败，而不是保存错误维度。

3. 总分计算只基于 Scenario rubric 维度：
   - weight 必须来自 Scenario Scoring Rubric。
   - 不允许使用 LLM 自己返回的未知 weight。

4. 后续可考虑修复 Skill Creator 模板：
   - Skill quality dimensions 应保留在 Skill Evaluator 中。
   - Skill `## Assessment Rubric` 更适合生成业务训练评分点，而不是 `sop_completeness` 这类质量门禁维度。

## 额外注意：Skill 版本一致性

当前 session 创建时会记录 `skill_version_id`，但 scoring 里读取的是 `scenario.skill` 当前 Skill 内容，而不是 pinned `SkillVersion.content`。

这可能导致：

- 训练时使用的是某个已发布版本；
- 打分时读取的是 Skill 当前内容；
- 如果 Skill 后续被编辑或重新发布，打分依据可能和训练时不一致。

更稳妥的设计是 session scoring 使用 session/scenario 绑定的 pinned `skill_version_id` 内容，保证训练和打分依据一致。
