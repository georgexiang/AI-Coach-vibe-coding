# 07 — UI 交互设计模式

## 页面布局

### Voice Session（用户端训练页面）

全屏布局，无 UserLayout 包裹。对齐 Azure AI Foundry Playground 风格。

```
┌────────────────────────────────────────────────────────────────┐
│ Header (64px)                                                   │
│ [Timer + Scenario]     [ModeStatus]     [Status][Toggle][End]  │
├──────────────────────────────┬─────────────────────────────────┤
│                              │  Tabs: [Transcript] [Config]    │
│                              │─────────────────────────────────│
│    Avatar / AudioOrb         │                                 │
│    (60% width)               │  Transcript / Config Panel      │
│                              │  (40% width)                    │
│    ┌──────────────────┐      │  ┌─────────────────────────┐   │
│    │                  │      │  │ User:  你好王医生        │   │
│    │   Digital Human  │      │  │ AI:    你好，请问...     │   │
│    │   Video / Orb    │      │  │ User:  关于BTK抑制剂... │   │
│    │                  │      │  │ AI:    (typing...)  ▋   │   │
│    └──────────────────┘      │  └─────────────────────────┘   │
│                              │                                 │
├──────────────────────────────┴─────────────────────────────────┤
│ Controls Bar                                                    │
│        [📷off]    [🎤 Mic (56px)]    [📞 End]  [⌨️] [⛶]       │
└────────────────────────────────────────────────────────────────┘
```

### VL Instance Editor（管理端编辑页面）

```
┌────────────────────────────────────────────────────────────────┐
│ Header: [← Back] Instance Name    [Enabled Toggle]  [Assign]  │
├───────────────────────┬────────────────────────────────────────┤
│ Config Form (30%)     │ Test Playground (70%)                  │
│                       │                                        │
│ ▸ GENERATIVE AI MODEL │  ┌────────────────────────────────┐   │
│   Model: [GPT-4o ▾]  │  │                                │   │
│   Instructions: [...] │  │     Avatar Preview             │   │
│   Temperature: [0.8]  │  │     (复用 AvatarView)          │   │
│                       │  │                                │   │
│ ▸ SPEECH INPUT        │  └────────────────────────────────┘   │
│   Language: [中文 ▾]  │  [Controls: Mic | End]                │
│   Auto-detect: [ON]   │  ┌────────────────────────────────┐   │
│   VAD: semantic       │  │ Live Transcript                │   │
│   Noise: [ON]         │  │ ...                            │   │
│                       │  └────────────────────────────────┘   │
│ ▸ SPEECH OUTPUT       │                                        │
│   Voice: Xiaoxiao     │                                        │
│                       │                                        │
│ ▸ AVATAR              │                                        │
│   Enable: [ON]        │                                        │
│   [Photo] [Video]     │                                        │
│   ┌──┐ ┌──┐ ┌──┐     │                                        │
│   │Li│ │Ha│ │Me│     │                                        │
│   └──┘ └──┘ └──┘     │                                        │
│                       │                                        │
│ [Apply] [Reset]       │                                        │
└───────────────────────┴────────────────────────────────────────┘
```

## 交互状态机

### 连接状态
```
disconnected → connecting → connected → (reconnecting →) disconnected
                                     → error → disconnected
```

### 音频状态
```
idle → listening (用户说话, VAD 检测)
    → speaking (AI 回复)
    → muted (用户点击静音)
    → idle
```

### Mic 按钮视觉
| 状态 | 背景色 | 图标 | 动画 |
|------|--------|------|------|
| idle | gray-100 | Mic | 无 |
| listening | primary-500 | Mic | 外圈 ping 脉冲 |
| speaking | green-500 | Volume2 | 无 |
| muted | red-500 | MicOff | 无 |
| connecting | gray-300 | Loader2 | spin |

## Transcript 显示规则

```typescript
// 用户消息：右对齐，primary 色背景
// AI 消息：左对齐，muted 色背景
// 未完成 (isFinal=false)：70% 透明度 + 闪烁光标 ▋
// 增量内容：delta 追加到现有 segment
// 完成事件：替换整个 segment 内容
```

**自动滚动**：每次 transcript 更新后 `scrollIntoView({ behavior: "smooth" })`

**Transcript 持久化**：每条完成的消息通过 `persistTranscriptMessage(sessionId, role, content)` 保存到后端。使用 `pendingFlushesRef` 追踪未完成的持久化请求，结束会话前等待全部完成。

## Avatar 角色选择 UI

VL Instance Editor 中的 Avatar 配置区：

```
[Filter: All | Photo | Video]

┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│  ┌───┐  │ │  ┌───┐  │ │  ┌───┐  │ │  ┌───┐  │
│  │CDN│  │ │  │CDN│  │ │  │CDN│  │ │  │CDN│  │
│  │img│  │ │  │img│  │ │  │img│  │ │  │img│  │
│  └───┘  │ │  └───┘  │ │  └───┘  │ │  └───┘  │
│  Lisa   │ │  Harry  │ │  Meg    │ │  Adrian │
│ ✓ selected│ │         │ │         │ │  📷     │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
                                      (Photo badge)
Style: [casual-sitting ▾]
```

- 缩略图来自 Microsoft Learn CDN
- Video avatar 显示样式选择下拉框
- Photo avatar (VASA-1) 显示 📷 徽章，无样式选择
- 选中态：primary 边框 + 勾选角标

## 路由

| 路由 | 页面 | 布局 |
|------|------|------|
| `/user/training/voice?id=sessionId` | VoiceSession | 全屏（无 UserLayout） |
| `/admin/voice-live` | VoiceLiveManagement | AdminLayout |
| `/admin/voice-live/new` | VlInstanceEditor | AdminLayout |
| `/admin/voice-live/:id/edit` | VlInstanceEditor | AdminLayout |
