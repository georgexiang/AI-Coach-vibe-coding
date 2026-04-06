> 📖 返回 [学习导航](../index.md) | 上一章 ← [Azure Voice Live API](../05-azure-voice-live/README.md) | 下一章 → [后端实现](../07-backend/README.md)
>
> 本文是 [第六章：前端实现](./README.md) 的子章节。

# 6A. 流媒体渲染与 UI 组件

当 WebRTC 连接建立后，视频和音频流会源源不断地推送到前端。那么，前端用什么 UI 组件来展示这些流媒体？答案比你想象的简单——**浏览器原生的 `<video>` 和 `<audio>` HTML 标签就是流媒体的渲染组件**。WebRTC 的 MediaStream 通过 `element.srcObject = stream` 绑定到标签上，浏览器自动完成解码和渲染。不需要任何第三方播放器库。

---

## 核心概念：srcObject 是桥梁

理解流媒体渲染的关键，在于区分传统文件播放和实时流播放的区别：

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

`srcObject` 就是连接"协议层"和"渲染层"的桥梁。你只需要把 WebRTC 给你的 `MediaStream` 对象赋值给 HTML 元素的 `srcObject` 属性，剩下的一切（解码、渲染、帧率同步）浏览器全包了。

---

## `<video>` 标签 —— 数字人视频渲染

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

对应的 hook 绑定代码在 `frontend/src/hooks/use-avatar-stream.ts` 中：

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

核心逻辑非常直观：视频轨道绑定到预先存在的 `<video>` 元素，音频轨道动态创建一个隐藏的 `<audio>` 元素。赋值 `srcObject` 之后，浏览器接管一切。

---

## 完整的 UI 层次（从上到下）

`avatar-view.tsx` 的渲染结构由四层叠加组成，每层各有用途：

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

这种分层设计的好处是：不同状态下只需切换各层的可见性，而不需要销毁和重建 DOM 元素。

---

## 状态切换时的 UI 变化

随着连接状态和运行模式的变化，各层元素的表现也不同：

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

注意"已连接-纯语音模式"和"已连接-数字人模式"的区别：纯语音模式下，AI 回复的音频通过 WebSocket 传输并由 `useAudioPlayer` 播放（程序化方式）；数字人模式下，音频通过 WebRTC 传输并由隐藏的 `<audio>` 元素播放。两种模式下文字转写始终来自 WebSocket。

---

## 关键的多媒体渲染技巧

以下四个技巧从本项目的真实代码中提炼而来，都是实践中踩过的坑。

### 技巧 1：`<video>` 始终在 DOM 中，用 opacity 控制可见性

```tsx
// 正确做法（本项目）
<video
  ref={videoRef}
  className={isConnected ? "opacity-100" : "opacity-0"}  // 透明度切换
/>

// 错误做法 1
{isConnected && <video ref={videoRef} />}  // 条件渲染
// 问题: ontrack 触发时 <video> 可能还不在 DOM 中
// → srcObject 赋值失败 → 视频黑屏

// 错误做法 2
<video style={{ display: isConnected ? "block" : "none" }} />
// 问题: display:none 的元素，浏览器会阻止 autoplay
// → play() 抛出异常
```

**为什么**：WebRTC 的 `ontrack` 事件在协商完成后立即触发，此时如果 `<video>` 元素还没有挂载到 DOM（条件渲染延迟），`srcObject` 赋值就会失败。用 `opacity: 0` 可以保证元素始终在 DOM 中、始终可以接收流，只是视觉上不可见。

### 技巧 2：`playsInline` 是移动端必需的

```tsx
<video
  autoPlay       // 所有平台: 收到流后自动播放
  playsInline    // iOS 专用: 不要全屏播放，在页面内播放
/>

// 如果没有 playsInline:
//   iOS Safari 会在播放视频时自动进入全屏模式
//   你的 UI 布局会被破坏
```

**为什么**：iOS Safari 默认会在播放视频时自动切换到全屏模式。加上 `playsInline` 属性告诉浏览器"我要在页面内播放"，这样 UI 布局才不会被破坏。

### 技巧 3：音频用动态 `<audio>` 元素，而非 `<video>` 的音轨

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

**为什么**：WebRTC 的视频轨道和音频轨道是分开到达的，它们可能属于不同的 `MediaStream`。如果把音频流也绑到 `<video>` 的 `srcObject` 上，可能会覆盖掉视频流。分开处理是最安全的做法。

### 技巧 4：断开时必须彻底清理

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

**为什么**：如果不把 `srcObject` 设为 `null`，`<video>` 会冻结在最后一帧；如果不从 DOM 中移除 `<audio>` 元素，音频可能继续播放。彻底清理可以避免"幽灵"音视频和内存泄漏。

---

## 通用多媒体 UI 组件速查

不仅限于本项目，下面是浏览器中各类多媒体场景对应的 HTML 元素和数据绑定方式的速查表：

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

---

## 本项目中四种音频播放方式的对比

本项目中涉及四种不同的音频场景，它们的来源、播放方式和 UI 表现各不相同：

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

---

## 总结

浏览器的 `<video>` 和 `<audio>` 标签就是流媒体的渲染组件，通过 `srcObject = mediaStream` 绑定实时流。记住以下关键技巧：

1. **标签始终在 DOM 中**，用 `opacity` 切换可见性（不用条件渲染或 `display:none`）。
2. **iOS 必须加 `playsInline`**，否则视频会被强制全屏。
3. **音频和视频分开绑定**，因为 WebRTC 的两种轨道可能在不同的 MediaStream 中。
4. **断开时彻底清理** `srcObject = null`，防止冻结画面和幽灵音频。

本项目中所有多媒体渲染都使用浏览器原生 API，零第三方播放器依赖。
