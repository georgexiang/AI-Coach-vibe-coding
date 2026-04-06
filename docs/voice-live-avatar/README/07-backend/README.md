# 第七章：后端实现 —— Python 服务端

> 返回 [学习导航](../index.md) | 上一章 [前端实现](../06-frontend/README.md) | 下一章 [架构选型](../08-architecture/README.md)

---

在前端完成 WebRTC 连接管理和媒体流渲染之后，一个自然的问题随之而来：**Python 服务端在 WebRTC 体系中扮演什么角色？需要用到哪些库？实现有多复杂？**

答案取决于一个关键判断：**服务端是否需要接触（"碰"）媒体流**。如果只做信令转发（SDP/ICE 消息的中继），那不需要任何 WebRTC 库，和普通 WebSocket 服务器一样简单；如果要转发甚至处理媒体流，才需要引入 `aiortc` 等专用库。本章将按照这三种角色逐一讲解，并给出生产环境的技术选型建议。

---

## 7.1 服务端角色决定实现复杂度

在 WebRTC 架构中，服务端可以承担三种截然不同的角色，每种角色对应的实现复杂度差异巨大。下面这张表格是理解后续所有内容的基础：

```
┌──────────────┬───────────────┬───────────────────────────────────────┐
│ 角色          │ 碰不碰媒体流？ │ 复杂度                               │
├──────────────┼───────────────┼───────────────────────────────────────┤
│ 信令服务器    │ ❌ 不碰        │ ★☆☆ 和 WebSocket 一样简单            │
│ (Signaling)  │ 只转发 SDP/ICE│ 就是 WebSocket 消息路由               │
├──────────────┼───────────────┼───────────────────────────────────────┤
│ 媒体转发服务器│ ⚠️ 转发但不处理│ ★★★ 需要专门的媒体服务器框架          │
│ (SFU)        │ 收A的流→发给B │ Python: aiortc / 更推荐: mediasoup   │
├──────────────┼───────────────┼───────────────────────────────────────┤
│ 媒体处理服务器│ ✅ 处理媒体    │ ★★★★ 需要编解码+WebRTC 全栈          │
│ (MCU/AI)     │ 解码→处理→编码│ Python: aiortc + opencv/ffmpeg       │
└──────────────┴───────────────┴───────────────────────────────────────┘
```

可以看到，从"信令"到"媒体处理"，复杂度跨越了几个量级。接下来我们依次展开。

---

## 7.2 信令服务器（本项目方案，最常见）

本项目的后端就是典型的**信令服务器**：服务端完全不碰 WebRTC 媒体流，只用 WebSocket 转发 SDP 和 ICE 候选。这是最常见也是最简单的方案。

### 完整的信令服务器示例

```python
# ===== 一个完整的 WebRTC 信令服务器 =====
# 依赖: pip install fastapi uvicorn websockets
# 注意: 不需要任何 WebRTC 库！

from fastapi import FastAPI, WebSocket
import json

app = FastAPI()
rooms: dict[str, list[WebSocket]] = {}

@app.websocket("/ws/{room_id}")
async def signaling(ws: WebSocket, room_id: str):
    await ws.accept()
    if room_id not in rooms:
        rooms[room_id] = []
    rooms[room_id].append(ws)

    try:
        while True:
            msg = await ws.receive_text()
            # 服务端做的事：原封不动转发给房间里的其他人
            for peer in rooms[room_id]:
                if peer != ws:
                    await peer.send_text(msg)
            # data["type"] == "offer"     → 转发 SDP Offer
            # data["type"] == "answer"    → 转发 SDP Answer
            # data["type"] == "candidate" → 转发 ICE Candidate
    except Exception:
        rooms[room_id].remove(ws)
```

这就是全部了——不到 20 行代码。服务端只需要懂 WebSocket，对 WebRTC 协议本身完全不需要了解。

### 对应的前端代码

```javascript
// 前端：通过信令服务器建立 WebRTC P2P 连接
const ws = new WebSocket(`wss://server/ws/room123`);
const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});

// 本地摄像头
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
stream.getTracks().forEach(track => pc.addTrack(track, stream));

// ICE candidate → 通过 WebSocket 发给对方
pc.onicecandidate = (e) => {
  if (e.candidate) ws.send(JSON.stringify({ type: "candidate", candidate: e.candidate }));
};

// 收到对方的媒体流
pc.ontrack = (e) => { document.getElementById("remoteVideo").srcObject = e.streams[0]; };

// 发起方：创建 Offer
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
ws.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));

// 收到信令消息
ws.onmessage = async (e) => {
  const data = JSON.parse(e.data);
  if (data.type === "offer") {
    await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: "answer", sdp: answer.sdp }));
  }
  if (data.type === "answer") await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
  if (data.type === "candidate") await pc.addIceCandidate(data.candidate);
};
```

### 数据流向

理解信令服务器的关键在于理解数据流向——服务端只参与信令交换，不参与媒体传输：

```
用户 A 浏览器                Python 服务端              用户 B 浏览器
     │                         │                          │
     │ ──SDP Offer──►         │                          │
     │   (WebSocket)          │ ──转发 Offer──►          │
     │                         │   (WebSocket)            │
     │                         │          ◄──SDP Answer── │
     │          ◄──转发 Answer──│           (WebSocket)    │
     │            (WebSocket)  │                          │
     │                         │                          │
     │ ══════════ WebRTC 媒体流（P2P直连）══════════════ │
     │           服务端完全不参与！                        │
     │           视频音频直接在两个浏览器之间流动           │

Python 服务端的工作量：
  ✅ 处理 WebSocket 连接
  ✅ 转发 JSON 消息（SDP、ICE candidate）
  ❌ 不处理任何音视频数据
  ❌ 不需要任何 WebRTC 库
```

这种架构下，音视频数据直接在两端之间点对点传输，服务端的压力极低。

---

## 7.3 SFU 媒体转发（多人视频会议）

当场景从 1v1 扩展到多人视频会议时，纯 P2P 架构会遇到带宽瓶颈。此时需要引入 SFU（Selective Forwarding Unit），服务端负责接收每个人的媒体流并转发给其他参与者。

### 为什么需要 SFU？

```
没有 SFU（纯 P2P，3人会议）：
  每个人要向其他 2 人各发一份流
  A ══► B    A ══► C    B ══► A    B ══► C    C ══► A    C ══► B
  每人上传 2 份 = 6 条流
  10 人会议 = 每人上传 9 份 = 90 条流 → 带宽爆炸

有 SFU（服务端转发）：
  每个人只上传 1 份给服务器，服务器转发给其他人
  A ══► SFU ══► B, C
  B ══► SFU ══► A, C
  C ══► SFU ══► A, B
  每人上传 1 份 = 3 条上行，SFU 负责复制转发
  10 人会议 = 每人上传 1 份 = 10 条上行 → 可控
```

### Python 用 aiortc 实现 SFU（简化示例）

```python
# 依赖: pip install aiortc aiohttp
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaRelay
from aiohttp import web

relay = MediaRelay()
peers: dict[str, RTCPeerConnection] = {}

async def offer_handler(request):
    params = await request.json()
    user_id = params["user_id"]
    pc = RTCPeerConnection()
    peers[user_id] = pc

    @pc.on("track")
    async def on_track(track):
        # 收到一个用户的媒体轨道 → 转发给其他人
        for other_id, other_pc in peers.items():
            if other_id != user_id:
                other_pc.addTrack(relay.subscribe(track))  # 零拷贝复制

    offer = RTCSessionDescription(sdp=params["sdp"], type="offer")
    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    return web.json_response({"sdp": pc.localDescription.sdp, "type": "answer"})
```

`aiortc` 提供了 Python 原生的 WebRTC 实现，`MediaRelay` 可以高效地将一个 track 复制分发给多个接收者。这对于原型验证和小规模场景已经够用。

---

## 7.4 媒体处理服务器（AI 分析/录制/混流）

最复杂的场景是服务端不仅要接收 WebRTC 流，还要对媒体数据进行解码、AI 处理（如人脸检测、情感分析）、再编码后发回客户端。

```python
# 依赖: pip install aiortc opencv-python-headless numpy
from aiortc import VideoStreamTrack
from av import VideoFrame
import cv2

class AIProcessedVideoTrack(VideoStreamTrack):
    """接收视频帧 → AI 处理 → 返回处理后的帧"""
    def __init__(self, source_track):
        super().__init__()
        self.source = source_track

    async def recv(self):
        frame = await self.source.recv()
        img = frame.to_ndarray(format="bgr24")      # 解码为 OpenCV 格式

        # AI 处理（如人脸检测）
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        for (x, y, w, h) in faces:
            cv2.rectangle(img, (x, y), (x+w, y+h), (0, 255, 0), 2)

        new_frame = VideoFrame.from_ndarray(img, format="bgr24")
        new_frame.pts = frame.pts
        new_frame.time_base = frame.time_base
        return new_frame                              # 编码后发回客户端
```

这种模式下，服务端需要完整的视频编解码能力，CPU 开销显著增加。适用于 AI 监控、实时字幕叠加、虚拟背景替换等场景。

---

## 7.5 三种场景的技术选型对比

了解了三种角色之后，我们可以从多个维度进行横向对比，以便在实际项目中做出正确选型：

```
┌──────────────┬─────────────────┬────────────────────┬──────────────────┐
│              │ 场景1: 信令      │ 场景2: SFU 转发     │ 场景3: 媒体处理   │
├──────────────┼─────────────────┼────────────────────┼──────────────────┤
│ Python 库    │ 无需WebRTC库     │ aiortc             │ aiortc + av      │
│              │ fastapi/aiohttp  │                    │ + opencv         │
├──────────────┼─────────────────┼────────────────────┼──────────────────┤
│ 协议处理      │ 只处理WebSocket  │ WebSocket + WebRTC │ WebSocket+WebRTC │
│              │ (JSON 转发)      │ (RTP 包转发)       │ (完整编解码)      │
├──────────────┼─────────────────┼────────────────────┼──────────────────┤
│ CPU 开销      │ 极低             │ 中等（网络IO）     │ 高（编解码+AI）  │
├──────────────┼─────────────────┼────────────────────┼──────────────────┤
│ 适用场景      │ 1v1 视频通话     │ 多人视频会议       │ AI监控/录制/     │
│              │ 本项目的后端      │ 直播间             │ 虚拟背景/字幕    │
├──────────────┼─────────────────┼────────────────────┼──────────────────┤
│ 生产环境推荐  │ ✅ Python 足够   │ ⚠️ 推荐 mediasoup │ ⚠️ 推荐专用引擎 │
│              │                 │ (Node.js) 或       │ 或 C/Rust 实现   │
│              │                 │ Janus (C)          │                  │
└──────────────┴─────────────────┴────────────────────┴──────────────────┘
```

核心结论很明确：对于本项目这样只需要信令转发的场景，Python + FastAPI 就是最佳选择；而对于需要碰媒体流的场景，Python 更适合做原型验证，生产环境则应考虑专用引擎。

---

## 7.6 生产级 SFU/MCU 方案

如果你的项目确实需要在服务端处理媒体流（如多人视频会议、直播间），需要了解 `aiortc` 的局限性以及更成熟的替代方案。

### aiortc 的定位

```
aiortc 的定位：
  ✅ 功能完整，API 优雅，学习和原型开发首选
  ❌ 单线程 Python 处理 RTP → 高并发下 CPU 瓶颈
  ❌ 视频编解码（libav）在 Python 中开销大
  ❌ 没有大规模生产验证（不像 mediasoup/Janus）
```

### 生产级方案对比

```
生产级方案对比：
  ┌─────────────────┬───────────┬──────────────────────────┐
  │ 方案              │ 语言      │ 特点                      │
  ├─────────────────┼───────────┼──────────────────────────┤
  │ mediasoup        │ Node.js+C │ 最流行的 SFU，性能好      │
  │ Janus Gateway    │ C         │ 功能丰富，插件架构         │
  │ Pion             │ Go        │ 纯 Go，易部署             │
  │ LiveKit          │ Go        │ 开箱即用，自带前端 SDK     │
  │ aiortc           │ Python    │ 原型/小规模/AI处理场景    │
  └─────────────────┴───────────┴──────────────────────────┘
```

### 推荐的混合架构

最佳实践是将 Python 的优势（业务逻辑、AI 集成）与专用媒体引擎的优势（高性能媒体处理）结合起来：

```
  推荐架构模式：信令用 Python，媒体处理用专用引擎
    Python FastAPI (信令+业务逻辑) → 调用 mediasoup/LiveKit API (媒体转发)
```

---

## 本章小结

WebSocket 信令服务器用纯 Python 就够了（本项目就是这样），不需要任何 WebRTC 库。如果需要服务端碰媒体流（SFU 转发或 AI 处理），用 `aiortc` 可以快速原型开发，但生产环境推荐用 mediasoup/LiveKit 等专用引擎处理媒体，Python 专注于信令和业务逻辑。

---

> 返回 [学习导航](../index.md) | 上一章 [前端实现](../06-frontend/README.md) | 下一章 [架构选型](../08-architecture/README.md)
