# AI Coach Solution — Requirements Specification

> Extracted from Capgemini AI Coach for AWS solution document

---

## FR: Functional Requirements

### FR-1: Training Material Management

| ID | Requirement | Priority |
|----|------------|----------|
| FR-1.1 | Centralized document management supporting Word/Excel/PDF/content uploads | High |
| FR-1.2 | Version control and archiving of training materials | High |
| FR-1.3 | Automatic deletion of voice records per configurable retention policies | Medium |
| FR-1.4 | Historical data archiving for departed employees | Medium |

### FR-2: F2F HCP Engagement (One-on-One)

| ID | Requirement | Priority |
|----|------------|----------|
| FR-2.1 | Handle F2F calls with objection handling simulation | High |
| FR-2.2 | Provide scenario and digital HCP background visibility for MR before interaction | High |
| FR-2.3 | Accept audio input from MR (voice-based interaction via ASR) | High |
| FR-2.4 | Accept text input from MR (text-based interaction) | High |
| FR-2.5 | Generate corresponding audio/text outputs from Digital HCP | High |
| FR-2.6 | Allow history conversation review (past session playback) | Medium |
| FR-2.7 | Provide scores and feedback based on configurable score criteria | High |
| FR-2.8 | Offer a customizable rating criteria and feedback system | High |

### FR-3: Virtual Department Conference Presentation (One-to-Many)

| ID | Requirement | Priority |
|----|------------|----------|
| FR-3.1 | Support content presentations with product/disease knowledge | High |
| FR-3.2 | Support audience question answering from virtual HCPs | High |
| FR-3.3 | Provide presentation multi-scenario visibility for MR | Medium |
| FR-3.4 | Accept audio input with live translated text on screen (real-time transcription) | High |
| FR-3.5 | Generate typical objections based on historical data | Medium |
| FR-3.6 | Provide verbal suggestions for handling objections | Medium |
| FR-3.7 | Offer customizable rating criteria and feedback | High |

### FR-4: Multi-dimensional Scoring System

| ID | Requirement | Priority |
|----|------------|----------|
| FR-4.1 | Multidimensional scoring evaluating key competencies | High |
| FR-4.2 | Real-time suggestions during training sessions | High |
| FR-4.3 | Post-session reports highlighting strengths | High |
| FR-4.4 | Post-session reports highlighting weaknesses | High |
| FR-4.5 | Post-session reports with targeted improvement areas | High |
| FR-4.6 | Scoring across: key message delivery, objection handling, communication, product knowledge, scientific information | High |

### FR-5: Report and Dashboard

| ID | Requirement | Priority |
|----|------------|----------|
| FR-5.1 | Generate standard reports with sorting/filtering by BU, role, and time period | High |
| FR-5.2 | Provide personal-level analysis of training results | High |
| FR-5.3 | Provide group-level analysis of training results | High |
| FR-5.4 | Enable export of results in PDF format | Medium |
| FR-5.5 | Enable export of results in Excel format | Medium |
| FR-5.6 | Track training progress/completion status across organization | High |

### FR-6: Digital HCP Configuration

| ID | Requirement | Priority |
|----|------------|----------|
| FR-6.1 | Set the virtual HCP's portrait/visual appearance | Medium |
| FR-6.2 | Set the HCP's knowledge background and medical perspective | High |
| FR-6.3 | Set scoring criteria per scenario | High |
| FR-6.4 | Configure diverse personality settings for virtual HCPs | Medium |
| FR-6.5 | Configure HCP profiles with different emotional states, contexts, and intentions | Medium |
| FR-6.6 | Support multi-product training scenarios | High |

### FR-7: AI & NLP Capabilities

| ID | Requirement | Priority |
|----|------------|----------|
| FR-7.1 | Human-like emotional depth for conversations (text analytics powered) | High |
| FR-7.2 | Voice Processing / ASR (Automatic Speech Recognition) | High |
| FR-7.3 | NLP for analyzing complex expressions: Emotion, Context, Intention | High |
| FR-7.4 | Dynamic course optimization leveraging AI capability | Medium |
| FR-7.5 | Personalized training paths based on MR's role/BU | High |

---

## NFR: Non-Functional Requirements

| ID | Requirement | Category | Priority |
|----|------------|----------|----------|
| NFR-1 | Audit-ready competency tracking (fully traceable training paths) | Compliance | High |
| NFR-2 | Scalable to support organization-wide deployment | Scalability | High |
| NFR-3 | Configurable scenarios for specific therapeutic areas, product launches, or regional norms | Extensibility | Medium |
| NFR-4 | Adaptable to emerging market trends or regulatory changes | Maintainability | Medium |
| NFR-5 | Data retention policy compliance (automatic deletion of voice records) | Data Privacy | High |
| NFR-6 | Historical data archiving for departed employees | Data Management | Medium |
| NFR-7 | AWS cloud deployment | Infrastructure | High |

---

## BV: Business Value Requirements

| ID | Business Value | Metric |
|----|---------------|--------|
| BV-1 | Accelerate Training Efficiency | Cut time-to-competency |
| BV-2 | Significant Cost Optimization | Reduce L&D OPEX |
| BV-3 | Enhanced Sales Effectiveness | Boost call success rates and product uptake |
| BV-4 | Data-Driven Performance Optimization | Identify skill gaps via aggregated analytics |
| BV-5 | Competitive Differentiation | Adaptable to market trends/regulatory changes |
| BV-6 | Enhance Professional Capability | Better objection handling and communication skills |

---

## DR: Skill Dry Run Simulation Requirements

> Dry Run 是 Skill 质量评估的第三层（Layer 3），通过 AI Agent 模拟完整 MR-HCP 对话来验证 Skill SOP 的可执行性。

### DR-01: Dry Run MR Agent

| ID | Requirement | Priority |
|----|------------|----------|
| DR-01.1 | 系统维护一个 `dry-run-mr` MetaSkill Agent（简单 agent，无语音/知识库/工具） | High |
| DR-01.2 | Agent 有基础 SKILL.md 模板定义 MR 角色行为（按 SOP 推进对话、自然应对异议） | High |
| DR-01.3 | 每次 Dry Run 时，Skill 的完整内容（SOP + script + reference 文本）作为第一轮消息传入 agent | High |
| DR-01.4 | 对话结束后 Skill 内容自然释放（session 级绑定，不修改 agent 定义） | High |

### DR-02: Dry Run HCP Agent

| ID | Requirement | Priority |
|----|------------|----------|
| DR-02.1 | 系统维护一个 `dry-run-hcp` MetaSkill Agent（简单 agent，无语音/知识库/工具） | High |
| DR-02.2 | Agent 有基础 SKILL.md 模板定义 HCP 角色行为（时间有限、提出临床问题、常见异议） | High |
| DR-02.3 | HCP agent 通过 `chat_with_agent()` + `previous_response_id` 进行多轮对话 | High |

### DR-03: Agent-based Simulation Engine

| ID | Requirement | Priority |
|----|------------|----------|
| DR-03.1 | Dry Run 引擎使用 `chat_with_agent()` 替代 raw API 调用，复用平台 agent 基础设施 | High |
| DR-03.2 | MR 和 HCP 各自维护独立的 `previous_response_id` 实现多轮上下文连贯 | High |
| DR-03.3 | 最多 20 轮对话，包含自然结束检测（结束语、轮次上限） | High |
| DR-03.4 | 首轮 AI 调用失败时立即中止并标记 dry run 为 failed | High |

### DR-04: SOP Coverage Evaluation

| ID | Requirement | Priority |
|----|------------|----------|
| DR-04.1 | 使用现有 `skill-evaluator` MetaSkill Agent 做语义级 SOP 覆盖评估（替代关键词匹配） | High |
| DR-04.2 | 评估输出结构化的 per-step 覆盖结果（covered/partial/not_covered） | High |
| DR-04.3 | 生成可执行性评分（0-100）和问题列表 | High |

### DR-05: Dry Run Data Persistence

| ID | Requirement | Priority |
|----|------------|----------|
| DR-05.1 | Dry Run 结果持久化到 DryRun + DryRunMessage 表 | High |
| DR-05.2 | 记录使用的 agent_id/version 用于审计追溯 | Medium |
| DR-05.3 | 支持多轮 Dry Run 历史查询和对比 | Medium |

### DR-06: Dry Run Report & UI

| ID | Requirement | Priority |
|----|------------|----------|
| DR-06.1 | Report 页面含 3 个 sub-tab：对话记录、SOP 覆盖图、问题列表 | High |
| DR-06.2 | Skill 编辑器 Quality tab 显示 Dry Run 历史列表 | High |
| DR-06.3 | Admin 可从 Skill 编辑器 header 触发 Dry Run | High |
| DR-06.4 | i18n 支持 en-US + zh-CN | High |

### DR-07: MetaSkill Integration

| ID | Requirement | Priority |
|----|------------|----------|
| DR-07.1 | `dry-run-mr` 和 `dry-run-hcp` 作为 MetaSkill 类型注册，和 creator/evaluator 同级 | High |
| DR-07.2 | Admin 可在 Meta Skills 页面查看/编辑 dry run agent 的 instructions 模板 | Medium |
| DR-07.3 | 支持通过 Admin UI 同步 dry run agents 到 Azure AI Foundry | High |

### DR-08: Dry Run Lifecycle

| ID | Requirement | Priority |
|----|------------|----------|
| DR-08.1 | Dry Run 支持 pending → running → completed/failed/cancelled 状态机 | High |
| DR-08.2 | Admin 可取消进行中的 Dry Run | Medium |
| DR-08.3 | 3 秒轮询获取 Dry Run 状态（覆盖进度、当前步骤） | Medium |

---

## UI/UX Requirements Summary

> UI prototype screenshots are preserved in `pdf/images/ui-*` for design reference.

| Screen | File | Key Features |
|--------|------|-------------|
| HCP Coach Demo | `ui-hcp-coach-demo.png` | Scenario selection, chat interface, audio/text toggle, conversation history |
| Scoring System | `ui-scoring-system.png` | Score dashboard, dimension breakdown, detailed feedback panels |
| Virtual Doctor Config | `ui-reference-virtual-doctor.png` | Portrait setup, knowledge config, scoring criteria setup |
| Virtual HCP Reference | `ui-reference-virtual-hcp.png` | Full interaction flow, scenario selection, scoring, chat |

### UI Design Patterns Observed

1. **Mobile-first design** — UI mockups are primarily mobile/tablet oriented (WeChat Mini Program style)
2. **Chat-based interaction** — Primary interaction via chat bubbles with avatar
3. **Audio/Text dual mode** — Toggle between voice and text input
4. **Card-based scenario selection** — Scenarios presented as cards with HCP profile info
5. **Dashboard scoring view** — Radar/dimension charts for multi-dimensional scoring
6. **Detailed feedback panels** — Expandable sections for per-dimension feedback with specific suggestions
7. **Blue/white color scheme** — Professional medical training aesthetic

---

## Glossary

| Term | Definition |
|------|-----------|
| **MR** | Medical Representative |
| **HCP** | Healthcare Professional |
| **F2F** | Face-to-Face |
| **BU** | Business Unit |
| **ASR** | Automatic Speech Recognition |
| **NLP** | Natural Language Processing |
| **DM** | District Manager |
| **L&D** | Learning & Development |
| **OPEX** | Operational Expenditure |
| **MSL** | Medical Science Liaison |
