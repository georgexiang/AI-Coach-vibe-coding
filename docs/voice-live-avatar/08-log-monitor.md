# 08 — 日志与可观测性

> Voice Live + Avatar 三层日志体系设计与诊断手册。
> 适用场景：远程排障、性能分析、连接质量监控。

---

## 设计背景

Voice Live + Avatar 涉及 **浏览器 → WebSocket → FastAPI → Azure SDK → Azure Avatar (WebRTC)** 的长链路。
诊断"数字人不出来"或"没有声音"等问题需要能在**不到现场**的情况下精确定位故障环节。

### 设计原则

1. **每个可能失败的环节都有日志**——麦克风权限、WebSocket 连接、SDP 协商、WebRTC 状态转换
2. **日志包含足够的上下文**——时间戳、状态值、候选类型、服务器响应
3. **异常检测主动上报**——丢包率 >5%、帧率 <10fps 时自动告警
4. **跨层关联 ID**——一个 `sid` 可以同时搜索前端控制台和后端日志

---

## 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│  L1 前端埋点                                                  │
│  [VL:{sid}][Component] 格式化日志                              │
│  voice-logger.ts → use-voice-live / use-avatar-stream / ...  │
├─────────────────────────────────────────────────────────────┤
│  L2 后端结构化日志                                             │
│  LoggerAdapter(sid) → voice_live_websocket / service / router │
│  事件计数 + 会话摘要                                           │
├─────────────────────────────────────────────────────────────┤
│  L3 WebRTC getStats()                                        │
│  每 5 秒采集连接质量指标                                        │
│  视频 fps/丢包/jitter + 音频丢包/jitter + RTT                  │
└─────────────────────────────────────────────────────────────┘
```

| 层 | 内容 | 主要源文件 |
|---|------|-----------|
| L1 前端埋点 | WebRTC 状态转换、WebSocket 生命周期、音频管道 | `frontend/src/lib/voice-logger.ts`, `use-voice-live.ts`, `use-avatar-stream.ts`, `use-audio-handler.ts`, `use-audio-player.ts`, `voice-session.tsx` |
| L2 后端日志 | Session 关联 ID、Azure SDK 事件、事件计数与摘要 | `backend/app/services/voice_live_websocket.py`, `voice_live_service.py`, `voice_live_instance_service.py`, `app/api/voice_live.py` |
| L3 WebRTC Stats | 每 5 秒采集 video/audio 质量指标 + 异常检测 | `frontend/src/hooks/use-avatar-stream.ts` |

---

## 跨层关联 ID (sid) 流转

```
┌──────────────┐          ┌──────────────┐          ┌────────────────┐
│   Frontend   │          │   Backend    │          │  Azure Cloud   │
│              │          │              │          │                │
│ 生成 sid     │  WS URL  │ 提取 sid     │          │                │
│ =c5679ca7   │ ?sid=... │ =c5679ca7   │          │                │
│              │─────────►│              │─────────►│                │
│ 所有 console │          │ 所有 logger  │          │                │
│ [VL:c5679ca7]│◄─────────│ sid=c5679ca7│◄─────────│                │
│              │proxy.con │              │          │                │
│              │nected    │              │          │                │
└──────────────┘{sid:...} └──────────────┘          └────────────────┘
```

**使用方式：** `grep c5679ca7` 可同时匹配前端 Console 输出和后端 stdout 日志，还原完整会话时间线。

---

## L1 — 前端日志工具

### voice-logger.ts

源码：`frontend/src/lib/voice-logger.ts`

```typescript
import { createVoiceLogger, setSessionCorrelationId } from "@/lib/voice-logger";

const log = createVoiceLogger("AvatarStream");

// 常规日志
log.info("connectionState: %s", pc.connectionState);
// 输出: [VL:c5679ca7][AvatarStream] connectionState: connected

// 高频事件计数（不输出到控制台）
log.event("response.audio.delta");

// 获取会话事件摘要
getEventSummary();
// => { "response.audio.delta": 120, "response.done": 5, ... }
```

### API

| 函数 | 用途 |
|------|------|
| `createVoiceLogger(component)` | 创建带组件名的 logger 实例 |
| `setSessionCorrelationId(sid)` | 设置当前会话 sid（connect 时调用） |
| `getSessionCorrelationId()` | 获取当前 sid |
| `getEventSummary()` | 返回事件计数器的快照 |
| `resetEventSummary()` | 清零事件计数器 |
| `refreshLogLevel()` | 从 localStorage 重新读取日志级别 |

### 日志级别

| 级别 | 数值 | 默认 | 内容 |
|------|------|------|------|
| `debug` | 0 | 关 | WebRTC stats、ICE 候选详情、信令状态 |
| `info` | 1 | 开 | 连接/断开、SDP 交换、状态转换 |
| `warn` | 2 | 开 | 异常检测告警、非致命错误 |
| `error` | 3 | 开 | 致命错误、连接失败 |

**运行时切换（无需改代码）：**

```javascript
// 在浏览器 Console 中执行
localStorage.setItem("VOICE_LOG_LEVEL", "debug");
// 刷新页面后生效，会输出 WebRTC stats 等详细信息

// 恢复默认
localStorage.removeItem("VOICE_LOG_LEVEL");
```

### 各组件埋点清单

#### `[VoiceLive]` — WebSocket 会话管理
| 事件 | 级别 | 说明 |
|------|------|------|
| `connect() hcpProfileId=xxx sid=xxx` | info | 会话开始，sid 生成 |
| `WebSocket open, sending session.update` | info | WS 连接成功 |
| `Proxy connected, model=xxx, avatar=xxx` | info | 后端代理就绪 |
| `Session created: sess_xxx` | info | Azure 会话创建 |
| `Session updated, avatar keys=xxx` | info | 会话配置完成 |
| `ICE servers received: count=N` | info | ICE 服务器配置 |
| `WebSocket closed: code=N reason=xxx` | info | 连接关闭（含关闭码） |
| `Event summary: {...}` | info | 会话结束时的事件统计 |
| `send() dropped: readyState=N` | warn | WS 未就绪时消息被丢弃 |
| `Error: {error}` | error | Azure 返回错误 |

#### `[AvatarStream]` — WebRTC 连接
| 事件 | 级别 | 说明 |
|------|------|------|
| `connect() entry, iceServers=N` | info | Avatar WebRTC 连接开始 |
| `connectionState: xxx` | info/error | RTCPeerConnection 状态变化 |
| `iceConnectionState: xxx` | info/warn/error | ICE 连接状态 |
| `signalingState: xxx` | debug | 信令状态 |
| `createOffer success` | info | SDP offer 创建 |
| `setLocalDescription success` | info | 本地 SDP 设置 |
| `ICE gathering complete, sending SDP offer` | info | ICE 收集完成 |
| `ICE gathering timeout (8s)` | warn | ICE 收集超时 |
| `Server SDP answer received (len=N)` | info | 收到 server SDP |
| `setRemoteDescription success` | info | 远端 SDP 设置 |
| `WebRTC connected` | info | 连接建立 |
| `ANOMALY: video packet loss X%` | warn | 视频丢包率 >5% |
| `ANOMALY: video fps=N (<10)` | warn | 帧率低于 10 |
| `stats: videoFps=N vLost=N ...` | debug | 每 5 秒 stats 采集 |

#### `[AudioHandler]` — 麦克风与音频处理
| 事件 | 级别 | 说明 |
|------|------|------|
| `initialize: requesting mic permission` | info | 请求麦克风权限 |
| `initialize: mic permission acquired, tracks=N` | info | 麦克风获取成功 |
| `initialize: AudioWorklet loaded, sampleRate=N` | info | 音频处理器加载 |
| `startRecording` | info | 开始录音 |
| `stopRecording` | info | 停止录音 |
| `cleanup` | info | 资源释放 |

#### `[AudioPlayer]` — 音频播放
| 事件 | 级别 | 说明 |
|------|------|------|
| `AudioContext created, sampleRate=N` | info | 音频上下文创建 |
| `AudioContext resumed from suspended` | info | 浏览器自动暂停恢复 |
| `stopAudio` | info | 停止播放 |

#### `[VoiceSession]` — 页面组件
| 事件 | 级别 | 说明 |
|------|------|------|
| `initVoice: hcpProfileId=xxx` | info | Voice 初始化 |
| `confirmEndSession: transcripts=N eventSummary={...}` | info | 会话结束统计 |
| `Voice Live error: xxx` | error | 异常捕获 |

---

## L2 — 后端结构化日志

### 配置

```python
# backend/app/config.py
log_level: str = "INFO"  # 支持 DEBUG, INFO, WARNING, ERROR

# 通过环境变量控制：
# LOG_LEVEL=DEBUG uvicorn app.main:app
```

日志输出到 **stdout**（不是 stderr），格式：

```
2026-04-06 22:10:31,901 INFO [app.services.voice_live_websocket] Session started: sid=c5679ca7, hcp=cb6bce84...
```

### Session 作用域日志

```python
# voice_live_websocket.py
sid = ws.query_params.get("sid", "") or uuid.uuid4().hex[:8]
session_log = logging.LoggerAdapter(logger, {"sid": sid})
session_log.info("Session started: sid=%s, hcp=%s", sid, hcp_profile_id)
```

### 事件计数与会话摘要

后端对每条转发消息按方向+类型计数：

```python
event_counts: dict[str, int] = {}
# client→azure: "c2a:input_audio_buffer.append"
# azure→client: "a2c:response.audio.delta"
```

会话结束时输出 JSON 摘要：

```
Session ended: sid=c5679ca7, duration=45.2s, events={"c2a:session.update":1, "c2a:input_audio_buffer.append":120, "a2c:session.created":1, "a2c:response.audio.delta":85, "a2c:response.done":3}
```

### 各层日志事件清单

#### 路由层 — `app/api/voice_live.py`
| 事件 | 说明 |
|------|------|
| `WS connect: user=xxx, sid=xxx` | WebSocket 连接建立 |
| `WS disconnect: user=xxx, sid=xxx, duration=Xs` | WebSocket 断开（含持续时间） |

#### 核心代理 — `voice_live_websocket.py`
| 事件 | 说明 |
|------|------|
| `Session started: sid=xxx, hcp=xxx` | 会话初始化 |
| `Voice Live connecting (model mode): endpoint=..., model=..., avatar=...` | 连接参数 |
| `Connected to Azure Voice Live` | Azure 连接成功 |
| `Session created: sess_xxx` | Azure session ID |
| `Session updated: modalities=..., voice=..., avatar_keys=...` | 会话配置详情 |
| `Avatar SDP offer: has client_sdp=True, len=N` | 客户端 SDP offer 转发 |
| `Avatar SDP answer: type=xxx, has_server_sdp=True` | 服务端 SDP answer 转发 |
| `Session ended: sid=xxx, duration=Xs, events={...}` | 会话结束+事件摘要 |

#### 服务层 — `voice_live_service.py`
| 事件 | 说明 |
|------|------|
| `get_voice_live_token: hcp_profile_id=xxx` | Token 请求 |
| `Token broker mode: agent/model, agent_id=xxx` | 模式决策 |
| `STS token exchange: endpoint=xxx, success/failure` | Token 交换结果 |

#### 实例管理 — `voice_live_instance_service.py`
| 事件 | 说明 |
|------|------|
| `create/update/delete VL instance: id=xxx` | CRUD 操作 |
| `resolve_voice_config: source=xxx` | 配置来源决策 |
| `assign/unassign VL instance: instance=xxx, hcp=xxx` | 分配关系变更 |

---

## L3 — WebRTC getStats() 连接质量监控

源码：`frontend/src/hooks/use-avatar-stream.ts`

### 采集指标

每 **5 秒** 调用 `pc.getStats()` 采集以下指标：

| 指标 | 来源 | 说明 |
|------|------|------|
| `videoFps` | `inbound-rtp` (video) | 视频帧率 |
| `videoPacketsLost` | `inbound-rtp` (video) | 视频丢包数 |
| `videoPacketsReceived` | `inbound-rtp` (video) | 视频接收包数 |
| `videoJitter` | `inbound-rtp` (video) | 视频抖动 |
| `videoBytesReceived` | `inbound-rtp` (video) | 视频接收字节 |
| `audioPacketsLost` | `inbound-rtp` (audio) | 音频丢包数 |
| `audioPacketsReceived` | `inbound-rtp` (audio) | 音频接收包数 |
| `audioJitter` | `inbound-rtp` (audio) | 音频抖动 |
| `rtt` | `candidate-pair` (succeeded) | 端到端往返时延 |

### 异常检测规则

| 条件 | 级别 | 日志 |
|------|------|------|
| 视频丢包率 >5% | warn | `ANOMALY: video packet loss X.X%` |
| 音频丢包率 >5% | warn | `ANOMALY: audio packet loss X.X%` |
| 视频帧率 >0 且 <10fps | warn | `ANOMALY: video fps=N (<10)` |

### 查看 Stats 输出

默认 stats 日志为 debug 级别。启用方式：

```javascript
localStorage.setItem("VOICE_LOG_LEVEL", "debug");
// 刷新页面后，每 5 秒输出：
// [VL:xxx][AvatarStream] stats: videoFps=30 vLost=0 vJitter=0.0012 vBytes=1234567 aLost=0 aJitter=0.0008 rtt=0.045
```

### 补充工具：chrome://webrtc-internals

在 Chrome 地址栏输入 `chrome://webrtc-internals`，可以看到：
- 所有活跃的 RTCPeerConnection
- 详细的 ICE 候选协商过程
- 实时的音视频流统计图表
- 可以导出 dump 文件发给开发者分析

也可以在 Console 中直接检查：

```javascript
// 获取 RTCPeerConnection 引用（调试用）
const pc = window.__avatarPC;

// 手动获取 stats
const stats = await pc.getStats();
stats.forEach(report => console.log(report.type, report));
```

---

## 诊断手册

### 快速定位：按问题类型

#### 问题："数字人不出来"（Avatar 不显示）

```
排查路径：
1. 浏览器 Console 搜索 "[AvatarStream]"
   → 是否有 "connect() entry"？（没有 = Avatar 未启用或前端未触发）
   → 是否有 "createOffer success"？（没有 = RTCPeerConnection 创建失败）
   → 是否有 "ICE gathering timeout"？（有 = 网络受限，ICE 候选收集超时）
   → 是否有 "setRemoteDescription success"？（没有 = SDP 协商失败）
   → connectionState 是否到 "connected"？（不是 = WebRTC 连接未建立）

2. 后端日志搜索 sid
   → 是否有 "Avatar SDP offer"？（没有 = 客户端 SDP 未到达后端）
   → 是否有 "Avatar SDP answer"？（没有 = Azure 未返回 SDP answer）

3. chrome://webrtc-internals
   → ICE candidates 是否正常？（只有 host 没有 srflx/relay = TURN 配置问题）
   → 连接状态图表是否从 checking → connected？
```

#### 问题："没有声音"（音频不工作）

```
排查路径：
1. 浏览器 Console 搜索 "[AudioHandler]"
   → 是否有 "mic permission acquired"？（没有 = 麦克风权限被拒绝）
   → tracks=N 是多少？（0 = 没有音频轨道）
   → 是否有 "AudioWorklet loaded"？（没有 = worklet 加载失败）

2. 搜索 "[VoiceLive]"
   → 是否有 "send() dropped"？（有 = WebSocket 断了，音频发不出去）
   → Event summary 中 "input_audio_buffer.append" 数量？（0 = 没发送过音频）
   → Event summary 中 "response.audio.delta" 数量？（0 = Azure 没返回音频）

3. 后端日志
   → event_counts 中 c2a:input_audio_buffer.append > 0？（0 = 前端没发音频）
   → event_counts 中 a2c:response.audio.delta > 0？（0 = Azure 没生成响应）
```

#### 问题："连接断开/不稳定"

```
排查路径：
1. 浏览器 Console 搜索 "ANOMALY"
   → packet loss > 5%？（网络质量差）
   → video fps < 10？（带宽不足或服务端压力）

2. 搜索 "[VoiceLive] WebSocket closed"
   → code=1000 wasClean=true（正常关闭）
   → code=1006 wasClean=false（异常断开——网络中断或服务端崩溃）
   → code=1008/1011（策略违规/服务端错误）

3. 后端日志
   → Session ended 的 duration 是否过短？（<5s = 可能配置错误）
   → event_counts 是否极少？（几乎没事件 = 连接建立就断了）

4. getStats debug 日志
   → rtt 值是否持续 >0.3s？（网络延迟高）
   → videoJitter 是否持续 >0.05？（网络抖动大）
```

#### 问题："用户说的话没有显示"（Transcript 丢失）

```
排查路径：
1. 浏览器 Console 搜索 "Event summary"
   → "input_audio_buffer.speech_started" > 0？（0 = VAD 没检测到语音）
   → "conversation.item.input_audio_transcription.completed" > 0？（0 = 转写失败）

2. 后端日志
   → a2c:conversation.item.input_audio_transcription.completed > 0？
   → c2a:input_audio_buffer.append 数量？（少 = 前端音频发送有问题）
```

### 完整会话时间线还原

给定一个 sid（如 `c5679ca7`），可以还原完整链路：

```bash
# 1. 后端日志
grep "c5679ca7" backend_logs.txt

# 输出示例：
# 22:10:31 WS connect: user=a590e085, sid=c5679ca7
# 22:10:31 Session started: sid=c5679ca7, hcp=cb6bce84
# 22:10:32 Voice Live connecting: model=gpt-realtime, avatar=True
# 22:10:37 Connected to Azure Voice Live
# 22:10:37 Session created: sess_DRewvc1BCyuJWaUrT8wu1
# 22:10:37 Session updated: modalities=[audio,avatar,text]
# 22:10:45 Avatar SDP offer: len=12808
# ...
# 22:15:20 Session ended: duration=289.3s, events={...}
# 22:15:20 WS disconnect: duration=289s

# 2. 前端 Console（用户提供截图或复制）
# 过滤 "c5679ca7"：
# [VL:c5679ca7][VoiceLive] connect() ...
# [VL:c5679ca7][AvatarStream] connectionState: connected
# [VL:c5679ca7][AudioHandler] initialize: mic permission acquired
# [VL:c5679ca7][VoiceSession] confirmEndSession: transcripts=12
```

### 远程诊断 SOP

当用户报告问题时：

1. **获取 sid** — 让用户在 Console 中执行：`console.log(window.__avatarPC)` 或查看最近的 `[VL:xxx]` 日志中的 sid
2. **获取前端日志** — 让用户在 Console 中右键 → Save as... 导出日志
3. **获取后端日志** — 在服务器上 `grep {sid}` 搜索
4. **获取 WebRTC dump**（如需要）— `chrome://webrtc-internals` → Create Dump → 下载
5. **按上面的排查路径分析** — 根据问题类型逐步定位

---

## 配置参考

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LOG_LEVEL` | `INFO` | 后端日志级别 (DEBUG/INFO/WARNING/ERROR) |

### localStorage

| Key | 默认值 | 说明 |
|-----|--------|------|
| `VOICE_LOG_LEVEL` | `info` | 前端日志级别 (debug/info/warn/error) |

### 生产环境建议

| 设置 | 开发环境 | 生产环境 | 说明 |
|------|---------|---------|------|
| 后端 `LOG_LEVEL` | `DEBUG` | `INFO` | 生产不需要 debug 级别 |
| 前端 `VOICE_LOG_LEVEL` | `debug` | `info`（默认） | 用户可按需开启 debug |
| getStats 采集间隔 | 5s | 5s | 暂不可配置，代码硬编码 |

---

## 文件清单

| 文件 | 类型 | 职责 |
|------|------|------|
| `frontend/src/lib/voice-logger.ts` | 工具库 | Logger 工厂、sid 管理、事件计数 |
| `frontend/src/lib/voice-logger.test.ts` | 测试 | 格式化、级别过滤、事件计数测试 |
| `frontend/src/hooks/use-voice-live.ts` | Hook | WebSocket 生命周期日志 |
| `frontend/src/hooks/use-avatar-stream.ts` | Hook | WebRTC 状态 + L3 getStats |
| `frontend/src/hooks/use-audio-handler.ts` | Hook | 麦克风与音频处理日志 |
| `frontend/src/hooks/use-audio-player.ts` | Hook | 音频播放日志 |
| `frontend/src/components/voice/voice-session.tsx` | 组件 | 页面级日志 |
| `backend/app/config.py` | 配置 | `log_level` 设置项 |
| `backend/app/main.py` | 入口 | logging.basicConfig(stdout) |
| `backend/app/api/voice_live.py` | 路由 | WS 连接/断开日志 |
| `backend/app/services/voice_live_websocket.py` | 服务 | 核心代理、事件计数、会话摘要 |
| `backend/app/services/voice_live_service.py` | 服务 | Token 请求、模式决策 |
| `backend/app/services/voice_live_instance_service.py` | 服务 | CRUD + 配置解析日志 |
