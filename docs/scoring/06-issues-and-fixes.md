# 06 — 已确认问题与修复方向

> 基于 2026-05-18 的分析，列出已确认的 Bug、设计缺陷、修复优先级和改进方案。

---

## 1. 已确认问题清单

| # | 问题 | 性质 | 严重度 | 状态 |
|---|------|------|--------|------|
| S-01 | CU 评分缺乏 scenario 上下文，打分严重失准 | 架构设计缺陷 | 🔴 Critical | Open |
| S-02 | CU 无法区分 MR/HCP 表现，把 HCP 回复算入 MR 评分 | 架构设计缺陷 | 🔴 Critical | Open |
| S-03 | 降级链 CU→LLM→Mock，应改为 CU 必须成功否则报错 | Bug | 🟠 High | Open |
| S-04 | Mock 评分基线过高 (base=65)，几乎任何情况都合格 | Bug | 🟠 High | Open |
| S-05 | Key Message 全 NOT DELIVERED 不作为硬性约束 | 缺失功能 | 🟠 High | Open |
| S-06 | CU 中间结果无记录、无 debug 界面 | 缺失功能 | 🟡 Medium | Open |
| S-07 | 无"内容相关性"校验，MR 说无关话题仍可得分 | 缺失功能 | 🟡 Medium | Open |
| S-08 | Key Message 检测仅用关键词匹配，准确度有限 | 已知限制 | 🟡 Medium | Accepted |

---

## 2. 各问题详细分析

### S-01: CU 评分缺乏 scenario 上下文

**根因:** CU analyzer fieldSchema description 只包含维度名和 criteria，不包含:
- 产品名、治疗领域
- Key messages 具体内容
- HCP Profile 信息
- 合格标准

**限制:** CU field description 有 512 字符限制，且无 "system prompt" 机制。

**影响:** CU 只能基于文本形式判断"看起来是否像好的医药对话"，无法判断内容是否与特定产品/任务相关。

---

### S-02: MR/HCP 角色混淆

**根因:** CU 输入的 transcript JSON 虽然有 `role` 字段，但 CU 作为文档分析器不理解"只评估 role=user 的表现"的语义。

**实际表现:**
- HCP 列出产品讨论框架 → CU 认为"对话涉及 key messages"
- HCP 专业回复 → CU 认为"沟通质量好"
- HCP 展示知识 → CU 认为"产品知识丰富"

**影响:** HCP 越专业，MR 分数越高（完全反向激励）。

---

### S-03: 降级链应改为严格模式

**当前行为:**
```
CU 失败 → 尝试 LLM → LLM 失败 → Mock (随机高分)
```

**期望行为:**
```
CU 失败 → 返回错误信息给前端，告知用户评分服务不可用
```

**代码位置:** `scoring_service.py:111-130`

---

### S-04: Mock 基线分过高

**当前逻辑:**
```python
base_score = 65 + int(delivery_ratio * 25)
# delivery_ratio = 0 → base = 65
# 各维度: base ± random(-8, +10) = 57~75
# 加权后通常 > 70 → 合格
```

**影响:** 即使完全没有内容，Mock 也给出合格分数，误导用户。

---

### S-05: Key Message 无硬性约束

**当前行为:** `key_messages_status` 只是记录性质的数据，不影响最终分数计算。

**期望行为:** 应有逻辑:
```python
delivery_ratio = delivered_count / total_key_messages
if delivery_ratio < 0.25:
    # key_message 维度上限 30 分
    # 或直接判定不合格
```

---

### S-06: CU 中间结果无记录

**当前行为:** `_poll_result()` 提取 fields 后丢弃原始 response。

**期望行为:** 保存原始 CU 返回 JSON 用于 debug/audit。

---

## 3. 修复优先级排序

### P0 — 立即修复 (评分完全不可信)

| 任务 | 说明 |
|------|------|
| 移除 Mock fallback | 评分失败应报错，不应返回虚假分数 |
| 增加 key message 硬约束 | delivery_ratio < 25% → 限制分数或判定不合格 |

### P1 — 短期修复 (1-2 周)

| 任务 | 说明 |
|------|------|
| CU transcript 增加 metadata | 在 transcript JSON 头部加入 scenario context |
| 或改用 LLM 作为主评分引擎 | LLM 有完整上下文，评分准确度远高于 CU |
| 增加内容相关性预检 | 评分前检查 MR 消息是否包含产品/领域相关内容 |

### P2 — 中期改进 (4-6 周)

| 任务 | 说明 |
|------|------|
| CU 结果存储 + debug API | 保存原始 CU 返回，增加 admin debug 界面 |
| 角色区分评分 | 只评估 role=user 的内容，忽略 assistant |
| 最低消息数门槛 | < 3 轮有效对话不应评分 |
| Key Message 检测升级 | 从关键词匹配升级为 LLM-based 语义检测 |

---

## 4. 修复方案对比

### 方案 A: 增强 CU 输入

在 transcript JSON 中嵌入 metadata header:

```json
{
  "metadata": {
    "product": "Zanubrutinib (BRUKINSA)",
    "therapeutic_area": "Hematology/Oncology",
    "key_messages": ["Superior ORR...", "Lower AF rate..."],
    "key_messages_delivered": 0,
    "key_messages_total": 4,
    "evaluate_role": "user",
    "hcp_name": "Dr. Wang",
    "pass_threshold": 70
  },
  "transcript": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

**优点:** 保持 CU 作为主引擎
**缺点:** CU 对 metadata 的理解程度不确定；description 512 字符限制仍在

### 方案 B: LLM 作为主引擎，CU 为辅

```
评分主路径: LLM (有完整 context)
CU 作为: 结构化验证/补充维度 (voice quality)
```

**优点:** LLM prompt 可嵌入任意上下文，评分更准确
**缺点:** 成本更高、延迟更长

### 方案 C: 混合方案

```
1. Key Message 硬性检测 (代码逻辑，非 AI)
2. 内容相关性预检 (简单 LLM 调用)
3. 通过检测后 → CU 细粒度评分
4. 未通过 → 直接判定低分，不需要 CU
```

**优点:** 成本可控、解决核心问题
**缺点:** 实现复杂度较高

---

## 5. 建议的最终架构

```
评分触发
  │
  ├── 前置校验 (代码逻辑, 无 AI)
  │    ├── 消息数 >= 3? 否 → 拒绝评分
  │    ├── MR 消息与产品相关? 否 → 极低分
  │    └── Key Message delivery_ratio? < 25% → key_message 维度 cap 30 分
  │
  ├── CU 内容评分 (增强版)
  │    ├── transcript 增加 metadata (产品、key messages、role 区分指令)
  │    └── CU 失败 → 报错，不降级
  │
  ├── (可选) LLM 交叉验证
  │    └── 对 CU 结果做 sanity check
  │
  └── 后置校验 (硬约束)
       ├── key_message 维度 ≤ (delivery_ratio * 100)
       └── 无产品关键词 → 所有维度 cap 50 分
```

---

## 6. 待确认事项

- [ ] CU field description 512 字符限制是否可通过 Azure support 提升？
- [ ] CU 输入格式是否支持 metadata 段（非纯文档内容）？
- [ ] 是否有 CU "few-shot examples" 机制可以指导评分行为？
- [ ] LLM 评分成本预估（按 session 数量）
- [ ] 是否需要保留 CU 路径，还是完全切换到 LLM？
