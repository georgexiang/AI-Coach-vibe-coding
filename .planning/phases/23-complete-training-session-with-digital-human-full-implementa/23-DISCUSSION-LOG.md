# Phase 23: Complete training session with digital human - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 23-complete-training-session-with-digital-human-full-implementa
**Areas discussed:** 会话统一, 数字人引导流程, 评分与反馈, 多语言语音

---

## 会话统一

| Option | Description | Selected |
|--------|-------------|----------|
| 统一入口，模式切换 | 合并为一个培训会话页，用户在会话中可切换文本/语音/数字人模式 | ✓ |
| 统一入口，选择后分叉 | 场景选择页统一，选择模式后进入对应会话页面 | |
| 完全分离优化 | 保持现有架构（两个独立页面），分别优化 | |

**User's choice:** 统一入口，模式切换
**Notes:** 用户补充：语音是默认模式，可根据用户偏好/Skill/评价标准切换。必须保留session原始信息（文本+音频）作为评价基础。

### 布局设计

| Option | Description | Selected |
|--------|-------------|----------|
| 语音主导布局 | 以语音/数字人为主布局（左侧数字人，右侧对话+提示） | ✓ |
| 自适应布局 | 根据模式动态切换布局 | |
| 你来决定 | Claude 决定 | |

**User's choice:** 语音主导布局

### 文本模式呈现

| Option | Description | Selected |
|--------|-------------|----------|
| HCP 头像+场景信息 | 左侧显示 HCP 头像、名称、专业、场景描述和 Key Messages | ✓ |
| 静态数字人形象 | 左侧显示 HCP 的数字人静态形象 | |
| 你来决定 | Claude 决定 | |

**User's choice:** HCP 头像+场景信息

### 模式切换

| Option | Description | Selected |
|--------|-------------|----------|
| 仅开始前选择 | 场景选择时确定模式，会话中不可切换 | |
| 会话中可切换 | 训练过程中可在文本和语音之间切换，对话历史保持 | ✓ |
| 你来决定 | Claude 决定 | |

**User's choice:** 会话中可切换

---

## 数字人引导流程

| Option | Description | Selected |
|--------|-------------|----------|
| 分步引导向导 | 首次使用时显示 3-4 步引导 | |
| 内嵌提示卡片 | 在会话页内嵌提示卡片，随操作逐步消失 | ✓ |
| 你来决定 | Claude 决定 | |

**User's choice:** 内嵌提示卡片

### 权限处理

| Option | Description | Selected |
|--------|-------------|----------|
| 拒绝则降级为文本 | 自动降级为文本模式并提示 | ✓ |
| 拒绝则阻止语音模式 | 明确告知需要权限，不授权则无法进入语音 | |
| 你来决定 | Claude 决定 | |

**User's choice:** 拒绝则降级为文本

---

## 评分与反馈

| Option | Description | Selected |
|--------|-------------|----------|
| 文本维度+语音维度 | 保留现有文本评分维度，追加语音特有维度 | ✓ |
| 统一维度体系 | 文本和语音共用同一套评分维度 | |
| 你来决定 | Claude 决定 | |

**User's choice:** 文本维度+语音维度
**Notes:** 需要保留音频内容，使用 Content Understanding 评价语言连贯性、语气等

### 音频评价时机

| Option | Description | Selected |
|--------|-------------|----------|
| 会话结束后异步评价 | 录音保存到 Azure Blob，结束后异步调用 Content Understanding | ✓ |
| 会话中实时评价 | 每段发言结束后实时评价 | |
| 混合模式 | 实时基础评分 + 结束后深度评价 | |

**User's choice:** 会话结束后异步评价

### 报告展示

| Option | Description | Selected |
|--------|-------------|----------|
| 扩展现有 radar chart | 增加语音维度节点，详细页分内容+语音两块 | ✓ |
| 双雷达图对比 | 左右双 radar chart（内容 vs 语音） | |
| 你来决定 | Claude 决定 | |

**User's choice:** 扩展现有 radar chart

---

## 多语言语音

| Option | Description | Selected |
|--------|-------------|----------|
| 跟随场景配置 | Scenario/HCP Profile 配置语言，语音自动匹配 | ✓ |
| 用户实时选择 | 用户可在会话前/中选择语音语言 | |
| 自动检测 | STT auto-detect，TTS 跟随 HCP 配置 | |

**User's choice:** 跟随场景配置

### 数字人形象语言

| Option | Description | Selected |
|--------|-------------|----------|
| 跟随 HCP Profile 配置 | Avatar 和 voice 已在 HCP Profile/VL Instance 配置 | ✓ |
| 统一 avatar + 多语言声音 | 同一 avatar 配不同语言声音 | |

**User's choice:** 跟随 HCP Profile 配置

---

## Claude's Discretion

- 统一会话页的具体组件拆分策略
- 模式切换时的过渡动画和加载态设计
- 音频录制格式和采样率
- Azure Blob Storage 音频文件命名和保留策略
- Content Understanding API 参数配置
- 语音评分维度权重
- 引导提示卡片消失逻辑

## Deferred Ideas

None — discussion stayed within phase scope
