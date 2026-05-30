# 05 — CU 评分上下文问题分析

> 深入分析 Azure Content Understanding 评分路径的系统性缺陷：缺乏 Scenario 上下文导致评分失准。

---

## 1. 问题概述

**现象:** Session `6ed6b7d6` 中 MR 几乎没有讨论产品，4 条 key messages 全部 NOT DELIVERED，但总分 76.25 → 合格。

**根因:** CU analyzer 只收到对话文本（transcript），不知道 MR 的任务目标、产品信息、评判标准。

---

## 2. CU 评分标准是否与 Rubric 同步？

### 已同步的内容

| 信息 | 是否传给 CU | 途径 |
|------|-------------|------|
| 维度名称 (key_message, communication...) | ✅ | fieldSchema field name |
| 维度权重 | ✅ | description 中 "(weight: 30%)" |
| 维度 criteria 文本 | ✅ | description 中 "Criteria: ..." |

### 未同步的内容 (关键缺失)

| 信息 | 是否传给 CU | 影响 |
|------|-------------|------|
| 产品名 (Zanubrutinib / BRUKINSA) | ❌ | CU 不知道 MR 该讨论什么 |
| 具体 Key Messages 内容 | ❌ | CU 不知道哪些信息必须传达 |
| Key Messages 覆盖状态 (DELIVERED/NOT) | ❌ | CU 不知道 MR 实际完成度 |
| HCP Profile (人格、专业、异议) | ❌ | CU 无法评估"异议处理"是否得当 |
| Scenario 治疗领域 | ❌ | CU 无法判断内容相关性 |
| 合格标准 (pass_threshold=70) | ❌ | CU 无参考基准 |
| 谁是被评估对象 (MR vs HCP) | ❌ | CU 把 HCP 回复也算入评价 |

### 结论

**这不是"同步 bug"，而是"架构设计缺陷"。**

CU analyzer 的 fieldSchema description 是在 rubric 创建时生成的**静态模板**，只有维度名和 criteria 文本。它无法包含每个 session 独特的 scenario 信息（产品、key messages、HCP profile）。

### 根本限制

- CU analyzer 的 field description **有 512 字符限制**（Azure 服务限制）
- CU 的输入只能是一个"文档"（transcript），没有"system prompt"或"context metadata"机制
- CU 不是 LLM，不能理解复杂的评估上下文指令

---

## 3. 各维度问题复盘

以 Session `6ed6b7d6` 为例，MR 实际发言:
1. "你好，我们可以开始培训了。"
2. "开始呀。"
3. "What is recording?"
4. "最贵没有那种。"

HCP (assistant) 发言:
- 列出了产品讨论框架（适应症、证据、CNS数据...）
- 解释了 MR 不清楚的话

### key_message: 85 分 ❌

| CU 的评价 | 实际情况 |
|-----------|---------|
| "The assistant provided a clear structure for product introduction" | 这是 **HCP** 在引导，不是 MR 在传递 |
| 打 85 分 | 4 条 key messages 全部 NOT DELIVERED，应该 < 20 分 |

**问题:** CU 把 HCP 的结构化引导当作"对话中出现了 key message 相关内容"。

### objection_handling: 70 分 ❌

| CU 的评价 | 实际情况 |
|-----------|---------|
| "assistant acknowledged user's unclear statement" | MR 没有面对任何产品异议 |
| 打 70 分 | 对话中没有出现异议场景，应该为 N/A 或 0 |

**问题:** CU 把"HCP 解读模糊消息"误认为"异议处理"。

### communication: 80 分 ❌

| CU 的评价 | 实际情况 |
|-----------|---------|
| "maintained professional tone, adapted to user's language" | MR 说"What is recording?"和乱语 |
| 打 80 分 | MR 沟通完全不专业，应该 < 30 |

**问题:** CU 评估了整体对话的"专业度"，HCP 的专业回复抬高了分数。

### product_knowledge: 75 分 ❌

| CU 的评价 | 实际情况 |
|-----------|---------|
| "assistant outlined key areas for product discussion" | 这是 **HCP** 在展示知识框架 |
| 打 75 分 | MR 没有展示任何产品知识，应该 0 |

**问题:** CU 完全混淆了 MR 和 HCP 的表现。

### scientific_info: 60 分 ⚠️

| CU 的评价 | 实际情况 |
|-----------|---------|
| "assistant mentioned clinical trials and CNS data" | 又是 HCP 的内容 |
| 打 60 分 | MR 没有引用任何科学数据，应该 0 |

**问题:** 同上，唯一"相对合理"的是这个维度分数最低。

---

## 4. 系统性问题总结

### 问题1: CU 无法区分评估对象

CU 看到的是一整段对话文本。它的 description 说 "evaluate how the MR responded" 但 CU 作为文档分析器，**不理解 role 的语义**。当 HCP (assistant) 表现出专业性时，CU 将其计入"对话质量"。

### 问题2: CU 没有"目标导向"评估能力

LLM 评分 prompt 明确说"Key Messages Status: [NOT DELIVERED] xxx"，LLM 理解这意味着 MR 没完成任务。CU 没有这个上下文，它只能基于文本内容本身判断"是否涉及相关话题"。

### 问题3: CU 给高分的默认倾向

当输入模糊或难以判断时，CU 倾向给中高分 (60-85) 而非低分。这是 AI 生成模型的常见行为 — 不确定时给"安全"的中间值。

### 问题4: 无底线硬约束

无论 key messages 覆盖率是多少，都没有"如果覆盖率=0%则最高分不超过X"的硬性逻辑。

---

## 5. CU vs LLM 评分对比

| 能力 | CU 评分 | LLM 评分 |
|------|---------|----------|
| 维度结构化输出 | ✅ 原生支持 | ✅ JSON format |
| Scenario 上下文 | ❌ 只有 transcript | ✅ 完整 prompt |
| Key Message 状态感知 | ❌ | ✅ 明确标注 DELIVERED/NOT |
| HCP Profile 理解 | ❌ | ✅ |
| MR vs HCP 角色区分 | ❌ 混淆 | ⚠️ 理论上能区分 |
| 产品相关性判断 | ❌ | ✅ |
| 可解释性 | ⚠️ 无中间推理 | ✅ 可要求引用原文 |
| 成本 | 💰 低 | 💰💰 高 |
| 延迟 | ⚡ 快 (2-10s) | 🐢 慢 (5-30s) |
| 一致性/确定性 | ⚠️ 不确定 | ⚠️ temp=0.3 有变化 |

---

## 6. CU 中间结果查看方式

### 当前状态: 无处查看

- `_poll_result()` 只提取 `fields` 字段返回，**原始 JSON 未记录**
- 没有 admin API 或 debug 页面展示 CU 原始返回
- Azure Portal 也不保存历史 analyze 结果

### 可查看 CU 配置的途径

| 方法 | 能看到什么 |
|------|-----------|
| Azure CU Portal | Analyzer 定义 (fieldSchema), 但不保存历史评分 |
| CU REST API GET | `GET /analyzers/{id}` → analyzer schema 定义 |
| 代码日志 (DEBUG) | 仅有 "Submitting content scoring to CU analyzer" 级别 |
| ScoreDetail 数据库 | 最终解析后的分数，非原始 CU 返回 |

### 建议: 增加 debug 记录

应在 `_poll_result()` 成功后，将原始 CU 返回 JSON 记录到:
1. 日志 (DEBUG level)
2. 数据库 (新增 `raw_cu_response` 字段或独立表)
3. Admin API (debug endpoint)

---

## 7. 对比: LLM 评分为什么更准？

LLM 评分 prompt 明确包含:

```
## Key Messages to Deliver
- Superior ORR (78.3% vs 62.5%) vs ibrutinib in ALPINE trial
- Lower atrial fibrillation rate (2.5% vs 10.1%) vs ibrutinib
- ...

## Key Message Delivery Status
- [NOT DELIVERED] Superior ORR...
- [NOT DELIVERED] Lower atrial fibrillation...
- [NOT DELIVERED] Proven efficacy across...
- [NOT DELIVERED] Patient support program...

## Instructions
Score each dimension from 0-100 based on the ACTUAL conversation content.
Reference actual quotes from the MR's responses in strengths/weaknesses.
```

LLM 能看到"全部 NOT DELIVERED"并据此给低分。CU 永远看不到这些信息。
