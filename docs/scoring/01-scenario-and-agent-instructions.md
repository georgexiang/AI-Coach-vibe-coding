# 01 — 场景启动与 Agent 指令

> 描述从管理员配置 Scenario 到 Agent 接收指令开始对话的完整流程。

---

## 1. 数据模型关系

```
Scenario (训练场景)
├── hcp_profile_id → HcpProfile (模拟的医生画像)
├── skill_id → Skill (SOP 技能内容)
├── skill_version_id → SkillVersion (技能版本快照)
├── rubric_id → ScoringRubric (评分标准, NOT NULL)
├── key_messages: JSON[]  (MR 需要传递的关键信息)
├── pass_threshold: int   (合格分数线, 默认 70)
├── product: str          (产品名称)
├── therapeutic_area: str (治疗领域)
├── difficulty: str       (easy/medium/hard)
└── mode: str             (f2f / conference)
```

### HcpProfile 关键字段

| 字段 | 说明 | 评分相关性 |
|------|------|-----------|
| `personality_type` | friendly/skeptical/busy/analytical/cautious | 影响对话难度评估 |
| `emotional_state` | 0-100 情绪值 | 影响沟通难度 |
| `communication_style` | 0-100 直接↔间接 | 评估 MR 沟通适应力 |
| `expertise_areas` | JSON 专业领域列表 | 评估 MR 专业匹配度 |
| `objections` | JSON 异议列表 | 评分中"异议处理"维度的基础 |
| `agent_instructions_override` | 管理员覆盖指令 | 优先于自动生成 |
| `agent_id` / `agent_sync_status` | Azure AI Foundry Agent | 语音模式 Agent 模式使用 |

### ScoringRubric 关键字段

| 字段 | 说明 |
|------|------|
| `dimensions` | JSON: `[{name, weight, criteria[], max_score}]` |
| `content_weight` | 内容评分权重 (默认 60) |
| `voice_weight` | 语音评分权重 (默认 40) |
| `cu_content_analyzer_id` | CU 内容分析器 ID |
| `cu_voice_analyzer_id` | CU 语音分析器 ID |

---

## 2. System Prompt 构建

**文件:** `backend/app/services/prompt_builder.py`
**函数:** `build_hcp_system_prompt(hcp_profile, scenario, key_messages)`

### 提示词结构 (7 段)

```
1. HCP Identity
   "You are Dr. {name}, a {specialty} specialist"

2. Personality & Communication
   - 人格类型 + 情绪状态 + 沟通风格值
   - 根据 personality_type 注入行为规则:
     - skeptical: demands evidence, questions claims
     - busy: keeps responses short, redirects
     - analytical: asks for data, studies, numbers
     - cautious: needs safety data, long-term outcomes

3. Knowledge & Expertise
   - expertise_areas 列表
   - prescribing_habits 文本
   - concerns 文本

4. Objections
   - 编号列出 objections (自然融入对话)

5. Scenario Context
   - product 名称
   - therapeutic_area

6. Key Messages (for HCP awareness)
   - 列出 MR 应该传递的信息
   - "You are aware these are the messages the MR should deliver"

7. Rules (固定7条)
   - Stay in character at all times
   - Never break character
   - Never provide coaching feedback
   - Respond as the HCP would
   - Do not summarize what the MR said
   - Keep responses natural length
   - Use the HCP's communication style
```

---

## 3. Session 创建

**文件:** `backend/app/services/session_service.py`
**函数:** `create_session(db, user_id, scenario_id, mode)`

### 流程

1. 加载 Scenario (含 HcpProfile, Skill)
2. 初始化 `key_messages_status`:
   ```json
   [
     {"message": "...", "delivered": false, "detected_at": null},
     {"message": "...", "delivered": false, "detected_at": null}
   ]
   ```
3. 快照 `skill_id` / `skill_version_id` (审计追溯)
4. 生成 `focus_instruction` (从 Skill SOP 提取当前步骤)
5. 返回 `CoachingSession(status="created")`

---

## 4. Agent 初始化 — 文本模式 (SSE)

**触发:** `POST /api/v1/sessions/{id}/message`

```python
# 1. 保存 MR 消息 → 状态转 in_progress
await save_message(db, session_id, "user", content)

# 2. 构建 system prompt
system_prompt = build_hcp_system_prompt(hcp_profile, scenario, key_messages)

# 3. 前置 SOP focus instruction
if session.focus_instruction:
    system_prompt = f"{session.focus_instruction}\n\n{system_prompt}"

# 4. 构建 CoachRequest
request = CoachRequest(
    scenario_context=scenario_data,
    hcp_profile=hcp_profile_dict,
    scoring_criteria=rubric_dimensions,
    conversation_history=messages,
    system_prompt=system_prompt,
)

# 5. 通过 adapter 流式生成
async for event in adapter.execute(request):
    yield event  # SSE → 前端
```

**Adapter 选择:** `ServiceRegistry` 根据配置返回 `AzureOpenAIAdapter`

---

## 5. Agent 初始化 — 语音模式 (WebSocket)

**触发:** `WS /api/v1/voice-live/ws`

```
Client → session.update {hcp_profile_id, system_prompt}
                │
                ▼
Backend: _load_connection_config()
  ├── 加载 Voice Live 配置 (endpoint, API key, model)
  ├── 加载 HCP Profile 设置 (voice, avatar, recognition)
  └── 解析 instructions:
      优先级: agent_instructions_override > client system_prompt > build_agent_instructions()
                │
                ▼
连接 Azure Voice Live:
  ├── Agent 模式: HCP 有 synced agent_id → AgentSessionConfig
  └── Model 模式: 直接传 model + instructions → ModelSessionConfig
                │
                ▼
双向代理: Client ↔ Backend ↔ Azure Voice Live
```

### build_agent_instructions() 模板

```python
DEFAULT_AGENT_TEMPLATE = """You are {name}, a {specialty} doctor.
Personality: {personality_type}
Communication style: {communication_style}/100 (0=very indirect, 100=very direct)

Expertise: {expertise_areas}
Concerns: {concerns}

You are in a {mode} conversation with a Medical Representative...
Stay in character. Never break character. Respond naturally."""
```

---

## 6. Skill 增强 (SOP 进度跟踪)

**文件:** `backend/app/services/skill_focus_service.py`

Session 进行中，每轮对话会：
1. `extract_sop_steps()` — 从 Skill content 提取 SOP 步骤
2. `detect_sop_step()` — 判断当前对话处于哪个步骤
3. `compose_focus_instruction()` — 生成引导性指令前置到 system prompt

这使得 HCP 的回复能配合 MR 的 SOP 进度适当引导。
