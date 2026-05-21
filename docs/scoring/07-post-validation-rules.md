# 07 — 评分后置校验规则 (Post-Validation Rules)

> 2026-05-20 实施。解决 LLM 评分引擎不严格遵守 prompt 规则的问题。
> 代码位置: `backend/app/services/scoring_engine.py` → `_enforce_scoring_rules()`

---

## 1. 问题背景

### 根因分析

在一次 session 测试中（ID: `c38895af-7b0d-44c7-9a9d-8697ec961512`），发现：

- **Scenario:** F2F: BRUKINSA CLL/SLL Discussion (百悦泽学术讨论)
- **Key Messages:** 4 条 ALPINE 试验数据，全部 NOT DELIVERED
- **MR 实际对话内容:** 纯闲聊（"帮你调养身体"、日语"いざ大阪まで"、"治标不治本"）
- **期望分数:** key_message < 30，所有维度 < 50
- **实际分数:** key_message=70, communication=75, product_knowledge=60, scientific_info=55

### 两个核心 Bug

| Bug | 描述 | 原因 |
|-----|------|------|
| 角色混淆 | LLM 评价 HCP (assistant) 而非 MR (user) 的表现 | Prompt 中 "MR:"/"HCP:" 标签不够醒目；LLM 默认关注 assistant 回复质量 |
| 规则不遵守 | Prompt 明确写了 "key_message MUST < 30" 等规则但 LLM 忽略 | 规则埋在 prompt 开头，被大量 context 稀释；LLM 倾向于"找亮点给分" |

---

## 2. 修复方案 (方案A: Prompt 强化 + 后置校验)

### 2.1 Prompt 强化

**Transcript 角色标签强化:**

```
旧: MR: {content}    / HCP: {content}
新: >>> MR (EVALUATE THIS PERSON) <<<: {content}
    >>> HCP (DO NOT EVALUATE) <<<: {content}
```

**关键规则位置调整:**

- 旧: 规则在 prompt 第 28-29 行（开头部分，容易被后续内容稀释）
- 新: 规则移到 prompt 末尾 `## CRITICAL SCORING RULES (MUST FOLLOW)` 段落，紧接在 JSON 输出格式之前

**末尾 Reminder 行:**

```
REMINDER: Scores MUST reflect MR (role=user) performance ONLY.
Every quote must come from MR messages marked with '>>> MR' above.
```

### 2.2 后置校验逻辑 (`_enforce_scoring_rules`)

作为 **程序化 safety net**，在 LLM 返回评分 JSON 后、计算 overall_score 之前执行。

```python
def _enforce_scoring_rules(dimensions, key_messages_status, messages) -> list[dict]:
```

#### 规则 1: Key Message 未交付硬约束

```
条件: key_messages_status 中所有条目 delivered = false
动作: key_message 维度分数 cap 到 max 30
```

**逻辑依据:** 如果 MR 完全没有传递任何关键信息，key_message 维度不可能得高分。这是最基本的业务规则。

#### 规则 2: 内容无关性检测

```
条件: 规则 1 触发 (全部未交付) + MR 消息总字符数 < 100
动作: 所有维度分数 cap 到 max 50 (key_message 已被规则1 cap 到 30，保持不变)
```

**逻辑依据:** 如果 MR 全部 key messages 未交付，且 MR 发言内容极短（通常是闲聊、无关回复），说明 MR 完全没有进行有意义的医药讨论。

#### 阈值说明

| 参数 | 值 | 选择依据 |
|------|-----|----------|
| key_message cap | 30 | Prompt 规则已声明 "MUST be below 30"，后置校验强制执行 |
| all dims cap | 50 | Prompt 规则已声明 "ALL scores MUST be below 50 when unrelated" |
| MR total chars threshold | 100 字符 | 低于此值表明 MR 基本只回复了"好"、"了"等无意义内容 |

---

## 3. 触发条件和不触发条件

### 会触发后置校验 cap 的情况

| 情况 | key_message | 其他维度 |
|------|-------------|----------|
| 4/4 key messages NOT DELIVERED + MR 只说"好"、"了" | → cap 30 | → cap 50 |
| 3/3 key messages NOT DELIVERED + MR 说日语/无关话题 (总<100字) | → cap 30 | → cap 50 |
| 2/2 key messages NOT DELIVERED + MR 说了一些内容但都不相关 (总>100字) | → cap 30 | 不 cap (LLM 自行判断) |

### 不会触发的情况

| 情况 | 原因 |
|------|------|
| 至少 1 条 key message DELIVERED | 不满足 "全部未交付" 条件 |
| Key messages 全未交付但 MR 有大段发言 (>100字) | 只 cap key_message，不 cap 其他维度（MR 可能讨论了相关内容但没命中关键词） |
| 没有 key_messages_status 数据 | 直接跳过，不应用任何 cap |

---

## 4. 为什么选择方案A而非方案B

| 方面 | 方案A (Prompt强化+后置校验) | 方案B (两阶段评分) |
|------|---------------------------|-------------------|
| 复杂度 | 低 — 单文件修改 | 高 — 需要两次 LLM 调用 |
| 成本 | 无额外 API 成本 | 多一次 LLM relevance 判断调用 |
| 效果 | 硬约束保底 + prompt 改善 | 更精准但实现复杂 |
| 风险 | 极低 — 后置校验只在明确条件下触发 | 中等 — relevance 判断本身可能出错 |

**结论:** 方案A 用最小改动解决核心问题。后置校验作为 safety net 能 100% 保证在极端情况下分数合理。Prompt 强化改善了 LLM 的一般表现。如果未来仍有边界情况逃逸，可在此基础上加入方案B 的 relevance 预检。

---

## 5. 测试覆盖

12 个单元测试覆盖所有边界情况:

```
tests/test_scoring_engine_postvalidation.py

TestEnforceScoringRules:
  - test_caps_key_message_when_all_undelivered_and_score_above_30
  - test_no_change_when_key_message_already_below_30
  - test_no_capping_when_some_key_messages_delivered
  - test_caps_all_dimensions_when_undelivered_and_short_mr_content
  - test_only_key_message_capped_when_undelivered_but_substantive
  - test_no_capping_when_empty_key_messages_status

TestBuildScoringPromptRoleLabels:
  - test_prompt_contains_strong_mr_role_label
  - test_prompt_contains_strong_hcp_role_label
  - test_critical_rules_near_end_of_prompt
  - test_critical_rules_before_json_format
  - test_reminder_line_before_json

TestScoreWithLlmPostValidation:
  - test_score_with_llm_caps_scores_when_all_undelivered
```

---

## 6. 后续改进方向

如果后续发现后置校验仍有漏网情况，可以考虑：

1. **语义相关性预检 (方案B):** 用简短 LLM 调用判断 MR 内容是否与 therapeutic area 相关
2. **调整 MR 字符阈值:** 当前 100 字可能需要根据实际数据微调
3. **增加最少有效对话轮数门槛:** < 3 轮有效交互不应评分
4. **Key Message 语义检测升级:** 从关键词匹配改为 LLM 语义匹配
