# 9C. 远程诊断 ——"数字人不出来"怎么排查？

> 返回 [第九章：生产环境](./README.md) | 返回 [学习导航](../index.md)

---

## 问题场景

用户在生产环境报告"我能看到文字，但数字人没有画面"。你不在现场，怎么远程诊断？

---

## 第一原则：这个问题 = "WebSocket 正常，WebRTC 断开"

回到前面章节的结论，能看到文字说明数据通道正常，看不到数字人说明视频通道出了问题：

```
✅ 文字正常 = WebSocket 通道正常
❌ 没有视频 = WebRTC 通道未建立或已断开
❌ 没有音频 = WebRTC Audio Track 未连接（数字人模式下音频走 WebRTC）
```

所以排查方向明确：**WebRTC 建立过程中的哪一步失败了？**

---

## 日志埋点矩阵

要实现远程诊断，需要在 WebRTC 建立流程的每一步都埋入日志。以下是完整的埋点矩阵：

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

每个阶段都是 WebRTC 可能失败的环节，缺少任何一个阶段的日志都会导致诊断时出现"盲区"。

---

## 前端日志实现

以下代码展示了如何在 `use-avatar-stream.ts` 中系统性地埋入诊断日志：

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

注意 `reportToBackend` 函数的设计：诊断上报使用 `try/catch` 包裹，确保上报失败不会影响主业务流程。

---

## 后端诊断日志

后端同样需要在关键环节记录日志，尤其是 Azure SDK 事件的处理过程：

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

后端日志的关键设计原则：每条日志都带有 `session_id` 前缀，便于在大量并发会话中按用户追踪问题。

---

## WebRTC getStats() API：远程诊断的"X光机"

`pc.getStats()` 是 WebRTC 最强大的诊断工具，返回连接的完整运行时统计信息。掌握这个 API 就等于拥有了远程诊断的"X光机"：

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

---

## getStats() 指标解读

采集到统计数据后，需要知道每个指标的含义和正常/异常范围：

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
├─────────────────────┼─────────────���──────────────────────────────────┤
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

---

## 定期采集 + 上报机制

诊断不能只依赖问题发生时的快照，还需要持续的统计采集来发现渐进式的性能劣化：

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

这段代码实现了两层策略：异常事件（帧率为零、高丢包）立即上报，正常统计则每分钟采样一次以避免给后端带来过大压力。

---

## 完整的远程诊断流程

当用户报告"数字人不出来"时，按照以下流程逐步排查：

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

---

## chrome://webrtc-internals 能看到什么？

当前端日志和后端日志都无法定位问题时，`chrome://webrtc-internals` 是最后的终极武器：

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

---

## 诊断决策树总结

最后，将完整的诊断流程浓缩为一棵决策树，方便快速查阅：

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

---

## 本节小结

远程诊断"数字人不出来"需要三层日志体系：

1. **前端埋点**：WebRTC 状态机的每一步转换
2. **后端日志**：Azure SDK 事件和 session 生命周期
3. **WebRTC getStats()**：定期采集连接质量、丢包率、帧率等运行时指标

配合 `chrome://webrtc-internals` 的 dump 文件，可以在不到现场的情况下精确定位问题环节。关键设计原则：每个可能失败的环节都要有日志，日志要包含足够的上下文（时间戳、候选类型、状态值），异常检测要主动上报而不是等用户反馈。

---

> 返回 [第九章：生产环境](./README.md) | 返回 [学习导航](../index.md)
