# 04 — 推荐架构方案

> 基于能力分析和成本对比，推荐的混合评分架构及实施路径。

---

## 1. 推荐架构: LLM Content + CU Voice

```
┌──────────────────────────────────────────────────────────────────┐
│                        评分触发                                    │
│  POST /scoring/sessions/{id}/score                                │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  前置校验 (代码逻辑, 0 cost)                                      │
│                                                                  │
│  1. 消息数 >= 3?  否 → 拒绝评分 ("对话内容不足")                    │
│  2. MR 消息是否包含产品相关词?  否 → 标记 "low_relevance"           │
│  3. Key Message delivery_ratio 计算                               │
│     < 25% → key_message 维度硬性 cap 30 分                        │
└───────────────────────────┬──────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
┌──────────────────────┐     ┌──────────────────────────┐
│  LLM 内容评分         │     │  CU 语音评分 (可选)        │
│  (Azure OpenAI)       │     │  (仅音频 session)          │
│                      │     │                          │
│  Input:              │     │  Input:                  │
│  - System prompt     │     │  - 音频文件 (base64/URL)   │
│  - HCP Profile       │     │                          │
│  - Scenario context  │     │  Analyzer:               │
│  - Key Messages +    │     │  - prebuilt-audioAnalyzer │
│    delivery status   │     │  - fluency/tone/pace/    │
│  - Skill criteria    │     │    pronunciation         │
│  - Transcript        │     │                          │
│  - Dimensions config │     │  Output:                 │
│                      │     │  - 4 维度分数             │
│  Output:             │     │  - 语音反馈              │
│  - 5 维度分数 + 反馈  │     │  - re-transcription      │
│  - MR quote 引用     │     │                          │
│  - feedback_summary  │     │  失败: → 报错，不降级      │
│                      │     │                          │
│  失败: → 报错，不降级  │     │                          │
└──────────┬───────────┘     └──────────┬───────────────┘
           │                            │
           └──────────────┬─────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  后置校验 + 分数合并                                               │
│                                                                  │
│  1. Key message 硬约束:                                           │
│     if delivery_ratio == 0 AND key_message_score > 30:            │
│       → cap to 30                                                │
│                                                                  │
│  2. 内容相关性约束:                                                │
│     if low_relevance flag:                                       │
│       → 所有内容维度 cap 50                                       │
│                                                                  │
│  3. 分数合并:                                                     │
│     - 纯文本: overall = content_total (100%)                      │
│     - 含音频: overall = content * content_weight +                │
│                         voice * voice_weight                     │
│                                                                  │
│  4. 保存: SessionScore + ScoreDetail[]                            │
│     → session.status = "scored"                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. 各引擎职责清晰分工

| 引擎 | 负责评估 | 输入 | 输出 |
|------|---------|------|------|
| **代码逻辑** | 前置校验、硬约束、分数合并 | session data | pass/fail 判定 |
| **LLM (GPT-4o)** | 5 个内容维度评分 | 完整 scenario 上下文 + transcript | JSON scores |
| **CU (audioAnalyzer)** | 4 个语音维度评分 | 音频文件 | JSON scores |

---

## 3. LLM 内容评分 Prompt 设计

### 3.1 System Message

```
You are a pharmaceutical sales training evaluator for BeiGene.
You evaluate ONLY the Medical Representative (MR, role="user") performance.
DO NOT evaluate the HCP (role="assistant") performance.

Key rules:
- If key messages are NOT DELIVERED, key_message score MUST be below 30.
- If MR's messages are unrelated to the product/therapeutic area, ALL scores MUST be below 50.
- Reference actual MR quotes in strengths/weaknesses.
- Be strict: vague or off-topic responses deserve low scores.
```

### 3.2 User Message (动态部分)

```
## HCP Profile
- Name: {name}, Specialty: {specialty}
- Personality: {personality_type}
- Communication Style: {communication_style}/100
- Objections configured: {objections_list}

## Scenario
- Product: {product}
- Therapeutic Area: {therapeutic_area}
- Pass Threshold: {pass_threshold}

## Key Messages to Deliver
{numbered_key_messages}

## Key Message Delivery Status
{delivery_status_with_DELIVERED_or_NOT_DELIVERED}

## Skill-Specific Criteria (if any)
{skill_assessment_rubric_section}

## Conversation Transcript
{transcript_with_role_labels}

## Scoring Dimensions
{dimensions_with_weights_and_criteria}

## Output Format
Return ONLY valid JSON:
{output_schema}
```

### 3.3 与当前 scoring_engine.py 的差异

| 改进点 | 当前 | 推荐 |
|--------|------|------|
| System message 强调角色区分 | 弱 | "ONLY evaluate MR, NOT HCP" |
| Key message 硬约束 | 无 | "NOT DELIVERED → below 30" |
| 内容相关性约束 | 无 | "unrelated → below 50" |
| 严格度要求 | 一般 | "Be strict" |

---

## 4. CU 语音评分保持现有设计

CU 语音评分的当前实现基本正确:

```python
# 保持现有 Voice Analyzer Schema
{
  "fluency":       {"type": "string", "method": "generate", "description": "..."},
  "tone":          {"type": "string", "method": "generate", "description": "..."},
  "pace":          {"type": "string", "method": "generate", "description": "..."},
  "pronunciation": {"type": "string", "method": "generate", "description": "..."},
  "feedback_summary": {"type": "string", "method": "generate", "description": "..."},
  "transcript":    {"type": "string", "method": "generate", "description": "..."}
}
```

**改进点:**
1. 失败不降级到 Mock — 直接报错
2. 增加原始 CU 响应的日志记录
3. 确认 WebM 音频格式是否被 CU 支持（前端录制格式）

---

## 5. 错误处理策略: 不降级

### 当前 (有问题的)

```python
cu_result = await score_session_with_cu(...)
if cu_result:
    scores = cu_result
else:
    scores = await score_with_llm(...)  # fallback 1
    if scores is None:
        scores = _generate_mock_scores(...)  # fallback 2 ← 给虚假合格分
```

### 推荐 (严格模式)

```python
# 内容评分: LLM (必须成功)
content_scores = await score_content_with_llm(...)
if content_scores is None:
    raise AppException(
        status_code=503,
        code="SCORING_UNAVAILABLE",
        message="内容评分服务暂不可用，请稍后重试",
    )

# 语音评分: CU (仅含音频时, 必须成功)
voice_scores = None
if session.audio_url:
    voice_scores = await score_voice_with_cu(...)
    if voice_scores is None:
        raise AppException(
            status_code=503,
            code="VOICE_SCORING_UNAVAILABLE",
            message="语音评分服务暂不可用，请稍后重试",
        )

# 合并 (代码逻辑)
scores = merge_and_apply_constraints(content_scores, voice_scores, ...)
```

---

## 6. 实施路径

### Phase 1: 紧急修复 (1-2 天)

| 任务 | 说明 |
|------|------|
| 移除 Mock fallback | 评分失败 → 503 错误 |
| 增加 key message 硬约束 | delivery_ratio < 25% → cap 30 |
| LLM prompt 增加严格度 | "ONLY evaluate MR", "NOT DELIVERED → below 30" |

### Phase 2: 架构切换 (3-5 天)

| 任务 | 说明 |
|------|------|
| 内容评分改为 LLM 主路径 | 移除 CU content scoring |
| 保留 CU 仅做语音评分 | CU voice analyzer 保持 |
| 增加前置校验逻辑 | 消息数、相关性、delivery_ratio |
| 增加后置硬约束 | 分数 cap 逻辑 |

### Phase 3: 质量提升 (1-2 周)

| 任务 | 说明 |
|------|------|
| LLM prompt 优化 | A/B 测试不同 prompt 版本 |
| 增加 debug/audit 功能 | 保存原始 LLM/CU 响应 |
| 前端显示评分来源 | 标注"AI 内容评分"/"AI 语音评分" |
| 增加评分质量监控 | 标记异常分数模式 |

---

## 7. 迁移注意事项

### 7.1 已存在的 CU Content Analyzer 如何处理

- **不需要立即删除** — CU voice analyzer 仍然需要
- **Rubric 保存时不再同步 content analyzer** — 只同步 voice analyzer
- **现有 `cu_content_analyzer_id` 字段保留** — 标记为 deprecated

### 7.2 向后兼容

- 已评分的 session 不受影响 (分数已存储)
- 新评分请求走新路径
- `ScoreDetail.category` 字段继续使用 "content" / "voice" 区分

### 7.3 配置变更

| 配置 | 当前 | 改后 |
|------|------|------|
| CU endpoint | 内容+语音都需要 | 仅语音需要 |
| Azure OpenAI endpoint | 可选 (fallback) | **必须** (主路径) |
| Azure OpenAI model | 任意 | 推荐 GPT-4o 或 GPT-4.1 |

---

## 8. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| LLM 服务不可用 | 低 | 高 — 无法评分 | Azure OpenAI 高可用 + 重试机制 |
| LLM 评分偶尔不一致 | 中 | 中 — 同一 session 不同时间评分可能有差异 | temperature=0.1 (比当前 0.3 更低) |
| LLM 仍然给高分 | 低 | 中 | 后置硬约束 + prompt 中明确规则 |
| CU 语音服务不可用 | 低 | 中 — 含音频 session 无法评语音 | 允许只出内容分数，语音标记 "pending" |
| 成本超预期 | 低 | 低 — GPT-4o 成本已很低 | 监控 + 可切换到 GPT-4o-mini |

---

## 9. 最终推荐总结

```
┌─────────────────────────────────────────────────┐
│                推荐评分架构                        │
├─────────────────────────────────────────────────┤
│                                                 │
│  内容评分 (5维度, 权重 60-100%)                   │
│  ┌─────────────────────────────────────────┐    │
│  │  引擎: Azure OpenAI (GPT-4o)            │    │
│  │  输入: 完整 scenario 上下文 + transcript  │    │
│  │  优势: 准确、可调、可解释               │    │
│  │  成本: ~$0.024/次                       │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  语音评分 (4维度, 权重 0-40%)                    │
│  ┌─────────────────────────────────────────┐    │
│  │  引擎: Azure CU (prebuilt-audioAnalyzer) │    │
│  │  输入: 音频文件                          │    │
│  │  优势: 原生音频分析、无需上下文           │    │
│  │  成本: ~$0.10/次 (10分钟音频)            │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  硬约束层 (代码逻辑, 0 cost)                     │
│  ┌─────────────────────────────────────────┐    │
│  │  - Key message 覆盖率约束                │    │
│  │  - 内容相关性检查                        │    │
│  │  - 最低消息数门槛                        │    │
│  │  - 分数 cap 逻辑                        │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
└─────────────────────────────────────────────────┘
```

**一句话总结:** 让每个引擎做它最擅长的事 — LLM 理解语义和上下文，CU 分析音频信号，代码逻辑执行硬性规则。
