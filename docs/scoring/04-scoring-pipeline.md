# 04 — 评分流程与评分引擎

> 描述评分触发后的完整执行管道：CU 评分、LLM 评分、Mock 回退、分数计算与存储。

---

## 1. 评分触发入口

**文件:** `backend/app/api/scoring.py`

| 端点 | 用途 |
|------|------|
| `POST /scoring/sessions/{id}/score` | 触发评分 |
| `GET /scoring/sessions/{id}/score` | 获取已有评分 |
| `GET /scoring/sessions/{id}/combined-report` | 综合报告 (content + voice) |
| `GET /scoring/history` | 评分历史 + 趋势 |

### 前置校验

```python
# 1. session.status 必须是 "completed"
if session.status == "scored":
    raise 409 ALREADY_SCORED
if session.status != "completed":
    raise 409 INVALID_STATUS

# 2. 必须有消息
if not messages:
    raise 409 NO_MESSAGES
```

---

## 2. 三级降级策略

**文件:** `backend/app/services/scoring_service.py:35-174`

```python
async def score_session(db, session_id):
    # ... 加载 session, scenario, messages, rubric ...

    # 第1级: CU 评分
    cu_result = await score_session_with_cu(db, session_id)

    if cu_result:
        scores = cu_result
    else:
        # 第2级: LLM 评分
        scores = await score_with_llm(
            db, scenario_data, message_dicts, key_messages_status,
            rubric_dimensions, scenario.pass_threshold, skill_criteria
        )
        if scores is None:
            # 第3级: Mock 评分
            scores = _generate_mock_scores(
                scenario, messages, key_messages_status, rubric_dimensions
            )

    # 保存分数 ...
```

---

## 3. 第1级: CU 评分 (Azure Content Understanding)

**文件:** `backend/app/services/cu_evaluation_service.py`

### 3.1 流程

```
score_session_with_cu(db, session_id)
  │
  ├── 加载 session + scenario + rubric
  │
  ├── 获取 CU endpoint + API key (from config_service)
  │     └── 无配置 → return None (降级)
  │
  ├── 获取 analyzer IDs (rubric.cu_content_analyzer_id)
  │     └── 无 ID → 尝试 sync_rubric_analyzers() → 仍无 → return None
  │
  ├── 构建 transcript JSON
  │     └── _build_transcript_json(): [{role, content, timestamp}]
  │
  ├── 内容评分 (必做)
  │     └── score_content_with_cu(endpoint, key, analyzer_id, transcript_json)
  │           ├── Base64 编码 transcript
  │           ├── POST {endpoint}/contentunderstanding/analyzers/{id}:analyze
  │           ├── 获取 Operation-Location header
  │           └── _poll_result() → 轮询直到 Succeeded (最长 120s)
  │
  ├── 语音评分 (可选，仅 audio_url 存在时)
  │     └── score_voice_with_cu(endpoint, key, voice_analyzer_id, audio_url)
  │
  └── merge_scores(content_scores, voice_scores, content_weight, voice_weight)
```

### 3.2 CU Analyzer 架构

CU 使用自定义 Analyzer，基于 `prebuilt-documentAnalyzer` 扩展:

```json
{
  "description": "Auto-generated content scoring analyzer",
  "baseAnalyzerId": "prebuilt-documentAnalyzer",
  "fieldSchema": {
    "name": "ContentScoring",
    "fields": {
      "key_message": {
        "type": "string",
        "method": "generate",
        "description": "JSON object with score (0-100), strengths, weaknesses, suggestions for dimension 'key_message' (weight: 30%). Criteria: Consider which key messages were delivered..."
      },
      "objection_handling": { ... },
      "communication": { ... },
      "product_knowledge": { ... },
      "scientific_info": { ... },
      "feedback_summary": { ... }
    }
  }
}
```

### 3.3 CU 的输入

CU **只收到 transcript JSON**:
```json
[
  {"role": "user", "content": "你好，我们可以开始培训了。", "timestamp": "2026-05-18T04:34:00"},
  {"role": "assistant", "content": "可以，开始吧...", "timestamp": "2026-05-18T04:34:05"}
]
```

**不包含:** 产品名、key messages 列表、HCP profile、合格标准、scenario 上下文。

### 3.4 CU 返回格式

```json
{
  "key_message": {
    "type": "string",
    "valueString": "{\"score\": 85, \"strengths\": [...], \"weaknesses\": [...], \"suggestions\": [...]}"
  },
  "feedback_summary": {
    "type": "string",
    "valueString": "Overall assessment text..."
  }
}
```

### 3.5 分数合并 (merge_scores)

```python
def merge_scores(content_scores, voice_scores, content_weight, voice_weight):
    content_total = weighted_average(content_dims)

    if voice_scores is None:
        # 文本-only: content = 100%
        return {"overall_score": content_total, ...}

    # 含语音: 加权合并
    voice_total = weighted_average(voice_dims)
    overall = content_total * (content_weight / 100) + voice_total * (voice_weight / 100)
    return {"overall_score": overall, ...}
```

---

## 4. 第2级: LLM 评分 (Azure OpenAI)

**文件:** `backend/app/services/scoring_engine.py`

### 4.1 Prompt 构成

LLM prompt 比 CU 有**完整的上下文**:

| 段落 | 内容 |
|------|------|
| HCP Profile | name, specialty, personality, communication_style |
| Scenario | product, therapeutic_area, difficulty |
| Key Messages | 逐条列出 |
| Key Messages Status | 每条标注 [DELIVERED] 或 [NOT DELIVERED] |
| Skill Criteria | Assessment Rubric section from Skill content |
| Transcript | 完整对话 (MR: ... / HCP: ...) |
| Dimensions Config | 每维度: 名称, 权重, criteria 列表 |

### 4.2 调用参数

```python
response = await client.chat.completions.create(
    model=deployment,
    messages=[
        {"role": "system", "content": "You are a pharmaceutical sales training evaluator. Return ONLY valid JSON."},
        {"role": "user", "content": scoring_prompt},
    ],
    temperature=0.3,
    max_completion_tokens=2048,
    response_format={"type": "json_object"},
)
```

### 4.3 返回格式

```json
{
  "dimensions": [
    {
      "dimension": "key_message",
      "score": 45,
      "weight": 30,
      "strengths": [{"text": "...", "quote": "MR actual quote"}],
      "weaknesses": [{"text": "...", "quote": null}],
      "suggestions": ["..."]
    }
  ],
  "feedback_summary": "Overall assessment..."
}
```

---

## 5. 第3级: Mock 评分 (开发回退)

**文件:** `backend/app/services/scoring_service.py:378-481`

### 逻辑

```python
base_score = 65 + int(delivery_ratio * 25)  # 65 ~ 90
# delivery_ratio = delivered_count / total_key_messages

for dim in rubric_dimensions:
    score = min(95, max(60, base_score + random.randint(-8, 10)))
    # 即使 delivery_ratio = 0, score 范围 = 57~75
```

**⚠️ 问题:** 基线过高，几乎任何情况都能给出 60+ 分。

---

## 6. 分数存储

**文件:** `backend/app/models/score.py`

### SessionScore

```python
class SessionScore(Base, TimestampMixin):
    session_id: str       # unique FK → coaching_sessions
    overall_score: float  # 加权总分 (0-100)
    passed: bool          # overall_score >= pass_threshold
    feedback_summary: str # 总体反馈文本
```

### ScoreDetail

```python
class ScoreDetail(Base, TimestampMixin):
    score_id: str      # FK → session_scores
    dimension: str     # "key_message", "communication", etc.
    score: float       # 0-100
    weight: int        # 百分比权重
    strengths: str     # JSON: [{"text": "...", "quote": "..."}]
    weaknesses: str    # JSON: [{"text": "...", "quote": "..."}]
    suggestions: str   # JSON: ["..."]
    category: str      # "content" 或 "voice"
```

### 综合报告

```python
# GET /scoring/sessions/{id}/combined-report
{
    "overall_score": 76.25,         # content-only total
    "overall_combined_score": 73.2,  # content*0.7 + voice*0.3
    "passed": True,
    "content_dimensions": [...],
    "voice_dimensions": [...],
    "content_total": 76.25,
    "voice_total": 68.5,
    "content_weight": 70,
    "voice_weight": 30,
    "feedback_summary": "..."
}
```

---

## 7. Rubric Analyzer 同步机制

**触发时机:** Rubric 创建或更新时

```
Admin 保存 Rubric
       │
       ▼
rubric_service.create_rubric() / update_rubric()
       │
       ▼
sync_rubric_analyzers(db, rubric)
  ├── PUT content analyzer: rubricContent{id8}
  │     └── fieldSchema 来自 build_content_analyzer_schema(dimensions)
  ├── PUT voice analyzer: rubricVoice{id8}
  │     └── fieldSchema 来自 build_voice_analyzer_schema(DEFAULT_VOICE_DIMENSIONS)
  └── 保存 analyzer IDs 回 rubric
       ├── rubric.cu_content_analyzer_id = "rubricContent5c32107a"
       └── rubric.cu_voice_analyzer_id = "rubricVoice5c32107a"
```

**注意:** sync 失败是 non-blocking (只记 warning)，不会阻止 rubric 保存。
