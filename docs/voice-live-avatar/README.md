# Voice Live + Avatar 技术架构 FAQ

> 本文档面向开发者和技术决策者，用人话解释 Azure Voice Live API 中 WebSocket 与 WebRTC 的关系，以及常见问题的根因分析。

---

## 疑问 1：WebSocket 和 WebRTC 是同一个 endpoint 还是两个？

**答案：它们是完全独立的两条连接通道，用途不同，协议不同，连接对象也不同。**

### 一张图看懂

```
浏览器                          后端 (FastAPI)                   Azure 云端
  │                               │                               │
  │◄─── WebSocket ───────────────►│◄──── Azure SDK ──────────────►│ Voice Live API
  │     (文本 + 音频数据 + 控制)   │     (Python SDK 代理)         │ (GPT + STT + TTS + VAD)
  │                               │                               │
  │                               │                               │
  │◄═══ WebRTC (P2P) ════════════════════════════════════════════►│ Azure AI Avatar
  │     (数字人视频 + 数字人音频)                                   │ (数字人渲染引擎)
```

### 详细对比

| 维度 | WebSocket | WebRTC |
|------|-----------|--------|
| **是什么** | 一个全双工的文本/二进制消息通道 | 一个点对点的实时音视频流通道 |
| **连接路径** | 浏览器 → 后端 → Azure Voice Live API（三方转发） | 浏览器 → Azure Avatar 服务（直连，后端不参与媒体传输） |
| **传输内容** | JSON 消息：控制指令、base64 编码的音频数据、文字转写 | 媒体流：H.264 视频轨道 + Opus 音频轨道 |
| **数据格式** | 文本帧（JSON）里包裹 base64 音频 | 原生 RTP 包，浏览器直接解码渲染 |
| **是否必需** | **必需**。是整个 Voice Live 的基础通道 | **可选**。只有开启数字人 Avatar 时才需要 |
| **谁发起** | 前端 `new WebSocket(url)` | 前端 `new RTCPeerConnection(config)` |
| **后端角色** | 代理（转发所有消息，保护 API Key） | 旁观者（只透传 ICE/SDP 信令，不碰媒体流） |
| **断开影响** | 整个会话结束 | 数字人画面消失，但文字对话不受影响 |

### 通俗类比

把它想象成一个视频会议系统：

- **WebSocket** 就像"聊天窗口 + 控制面板"——你通过它发送语音消息（编码成文字格式传输）、接收 AI 的回复文字、控制会话开始/结束。所有的"指令"和"数据"都走这条路。
- **WebRTC** 就像"视频画面"——它只负责把数字人的视频流和配套音频推送到你的屏幕上。它不传任何控制信息，只传媒体。

两者是**并行**的、**独立**的。WebSocket 先建立，WebRTC 后建立。WebSocket 是地基，WebRTC 是可选的上层建筑。

### 连接建立的先后顺序

```
时间线 →

Step 1: 浏览器连接后端 WebSocket
        └─ 后端连接 Azure Voice Live SDK
        └─ Azure 返回 session.created + session.updated (包含 ICE servers)

Step 2: （如果启用了 Avatar）
        浏览器用收到的 ICE servers 建立 WebRTC
        └─ 创建 RTCPeerConnection
        └─ 生成 SDP Offer → 通过 WebSocket 发给 Azure
        └─ Azure 返回 SDP Answer → 通过 WebSocket 传回浏览器
        └─ WebRTC 媒体流开始 → 数字人画面出现

Step 3: 开始录音，用户说话
        └─ 麦克风音频通过 WebSocket 发送（base64 PCM16）
        └─ AI 回复的文字通过 WebSocket 返回
        └─ AI 的数字人形象通过 WebRTC 播放（视频 + 口型同步音频）
```

> **关键细节**：WebRTC 的信令（ICE/SDP 协商）是通过 WebSocket 通道传递的，但 WebRTC 的实际媒体流是独立的直连通道。这就像你用微信（WebSocket）约朋友见面（交换地址），但真正见面（WebRTC 媒体传输）是面对面的，不经过微信。

### 追问：那 Azure 的 endpoint 到底有几个？WebRTC 用什么 URI 连接？

**Azure Voice Live API 只有一个 endpoint，但 WebRTC 不是通过 "URI" 连接的——它的连接方式和 WebSocket 本质不同。**

#### 三种连接的 URI 对比

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

#### 为什么 WebRTC 没有 URL？

这是 WebSocket 和 WebRTC 最根本的区别：

| 维度 | WebSocket | WebRTC |
|------|-----------|--------|
| **连接方式** | 像打电话：拨一个号码（URL），对方接通 | 像约会：先交换地址（SDP），然后各自找路见面 |
| **寻址** | 有明确的 URL：`wss://host/path` | 没有 URL，通过 **ICE 协商** 动态发现对方地址 |
| **传输层** | TCP（可靠、有序） | UDP（快速、低延迟、可丢包） |
| **建立过程** | 一步：`new WebSocket(url)` | 多步：创建 PC → 生成 Offer → 交换 SDP → ICE 协商 → 连通 |

WebRTC 的"地址发现"过程：

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

#### 都是 Azure Voice Live API 支持的吗？

**是的，都是同一个 Azure Voice Live API 的能力。**

当你通过 SDK 配置会话时加上 `modalities: ["text", "audio", "avatar"]`，Azure 就会同时启用两个能力：
- WebSocket 通道的文字+音频（自动提供）
- WebRTC 通道的 Avatar 视频+音频（返回 ICE servers + 处理 SDP 协商）

它们是同一个 API session 的两个"输出通道"，不是两个独立的服务。

---

### 追问：WebRTC 为什么浏览器直连 Azure，不走后端代理？安全怎么保证？

**不走代理的原因是技术限制，不仅仅是性能优化。同时安全性通过"临时凭据"机制保障。**

#### 为什么不能走后端代理？

```
                         能不能代理？
WebSocket（文字+音频数据）    ✅ 可以，且必须代理（保护 API Key）
WebRTC（视频+音频流）         ❌ 不能，技术上走不通
```

原因不是"性能差一点"，而是**根本做不到**：

| 原因 | 详细说明 |
|------|----------|
| **协议不兼容** | WebRTC 用的是 SRTP/DTLS over **UDP**。FastAPI/Python 是 TCP-based 的 Web 服务器，压根不支持 UDP 媒体传输。你需要一个专门的 WebRTC 媒体服务器（如 Janus/mediasoup）才能代理 WebRTC 流。 |
| **带宽爆炸** | H.264 视频流 30fps ≈ 2-5 Mbps。如果每个用户的视频都经过后端转发，10 个并发用户 = 20-50 Mbps 的后端带宽。这不是优化问题，是成本和架构问题。 |
| **延迟不可接受** | WebRTC 的设计目标是 < 100ms 延迟。加一个 TCP proxy ≈ 增加 100-300ms（TCP 重传+缓冲+解码/编码）。对于口型同步来说，300ms 延迟 = 嘴型和声音明显不同步。 |
| **WebRTC 本身就是 P2P** | WebRTC 的核心设计就是浏览器直连对端。Azure Avatar 服务本质上扮演了 WebRTC 的"对端"角色，与浏览器直接建立媒体通道。 |

> **类比**：WebSocket 代理就像"翻译官"——你说中文，翻译官转述给外国人，外国人回复，翻译官再转述给你。WebRTC 如果要代理，就像"让翻译官同时转播一场高清视频直播"——他不是干这个的，硬要他做只会卡顿和延迟。

#### 安全怎么保证？API Key 不是暴露了吗？

**API Key 绝对没有暴露。WebRTC 连接用的是临时凭据，不是 API Key。**

安全链路如下：

```
                                     谁知道什么？

浏览器：                              ❌ 不知道 API Key
                                      ✅ 知道 JWT Token（登录凭证）
                                      ✅ 知道 临时 TURN 凭据（Azure 动态生成，有效期几分钟）

后端 (FastAPI)：                      ✅ 知道 API Key（环境变量，绝不外传）
                                      ✅ 验证 JWT，代理 WebSocket

Azure Voice Live API：                ✅ 知道 API Key（后端提交的）
                                      ✅ 生成临时 TURN 凭据 → 通过 WebSocket → 传给浏览器
                                      ✅ TURN 服务器验证临时凭据
```

详细的认证流程：

```
Step 1: 浏览器用 JWT 连接后端 WebSocket
        → 后端验证 JWT，确认用户身份
        → 后端用 API Key 连接 Azure Voice Live SDK
        → API Key 只在后端内存中，浏览器永远看不到

Step 2: Azure 创建会话，返回 session.updated 事件
        → 事件中包含临时 TURN 凭据：
          {
            ice_servers: [
              {
                urls: "turn:xxx.communication.azure.com:3478",
                username: "临时用户名（几分钟后过期）",
                credential: "临时密码（几分钟后过期）"
              }
            ]
          }
        → 这些凭据通过已认证的 WebSocket 传给浏览器

Step 3: 浏览器用临时凭据连接 TURN 服务器
        → TURN 服务器验证凭据有效性
        → 凭据有效 → 允许 WebRTC 媒体流通过
        → 凭据过期/无效 → 拒绝连接
```

#### 安全保障总结

| 安全问题 | 如何保障 |
|----------|---------|
| API Key 泄露？ | 不可能。API Key 只在后端（Python 进程内存），从不经过网络传给浏览器。 |
| TURN 凭据被窃取？ | 影响有限。凭据是临时的（几分钟过期），且绑定特定 TURN 服务器和会话。 |
| 有人伪造 WebRTC 连接？ | 做不到。需要有效的 TURN 凭据 + 匹配的 SDP 交换，而 SDP 交换走的是已认证的 WebSocket。 |
| 中间人攻击？ | WebRTC 自带 DTLS 加密（类似 HTTPS），媒体流端到端加密。 |

> **一句话总结**：API Key 被后端保护，WebRTC 用 Azure 动态颁发的"临时通行证"（TURN 凭据）来认证，通行证几分钟就过期，安全性有充分保障。

---

### 追问：WebRTC 是建立在 WebSocket 之上的吗？怎么保证 WebRTC 通信的就是 WebSocket 认证的那个 client？

**WebRTC 不是"建立在 WebSocket 之上"，但它依赖 WebSocket 来引导启动。至于身份绑定，靠的是 SDP 中的 DTLS 指纹——一个精巧的密码学机制。**

#### 先纠正一个认知

"建立在之上"意味着协议层级关系（比如 HTTPS 建立在 TLS 之上，TLS 建立在 TCP 之上）。WebRTC 和 WebSocket 不是这种关系。更准确的说法是：

```
WebRTC 依赖 WebSocket 做两件事（仅此两件）：
  1. 拿到 TURN 凭据（没有凭据就无法穿透 NAT/防火墙）
  2. 交换 SDP（没有 SDP 交换就无法协商媒体参数）

一旦这两件事完成，WebRTC 的媒体流就完全独立于 WebSocket 运行。
即使 WebSocket 断开，已建立的 WebRTC 视频流理论上仍能继续。
```

所以关系是**依赖**，不是**包含**。WebSocket 是 WebRTC 的"助产士"，不是"母体"。

#### 核心问题：怎么保证 WebRTC 的 client 就是 WebSocket 认证的 client？

这是一个非常好的安全问题。答案分三层：

##### 第一层：TURN 凭据绑定（网络层）

```
Azure 为每个 WebSocket session 生成独立的临时 TURN 凭据
  → 凭据只通过该 session 的 WebSocket 传递
  → 只有这个浏览器拿到了凭据
  → TURN 服务器只允许持有效凭据的客户端中继流量
```

但 TURN 凭据只管"你能不能通过中继服务器传数据"，不管"你是不是那个人"。如果凭据泄露了呢？

##### 第二层：SDP + DTLS 指纹绑定（密码学层，关键！）

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

完整的信任链条图：

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

##### 第三层：为什么攻击者做不到伪装？

假设攻击者截获了 TURN 凭据，他能伪装成原客户端接收 Avatar 视频吗？

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

#### 完整的建立过程（串起来看）

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

#### 关键理解

| 问题 | 答案 |
|------|------|
| WebRTC 建立在 WebSocket 之上？ | 不是。WebRTC 独立运行，但启动阶段**依赖** WebSocket 传递 TURN 凭据和 SDP |
| WebRTC 复用 WebSocket 的认证 session？ | 间接复用。不是协议层面的复用，而是通过"SDP 只能在认证 WebSocket 中交换"来传递信任 |
| 怎么保证是同一个 client？ | **DTLS 指纹**。SDP 中声明指纹，DTLS 握手时验证。指纹由浏览器内部生成的密钥对决定，无法伪造 |
| TURN 凭据泄露了怎么办？ | 不影响。TURN 只管网络中继，真正的身份验证在 DTLS 层。没有匹配的 DTLS 私钥 = 无法通过握手 |
| WebSocket 断了，WebRTC 还能用吗？ | 理论上已建立的 WebRTC 媒体流可以继续（UDP 独立运行），但实际上 Azure 会检测到 session 断开并清理 |

---

## 疑问 2：语音在 WebSocket 和 WebRTC 中的具体区别

**答案：用户的语音只走 WebSocket，数字人的音视频只走 WebRTC。它们负责不同方向、不同格式的音频。**

### 音频流向全景图

```
                           WebSocket 通道                    WebRTC 通道
                      ┌────────────────────┐           ┌──────────────────┐
                      │                    │           │                  │
  用户说话 ──麦克风──►│ input_audio_buffer  │           │   （不走这里）    │
  (PCM16, 24kHz,     │ .append             │           │                  │
   base64 编码)      │ {audio: "Abc...="}  │           │                  │
                      │        │           │           │                  │
                      │        ▼           │           │                  │
                      │   Azure Voice Live │           │                  │
                      │   (STT+GPT+TTS)   │           │                  │
                      │        │           │           │        │         │
                      │        ▼           │           │        ▼         │
  文字转写 ◄─────────│ transcript.delta    │           │                  │
  (JSON 文本)        │ transcript.done     │           │                  │
                      │                    │           │                  │
  AI 音频回复 ◄──────│ response.audio.delta│           │   （Avatar 模式   │
  (base64 PCM16,     │ (仅非 Avatar 模式)  │           │    下不用这个）   │
   软件解码播放)      │                    │           │                  │
                      └────────────────────┘           │                  │
                                                       │                  │
  数字人视频 ◄────────────────────────────────────────│ Video Track      │
  (<video> 元素, H.264)                               │ (H.264 编码)     │
                                                       │                  │
  数字人音频 ◄────────────────────────────────────────│ Audio Track      │
  (隐藏 <audio> 元素, Opus 编码)                      │ (Opus 编码,      │
                                                       │  口型同步)       │
                                                       └──────────────────┘
```

### 逐项对比

| 维度 | WebSocket 里的音频 | WebRTC 里的音频 |
|------|-------------------|-----------------|
| **方向** | 双向：用户语音上行 + AI 语音下行 | 单向下行：数字人的声音推过来 |
| **上行（用户→Azure）** | 麦克风 → AudioWorklet → PCM16 → base64 → JSON | 无（WebRTC 设置为 recvonly，不上传） |
| **下行（Azure→用户）** | `response.audio.delta`（base64 PCM16） | RTP Audio Track（Opus 编码） |
| **编码格式** | PCM16（原始波形），base64 包装 | Opus（高压缩比），RTP 包装 |
| **采样率** | 24kHz | 由 WebRTC 协商决定（通常 48kHz） |
| **延迟** | 较高（JSON 序列化 + base64 编解码 + 网络） | 极低（P2P 直连 + 硬件加速编解码） |
| **口型同步** | 无关联 | 音频与视频帧精确同步，嘴型自然 |
| **何时使用** | 纯语音模式（无数字人） | 数字人 Avatar 模式 |

### 为什么要两套音频？

这不是设计冗余，而是**两种不同的产品形态**：

1. **纯语音模式**（无 Avatar）：只有 WebSocket。用户说话 → WebSocket → Azure STT → GPT → TTS → WebSocket → `response.audio.delta` → 浏览器软件解码播放。这时候页面上显示一个"语音波形球"（AudioOrb）。

2. **数字人模式**（有 Avatar）：WebSocket + WebRTC 并行。用户说话仍然走 WebSocket 上行，但 AI 的回复不再通过 WebSocket 的 `response.audio.delta` 播放，而是由 Azure Avatar 服务渲染成带口型同步的视频+音频，通过 WebRTC 推送。此时文字转写仍然走 WebSocket。

> **简单记忆**：WebSocket = 所有文字 + 用户语音输入 + （纯语音模式下的）AI 语音输出。WebRTC = 数字人的脸 + 数字人的嘴巴同步的声音。

---

## 疑问 3：为什么只有文字没有音频，数字人嘴型也没动？

**答案：是的，这几乎可以确定是 WebRTC 没有建立成功。**

### 根因分析

结合疑问 1 的结论（WebSocket 和 WebRTC 是两条独立通道），症状可以精确解释：

| 症状 | 走哪条通道 | 说明 |
|------|-----------|------|
| 文字转写正常 | WebSocket | WebSocket 连接正常，`transcript.delta` 消息正常到达 |
| 没有音频输出 | WebRTC（Avatar 模式） | 数字人的语音通过 WebRTC Audio Track 传输，WebRTC 没连上就没有声音 |
| 数字人嘴型不动 | WebRTC | 嘴型是 WebRTC Video Track 里的内容，没连上就没有画面变化 |

### WebRTC 可能失败的环节

WebRTC 的建立是一个多步骤的过程，任何一步失败都会导致上述症状：

```
Step  可能的失败点                           如何排查
──────────────────────────────────────────────────────────────────
 1    session.updated 里没有 ice_servers      检查 WebSocket 消息日志，
      → 说明 Azure 没返回 ICE 配置             确认 session.updated 内容

 2    ICE servers 格式不对或凭据过期          检查 ice_servers 数组是否有
      → RTCPeerConnection 无法初始化           username/credential 字段

 3    ICE gathering 超时（>8秒）              网络环境问题（防火墙/NAT），
      → 本地 SDP Offer 不完整                  检查 iceGatheringState

 4    SDP Offer 发送失败                      检查 session.avatar.connect
      → Azure 没收到协商请求                    消息是否成功发送

 5    SDP Answer 超时（>15秒）                Azure Avatar 服务不可用，
      → 协商未完成                              或 SDP 编码格式不对

 6    setRemoteDescription 失败               SDP Answer 解码失败
      → WebRTC 连接无法建立                     (base64 → JSON 解析出错)

 7    ICE connectivity check 失败             TURN 服务器不可达，
      → 有 SDP 但媒体流走不通                   企业防火墙拦截 UDP
```

### 快速诊断方法

打开浏览器控制台（F12），关注以下日志：

1. **检查 WebSocket 消息**：找到 `session.updated` 事件，确认里面有 `ice_servers` 字段
2. **检查 WebRTC 状态**：搜索 `RTCPeerConnection` 相关日志，看 `iceConnectionState` 是否变为 `connected`
3. **检查 SDP 交换**：确认 `session.avatar.connect` 消息已发送，且收到了包含 `server_sdp` 的响应

如果第 1 步就没有 `ice_servers`，问题在 Azure 配置端（Avatar 功能可能未启用或模型不支持）。
如果第 1 步正常但第 2 步 ICE 状态卡在 `checking` 或 `failed`，问题在网络环境（防火墙/NAT 穿越失败）。

### 理解确认

> 是的，理解了疑问 1（WebSocket 和 WebRTC 是两条独立通道）之后，疑问 3 就很好理解了：
>
> - **文字能出来** = WebSocket 通道正常工作
> - **音频出不来 + 嘴型不动** = WebRTC 通道没有建立
>
> 这两个现象完全吻合"WebSocket 正常但 WebRTC 断开"的场景。修复方向就是排查 WebRTC 建立过程中哪一步失败了。

---

## 疑问 4：Realtime 模型不是文字和音频一起出来的吗？为什么文字先出来？

**答案：模型确实是同时生成文字和音频的，但文字和音频的传输路径、处理开销完全不同，导致文字"跑得快"。**

### 两条路的"赛跑"

即使 GPT-4o Realtime 模型在生成层面是同时产出 text token 和 audio token 的，从 Azure 服务器到你的屏幕上，它们走的路完全不同：

```
Azure GPT-4o Realtime 模型
  │
  ├─── 文字 token ──► response.audio_transcript.delta ──► WebSocket JSON ──► 浏览器渲染文字
  │    ~几十字节        ~几十字节的 JSON                    极小数据包          毫秒级
  │
  └─── 音频 token ──► ┌─────────────────────────────────────────────────────────────────┐
                       │ 分两种情况：                                                      │
                       │                                                                  │
                       │ 【纯语音模式】                                                    │
                       │  → TTS 合成波形 → PCM16 编码 → base64 → response.audio.delta     │
                       │  → WebSocket JSON (几KB/帧) → 浏览器解码 → AudioBuffer → 播放    │
                       │  延迟：~100-300ms                                                 │
                       │                                                                  │
                       │ 【数字人 Avatar 模式】                                             │
                       │  → TTS 合成波形                                                   │
                       │  → Avatar 渲染引擎（口型同步计算 + 面部动画 + 身体动作）            │
                       │  → H.264 视频编码 + Opus 音频编码                                  │
                       │  → WebRTC RTP 打包 → 网络传输 → 浏览器硬件解码 → 渲染              │
                       │  延迟：~300-800ms                                                 │
                       └─────────────────────────────────────────────────────────────────┘
```

### 为什么文字快、音频慢？

| 因素 | 文字 | 音频（尤其 Avatar 模式） |
|------|------|------------------------|
| **数据量** | 几个字 = 几十字节 | 一帧音频 = 几 KB，一帧视频 = 几十 KB |
| **编码开销** | 无（直接 JSON 字符串） | PCM16→base64（纯语音）或 TTS→渲染→H.264+Opus（Avatar） |
| **传输协议** | WebSocket text frame（TCP，可靠） | WebSocket binary（纯语音）或 WebRTC RTP（Avatar） |
| **渲染开销** | DOM 更新一行文字 | 音频解码→AudioBuffer→播放 / 视频解码→Canvas渲染 |
| **额外处理** | 无 | Avatar 模式需要：口型同步计算、面部表情渲染、身体动画 |

### 和数字人有关系吗？

**有关系，但不是唯一原因。**

- **即使没有数字人**（纯语音模式），文字也会比音频先到达。因为文字就是几个字符的 JSON，而音频是大量 PCM16 数据的 base64 编码，光数据量就差了两个数量级。

- **有了数字人之后差距更大**。因为音频需要额外经过 Avatar 渲染管线（TTS → 口型计算 → 视频编码 → WebRTC 传输），这个管线增加了数百毫秒的延迟。

### 这是正常行为吗？

**完全正常。** 这也是为什么几乎所有带有语音+文字的 AI 产品（包括 Azure 官方的 Playground）都是文字先出现、音频紧随其后。你可以在 Azure AI Foundry 的 Voice Live Playground 中观察到同样的行为。

> **总结**：Realtime 模型确实是同时生成的，但"同时生成"≠"同时到达用户"。文字是轻量数据走快车道（几十字节的 JSON），音频是重量数据走慢车道（大量编码数据 + 可能的 Avatar 渲染），到达用户的时间自然有先后。

---

## 疑问 5：WebSocket 和 WebRTC 的连接代码到底长什么样？

**最直观的对比——把两段真实代码放在一起看。**

### WebSocket 连接（`use-voice-live.ts`）

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

### WebRTC 连接（`use-avatar-stream.ts`）

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

### 核心差异一目了然

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

---

## 疑问 6：WebRTC 用的 JS 库是什么？

**答案：两个协议都用浏览器原生 API，零第三方依赖。**

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

## 疑问 7：WebSocket 和 WebRTC 对应的 UI 组件是共享的还是不同的？

**答案：部分共享，部分独占。文字转写和控制栏是共享的，视频画面是 WebRTC 独占的，音频播放器按模式切换。**

### 组件与协议的映射关系

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

### 模式切换时的组件变化

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

### Hooks 与协议的对应

```
useVoiceLive      ── WebSocket ── 管理 ws 连接、发送/接收 JSON 消息
useAvatarStream   ── WebRTC   ── 管理 RTCPeerConnection、ICE/SDP、媒体流
useAudioHandler   ── 无协议   ── 管理麦克风采集（AudioWorklet），产出 Float32 → 由 useVoiceLive 发送
useAudioPlayer    ── 无协议   ── 管理音频播放（AudioBuffer），消费 useVoiceLive 收到的 audio.delta
```

四个 hook 各管一件事，通过 VoiceSession 这个编排组件串联起来。VoiceSession 就像"导演"，WebSocket 和 WebRTC 就像两个"演员"，各自表演不同的部分，但在同一个舞台上。

---

## 疑问 8：如果我要做视频会议或视频播放 Web 应用，WebSocket 和 WebRTC 怎么选？

**答案：取决于你要做的事情。WebSocket 管"信令和数据"，WebRTC 管"实时音视频"。大多数场景需要两者配合，但主次不同。**

### 四种典型场景的架构选择

#### 场景 1：视频会议（如 Zoom/Teams）

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

#### 场景 2：直播/视频媒体播放（如 B站/YouTube Live）

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

#### 场景 3：AI 数字人对话（本项目！）

```
WebSocket + WebRTC 并行

  WebSocket: 用户语音（base64 上行）+ AI 文字（下行）+ 控制信令
  WebRTC:    数字人视频+音频（下行 recvonly）

  特殊之处：
  - WebRTC 只用于 Avatar 视频，不传用户的媒体
  - 用户音频通过 WebSocket 走后端代理（保护 API Key）
  - 和视频会议最大的区别：WebRTC 是单向的（recvonly）
```

#### 场景 4：在线教育白板/协作

```
WebSocket = 主角（实时数据同步）
WebRTC = 可选（如果需要视频/语音）

  WebSocket: 画笔轨迹、文档编辑、光标位置、聊天
  WebRTC:    老师的摄像头/屏幕共享（如果需要）

  白板数据是 JSON，用 WebSocket 足够
  视频/语音才需要 WebRTC
```

### 选择决策树

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

### 对比"本项目"和"标准视频会议"的区别

| 维度 | 本项目（AI 数字人） | 标准视频会议（Zoom） |
|------|-------------------|---------------------|
| **WebRTC 方向** | `recvonly`（只看数字人） | `sendrecv`（双向音视频） |
| **用户摄像头** | 不需要 | 需要（上传视频流） |
| **用户麦克风音频** | 走 WebSocket（base64） | 走 WebRTC（直接传） |
| **为什么音频不走 WebRTC** | 后端需要代理保护 API Key | 不需要代理，直连对方 |
| **信令服务器** | 后端 FastAPI（WebSocket proxy） | 独立信令服务器 |
| **媒体服务器** | 不需要（Azure Avatar 直推） | 大规模需要 SFU |
| **SDP 交换** | 通过业务 WebSocket | 通过独立信令 WebSocket |

### 如果从零开始做视频会议，架构大纲

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

---

## 疑问 9：中继器（TURN）是必须的吗？我们项目里好像没有？

**答案：我们项目里有，是 Azure 自动提供的。而且在生产环境中，TURN 几乎是必须的。**

### 我们的 TURN 在哪里？

就藏在代码里——`use-voice-live.ts` 收到的 ICE servers 中：

```typescript
// Azure 在 session.updated 事件中返回的 ICE servers（实际数据示例）：
iceServers = [
  {
    urls: "turn:relay1.communication.azure.com:3478",   // ← 这就是 TURN 中继器！
    username: "临时用户名",                               //   Azure 自动提供
    credential: "临时密码"                                //   每个 session 独立生成
  },
  {
    urls: "stun:relay1.communication.azure.com:3478"    // ← 这是 STUN（只探测，不中继）
  }
]
```

你没有自己搭 TURN 服务器，因为 **Azure Voice Live 服务内置了 TURN**，作为服务的一部分自动提供。这也是为什么代码里要处理 `ice_username` / `ice_credential`——那就是 TURN 的认证凭据。

### TURN 是必须的吗？

**技术上不是，实际上几乎是。**

```
没有 TURN 的情况：

  浏览器 ──── 尝试直连 ──── Azure Avatar
                 │
       NAT/防火墙挡住了？
         │              │
        没有             有
         │              │
    ✅ 直连成功      ❌ 连接失败，无 fallback
    （运气好）        （用户看到黑屏）


有 TURN 的情况：

  浏览器 ──── 尝试直连 ──── Azure Avatar
                 │
       NAT/防火墙挡住了？
         │              │
        没有             有
         │              │
    ✅ 直连成功      ↓ 自动降级
                  浏览器 ──► TURN 中继 ◄── Azure Avatar
                              ✅ 一定能通
```

### 各种网络环境下的连接成功率

| 网络环境 | 无 TURN | 有 TURN |
|----------|---------|---------|
| 家庭 Wi-Fi（普通 NAT） | ~80% 成功 | ~100% 成功 |
| 企业网络（严格防火墙） | ~20% 成功 | ~95% 成功 |
| 对称 NAT（某些运营商 4G） | ~30% 成功 | ~100% 成功 |
| 酒店/机场 Wi-Fi | ~10% 成功 | ~90% 成功 |

> **结论**：如果你的用户只在自己家里用，不配 TURN 也能凑合。但只要有企业用户或移动用户（BeiGene 的 MR 培训场景！），TURN 是生命线。

### 为什么我们不需要自己搭？

| 方案 | 说明 |
|------|------|
| **Azure 内置 TURN**（本项目） | Azure Voice Live 自动提供 TURN 服务器和临时凭据，零运维 |
| 自己搭 coturn | 开源 TURN 服务器，需要公网 IP + 带宽 + 运维 |
| Twilio TURN | 商用 TURN 服务，按流量计费 |
| Xirsys | 商用 TURN 服务，全球节点 |

本项目不需要自建 TURN，因为 Azure 的 Voice Live + Avatar 服务已经包含了完整的 ICE 基础设施。

---

## 疑问 10：WebRTC 可以脱离 WebSocket 单独使用吗？认证怎么做？

**答案：WebRTC 不能完全脱离信令通道，但信令不一定是 WebSocket。认证发生在信令层，WebRTC 本身没有"登录"概念。**

### WebRTC 连接的两个阶段

```
阶段1: 信令（Signaling）—— 需要"某种"通道
┌─────────┐                          ┌─────────┐
│ Client A │  ── SDP Offer ──────►   │ Client B │
│          │  ◄── SDP Answer ─────   │          │
│          │  ◄─► ICE Candidates ─►  │          │
└─────────┘                          └─────────┘
     ↕            通过什么传递？           ↕
   WebSocket / HTTP / MQTT / 甚至手动复制粘贴

阶段2: 媒体传输（Media）—— 纯 WebRTC，不需要 WebSocket
┌─────────┐  ◄══ SRTP/SCTP (音视频/数据) ══►  ┌─────────┐
│ Client A │         直接 P2P 或经 TURN         │ Client B │
└─────────┘                                     └─────────┘
```

关键点：
- **信令阶段**：WebRTC 标准**故意没有规定**信令协议，WebSocket 只是最常用的选择。也可以用 HTTP POST、Server-Sent Events、甚至 Firebase 来做信令
- **媒体阶段**：一旦连接建立，音视频数据走 WebRTC 自己的 UDP/SRTP 通道，**完全不经过 WebSocket**

### 认证怎么做？

WebRTC 本身没有"登录"概念，认证发生在**信令层**：

```
┌──────────────────────────────────────────────────┐
│                  认证流程                         │
├──────────────────────────────────────────────────┤
│                                                  │
│  1. 客户端 → 信令服务器: 带 API Key/JWT Token    │
│     （这一步是 HTTP 或 WebSocket，常规认证）       │
│                                                  │
│  2. 信令服务器验证身份后，返回：                    │
│     - SDP 信息（对方的媒体描述）                   │
│     - ICE 候选（网络路径信息）                     │
│     - TURN 凭据（临时用户名+密码）                 │
│                                                  │
│  3. WebRTC 连接建立时：                           │
│     - DTLS 握手（端到端加密，防中间人）             │
│     - TURN 凭据认证（如果用中继）                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 在 Voice Live 中的实际情况

- WebSocket 既是信令通道，也传输文本消息（转写文字、AI 回复文字）
- 音频流通过 WebSocket 二进制帧上行
- Avatar 视频走 WebRTC 下行
- 认证通过 Azure API Key 在后端 WebSocket 连接时完成

### 完整连接架构

```
┌─────────────────────────────────────────────────────────┐
│                Voice Live 连接架构                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  浏览器                    Azure 后端                    │
│  ┌─────┐                  ┌─────────────┐               │
│  │     │ ─── WebSocket ──►│ Voice Live  │               │
│  │     │   (信令+文本)     │ Service     │               │
│  │     │   API Key认证     │             │               │
│  │     │                  │  ┌────────┐ │               │
│  │     │ ─── 音频流 ─────►│  │ STT    │ │               │
│  │     │  (WS二进制帧      │  │ LLM    │ │               │
│  │     │   或 WebRTC)      │  │ TTS    │ │               │
│  │     │                  │  └────────┘ │               │
│  │     │                  └─────────────┘               │
│  │     │                                                │
│  │     │  如果用 Avatar（数字人视频）：                    │
│  │     │                  ┌─────────────┐               │
│  │     │ ─── WebRTC ────►│ Avatar      │               │
│  │     │  (视频流,低延迟)  │ Service     │               │
│  │     │  TURN中继可选     │ (ICE/TURN)  │               │
│  └─────┘                  └─────────────┘               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

> **总结**：WebRTC 不能完全脱离信令，但信令不必是 WebSocket。WebSocket 是 WebRTC 的"助产士"，不是"母体"——一旦 WebRTC 连接建立完成，媒体流完全独立于 WebSocket 运行。

---

## 疑问 11：TURN 中继器为什么能突破防火墙和网络限制？凭据有什么用？

**答案：TURN 利用"出站连接 + 标准端口 + 中继架构"三重策略绕过防火墙和 NAT。凭据用于授权使用中继带宽，不是用来认证用户身份。**

### 先理解为什么直连会失败

```
场景：企业防火墙后的两个客户端

┌─────────┐                              ┌─────────┐
│ Client A │                              │ Client B │
│ 内网IP:  │     ✗ 直连失败 ✗             │ 内网IP:  │
│ 192.168. │  ◄─────────────────────►     │ 10.0.    │
│ 1.100    │                              │ 0.50     │
└────┬─────┘                              └────┬─────┘
     │                                         │
┌────┴─────┐                              ┌────┴─────┐
│ 防火墙/NAT│                              │ 防火墙/NAT│
│ 只允许    │                              │ 只允许    │
│ 出站连接  │                              │ 出站连接  │
│ 封UDP端口 │                              │ 封UDP端口 │
└──────────┘                              └──────────┘

失败原因：
1. NAT: 内网IP对外不可达
2. 防火墙: 阻止入站连接
3. 对称NAT: 即使STUN打洞也不行
4. UDP封锁: 很多企业网封UDP
```

### TURN 为什么能成功

```
┌─────────┐         ┌──────────────────┐         ┌─────────┐
│ Client A │ ──────► │   TURN Server    │ ◄────── │ Client B │
│          │  出站   │ (公网 IP)         │  出站    │          │
│          │  连接   │                  │  连接    │          │
└────┬─────┘   ✓    │ 端口 443 (HTTPS) │   ✓     └────┬─────┘
     │              │ 端口 80  (HTTP)  │              │
┌────┴─────┐        │ 端口 3478 (标准) │         ┌────┴─────┐
│ 防火墙    │        └──────────────────┘         │ 防火墙    │
│ 允许出站→ │              中继转发                │ ←允许出站 │
└──────────┘                                     └──────────┘
```

### 四个关键原因

#### 原因 1：方向反转 —— 都是"出站"连接

```
直连模式（失败）：
  A ──入站──► B 的防火墙  ✗ 被拒绝（不接受入站）

TURN模式（成功）：
  A ──出站──► TURN服务器   ✓ 防火墙允许出站
  B ──出站──► TURN服务器   ✓ 防火墙允许出站
  TURN 在两个出站连接之间做中继转发
```

防火墙通常的规则：**允许出站，阻止入站**。TURN 巧妙地让双方都只做出站连接。

#### 原因 2：使用标准端口，伪装成普通流量

```
┌──────────────────────────────────────────┐
│ TURN 端口策略                             │
├──────────┬───────────────────────────────┤
│ 端口 443 │ TLS加密，和HTTPS流量一模一样   │
│          │ 防火墙无法区分是网页还是TURN    │
├──────────┼───────────────────────────────┤
│ 端口 80  │ 和HTTP流量一样，几乎不会被封   │
├──────────┼───────────────────────────────┤
│ 端口 3478│ TURN标准端口，部分环境可用     │
└──────────┴───────────────────────────────┘

传输协议降级策略：
  UDP (最快) → TCP (更可靠) → TLS/TCP 443 (最兼容)
```

**443 端口上的 TURN over TLS** 对防火墙来说就是普通的 HTTPS 流量，几乎不可能被封锁（封了 443 等于封了整个互联网）。

#### 原因 3：中继架构消除 NAT 问题

```
NAT 问题：
  A 的公网IP = 203.0.1.1:随机端口（NAT映射）
  B 的公网IP = 198.0.2.2:随机端口（NAT映射）
  对称NAT下，端口映射对每个目标不同 → STUN打洞失败

TURN 解决方案：
  A 连 TURN → TURN 分配一个中继地址 relay-A = TURN-IP:5000
  B 连 TURN → TURN 分配一个中继地址 relay-B = TURN-IP:5001

  A 发数据 → TURN:5000 → 转发到 → TURN:5001 → B
  B 发数据 → TURN:5001 → 转发到 → TURN:5000 → A

  完全不需要知道对方的真实IP！
```

#### 原因 4：网络不稳定的应对

```
┌──────────────────────────────────────────────┐
│ TURN 对抗网络不稳定                           │
├──────────────────────────────────────────────┤
│                                              │
│ 1. TCP 保活：TURN 维持长连接，自动重连        │
│                                              │
│ 2. 分配刷新：定期 Refresh 保持中继地址有效    │
│    Client → TURN: Refresh (每几分钟)          │
│                                              │
│ 3. 多候选路径：ICE 同时探测多条路径           │
│    host → srflx → relay，自动选最优           │
│                                              │
│ 4. 带宽适应：WebRTC 内置拥塞控制              │
│    网络差 → 自动降码率/分辨率                 │
│                                              │
└──────────────────────────────────────────────┘
```

### TURN 凭据的真正用途

```
TURN 凭据（用户名+密码）：

┌─────────────────────────────────────────────┐
│ 不是用来"认证用户身份"的                      │
│ 而是用来"授权使用中继带宽"的                  │
├─────────────────────────────────────────────┤
│                                             │
│ 为什么需要凭据：                              │
│   TURN 服务器转发流量 = 消耗带宽 = 花钱       │
│   没有凭据 → 任何人都能白嫖你的中继服务器     │
│                                             │
│ 典型流程：                                    │
│   1. 客户端向业务服务器请求 TURN 凭据         │
│      （这步用 API Key/JWT 认证）              │
│   2. 业务服务器生成临时凭据（通常有效几小时）  │
│      username = "timestamp:userId"           │
│      password = HMAC-SHA1(secret, username)  │
│   3. 客户端用临时凭据连接 TURN               │
│   4. TURN 验证凭据有效性 → 分配中继地址       │
│                                             │
└─────────────────────────────────────────────┘
```

### ICE 完整探路流程

TURN 是 ICE 策略的最后一道保障，ICE 会按优先级依次尝试：

```
ICE 探路顺序：

1. Host Candidate（直连）
   你的电脑 ───────── Azure
   "我的本地 IP 是 192.168.1.100:54321"
   → 局域网可能成功，公网几乎不行

2. Server Reflexive / srflx（STUN 探测公网地址）
   你的电脑 ──► STUN 服务器 ──► "你的公网 IP 是 203.0.113.5:12345"
   → 对称 NAT 下可能失败

3. Relay Candidate（TURN 中继，兜底方案）
   你的电脑 ──► TURN 服务器 ◄── Azure
   → 一定能通，延迟稍高

ICE 会同时探测所有路径，选择延迟最低的那条。
如果直连和 STUN 都不行，自动降级到 TURN 中继。
```

### 不同网络环境下 TURN 的价值（补充疑问 9）

| 网络环境 | 无 TURN | 有 TURN | TURN 价值 |
|----------|---------|---------|-----------|
| 家庭 Wi-Fi（普通 NAT） | ~80% 成功 | ~100% 成功 | 补齐 20% |
| 企业网络（严格防火墙） | ~20% 成功 | ~95% 成功 | **救命** |
| 对称 NAT（某些运营商 4G） | ~30% 成功 | ~100% 成功 | 关键保障 |
| 酒店/机场 Wi-Fi | ~10% 成功 | ~90% 成功 | **不可或缺** |

> **一句话总结**：TURN 本质上是"合法的中间人"——利用出站连接 + 标准端口 + 中继转发，绕过了防火墙和 NAT 的所有限制。凭据是"带宽通行证"，不是"用户身份证"。在 BeiGene 的 MR 培训场景中（企业网络 + 移动办公），TURN 是 WebRTC 连接的生命线。

---

## 疑问 12：WebRTC 的 UDP 是双向还是单向？TURN 用 TCP 封装后 UDP 性能优势还在吗？

### 12.1 UDP 是双向还是单向？

**UDP 协议本身永远是双向的，但 WebRTC 在应用层可以控制"只用其中一个方向传媒体"。**

这里有两个不同的层次：

```
┌─────────────────────────────────────────────────────────────┐
│ 传输层 (UDP)：永远是双向的                                    │
│                                                             │
│   即使你设了 recvonly，底层 UDP socket 仍然能收能发            │
│   因为 WebRTC 需要双向发送 DTLS 握手包、RTCP 控制包、         │
│   ICE keep-alive 心跳包等                                    │
│                                                             │
│   浏览器 ◄════ UDP 双向通道 ════► Azure Avatar               │
│          →  DTLS 握手包、RTCP 反馈、ICE 心跳                 │
│          ←  SRTP 视频包、SRTP 音频包、RTCP 统计              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 应用层 (RTP 媒体)：由 Transceiver direction 控制             │
│                                                             │
│   "recvonly"  → 只接收对方的媒体流，不发送自己的媒体          │
│   "sendonly"  → 只发送自己的媒体流，不接收对方的              │
│   "sendrecv"  → 双向收发媒体流                               │
│                                                             │
│   本项目：direction = "recvonly"                              │
│   → 媒体数据单向（只收 Avatar 视频音频）                      │
│   → 但 UDP 通道本身仍然是双向的（控制包还是要发的）           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

"recvonly" 时 UDP 上实际跑的东西：

```
浏览器                                          Azure Avatar
  │                                                │
  │ ════════ 一条 UDP 双向通道 ════════════════════ │
  │                                                │
  │ ──► ICE Binding Request (心跳)                  │  ← 浏览器发出
  │ ◄── ICE Binding Response                       │  ← Azure 回
  │                                                │
  │ ──► RTCP Receiver Report (我收到了多少包)       │  ← 浏览器发出
  │ ◄── RTCP Sender Report (我发了多少包)           │  ← Azure 发出
  │                                                │
  │ ◄── SRTP Video (H.264 数字人视频帧)             │  ← 只有这个方向
  │ ◄── SRTP Audio (Opus 数字人音频帧)              │  ← 只有这个方向
  │                                                │
  │ ──► RTCP NACK (我丢了第 X 个包，请重传)         │  ← 浏览器发出
  │ ◄── SRTP 重传包                                │  ← Azure 补发
  │                                                │

总结：
  浏览器 → Azure: 控制包（心跳、反馈、重传请求）≈ 很少的数据
  Azure → 浏览器: 媒体包（视频+音频）+ 控制包 ≈ 大量数据

  "recvonly" 的含义是：媒体流单向，但 UDP 通道双向
```

> **一句话**：UDP 始终双向，`recvonly` 只是告诉 WebRTC "我不发媒体数据"，但控制信息（心跳、丢包反馈、DTLS 握手）仍然需要双向发送。

### 12.2 TURN 中继时为什么"都是出站"？

**因为两个客户端都主动连接 TURN 服务器，而不是互相连接。**

```
没有 TURN（直连尝试）：

  A 必须接受 B 的入站连接（或反过来）

  A ──入站──► B 的防火墙  ✗ 被拦截
  B ──入站──► A 的防火墙  ✗ 被拦截

  双方都在防火墙后面 → 谁也连不上谁


有 TURN（中继模式）：

  A 和 B 都不互相连接！
  双方都去连 TURN 服务器（出站连接）

  A ──出站──► TURN 服务器   ✓ A 的防火墙放行（因为是出站）
  B ──出站──► TURN 服务器   ✓ B 的防火墙放行（因为是出站）

  TURN 服务器在中间做转发：
    A 的数据 → TURN → 转发给 B
    B 的数据 → TURN → 转发给 A
```

**关键洞察**：防火墙的默认规则是"允许出站，阻止入站"。TURN 把"两个入站问题"转化为"两个出站连接 + 一个中间转发"。

### 12.3 TURN 到底用什么协议？TCP 封装了 UDP 吗？

**TURN 不是只有一种模式，它有三种传输方式，按优先级逐级降级：**

```
┌────────────────────────────────────────────────────────────────────┐
│                    TURN 三种传输模式                                │
├─────────────┬──────────┬──────────┬────────────────────────────────┤
│ 模式         │ 端口     │ 协议     │ 说明                           │
├─────────────┼──────────┼──────────┼────────────────────────────────┤
│ TURN/UDP    │ 3478     │ UDP      │ 首选！客户端和TURN之间也走UDP   │
│ (最优)      │          │          │ 保留UDP全部性能优势             │
├─────────────┼──────────┼──────────┼────────────────────────────────┤
│ TURN/TCP    │ 3478     │ TCP      │ UDP被封时降级                   │
│ (降级)      │          │          │ 客户端→TURN走TCP，有一定损失    │
├─────────────┼──────────┼──────────┼────────────────────────────────┤
│ TURN/TLS    │ 443      │ TLS+TCP  │ 最后手段，伪装成HTTPS          │
│ (兜底)      │          │          │ 性能最差，但穿透力最强          │
└─────────────┴──────────┴──────────┴────────────────────────────────┘

ICE 会自动探测哪种能用，优先选最快的。
```

三种模式的实际数据路径：

```
模式 1: TURN/UDP（最优情况）
┌──────┐  UDP  ┌──────────┐  UDP  ┌──────┐
│ 浏览器 │◄════►│ TURN 服务器│◄════►│ Azure│
└──────┘       └──────────┘       └──────┘
  全程 UDP，性能几乎等同于直连（只多了一跳延迟）


模式 2: TURN/TCP（UDP 被封时）
┌──────┐  TCP  ┌──────────┐  UDP  ┌──────┐
│ 浏览器 │◄────►│ TURN 服务器│◄════►│ Azure│
└──────┘       └──────────┘       └──────┘
  浏览器→TURN 走 TCP（穿防火墙）
  TURN→Azure 仍走 UDP（中继内部转发）
  ⚠️ 浏览器侧有 TCP 开销


模式 3: TURN/TLS (port 443)（最后手段）
┌──────┐ TLS  ┌──────────┐  UDP  ┌──────┐
│ 浏览器 │◄────►│ TURN 服务器│◄════►│ Azure│
└──────┘ :443  └──────────┘       └──────┘
  浏览器→TURN 走 TLS+TCP（看起来像 HTTPS）
  TURN→Azure 仍走 UDP
  ⚠️ 浏览器侧有 TCP + TLS 双重开销
```

**关键细节**：TURN 服务器是一个**协议转换节点**，不是简单的隧道。它会：
1. **终结**客户端的连接（TCP 或 UDP）
2. **解包**数据
3. 用**新的 UDP 连接**转发给对端

所以即使客户端→TURN 走了 TCP，TURN→对端仍然可以走 UDP。

### 12.4 TCP 封装后 UDP 的性能优势还在吗？

**分情况。核心是理解 UDP 对实时音视频的三个优势，以及 TCP 封装后各损失多少：**

```
┌──────────────────────────────────────────────────────────────────┐
│              UDP 的三大实时优势 vs TCP 封装后的影响               │
├────────────────┬─────────────────┬───────────────────────────────┤
│ UDP 优势        │ TCP 封装后       │ 影响程度                      │
├────────────────┼─────────────────┼───────────────────────────────┤
│ 1. 无队头阻塞   │ ❌ 丧失          │ 严重                          │
│   (丢一个包不   │ TCP 丢包会阻塞   │ 网络波动时可能出现             │
│    影响后续包)  │ 后续所有数据     │ 突然卡顿→快速恢复的现象       │
├────────────────┼─────────────────┼───────────────────────────────┤
│ 2. 低延迟       │ ⚠️ 部分丧失      │ 中等                          │
│   (无重传等待)  │ TCP 重传增加     │ 增加 ~50-150ms 尾部延迟       │
│                │ ~50-150ms       │ 平均延迟增加不大               │
├────────────────┼─────────────────┼───────────────────────────────┤
│ 3. 可丢包       │ ❌ 丧失          │ 中等                          │
│   (过时的帧可以 │ TCP 保证必达     │ 但 WebRTC 的 jitter buffer   │
│    直接丢弃)    │ 即使已过时也重传 │ 可以在应用层补偿               │
└────────────────┴─────────────────┴───────────────────────────────┘
```

**队头阻塞（Head-of-Line Blocking）**是最大的问题：

```
UDP 直连（理想情况）：
  帧1 ✓ → 播放
  帧2 ✗ → 丢了，跳过！直接播帧3     ← UDP 允许跳过
  帧3 ✓ → 播放
  帧4 ✓ → 播放
  结果：帧2丢了，画面闪一下，但后续帧不受影响

TCP 封装（TURN/TCP 或 TURN/TLS）：
  帧1 ✓ → 播放
  帧2 ✗ → 丢了... TCP 自动重传...
  帧3   → 等着... 帧2还没到...      ← TCP 队头阻塞！
  帧4   → 继续等...
  帧2 ✓ → 终于到了（但已经过时了）
  帧3 ✓ → 可以播了
  帧4 ✓ → 可以播了
  结果：帧2丢了，帧3和帧4全被阻塞，卡顿 ~100-300ms
```

### 12.5 各种连接模式的实际性能对比

```
┌──────────────┬────────────┬────────────┬─────────────────────┐
│ 连接模式      │ 额外延迟    │ 丢包表现    │ 实际体验            │
├──────────────┼────────────┼────────────┼─────────────────────┤
│ 直连 UDP     │ 基准 0ms   │ 最优       │ 最流畅              │
│ (无NAT问题)  │            │ 丢帧跳过   │                     │
├──────────────┼────────────┼────────────┼─────────────────────┤
│ TURN/UDP     │ +10-30ms   │ 最优       │ 几乎无感知差异       │
│ (只多一跳)   │ (一跳延迟) │ 丢帧跳过   │ 和直连体验一样       │
├──────────────┼────────────┼────────────┼─────────────────────┤
│ TURN/TCP     │ +30-80ms   │ 一般       │ 正常情况下OK         │
│              │            │ 队头阻塞   │ 弱网下偶尔卡顿       │
├──────────────┼────────────┼────────────┼─────────────────────┤
│ TURN/TLS:443 │ +50-150ms  │ 较差       │ 能用但有感知延迟     │
│ (最后手段)   │ (TLS握手+  │ 队头阻塞+  │ 弱网下卡顿更明显     │
│              │  TCP开销)  │ 加密开销   │                     │
├──────────────┼────────────┼────────────┼─────────────────────┤
│ 无连接       │ ∞          │ N/A        │ ❌ 黑屏，什么都没有  │
└──────────────┴────────────┴────────────┴─────────────────────┘

结论：TURN/TLS:443 (最差情况) 的体验 >>>>> 无连接
```

### 12.6 WebRTC 的补偿机制（即使底层走 TCP 也生效）

```
┌──────────────────────────────────────────────────────────────┐
│ WebRTC 自带的补偿机制                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ 1. Jitter Buffer（抖动缓冲）                                 │
│    → 不是收到就立即播，而是缓冲 50-200ms                      │
│    → 用缓冲平滑网络波动造成的帧到达时间不均匀                 │
│    → TCP 队头阻塞导致的延迟波动被缓冲吸收                     │
│                                                              │
│ 2. 自适应码率（Adaptive Bitrate）                            │
│    → 检测到网络差 → 自动降低视频分辨率/帧率                   │
│    → 减少数据量 → 减轻 TCP 拥塞                              │
│                                                              │
│ 3. FEC（前向纠错）                                           │
│    → 发送冗余数据包，接收端可以从部分数据恢复完整帧           │
│    → 减少重传需求 → 降低 TCP 队头阻塞的触发频率               │
│                                                              │
│ 4. 关键帧请求                                                │
│    → 丢了太多帧 → 请求发送端发一个完整关键帧 (I-frame)        │
│    → 快速恢复画面，而不是等所有丢失帧重传完                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

> **总结**：TURN 首选 UDP（性能优势完全保留）。只有 UDP 被封才降级到 TCP/TLS，这是"保命手段"不是"常规操作"。即使降级到 TCP，TURN 服务器是协议转换节点（只有客户端→TURN 走 TCP，TURN→对端仍走 UDP），且 WebRTC 有 jitter buffer + 自适应码率 + FEC 等多重补偿。最差的 TURN/TLS 体验也远远好于完全没有连接。

---

## 疑问 13：TURN 中继是不是相当于组建了一个虚拟局域网？

**方向对了，但不完全准确。TURN 给每个端点分配了地址和端口，通过这些地址通信——这部分你理解对了。但它不是"虚拟局域网"，而是一个点对点的邮件转发站。**

### 你的理解 vs 实际情况

```
┌─────────────────────────────────────────────────────────────────┐
│ 虚拟局域网理解（不完全对）：                                      │
│                                                                 │
│   ┌─────────────────────────────┐                               │
│   │  TURN "虚拟局域网"           │                               │
│   │                             │                               │
│   │   A (relay-A:5000)          │                               │
│   │      ↕  可以互相发现         │                               │
│   │   B (relay-B:5001)          │                               │
│   │      ↕  可以广播             │                               │
│   │   C (relay-C:5002)          │                               │
│   │                             │                               │
│   └─────────────────────────────┘                               │
│                                                                 │
│   ❌ 不对。TURN 不是局域网，没有广播、没有互相发现。              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ 实际情况（邮件转发站）：                                         │
│                                                                 │
│   A ──信──► ┌──────────┐ ──转发──► B                            │
│             │ TURN 服务器│                                       │
│   B ──信──► │ (转发站)  │ ──转发──► A                            │
│             └──────────┘                                        │
│                                                                 │
│   ✅ 每封信都必须经过转发站，A 和 B 永远不直接通信               │
│   ✅ A 不知道 B 的真实地址，B 也不知道 A 的真实地址              │
│   ✅ A 只知道 "把数据发到 TURN 的 relay-B 地址，TURN 会转给 B"  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 理解对了的部分：地址分配

**"分配地址和端口"——这一点完全正确！**

```
TURN Allocation（分配）过程：

Step 1: A 连接 TURN 服务器，请求分配
  A → TURN: "我要一个中继地址" (Allocate Request)

Step 2: TURN 分配一个 relay 地址给 A
  TURN → A: "你的中继地址是 TURN-IP:5000" (Allocate Response)

Step 3: B 也连接 TURN，请求分配
  B → TURN: "我也要一个中继地址"
  TURN → B: "你的中继地址是 TURN-IP:5001"

现在的地址表：
  A 的真实地址: 192.168.1.100:随机  ← TURN 知道，B 不知道
  A 的中继地址: TURN-IP:5000        ← B 知道，用这个发数据给 A
  B 的真实地址: 10.0.0.50:随机      ← TURN 知道，A 不知道
  B 的中继地址: TURN-IP:5001        ← A 知道，用这个发数据给 B
```

### 和真正局域网的关键区别

```
┌────────────┬──────────────────────────┬──────────────────────────┐
│ 维度        │ 真正的局域网              │ TURN 中继                │
├────────────┼──────────────────────────┼──────────────────────────┤
│ 通信路径    │ A ←──直接──→ B           │ A → TURN → B（必经中间人）│
│            │ 数据不经过第三方           │ 每个包都经过 TURN 转发    │
├────────────┼──────────────────────────┼──────────────────────────┤
│ 设备发现    │ ✅ 广播/mDNS 可以发现    │ ❌ 不能发现其他客户端     │
│            │ 局域网内的其他设备         │ 只能和预先配对的对端通信   │
├────────────┼──────────────────────────┼──────────────────────────┤
│ 地址归属    │ IP 在自己的网卡上         │ relay 地址在 TURN 服务器上│
│            │ 192.168.1.100 是我的      │ TURN-IP:5000 不是我的，   │
│            │                          │ 是 TURN 替我收信的地址    │
├────────────┼──────────────────────────┼──────────────────────────┤
│ 多对多      │ ✅ 任意设备互通           │ ❌ 点对点，A只能和B通信   │
│            │                          │ 要和C通信需要新的 relay   │
├────────────┼──────────────────────────┼──────────────────────────┤
│ 带宽        │ 本地交换，不耗外网带宽    │ 每个包都消耗 TURN 的带宽  │
└────────────┴──────────────────────────┴──────────────────────────┘
```

### 更准确的类比

```
❌ 虚拟局域网（VPN/VLAN）：
   大家在同一个网段，互相可见，直接通信
   → TURN 不是这个

✅ 更像：邮政信箱 / 邮件转发服务

   A 租了一个信箱（relay-A = TURN:5000）
   B 租了一个信箱（relay-B = TURN:5001）

   A 要给 B 写信：
     A 把信寄到 TURN:5001（B 的信箱）
     TURN 从 5001 信箱取出信 → 转交给 B 的真实地址

   B 要给 A 回信：
     B 把信寄到 TURN:5000（A 的信箱）
     TURN 从 5000 信箱取出信 → 转交给 A 的真实地址

   关键：A 和 B 都不知道对方住在哪，只知道对方的信箱号
```

用编程概念来理解：

```
✅ 更像：消息代理 / 代理模式

   TURN 服务器 ≈ 一个超轻量的消息代理
   relay 地址 ≈ 队列的地址

   // 伪代码
   turnServer.allocate("A") → relay_A = "TURN:5000"
   turnServer.allocate("B") → relay_B = "TURN:5001"

   // A 发数据给 B
   A.sendTo("TURN:5001", data)         // A 发到 B 的 relay 地址
   turnServer.forward("TURN:5001" → B) // TURN 转发给 B 的真实连接

   // B 发数据给 A
   B.sendTo("TURN:5000", data)         // B 发到 A 的 relay 地址
   turnServer.forward("TURN:5000" → A) // TURN 转发给 A 的真实连接
```

### 在本项目中

```
实际场景更简单，因为只有两方：浏览器 和 Azure Avatar

浏览器 ──出站──► TURN 服务器 ◄──出站── Azure Avatar
                    │
          浏览器的 relay: TURN:5000
          Azure 的 relay:  TURN:5001
                    │
    浏览器不知道 Azure 的真实 IP
    Azure 不知道浏览器的真实 IP
    双方只通过 TURN 分配的 relay 地址通信

    而且是 recvonly:
    Azure → TURN:5000 → 浏览器  (视频音频，大量数据)
    浏览器 → TURN:5001 → Azure  (控制包，极少数据)
```

> **总结**：你的直觉方向是对的——TURN 确实给每个端点分配了地址和端口，通过这些地址通信。但它不是"虚拟局域网"，而是一个**点对点的邮件转发站**：所有数据必须经过 TURN 转发，端点之间永远不直接通信，也无法发现其他端点。比起局域网，更像是租了一个信箱。

---

## 疑问 14：Azure Voice Live 通信中到底有几个 endpoint？WebRTC 的地址是什么形式？

**答案：一共涉及 5 个地址，但只有 1 个是你配置的（Azure AI Foundry endpoint）。其余都是 Azure 动态提供的。WebRTC 没有 URL，它的"地址"是 ICE candidate——IP:port 组合，藏在 SDP 文本里。**

### 完整地址清单

```
┌────┬────────────────────────────────────┬────────────┬──────────────────────┐
│ #  │ 地址                               │ 协议        │ 谁提供/谁配置        │
├────┼────────────────────────────────────┼────────────┼──────────────────────┤
│ 1  │ wss://your-backend/api/v1/         │ WebSocket  │ 你配置（后端地址）    │
│    │   voice-live/ws?token=JWT          │ (TCP)      │                      │
├────┼────────────────────────────────────┼────────────┼──────────────────────┤
│ 2  │ https://your-project.services.     │ HTTPS →    │ 你配置（Azure endpoint│
│    │   ai.azure.com                     │ SDK 内部   │ + API Key）          │
│    │                                    │ 转 WS      │                      │
├────┼────────────────────────────────────┼────────────┼──────────────────────┤
│ 3  │ stun:relay1.communication.         │ STUN       │ Azure 动态返回        │
│    │   azure.com:3478                   │ (UDP)      │ （session.updated）   │
├────┼────────────────────────────────────┼────────────┼──────────────────────┤
│ 4  │ turn:relay1.communication.         │ TURN       │ Azure 动态返回        │
│    │   azure.com:3478                   │ (UDP/TCP/  │ + 临时凭据            │
│    │                                    │  TLS)      │                      │
├────┼────────────────────────────────────┼────────────┼──────────────────────┤
│ 5  │ 203.0.113.50:49170                 │ SRTP/DTLS  │ ICE 协商动态发现      │
│    │ （Azure Avatar 的实际 IP:port，    │ (UDP)      │ 嵌在 SDP 中           │
│    │   每次连接都不同）                  │            │ 你永远不会直接看到    │
└────┴────────────────────────────────────┴────────────┴──────────────────────┘
```

你配置的 vs Azure 动态提供的：

```
你配置的（写在代码/环境变量里的，1个）：
  Azure AI Foundry endpoint: https://your-project.services.ai.azure.com
  → 后端 Python SDK 用这一个地址搞定一切

Azure 动态返回的（运行时自动下发的，4个）：
  ① STUN 服务器地址（探路用）
  ② TURN 服务器地址（中继用）
  ③ Azure Avatar 的 ICE candidates（WebRTC 对端地址）
  ④ Azure Avatar 的 SDP（媒体能力描述）

  → 这些都不需要你配置，Azure 在 session.updated 事件中自动下发
```

### WebRTC 的"地址"长什么样？

**WebRTC 没有 URL，它的地址是 SDP 文本里的 candidate 行：**

```
WebSocket 的地址：
  wss://your-backend.com/api/v1/voice-live/ws?token=xxx
  ↑ 一个完整的 URL，人类可读，你写在代码里

WebRTC 的地址：
  不是 URL！而是 SDP 文本里的 candidate 行：

  a=candidate:1 1 udp 2122260223 192.168.1.100 54321 typ host
  a=candidate:2 1 udp 1686052607 203.0.113.5 12345 typ srflx raddr 192.168.1.100 rport 54321
  a=candidate:3 1 udp 41885695 52.176.xxx.xxx 3478 typ relay raddr 203.0.113.5 rport 12345

  ↑ 这是机器协商出来的，你不会手写这些，浏览器自动生成
```

SDP candidate 各字段拆解：

```
a=candidate:3 1 udp 41885695 52.176.xxx.xxx 3478 typ relay
             │ │  │     │        │           │       │
             │ │  │     │        │           │       └─ 类型: relay(TURN中继)
             │ │  │     │        │           └─ 端口: 3478
             │ │  │     │        └─ IP: 52.176.xxx.xxx (TURN 服务器的公网IP)
             │ │  │     └─ 优先级: 41885695 (relay 优先级最低)
             │ │  └─ 协议: UDP
             │ └─ 组件: 1 (RTP)
             └─ candidate 编号

对比三种 candidate 的优先级：
  host (直连)  : 优先级 2122260223  ← 最高，首选
  srflx (STUN) : 优先级 1686052607  ← 中等
  relay (TURN)  : 优先级 41885695   ← 最低，兜底

  ICE 会从高优先级开始尝试，都不行才用 relay
```

### WebRTC 的通信形式 vs WebSocket 的通信形式

```
WebSocket 通信形式：
  ┌─────────────────────────────────────────────┐
  │ 请求: ws.send(JSON.stringify({              │
  │   type: "input_audio_buffer.append",        │
  │   audio: "base64编码的音频..."               │
  │ }))                                         │
  │                                             │
  │ 响应: ws.onmessage → JSON 解析              │
  │ { type: "response.audio_transcript.delta",  │
  │   delta: "你好..." }                         │
  │                                             │
  │ 格式: JSON 文本帧 / 二进制帧                  │
  │ 传输: TCP 有序可靠                            │
  │ 控制: 你发什么，对方就收什么                   │
  └─────────────────────────────────────────────┘

WebRTC 通信形式：
  ┌─────────────────────────────────────────────┐
  │ 没有"发送"和"接收"API！                       │
  │                                             │
  │ 连接建立后，媒体流自动流动：                   │
  │   pc.ontrack = (event) => {                 │
  │     video.srcObject = event.streams[0];     │
  │   }                                         │
  │   // 视频帧自动解码、自动渲染到 <video> 标签   │
  │   // 你不需要手动"读取"每一帧                  │
  │                                             │
  │ 格式: RTP 包（20-1400 字节的 UDP 数据报）     │
  │       每个包 = RTP头(12字节) + 载荷(编码数据)  │
  │ 传输: UDP 无序可丢包                          │
  │ 控制: 浏览器+操作系统自动处理，你碰不到原始包  │
  └─────────────────────────────────────────────┘
```

### RTP 包内部结构（了解即可，你永远不会直接操作）

```
┌──────────────────────────────────────────────┐
│              一个 RTP 视频包                   │
├──────────────────────────────────────────────┤
│ UDP 头 (8 bytes)                              │
│   src port: 49170, dst port: 54321            │
├──────────────────────────────────────────────┤
│ DTLS 加密层                                   │
│   (整个 RTP 包被 SRTP 加密，中间人看到乱码)    │
├──────────────────────────────────────────────┤
│ RTP 头 (12 bytes)                             │
│   版本: 2                                     │
│   载荷类型: 96 (H.264)                        │
│   序列号: 34521 (用于排序和检测丢包)            │
│   时间戳: 5765400 (用于音视频同步)              │
│   SSRC: 0x1A2B3C4D (流的唯一标识)              │
├──────────────────────────────────────────────┤
│ H.264 载荷 (~1000 bytes)                      │
│   一个视频帧的一部分（大帧会分成多个 RTP 包）   │
└──────────────────────────────────────────────┘

浏览器收到后：
  → SRTP 解密
  → RTP 头解析（排序、丢包检测）
  → H.264 载荷送入硬件解码器
  → 解码后的帧渲染到 <video> 元素
  → 全自动，你的 JS 代码完全不介入
```

### 完整通信架构全景图

```
┌────────────────────────────────────────────────────────────────────────┐
│                    Azure Voice Live 完整通信架构                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  浏览器                 后端 FastAPI              Azure Cloud           │
│  ┌──────┐              ┌──────────┐              ┌──────────────┐      │
│  │      │──── ① ──────►│          │──── ② ──────►│ Voice Live   │      │
│  │      │  WebSocket   │          │  Python SDK  │ API          │      │
│  │      │  wss://后端   │          │  https://    │              │      │
│  │      │  /api/v1/    │          │  foundry     │ STT+LLM+TTS │      │
│  │      │  voice-live  │          │  endpoint    │              │      │
│  │      │  /ws         │          │              │              │      │
│  │      │◄─────────────│◄─────────│◄─────────────│              │      │
│  │      │  JSON 文本    │  SDK 事件 │  session.*   │              │      │
│  │      │  + base64音频 │          │  response.*  │              │      │
│  │      │              │          │              └──────┬───────┘      │
│  │      │              └──────────┘                     │              │
│  │      │                                               │              │
│  │      │           session.updated 包含：               │              │
│  │      │◄──────────  ③ STUN 地址 ─────────────────────┘              │
│  │      │◄──────────  ④ TURN 地址 + 临时凭据                          │
│  │      │◄──────────  SDP Answer (含 ⑤ Azure 的 ICE candidates)      │
│  │      │                                                              │
│  │      │              ┌──────────────────────────────────┐            │
│  │      │═══ ⑤ ══════►│        Azure Avatar 服务          │            │
│  │      │  WebRTC      │  IP:port 由 ICE 协商动态决定      │            │
│  │      │  SRTP/DTLS   │  不是一个固定 URL               │            │
│  │      │  over UDP    │  可能直连，也可能经 ④ TURN 中继  │            │
│  │      │◄═════════════│  H.264 视频 + Opus 音频          │            │
│  │      │              └──────────────────────────────────┘            │
│  └──────┘                                                              │
│                                                                        │
│  地址总结：                                                             │
│  ① wss://your-backend/api/v1/voice-live/ws   （你配置）                │
│  ② https://xxx.services.ai.azure.com         （你配置）                │
│  ③ stun:relay1.communication.azure.com:3478  （Azure 返回）           │
│  ④ turn:relay1.communication.azure.com:3478  （Azure 返回 + 临时凭据） │
│  ⑤ 动态 IP:port（ICE 协商，嵌在 SDP candidate 中）                    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

> **总结**：你只需配置 1 个地址（Azure AI Foundry endpoint），Azure 会在运行时动态下发 STUN/TURN 服务器地址和 WebRTC 所需的 ICE candidates。WebRTC 没有 URL——它的"地址"是嵌在 SDP 文本中的 IP:port 组合，由 ICE 协商自动发现，每次连接都可能不同。WebRTC 的通信是 RTP 包在 UDP 上流动，浏览器自动处理编解码和渲染，你的 JS 代码只需绑定 `<video>` 元素即可。

---

## 疑问 15：Python 服务端如何支持 WebRTC？WebSocket 信令 vs SFU vs 媒体处理

**答案：取决于服务端要不要"碰"媒体流。只做信令（转发 SDP/ICE）不需要任何 WebRTC 库；要转发或处理媒体流才需要 aiortc 等专用库。**

### 服务端角色决定实现复杂度

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

### 场景 1：信令服务器（本项目就是这种，最常见）

服务端完全不碰 WebRTC 媒体流，只用 WebSocket 转发 SDP 和 ICE 候选。

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

对应的前端代码：

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

数据流向：

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

### 场景 2：SFU 媒体转发（多人视频会议）

服务端需要接收 WebRTC 媒体流并转发给其他参与者。

为什么需要 SFU？

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

Python 用 `aiortc` 实现 SFU（简化示例）：

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

### 场景 3：媒体处理服务器（AI 分析/录制/混流）

服务端不仅接收 WebRTC 流，还要解码、处理（AI 分析）、再编码发回。

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

### 三种场景的技术选型对比

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

### 生产级 SFU/MCU 方案（为什么不推荐纯 Python）

```
aiortc 的定位：
  ✅ 功能完整，API 优雅，学习和原型开发首选
  ❌ 单线程 Python 处理 RTP → 高并发下 CPU 瓶颈
  ❌ 视频编解码（libav）在 Python 中开销大
  ❌ 没有大规模生产验证（不像 mediasoup/Janus）

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

  推荐架构模式：信令用 Python，媒体处理用专用引擎
    Python FastAPI (信令+业务逻辑) → 调用 mediasoup/LiveKit API (媒体转发)
```

> **总结**：WebSocket 信令服务器用纯 Python 就够了（本项目就是这样），不需要任何 WebRTC 库。如果需要服务端碰媒体流（SFU 转发或 AI 处理），用 `aiortc` 可以快速原型开发，但生产环境推荐用 mediasoup/LiveKit 等专用引擎处理媒体，Python 专注于信令和业务逻辑。

---

## 疑问 16：前端怎么渲染流媒体？收到 WebRTC 视频音频后用什么 UI 组件展示？

**答案：浏览器原生的 `<video>` 和 `<audio>` HTML 标签就是流媒体的渲染组件。WebRTC 的 MediaStream 通过 `element.srcObject = stream` 绑定到标签上，浏览器自动解码和渲染。不需要任何第三方播放器库。**

### 核心概念：srcObject 是桥梁

```
传统的文件播放（你熟悉的）：
  <video src="https://example.com/video.mp4" />
  → 浏览器下载文件 → 解码 → 播放
  → src 是一个 URL，指向一个文件

流媒体播放（WebRTC / 实时流）：
  videoElement.srcObject = mediaStream;
  → 浏览器直接从内存中的 MediaStream 读取帧 → 解码 → 播放
  → srcObject 是一个 JS 对象，指向实时流，不是文件 URL
  → 没有"文件"概念，数据是持续到达的

这就是唯一的区别：src（文件URL） vs srcObject（实时流对象）
```

### 本项目的实际代码解析

#### 1. `<video>` 标签 —— 数字人视频渲染

文件：`frontend/src/components/voice/avatar-view.tsx`

```tsx
// avatar-view.tsx 第 86-95 行
<video
  ref={videoRef}          // ← React ref，让 hook 能通过 JS 操作这个元素
  autoPlay                // ← 收到流后自动播放，不需要用户点击
  playsInline             // ← 移动端不全屏播放（iOS 必需）
  className={cn(
    "absolute inset-0 h-full w-full object-cover",
    isAvatarConnected ? "opacity-100" : "opacity-0",  // ← 连接前透明隐藏
  )}
/>

// 关键：这个 <video> 标签始终在 DOM 中，只是透明度为 0
// 为什么不用 display:none？因为浏览器对 display:none 的元素禁止 autoplay
```

对应的 hook 绑定代码：`frontend/src/hooks/use-avatar-stream.ts`

```typescript
// use-avatar-stream.ts 第 47-76 行
pc.ontrack = (event) => {
  // WebRTC 每收到一个媒体轨道，触发一次 ontrack

  if (event.track.kind === "video" && videoRef.current) {
    // 视频轨道 → 绑定到 <video> 标签
    videoRef.current.srcObject = event.streams[0];  // ← 就这一行！
    videoRef.current.play();                         // ← 开始播放

    // 之后浏览器自动：
    //   1. 从 MediaStream 中持续读取 RTP 包
    //   2. SRTP 解密
    //   3. H.264 硬件解码（GPU 加速）
    //   4. 渲染到 <video> 元素的画布上
    //   5. 按帧率刷新（通常 30fps）
    //   全自动，JS 代码不需要介入
  }

  if (event.track.kind === "audio") {
    // 音频轨道 → 动态创建隐藏的 <audio> 标签
    const audio = document.createElement("audio");
    audio.srcObject = event.streams[0];   // ← 绑定音频流
    audio.autoplay = true;                // ← 自动播放
    audio.style.display = "none";         // ← 隐藏（只要声音，不要UI）
    document.body.appendChild(audio);     // ← 必须加到 DOM 才能播放
    audio.play();
  }
};
```

#### 2. 完整的 UI 层次（从上到下）

```
avatar-view.tsx 的四层渲染结构：

┌─────────────────────────────────────────────────┐
│  Layer 4 (z-20): HCP 名字条                      │
│  ┌─────────────────────────────────────────────┐│
│  │ "Dr. Zhang"                                 ││
│  └─────────────────────────────────────────────┘│
│                                                  │
│  Layer 3 (z-20): 加载骨架屏                      │
│  ┌─────────────────────────────────────────────┐│
│  │ ⬜ Skeleton + "连接中..."                    ││
│  │ （WebRTC 协商时显示，连接后消失）             ││
│  └─────────────────────────────────────────────┘│
│                                                  │
│  Layer 2 (z-10): WebRTC <video>                  │
│  ┌─────────────────────────────────────────────┐│
│  │ <video ref={videoRef} autoPlay playsInline>  ││
│  │                                             ││
│  │  连接前: opacity-0（透明，但始终在 DOM 中）   ││
│  │  连接后: opacity-100（显示数字人视频）        ││
│  │                                             ││
│  │  数据来源: pc.ontrack → srcObject = stream   ││
│  │  编码: H.264 视频（浏览器 GPU 解码）         ││
│  │  帧率: 30fps                                ││
│  └─────────────────────────────────────────────┘│
│                                                  │
│  Layer 1 (z-5): 静态预览 / AudioOrb             │
│  ┌─────────────────────────────────────────────┐│
│  │ <img> Azure CDN 角色缩略图                   ││
│  │   或                                        ││
│  │ <AudioOrb> 纯语音模式的动画波形球             ││
│  │ （连接后被 <video> 的 opacity-100 覆盖）      ││
│  └─────────────────────────────────────────────┘│
│                                                  │
│  隐藏层: <audio> 数字人语音                      │
│  ┌─────────────────────────────────────────────┐│
│  │ <audio srcObject={stream} autoplay hidden>   ││
│  │ 动态创建，display:none，只播放声音            ││
│  │ 数据来源: pc.ontrack → srcObject = stream    ││
│  │ 编码: Opus 音频（浏览器解码）                ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

#### 3. 状态切换时的 UI 变化

```
┌──────────────────┬──────────────┬──────────────┬──────────────┐
│ 状态              │ <video>      │ 静态预览/Orb  │ <audio>      │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ 未连接            │ opacity-0    │ 显示缩略图    │ 不存在       │
│ (idle)           │ (DOM中但透明) │ 或 AudioOrb  │              │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ 连接中            │ opacity-0    │ 隐藏          │ 不存在       │
│ (connecting)     │              │ 显示骨架屏    │              │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ 已连接-数字人模式  │ opacity-100  │ 被覆盖       │ 存在,自动播放 │
│ (digital_human)  │ 显示视频流    │              │ 口型同步声音 │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ 已连接-纯语音模式  │ opacity-0    │ AudioOrb     │ 不存在       │
│ (voice_only)     │              │ 动画波形球    │ (WS播放音频) │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ 断开连接          │ srcObject=   │ 恢复缩略图    │ remove()     │
│ (disconnect)     │ null,opacity0│              │ 从DOM移除    │
└──────────────────┴──────────────┴──────────────┴──────────────┘
```

### 关键的多媒体渲染技巧（从本项目代码中提炼）

#### 技巧 1：`<video>` 始终在 DOM 中，用 opacity 控制可见性

```tsx
// ✅ 正确做法（本项目）
<video
  ref={videoRef}
  className={isConnected ? "opacity-100" : "opacity-0"}  // 透明度切换
/>

// ❌ 错误做法
{isConnected && <video ref={videoRef} />}  // 条件渲染
// 问题: ontrack 触发时 <video> 可能还不在 DOM 中
// → srcObject 赋值失败 → 视频黑屏

// ❌ 也不行
<video style={{ display: isConnected ? "block" : "none" }} />
// 问题: display:none 的元素，浏览器会阻止 autoplay
// → play() 抛出异常
```

#### 技巧 2：`playsInline` 是移动端必需的

```tsx
<video
  autoPlay       // 所有平台: 收到流后自动播放
  playsInline    // iOS 专用: 不要全屏播放，在页面内播放
/>

// 如果没有 playsInline:
//   iOS Safari 会在播放视频时自动进入全屏模式
//   你的 UI 布局会被破坏
```

#### 技巧 3：音频用动态 `<audio>` 元素，而非 `<video>` 的音轨

```typescript
// 为什么不直接用 <video> 元素的音频？
// 因为 WebRTC 的 video track 和 audio track 是分开到达的
// 它们可能在不同的 MediaStream 中

// 视频: 绑定到已有的 <video> 元素
videoRef.current.srcObject = event.streams[0];

// 音频: 单独创建 <audio> 元素
const audio = document.createElement("audio");
audio.srcObject = event.streams[0];  // 这是音频的 stream，和视频的不同
audio.autoplay = true;
audio.style.display = "none";        // 隐藏，只要声音
document.body.appendChild(audio);    // 必须在 DOM 中才能播放
```

#### 技巧 4：断开时必须彻底清理

```typescript
// use-avatar-stream.ts disconnect()
const disconnect = () => {
  // 1. 关闭 WebRTC 连接
  pcRef.current?.close();
  pcRef.current = null;

  // 2. 清除视频流绑定
  if (videoRef.current) {
    videoRef.current.srcObject = null;  // ← 必须设为 null
    // 如果不清除，<video> 会显示最后一帧冻结画面
  }

  // 3. 移除动态创建的音频元素
  if (audioElRef.current) {
    audioElRef.current.srcObject = null;
    audioElRef.current.remove();        // ← 从 DOM 中移除
    audioElRef.current = null;
    // 如果不移除，音频会继续播放（直到 GC 回收）
  }
};
```

### 通用多媒体 UI 组件速查

```
┌──────────────┬──────────────────────────────┬──────────────────────────┐
│ 媒体类型      │ HTML 元素                     │ 数据绑定方式              │
├──────────────┼──────────────────────────────┼──────────────────────────┤
│ 文件视频      │ <video src="url">            │ src 属性 = 文件 URL      │
│ (mp4/webm)   │                              │                          │
├──────────────┼──────────────────────────────┼──────────────────────────┤
│ 实时视频流    │ <video>                      │ el.srcObject = stream    │
│ (WebRTC)     │ + autoPlay playsInline       │ (MediaStream 对象)       │
├──────────────┼──────────────────────────────┼──────────────────────────┤
│ 文件音频      │ <audio src="url">            │ src 属性 = 文件 URL      │
│ (mp3/wav)    │                              │                          │
├──────────────┼──────────────────────────────┼──────────────────────────┤
│ 实时音频流    │ <audio>                      │ el.srcObject = stream    │
│ (WebRTC)     │ + autoplay, display:none     │ (MediaStream 对象)       │
├──────────────┼──────────────────────────────┼──────────────────────────┤
│ 麦克风采集    │ AudioContext + AudioWorklet   │ getUserMedia() 获取流    │
│ (用户语音)   │ （无可见 UI 元素）            │ 手动处理 PCM 数据        │
├──────────────┼──────────────────────────────┼──────────────────────────┤
│ 程序生成音频  │ AudioContext + AudioBuffer   │ decodeAudioData() 解码   │
│ (AI TTS回复) │ （无可见 UI 元素）            │ AudioBufferSourceNode 播放│
├──────────────┼──────────────────────────────┼──────────────────────────┤
│ 摄像头预览    │ <video>                      │ el.srcObject = stream    │
│              │ + autoPlay playsInline muted │ getUserMedia({video:true})│
└──────────────┴──────────────────────────────┴──────────────────────────┘
```

### 本项目中四种音频播放方式的对比

```
┌────────────────┬──────────────────┬────────────────────┬──────────────┐
│ 音频类型        │ 来源              │ 播放方式            │ UI 元素       │
├────────────────┼──────────────────┼────────────────────┼──────────────┤
│ 数字人口型音频  │ WebRTC Audio Track│ <audio>.srcObject  │ 隐藏 <audio> │
│                │ (Opus 编码)       │ 浏览器自动解码      │ display:none │
├────────────────┼──────────────────┼────────────────────┼──────────────┤
│ 纯语音AI回复   │ WebSocket JSON    │ AudioContext +     │ 无可见元素    │
│                │ response.audio.   │ AudioBuffer +      │ (程序化播放) │
│                │ delta (base64     │ AudioBufferSource  │              │
│                │ PCM16)            │ Node               │              │
├────────────────┼──────────────────┼────────────────────┼──────────────┤
│ 用户麦克风采集  │ getUserMedia()    │ AudioWorklet 处理  │ 无可见元素    │
│                │ 浏览器麦克风API    │ → Float32 → base64 │ (采集不播放) │
│                │                  │ → WebSocket 发送   │              │
├────────────────┼──────────────────┼────────────────────┼──────────────┤
│ UI 音效        │ 静态文件          │ new Audio("url")   │ 无可见元素    │
│ (按钮音等)     │ /public/*.mp3     │ .play()            │              │
└────────────────┴──────────────────┴────────────────────┴──────────────┘
```

> **总结**：浏览器的 `<video>` 和 `<audio>` 标签就是流媒体的渲染组件，通过 `srcObject = mediaStream` 绑定实时流。关键技巧：标签始终在 DOM 中用 opacity 切换可见性（不用条件渲染或 display:none），iOS 必须加 `playsInline`，音频和视频分开绑定，断开时彻底清理 `srcObject = null`。本项目中所有多媒体渲染都使用浏览器原生 API，零第三方播放器依赖。

---

## 附录 A：WebRTC 核心术语详解

> 用项目真实代码对照解释每个术语，看完就能读懂 `use-avatar-stream.ts` 的每一行。

---

### PC — PeerConnection（对等连接）

**全称**：`RTCPeerConnection`

**是什么**：WebRTC 的核心对象，代表浏览器和远端（Azure Avatar）之间的一条媒体通道。所有 WebRTC 操作都围绕它展开。

**类比**：如果 WebSocket 的 `ws` 对象是"一部电话"，那 PC 就是"一台视频会议终端"——功能更强，但设置更复杂。

**在代码中**：

```typescript
// use-avatar-stream.ts 第 21 行
const pcRef = useRef<RTCPeerConnection | null>(null);

// 第 41-44 行：创建 PC
const pc = new RTCPeerConnection({
  iceServers: iceServers,        // 告诉 PC："用这些 TURN/STUN 服务器来探路"
  bundlePolicy: "max-bundle",    // 尽量把音频和视频打包在一条通道里
});

// 第 176 行：保存引用
pcRef.current = pc;

// 第 211 行：关闭连接
pcRef.current.close();
```

**PC 的生命周期**：

```
创建 → 配置收发模式 → 生成 Offer → ICE 探路 → 交换 SDP → DTLS 握手 → 媒体流动 → 关闭
 new     addTransceiver  createOffer   gathering   exchange    handshake    ontrack     close()
```

---

### SDP — Session Description Protocol（会话描述协议）

**是什么**：一段纯文本，描述"我能收发什么格式的音视频"。WebRTC 连接双方各生成一份 SDP，交换后才能协商出共同支持的格式。

**类比**：两个人要一起吃饭，各自写一张"我能吃什么"的清单（SDP Offer 和 SDP Answer），交换后找到都能吃的菜（共同编码格式）。

**SDP 长什么样**（简化版）：

```
v=0
o=- 123456 2 IN IP4 0.0.0.0
s=-
t=0 0
m=video 9 UDP/TLS/RTP/SAVPF 96           ← 我要接收视频，用端口 9
a=rtpmap:96 H264/90000                    ← 视频编码：H.264
a=recvonly                                ← 我只收不发
m=audio 9 UDP/TLS/RTP/SAVPF 111          ← 我要接收音频
a=rtpmap:111 opus/48000/2                 ← 音频编码：Opus
a=recvonly                                ← 我只收不发
a=fingerprint:sha-256 4A:3B:2C:1D:...    ← 我的 DTLS 证书指纹（密码学身份）
a=candidate:1 1 udp 2122260223 192.168.1.100 54321 typ host  ← 我的网络地址（ICE candidate）
```

**Offer 和 Answer 的关系**：

```
浏览器生成 Offer: "我能收 H.264 视频 + Opus 音频，我的地址是 X，我的指纹是 Y"
     ↓ （通过 WebSocket 传给 Azure）
Azure 生成 Answer: "OK，我也支持 H.264 + Opus，我的地址是 Z，我的指纹是 W"
     ↓ （通过 WebSocket 传回浏览器）
双方达成一致 → 开始传输
```

**在代码中**：

```typescript
// use-avatar-stream.ts 第 151-152 行：生成 Offer
const offer = await pc.createOffer();       // 浏览器自动生成 SDP 文本
await pc.setLocalDescription(offer);        // "这是我的描述，我确认了"

// 第 98-103 行：编码后通过 WebSocket 发送
const encodedSdp = btoa(JSON.stringify({
  type: "offer",
  sdp: pc.localDescription.sdp              // SDP 纯文本内容
}));
// → 通过 voiceLive.send({ type: "session.avatar.connect", client_sdp: encodedSdp })

// 第 171-174 行：收到 Azure 的 Answer
await pc.setRemoteDescription({             // "这是对方的描述，我确认了"
  type: "answer",
  sdp: serverSdp                            // Azure 返回的 SDP 文本
});
// → 此刻双方都知道对方的能力，WebRTC 正式连通
```

---

### ICE — Interactive Connectivity Establishment（交互式连接建立）

**是什么**：WebRTC 用来解决"我怎么找到对方"的机制。因为浏览器和 Azure 之间可能隔着 NAT、防火墙、路由器，不能直接互通，ICE 会尝试多种路径找到能用的那条。

**类比**：你要寄一个包裹给对方，但不知道对方确切地址。ICE 就是同时派出多个快递员（candidate），走不同的路线（直送、转发），看谁先到。

**ICE 探路的三种方式**：

```
方式 1: Host Candidate（直连）
  你的电脑 ───────────── Azure
  "我的本地 IP 是 192.168.1.100:54321，你能直接连吗？"
  → 局域网内可能成功，公网上几乎不可能（被 NAT 挡住）

方式 2: Server Reflexive / srflx（STUN 探测）
  你的电脑 ──► STUN 服务器 ──► "你的公网 IP 是 203.0.113.5:12345"
  "我的公网 IP 是 203.0.113.5:12345，你能连吗？"
  → 对称 NAT 下可能失败

方式 3: Relay Candidate（TURN 中继）
  你的电脑 ──► TURN 服务器 ◄── Azure
  "我们都连到中继服务器，通过它转发"
  → 一定能成功，但延迟稍高
```

**ICE 的工作过程**：

```
pc.createOffer() 触发
  → ICE Agent 开始收集 candidate（候选地址）
  → 每找到一个 candidate → 触发 pc.onicecandidate 回调
  → 全部找完 → onicecandidate(null) 或 iceGatheringState = "complete"
  → 把所有 candidate 写入 SDP
  → 发给对方
```

**在代码中**：

```typescript
// use-avatar-stream.ts 第 88-110 行
pc.onicecandidate = (e) => {
  if (e.candidate) {
    // 每找到一个候选地址，打印日志
    console.debug("[AvatarStream] ICE candidate: %s %s",
      e.candidate.type,    // "host" / "srflx" / "relay"
      e.candidate.protocol // "udp" / "tcp"
    );
  }
  if (!e.candidate) {
    // null = 所有候选地址都收集完了
    // 现在可以把完整的 SDP（包含所有 candidate）发给 Azure
    resolve(encodedSdp);
  }
};

// 第 132-147 行：8 秒安全超时
// 有些网络环境下 null candidate 事件永远不触发，所以设超时兜底
setTimeout(() => {
  if (!offerSent) {
    console.warn("[AvatarStream] ICE gathering timeout (8s)");
    resolve(encodedSdp);  // 超时了就用已经收集到的 candidate 先发
  }
}, 8000);
```

**ICE 状态机**（可以在浏览器 DevTools 中观察 `pc.iceConnectionState`）：

```
new → checking → connected → completed
                     ↓
                  failed（所有路径都不通 → WebRTC 连接失败）
```

---

### STUN — Session Traversal Utilities for NAT

**是什么**：一个轻量协议，用来让浏览器知道"我在公网上的 IP 和端口是多少"。

**类比**：你在房间里不知道自己家的门牌号，打电话问邻居（STUN 服务器）："你看到我的来电显示是什么号码？"邻居告诉你："你的公网地址是 203.0.113.5:12345"。

**在代码中**：STUN 地址包含在 Azure 返回的 ICE servers 里：

```typescript
// use-voice-live.ts 收到 session.updated 后：
iceServers = [
  { urls: "stun:xxx.communication.azure.com:3478" },    // ← STUN 服务器
  { urls: "turn:xxx.communication.azure.com:3478",       // ← TURN 服务器
    username: "临时用户名", credential: "临时密码" }
]
```

STUN 只"问路"，不"带路"。如果问到的地址能直连，就不需要 TURN。

---

### TURN — Traversal Using Relays around NAT

**是什么**：当 STUN 发现的地址直连不通时（对称 NAT、严格防火墙），TURN 服务器作为"中继"，双方都把数据发给 TURN，由 TURN 转发。

**类比**：你和朋友都在各自小区里，保安不让外人进。你们约在一个咖啡馆（TURN 服务器）见面，所有东西都通过咖啡馆转交。

**和 STUN 的对比**：

```
STUN: "你的公网地址是 X" → 双方尝试直连
  ✅ 快（直连），免费
  ❌ 穿不透对称 NAT 或严格防火墙

TURN: "把数据发给我，我帮你转发" → 中继模式
  ✅ 一定能通（没有穿透问题）
  ❌ 稍慢（多一跳），消耗中继服务器带宽
```

**为什么 TURN 需要用户名和密码**：因为 TURN 服务器帮你转发流量要花带宽和计算资源，所以需要认证，防止被滥用。Azure 为每个 Voice Live session 动态生成临时 TURN 凭据。

**在代码中**：

```typescript
// use-voice-live.ts 第 152-175 行
const sessionUsername = avatarResp?.username || avatarResp?.ice_username;
const sessionCredential = avatarResp?.credential || avatarResp?.ice_credential;

// 凭据应用到所有 ICE server
servers.map(s => ({
  urls: s.urls,
  username: sessionUsername || s.username,       // ← TURN 用户名（临时）
  credential: sessionCredential || s.credential, // ← TURN 密码（临时）
}));
```

---

### DTLS — Datagram Transport Layer Security

**是什么**：WebRTC 的加密层，相当于 UDP 版本的 TLS（HTTPS 用的就是 TLS）。保证媒体流是加密的，且能验证对方身份。

**类比**：DTLS 就像给视频通话加了一把锁。即使数据经过 TURN 中继，中继服务器也只能看到加密后的乱码，不能偷看视频内容。

**DTLS 指纹 = 密码学身份证**：

```
SDP 中的这行：
  a=fingerprint:sha-256 4A:3B:2C:1D:EF:...

含义：
  "我的 DTLS 证书的 SHA-256 哈希是 4A:3B:2C:1D:EF:..."
  "如果你在 DTLS 握手时发现我的证书指纹不是这个，说明我是假冒的，请拒绝连接"
```

这就是疑问 1 追问中提到的"怎么保证 WebRTC 客户端就是 WebSocket 认证的那个客户端"的密码学机制。

---

### Offe / Answer（提议 / 应答）

**是什么**：SDP 交换的两个角色。发起方（浏览器）生成 Offer，接收方（Azure）生成 Answer。

**在代码中**：

```typescript
// Offer: 浏览器说"我要什么"
const offer = await pc.createOffer();          // 自动生成
await pc.setLocalDescription(offer);           // 确认

// Answer: Azure 说"我能给什么"
await pc.setRemoteDescription({                // 设置对方的应答
  type: "answer", sdp: serverSdp
});
```

**规则**：
- 一次连接只有一对 Offer/Answer
- 必须先 Offer 后 Answer（不能反过来）
- Offer 方先 `setLocalDescription(offer)`，再发给对方
- Answer 方先 `setRemoteDescription(offer)`，再 `setLocalDescription(answer)`
- 在本项目中，浏览器是 Offer 方，Azure Avatar 是 Answer 方

---

### Transceiver（收发器）

**是什么**：PC 上的"一个轨道口"，决定这个口是发视频、收音频、还是双向。

**在代码中**：

```typescript
// use-avatar-stream.ts 第 80-81 行
pc.addTransceiver("video", { direction: "recvonly" });  // 加一个视频口，只收
pc.addTransceiver("audio", { direction: "recvonly" });  // 加一个音频口，只收
```

**direction 的四种模式**：

```
"sendrecv"  — 又发又收（视频通话标配）
"sendonly"  — 只发不收（直播推流）
"recvonly"  — 只收不发（本项目！只看数字人，不传自己的画面）
"inactive"  — 既不发也不收（暂停）
```

为什么是 `recvonly`？因为用户的语音通过 WebSocket 发送（base64 PCM16），不走 WebRTC 上传。WebRTC 在本项目中只负责从 Azure 接收数字人的视频和音频。

---

### Track（轨道）和 MediaStream（媒体流）

**是什么**：
- **Track** = 一条单独的音频或视频数据流
- **MediaStream** = 一个或多个 Track 的容器

**类比**：Track 是"一根水管"（视频管或音频管），MediaStream 是"一组水管的接口"。

**在代码中**：

```typescript
// use-avatar-stream.ts 第 47-76 行
pc.ontrack = (event) => {
  // 每收到一个 Track 触发一次

  if (event.track.kind === "video") {
    // 视频轨道 → 绑定到 <video> 元素
    videoElement.srcObject = event.streams[0];  // streams[0] 是包含此 track 的 MediaStream
    videoElement.play();
  }

  if (event.track.kind === "audio") {
    // 音频轨道 → 创建隐藏的 <audio> 元素
    const audio = document.createElement("audio");
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
    audio.style.display = "none";
    document.body.appendChild(audio);           // 必须加到 DOM 里，某些浏览器才播放
  }
};
```

在本项目中，Azure Avatar 通过 WebRTC 推送 2 个 Track：
1. **Video Track**：H.264 编码的数字人视频（面部表情、口型、身体动作）
2. **Audio Track**：Opus 编码的数字人语音（与口型同步）

---

### Candidate（候选地址）

**是什么**：ICE 探测到的"我可以通过这个地址被联系到"的信息。一个 PC 通常会收集多个 candidate。

**三种类型**：

```
host     — 本地直接地址 (192.168.1.100:54321)
           "这是我在局域网的地址"

srflx    — STUN 探测到的公网地址 (203.0.113.5:12345)
           "这是 NAT 外面看到的我的地址"

relay    — TURN 中继地址 (turn-server.azure.com:3478)
           "如果其他地址都连不上，通过这个中继找我"
```

**在代码中**：

```typescript
// use-avatar-stream.ts 第 88-94 行
pc.onicecandidate = (e) => {
  if (e.candidate) {
    console.debug("[AvatarStream] ICE candidate: %s %s",
      e.candidate.type,     // "host", "srflx", or "relay"
      e.candidate.protocol  // "udp" or "tcp"
    );
  }
  // e.candidate === null 表示收集结束
};
```

---

### bundlePolicy（打包策略）

**在代码中**：

```typescript
const pc = new RTCPeerConnection({
  iceServers: ...,
  bundlePolicy: "max-bundle",   // ← 这个
});
```

**含义**：尽量把所有媒体（视频 + 音频）打包到一条网络连接上，而不是每种媒体单独建连接。

```
"max-bundle":  视频 + 音频 → 一条 UDP 连接      ✅ 更快，candidate 更少
"balanced":    每种媒体可能单独一条连接
"max-compat":  完全分开，每种媒体独立连接         ❌ candidate 多，协商慢
```

本项目用 `max-bundle` 是因为我们只有一路视频 + 一路音频，打包在一起最高效。

---

## 附录 B：通用术语速查

| 术语 | 解释 |
|------|------|
| **WebSocket** | 基于 TCP 的全双工通信协议，浏览器和服务器可以互相推送消息。用 `wss://` URL 连接。 |
| **WebRTC** | Web Real-Time Communication，浏览器原生的实时音视频通信技术。用 ICE/SDP 协商连接，无 URL。 |
| **PCM16** | 脉冲编码调制，16bit 采样深度，无压缩的原始音频格式。本项目中 WebSocket 音频用此格式。 |
| **Opus** | 一种高效音频压缩编码，WebRTC 默认使用。延迟低，压缩比高。 |
| **H.264** | 视频压缩标准。本项目中 WebRTC 传输数字人视频用此编码。 |
| **VAD** | Voice Activity Detection，语音活动检测。Azure 用它判断用户是否在说话，决定何时触发 AI 回复。 |
| **AudioWorklet** | 浏览器音频处理 API，在独立线程中采集麦克风数据。比旧的 ScriptProcessorNode 性能更好。 |
| **base64** | 一种将二进制数据（如音频字节）编码为纯文本字符串的方式，以便塞进 JSON 传输。 |
| **NAT** | Network Address Translation，网络地址转换。家庭/企业路由器把内网地址映射为公网地址的机制，是 WebRTC 需要 ICE 穿透的根本原因。 |
| **RTP/SRTP** | Real-time Transport Protocol，实时传输协议。WebRTC 用它在 UDP 上传输音视频帧。SRTP 是加密版本。 |

---

## 疑问 17：和 Azure Voice Live API 通信时，中继器的引入是什么流程？

**答案：中继器（TURN）的引入是全自动的，它是 ICE 框架的一部分，你不需要手动决定"要不要用中继器"——ICE 会自动探测并选择最优路径。**

### 中继器引入的完整流程

整个流程分为**准备阶段**和**运行阶段**：

```
┌───────────────────────────────────────────────────────────────────────┐
│ 准备阶段：获取 TURN 凭据（在 WebSocket 信令通道上完成）                  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Step 1: 后端用 API Key 连接 Azure Voice Live SDK                     │
│    backend → Azure: connect(endpoint, credential, model,              │
│                             avatar_config=AvatarConfig(...))          │
│                                                                       │
│  Step 2: Azure 创建 session，返回 session.updated 事件                │
│    Azure → backend → 浏览器:                                          │
│    {                                                                  │
│      type: "session.updated",                                         │
│      session: {                                                       │
│        avatar: {                                                      │
│          ice_servers: [                                                │
│            {                                                          │
│              urls: "turn:relay1.communication.azure.com:3478",         │
│              username: "临时用户名",     ← TURN 凭据                   │
│              credential: "临时密码"      ← 几分钟后过期                 │
│            },                                                         │
│            {                                                          │
│              urls: "stun:relay1.communication.azure.com:3478"          │
│            }                                                          │
│          ]                                                            │
│        }                                                              │
│      }                                                                │
│    }                                                                  │
│                                                                       │
│  → 至此，浏览器拿到了 TURN/STUN 服务器地址和临时凭据                   │
│  → 注意：这一步不是"请求中继器"，而是 Azure 主动下发配置               │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│ 运行阶段：ICE 自动探路，决定是否使用 TURN 中继                          │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Step 3: 浏览器创建 RTCPeerConnection，传入 ICE servers               │
│    const pc = new RTCPeerConnection({                                 │
│      iceServers: [                                                    │
│        { urls: "turn:...", username: "...", credential: "..." },       │
│        { urls: "stun:..." }                                           │
│      ]                                                                │
│    });                                                                │
│                                                                       │
│  Step 4: 浏览器调用 createOffer()，触发 ICE gathering                  │
│    → 浏览器的 ICE Agent 同时探测三种路径：                              │
│                                                                       │
│    ┌─── host candidate ────── 本地 IP 直连（很可能失败）               │
│    ├─── srflx candidate ──── 通过 STUN 探测公网地址，尝试 NAT 穿透     │
│    └─── relay candidate ──── 连接 TURN 服务器，用凭据认证，分配中继地址 │
│                                                                       │
│  Step 5: TURN 分配中继地址                                            │
│    浏览器 → TURN: Allocate Request (带凭据)                            │
│    TURN → 浏览器: Allocate Response (relay address = TURN-IP:port)    │
│                                                                       │
│  Step 6: 所有 candidate 收集完毕，打包进 SDP Offer                    │
│    SDP 内容：                                                         │
│    a=candidate:1 1 udp 2122260223 192.168.1.100 54321 typ host       │
│    a=candidate:2 1 udp 1686052607 203.0.113.5 12345 typ srflx        │
│    a=candidate:3 1 udp 41885695 TURN-IP 5000 typ relay               │
│                                                                       │
│  Step 7: SDP 交换通过 WebSocket 完成                                  │
│    浏览器 → (WebSocket) → 后端 → (SDK) → Azure:                      │
│      session.avatar.connect { client_sdp: base64(offer) }            │
│    Azure → (SDK) → 后端 → (WebSocket) → 浏览器:                      │
│      { server_sdp: base64(answer) }                                  │
│                                                                       │
│  Step 8: ICE connectivity check（连通性检测）                          │
│    → ICE 按优先级依次尝试每对 candidate pair：                         │
│                                                                       │
│    尝试 1: host ←→ host (直连)                                        │
│      → 大概率失败（跨网络/NAT/防火墙）                                 │
│    尝试 2: srflx ←→ srflx (STUN 穿透)                                │
│      → 对称 NAT 下会失败                                              │
│    尝试 3: relay ←→ relay (TURN 中继)         ✅                      │
│      → 通过中继地址通信，一定成功                                      │
│                                                                       │
│  Step 9: ICE 选定最优路径                                             │
│    → 如果直连成功 → 用直连（延迟最低）                                 │
│    → 如果只有 TURN 成功 → 用 TURN 中继（兜底）                        │
│    → iceConnectionState: "connected"                                  │
│                                                                       │
│  Step 10: DTLS 握手 + 媒体流开始                                      │
│    → 无论是直连还是中继，都要走 DTLS 加密                              │
│    → H.264 视频 + Opus 音频开始流动                                   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 关键理解

| 问题 | 答案 |
|------|------|
| 中继器是我主动请求的吗？ | 不是。ICE 自动探路，自动决定是否使用 TURN 中继 |
| TURN 凭据从哪来？ | Azure 在 `session.updated` 中主动下发，不需要你单独请求 |
| 什么时候真正用上 TURN？ | 只有当直连和 STUN 穿透都失败时，ICE 才降级到 TURN |
| 用 TURN 需要改代码吗？ | 不需要！把 ICE servers 传给 `RTCPeerConnection` 就行，剩下全自动 |
| 企业防火墙下一定走 TURN？ | 大概率。严格防火墙封 UDP，STUN 穿透失败，ICE 自动选 TURN |

> **一句话**：TURN 中继器的引入是"声明式"的——你告诉 WebRTC "这里有个 TURN 可以用"（通过 iceServers 配置），ICE 自动决定要不要用。你不需要写任何"连接 TURN"的代码。

---

## 疑问 18：自己开发 WebRTC 前后端时，如何加入 TURN 中继器？代码怎么改？

**答案：分三部分——前端改动极小（只需传入 iceServers），后端信令不需要改，TURN 服务器是独立部署的基础设施。**

### 18.1 没有 TURN 的最简 WebRTC 架构（基线）

```
┌─────────────┐                              ┌─────────────┐
│  浏览器 A    │                              │  浏览器 B    │
│             │                              │             │
│ pc = new    │    WebSocket (信令)           │ pc = new    │
│ RTCPeer     │◄────────────────────────────►│ RTCPeer     │
│ Connection()│    SDP/ICE 交换               │ Connection()│
│             │                              │             │
│             │◄══════ WebRTC P2P ══════════►│             │
│             │    音视频直连                  │             │
└─────────────┘                              └─────────────┘
             │                                      │
     信令服务器（Python FastAPI WebSocket）
     只转发 JSON 消息，不碰媒体
```

最简前端代码（**无 TURN**）：

```javascript
// 无 TURN 版本 —— 只有 STUN
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }   // ← 只有 STUN
  ]
});

// ... 后续 SDP 交换代码与疑问 15 一样 ...
```

### 18.2 加入 TURN 后的改动

#### 改动 1：部署 TURN 服务器（基础设施层）

TURN 服务器是一个**独立运行的进程**，不是嵌入到你的 FastAPI 里的：

```bash
# 方案 A：自建 coturn（最流行的开源 TURN 服务器）
# 需要一台有公网 IP 的服务器

# 安装 coturn
sudo apt-get install coturn

# 配置 /etc/turnserver.conf
cat > /etc/turnserver.conf << 'EOF'
# 基础配置
listening-port=3478              # 标准 TURN 端口
tls-listening-port=443           # TLS 端口（穿透力最强）
external-ip=YOUR_PUBLIC_IP       # 你的公网 IP

# 中继范围
min-port=49152
max-port=65535

# 认证
use-auth-secret                  # 使用共享密钥生成临时凭据
static-auth-secret=MY_SECRET_KEY # 和后端共享的密钥
realm=my-app.com

# TLS 证书（用于 443 端口）
cert=/etc/letsencrypt/live/turn.my-app.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.my-app.com/privkey.pem

# 日志
log-file=/var/log/turnserver.log
EOF

# 启动
sudo systemctl start coturn
```

```bash
# 方案 B：使用云服务（零运维）
# - Twilio TURN（按流量计费）
# - Xirsys（全球节点）
# - Azure 内置 TURN（本项目用的就是这个，Azure Voice Live 自动提供）
```

#### 改动 2：后端生成临时 TURN 凭据

后端需要新增一个 API 端点，用共享密钥为前端生成临时凭据：

```python
# backend/app/api/turn.py — 新增文件

import hashlib
import hmac
import base64
import time
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/api/v1/turn", tags=["turn"])

@router.get("/credentials")
async def get_turn_credentials(user=Depends(get_current_user)):
    """
    生成临时 TURN 凭据。
    使用 TURN REST API 标准（RFC 中的 time-limited credentials 方案）。
    """
    settings = get_settings()

    # 凭据有效期：当前时间 + TTL（通常 1-24 小时）
    ttl = 86400  # 24 小时
    expiry = int(time.time()) + ttl

    # username = "过期时间戳:用户ID"
    username = f"{expiry}:{user.id}"

    # password = HMAC-SHA1(共享密钥, username)
    password = base64.b64encode(
        hmac.new(
            settings.turn_secret.encode("utf-8"),  # 和 coturn 配置里的 static-auth-secret 一样
            username.encode("utf-8"),
            hashlib.sha1
        ).digest()
    ).decode("utf-8")

    return {
        "ice_servers": [
            {
                "urls": [
                    f"turn:{settings.turn_server}:3478?transport=udp",   # UDP 优先
                    f"turn:{settings.turn_server}:3478?transport=tcp",   # TCP 降级
                    f"turns:{settings.turn_server}:443?transport=tcp",   # TLS 兜底
                ],
                "username": username,
                "credential": password,
            },
            {
                "urls": f"stun:{settings.turn_server}:3478",  # STUN 也提供
            }
        ],
        "ttl": ttl,
    }
```

配置中需要新增：

```python
# backend/app/config.py 中添加
class Settings(BaseSettings):
    # ... 现有配置 ...

    # TURN 配置
    turn_server: str = "turn.my-app.com"           # TURN 服务器域名
    turn_secret: str = "MY_SECRET_KEY"             # 和 coturn 共享的密钥
```

#### 改动 3：前端请求凭据并传入 RTCPeerConnection

前端改动很小，只需要在创建 `RTCPeerConnection` 之前，先请求凭据：

```javascript
// ===== 改动前（无 TURN） =====
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
});


// ===== 改动后（有 TURN） =====

// Step 1: 从后端获取 TURN 凭据
const response = await fetch("/api/v1/turn/credentials", {
  headers: { Authorization: `Bearer ${token}` }
});
const { ice_servers } = await response.json();

// Step 2: 传给 RTCPeerConnection
const pc = new RTCPeerConnection({
  iceServers: ice_servers    // ← 唯一的改动！
});

// Step 3: 后续代码完全不变
pc.addTransceiver("video", { direction: "sendrecv" });
pc.addTransceiver("audio", { direction: "sendrecv" });
// ... SDP 交换、ontrack 等 ...
```

**信令服务器（后端 WebSocket）的代码完全不需要改**——它只转发 SDP 和 ICE candidate，和有没有 TURN 完全无关。

### 18.3 改动汇总

```
┌──────────────────┬──────────────────────────────────────────────────┐
│ 组件              │ 需要改什么                                        │
├──────────────────┼──────────────────────────────────────────────────┤
│ TURN 服务器       │ 新增部署。独立的进程，有公网 IP                    │
│ (coturn/云服务)   │ 配置：端口、TLS 证书、共享密钥                    │
├──────────────────┼──────────────────────────────────────────────────┤
│ 后端 (FastAPI)    │ 新增 1 个 API 端点 /turn/credentials             │
│                  │ 用共享密钥生成临时凭据                             │
│                  │ config.py 新增 turn_server 和 turn_secret         │
├──────────────────┼──────────────────────────────────────────────────┤
│ 后端 WebSocket    │ ❌ 不需要改！信令转发和 TURN 完全无关              │
│ (信令服务器)      │                                                  │
├──────────────────┼──────────────────────────────────────────────────┤
│ 前端              │ 改 1 处：创建 RTCPeerConnection 时               │
│                  │ 用后端返回的 ice_servers 替换硬编码的 STUN         │
│                  │ 其余代码（SDP 交换、ontrack 等）完全不变           │
├──────────────────┼──────────────────────────────────────────────────┤
│ TURN 服务器代码   │ coturn 是现成的，不需要自己写中继代码              │
│                  │ 你只需要写配置文件，不需要写转发逻辑               │
└──────────────────┴──────────────────────────────────────────────────┘
```

### 18.4 完整架构图（加入 TURN 后）

```
┌─────────────┐                                    ┌─────────────┐
│  浏览器 A    │                                    │  浏览器 B    │
│             │     WebSocket (信令)                │             │
│             │◄──────────────────────────────────►│             │
│             │     SDP/ICE 交换                    │             │
│             │                                    │             │
│  ICE Agent  │     尝试 1: 直连 (UDP P2P)          │  ICE Agent  │
│  自动选路    │◄═══════════════════════════════════►│  自动选路    │
│             │     可能成功✓ 也可能失败✗            │             │
│             │                                    │             │
│             │     尝试 2: 经 TURN 中继             │             │
│             │──出站──►┌────────────┐◄──出站──────│             │
│             │         │ TURN 服务器 │              │             │
│             │◄────────│  (coturn)   │────────────►│             │
│             │  中继转发│  公网 IP    │  中继转发    │             │
└─────────────┘         └────────────┘              └─────────────┘
      │                       │                           │
      │              信令服务器 (FastAPI)                   │
      │              + TURN 凭据 API                       │
      │              只管信令和凭据                          │
      │              不碰媒体流                              │
```

> **总结**：加入 TURN 中继器的代码改动量极小。前端只改 `iceServers` 配置（约 5 行），后端新增一个凭据生成 API（约 30 行），信令代码零改动。真正的工作量在运维侧——部署和维护 TURN 服务器。这也是为什么很多团队选择使用 Azure 内置 TURN 或 Twilio 等云服务，省去运维成本。

---

## 疑问 19：TURN 中继器用的也是出站连接 + 双工通信，为什么防火墙不拦截？

**答案：防火墙允许双工通信的关键在于"谁发起连接"，而不是"数据往哪个方向流"。TURN 的出站连接一旦建立，双向数据流动是 TCP/UDP 协议的正常行为，防火墙不会拦截。**

### 先理解防火墙的工作原理

防火墙的核心规则不是"只允许数据出去"，而是**"只允许由内部发起的连接"**：

```
┌──────────────────────────────────────────────────────────────────────┐
│ 防火墙的本质：连接跟踪（Connection Tracking / Stateful Firewall）     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  规则不是：                                                           │
│    ✗ "只允许出站数据包"                                               │
│    ✗ "阻止所有入站数据包"                                             │
│                                                                      │
│  规则是：                                                             │
│    ✓ "只允许由内部发起的连接（及其响应）"                              │
│    ✓ "阻止由外部发起的新连接"                                         │
│                                                                      │
│  防火墙维护一个"连接状态表"：                                         │
│    ┌────────┬────────────┬──────────────┬─────────┐                  │
│    │ 协议    │ 内部地址    │ 外部地址      │ 状态     │                  │
│    ├────────┼────────────┼──────────────┼─────────┤                  │
│    │ TCP    │ 10.0.0.5   │ 203.0.1.1   │ ESTAB.  │  ← 内部发起的    │
│    │        │ :54321     │ :443        │         │    双向都放行    │
│    ├────────┼────────────┼──────────────┼─────────┤                  │
│    │ UDP    │ 10.0.0.5   │ 52.176.1.1  │ ASSOC.  │  ← 内部先发的包  │
│    │        │ :60000     │ :3478       │         │    双向都放行    │
│    └────────┴────────────┴──────────────┴─────────┘                  │
│                                                                      │
│  只要连接是内部发起的，后续的入站响应数据也会被放行。                   │
│  这就是为什么你能上网——浏览器发出 HTTP 请求（出站），                  │
│  服务器的 HTTP 响应（入站）也能回来。                                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### TURN 为什么不被拦截？

```
场景：A 在企业防火墙后面，要通过 TURN 和 Azure Avatar 通信

Step 1: A 主动连接 TURN 服务器（出站）
  A (10.0.0.5:60000) ──► TURN (52.176.1.1:3478)

  防火墙看到：内部发起的出站连接 → 放行 ✓
  防火墙记录：{10.0.0.5:60000 ↔ 52.176.1.1:3478, 状态: 活跃}

Step 2: TURN 服务器回复（入站）
  TURN (52.176.1.1:3478) ──► A (10.0.0.5:60000)

  防火墙看到：这是步骤 1 连接的响应，状态表里有记录 → 放行 ✓

Step 3: TURN 持续转发 Azure Avatar 的视频数据（入站）
  TURN (52.176.1.1:3478) ──► A (10.0.0.5:60000)  [H.264 视频帧]
  TURN (52.176.1.1:3478) ──► A (10.0.0.5:60000)  [Opus 音频帧]

  防火墙看到：还是同一个连接（IP:port 对没变），状态表里有 → 放行 ✓

Step 4: A 发送控制包（出站）
  A (10.0.0.5:60000) ──► TURN (52.176.1.1:3478)  [RTCP 反馈/心跳]

  防火墙看到：出站 → 放行 ✓（同时刷新连接状态表的超时计时器）
```

### 为什么直连 P2P 会被拦截，而 TURN 不会？

```
❌ 直连场景（被拦截）：

  Azure Avatar (203.0.1.1:49170) ──► A (10.0.0.5:???)

  防火墙看到：
    - 外部地址 203.0.1.1:49170 发起连接
    - 状态表里没有这个连接的记录
    - 判定为"外部发起的新连接" → 拦截 ✗

  问题核心：A 从来没有主动连过 203.0.1.1:49170
  防火墙不知道这个连接是合法的


✅ TURN 场景（不被拦截）：

  A 先主动连 TURN (52.176.1.1:3478)        ← A 发起的
  然后 TURN 把 Azure 的数据通过同一个连接转发回来  ← 还是同一个连接

  防火墙看到：
    - A 主动连了 52.176.1.1:3478（出站，放行）
    - 后续从 52.176.1.1:3478 回来的数据（状态表有记录，放行）

  防火墙完全不知道数据实际上来自 Azure Avatar
  在防火墙眼里，A 只是在和 TURN 服务器通信
```

### 双工通信是 TCP/UDP 的天生属性

```
一旦连接建立，双向通信就是协议的正常行为：

TCP 连接（如 TURN/TLS 模式）：
  → TCP 本身就是全双工协议
  → 一旦三次握手完成，双方可以同时发数据
  → 防火墙在三次握手时判断"这是内部发起的"→ 后续全部放行
  → 就像你打开 https://google.com ——
    你的请求出去，Google 的 HTML/CSS/JS 回来，全都不被拦截

UDP "连接"（如 TURN/UDP 模式）：
  → UDP 没有真正的"连接"，但防火墙用"关联"（association）来跟踪
  → A 先向 TURN 发 UDP 包 → 防火墙记录 {A:port ↔ TURN:port}
  → 后续 TURN 向 A 发 UDP 包 → 防火墙查到关联记录 → 放行
  → 关联有超时（通常 30-120 秒），所以需要心跳保活
  → 这就是 ICE keep-alive 心跳包存在的原因！

关键理解：
  "出站连接" ≠ "只能出不能进"
  "出站连接" = "由内部先发起，然后双向都能走"
```

### UDP 心跳保活机制（防止防火墙关联过期）

```
┌──────────────────────────────────────────────────────────────┐
│ UDP 关联在防火墙中的生命周期                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  t=0s    A → TURN: 第一个 UDP 包                             │
│          防火墙创建关联: {A:60000 ↔ TURN:3478, 超时=60s}     │
│                                                              │
│  t=1s    TURN → A: 响应数据                                  │
│          防火墙: 关联存在 → 放行 ✓                            │
│                                                              │
│  t=30s   A → TURN: ICE keep-alive (STUN Binding Request)    │
│          防火墙: 刷新超时计时器 → {超时重置为 60s}            │
│                                                              │
│  ... 持续通信，每 15-30 秒一次心跳 ...                        │
│                                                              │
│  如果停止心跳：                                               │
│  t=60s   防火墙: 关联超时 → 删除记录                          │
│  t=61s   TURN → A: 数据包                                    │
│          防火墙: 没有关联记录 → 拦截 ✗                        │
│          → WebRTC 连接断开                                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘

所以 WebRTC 协议栈里内置了 ICE keep-alive 机制：
  - 默认每 15 秒发一个 STUN Binding Request
  - 这个心跳包极小（约 28 字节）
  - 它的唯一目的就是防止防火墙/NAT 的关联过期
```

### 和你浏览网页是同一个原理

```
你每天都在用这个机制，只是没意识到：

浏览 https://google.com：
  你 → Google: TCP SYN（出站，防火墙放行）
  Google → 你: TCP SYN-ACK（入站，防火墙查表放行）
  你 → Google: TCP ACK
  Google → 你: HTML 内容（入站，放行）    ← 几 MB 的数据入站，不被拦截
  Google → 你: CSS/JS/图片（入站，放行）  ← 更多数据入站，不被拦截

  防火墙允许这一切，因为是你先发起的连接。

TURN 中继：
  你 → TURN: UDP/TCP 包（出站，防火墙放行）
  TURN → 你: 中继转发的视频帧（入站，放行）  ← 和 Google 返回 HTML 一样
  TURN → 你: 中继转发的音频帧（入站，放行）  ← 完全相同的机制

  原理完全一样：你先发起 → 防火墙建立记录 → 后续双向都放行
```

### 那为什么 P2P 直连不行？

```
P2P 直连失败的原因不是"双工"，而是"没有先出站建立关联"：

场景：A 在防火墙后，Azure Avatar 要直连 A

Azure (203.0.1.1:49170) ──► A 的防火墙 ──► A (10.0.0.5:???)
                                │
                          防火墙检查：
                          "203.0.1.1:49170 → 10.0.0.5:???
                           这个关联在我的状态表里吗？"
                          "没有。这是外部发起的新连接。"
                          → 拦截 ✗

关键：A 从来没有主动向 203.0.1.1:49170 发过数据包
所以防火墙状态表里没有这个关联，入站数据被拒绝。

TURN 的巧妙之处：
  它让 A 先主动连 TURN（建立关联）
  然后 Azure 的数据通过 TURN 转发（复用已有关联）
  防火墙觉得 A 只是在和 TURN 正常通信
```

### 终极对比

```
┌────────────────┬──────────────────────────┬──────────────────────────┐
│                │ P2P 直连（常被拦截）       │ TURN 中继（几乎不被拦截）  │
├────────────────┼──────────────────────────┼──────────────────────────┤
│ 第一个包的方向  │ Azure → A（入站）          │ A → TURN（出站）          │
│                │ ❌ 防火墙没有关联记录       │ ✅ 防火墙建立关联记录      │
├────────────────┼──────────────────────────┼──────────────────────────┤
│ 后续入站数据    │ 被拦截（无关联）           │ 放行（有关联）             │
├────────────────┼──────────────────────────┼──────────────────────────┤
│ 对端地址       │ Azure 的 IP:port          │ TURN 的 IP:port           │
│                │ （每次都不同，不可预测）    │ （固定且已知）             │
├────────────────┼──────────────────────────┼──────────────────────────┤
│ 防火墙状态表   │ 没有条目                   │ A → TURN 的条目存在        │
├────────────────┼──────────────────────────┼──────────────────────────┤
│ 本质           │ 外部发起的新连接           │ 内部发起连接的后续通信     │
└────────────────┴──────────────────────────┴──────────────────────────┘
```

> **一句话总结**：防火墙不是"只允许出站数据"，而是"只允许由内部发起的连接（及其后续双向通信）"。TURN 的所有连接都由客户端主动发起（出站），一旦连接建立，双向数据流动是 TCP/UDP 协议的正常行为，防火墙不会也不应该拦截。这和你浏览网页、看在线视频的原理完全一样——你发起请求，服务器返回大量数据，全程畅通。

---

## 深度专题 A：文字显示速度与数字人说话速度如何同步？

**问题本质：WebSocket 的文字和 WebRTC 的音视频走的是两条完全独立的通道，没有共同的时钟基准，导致文字"跑"得比数字人嘴巴快。**

### 延迟差距有多大？

```
Azure GPT-4o Realtime 同时生成 text token + audio token
  │
  ├── 文字路径：text token → JSON → WebSocket → 浏览器渲染
  │   总延迟：~50-100ms
  │
  └── 数字人路径：audio token → TTS 合成 → Avatar 渲染引擎（口型+面部+身体）
      → H.264 编码 → WebRTC 传输 → 浏览器解码 → <video> 渲染
      总延迟：~400-1000ms

差距：文字比数字人嘴巴快 ~300-900ms
用户感受：文字已经显示"半衰期是24小时"，数字人嘴巴还在说"半衰期是..."
```

### 方案对比

```
┌──────────────────┬───────────────┬───────────┬───────────────┬──────────────────┐
│ 方案              │ 实现复杂度     │ 用户体验   │ 适用场景       │ 本项目可行性      │
├──────────────────┼───────────────┼───────────┼───────────────┼──────────────────┤
│ 1. 延迟文字显示   │ ★☆☆           │ ★★★       │ 数字人模式     │ ✅ 推荐           │
│ 2. 打字机效果     │ ★★☆           │ ★★★       │ 所有模式       │ ✅ 推荐           │
│ 3. 音频时间戳对齐 │ ★★★★          │ ★★★★      │ 专业字幕场景   │ ⚠️ 过度设计       │
│ 4. 隐藏文字       │ ★☆☆           │ ★★☆       │ 简单场景       │ ❌ 损失功能       │
│ 5. 双缓冲+标记   │ ★★★           │ ★★★★      │ 高质量场景     │ ✅ 进阶方案       │
└──────────────────┴───────────────┴───────────┴───────────────┴──────────────────┘
```

### 方案 1：延迟文字显示（最简单有效）

核心思路：文字到了先不显示，等一个固定延迟后再渲染，让它和音频"对齐"。

```typescript
// voice-transcript.tsx 中的改动

// 收到 transcript.delta 时，不立即渲染，而是放入延迟队列
const AVATAR_PIPELINE_DELAY = 500; // ms，需要根据实测调整

function onTranscriptDelta(text: string, isAvatarMode: boolean) {
  if (isAvatarMode) {
    // 数字人模式：延迟显示
    setTimeout(() => {
      appendToTranscript(text);
    }, AVATAR_PIPELINE_DELAY);
  } else {
    // 纯语音模式：立即显示（WebSocket 音频和文字延迟差距小）
    appendToTranscript(text);
  }
}
```

```
优点：
  ✅ 实现极简（3 行代码）
  ✅ 效果明显（文字不会大幅领先音频）

缺点：
  ❌ 固定延迟是猜测值，不一定精确
  ❌ 网络波动时可能又不同步
  ❌ 纯语音模式和数字人模式需要不同的延迟值
```

### 方案 2：打字机效果（推荐 + 方案 1 组合使用）

核心思路：文字不是瞬间出现，而是一个字一个字地"打"出来，模拟说话速度。

```typescript
// useTypewriterEffect hook

function useTypewriterEffect(text: string, isAvatarMode: boolean) {
  const [displayed, setDisplayed] = useState("");
  const [queue, setQueue] = useState<string[]>([]);

  // 文字到达时追加到队列
  useEffect(() => {
    if (text) {
      setQueue(prev => [...prev, ...text.split("")]);
    }
  }, [text]);

  // 按速度从队列中取出字符显示
  useEffect(() => {
    if (queue.length === 0) return;

    // 中文 ~4 字/秒（正常语速），英文 ~12 字/秒
    // 数字人模式放慢，纯语音模式加快
    const charDelay = isAvatarMode ? 250 : 80; // ms per character

    const timer = setInterval(() => {
      setQueue(prev => {
        if (prev.length === 0) {
          clearInterval(timer);
          return prev;
        }
        const [next, ...rest] = prev;
        setDisplayed(d => d + next);
        return rest;
      });
    }, charDelay);

    return () => clearInterval(timer);
  }, [queue.length > 0]);

  return displayed;
}
```

```
效果：
  文字一个字一个字出现，视觉上和数字人说话节奏接近
  用户不会感到文字"跑"得太快

优点：
  ✅ 视觉上自然，像"实时字幕"的感觉
  ✅ 不需要知道确切的音频延迟
  ✅ 纯语音模式也能用（调快速度即可）

缺点：
  ❌ 字符速度是估算的，和实际语速不一定精确匹配
  ❌ 如果 AI 一次返回大段文字，队列会堆积
```

### 方案 3：基于音频时间戳的精确对齐（专业方案）

核心思路：利用 WebRTC 的 RTP 时间戳和 WebSocket 的 transcript 事件建立时间映射。

```
原理：
  Azure 在返回 transcript.delta 时，同时返回了对应的文字内容
  Azure 在 WebRTC 音频流中，RTP 包带有时间戳

  如果能建立映射：transcript 第 N 个字 ↔ RTP 时间戳 T
  就能精确地在音频播到时间 T 时，显示第 N 个字

问题：
  Azure Voice Live API 的 transcript.delta 事件目前不包含
  精确的音频时间戳信息（只有文字内容和 response_id）

  要实现精确对齐，需要：
  1. Azure API 返回 word-level timing（目前不支持）
  2. 或者自己做前端 VAD + 音频分析来估算对齐点

  这在当前 API 下是过度设计。
```

### 方案 5：双缓冲 + 音频状态标记（进阶方案）

核心思路：监听 WebRTC 音频轨道的播放状态，根据"数字人是否正在说话"来控制文字释放。

```typescript
// 进阶同步方案：基于音频活动检测

function useSyncedTranscript(audioRef: RefObject<HTMLAudioElement>) {
  const pendingText = useRef<string[]>([]);
  const [visibleText, setVisibleText] = useState("");

  // 监听数字人音频的播放状态
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // 方法 A：用 AudioContext 分析音量
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    source.connect(analyser);
    analyser.connect(ctx.destination);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function checkAudioLevel() {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;

      if (avg > 10) {
        // 数字人正在说话 → 释放待显示文字
        if (pendingText.current.length > 0) {
          const chunk = pendingText.current.shift()!;
          setVisibleText(prev => prev + chunk);
        }
      }
      // 数字人没说话 → 暂停释放（等音频跟上）

      requestAnimationFrame(checkAudioLevel);
    }

    checkAudioLevel();
    return () => ctx.close();
  }, []);

  // 文字到达时放入 pending 缓冲
  const addText = useCallback((text: string) => {
    pendingText.current.push(text);
  }, []);

  return { visibleText, addText };
}
```

```
优点：
  ✅ 真正基于音频状态同步，不是猜测延迟
  ✅ 自适应网络波动（音频快就文字快，音频慢就文字慢）

缺点：
  ❌ 实现复杂，需要 AudioContext 分析
  ❌ createMediaElementSource 有跨域限制
  ❌ 分析音量不等于分析"说了什么字"，粒度较粗
```

### 推荐组合

```
本项目推荐：方案 1 + 方案 2 的组合

数字人模式：
  1. 收到 transcript.delta → 先延迟 400ms（方案 1）
  2. 延迟后以打字机效果逐字显示（方案 2，~4 字/秒）
  3. 如果 transcript.done 到达时打字机队列还没打完 → 立即显示剩余

纯语音模式：
  1. 无延迟
  2. 打字机效果加速（~12 字/秒）或直接显示

这个组合只需要约 30 行代码，就能让文字显示和数字人说话在感官上"基本同步"。
不追求帧级精确，而是追求用户感知的一致性——这对 MR 培训场景完全够用。
```

### 为什么不追求完美同步？

```
1. 用户期望管理：
   人类观看"带字幕的视频"时，对字幕提前 0.5 秒是高度宽容的
   （电影字幕经常比对白提前 0.3-0.5 秒，观众完全不觉得不自然）

2. 注意力分配：
   MR 培训时，用户要么看数字人脸（80% 时间），要么看文字（20% 时间）
   极少同时盯着两者比较同步性

3. 投入产出比：
   精确同步需要：word-level timing API + AudioContext 分析 + 复杂状态机
   投入：几天开发 + 长期维护
   收益：从"基本同步"到"完美同步"，用户几乎感知不到差异

4. Azure API 限制：
   当前 Voice Live API 不返回 word-level timing
   没有 API 支持的情况下，前端再怎么努力也只是近似值
```

---

## 深度专题 B：100 个 MR 同时训练，后端 FastAPI 撑得住吗？

**答案：撑得住。WebSocket 代理是典型的 I/O-bound 场景，Python async 恰好是为这种场景设计的。但瓶颈不在 CPU 或协程数量，而在内存管理和 Azure API 配额。**

### 先分析工作负载的性质

```
每个 MR 训练会话，后端做的事情：

  1. 维护一条 WebSocket 连接（浏览器 → 后端）
  2. 维护一条 Azure SDK 连接（后端 → Azure Voice Live）
  3. 转发 JSON 消息（文字、控制指令）
  4. 转发 base64 编码的音频数据

逐项分析：

┌──────────────────┬──────────────┬───────────────┬───────────────────────┐
│ 操作              │ I/O or CPU？  │ 单次开销       │ 100 并发总开销         │
├──────────────────┼──────────────┼───────────────┼───────────────────────┤
│ WebSocket 连接    │ I/O (网络)   │ ~10KB 内存     │ ~1MB                  │
│ 维持             │              │ 0 CPU（等待中）│ 0 CPU                 │
├──────────────────┼──────────────┼───────────────┼───────────────────────┤
│ Azure SDK 连接   │ I/O (网络)   │ ~50KB 内存     │ ~5MB                  │
│ 维持             │              │ 0 CPU（等待中）│ 0 CPU                 │
├──────────────────┼──────────────┼───────────────┼───────────────────────┤
│ JSON 消息转发     │ I/O 为主     │ ~1KB/消息      │ 100条/秒 → ~100KB/s  │
│ （文字、控制）    │ 极少 CPU     │ JSON 解析极快  │ CPU 忽略不计          │
├──────────────────┼──────────────┼───────────────┼───────────────────────┤
│ 音频数据转发      │ I/O 为主     │ ~16KB/帧       │ 100×50帧/秒           │
│ (base64 PCM16)  │ 少量 CPU     │ 每秒50帧×16KB  │ = ~80MB/s 网络吞吐    │
│                  │ (base64解编码)│ = ~800KB/s/人  │ CPU: base64 编解码    │
├──────────────────┼──────────────┼───────────────┼───────────────────────┤
│ 音频缓冲区       │ 内存          │ ~512KB/人      │ ~50MB                 │
│ (AudioWorklet   │              │ (环形缓冲)     │                       │
│  的数据暂存)     │              │               │                       │
└──────────────────┴──────────────┴───────────────┴───────────────────────┘

总计（100 并发）：
  内存：~60MB（WebSocket + SDK + 缓冲区）→ 远低于典型服务器 4-16GB
  CPU：极低（几乎都在等 I/O）
  网络：~80MB/s 出站（主要是音频转发）→ 这才是真正的瓶颈
```

### 为什么 Python async 适合这个场景？

```
Python asyncio 的核心能力：
  一个线程上跑数千个协程
  每个协程在等 I/O 时自动让出 CPU
  I/O 完成时自动恢复执行

WebSocket 代理的典型循环：

async def proxy_session(browser_ws, azure_sdk):
    async for message in browser_ws:        # ← 等用户发消息（I/O 等待）
        await azure_sdk.send(message)       # ← 转发给 Azure（I/O 等待）

    async for event in azure_sdk:           # ← 等 Azure 返回（I/O 等待）
        await browser_ws.send(event)        # ← 转发给浏览器（I/O 等待）

每一行 await 都是 I/O 等待 → 自动让出 CPU → 其他协程继续执行
100 个会话 = 200 个协程 = 全部在同一个线程上交替执行
99% 的时间都在等 I/O，CPU 几乎空闲
```

### 真正的瓶颈在哪里？

```
瓶颈 1：网络带宽（最可能的瓶颈）
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  每个用户的音频数据：                                            │
│    上行（用户→后端→Azure）：PCM16 24kHz mono = ~48KB/s          │
│    下行（Azure→后端→用户）：PCM16 24kHz mono = ~48KB/s          │
│                           + JSON 消息 ≈ ~5KB/s                 │
│    单用户合计：~100KB/s 双向                                    │
│                                                                │
│  100 用户并发：                                                 │
│    后端总带宽：~10MB/s = ~80Mbps                                │
│    → Azure Container App 默认出站带宽：通常 100-200Mbps          │
│    → 刚好够用，但没有太多余量                                    │
│                                                                │
│  ⚠️ 如果要支持 500+ 并发 → 需要水平扩展（多实例）                │
│                                                                │
└────────────────────────────────────────────────────────────────┘

瓶颈 2：Azure Voice Live API 配额
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  Azure 对 Voice Live API 有并发限制：                            │
│    - 每个 endpoint 的并发 session 数有上限（查 Azure 文档）       │
│    - 每分钟请求数（RPM）限制                                     │
│    - 每个 subscription 的 TPS 限制                               │
│                                                                │
│  100 个并发 session 可能触发：                                   │
│    - 并发连接上限（需要申请 quota 提升）                          │
│    - Token 用量上限（GPT-4o Realtime 的 token 计费很高）         │
│                                                                │
│  ✅ 解决方案：                                                   │
│    - 提前联系 Azure 申请 quota 提升                               │
│    - 多个 AI Foundry project 做负载分散                          │
│    - 会话结束后及时释放 SDK 连接                                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘

瓶颈 3：内存管理（容易被忽视）
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  每个会话需要缓冲音频数据：                                       │
│    - 用户音频上行缓冲：~64KB（AudioWorklet 到 WebSocket 的暂存） │
│    - Azure 响应缓冲：~256KB（SDK 事件队列）                      │
│    - transcript 历史：~10-50KB（整个对话的文字记录）              │
│                                                                │
│  100 并发 × ~400KB/会话 = ~40MB → 完全没问题                    │
│                                                                │
│  ⚠️ 但要注意内存泄漏：                                           │
│    - 会话异常断开后，SDK 连接没有正确关闭                         │
│    - 音频缓冲没有释放                                            │
│    - 事件队列持续增长（消费者断了但生产者还在推）                  │
│                                                                │
│  ✅ 解决方案：                                                   │
│    - try/finally 确保 SDK 连接在任何退出路径都关闭                │
│    - 设置 per-session 超时（如 30 分钟自动断开）                  │
│    - 定期记录内存使用情况（process.memory_info()）                │
│                                                                │
└────────────────────────────────────────────────────────────────┘

瓶颈 4：base64 编解码的 CPU 开销（通常不是问题）
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  音频数据以 base64 编码在 JSON 中传输                            │
│  每帧需要 base64 decode → 转发 → 可能再 base64 encode           │
│                                                                │
│  Python 的 base64 模块是 C 实现的，性能很好：                     │
│    base64.b64decode(16KB) ≈ 2-5 微秒                           │
│    100 用户 × 50 帧/秒 × 5 微秒 = 25 毫秒/秒 CPU 时间          │
│    → 占单核 CPU 的 2.5% → 完全不是问题                          │
│                                                                │
│  ⚠️ 但如果你做了不必要的操作（如解析/修改音频内容再重新编码），    │
│     CPU 开销会增加。原则：音频数据能原样转发就原样转发。           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 扩容策略

```
┌────────────────┬─────────────┬─────────────────────────────────────┐
│ 并发规模        │ 架构         │ 关键措施                              │
├────────────────┼─────────────┼─────────────────────────────────────┤
│ 1-50 用户      │ 单实例       │ 单个 uvicorn worker 就够               │
│                │             │ 4 workers 有充足余量                   │
├────────────────┼─────────────┼─────────────────────────────────────┤
│ 50-200 用户    │ 单实例       │ uvicorn 4 workers                    │
│                │ 多 worker   │ 申请 Azure API quota 提升              │
│                │             │ 监控内存和网络带宽                      │
├────────────────┼─────────────┼─────────────────────────────────────┤
│ 200-1000 用户  │ 水平扩展     │ 多个 Container App 实例               │
│                │             │ WebSocket 需要 sticky session          │
│                │             │ （同一用户的 WS 始终连到同一实例）       │
│                │             │ Azure Front Door / Application Gateway │
│                │             │ 多个 AI Foundry project 分散 quota      │
├────────────────┼─────────────┼─────────────────────────────────────┤
│ 1000+ 用户     │ 微服务       │ WebSocket 代理独立服务（可独立扩缩容）  │
│                │             │ 业务 API 独立服务                       │
│                │             │ Redis pub/sub 做跨实例事件分发          │
│                │             │ 考虑 Go/Rust 重写 WebSocket 代理层      │
└────────────────┴─────────────┴─────────────────────────────────────┘
```

### WebSocket 的 sticky session 问题

```
WebSocket 连接是有状态的，一旦建立就绑定到特定的后端实例。
如果你用负载均衡器分配请求，需要确保：

  用户 A 的 WebSocket 建立时连到了 实例 1
  → 后续所有 WebSocket 消息都必须路由到 实例 1
  → 这叫 "sticky session" 或 "session affinity"

  如果负载均衡器把某条消息路由到 实例 2
  → 实例 2 上没有这个 WebSocket 连接 → 消息丢失

解决方案：
  1. Azure Container Apps 支持基于 cookie 的 session affinity
  2. 或者前端 WebSocket URL 中直接包含实例标识
  3. 或者用 Redis pub/sub 让所有实例共享消息
     （但这增加了复杂度，100 并发不需要）
```

### 实测基准参考

```
单个 uvicorn worker（Python 3.11 + FastAPI）的 WebSocket 并发能力：

  轻量消息（纯 JSON 转发）：
    → 可承载 3000-5000 并发 WebSocket 连接
    → 瓶颈在事件循环的文件描述符上限（ulimit）

  重载消息（含 base64 音频转发）：
    → 可承载 500-1000 并发 WebSocket 连接
    → 瓶颈在网络 I/O 和 base64 处理

  4 个 uvicorn workers：
    → 能力 ×4（每个 worker 是独立进程，独立事件循环）
    → 2000-4000 并发 WebSocket 连接

  结论：100 个 MR 并发，单实例 + 4 workers 绰绰有余。
  甚至用 1 个 worker 也大概率够用。
```

### 关键代码模式：确保资源正确释放

```python
# backend/app/api/voice_live.py — WebSocket 代理的健壮实现

@router.websocket("/ws")
async def voice_live_ws(ws: WebSocket, token: str = Query(...)):
    user = await verify_token(token)
    await ws.accept()

    azure_client = None
    try:
        # 连接 Azure Voice Live SDK
        azure_client = await connect_voice_live(
            endpoint=settings.ai_foundry_endpoint,
            credential=AzureKeyCredential(settings.ai_foundry_key),
        )

        # 双向转发（两个并发任务）
        async with asyncio.TaskGroup() as tg:
            tg.create_task(forward_browser_to_azure(ws, azure_client))
            tg.create_task(forward_azure_to_browser(azure_client, ws))

    except WebSocketDisconnect:
        logger.info("User %s disconnected normally", user.id)
    except Exception as e:
        logger.error("Session error for user %s: %s", user.id, e)
    finally:
        # ⚠️ 关键：无论怎么退出都要清理！
        if azure_client:
            await azure_client.close()       # 关闭 Azure SDK 连接
        try:
            await ws.close()                 # 关闭浏览器 WebSocket
        except Exception:
            pass                             # 可能已经关闭了
        logger.info("Session cleaned up for user %s", user.id)
```

> **总结**：100 并发 MR 训练对 Python async + FastAPI 来说完全不是问题。这是经典的 I/O-bound 工作负载，Python asyncio 恰好为此设计。单实例 4 workers 可以轻松处理。真正的瓶颈在 Azure API 配额和网络带宽上。需要关注的工程问题是资源泄漏（确保每个会话退出时正确关闭所有连接）和内存监控。500+ 并发时才需要考虑水平扩展和 sticky session。

---

## 深度专题 C：生产环境远程诊断"数字人不出来"

**问题场景：用户在生产环境报告"我能看到文字，但数字人没有画面"。你不在现场，怎么远程诊断？**

### 第一原则：这个问题 = "WebSocket 正常，WebRTC 断开"

回顾疑问 3 的结论：

```
✅ 文字正常 = WebSocket 通道正常
❌ 没有视频 = WebRTC 通道未建立或已断开
❌ 没有音频 = WebRTC Audio Track 未连接（数字人模式下音频走 WebRTC）
```

所以排查方向明确：**WebRTC 建立过程中的哪一步失败了？**

### 需要在哪些地方埋日志？

```
┌──────────────────────────────────────────────────────────────────────┐
│ 完整的日志埋点矩阵（按 WebRTC 建立流程排列）                           │
├────────┬───────────────────────────────┬──────────┬─────────────────┤
│ 阶段    │ 日志内容                       │ 位置      │ 级别             │
├────────┼───────────────────────────────┼──────────┼─────────────────┤
│ 1      │ session.updated 收到，         │ 前端      │ INFO            │
│        │ 是否包含 ice_servers？         │          │                 │
│        │ ice_servers 数量和类型         │          │                 │
├────────┼───────────────────────────────┼──────────┼─────────────────┤
│ 2      │ RTCPeerConnection 创建成功？   │ 前端      │ INFO            │
│        │ iceServers 配置内容            │          │                 │
├────────┼───────────────────────────────┼──────────┼─────────────────┤
│ 3      │ ICE gathering 开始            │ 前端      │ DEBUG           │
│        │ 每个 candidate 的 type+proto  │          │                 │
│        │ gathering 耗时                │          │                 │
│        │ 是否超时（>8s）               │          │                 │
├────────┼───────────────────────────────┼──────────┼─────────────────┤
│ 4      │ SDP Offer 已生成              │ 前端      │ INFO            │
│        │ SDP 中的 candidate 数量       │          │                 │
│        │ SDP 中包含哪些 candidate 类型 │          │                 │
├────────┼───────────────────────────────┼──────────┼─────────────────┤
│ 5      │ session.avatar.connect 已发送 │ 前端+后端 │ INFO            │
│        │ 后端是否成功转发给 Azure SDK  │ 后端      │ INFO            │
├────────┼───────────────────────────────┼──────────┼─────────────────┤
│ 6      │ server_sdp 是否收到？         │ 前端      │ INFO            │
│        │ 收到耗时（从发送到收到）       │          │                 │
│        │ 超时（>15s）则报 WARN        │          │                 │
├────────┼───────────────────────────────┼──────────┼─────────────────┤
│ 7      │ setRemoteDescription 成功？   │ 前端      │ INFO/ERROR      │
│        │ 如果失败，记录错误信息         │          │                 │
├────────┼───────────────────────────────┼──────────┼─────────────────┤
│ 8      │ iceConnectionState 变化       │ 前端      │ INFO            │
│        │ new→checking→connected/failed │          │                 │
│        │ 如果卡在 checking >10s → WARN │          │                 │
├────────┼───────────────────────────────┼──────────┼─────────────────┤
│ 9      │ ontrack 是否触发？            │ 前端      │ INFO            │
│        │ 收到几个 track？什么 kind？   │          │                 │
│        │ video/audio 是否都到了？      │          │                 │
├────────┼───────────────────────────────┼──────────┼─────────────────┤
│ 10     │ <video>.play() 是否成功？     │ 前端      │ INFO/ERROR      │
│        │ 如果 play() 抛异常，记录原因  │          │                 │
│        │ （常见：autoplay policy）     │          │                 │
└────────┴───────────────────────────────┴──────────┴─────────────────┘
```

### 前端日志实现

```typescript
// use-avatar-stream.ts — 增强日志版本

function useAvatarStream() {
  const connect = async (iceServers: RTCIceServer[], sendSdp: Function) => {
    // ========== 阶段 1: 检查 ICE servers ==========
    console.info("[Avatar] ICE servers received:", {
      count: iceServers.length,
      types: iceServers.map(s => {
        const url = Array.isArray(s.urls) ? s.urls[0] : s.urls;
        return url?.startsWith("turn:") ? "TURN" : "STUN";
      }),
      hasCredentials: iceServers.some(s => s.username && s.credential),
    });

    if (iceServers.length === 0) {
      console.error("[Avatar] ❌ No ICE servers! Avatar 功能可能未启用");
      reportToBackend("avatar_no_ice_servers", { sessionId });
      return;
    }

    // ========== 阶段 2: 创建 PeerConnection ==========
    const pc = new RTCPeerConnection({
      iceServers,
      bundlePolicy: "max-bundle",
    });
    console.info("[Avatar] PeerConnection created");

    // ========== 阶段 3: 监听 ICE 状态变化 ==========
    const iceStartTime = Date.now();
    let candidateCount = { host: 0, srflx: 0, relay: 0 };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const type = e.candidate.type as keyof typeof candidateCount;
        candidateCount[type] = (candidateCount[type] || 0) + 1;
        console.debug("[Avatar] ICE candidate: %s %s",
          e.candidate.type, e.candidate.protocol);
      } else {
        const elapsed = Date.now() - iceStartTime;
        console.info("[Avatar] ICE gathering complete in %dms:", elapsed, candidateCount);

        // ⚠️ 如果没有 relay candidate，企业网可能连不上
        if (candidateCount.relay === 0) {
          console.warn("[Avatar] ⚠️ No relay candidates! 企业防火墙后可能连不上");
          reportToBackend("avatar_no_relay_candidates", { candidateCount, elapsed });
        }
      }
    };

    // ========== 阶段 8: ICE 连接状态跟踪 ==========
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      const elapsed = Date.now() - iceStartTime;
      console.info("[Avatar] ICE state: %s (%dms)", state, elapsed);

      if (state === "failed") {
        console.error("[Avatar] ❌ ICE connection FAILED — WebRTC 无法建立");
        reportToBackend("avatar_ice_failed", {
          elapsed,
          candidateCount,
          // 收集最终的连接统计
          stats: await getConnectionStats(pc),
        });
      }

      if (state === "connected") {
        console.info("[Avatar] ✅ ICE connected! WebRTC 通道已建立");
        reportToBackend("avatar_connected", { elapsed, candidateCount });
      }
    };

    // ========== 阶段 9: Track 接收 ==========
    const tracksReceived = { video: false, audio: false };
    pc.ontrack = (event) => {
      tracksReceived[event.track.kind as "video" | "audio"] = true;
      console.info("[Avatar] Track received: %s (id=%s)",
        event.track.kind, event.track.id);

      // 监听 track 结束/静音
      event.track.onended = () => {
        console.warn("[Avatar] ⚠️ Track ended: %s", event.track.kind);
        reportToBackend("avatar_track_ended", { kind: event.track.kind });
      };
      event.track.onmute = () => {
        console.warn("[Avatar] ⚠️ Track muted: %s", event.track.kind);
      };
      event.track.onunmute = () => {
        console.info("[Avatar] Track unmuted: %s", event.track.kind);
      };

      if (event.track.kind === "video" && videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.play()
          .then(() => console.info("[Avatar] ✅ Video playing"))
          .catch((err) => {
            // ========== 阶段 10: play() 失败诊断 ==========
            console.error("[Avatar] ❌ Video play() failed:", err.name, err.message);
            reportToBackend("avatar_play_failed", {
              error: err.name,
              message: err.message,
              // 常见原因：
              // NotAllowedError → autoplay policy（用户没交互过页面）
              // AbortError → srcObject 在 play 前被清空
              // NotSupportedError → 编码不支持
            });
          });
      }
    };

    // ... SDP 交换等后续代码 ...
  };
}

// 上报到后端的通用函数
async function reportToBackend(event: string, data: Record<string, unknown>) {
  try {
    await fetch("/api/v1/diagnostics/avatar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        ...data,
      }),
    });
  } catch {
    // 诊断上报失败不应影响主流程
  }
}
```

### 后端诊断日志

```python
# backend/app/api/voice_live.py — 后端关键埋点

@router.websocket("/ws")
async def voice_live_ws(ws: WebSocket, token: str = Query(...)):
    session_id = str(uuid4())
    user = await verify_token(token)

    logger.info("[VL:%s] Session start, user=%s", session_id, user.id)

    try:
        azure_client = await connect_voice_live(...)
        logger.info("[VL:%s] Azure SDK connected", session_id)

        async for event in azure_client:
            event_type = event.get("type", "unknown")

            # 关键事件记录
            if event_type == "session.updated":
                ice_servers = event.get("session", {}).get("avatar", {}).get("ice_servers", [])
                logger.info("[VL:%s] session.updated, ice_servers=%d",
                    session_id, len(ice_servers))

                if len(ice_servers) == 0:
                    logger.error("[VL:%s] ❌ No ice_servers in session.updated! "
                        "Avatar 可能未正确配置", session_id)

            elif event_type == "error":
                logger.error("[VL:%s] Azure error: %s", session_id, event)

            # 转发给浏览器
            await ws.send_json(event)

    except WebSocketDisconnect:
        logger.info("[VL:%s] Browser disconnected (normal)", session_id)
    except Exception as e:
        logger.error("[VL:%s] Unexpected error: %s", session_id, e, exc_info=True)
    finally:
        logger.info("[VL:%s] Session end, duration=%s", session_id, elapsed)
```

### WebRTC getStats() API：远程诊断的"X光机"

**`pc.getStats()` 是 WebRTC 最强大的诊断工具，返回连接的完整运行时统计信息。**

```typescript
// 获取 WebRTC 连接统计信息
async function getConnectionStats(pc: RTCPeerConnection) {
  const stats = await pc.getStats();
  const report: Record<string, unknown> = {};

  stats.forEach((stat) => {
    switch (stat.type) {
      // ========== 1. 候选对（看选了哪条路径） ==========
      case "candidate-pair":
        if (stat.state === "succeeded" || stat.nominated) {
          report.activePair = {
            state: stat.state,
            localCandidateId: stat.localCandidateId,
            remoteCandidateId: stat.remoteCandidateId,
            // 关键指标
            currentRoundTripTime: stat.currentRoundTripTime,  // RTT（秒）
            availableOutgoingBitrate: stat.availableOutgoingBitrate,
            bytesReceived: stat.bytesReceived,
            bytesSent: stat.bytesSent,
          };
        }
        break;

      // ========== 2. 本地候选（看自己的网络出口） ==========
      case "local-candidate":
        if (!report.localCandidates) report.localCandidates = [];
        (report.localCandidates as unknown[]).push({
          type: stat.candidateType,    // "host" / "srflx" / "relay"
          protocol: stat.protocol,     // "udp" / "tcp"
          address: stat.address,       // IP 地址
          port: stat.port,
          relayProtocol: stat.relayProtocol,  // 如果是 relay，用的 udp/tcp/tls
        });
        break;

      // ========== 3. 远端候选（看 Azure 的地址） ==========
      case "remote-candidate":
        if (!report.remoteCandidates) report.remoteCandidates = [];
        (report.remoteCandidates as unknown[]).push({
          type: stat.candidateType,
          protocol: stat.protocol,
          address: stat.address,
          port: stat.port,
        });
        break;

      // ========== 4. 入站视频流（核心诊断数据） ==========
      case "inbound-rtp":
        if (stat.kind === "video") {
          report.videoInbound = {
            framesReceived: stat.framesReceived,     // 收到多少帧
            framesDecoded: stat.framesDecoded,       // 解码了多少帧
            framesDropped: stat.framesDropped,       // 丢弃了多少帧
            frameWidth: stat.frameWidth,             // 视频宽度
            frameHeight: stat.frameHeight,           // 视频高度
            framesPerSecond: stat.framesPerSecond,   // 实时帧率
            bytesReceived: stat.bytesReceived,       // 总接收字节
            packetsReceived: stat.packetsReceived,   // 总接收包数
            packetsLost: stat.packetsLost,           // 丢包数
            jitter: stat.jitter,                     // 抖动（秒）
            // 丢包率计算
            packetLossRate: stat.packetsLost /
              (stat.packetsReceived + stat.packetsLost) * 100,
          };
        }
        if (stat.kind === "audio") {
          report.audioInbound = {
            packetsReceived: stat.packetsReceived,
            packetsLost: stat.packetsLost,
            jitter: stat.jitter,
            bytesReceived: stat.bytesReceived,
          };
        }
        break;

      // ========== 5. 传输层（DTLS 状态） ==========
      case "transport":
        report.transport = {
          dtlsState: stat.dtlsState,          // "connected" = 加密通道正常
          iceState: stat.iceState,             // "connected" = ICE 正常
          selectedCandidatePairChanges: stat.selectedCandidatePairChanges,
          bytesReceived: stat.bytesReceived,
          bytesSent: stat.bytesSent,
        };
        break;
    }
  });

  return report;
}
```

### getStats() 能告诉你什么？

```
┌─────────────────────┬────────────────────────────────────────────────┐
│ 指标                 │ 诊断意义                                        │
├─────────────────────┼────────────────────────────────────────────────┤
│ activePair.          │ < 100ms = 优秀（可能是直连）                    │
│ currentRoundTripTime│ 100-300ms = 正常（可能走了 TURN）               │
│                     │ > 500ms = 网络质量差，可能导致口型不同步          │
├─────────────────────┼────────────────────────────────────────────────┤
│ localCandidate.type │ "host" = 直连（最快）                           │
│                     │ "srflx" = STUN 穿透成功                         │
│                     │ "relay" = 走了 TURN 中继                        │
│                     │ → 如果是 relay，检查 relayProtocol               │
│                     │   "udp" = TURN/UDP（性能好）                    │
│                     │   "tcp" = TURN/TCP（UDP 被封了）                │
│                     │   "tls" = TURN/TLS（最后手段）                  │
├─────────────────────┼────────────────────────────────────────────────┤
│ videoInbound.        │ 25-30 = 正常                                   │
│ framesPerSecond     │ 10-20 = 网络波动，体验下降                      │
│                     │ < 5 = 严重问题                                  │
│                     │ 0 = 完全没收到视频帧                             │
├─────────────────────┼────────────────────────────────────────────────┤
│ videoInbound.        │ < 1% = 优秀                                    │
│ packetLossRate      │ 1-5% = 可接受，WebRTC 可以补偿                  │
│                     │ > 5% = 画面会卡顿                               │
│                     │ > 15% = 画面基本不可用                           │
├─────────────────────┼────────────────────────────────────────────────┤
│ videoInbound.        │ framesReceived > 0 但 framesDecoded = 0        │
│ framesDropped       │ → 解码失败（编码格式不支持？硬件加速异常？）      │
│                     │ framesDropped 持续增长                           │
│                     │ → 设备性能不足，来不及解码                       │
├─────────────────────┼────────────────────────────────────────────────┤
│ transport.dtlsState │ "connected" = 正常                              │
│                     │ "failed" = DTLS 握手失败（指纹不匹配？）         │
│                     │ "closed" = 连接已关闭                            │
├─────────────────────┼────────────────────────────────────────────────┤
│ bytesReceived       │ 持续增长 = 数据在流动                            │
│ (transport 级别)    │ 停止增长 = 连接可能已断                          │
│                     │ 始终为 0 = 从未连通过                            │
└─────────────────────┴────────────────────────────────────────────────┘
```

### 定期采集 + 上报机制

```typescript
// 每 10 秒采集一次 WebRTC 统计，上报到后端
function startStatsReporting(pc: RTCPeerConnection, sessionId: string) {
  const interval = setInterval(async () => {
    if (pc.connectionState === "closed") {
      clearInterval(interval);
      return;
    }

    const stats = await getConnectionStats(pc);

    // 本地打印（用户打开 F12 时能看到）
    console.debug("[Avatar Stats]", stats);

    // 异常检测 + 上报
    const video = stats.videoInbound as any;
    if (video) {
      if (video.framesPerSecond === 0 && video.framesReceived > 0) {
        console.warn("[Avatar] ⚠️ Video stalled: receiving packets but 0 fps");
        reportToBackend("avatar_video_stalled", stats);
      }
      if (video.packetLossRate > 10) {
        console.warn("[Avatar] ⚠️ High packet loss: %.1f%%", video.packetLossRate);
        reportToBackend("avatar_high_packet_loss", stats);
      }
    }

    // 定期上报（采样率降低，避免打爆后端）
    // 每分钟上报一次完整统计
    if (Date.now() % 60000 < 10000) {
      reportToBackend("avatar_periodic_stats", stats);
    }
  }, 10_000);

  return () => clearInterval(interval);
}
```

### 完整的远程诊断流程

```
用户报告"数字人不出来"
  │
  ▼
Step 1: 检查后端日志
  │ 搜索该用户 session_id 的日志
  │
  ├── session.updated 中没有 ice_servers？
  │   → Azure Avatar 功能未启用，或模型不支持 avatar
  │   → 检查 Azure AI Foundry 中的 modalities 配置
  │
  ├── session.updated 正常？
  │   → 继续看前端日志
  │
  ▼
Step 2: 检查前端诊断上报（/api/v1/diagnostics/avatar）
  │
  ├── avatar_no_ice_servers？
  │   → 同上，Azure 配置问题
  │
  ├── avatar_no_relay_candidates？
  │   → ICE gathering 没收集到 relay candidate
  │   → TURN 服务器不可达（凭据过期？DNS 解析失败？）
  │
  ├── avatar_ice_failed？
  │   → ICE 连通性检测全部失败
  │   → 企业防火墙可能封了 UDP 和非标准端口
  │   → 检查 stats 中的 candidateCount：
  │     如果只有 host，没有 srflx 和 relay → STUN/TURN 都不可达
  │     如果有 relay 但 ICE 仍 failed → TURN 中继也不通（极端网络环境）
  │
  ├── avatar_play_failed + NotAllowedError？
  │   → 浏览器 autoplay policy 阻止了视频播放
  │   → 用户需要先和页面交互（点击按钮）才能播放
  │   → 解决：在"开始对话"按钮的 click 事件中触发 WebRTC 连接
  │
  ├── avatar_connected 但没有 avatar_video_stalled？
  │   → WebRTC 连接成功但没有收到视频帧
  │   → 可能是 Azure Avatar 渲染服务内部问题
  │
  ├── avatar_periodic_stats 显示 framesReceived > 0 但 framesPerSecond = 0？
  │   → 收到了数据但解码失败
  │   → 可能是浏览器不支持该编码格式（极少见）
  │   → 检查用户的浏览器版本
  │
  ▼
Step 3: 如果上述都正常，请用户提供 chrome://webrtc-internals
  │
  └── 这是 Chrome 内置的 WebRTC 详细诊断页面
      用户在浏览器地址栏输入 chrome://webrtc-internals
      → 截图发给你
      → 包含所有 ICE candidate、SDP 原文、连接状态时间线
      → 这是终极诊断工具
```

### chrome://webrtc-internals 能看到什么？

```
这个页面（Chrome 内置，不需要安装任何东西）显示：

1. 所有 RTCPeerConnection 实例
   → 确认 PC 是否被创建了

2. 完整的 SDP Offer 和 Answer 原文
   → 检查有没有 candidate 行
   → 检查编码格式是否正确（H.264/Opus）
   → 检查 fingerprint 是否存在

3. ICE candidate 收集过程
   → 每个 candidate 的类型、地址、优先级
   → gathering 起止时间

4. ICE 连通性检测的详细日志
   → 每对 candidate pair 的探测结果
   → 哪些成功、哪些失败、选中了哪一对

5. 实时统计图表
   → 接收码率（bytes/sec）
   → 帧率
   → 丢包率
   → RTT

用法：
  让用户在报告问题时，同时打开 chrome://webrtc-internals
  重现问题后，点击页面上的 "Create Dump" 按钮
  把生成的 JSON 文件发给你
  → 包含诊断所需的一切信息
```

### 诊断决策树总结

```
数字人不出来
  │
  ├── 后端有 session.updated + ice_servers？
  │   ├── 没有 → Azure 配置问题（modalities 未含 avatar）
  │   └── 有 ↓
  │
  ├── 前端有 ICE candidates？
  │   ├── 0 个 → ICE servers 配置错误（凭据过期/DNS 失败）
  │   ├── 只有 host → STUN/TURN 不可达（网络问题）
  │   └── 有 relay ↓
  │
  ├── ICE connectionState？
  │   ├── "checking" 卡住 → 所有路径都不通（严格防火墙）
  │   ├── "failed" → 网络完全不可达
  │   └── "connected" ↓
  │
  ├── ontrack 触发了？
  │   ├── 没有 → Azure Avatar 服务端问题（未开始推流）
  │   └── 有 ↓
  │
  ├── framesReceived > 0？
  │   ├── 0 → 媒体流未到达（中间网络问题）
  │   └── > 0 ↓
  │
  ├── video.play() 成功？
  │   ├── NotAllowedError → autoplay policy（需要用户交互）
  │   ├── AbortError → srcObject 被提前清空（竞态条件）
  │   └── 成功 ↓
  │
  └── 视频应该在播放了
      如果用户仍然看不到 → 检查 CSS（opacity? z-index? display?）
```

> **总结**：远程诊断"数字人不出来"需要三层日志体系：① 前端埋点（WebRTC 状态机的每一步转换），② 后端日志（Azure SDK 事件和 session 生命周期），③ WebRTC getStats() 定期采集（连接质量、丢包率、帧率等运行时指标）。配合 `chrome://webrtc-internals` 的 dump 文件，可以在不到现场的情况下精确定位问题环节。关键设计原则：每个可能失败的环节都要有日志，日志要包含足够的上下文（时间戳、候选类型、状态值），异常检测要主动上报而不是等用户反馈。
