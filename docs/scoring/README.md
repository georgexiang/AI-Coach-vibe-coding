# 评分系统（Scoring）— 端到端流程文档

> 本目录包含 AI Coach 平台评分系统的完整技术文档：从场景启动、对话存储、音频存储到最终评分的端到端流程。
>
> **阅读顺序**：按编号从 01 到 06 依次阅读，每层知识建立在前一层之上。

## 文档索引

| 编号 | 文档 | 内容 | 适用人群 |
|------|------|------|---------|
| 01 | [场景启动与 Agent 指令](./01-scenario-and-agent-instructions.md) | Scenario/HCP/Skill 数据模型、System Prompt 构建、Agent 初始化流程 | 全体开发 |
| 02 | [对话存储机制](./02-conversation-storage.md) | 消息模型、持久化时机、Session 状态机、Key Message 检测 | 后端开发 |
| 03 | [音频存储机制](./03-audio-storage.md) | 前端录音、上传 API、后端存储后端、语音评分触发 | 后端开发 |
| 04 | [评分流程与评分引擎](./04-scoring-pipeline.md) | 三级降级策略、CU 评分、LLM 评分、Mock 回退、分数存储模型 | 后端开发 |
| 05 | [CU 评分上下文问题分析](./05-cu-scoring-context-gap.md) | CU analyzer 缺乏 scenario 上下文的根因分析、各维度问题复盘 | 全体开发 |
| 06 | [修复方向与待办](./06-issues-and-fixes.md) | 已确认 Bug 列表、修复优先级、架构改进方案 | 项目开发 |

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `backend/app/services/scoring_service.py` | 评分主流程编排 |
| `backend/app/services/scoring_engine.py` | LLM 评分引擎（第2级降级） |
| `backend/app/services/cu_evaluation_service.py` | CU 评分服务（第1级） |
| `backend/app/services/voice_scoring_service.py` | 语音评分服务 |
| `backend/app/services/prompt_builder.py` | HCP 系统提示词构建 |
| `backend/app/services/session_service.py` | Session 生命周期 + 消息存储 + Key Message 检测 |
| `backend/app/services/skill_focus_service.py` | SOP 进度跟踪 |
| `backend/app/models/score.py` | 评分数据模型 |
| `backend/app/models/session.py` | Session 数据模型 |
| `backend/app/models/scoring_rubric.py` | 评分标准模型 |
| `backend/app/api/scoring.py` | 评分 API 路由 |

## 核心结论速查（2026-05-18 分析）

1. **评分走 CU 路径时严重失准** — CU analyzer 只收到 transcript 文本，不知道 scenario product、key messages、HCP profile
2. **CU 无法区分评估对象** — 把 HCP (assistant) 的专业引导回复算作"对话质量好"的证据
3. **CU analyzer fieldSchema description 有 512 字符限制** — 无法嵌入完整 scenario 上下文
4. **当前降级链 CU → LLM → Mock 导致虚假合格** — Mock 基线分 65，容易超过 70 合格线
5. **Key Message 全部 NOT DELIVERED 但 key_message 维度给了 85 分** — 硬性指标完全失效
6. **CU 中间结果无存储/无 debug 界面** — 原始 CU 返回结果未记录
7. **Rubric 维度名称和 criteria 确实同步到了 CU** — 但缺少 scenario-specific 动态上下文

## 数据流概览

```
Admin 配置 Scenario ──► 关联 HcpProfile + ScoringRubric + Skill
                              │
                              ▼
User 开始 Session ──────► POST /sessions (status=created)
                              │
                              ▼
对话进行中 ─────────────► MR消息 → save_message() → detect_key_messages()
                         HCP回复 → adapter.execute() → save_message()
                              │
                              ▼
Session 结束 ───────────► POST /sessions/{id}/end (status=completed)
                         (可选) POST /sessions/{id}/audio → 触发语音评分
                              │
                              ▼
评分触发 ───────────────► POST /scoring/sessions/{id}/score
                              │
                         ┌────┴─────────────────────────────┐
                         │  CU → LLM → Mock (当前降级链)     │
                         │  ⚠️ 应改为 CU-only + 报错         │
                         └────┬─────────────────────────────┘
                              │
                              ▼
分数存储 ───────────────► SessionScore + ScoreDetail[]
                         session.status = "scored"
```
