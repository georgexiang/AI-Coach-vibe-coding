# 03 — 音频存储机制

> 描述语音训练中音频的录制、上传、存储和语音评分触发流程。

---

## 1. 前端录音

**文件:** `frontend/src/hooks/use-session-recorder.ts`

### 录音流程

```
用户开始语音 Session
       │
       ▼
useSessionRecorder() 初始化
  ├── useAudioRecorder() 获取 MediaStream
  └── 开始录制 (MediaRecorder API)
       │
       │  ... 对话进行中 ...
       │
       ▼
用户结束 Session
       │
       ▼
stopAndUpload(sessionId)
  ├── recorder.stop() → 获取 Blob
  └── uploadSessionAudio(sessionId, blob, filename)
```

### API 调用

**文件:** `frontend/src/api/unified-session.ts`

```typescript
export async function uploadSessionAudio(
  sessionId: string,
  audioBlob: Blob,
  filename: string
): Promise<void> {
  const formData = new FormData();
  formData.append("file", audioBlob, filename);
  await apiClient.post(`/sessions/${sessionId}/audio`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
```

---

## 2. 后端上传处理

**文件:** `backend/app/api/sessions.py:312-342`

### 端点: `POST /api/v1/sessions/{id}/audio`

```python
@router.post("/sessions/{session_id}/audio")
async def upload_session_audio_endpoint(
    session_id: str,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    # 1. 验证 session 所有权
    session = await get_session(db, session_id)
    if session.user_id != current_user.id:
        raise ForbiddenException("Not your session")

    # 2. 文件大小验证 (50MB 上限)
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise ValidationException("File too large (max 50MB)")

    # 3. 存储音频
    audio_path = await upload_session_audio(session_id, content, file.filename)

    # 4. 更新 session
    session.audio_url = audio_path
    session.voice_score_status = "pending"

    # 5. 异步触发语音评分
    asyncio.create_task(trigger_voice_scoring(session_id))

    return {"audio_url": audio_path}
```

---

## 3. 存储后端

**文件:** `backend/app/services/audio_storage_service.py`

### 存储路径

```
audio/sessions/{session_id}/{filename}
```

### 存储后端协议

```python
class StorageBackend(Protocol):
    async def upload(self, path: str, content: bytes) -> str: ...
    async def download(self, path: str) -> bytes: ...
    async def delete(self, path: str) -> None: ...
    async def exists(self, path: str) -> bool: ...
```

### 实现

| 后端 | 文件 | 环境 | 说明 |
|------|------|------|------|
| `LocalStorageBackend` | `storage/local.py` | 开发 | 保存到本地文件系统 |
| `AzureBlobStorageBackend` | `storage/azure_blob.py` | 生产 | Azure Blob Storage (stub) |

### 工厂函数

```python
def get_storage() -> StorageBackend:
    # 基于 settings 选择后端
    # 默认: LocalStorageBackend
```

---

## 4. 语音评分触发

**文件:** `backend/app/services/voice_scoring_service.py`

音频上传后，通过 `asyncio.create_task()` 异步触发语音评分:

```
upload_session_audio_endpoint()
       │
       ▼
asyncio.create_task(trigger_voice_scoring(session_id))
       │
       ▼  (后台异步执行)
trigger_voice_scoring(session_id)
  ├── 状态: pending → processing
  ├── 尝试 CU voice analyzer (if configured)
  │     └── 提交 audio → CU 语音分析器
  ├── 失败则回退: MockVoiceScoringBackend
  │     └── 生成 55-95 范围随机分
  ├── 保存 ScoreDetail (category="voice")
  └── 状态: processing → completed/failed
```

### 语音评分维度 (固定)

| 维度 | 权重 | 说明 |
|------|------|------|
| fluency | 25% | 语言流畅度 |
| tone | 25% | 语调专业度 |
| pace | 25% | 语速适当性 |
| pronunciation | 25% | 发音清晰度 |

### 前端轮询

**文件:** `frontend/src/hooks/use-voice-score.ts`

前端每 3 秒轮询 `voice_score_status` 直到 `completed` 或 `failed`。

---

## 5. 音频与评分的关系

```
Session (text mode)  → 无音频 → 只有 content scoring (100% 权重)
Session (voice mode) → 有音频 → content scoring + voice scoring
                                 content_weight(60%) + voice_weight(40%)
```

语音评分是**独立于内容评分**的补充，两者最终通过 rubric 配置的权重合并。
