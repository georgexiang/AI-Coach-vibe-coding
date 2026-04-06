# Voice Live + Avatar 实现文档套件

> 本文档套件完整描述了 Azure Voice Live API + Digital Human Avatar 的全栈实现。
> 设计为 **分层加载** 格式，Coding Agent 可按需加载特定模块，避免 context 溢出。

---

## 文档目录

| # | 文档 | 内容 | 适用场景 |
|---|------|------|----------|
| 01 | [架构总览](01-architecture.md) | 系统架构、数据流、技术选型 | 理解全局，新功能规划 |
| 02 | [数据库设计](02-database-schema.md) | ORM 模型、字段定义、迁移策略 | 后端开发、Schema 变更 |
| 03 | [API 接口设计](03-api-design.md) | REST + WebSocket 端点、请求/响应格式 | 前后端联调、新接口开发 |
| 04 | [后端 WebSocket 代理](04-backend-websocket.md) | Azure SDK 集成、消息转发、Avatar 配置 | 后端核心逻辑修改 |
| 05 | [前端组件架构](05-frontend-components.md) | React 组件树、Hook 设计、状态管理 | 前端 UI 开发 |
| 06 | [WebRTC Avatar 集成](06-webrtc-avatar.md) | ICE/SDP 协商、音视频流处理 | Avatar 功能开发与调试 |
| 07 | [UI 交互设计](07-ui-patterns.md) | 页面布局、交互流程、视觉规范 | UI 设计、新页面开发 |

---

## 加载策略

**Agent 按任务选择性加载：**

- 修改后端 WebSocket → 加载 `01` + `04`
- 新增前端组件 → 加载 `01` + `05` + `07`
- 调整 Avatar WebRTC → 加载 `01` + `06`
- 修改数据库 → 加载 `02` + `03`
- 全栈新功能 → 加载 `01`，然后按需加载其余

---

## 核心架构速览

```
Browser (React)                    Backend (FastAPI)                 Azure Cloud
┌────────────────┐                ┌────────────────┐              ┌──────────────────┐
│ VoiceSession   │◄──WebSocket──►│ voice_live_ws  │◄──SDK──────►│ Voice Live API   │
│   component    │   (audio +    │   proxy handler │  (azure.ai  │ (GPT Realtime    │
│                │    events)    │                │   .voicelive)│  + STT/TTS/VAD)  │
├────────────────┤                └────────────────┘              └──────────────────┘
│ useVoiceLive   │  ← WebSocket hook                                     │
│ useAvatarStream│  ← WebRTC hook                                        │
│ useAudioHandler│  ← Mic capture (AudioWorklet, 24kHz PCM16)            │
│ useAudioPlayer │  ← Playback (base64 PCM16 → AudioBuffer)             │
├────────────────┤                                                       │
│ AvatarView     │◄──WebRTC (ICE/SDP)──────────────────────────────────►│
│  <video>       │   H.264 video + audio tracks                  Azure AI Avatar
│  <audio>       │                                               (Digital Human)
└────────────────┘
```

---

## 关键设计决策

1. **Backend WebSocket Proxy** — 前端不直接连 Azure，通过后端 Python SDK 代理，保护 API Key
2. **Model Mode Only** — 始终使用 Model 模式（非 Agent 模式），因 Agent 模式需 Azure AD 认证
3. **VoiceLiveInstance 实体** — 独立于 HCP Profile 的可复用配置实体，一个实例可分配给多个 HCP
4. **配置优先级** — VoiceLiveInstance > HCP Profile 内联字段（deprecated）
5. **双路并行** — WebSocket (语音+文本) 与 WebRTC (数字人视频) 同时建立，互不阻塞
6. **Azure Voice Live SDK** — 使用 `azure-ai-voicelive` Python SDK，非直接 WebSocket 调用

## 源码文件索引

### Backend
| 文件 | 用途 |
|------|------|
| `backend/app/models/voice_live_instance.py` | VL 实例 ORM 模型 |
| `backend/app/models/hcp_profile.py` | HCP Profile（含 VL FK） |
| `backend/app/api/voice_live.py` | REST + WS 路由 |
| `backend/app/schemas/voice_live.py` | Token/Status 响应 Schema |
| `backend/app/schemas/voice_live_instance.py` | 实例 CRUD Schema |
| `backend/app/services/voice_live_websocket.py` | WebSocket 代理核心 |
| `backend/app/services/voice_live_service.py` | Token 分发 + 状态查询 |
| `backend/app/services/voice_live_instance_service.py` | 实例 CRUD + 配置解析 |
| `backend/app/services/voice_live_models.py` | 支持的 AI 模型列表 |
| `backend/app/services/avatar_characters.py` | Avatar 角色元数据 |

### Frontend
| 文件 | 用途 |
|------|------|
| `frontend/src/components/voice/voice-session.tsx` | 主编排组件（549 行） |
| `frontend/src/components/voice/avatar-view.tsx` | Avatar 视频显示 |
| `frontend/src/components/voice/voice-controls.tsx` | 底部控制栏 |
| `frontend/src/components/voice/voice-transcript.tsx` | 实时转写显示 |
| `frontend/src/components/voice/voice-config-panel.tsx` | 配置面板 |
| `frontend/src/hooks/use-voice-live.ts` | WebSocket 客户端 Hook |
| `frontend/src/hooks/use-avatar-stream.ts` | WebRTC 客户端 Hook |
| `frontend/src/hooks/use-audio-handler.ts` | 麦克风采集 Hook |
| `frontend/src/hooks/use-audio-player.ts` | 音频播放 Hook |
| `frontend/src/pages/admin/vl-instance-editor.tsx` | VL 实例编辑器+Playground |
| `frontend/src/types/voice-live.ts` | TypeScript 类型定义 |
| `frontend/public/audio-processor.js` | AudioWorklet 处理器 |
