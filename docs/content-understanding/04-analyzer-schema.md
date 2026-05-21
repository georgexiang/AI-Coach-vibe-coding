# 04 — Analyzer Schema 设计

> 每个 CU Analyzer 的核心是 `fieldSchema` — 定义了输入处理后要生成什么输出字段。

---

## 1. Schema 结构概览

```json
{
  "description": "Auto-generated content scoring analyzer",
  "baseAnalyzerId": "prebuilt-document",
  "fieldSchema": {
    "name": "ContentScoring",
    "fields": {
      "field_name": {
        "type": "string",
        "method": "generate",
        "description": "Instructions for what to generate"
      }
    }
  }
}
```

### 核心字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `description` | string | Analyzer 用途描述 |
| `baseAnalyzerId` | string | 基础分析器类型 |
| `fieldSchema.name` | string | Schema 名称 |
| `fieldSchema.fields` | object | 输出字段定义 |

### Field 属性

| 属性 | 必填 | 说明 |
|------|------|------|
| `type` | 是 | 值类型：`string`, `number`, `date`, `array`, `object` |
| `method` | 是 | 生成方式：`generate`（LLM生成）或 `extract`（从内容提取） |
| `description` | 是 | 生成指令 — **这是控制输出质量的关键** |

## 2. Content Analyzer Schema

基于 `prebuilt-document`，用于评估对话内容。每个 Rubric 维度变成一个 `generate` 字段。

### 示例（来自 AI Coach 生成逻辑）

```json
{
  "description": "Auto-generated content scoring analyzer",
  "baseAnalyzerId": "prebuilt-document",
  "fieldSchema": {
    "name": "ContentScoring",
    "fields": {
      "key_message_delivery": {
        "type": "string",
        "method": "generate",
        "description": "Evaluate the key message delivery quality. Score from 0-100 based on: clarity of main message, use of supporting evidence, adaptation to HCP responses. Criteria: [c1: ..., c2: ...]. Return JSON: {\"score\": N, \"feedback\": \"...\"}"
      },
      "communication_skills": {
        "type": "string",
        "method": "generate",
        "description": "Evaluate communication skills. Score from 0-100 based on: active listening, question technique, empathy display. Criteria: [...]. Return JSON: {\"score\": N, \"feedback\": \"...\"}"
      },
      "product_knowledge": {
        "type": "string",
        "method": "generate",
        "description": "Evaluate product knowledge accuracy. Score from 0-100 based on: factual correctness, depth of knowledge, ability to handle questions. Criteria: [...]. Return JSON: {\"score\": N, \"feedback\": \"...\"}"
      },
      "feedback_summary": {
        "type": "string",
        "method": "generate",
        "description": "Overall training performance feedback summary. Provide actionable suggestions for improvement in 2-3 sentences."
      }
    }
  }
}
```

### Content Schema 生成代码

```python
# backend/app/services/cu_evaluation_service.py

def build_content_analyzer_schema(dimensions: list[dict]) -> dict:
    fields = {}
    for dim in dimensions:
        name = dim["name"]
        weight = dim.get("weight", 0)
        criteria = dim.get("criteria", [])
        criteria_text = ", ".join(criteria) if criteria else "general quality"
        
        fields[name] = {
            "type": "string",
            "method": "generate",
            "description": (
                f"Evaluate '{name}' (weight: {weight}%). "
                f"Score 0-100 based on criteria: {criteria_text}. "
                f"Return JSON: {{\"score\": N, \"feedback\": \"...\"}}"
            ),
        }
    
    fields["feedback_summary"] = {
        "type": "string",
        "method": "generate",
        "description": "Overall training performance feedback summary",
    }
    
    return {"name": "ContentScoring", "fields": fields}
```

## 3. Voice Analyzer Schema

基于 `prebuilt-audio`，用于评估语音质量。维度固定。

### 固定维度

| 维度 | 评估内容 |
|------|---------|
| `fluency` | 流畅度 — 停顿频率、语句连贯性 |
| `tone` | 语调 — 热情度、专业性、适当性 |
| `pace` | 语速 — 节奏均匀性、快慢适当性 |
| `pronunciation` | 发音 — 清晰度、准确性 |

### 示例

```json
{
  "description": "Auto-generated voice scoring analyzer",
  "baseAnalyzerId": "prebuilt-audio",
  "fieldSchema": {
    "name": "VoiceScoring",
    "fields": {
      "fluency": {
        "type": "string",
        "method": "generate",
        "description": "Evaluate speech fluency: pause frequency, sentence coherence, filler word usage. Score 0-100. Return JSON: {\"score\": N, \"feedback\": \"...\"}"
      },
      "tone": {
        "type": "string",
        "method": "generate",
        "description": "Evaluate vocal tone: enthusiasm, professionalism, appropriateness for medical context. Score 0-100. Return JSON: {\"score\": N, \"feedback\": \"...\"}"
      },
      "pace": {
        "type": "string",
        "method": "generate",
        "description": "Evaluate speaking pace: rhythm consistency, speed appropriateness. Score 0-100. Return JSON: {\"score\": N, \"feedback\": \"...\"}"
      },
      "pronunciation": {
        "type": "string",
        "method": "generate",
        "description": "Evaluate pronunciation: clarity, accuracy of medical terms. Score 0-100. Return JSON: {\"score\": N, \"feedback\": \"...\"}"
      },
      "feedback_summary": {
        "type": "string",
        "method": "generate",
        "description": "Overall voice quality feedback summary"
      },
      "transcript": {
        "type": "string",
        "method": "generate",
        "description": "Re-transcription of the audio content for D-16 compliance"
      }
    }
  }
}
```

## 4. Analyzer ID 命名规范

### 规则

- **仅允许**：字母（a-z, A-Z）+ 数字（0-9）
- **不允许**：连字符 `-`、下划线 `_`、空格、特殊字符
- **长度**：有限制（建议不超过 64 字符）

### AI Coach 命名策略

```python
rubric_id_short = rubric.id[:8].replace("-", "")
content_analyzer_id = f"rubricContent{rubric_id_short}"
voice_analyzer_id = f"rubricVoice{rubric_id_short}"
```

示例：
- Rubric ID: `5c32107a-1234-5678-abcd-ef0123456789`
- Content: `rubricContent5c32107a`
- Voice: `rubricVoice5c32107a`

## 5. Description 最佳实践

`description` 字段是控制 `generate` 方法输出质量的关键：

1. **明确评分标准** — 列出具体 criteria
2. **指定输出格式** — 要求返回 JSON 便于解析
3. **限定分数范围** — 明确 0-100 分制
4. **提供上下文** — 说明这是 MR 培训评分场景
5. **指定语言** — 如需中文反馈，在 description 中说明

### 好的 description 示例

```
"Evaluate key message delivery for a Medical Representative training session. 
Score 0-100 based on: (1) clarity of product value proposition, (2) use of clinical data, 
(3) adaptation to HCP's specialty and concerns. 
Return JSON: {\"score\": <0-100>, \"feedback\": \"<2-3句中文反馈>\"}"
```

### 差的 description 示例

```
"Score this field"  // 过于模糊，输出不可预测
```

## 6. Schema 限制

| 限制 | 值 |
|------|-----|
| 最大字段数 | 参考 [service-limits](https://learn.microsoft.com/azure/ai-services/content-understanding/service-limits) |
| field name | 仅字母数字 + 下划线 |
| description 长度 | 建议 < 500 字符 |
| type 枚举 | string, number, date, array, object |
| method 枚举 | generate, extract |
