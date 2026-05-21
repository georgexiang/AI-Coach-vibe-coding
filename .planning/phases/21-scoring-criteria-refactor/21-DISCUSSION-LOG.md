# Phase 21: Scoring Criteria Refactor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 21-scoring-criteria-refactor
**Areas discussed:** 重构范围, Skill评分设计, 维度自由度, 数据迁移, 前端组件, 回退策略, Prompt动态化

---

## 重构范围

| Option | Description | Selected |
|--------|-------------|----------|
| 仅 Session Scoring (推荐) | 只重构 MR 会话评分的5个硬编码维度。Dry Run 和 Skill Quality 保持不变。 | ✓ |
| Session + Skill评分整合 | Session Scoring 动态化 + Skill 的 Assessment Rubric 可以直接定义评分维度 | |
| 全部统一 | 所有评分场景都用统一的 Rubric 系统 | |

**User's choice:** 仅 Session Scoring
**Notes:** Dry Run 和 Skill Quality 保持不变，它们评的是不同的东西。

---

## Skill 评分设计

**User's input (free text):** "用户可以根据不同的skill，以默认的评分机制作为基础上，可以添加自己定义的打分标准"

**Clarification:** 自定义维度在 ScoringRubric 中添加，不是在 Skill 中。不同 Scenario/Skill 关联不同的 Rubric。

| Option | Description | Selected |
|--------|-------------|----------|
| 叠加模式 | 默认 Rubric 维度保持 + 额外添加自定义维度，权重自动归一化到100% | ✓ |
| 覆盖模式 | Skill 定义了评分标准时完全替换默认 Rubric | |
| 混合模式 | 保留部分 + 替换部分 + 新增 | |

**User's choice:** 叠加模式（在 Rubric 中实现，非 Skill 中）

---

## 维度自由度

| Option | Description | Selected |
|--------|-------------|----------|
| 默认维度可编辑不可删除 | 可调整权重和标准，不能删除默认5个 | |
| 完全自由 | 管理员可自由添加/删除/编辑任何维度 | ✓ |
| 锁定默认，只加不改 | 默认5个完全锁定，只能增加额外维度 | |

**User's choice:** 完全自由
**Notes:** 最大灵活度，管理员完全控制

---

## 数据迁移策略

| Option | Description | Selected |
|--------|-------------|----------|
| 迁移后删除旧列 (推荐) | 转换为 Rubric 后删除 weight_* 列，干净彻底 | ✓ |
| 保留旧列作为回退 | 添加 rubric_id 但保留旧列，无 Rubric 时回退 | |

**User's choice:** 迁移后删除旧列

---

## 前端 ScoringWeights 组件

| Option | Description | Selected |
|--------|-------------|----------|
| 从 Rubric API 动态渲染 | 调用 Rubric API 获取维度，动态生成滑块，不再硬编码 | ✓ |
| 保持现有 + 新增入口 | 默认5个滑块保持，增加"添加自定义维度"按钮 | |

**User's choice:** 从 Rubric API 动态渲染

---

## 回退策略

| Option | Description | Selected |
|--------|-------------|----------|
| 强制关联 (推荐) | 每个 Scenario 必须关联 Rubric，迁移时自动创建 | ✓ |
| 默认 Rubric 回退 | 无 rubric_id 时使用对应 mode 的默认 Rubric | |

**User's choice:** 强制关联

---

## Prompt 动态化程度

| Option | Description | Selected |
|--------|-------------|----------|
| 完全动态 | 维度名称/权重/评分指南全部从 Rubric 读取，删除硬编码 | ✓ |
| 半动态 | 名称和权重动态，保留通用评分指导文本 | |

**User's choice:** 完全动态

---

## Claude's Discretion

- Alembic migration 具体实现细节
- Mock 评分生成器的通用 strengths/weaknesses 模板
- Rubric 选择 UI 交互细节
- i18n 处理方式
- 测试结构

## Deferred Ideas

None
