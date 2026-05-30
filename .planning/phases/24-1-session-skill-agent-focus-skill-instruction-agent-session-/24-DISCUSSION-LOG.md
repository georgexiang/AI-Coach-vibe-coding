# Phase 24: 用户评估模块重构 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 24-1-session-skill-agent-focus-skill-instruction-agent-session-
**Areas discussed:** Session 级 Instruction 注入机制, Skill Focus 指令设计, Azure CU 语音评估集成, 文本内容评估方式, 多模式评估策略

---

## Session 级 Instruction 注入机制

| Option | Description | Selected |
|--------|-------------|----------|
| Thread 级 additional_instructions | 创建 thread 时传入，仅影响当前 thread | ✓ |
| Run 级 additional_instructions | 每次 create_run 时传入，仅影响当次 run | |
| System Message 注入 | thread 开始时插入 system role message | |

**User's choice:** Thread 级 additional_instructions
**Notes:** 选择 Thread 绑定运行时隔离 + DB 快照审计。内容来源为 Skill SOP 全文 + Focus 约束。

---

## Skill Focus 指令设计

| Option | Description | Selected |
|--------|-------------|----------|
| 温和引导回 SOP | Agent 简短确认后引导回当前 SOP | |
| 硬性阻断 | 直接表示专注 XX 主题，不回应离题 | |
| 分级处理 | 轻微偏离温和引导，完全无关硬性阻断 | ✓ |

**User's choice:** 分级处理

| Option | Description | Selected |
|--------|-------------|----------|
| 不需要，由 Agent 自行判断 | Agent 根据对话自行判断当前步骤 | |
| 需要，动态更新进度 | 后端跟踪进度，每次 run 注入步骤提示 | ✓ |
| 仅作为建议，不强制 | SOP 步骤顺序作为参考 | |

**User's choice:** 需要，动态更新进度

| Option | Description | Selected |
|--------|-------------|----------|
| LLM 分析对话历史判断 | 每次消息后 LLM 分析确定当前步骤 | ✓ |
| Key Message 交付状态推断 | 根据已交付 key messages 推断进度 | |
| Agent 自报告 + 后端记录 | Agent 在回复中标记当前步骤 | |

**User's choice:** LLM 分析对话历史判断

---

## Azure CU 语音评估集成

| Option | Description | Selected |
|--------|-------------|----------|
| Custom Analyzer + 评分 Prompt | 自定义 CU Analyzer，定义评分维度和输出格式 | ✓ |
| Speech Assessment API | Azure Speech 发音评分 + CU 语义分析组合 | |
| CU Audio Analyzer (prebuilt) | 预建 audio analyzer | |

**User's choice:** Custom Analyzer + 评分 Prompt
**Notes:** 用户已有评价维度，需转化为 CU Custom Analyzer 的 fieldSchema

| Option | Description | Selected |
|--------|-------------|----------|
| 从 ScoringRubric 动态读取 | Rubric 中 category='voice' 维度作为 CU 评估维度 | ✓ |
| 从 Skill SOP Assessment Criteria 读取 | 每个 Skill 定义自己的语音评估标准 | |
| 两者结合 | Rubric 基础 + Skill 叠加 | |

**User's choice:** 从 ScoringRubric 动态读取

| Option | Description | Selected |
|--------|-------------|----------|
| 每次 session 结束时动态生成 | 实时构建 analyzer | |
| Rubric 保存时预创建 Analyzer | 管理员保存 Rubric 时同步创建 CU Analyzer | ✓ |
| 不用 Custom Analyzer，直接用 Prompt | ad-hoc analyze 接口 | |

**User's choice:** Rubric 保存时预创建 Analyzer

---

## 文本内容评估方式

| Option | Description | Selected |
|--------|-------------|----------|
| 文本也走 CU | 统一走 CU 评估文本+语音 | ✓ |
| 保持现有 LLM 评分 + CU 仅用于语音 | 双通道并行 | |
| 全部走 CU（音频+转录文本一起传） | CU 内部转录并评估 | |

**User's choice:** 文本也走 CU（完全替代现有 LLM scoring_engine）

| Option | Description | Selected |
|--------|-------------|----------|
| 音频文件 + 对话 Transcript JSON | 同时传入录音和对话记录 | |
| 仅音频（CU 自行转录+评分） | 只传音频 | |
| 分开两次调用 | 内容评分传 transcript，语音评分传音频 | ✓ |

**User's choice:** 分开两次调用

| Option | Description | Selected |
|--------|-------------|----------|
| 统一 Rubric 权重合并 | 所有维度按各自 weight 合并 | |
| 分层合并（内容总分 + 语音总分 → 加权综合） | 先各自算总分，再按大类权重合并 | ✓ |
| 独立展示不合并 | 两个独立 radar chart | |

**User's choice:** 分层合并

| Option | Description | Selected |
|--------|-------------|----------|
| 在 ScoringRubric 中配置 | 扩展 Rubric 新增 content_weight/voice_weight | ✓ |
| 在 Scenario 级别配置 | 每个 Scenario 配不同权重 | |
| 全局配置 | 系统级统一权重 | |

**User's choice:** 在 ScoringRubric 中配置

---

## 多模式评估策略

| Option | Description | Selected |
|--------|-------------|----------|
| 语音转文本后双评 | STT 转录后内容评估用 transcript，语音评估用音频 | ✓ |
| 语音 session 仅评语音维度 | 不做内容评估 | |
| CU 自带转录能力一体化处理 | CU 内部完成转录+评估 | |

**User's choice:** 语音转文本后双评
**Notes:** 文本内容覆盖率是核心指标，key messages 是否完整传递必须评估

| Option | Description | Selected |
|--------|-------------|----------|
| 复用会话中已有的 transcript | Voice Live 实时转录 | |
| 用 CU 重新转录音频 | 会话结束后 CU 高质量转录 | ✓ |
| 两者取优 | 优先已有，质量不足再用 CU | |

**User's choice:** 用 CU 重新转录音频（保证评估质量一致性）

---

## Claude's Discretion

- CU Custom Analyzer 的具体 fieldSchema 定义
- SOP 进度判断 LLM prompt 的具体设计
- Focus 指令的具体措辞模板
- DB focus_instruction 快照存储格式
- 旧 scoring_engine 代码废弃策略

## Deferred Ideas

None — discussion stayed within phase scope
