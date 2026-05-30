# Phase 23: Complete training session with digital human - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

完整的数字人培训会话体验：统一文本/语音/数字人为一个会话页面（语音主导布局），支持会话中模式切换，保留所有原始信息（文本+音频），会话结束后通过 Azure Content Understanding 异步评价语音维度，评分扩展为内容+语音双维度。所有新页面内容完整 I18N（zh-CN + en-US）。

</domain>

<decisions>
## Implementation Decisions

### 会话统一
- **D-01:** 统一入口，模式切换 — 合并为一个培训会话页面，用户可在文本/语音/数字人模式间切换。废弃独立的 `training-session.tsx` 和 `voice-session.tsx` 两个页面，合并为统一会话组件。
- **D-02:** 语音主导布局 — 以语音/数字人为主布局设计。左侧：数字人视频/语音波形 + 控制按钮；右侧：对话记录 + 提示/配置面板。
- **D-03:** 文本模式下左侧显示 HCP 头像 + 名称 + 专业 + 场景描述 + Key Messages checklist（替代数字人视频区域）。右侧仍然是聊天 + coaching hints。
- **D-04:** 会话中可实时切换模式 — 例如从文本切到语音或从语音切到文本，对话历史保持不变，切换不中断会话。
- **D-05:** 语音是默认模式。可根据用户偏好、Skill 要求、评价标准选择文字模式。
- **D-06:** 必须保留 session 所有原始信息（文本对话记录 + 音频录音）作为后续 Content Understanding 评价的基础数据。

### 数字人引导流程
- **D-07:** 内嵌提示卡片引导 — 不做独立的分步向导，而是在会话页面内嵌提示卡片（如"点击麦克风按钮开始说话"），随用户操作逐步消失。
- **D-08:** 麦克风权限拒绝时自动降级为文本模式，并提示用户。下次可在设置中重新开启。

### 评分与反馈
- **D-09:** 双维度评分体系 — 保留现有文本评分维度（内容准确性、key messages 传递、沟通技巧），追加语音特有维度（语言连贯性、语气语调、语速节奏、发音清晰度）。最终综合评分。
- **D-10:** 会话结束后异步评价 — 会话中录音保存到 Azure Blob Storage，会话结束后异步调用 Azure Content Understanding 评价音频，评分结果延迟几分钟后显示。
- **D-11:** 扩展现有 radar chart — 增加语音维度节点。详细报告页分两块：内容评分 + 语音评分。语音评分部分可回放对应音频片段作为证据。

### 多语言语音
- **D-12:** 语音语言跟随场景配置 — Scenario 或 HCP Profile 配置语言，语音输入（STT）和输出（TTS）自动匹配该语言。中文场景 = 中文 TTS/STT，英文场景 = 英文 TTS/STT。
- **D-13:** 数字人形象跟随 HCP Profile 配置 — Avatar character 和 voice name 已在 HCP Profile / VL Instance 中配置，无需额外语言匹配逻辑。

### I18N 完整化
- **D-14:** 统一会话页的所有用户可见文本必须通过 `t()` 函数获取，zh-CN 和 en-US locale JSON 完整覆盖。包括引导提示卡片、模式切换按钮、评分报告、错误提示等。

### Claude's Discretion
- 统一会话页的具体组件拆分策略
- 模式切换时的过渡动画和加载态设计
- 音频录制的具体格式（WAV/WebM/OGG）和采样率
- Azure Blob Storage 的音频文件命名规则和保留策略
- Content Understanding API 调用的具体参数配置
- 语音评分维度的具体权重分配
- 引导提示卡片的消失逻辑（一次性 vs localStorage 记住）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 现有会话实现（将被重构/合并）
- `frontend/src/pages/user/training-session.tsx` — 文本 F2F 会话页（3-panel, SSE streaming）
- `frontend/src/pages/user/voice-session.tsx` — 语音会话页入口（加载 scenario/hcp 数据）
- `frontend/src/components/voice/voice-session.tsx` — VoiceSession 主组件（Azure Voice Live 集成）
- `frontend/src/pages/user/training.tsx` — 场景选择页（ModeSelector 组件）

### Voice/Avatar 组件（复用）
- `frontend/src/components/voice/avatar-view.tsx` — Avatar 视频展示组件
- `frontend/src/components/voice/voice-controls.tsx` — 语音控制按钮组件
- `frontend/src/components/voice/voice-transcript.tsx` — 转录文本显示
- `frontend/src/components/voice/voice-session-header.tsx` — 会话头部
- `frontend/src/components/voice/voice-config-panel.tsx` — 语音配置面板
- `frontend/src/components/voice/mode-selector.tsx` — 模式选择器

### 后端会话服务
- `backend/app/services/session_service.py` — 会话生命周期管理（create, message, end）
- `backend/app/api/sessions.py` — 会话 API 路由
- `backend/app/models/voice_live_instance.py` — Voice Live 配置模型

### 评分系统
- `backend/app/services/scoring_service.py` — 评分服务
- `frontend/src/pages/user/scoring-feedback.tsx` — 评分反馈页（radar chart）
- `backend/app/models/scoring_rubric.py` — 评分维度模型

### I18N
- `frontend/src/i18n/index.ts` — i18n 配置
- `frontend/public/locales/en-US/voice.json` — 英文 voice 翻译
- `frontend/public/locales/zh-CN/voice.json` — 中文 voice 翻译
- `frontend/public/locales/en-US/coach.json` — 英文 coach 翻译
- `frontend/public/locales/zh-CN/coach.json` — 中文 coach 翻译

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VoiceSession` 组件: 完整的 Voice Live 集成（token broker, avatar stream, audio handler）
- `AvatarView`: Azure Avatar 视频渲染组件
- `VoiceControls`: 麦克风/音量/结束按钮
- `VoiceTranscript`: 实时转录显示
- `ChatArea` + `HintsPanel`: 文本会话的聊天和提示组件
- `ScenarioPanel`: 场景信息展示
- `useSSEStream`: SSE 流式聊天 hook
- `useVoiceLive` + `useAvatarStream` + `useAudioHandler`: Voice Live hooks
- `useVoiceSessionLifecycle`: 语音会话生命周期管理
- radar chart 评分展示（recharts RadarChart）

### Established Patterns
- 全屏会话页面（无 UserLayout wrapper）— training-session 和 voice-session 均使用
- TanStack Query hooks per domain
- i18n namespace 分离（voice, coach, common）
- 模式自动解析 from token broker capabilities
- 会话状态机: created → in_progress → completed → scored

### Integration Points
- Router: 需要合并 `/user/training/session` 和 `/user/training/voice` 为统一路由
- Session model: 需要扩展支持音频存储引用（audio_url 字段）
- Scoring service: 需要扩展支持语音维度评分
- Azure Content Understanding: 新增后端服务调用评价音频
- Azure Blob Storage: 新增音频上传存储功能

</code_context>

<specifics>
## Specific Ideas

- 语音是默认模式，统一会话以语音/数字人为核心体验设计
- 必须保留所有 session 原始信息（文本 + 音频）用于 Content Understanding 评价
- Content Understanding 评价语言连贯性、语气、语速等语音特有维度
- 评分报告中语音部分可以回放对应音频片段，作为评分依据的证据
- 用户可以在会话中实时切换模式（文本⇌语音），对话上下文不丢失

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-complete-training-session-with-digital-human-full-implementa*
*Context gathered: 2026-05-07*
