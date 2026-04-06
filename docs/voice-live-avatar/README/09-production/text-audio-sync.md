# 9A. 文字显示与语音播放的同步方案

> 返回 [第九章：生产环境](./README.md) | 返回 [学习导航](../index.md)

---

## 问题本质

WebSocket 的文字和 WebRTC 的音视频走的是两条完全独立的通道，没有共同的时钟基准，导致文字"跑"得比数字人嘴巴快。这是 WebSocket + WebRTC 双通道架构下不可避免的同步问题。

---

## 延迟差距有多大？

要解决同步问题，首先需要理解两条通道的延迟差距从何而来：

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

文字路径只经过 JSON 序列化和 WebSocket 传输，几乎没有计算开销；而数字人路径需要经过 TTS 合成、Avatar 渲染（面部表情、口型动画、身体姿态）、视频编码、WebRTC 传输、浏览器解码等多个环节，累积延迟显著。

---

## 方案对比

针对这个问题，有五种可选方案，它们在实现复杂度和用户体验之间各有取舍：

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

下面逐一展开每个方案的具体实现。

---

## 方案 1：延迟文字显示（最简单有效）

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

---

## 方案 2：打字机效果（推荐 + 方案 1 组合使用）

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

---

## 方案 3：基于音频时间戳的精确对齐（专业方案）

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

虽然这是理论上最精确的方案，但受限于当前 Azure API 的能力，实现成本远高于收益。

---

## 方案 5：双缓冲 + 音频状态标记（进阶方案）

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

---

## 推荐组合

综合实现成本和用户体验，本项目推荐 **方案 1 + 方案 2 的组合**：

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

---

## 为什么不追求完美同步？

最后，有必要解释为什么在工程实践中不需要追求帧级精确的音文同步：

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

工程决策的关键在于**投入产出比**——把有限的开发资源投入到用户能感知到差异的地方，而不是追求理论上的完美。

---

> 返回 [第九章：生产环境](./README.md) | 返回 [学习导航](../index.md)
