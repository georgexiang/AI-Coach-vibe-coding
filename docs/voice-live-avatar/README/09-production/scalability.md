# 9B. 扩容策略 —— 100 个 MR 同时训练能撑住吗？

> 返回 [第九章：生产环境](./README.md) | 返回 [学习导航](../index.md)

---

## 结论先行

撑得住。WebSocket 代理是典型的 I/O-bound 场景，Python async 恰好是为这种场景设计的。但瓶颈不在 CPU 或协程数量，而在内存管理和 Azure API 配额。

---

## 工作负载分析

要回答"能不能撑住"的问题，首先需要精确分析每个 MR 训练会话给后端带来的工作负载：

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

数据很清楚：100 并发在内存和 CPU 层面完全不是问题，**网络带宽才是真正的瓶颈**。

---

## 为什么 Python async 适合这个场景？

有人可能会质疑：Python 不是因为 GIL 性能差吗？对于 CPU 密集型任务确实如此，但 WebSocket 代理恰恰是 I/O 密集型任务，这正是 Python asyncio 最擅长的领域：

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

---

## 真正的瓶颈在哪里？

通过上面的分析，我们可以识别出四个潜在瓶颈，按严重程度排序：

### 瓶颈 1：网络带宽（最可能的瓶颈）

```
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
```

### 瓶颈 2：Azure Voice Live API 配额

```
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
```

### 瓶颈 3：内存管理（容易被忽视）

```
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
```

### 瓶颈 4：base64 编解码的 CPU 开销（通常不是问题）

```
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

---

## 扩容策略

根据并发规模的不同，需要采取不同级别的架构策略：

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

---

## WebSocket 的 sticky session 问题

当进行水平扩展时，WebSocket 的有状态特性带来了一个关键问题：

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

---

## 实测基准参考

以下数据可以作为容量规划的参考基准：

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

---

## 关键代码模式：确保资源正确释放

高并发场景下，最容易出问题的不是性能，而是资源泄漏。以下是 WebSocket 代理的健壮实现模式：

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

`try/finally` 模式是这段代码的核心：无论会话因为什么原因结束（正常断开、异常错误、网络超时），`finally` 块都会确保 Azure SDK 连接和浏览器 WebSocket 被正确关闭，避免资源泄漏。

---

## 本节小结

100 并发 MR 训练对 Python async + FastAPI 来说完全不是问题。这是经典的 I/O-bound 工作负载，Python asyncio 恰好为此设计。单实例 4 workers 可以轻松处理。真正的瓶颈在 Azure API 配额和网络带宽上。需要关注的工程问题是资源泄漏（确保每个会话退出时正确关闭所有连接）和内存监控。500+ 并发时才需要考虑水平扩展和 sticky session。

---

> 返回 [第九章：生产环境](./README.md) | 返回 [学习导航](../index.md)
