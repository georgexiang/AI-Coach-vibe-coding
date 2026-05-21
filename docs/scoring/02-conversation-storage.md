# 02 — 对话存储机制

> 描述训练 Session 中对话消息的存储方式、Session 状态管理、Key Message 实时检测。

---

## 1. 消息模型

**文件:** `backend/app/models/message.py`

```python
class SessionMessage(Base, TimestampMixin):
    session_id: str        # FK → coaching_sessions.id
    role: str              # "user" (MR) 或 "assistant" (HCP)
    content: str           # 消息文本内容 (Text 类型，无长度限制)
    message_index: int     # 会话内排序 (0-based)
    speaker_id: str | None # conference 模式下的发言人 ID
    speaker_name: str      # conference 模式下的发言人名称
```

**数据库索引:** `(session_id, message_index)` 复合索引，确保查询效率。

**Schema:** `backend/app/schemas/session.py` → `MessageResponse`

---

## 2. 消息持久化

**核心函数:** `session_service.save_message()` (line 197-229)

### 触发时机

| 场景 | 触发端点 | 行为 |
|------|----------|------|
| 文本模式 - MR 消息 | `POST /sessions/{id}/message` | 立即保存，触发状态转换 |
| 文本模式 - HCP 回复 | SSE 流完成后 | 累积完整回复后保存 |
| 语音模式 - 转写 | `POST /sessions/{id}/transcript` | 保存但不触发 LLM（Azure Voice Live 直接处理） |

### 保存逻辑

```python
async def save_message(db, session_id, role, content, speaker_id=None, speaker_name=""):
    # 1. 计算 message_index
    count = await db.execute(
        select(func.count()).where(SessionMessage.session_id == session_id)
    )
    message_index = count.scalar()

    # 2. 创建消息记录
    message = SessionMessage(
        session_id=session_id,
        role=role,
        content=content,
        message_index=message_index,
        speaker_id=speaker_id,
        speaker_name=speaker_name,
    )
    db.add(message)

    # 3. 首条用户消息: 状态转换
    if message_index == 0 and role == "user":
        session.status = "in_progress"
        session.started_at = datetime.now(UTC)

    await db.flush()
    return message
```

---

## 3. Session 状态机

**文件:** `backend/app/models/session.py`

```
created ──────► in_progress ──────► completed ──────► scored
   │                │                    │                │
   │ 创建时          │ 首条MR消息         │ end_session()   │ score_session()
   │                │                    │                │
   │                │                    │                │
   ▼                ▼                    ▼                ▼
 key_messages    started_at 设定      completed_at 设定  overall_score 设定
 _status 初始化  duration 开始计算     duration 最终计算   passed 判定
```

### Session 关键字段

| 字段 | 说明 | 设定时机 |
|------|------|---------|
| `status` | created → in_progress → completed → scored | 各转换点 |
| `started_at` | 首条消息时间 | in_progress 转换时 |
| `completed_at` | 结束时间 | completed 转换时 |
| `duration_seconds` | 活跃时长（排除 idle） | completed 时计算 |
| `key_messages_status` | JSON: 各 key message 覆盖状态 | 每条 MR 消息后更新 |
| `overall_score` | 加权总分 | scored 时设定 |
| `passed` | 是否合格 | scored 时设定 |
| `audio_url` | 音频文件路径 | 上传时设定 |
| `voice_score_status` | pending/processing/completed/failed | 异步语音评分状态 |
| `focus_instruction` | 当前 SOP 步骤指令 | 每轮对话更新 |
| `sop_current_step` | SOP 当前步骤编号 | 每轮对话更新 |

---

## 4. Key Message 实时检测

**文件:** `backend/app/services/session_service.py:327-383`

### 检测方式: 简单关键词匹配

```python
def _mock_key_message_detection(key_messages, mr_message, _conversation_history):
    detected = []
    mr_lower = mr_message.lower()

    for key_msg in key_messages:
        # 提取显著词 (>3 字符)
        words = [w.lower() for w in key_msg.split() if len(w) > 3]
        if not words:
            continue
        # 计算匹配率
        matched = sum(1 for w in words if w in mr_lower)
        threshold = max(1, len(words) * 0.4)  # 40% 阈值
        if matched >= threshold:
            detected.append(key_msg)

    return detected
```

### 示例

```
Key Message: "Superior ORR (78.3% vs 62.5%) vs ibrutinib in ALPINE trial"
显著词: ["superior", "78.3%", "62.5%", "ibrutinib", "alpine", "trial"]
阈值: max(1, 6 * 0.4) = 3 个词

→ MR 需要在一条消息中包含至少 3 个显著词才能触发 "delivered"
```

### 检测结果存储

```json
// session.key_messages_status
[
  {
    "message": "Superior ORR (78.3% vs 62.5%) vs ibrutinib in ALPINE trial",
    "delivered": true,
    "detected_at": "2026-05-18T04:35:00Z"
  },
  {
    "message": "Lower atrial fibrillation rate (2.5% vs 10.1%) vs ibrutinib",
    "delivered": false,
    "detected_at": null
  }
]
```

### 调用时机

每条 `role="user"` 消息保存后，在 `POST /sessions/{id}/message` handler 中调用:
```python
await detect_key_messages(db, session, mr_message)
```

---

## 5. 消息查询 API

| 端点 | 用途 |
|------|------|
| `GET /sessions/{id}/messages` | 获取完整对话历史 |
| `GET /sessions/{id}` | Session 详情（含 key_messages_status） |

消息按 `message_index` 排序返回，确保对话时序正确。
