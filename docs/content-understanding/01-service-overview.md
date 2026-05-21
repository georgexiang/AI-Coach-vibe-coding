# 01 — CU 服务概述与架构

> Azure AI Content Understanding 是 Azure AI Foundry 的内容分析服务，能处理文档、音频、视频等非结构化内容，通过自定义 Analyzer 输出结构化数据。

---

## 1. 什么是 Content Understanding

Content Understanding (CU) 是一个**统一的内容处理 API**，支持：

- **文档分析** — 提取/生成结构化字段（基于 `prebuilt-document`）
- **音频分析** — 语音转文字 + 生成质量评估（基于 `prebuilt-audio`）
- **视频分析** — 视觉 + 音频综合分析（基于 `prebuilt-video`）

### 核心概念

```
┌─────────────────────────────────────────────────────┐
│  Analyzer（分析器）                                   │
│                                                     │
│  ├── name: "rubricContent5c32107a"                  │
│  ├── baseAnalyzerId: "prebuilt-document"            │
│  ├── description: "Auto-generated content scorer"   │
│  └── fieldSchema:                                   │
│       ├── key_message_delivery: generate → string   │
│       ├── communication_skills: generate → string   │
│       └── feedback_summary: generate → string       │
│                                                     │
│  Analyzer 是一个可调用的 API 端点                      │
│  提交文件 → 处理 → 返回 fieldSchema 定义的输出         │
└─────────────────────────────────────────────────────┘
```

## 2. 与 AI Coach 的集成架构

在 AI Coach 平台中，CU 用于**替代 LLM 进行培训评分**（设计决策 D-07）：

```
┌─────────────────────────────────────────────────────────────────┐
│ AI Coach Backend                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Rubric 保存 ──► sync_rubric_analyzers()                        │
│                     │                                           │
│                     ├── PUT content analyzer (rubricContent{id}) │
│                     └── PUT voice analyzer   (rubricVoice{id})  │
│                                                                 │
│  Session 评分 ──► evaluate_session_with_cu()                    │
│                     │                                           │
│                     ├── POST :analyze (content) → poll → parse  │
│                     ├── POST :analyze (voice)   → poll → parse  │
│                     └── merge_scores() → 最终评估                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────────┐        ┌─────────────────────────┐
│ CU REST API         │        │ Azure AI Foundry Portal  │
│ {endpoint}/content  │        │ (仅经典版支持 CU 查看)     │
│ understanding/...   │        │                         │
│                     │        │ ai.azure.com            │
│ API Version:        │        │ └── Content             │
│ 2025-11-01 (GA)     │        │     Understanding      │
└─────────────────────┘        └─────────────────────────┘
```

## 3. 双 Analyzer 设计

每个 `ScoringRubric` 对应两个 CU Analyzer：

| Analyzer | Base | 用途 | 输入 |
|----------|------|------|------|
| Content Analyzer | `prebuilt-document` | 评估对话内容质量 | 转录 JSON（base64） |
| Voice Analyzer | `prebuilt-audio` | 评估语音质量 | 音频文件 |

### 命名规范

```
rubricContent{rubric_id前8位字符（无连字符）}
rubricVoice{rubric_id前8位字符（无连字符）}
```

示例：Rubric `5c32107a-xxxx` → `rubricContent5c32107a` + `rubricVoice5c32107a`

## 4. 评分流程总览

```
                 ┌──────────────────┐
                 │ Training Session │
                 │ (completed)      │
                 └────────┬─────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
     ┌────────▼────────┐    ┌────────▼────────┐
     │ Content Scoring  │    │ Voice Scoring   │
     │ (transcript→CU) │    │ (audio→CU)      │
     └────────┬────────┘    └────────┬────────┘
              │                       │
              └───────────┬───────────┘
                          │
                 ┌────────▼────────┐
                 │ Score Merge     │
                 │ content×W1 +    │
                 │ voice×W2        │
                 └────────┬────────┘
                          │
                 ┌────────▼────────┐
                 │ Final Score +   │
                 │ Feedback        │
                 └─────────────────┘
```

## 5. 设计决策索引

| ID | 决策 | 原因 |
|----|------|------|
| D-07 | 用 CU 替代 LLM 评分 | 结构化输出、可复现、低成本 |
| D-09 | Rubric 保存触发 Analyzer 同步 | 保持 Analyzer 与 Rubric 一致 |
| D-10 | 双维度评分（Content + Voice） | 分离内容质量和语音质量 |
| D-11 | 可配置权重合并 | 每个 Rubric 可自定义 content/voice 权重 |
| D-13 | 纯文本 session 只做 Content 评分 | 无音频 = 不需要 Voice 评分 |
| D-14 | 语音 session 做两项评分 | 完整评估 |
| D-15 | Content 评分通过 transcript JSON | Base64 编码提交给 CU |
| D-16 | Voice 使用 CU 内置转录 | CU 自身处理 audio → text |

## 6. 关键代码文件

| 文件 | 职责 |
|------|------|
| `backend/app/services/cu_evaluation_service.py` | CU 核心服务：Analyzer CRUD、评分、轮询、合并 |
| `backend/app/services/rubric_service.py` | Rubric 保存时调用 `sync_rubric_analyzers` |
| `backend/app/api/rubrics.py` | CU portal URL 端点 |
| `backend/app/schemas/scoring_rubric.py` | `CuPortalUrlResponse` schema |
| `frontend/src/components/admin/cu-status-section.tsx` | 前端 CU 状态卡片 |
