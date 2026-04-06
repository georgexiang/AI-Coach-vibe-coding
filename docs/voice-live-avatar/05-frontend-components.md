# 05 — 前端组件架构

## 组件树

```
VoiceSession (voice-session.tsx, 549行, 主编排)
├── VoiceSessionHeader (header, 64px)
│   ├── SessionTimer
│   ├── ModeStatusIndicator
│   └── ConnectionStatus
├── LEFT PANEL (Avatar + Controls)
│   ├── AvatarView (avatar-view.tsx)
│   │   ├── <video> (WebRTC, 始终在 DOM)
│   │   ├── Static Thumbnail (CDN 图片)
│   │   ├── AudioOrb (语音模式 fallback)
│   │   └── Skeleton (加载态)
│   └── VoiceControls (voice-controls.tsx)
│       ├── Camera Off Button (disabled)
│       ├── Mic Button (56px, 状态色+动画)
│       ├── End Call Button (红色)
│       ├── Keyboard Toggle
│       └── Fullscreen Toggle
└── RIGHT PANEL (Tabbed)
    ├── Tab: Transcript
    │   └── VoiceTranscript (voice-transcript.tsx)
    │       └── 聊天气泡 (用户右/AI左, 未完成70%透明度)
    └── Tab: Configuration
        └── VoiceConfigPanel (voice-config-panel.tsx)
            ├── Language Selector (10种语言)
            ├── Auto-detect Toggle
            ├── Voice Name (只读)
            └── Avatar Status
```

## 核心 Hooks

### useVoiceLive (use-voice-live.ts, 482行)
**WebSocket 客户端**。管理与后端的 WebSocket 连接。

```typescript
const {
  connect,          // (token, hcpProfileId?, systemPrompt?) => void
  disconnect,       // () => void
  toggleMute,       // () => void
  sendTextMessage,  // (text) => void — 键盘输入 fallback
  sendAudio,        // (base64) => void — input_audio_buffer.append
  send,             // (msg) => void — 发送任意消息
  isMuted,          // boolean
  connectionState,  // disconnected|connecting|connected|reconnecting|error
  audioState,       // idle|listening|speaking|muted
  avatarSdpCallbackRef  // Ref — Avatar SDP answer 回调
} = useVoiceLive(options)
```

**options 回调**：
- `onTranscriptUpdate(segment)` — 转写增量
- `onAudioData(base64)` — AI 音频数据
- `onAvatarIceServers(servers)` — ICE servers（触发 WebRTC 建立）
- `onSessionCreated()` / `onError(msg)`

**自动重连**：max 3次，指数退避 1s→2s→4s→8s max

### useAvatarStream (use-avatar-stream.ts, 229行)
**WebRTC 客户端**。详见 `06-webrtc-avatar.md`。

### useAudioHandler (use-audio-handler.ts, 117行)
**麦克风采集**。AudioWorklet + AnalyserNode。

```typescript
const { initialize, startRecording, stopRecording, analyserNode } = useAudioHandler({
  onAudioData: (float32Array) => {
    // Float32 → Int16 → Base64 → sendAudio()
  }
})
// 参数: 24kHz, mono, echoCancellation + noiseSuppression
// Worklet: /audio-processor.js
```

### useAudioPlayer (use-audio-player.ts, 68行)
**音频播放**。Base64 PCM16 → Float32 → AudioBuffer → gapless 播放。

```typescript
const { playAudio, stop } = useAudioPlayer()
// playAudio(base64String) — decode → schedule AudioBufferSourceNode
// 24kHz sample rate, gapless scheduling via nextStartTime tracking
```

## VoiceSession 初始化流程 (`initVoice()`)

```typescript
async function initVoice() {
  // 1. 初始化麦克风
  await audioHandler.initialize()

  // 2. 注册 Avatar SDP 回调
  voiceLive.avatarSdpCallbackRef.current = (serverSdp) => {
    avatarStream.handleServerSdp(serverSdp)
  }

  // 3. WebSocket 连接
  await voiceLive.connect(token, hcpProfileId, systemPrompt)
  // → 触发 onAvatarIceServers 回调

  // 4. Avatar WebRTC 连接（在 onAvatarIceServers 中）
  await avatarStream.connect(iceServers, (sdpOffer) => {
    voiceLive.send({
      type: "session.avatar.connect",
      client_sdp: sdpOffer
    })
  })

  // 5. 开始录音
  audioHandler.startRecording()
}
```

## 状态管理

**无全局 Store**。所有状态通过 React Hooks 本地管理：

| Hook | 状态 | 类型 |
|------|------|------|
| useVoiceLive | connectionState, audioState, isMuted | useState |
| useAvatarStream | isConnected | useState |
| VoiceSession | transcripts[], sessionStarted, showKeyboard | useState |
| 各处 | wsRef, pcRef, videoRef | useRef |

**Feature Flags**：`ConfigContext` 提供 `avatar_enabled`, `voice_live_enabled` 用于功能开关。

## 管理端页面

### VoiceLiveManagementPage (voice-live-management.tsx, 350行)
- 卡片列表展示所有 VL 实例
- 统计摘要（总数/已启用/已分配 HCP）
- CRUD + 删除确认 + 分配弹窗

### VlInstanceEditorPage (vl-instance-editor.tsx, 1119行)
- **左 30%**：配置表单（4 section: AI Model / Speech Input / Speech Output / Avatar）
- **右 70%**：Test Playground（复用 AvatarView + VoiceControls + 实时转写）
- 路由：`/admin/voice-live/new` 和 `/admin/voice-live/:id/edit`
