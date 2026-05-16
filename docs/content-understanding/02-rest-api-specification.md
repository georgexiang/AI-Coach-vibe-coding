# 02 — REST API 规范

> Content Understanding REST API 的端点格式、版本差异、操作规范。

---

## 1. Base URL 格式

```
{endpoint}/contentunderstanding/analyzers/{analyzerId}?api-version={version}
```

其中：
- `{endpoint}` = CU 服务端点（如 `https://ai-foundary-hu-sweden-central2.services.ai.azure.com`）
- `{analyzerId}` = Analyzer 唯一标识符（仅字母数字，无连字符）
- `{version}` = API 版本

## 2. API 版本

| 版本 | 状态 | 用途 |
|------|------|------|
| `2025-11-01` | **GA（正式版）** | 生产环境推荐 |
| `2025-05-01-preview` | Preview | 经典 Foundry Portal 使用 |
| `2024-12-01-preview` | Preview（即将废弃 2026-07-15） | 早期预览 |

> **重要**：经典 Foundry Portal 使用 `2025-05-01-preview`。通过不同 API 版本创建的 Analyzer 互通性需验证。

## 3. Analyzer CRUD 操作

### 3.1 创建/更新 Analyzer（PUT）

```http
PUT {endpoint}/contentunderstanding/analyzers/{analyzerId}?api-version=2025-11-01
Content-Type: application/json
Authorization: Bearer {token}

{
  "description": "Auto-generated content scoring analyzer",
  "baseAnalyzerId": "prebuilt-document",
  "fieldSchema": {
    "name": "ContentScoring",
    "fields": {
      "key_message_delivery": {
        "type": "string",
        "method": "generate",
        "description": "JSON object with score (0-100) and feedback..."
      }
    }
  }
}
```

**响应**：`200 OK`（更新）或 `201 Created`（新建）

### 3.2 列出 Analyzers（GET）

```http
GET {endpoint}/contentunderstanding/analyzers?api-version=2025-11-01
Authorization: Bearer {token}
```

### 3.3 获取单个 Analyzer（GET）

```http
GET {endpoint}/contentunderstanding/analyzers/{analyzerId}?api-version=2025-11-01
Authorization: Bearer {token}
```

### 3.4 删除 Analyzer（DELETE）

```http
DELETE {endpoint}/contentunderstanding/analyzers/{analyzerId}?api-version=2025-11-01
Authorization: Bearer {token}
```

## 4. 评分操作（Submit-Poll 模式）

### 4.1 提交分析（POST）

```http
POST {endpoint}/contentunderstanding/analyzers/{analyzerId}:analyze?api-version=2025-11-01
Content-Type: application/json
Authorization: Bearer {token}

{
  "url": "data:application/json;base64,{base64_encoded_content}"
}
```

**响应**：`202 Accepted` + `Operation-Location` header

```
Operation-Location: {endpoint}/contentunderstanding/analyzers/{analyzerId}/results/{operationId}?api-version=2025-11-01
```

### 4.2 轮询结果（GET）

```http
GET {Operation-Location value}
Authorization: Bearer {token}
```

**状态流转**：
```
notStarted → running → succeeded / failed
```

**成功响应示例**：
```json
{
  "status": "succeeded",
  "result": {
    "analyzerId": "rubricContent5c32107a",
    "content": {
      "fields": {
        "key_message_delivery": {
          "type": "string",
          "valueString": "{\"score\": 85, \"feedback\": \"...\"}"
        },
        "feedback_summary": {
          "type": "string",
          "valueString": "Overall good performance..."
        }
      }
    }
  }
}
```

## 5. 轮询配置

| 参数 | 值 | 说明 |
|------|-----|------|
| MAX_POLL_ATTEMPTS | 60 | 最大轮询次数 |
| POLL_INTERVAL_SECONDS | 2.0 | 轮询间隔（秒） |
| REQUEST_TIMEOUT | 30.0 | 单次请求超时（秒） |

最大等待时间 = 60 × 2 = **120 秒**

## 6. Base Analyzer 类型

| baseAnalyzerId | 适用内容 | 能力 |
|----------------|---------|------|
| `prebuilt-document` | PDF、JSON、文本 | 文档理解 + 字段生成 |
| `prebuilt-audio` | WAV、MP3 等 | 语音识别 + 字段生成 |
| `prebuilt-video` | MP4 等 | 视觉 + 音频理解 |
| `prebuilt-image` | PNG、JPG 等 | 图像理解 |

## 7. 错误码

| HTTP Status | 含义 | 常见原因 |
|-------------|------|---------|
| 400 | Bad Request | fieldSchema 格式错误、analyzerId 含非法字符 |
| 401 | Unauthorized | Token 过期、Key 无效 |
| 404 | Not Found | Analyzer 不存在、endpoint 错误 |
| 409 | Conflict | Analyzer 正在处理中 |
| 429 | Too Many Requests | 请求频率超限 |

## 8. AI Coach 中的实现

代码位置：`backend/app/services/cu_evaluation_service.py`

```python
CU_API_VERSION = "2025-11-01"
CU_SERVICE_NAME = "content_understanding"

# Analyzer 创建
url = f"{endpoint}/contentunderstanding/analyzers/{analyzer_id}?api-version={CU_API_VERSION}"
response = await client.put(url, headers=headers, json=body)

# 评分提交
url = f"{endpoint}/contentunderstanding/analyzers/{analyzer_id}:analyze?api-version={CU_API_VERSION}"
response = await client.post(url, headers=headers, json={"url": f"data:application/json;base64,{b64}"})
```
