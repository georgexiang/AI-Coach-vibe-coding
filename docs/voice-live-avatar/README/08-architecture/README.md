# 第八章：架构选型 —— 场景驱动的技术决策

> 返回 [学习导航](../index.md) | 上一章 [后端实现](../07-backend/README.md) | 下一章 [生产环境](../09-production/README.md)

---

在掌握了 WebSocket 和 WebRTC 的底层原理之后，面对实际项目时往往会遇到一个核心问题：**我要做的东西应该用 WebSocket 还是 WebRTC？还是两者配合？**

答案取决于你要做的事情。WebSocket 管"信令和数据"，WebRTC 管"实时音视频"。大多数场景需要两者配合，但主次不同。本章通过四种典型场景的对比分析，帮助你建立场景驱动的技术选型思维。

---

## 8.1 四种典型场景

不同的应用场景对实时性、带宽、方向性的需求截然不同，下面分别分析每种场景的架构特点。

### 场景 1：视频会议（如 Zoom/Teams）

```
WebRTC = 主角（音视频传输）
WebSocket = 配角（信令 + 聊天 + 控制）

┌─────────────┐     WebRTC (音视频)      ┌─────────────┐
│  用户 A 浏览器 │◄═══════════════════════►│  用户 B 浏览器 │
│             │                          │             │
│  摄像头+麦克风 │     WebSocket (信令)     │  摄像头+麦克风 │
│             │◄────────────────────────►│             │
└──────┬──────┘                          └──────┬──────┘
       │ WebSocket                              │ WebSocket
       ▼                                        ▼
┌──────────────────────────────────────────────────────┐
│              信令服务器 (WebSocket)                     │
│  - SDP Offer/Answer 交换                               │
│  - ICE candidate 中继                                  │
│  - 聊天消息、举手、静音状态                               │
│  - 房间管理（谁在线、谁退出）                             │
└──────────────────────────────────────────────────────┘

特点：
  - WebRTC 负责：摄像头视频 + 麦克风音频 + 屏幕共享
  - WebSocket 负责：房间信令、SDP 交换、文字聊天、状态同步
  - Transceiver direction: "sendrecv"（双向收发）
  - 可能需要 SFU 服务器（多人会议时中转视频流）
```

视频会议是 WebRTC 最经典的应用场景，WebRTC 承载核心的音视频传输，WebSocket 做辅助的信令和控制。

### 场景 2：直播/视频媒体播放（如 B站/YouTube Live）

直播场景有多种技术方案可选，延迟要求决定了最终选型：

```
方案 A: 纯 WebSocket（低延迟直播，如弹幕互动）
  观众浏览器 ◄── WebSocket ── 服务器 ◄── 推流端
  - 视频帧编码为二进制通过 WebSocket 传输
  - 延迟 ~1-3s，足够应对大多数互动场景
  - 优点：实现简单，服务端可以广播给所有观众
  - 缺点：TCP 拥塞可能导致卡顿

方案 B: WebRTC（超低延迟直播，如拍卖/电竞）
  观众浏览器 ◄═══ WebRTC ═══ 媒体服务器 ◄═══ 推流端
  - Transceiver direction: "recvonly"（观众只收）
  - 延迟 < 500ms
  - 优点：延迟最低，浏览器硬件解码
  - 缺点：需要 SFU/MCU 媒体服务器支撑大量观众

方案 C: HLS/DASH（传统点播/直播）
  观众浏览器 ◄── HTTP ── CDN ◄── 编码服务器
  - 视频切片通过 HTTP 分发
  - 延迟 5-30s
  - 优点：CDN 缓存，支撑百万观众
  - 缺点：延迟高，不适合强互动
```

### 场景 3：AI 数字人对话（本项目！）

本项目的架构比较特殊，WebSocket 和 WebRTC 并行工作，各自承担不同的数据通道：

```
WebSocket + WebRTC 并行

  WebSocket: 用户语音（base64 上行）+ AI 文字（下行）+ 控制信令
  WebRTC:    数字人视频+音频（下行 recvonly）

  特殊之处：
  - WebRTC 只用于 Avatar 视频，不传用户的媒体
  - 用户音频通过 WebSocket 走后端代理（保护 API Key）
  - 和视频会议最大的区别：WebRTC 是单向的（recvonly）
```

### 场景 4：在线教育白板/协作

```
WebSocket = 主角（实时数据同步）
WebRTC = 可选（如果需要视频/语音）

  WebSocket: 画笔轨迹、文档编辑、光标位置、聊天
  WebRTC:    老师的摄像头/屏幕共享（如果需要）

  白板数据是 JSON，用 WebSocket 足够
  视频/语音才需要 WebRTC
```

---

## 8.2 选择决策树

面对新项目时，可以按照下面的决策树快速定位应该用哪种技术：

```
你要传什么？
  │
  ├── 纯文本/JSON/控制指令 ─────────────────► WebSocket 就够了
  │   (聊天、状态同步、通知推送)
  │
  ├── 音频/视频（实时性要求高 < 500ms）────► WebRTC
  │   (视频通话、低延迟直播)                    + WebSocket 做信令
  │
  ├── 音频/视频（延迟 1-5s 可接受）─────────► WebSocket 传二进制
  │   (直播弹幕、语音消息)                     或 HLS/DASH
  │
  └── 混合场景 ─────────────────────────────► WebSocket + WebRTC 并行
      (AI数字人、在线教育、远程医疗)             各管各的
```

核心原则是：**文本/控制走 WebSocket，实时音视频走 WebRTC，混合场景两者并行**。不要过度设计——能用 WebSocket 解决的就不要引入 WebRTC。

---

## 8.3 本项目 vs 标准视频会议的区别

对于已经了解视频会议架构的读者，理解本项目和标准视频会议的差异至关重要。下表从多个维度进行对比：

| 维度 | 本项目（AI 数字人） | 标准视频会议（Zoom） |
|------|-------------------|---------------------|
| **WebRTC 方向** | `recvonly`（只看数字人） | `sendrecv`（双向音视频） |
| **用户摄像头** | 不需要 | 需要（上传视频流） |
| **用户麦克风音频** | 走 WebSocket（base64） | 走 WebRTC（直接传） |
| **为什么音频不走 WebRTC** | 后端需要代理保护 API Key | 不需要代理，直连对方 |
| **信令服务器** | 后端 FastAPI（WebSocket proxy） | 独立信令服务器 |
| **媒体服务器** | 不需要（Azure Avatar 直推） | 大规模需要 SFU |
| **SDP 交换** | 通过业务 WebSocket | 通过独立信令 WebSocket |

最关键的区别在于 **WebRTC 的方向性**：本项目是单向接收（`recvonly`），而视频会议是双向收发（`sendrecv`）。这个差异决定了本项目不需要处理本地 MediaStream、不需要媒体服务器，架构大幅简化。

---

## 8.4 从零开始做视频会议的架构大纲

如果你的下一个项目是做视频会议而不是 AI 数字人，以下是需要准备的架构蓝图：

```
Frontend
├── useSignaling()        ← WebSocket hook: 房间管理 + SDP 交换
├── useMediaStream()      ← WebRTC hook: 本地摄像头/麦克风
├── usePeerConnection()   ← WebRTC hook: 和对方建立音视频连接
├── useScreenShare()      ← WebRTC hook: 屏幕共享
├── useChat()             ← WebSocket hook: 文字聊天
└── <VideoGrid />         ← UI: 多个 <video> 元素

Backend
├── signaling-server      ← WebSocket: SDP/ICE 中转 + 房间管理
├── TURN server           ← coturn: NAT 穿透中继
└── SFU (可选)            ← mediasoup/Janus: 多人会议媒体转发

关键区别：
  - direction: "sendrecv"（双向，不是 recvonly）
  - 需要处理本地 MediaStream（getUserMedia）
  - 需要处理多人场景（N 个 PeerConnection 或 SFU）
  - 不需要后端代理音频（没有 API Key 要保护）
```

对比本项目的架构，视频会议多出了本地媒体采集（`getUserMedia`）、多人连接管理、SFU 中转等复杂度。但信令层面的 WebSocket 使用方式是相似的，本章以及前面章节学到的 SDP/ICE 知识可以直接复用。

---

## 本章小结

技术选型不存在"银弹"——WebSocket 和 WebRTC 各有所长，选择取决于具体场景。记住决策树的核心逻辑：纯数据用 WebSocket，实时音视频用 WebRTC，混合场景两者并行。理解本项目与标准视频会议的架构差异，有助于你在未来的项目中做出更准确的技术判断。

---

> 返回 [学习导航](../index.md) | 上一章 [后端实现](../07-backend/README.md) | 下一章 [生产环境](../09-production/README.md)
