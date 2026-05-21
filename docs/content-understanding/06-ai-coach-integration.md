# 06 — AI Coach 集成实现

> AI Coach 平台中 Content Understanding 的具体实现细节：配置要求、同步流程、评分管道、分数合并。

---

## 1. 配置前提条件

CU 功能正常工作需要以下配置：

### 必须配置

| 配置 | 来源 | 如何设置 |
|------|------|---------|
| CU Endpoint | DB `azure_service_configs` 或 `azure_master_configs` | Admin → Azure Config → Content Understanding |
| CU API Key | DB（加密存储） | Admin → Azure Config → Content Understanding |

### 可选配置

| 配置 | 来源 | 用途 |
|------|------|------|
| `AZURE_TENANT_ID` | 环境变量 | Portal URL 中的 `tid` 参数 |
| 各 Rubric 的 `content_weight` | Rubric 表 | 评分合并权重（默认 60） |
| 各 Rubric 的 `voice_weight` | Rubric 表 | 评分合并权重（默认 40） |

### 无配置时的行为

```
CU endpoint 为空 → sync_rubric_analyzers 静默跳过（log warning）
                 → evaluate_session_with_cu 无法运行
                 → 前端 CU Status Section 显示 "No Analyzers" 空状态
```

## 2. Analyzer 同步流程 (D-09)

### 触发时机

```python
# rubric_service.py - 创建时
async def create_rubric(db, data, user_id):
    rubric = ScoringRubric(...)
    db.add(rubric)
    await db.flush()
    try:
        await sync_rubric_analyzers(db, rubric)  # ← 触发
    except Exception as e:
        logger.warning("CU analyzer sync failed on create (non-blocking): %s", e)

# rubric_service.py - 更新时
async def update_rubric(db, rubric_id, data):
    ...
    await db.flush()
    try:
        await sync_rubric_analyzers(db, rubric)  # ← 触发
    except Exception as e:
        logger.warning("CU analyzer sync failed on update (non-blocking): %s", e)
```

### 同步逻辑

```
sync_rubric_analyzers(db, rubric)
    │
    ├── 1. 获取 endpoint + key（如为空，return）
    │
    ├── 2. 构建 content analyzer schema
    │       └── 从 rubric.dimensions 生成 fieldSchema
    │
    ├── 3. PUT content analyzer → CU API
    │       URL: {endpoint}/contentunderstanding/analyzers/rubricContent{id8}
    │
    ├── 4. 构建 voice analyzer schema（固定维度）
    │
    ├── 5. PUT voice analyzer → CU API
    │       URL: {endpoint}/contentunderstanding/analyzers/rubricVoice{id8}
    │
    └── 6. 存储 analyzer IDs 到 rubric 记录
            rubric.cu_content_analyzer_id = "rubricContent{id8}"
            rubric.cu_voice_analyzer_id = "rubricVoice{id8}"
```

### 错误处理

- PUT 返回 200/201 = 成功
- PUT 返回其他 = 抛出 RuntimeError
- 外层 try/except 捕获并 log warning（**不阻塞 rubric 保存**）

## 3. 评分管道

### 3.1 Content 评分 (D-15)

```python
async def score_content_with_cu(endpoint, api_key, analyzer_id, transcript_json):
    # 1. Base64 编码 transcript
    b64_content = base64.b64encode(transcript_json.encode()).decode()
    
    # 2. 提交分析请求
    response = await client.post(
        f"{endpoint}/contentunderstanding/analyzers/{analyzer_id}:analyze",
        json={"url": f"data:application/json;base64,{b64_content}"}
    )
    
    # 3. 获取 Operation-Location
    operation_url = response.headers["Operation-Location"]
    
    # 4. 轮询结果
    result = await _poll_result(operation_url, headers)
    
    # 5. 解析字段值
    return _parse_fields(result)
```

### 3.2 Voice 评分 (D-16)

```python
async def score_voice_with_cu(endpoint, api_key, analyzer_id, audio_url):
    # 1. 提交音频 URL
    response = await client.post(
        f"{endpoint}/contentunderstanding/analyzers/{analyzer_id}:analyze",
        json={"url": audio_url}
    )
    
    # 2. 轮询结果（同上）
    result = await _poll_result(operation_url, headers)
    
    # 3. 解析字段值（包含 transcript 字段用于 D-16）
    return _parse_fields(result)
```

## 4. 分数合并 (D-11)

### 公式

```
overall_score = (content_total × content_weight / 100) + (voice_total × voice_weight / 100)
```

### 场景规则

| 场景 | Content 评分 | Voice 评分 | 合并方式 |
|------|-------------|-----------|---------|
| 纯文本 session (D-13) | ✅ | ❌ | `overall = content_total` (100%) |
| 语音 session (D-14) | ✅ | ✅ | `overall = content×W1 + voice×W2` |

### 默认权重

| 权重 | 默认值 | 来源 |
|------|--------|------|
| `content_weight` | 60 | `ScoringRubric.content_weight` 字段 |
| `voice_weight` | 40 | `ScoringRubric.voice_weight` 字段（未设置时计算 100 - content_weight） |

## 5. 前端展示

### CU Status Section

位置：Rubric 编辑页侧边栏

显示内容：
- Content Analyzer ID（如 `rubricContent5c32107a`）
- Voice Analyzer ID（如 `rubricVoice5c32107a`）
- CU Endpoint
- "Open in AI Foundry (Classic)" 链接

状态说明：
- **有 analyzer ID** → 显示蓝色卡片 + 详情
- **无 analyzer ID** → 显示灰色卡片 + "将在配置 CU 后自动创建"
- **新建 rubric** → 不显示 CU section

### Portal URL API

```
GET /api/v1/rubrics/{rubric_id}/cu-portal-url
→ CuPortalUrlResponse {
    cu_content_analyzer_id,
    cu_voice_analyzer_id,
    content_analyzer_url,  // 经典 Foundry Portal URL
    voice_analyzer_url,    // 同上（指向同一个列表页）
    cu_endpoint
  }
```

## 6. 故障排除

| 症状 | 原因 | 解决 |
|------|------|------|
| Rubric 保存后无 Analyzer ID | CU endpoint/key 未配置 | Admin → Azure Config 配置 |
| 有 Analyzer ID 但 Portal 空 | API 版本差异或 endpoint 不匹配 | 验证 REST API 直接查询 |
| 评分超时 | CU 处理慢 | 检查文件大小、增加 MAX_POLL_ATTEMPTS |
| 评分返回空结果 | fieldSchema description 不够具体 | 改善 description 指令 |
| Portal 链接 404 | 未设置 AZURE_TENANT_ID 或使用了新版 Foundry | 确保环境变量设置，使用经典版 |

## 7. 验证 Analyzer 是否真正创建

直接通过 REST API 验证：

```bash
# 列出所有 Analyzer
curl -s -H "Ocp-Apim-Subscription-Key: {YOUR_KEY}" \
  "{ENDPOINT}/contentunderstanding/analyzers?api-version=2025-11-01" | jq .

# 获取特定 Analyzer
curl -s -H "Ocp-Apim-Subscription-Key: {YOUR_KEY}" \
  "{ENDPOINT}/contentunderstanding/analyzers/rubricContent5c32107a?api-version=2025-11-01" | jq .
```

如果返回 404，说明 Analyzer 确实没有被成功创建。
