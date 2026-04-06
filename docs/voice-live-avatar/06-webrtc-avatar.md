# 06 — WebRTC Avatar 集成

源码：`frontend/src/hooks/use-avatar-stream.ts` (229行)

## 概述

Avatar 通过 **WebRTC** 传输视频（H.264）和音频流。ICE/SDP 协商消息通过已有的 Voice Live WebSocket 通道传递（非独立信令服务器）。

## 完整 ICE/SDP 协商流程

```
                    WebSocket Channel                          WebRTC Channel
Browser             (已建立)          Backend/Azure            Azure Avatar
   │                                      │                        │
   │  session.updated                     │                        │
   │  (含 ice_servers + credentials)      │                        │
   │◄─────────────────────────────────────│                        │
   │                                      │                        │
   │  1. new RTCPeerConnection(iceServers)│                        │
   │  2. addTransceiver("video", recvonly)│                        │
   │  3. addTransceiver("audio", recvonly)│                        │
   │  4. createOffer()                    │                        │
   │  5. setLocalDescription(offer)       │                        │
   │  6. ICE gathering...                 │                        │
   │     (wait for null candidate         │                        │
   │      or gatheringState=complete      │                        │
   │      or 8s timeout)                  │                        │
   │                                      │                        │
   │  session.avatar.connect              │                        │
   │  {client_sdp: btoa(JSON.stringify(   │                        │
   │    {type:"offer", sdp:...}))}        │  转发到 Azure          │
   │─────────────────────────────────────►│───────────────────────►│
   │                                      │                        │
   │  session.updated (含 server_sdp)     │                        │
   │◄─────────────────────────────────────│◄───────────────────────│
   │                                      │                        │
   │  7. decode: JSON.parse(atob(sdp))    │                        │
   │  8. setRemoteDescription(answer)     │                        │
   │                                      │                        │
   │◄══════════════ WebRTC Media ═══════════════════════════════►│
   │  Video: H.264 → <video> element      │                        │
   │  Audio: Opus → hidden <audio> element │                        │
```

## ICE Server 提取

ICE servers 从 `session.updated` 事件中提取，搜索多个路径（兼容不同 API 版本）：

```typescript
// frontend/src/hooks/use-voice-live.ts (lines 146-186)
const avatarConfig = event.session?.avatar
    || event.session?.rtc
    || event.session
    || event;

const iceServers = avatarConfig?.ice_servers || [];

// Session 级别 TURN 凭据应用到所有 server
const username = event.session?.ice_username || avatarConfig?.ice_username;
const credential = event.session?.ice_credential || avatarConfig?.ice_credential;

if (username && credential) {
  iceServers.forEach(server => {
    server.username = server.username || username;
    server.credential = server.credential || credential;
  });
}
```

## SDP 编码格式

```typescript
// Offer 编码（发送给 Azure）
const sdpOffer = btoa(JSON.stringify({
  type: "offer",
  sdp: pc.localDescription.sdp
}));
// 发送: { type: "session.avatar.connect", client_sdp: sdpOffer }

// Answer 解码（从 Azure 接收）
// 主路径：Base64 JSON
const parsed = JSON.parse(atob(rawServerSdp));
const answerSdp = parsed.sdp;
// 降级路径：直接字符串
const answerSdp = rawServerSdp;

pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
```

## 媒体流处理

```typescript
// Video → 绑定到已有 <video> ref
pc.ontrack = (event) => {
  if (event.track.kind === "video" && videoRef.current) {
    videoRef.current.srcObject = new MediaStream([event.track]);
  }
  if (event.track.kind === "audio") {
    // Audio → 动态创建隐藏 <audio> 元素
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.srcObject = new MediaStream([event.track]);
    document.body.appendChild(audioEl);
    audioElRef.current = audioEl;
  }
};
```

## AvatarView 渲染层级

```typescript
// frontend/src/components/voice/avatar-view.tsx
// 4 层叠加，通过 opacity + z-index 控制可见性

<div className="relative">
  {/* Layer 1: WebRTC video (始终在 DOM，连接后 opacity-100) */}
  <video ref={videoRef} autoPlay playsInline
    className={isAvatarConnected ? "opacity-100 z-10" : "opacity-0 z-0"} />

  {/* Layer 2: Static thumbnail (连接前显示) */}
  {!isAvatarConnected && avatarCharacter && (
    <img src={cdnThumbnailUrl} />
  )}

  {/* Layer 3: AudioOrb fallback (无 avatar 时) */}
  {!avatarEnabled && <AudioOrb audioState={audioState} />}

  {/* Layer 4: Skeleton (WebRTC 协商中) */}
  {isConnecting && <Skeleton />}
</div>
```

## Avatar 类型

| 类型 | 技术 | 特点 | 后端配置 |
|------|------|------|----------|
| **Video Avatar** | WebRTC H.264 | 6 角色，多样式变体，全身动作 | `AvatarConfig(character, style, video=VideoParams(codec="h264"))` |
| **Photo Avatar** | VASA-1 模型 | 24 角色，照片驱动，面部动画 | `{"type": "photo-avatar", "model": "vasa-1", "character": id}` |

## 关键注意事项

1. **ICE Gathering 超时** — 8 秒安全超时，防止 ICE gathering 挂起
2. **SDP Answer 超时** — 15 秒等待 server SDP 回复
3. **音频元素** — 必须 `appendChild` 到 `document.body`，否则某些浏览器不播放
4. **bundlePolicy** — 使用 `max-bundle` 减少 ICE candidate 数量
5. **recvonly** — 仅接收模式，不上传本地媒体（音频通过 WebSocket 发送）
6. **清理** — disconnect 时必须 close RTCPeerConnection + remove audio element + clear video srcObject
