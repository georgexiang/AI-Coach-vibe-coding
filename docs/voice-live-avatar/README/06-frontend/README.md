> 📖 返回 [学习导航](../index.md) | 上一章 ← [Azure Voice Live API](../05-azure-voice-live/README.md) | 下一章 → [后端实现](../07-backend/README.md)

# 第六章：前端实现

本章将带你走进前端代码的核心部分。你将看到 WebSocket 和 WebRTC 两种协议在真实项目中的连接代码长什么样、用了哪些 JS 库、以及 UI 组件和协议之间是如何映射的。读完本章，你将能够理解整个前端语音交互层的工作原理。

> 关于流媒体如何渲染到页面上（`<video>` / `<audio>` 标签、srcObject 绑定、状态切换等），请参阅 → [6A. 流媒体渲染与 UI 组件](./media-rendering.md)

---

## 6.1 WebSocket 连接代码详解（use-voice-live.ts）

WebSocket 是本项目中承载所有文本、控制指令和音频数据的通道。它的连接过程非常简洁——一行代码即可建立。

```typescript
// ===== WebSocket: 一行代码建立连接 =====

// 构造 URL
const protocol = location.protocol === "https:" ? "wss:" : "ws:";
const token = localStorage.getItem("access_token") ?? "";
const wsUrl = `${protocol}//${location.host}/api/v1/voice-live/ws?token=${encodeURIComponent(token)}`;

// 一行连接
const ws = new WebSocket(wsUrl);               // ← 就这一行

// 连接成功后，发 JSON 消息
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "session.update",
    session: {
      hcp_profile_id: hcpProfileId,
      system_prompt: systemPrompt,
    },
  }));
};

// 收消息
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // msg.type: "session.created", "response.audio.delta", "response.audio_transcript.delta" ...
};

// 发送用户音频
ws.send(JSON.stringify({
  type: "input_audio_buffer.append",
  audio: "base64编码的PCM16音频..."      // ← 音频塞在 JSON 字符串里
}));
```

可以看到，WebSocket 的使用模式非常直接：

1. **构造 URL**：根据当前页面协议选择 `ws:` 或 `wss:`，附上 JWT token 用于鉴权。
2. **一行建连**：`new WebSocket(wsUrl)` 就完成了。
3. **发消息**：`ws.send()` 发送 JSON 字符串。
4. **收消息**：`ws.onmessage` 回调接收服务端推送。

所有数据——包括音频——都以 JSON 文本帧的形式传输。音频被 base64 编码后塞进 JSON 字符串里。

---

## 6.2 WebRTC 连接代码详解（use-avatar-stream.ts）

WebRTC 用于接收数字人的实时视频和音频流。与 WebSocket 不同，WebRTC 的建连是一套多步协商流程。

```typescript
// ===== WebRTC: 一整套协商流程 =====

// 没有 URL！用 ICE servers 配置（从 WebSocket 消息获得）
const pc = new RTCPeerConnection({             // ← 创建连接对象
  iceServers: [                                //    但此时还没真正连通
    {
      urls: "turn:xxx.communication.azure.com:3478",
      username: "临时用户名",
      credential: "临时密码"
    }
  ],
  bundlePolicy: "max-bundle",
});

// 声明"我只接收，不发送"
pc.addTransceiver("video", { direction: "recvonly" });
pc.addTransceiver("audio", { direction: "recvonly" });

// 收到媒体流 → 渲染到 HTML 元素
pc.ontrack = (event) => {
  if (event.track.kind === "video") {
    videoElement.srcObject = event.streams[0];  // ← 视频直接绑到 <video> 标签
  }
  if (event.track.kind === "audio") {
    audioElement.srcObject = event.streams[0];  // ← 音频绑到 <audio> 标签
  }
};

// 创建 SDP Offer（"我的能力清单"）
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

// 等 ICE gathering 完成（探测网络路径，约 2-8 秒）
// ... 等待 onicecandidate 返回 null 或超时 ...

// 把 SDP Offer 通过 WebSocket 发给 Azure（注意！借用 WebSocket 通道）
const encodedSdp = btoa(JSON.stringify({ type: "offer", sdp: offer.sdp }));
ws.send(JSON.stringify({
  type: "session.avatar.connect",
  client_sdp: encodedSdp                       // ← SDP 协商走 WebSocket
}));

// 等 Azure 返回 SDP Answer（也通过 WebSocket 回来）
// ... 等待 ws.onmessage 收到 server_sdp ...
const answer = JSON.parse(atob(serverSdp));

// 设置对方的 SDP
await pc.setRemoteDescription({                 // ← 此刻 WebRTC 才真正连通！
  type: "answer",
  sdp: answer.sdp
});

// 之后 pc.ontrack 自动触发，视频和音频流开始
```

WebRTC 的建连过程可以拆解为以下关键步骤：

1. **创建 RTCPeerConnection**：用 ICE servers 配置初始化，但此时还没有真正连通。
2. **声明方向**：`addTransceiver` 告诉对方我们只接收（`recvonly`），不发送媒体。
3. **设置 ontrack 回调**：当媒体流到达时，自动绑定到 HTML 元素上。
4. **SDP 协商**：创建 Offer → 等待 ICE gathering → 通过 WebSocket 发给 Azure → 收到 Answer → 设置 RemoteDescription。
5. **流自动开始**：协商完成后，`pc.ontrack` 自动触发，视频和音频流开始推送。

注意一个重要细节：**SDP 协商借用了 WebSocket 通道**。WebRTC 本身没有信令机制，需要借助其他通道（这里是 WebSocket）来交换 SDP。

---

## 6.3 核心差异对比

把两种协议放在一起看，差异一目了然：

```
WebSocket                                 WebRTC
─────────────────────────                 ──────────────────────────────
new WebSocket(url)         ←── 1 行     new RTCPeerConnection(config)
                                          + addTransceiver × 2
                                          + createOffer
                                          + setLocalDescription
                                          + ICE gathering (2-8 秒)
                                          + SDP 交换 (借 WebSocket)
                                          + setRemoteDescription
                                          ←── 7+ 步，异步，可能失败

ws.send(JSON.stringify({}))  发数据      pc.ontrack 自动收到媒体流
ws.onmessage               收数据      （不需要手动"收"，流自动推）

JSON 文本帧                  数据格式     RTP 媒体包（H.264/Opus）
可传任何 JSON                             只传音频和视频流

TCP，可靠有序                 协议        UDP，快但可能丢包
wss://host/path              地址        无 URL，ICE 协商动态发现

主动 send()                  通信方式     被动接收（recvonly）
双向                                    本项目中单向（只收不发）
```

简单总结：WebSocket 是"轻量级文本通道"，一行连通，双向 JSON 消息；WebRTC 是"重量级媒体通道"，多步协商，单向流媒体推送。两者在本项目中协同工作，各司其职。

---

## 6.4 依赖库对比（为什么不用第三方库）

一个令人惊讶的事实是：**两个协议都使用浏览器原生 API，零第三方依赖。**

### 完整依赖对比

| 维度 | WebSocket | WebRTC |
|------|-----------|--------|
| **核心 API** | `new WebSocket(url)` | `new RTCPeerConnection(config)` |
| **是否浏览器原生** | 是，所有现代浏览器内置 | 是，所有现代浏览器内置 |
| **需要安装 npm 包？** | 不需要 | 不需要 |
| **数据发送** | `ws.send(string)` | 不发（recvonly），或 `RTCDataChannel` |
| **数据接收** | `ws.onmessage` | `pc.ontrack`（媒体流自动推） |
| **关联原生 API** | 无 | `RTCSessionDescription`、`MediaStream`、`HTMLVideoElement`、`HTMLAudioElement` |
| **音频采集** | `AudioWorklet` + `AudioContext`（也是浏览器原生） | 不需要（不采集） |

### 源码中的 import 对比

```typescript
// use-voice-live.ts — WebSocket hook
import { useCallback, useRef, useState } from "react";  // 只有 React hooks
// 没有任何 WebSocket 的 import，因为 WebSocket 是全局对象 (window.WebSocket)

// use-avatar-stream.ts — WebRTC hook
import { useCallback, useRef, useState } from "react";  // 只有 React hooks
// 没有任何 WebRTC 的 import，因为 RTCPeerConnection 是全局对象 (window.RTCPeerConnection)
```

**两个 hook 的 import 完全一样**——只有 React 的 hooks。所有网络协议能力都来自浏览器自身。

### 为什么不用第三方库？

| 常见库 | 为什么没用 |
|--------|-----------|
| `socket.io` | 提供自动重连/房间等高级功能，但这里后端是 FastAPI 原生 WebSocket，不需要 socket.io 协议 |
| `simple-peer` | WebRTC 的简化封装，但本项目的 WebRTC 场景很简单（单向接收），用原生 API 更可控 |
| `peerjs` | P2P 通信库，但这里不是 P2P 场景，是浏览器→Azure 单向接收 |
| `mediasoup-client` | SFU 客户端，用于多人视频会议。这里是 1 对 1，不需要 |
| `webrtc-adapter` | 浏览器兼容 polyfill。现代浏览器已统一 API，不再需要 |

> **设计原则**：前端零第三方语音/WebRTC 依赖，全部使用浏览器原生 API。这减少了包体积，避免了版本兼容问题，也让代码更透明可调试。

---

## 6.5 UI 组件与协议的映射关系

前端的组件并非全部绑定在某一个协议上——有些是共享的，有些是某个协议独占的。下面是完整的组件树和它们的协议归属。

```
VoiceSession (voice-session.tsx) ── 主编排组件，同时管理两个协议
│
├── LEFT PANEL
│   ├── AvatarView (avatar-view.tsx)                    ← WebRTC 独占
│   │   ├── <video ref={videoRef}> ..................... WebRTC ontrack → video
│   │   ├── 隐藏的 <audio> ............................ WebRTC ontrack → audio
│   │   ├── 静态缩略图 <img> .......................... 无协议（纯 UI）
│   │   └── AudioOrb .................................. 无协议（纯 UI 动画）
│   │
│   └── VoiceControls (voice-controls.tsx)              ← 共享（协议无关）
│       ├── 麦克风按钮 ─── toggleMute() ............... → useVoiceLive (WebSocket)
│       ├── 结束通话按钮 ─── disconnect() ............. → 两个协议都断开
│       ├── 键盘切换按钮 ............................... 纯 UI 状态
│       └── 全屏按钮 ................................... 纯 UI 状态
│
└── RIGHT PANEL
    ├── VoiceTranscript (voice-transcript.tsx)           ← WebSocket 独占（数据源）
    │   └── 聊天气泡 ─── transcript 数据 .............. ← 来自 WebSocket 消息
    │
    └── VoiceConfigPanel (voice-config-panel.tsx)        ← 共享（协议无关）
        └── 语言选择、自动检测等 ....................... 纯 UI 配置
```

### 详细分类

| 组件 | 数据来自哪个协议 | 说明 |
|------|-----------------|------|
| **AvatarView `<video>`** | WebRTC 独占 | `pc.ontrack` 把视频流绑定到 `videoRef`，纯 WebRTC 驱动 |
| **AvatarView 隐藏 `<audio>`** | WebRTC 独占 | `pc.ontrack` 创建 `<audio>` 元素，播放数字人口型同步的声音 |
| **AvatarView 静态缩略图** | 无协议 | 连接前显示 Azure CDN 上的角色图片，不涉及任何通信 |
| **AvatarView AudioOrb** | 无协议 | 纯语音模式（无数字人）时显示的动画球，根据 `audioState` 变化 |
| **VoiceTranscript** | WebSocket 独占 | 文字转写全部来自 WebSocket 的 `transcript.delta` / `transcript.done` |
| **VoiceControls** | 协议无关 | 按钮触发 hook 函数（`toggleMute`、`disconnect`），不直接碰协议 |
| **VoiceConfigPanel** | 协议无关 | 纯配置 UI，修改本地 state |
| **useAudioPlayer** | WebSocket | 纯语音模式下，播放 `response.audio.delta`（base64 PCM16）。Avatar 模式下不使用（音频走 WebRTC） |

---

## 6.6 模式切换时的组件变化

项目支持两种运行模式：**纯语音模式**和**数字人 Avatar 模式**。切换模式时，同一套组件会展示不同的状态。

```
┌──────────────────────┬──────────────────────┬──────────────────────┐
│                      │  纯语音模式           │  数字人 Avatar 模式   │
│                      │  (voice_realtime)     │  (digital_human)     │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ AvatarView <video>   │  opacity-0 (隐藏)    │  opacity-100 (显示)  │
│ AvatarView AudioOrb  │  显示 (动画波形球)    │  隐藏                │
│ WebRTC <audio>       │  不存在              │  存在 (播放数字人声音) │
│ useAudioPlayer       │  播放 WS 音频        │  不播放 (避免重复)    │
│ VoiceTranscript      │  显示 (文字来自 WS)   │  显示 (文字来自 WS)  │
│ VoiceControls        │  完全相同            │  完全相同             │
│ VoiceConfigPanel     │  完全相同            │  完全相同             │
└──────────────────────┴──────────────────────┴──────────────────────┘

关键切换逻辑在 voice-session.tsx:
  const resolvedMode = result.avatarEnabled
    ? "digital_human_realtime_model"    // WebSocket + WebRTC
    : "voice_realtime_model";           // 仅 WebSocket
```

核心思路是：**纯语音模式只用 WebSocket**（文字、控制、音频全走 WebSocket），**数字人模式同时用 WebSocket + WebRTC**（文字和控制走 WebSocket，视频和音频走 WebRTC）。切换时只需改变 `resolvedMode`，组件自动根据模式调整自己的可见性和行为。

---

## 6.7 Hooks 与协议的对应

整个前端语音交互层由四个 hook 组成，各管一件事：

```
useVoiceLive      ── WebSocket ── 管理 ws 连接、发送/接收 JSON 消息
useAvatarStream   ── WebRTC   ── 管理 RTCPeerConnection、ICE/SDP、媒体流
useAudioHandler   ── 无协议   ── 管理麦克风采集（AudioWorklet），产出 Float32 → 由 useVoiceLive 发送
useAudioPlayer    ── 无协议   ── 管理音频播放（AudioBuffer），消费 useVoiceLive 收到的 audio.delta
```

四个 hook 通过 `VoiceSession` 这个编排组件串联起来。`VoiceSession` 就像"导演"，WebSocket 和 WebRTC 就像两个"演员"，各自表演不同的部分，但在同一个舞台上。

---

## 延伸阅读

流媒体到达前端之后，如何渲染到页面上？`<video>` 标签怎么绑定实时流？状态切换时 UI 如何变化？这些问题在子章节中详细解答：

> **→ [6A. 流媒体渲染与 UI 组件](./media-rendering.md)**
>
> 涵盖：srcObject 概念、video 标签渲染、UI 层次结构、状态切换、四个渲染技巧、通用组件速查、四种音频播放对比。
