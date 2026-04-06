# 第二章：WebSocket 与 WebRTC 的关系

> 📖 返回 [学习导航](../index.md) | 上一章 ← [全局概览](../01-overview/README.md) | 下一章 → [WebRTC 深入](../03-webrtc-deep-dive/README.md)

---

在第一章中，我们了解了 Azure Voice Live + Avatar 系统的整体架构。你可能已经注意到，系统中同时存在 WebSocket 和 WebRTC 两种实时通信协议。初学者常常会困惑：它们是什么关系？WebRTC 是不是"建立在 WebSocket 之上"的？Azure 到底有几个 endpoint？

本章将系统性地解答这些问题，帮助你建立对这两种协议关系的准确认知。

---

## 2.1 三种连接的 URI 对比

Azure Voice Live API 只有一个 endpoint，但在整个系统中，浏览器实际需要建立三条不同性质的连接。我们先来对比它们的 URI 和协议差异：

```
连接 1: 浏览器 → 后端 WebSocket
   URI: wss://your-backend.com/api/v1/voice-live/ws?token=JWT
   协议: WebSocket over TLS (TCP)
   发起方: 浏览器 new WebSocket(url)

连接 2: 后端 → Azure Voice Live API (Python SDK)
   URI: https://your-project.services.ai.azure.com  ← 唯一的 Azure endpoint
   协议: Azure SDK 封装（底层也是 WebSocket）
   发起方: azure.ai.voicelive.aio.connect(endpoint=..., credential=AzureKeyCredential(key))

连接 3: 浏览器 → Azure Avatar 服务 (WebRTC)
   URI: ❌ 没有 URL！
   协议: WebRTC (SRTP/DTLS over UDP)
   发起方: 浏览器 new RTCPeerConnection(config)
```

你会发现，连接 1 和连接 2 都有明确的 URI——一个是你自己后端的 WebSocket 地址，一个是 Azure AI Foundry 的 HTTPS 地址。但连接 3 是特殊的：WebRTC **没有 URL**。这是理解两种协议关系的关键起点。

同时值得注意的是，当你通过 SDK 配置会话时加上 `modalities: ["text", "audio", "avatar"]`，Azure 就会同时启用两个能力：

- WebSocket 通道的文字+音频（自动提供）
- WebRTC 通道的 Avatar 视频+音频（返回 ICE servers + 处理 SDP 协商）

它们是同一个 API session 的两个"输出通道"，不是两个独立的服务。

---

## 2.2 为什么 WebRTC 没有 URL

WebSocket 和 WebRTC 在连接建立方式上有着本质区别。下表从四个维度进行对比：

| 维度 | WebSocket | WebRTC |
|------|-----------|--------|
| **连接方式** | 像打电话：拨一个号码（URL），对方接通 | 像约会：先交换地址（SDP），然后各自找路见面 |
| **寻址** | 有明确的 URL：`wss://host/path` | 没有 URL，通过 **ICE 协商** 动态发现对方地址 |
| **传输层** | TCP（可靠、有序） | UDP（快速、低延迟、可丢包） |
| **建立过程** | 一步：`new WebSocket(url)` | 多步：创建 PC → 生成 Offer → 交换 SDP → ICE 协商 → 连通 |

WebSocket 的模型很简单——你知道对方的地址（URL），直接发起连接即可。而 WebRTC 则完全不同：双方一开始并不知道彼此的网络地址，需要通过一系列信令交换来"发现"对方。

以下是 WebRTC 的"地址发现"过程，也就是它不需要 URL 的原因：

```
1. Azure 在 session.updated 事件中返回 ICE servers：
   [
     { urls: "turn:xxx.communication.azure.com:3478", username: "临时用户名", credential: "临时密码" },
     { urls: "stun:xxx.communication.azure.com:3478" }
   ]
   → 这些是 TURN/STUN 中继服务器，不是 Avatar 服务本身

2. 浏览器用这些 ICE servers 创建 RTCPeerConnection
   → new RTCPeerConnection({ iceServers: [...] })

3. 浏览器生成 SDP Offer（"我支持 H.264 视频、Opus 音频、这些候选地址..."）
   → 通过 WebSocket 发给 Azure（session.avatar.connect）

4. Azure 返回 SDP Answer（"我也支持 H.264、我的地址是..."）
   → 通过 WebSocket 回传给浏览器

5. 双方的 ICE Agent 互相探测，找到最佳路径
   → 可能是直连（P2P），也可能经过 TURN 中继

6. 媒体开始流动（H.264 视频 + Opus 音频）
   → 走的是步骤 5 协商出来的 UDP 路径
```

所以 WebRTC 不是"连接一个 URL"，而是通过一系列信令交换，动态建立一条点对点（或经中继）的媒体通道。

---

## 2.3 WebRTC 与 WebSocket 的独立性

很多开发者在初次接触这两种协议时会产生一个误解："WebRTC 是建立在 WebSocket 之上的。"这种理解是**不准确的**。

"建立在之上"意味着协议层级关系（比如 HTTPS 建立在 TLS 之上，TLS 建立在 TCP 之上）。WebRTC 和 WebSocket **不是**这种关系。更准确的说法是：

```
WebRTC 依赖 WebSocket 做两件事（仅此两件）：
  1. 拿到 TURN 凭据（没有凭据就无法穿透 NAT/防火墙）
  2. 交换 SDP（没有 SDP 交换就无法协商媒体参数）

一旦这两件事完成，WebRTC 的媒体流就完全独立于 WebSocket 运行。
即使 WebSocket 断开，已建立的 WebRTC 视频流理论上仍能继续。
```

所以关系是**依赖**，不是**包含**。WebSocket 是 WebRTC 的"助产士"，不是"母体"。

打个形象的比喻：WebSocket 像是介绍两个人认识的朋友——它帮忙传递了联系方式（TURN 凭据）和见面约定（SDP），但一旦两个人正式碰面开始交谈（媒体流建立），那位介绍人的在场与否就不影响谈话的继续了。

---

## 2.4 跨协议身份认证：SDP 中的 DTLS 指纹绑定

理解了 WebRTC 与 WebSocket 的独立性之后，一个自然的安全问题浮出水面：既然 WebRTC 是独立运行的，那怎么保证 WebRTC 通信的就是 WebSocket 认证过的那个客户端？

答案分三个层次。

### 第一层：TURN 凭据绑定（网络层）

```
Azure 为每个 WebSocket session 生成独立的临时 TURN 凭据
  → 凭据只通过该 session 的 WebSocket 传递
  → 只有这个浏览器拿到了凭据
  → TURN 服务器只允许持有效凭据的客户端中继流量
```

但 TURN 凭据只管"你能不能通过中继服务器传数据"，不管"你是不是那个人"。如果凭据泄露了呢？

### 第二层：SDP + DTLS 指纹绑定（密码学层，关键！）

这才是真正的身份绑定机制。SDP 里藏着一个密码学"身份证"：

```
当浏览器执行 new RTCPeerConnection() 时：
  → 浏览器自动生成一对 DTLS 密钥（私钥 + 证书，每次都不同）

当浏览器执行 createOffer() 生成 SDP 时：
  → SDP 里自动包含这个证书的指纹（fingerprint），例如：
    a=fingerprint:sha-256 4A:3B:2C:1D:... (证书的 SHA-256 哈希)

SDP 通过已认证的 WebSocket 发送给 Azure：
  → Azure 记住：这个 session 的 client 的 DTLS 指纹是 4A:3B:2C:1D:...

当 WebRTC 媒体通道建立时：
  → 双方进行 DTLS 握手
  → Azure 验证：对方出示的 DTLS 证书的指纹 == SDP 中声明的指纹
  → 匹配 → 握手成功 → 用协商出的密钥加密所有媒体流
  → 不匹配 → 握手失败 → 拒绝传输
```

这套机制形成了一条完整的信任链：

```
JWT Token                SDP Offer (含 DTLS 指纹)              DTLS 握手
  │                           │                                   │
  │  "我是用户 Alice"          │  "我的密码学指纹是 4A:3B..."      │  "验证指纹 4A:3B..."
  │                           │                                   │
  ▼                           ▼                                   ▼
WebSocket 认证  ──────►  SDP 在认证通道传输  ──────►  WebRTC 验证指纹匹配
  │                           │                                   │
  │ 后端验证 JWT              │ Azure 记住这个指纹               │ Azure 对比指纹
  │ → 用户可信                │ 属于这个 session                  │ → 是同一个客户端
  │                           │                                   │ → 媒体流开始
```

### 第三层：为什么攻击者做不到伪装？

假设攻击者截获了 TURN 凭据，他能伪装成原客户端接收 Avatar 视频吗？答案是不能：

```
攻击者                                     Azure Avatar
   │                                          │
   │  用偷来的 TURN 凭据连接 TURN 服务器        │
   │  → ✅ 能连上 TURN（凭据有效）              │
   │                                          │
   │  尝试建立 WebRTC                          │
   │  → ❌ 失败！                              │
   │                                          │
   │  原因：                                   │
   │  1. 攻击者的 DTLS 证书指纹 ≠ SDP 里的指纹  │
   │  2. Azure 拒绝 DTLS 握手                   │
   │  3. 即使能建立连接，没有匹配的 SDP Answer   │
   │     （SDP 交换走的是认证的 WebSocket，       │
   │      攻击者进不了那个 WebSocket session）   │
```

DTLS 指纹机制的精妙之处在于：私钥由浏览器内部生成且永远不会离开浏览器，所以即使其他所有信息都被截获，攻击者也无法产生一个与 SDP 中声明指纹匹配的 DTLS 证书。

---

## 2.5 完整的连接建立过程

现在，让我们把所有知识串起来，看一看从用户打开页面到数字人视频流开始传输的完整过程：

```
时间 →

[Phase 1: 认证]
  浏览器 ─JWT─► 后端 ─验证─► 合法用户
  后端 ─API Key─► Azure ─创建 Session─► session_id=abc123

[Phase 2: 获取 WebRTC 启动材料]    ← 通过已认证的 WebSocket
  Azure → 后端 → 浏览器:
    session.updated {
      avatar: {
        ice_servers: [{ urls: "turn:...", username: "tmp_xyz", credential: "tmp_pwd" }]
      }
    }

[Phase 3: 浏览器本地准备]          ← 纯本地操作
  pc = new RTCPeerConnection({ iceServers: [...] })
  → 自动生成 DTLS 密钥对（私钥永远不离开浏览器）
  pc.addTransceiver("video", { direction: "recvonly" })
  pc.addTransceiver("audio", { direction: "recvonly" })
  offer = pc.createOffer()
  → SDP 内容包含:
    - 支持的编码: H.264, Opus
    - ICE candidates: 通过 TURN 服务器探测到的候选地址
    - DTLS 指纹: a=fingerprint:sha-256 4A:3B:2C:1D:...  ← 密码学身份

[Phase 4: SDP 交换]               ← 通过已认证的 WebSocket
  浏览器 → (WebSocket) → 后端 → (SDK) → Azure:
    { type: "session.avatar.connect", client_sdp: btoa(JSON.stringify(offer)) }

  Azure 记录: session abc123 的 client DTLS 指纹 = 4A:3B:2C:1D:...

  Azure → (SDK) → 后端 → (WebSocket) → 浏览器:
    { server_sdp: btoa(JSON.stringify(answer)) }
    → answer 中包含 Azure Avatar 的 DTLS 指纹

  浏览器: pc.setRemoteDescription(answer)

[Phase 5: 媒体通道建立]           ← 独立于 WebSocket，走 UDP
  浏览器 ◄──DTLS 握手──► Azure Avatar
    → 双方出示证书，互验指纹
    → 指纹匹配 Phase 4 中 SDP 声明的 → 握手成功
    → 协商出 SRTP 加密密钥
    → 加密的 H.264 视频 + Opus 音频 开始流动

  此后 WebSocket 和 WebRTC 独立运行：
    WebSocket: 继续传文字、用户音频、控制消息
    WebRTC:    持续传数字人视频+音频（UDP, 低延迟）
```

五个阶段清晰地展示了信任如何从 JWT 认证传递到 WebSocket 会话，再通过 SDP 指纹绑定延伸到 WebRTC 媒体通道。

---

## 本章要点总结

| 问题 | 答案 |
|------|------|
| WebRTC 建立在 WebSocket 之上？ | 不是。WebRTC 独立运行，但启动阶段**依赖** WebSocket 传递 TURN 凭据和 SDP |
| WebRTC 复用 WebSocket 的认证 session？ | 间接复用。不是协议层面的复用，而是通过"SDP 只能在认证 WebSocket 中交换"来传递信任 |
| 怎么保证是同一个 client？ | **DTLS 指纹**。SDP 中声明指纹，DTLS 握手时验证。指纹由浏览器内部生成的密钥对决定，无法伪造 |
| TURN 凭据泄露了怎么办？ | 不影响。TURN 只管网络中继，真正的身份验证在 DTLS 层。没有匹配的 DTLS 私钥 = 无法通过握手 |
| WebSocket 断了，WebRTC 还能用吗？ | 理论上已建立的 WebRTC 媒体流可以继续（UDP 独立运行），但实际上 Azure 会检测到 session 断开并清理 |

---

> 📖 返回 [学习导航](../index.md) | 上一章 ← [全局概览](../01-overview/README.md) | 下一章 → [WebRTC 深入](../03-webrtc-deep-dive/README.md)
