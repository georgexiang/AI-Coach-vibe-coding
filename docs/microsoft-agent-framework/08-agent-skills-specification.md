# 08 — Microsoft Agent Framework Skills 规范与平台实现

> **目标读者**：后端开发、前端开发、Vibe Coding Agent
>
> **前置知识**：已阅读 07-agent-skill-creation-guide.md
>
> **参考规范**：https://learn.microsoft.com/en-us/agent-framework/agents/skills

---

## 1. Agent Skills 概述

[Agent Skills](https://agentskills.io/) 是**可移植的指令、脚本和资源包**，赋予 Agent 特定领域的能力和专业知识。Skills 遵循开放规范，使用**渐进式加载模式（Progressive Disclosure）**，让 Agent 按需加载所需上下文。

### 1.1 适用场景

| 场景 | 说明 |
|------|------|
| **打包领域知识** | 将专业知识（报销政策、法律流程、数据分析流程）封装为可复用的便携包 |
| **扩展 Agent 能力** | 无需修改 Agent 核心指令即可增加新能力 |
| **确保一致性** | 将多步骤任务变为可重复、可审计的工作流 |
| **实现互操作性** | 同一 Skill 可跨不同 Agent Skills 兼容产品复用 |

---

## 2. Skill 目录结构

```
expense-report/
├── SKILL.md                          # 必须 — YAML frontmatter + Markdown 指令
├── scripts/
│   └── validate.py                   # 可执行脚本（Agent 按需运行）
├── references/
│   └── POLICY_FAQ.md                 # 参考文档（Agent 按需读取）
└── assets/
    └── expense-report-template.md    # 模板和静态资源
```

### 2.1 目录约定

| 目录 | 内容 | 发现规则 |
|------|------|---------|
| `references/` | 参考文档（.md, .json, .yaml, .csv, .xml, .txt） | 自动发现，默认扩展名列表 |
| `scripts/` | 可执行脚本（.py, .js, .sh, .ps1, .cs, .csx） | 需配置 script_runner |
| `assets/` | 模板、静态资源 | 同 references 扩展名规则 |

### 2.2 可自定义发现

```python
# 自定义资源扩展名
skills_provider = SkillsProvider(
    skill_paths=Path(__file__).parent / "skills",
    resource_extensions=(".md", ".txt"),
)
```

---

## 3. SKILL.md 格式规范

### 3.1 完整格式

SKILL.md 必须包含 **YAML frontmatter**（`---` 分隔）+ **Markdown 正文**：

```yaml
---
name: expense-report
description: >-
  File and validate employee expense reports according to company policy.
  Use when asked about expense submissions, reimbursement rules, or
  spending limits.
license: Apache-2.0
compatibility: Requires python3
metadata:
  author: contoso-finance
  version: "2.1"
---

# Skill Instructions

Step-by-step guidance, examples, edge cases...
```

### 3.2 Frontmatter 字段约束

| 字段 | 必填 | 约束 | 说明 |
|------|------|------|------|
| `name` | **是** | 最大 64 字符，仅小写字母+数字+连字符，不能以连字符开头/结尾，不允许连续连字符，**必须与父目录同名** | Skill 唯一标识 |
| `description` | **是** | 最大 1024 字符 | 描述功能和使用时机，包含关键词帮助 Agent 识别 |
| `license` | 否 | - | 许可证名称或引用 |
| `compatibility` | 否 | 最大 500 字符 | 环境要求（目标产品、系统包、网络访问等） |
| `metadata` | 否 | 任意 key-value | 自定义元数据（author, version, domain 等） |
| `allowed-tools` | 否 | 空格分隔的工具列表 | 预批准工具（实验性，支持因实现而异） |

### 3.3 name 字段命名正则

```python
import re

SKILL_NAME_PATTERN = re.compile(r'^[a-z0-9]([a-z0-9-]*[a-z0-9])?$')
MAX_SKILL_NAME_LENGTH = 64

def is_valid_skill_name(name: str) -> bool:
    if not name or len(name) > MAX_SKILL_NAME_LENGTH:
        return False
    if "--" in name:
        return False
    return bool(SKILL_NAME_PATTERN.match(name))
```

**注意**：Skill `name` 规则（64 字符、仅小写）与 Azure AI Foundry `agent_name` 规则（63 字符、允许大写）不完全相同。

### 3.4 Markdown 正文建议

- 保持 SKILL.md **500 行以内**
- 详细参考材料移到 `references/` 目录下的独立文件
- 正文内容应包含：分步指导、输入/输出示例、常见边界情况

---

## 4. 渐进式加载（Progressive Disclosure）

Skills 使用四阶段渐进式加载模式，最小化上下文使用：

```
Stage 1: Advertise ──→ Stage 2: Load ──→ Stage 3: Read Resources ──→ Stage 4: Run Scripts
  (~100 tokens/skill)    (<5000 tokens)      (按需)                      (按需)
```

| 阶段 | 触发 | Token 预算 | 说明 |
|------|------|-----------|------|
| **1. Advertise** | 每次运行自动 | ~100 tokens/skill | Skill 名称和描述注入 system prompt |
| **2. Load** | Agent 调用 `load_skill` | <5000 tokens 推荐 | 获取完整 SKILL.md 正文 |
| **3. Read Resources** | Agent 调用 `read_skill_resource` | 按需 | 获取 references/assets 中的文件 |
| **4. Run Scripts** | Agent 调用 `run_skill_script` | 按需 | 执行 scripts/ 中的脚本 |

### 4.1 工具自动广播规则

| 工具 | 广播条件 |
|------|---------|
| `load_skill` | 始终广播 |
| `read_skill_resource` | 至少一个 Skill 有 resources 时广播 |
| `run_skill_script` | 至少一个 Skill 有 scripts 时广播 |

---

## 5. Python SDK 使用方式

### 5.1 文件 Skill（从目录发现）

```python
import os
from pathlib import Path
from agent_framework import SkillsProvider
from agent_framework.openai import OpenAIChatCompletionClient
from azure.identity.aio import AzureCliCredential

# 从 skills/ 目录发现所有 Skill
skills_provider = SkillsProvider(
    skill_paths=Path(__file__).parent / "skills"
)

# 创建带 Skills 的 Agent
agent = OpenAIChatCompletionClient(
    model=os.environ["AZURE_OPENAI_CHAT_COMPLETION_MODEL"],
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    credential=AzureCliCredential(),
).as_agent(
    name="SkillsAgent",
    instructions="You are a helpful assistant.",
    context_providers=[skills_provider],
)
```

### 5.2 多目录发现

```python
# 单一父目录（每个含 SKILL.md 的子目录自动发现）
skills_provider = SkillsProvider(
    skill_paths=Path(__file__).parent / "all-skills"
)

# 多根目录
skills_provider = SkillsProvider(
    skill_paths=[
        Path(__file__).parent / "company-skills",
        Path(__file__).parent / "team-skills",
    ]
)
```

Provider 搜索**最深两层**目录。

### 5.3 代码定义 Skill（无需文件）

```python
from textwrap import dedent
from agent_framework import Skill, SkillResource, SkillsProvider

code_style_skill = Skill(
    name="code-style",
    description="Coding style guidelines for the team",
    content=dedent("""\
        Use this skill when answering questions about coding style.
    """),
    resources=[
        SkillResource(
            name="style-guide",
            content="# Style Guide\n- Use 4-space indentation...",
        ),
    ],
)

skills_provider = SkillsProvider(skills=[code_style_skill])
```

### 5.4 动态资源（装饰器模式）

```python
from agent_framework import Skill

project_info_skill = Skill(
    name="project-info",
    description="Project status and configuration",
    content="Use this skill for project questions.",
)

@project_info_skill.resource
def environment() -> Any:
    """Get current environment configuration."""
    env = os.environ.get("APP_ENV", "development")
    return f"Environment: {env}"

@project_info_skill.resource(name="team-roster", description="Current team members")
def get_team_roster() -> Any:
    return "Alice Chen (Tech Lead), Bob Smith (Backend Engineer)"
```

### 5.5 代码定义脚本

```python
@converter_skill.script(name="convert", description="Convert value: result = value × factor")
def convert_units(value: float, factor: float) -> str:
    import json
    result = round(value * factor, 4)
    return json.dumps({"value": value, "factor": factor, "result": result})
```

### 5.6 脚本执行器（文件脚本）

```python
from agent_framework import Skill, SkillScript, SkillsProvider

def my_runner(skill: Skill, script: SkillScript, args: dict | None = None) -> str:
    import subprocess, sys
    cmd = [sys.executable, str(Path(skill.path) / script.path)]
    if args:
        for key, value in args.items():
            if value is not None:
                cmd.extend([f"--{key}", str(value)])
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return result.stdout.strip()

skills_provider = SkillsProvider(
    skill_paths=Path(__file__).parent / "skills",
    script_runner=my_runner,
)
```

> **警告**：上述 runner 仅用于演示。生产环境应添加沙箱、资源限制、输入验证和审计日志。

### 5.7 脚本批准（Human-in-the-Loop）

```python
skills_provider = SkillsProvider(
    skills=[my_skill],
    require_script_approval=True,
)

result = await agent.run("Deploy v2.5.0", session=session)

while result.user_input_requests:
    for request in result.user_input_requests:
        print(f"Script: {request.function_call.name}")
        approval = request.to_function_approval_response(approved=True)
        result = await agent.run(approval, session=session)
```

### 5.8 混合 Skill 来源

```python
skills_provider = SkillsProvider(
    skill_paths=Path(__file__).parent / "skills",  # 文件 Skill
    skills=[my_code_skill],                         # 代码 Skill
)
```

同名时文件 Skill 优先，代码 Skill 被跳过。

---

## 6. AI Coach 平台实现

### 6.1 平台 Skill 架构

AI Coach 平台有两个 Meta Skill（平台级 Agent）：

```
backend/app/services/meta_skill_templates/
├── skill-creator/                    # Skill Creator Agent
│   ├── SKILL.md                      # 英文指令（含 YAML frontmatter）
│   ├── SKILL_zh.md                   # 中文指令
│   ├── references/
│   │   ├── output-schema.json        # 输出 JSON Schema
│   │   ├── scoring-rubric.md         # 评分维度标准
│   │   └── sop-structure-guide.md    # SOP 结构指南
│   └── scripts/
│       └── validate_creator_output.py  # 输出验证脚本
│
└── skill-evaluator/                  # Skill Evaluator Agent
    ├── SKILL.md
    ├── SKILL_zh.md
    ├── references/
    │   ├── evaluation-dimensions.md  # 6 维评估标准
    │   ├── output-schema.json        # 评估输出 Schema
    │   └── quality-standards.md      # PASS/NEEDS_REVIEW/FAIL 阈值
    └── scripts/
        └── validate_evaluator_output.py
```

### 6.2 SKILL.md 实例（skill-creator）

```yaml
---
name: skill-creator
description: >-
  Transform MR training documents into structured coaching skills.
  Use when asked to convert product guides, clinical data, or training
  materials into complete skill JSON with SOP, modules, and assessments
  for pharmaceutical MR training sessions.
license: Apache-2.0
compatibility: Requires azure-ai-projects>=2.0.1, python>=3.11
metadata:
  author: ai-coach-platform
  version: "2.0"
  domain: pharma-mr-training
---

# Coaching Skill Creator

You are an expert instructional designer and skill architect for pharmaceutical
sales training...
```

### 6.3 SKILL.md 实例（skill-evaluator）

```yaml
---
name: skill-evaluator
description: >-
  Evaluate coaching skill quality across 6 dimensions for pharmaceutical
  MR training. Use when asked to assess, review, or score a coaching skill's
  content quality.
license: Apache-2.0
compatibility: Requires azure-ai-projects>=2.0.1, python>=3.11
metadata:
  author: ai-coach-platform
  version: "2.0"
  domain: pharma-mr-training
---

# Coaching Skill Quality Evaluator

You are an expert coaching skill content evaluator...
```

### 6.4 规范合规性检查

| 字段 | 规范要求 | skill-creator | skill-evaluator | 状态 |
|------|---------|---------------|-----------------|------|
| `name` | ≤64 chars, 小写+数字+连字符, 匹配目录名 | `skill-creator` ✓ | `skill-evaluator` ✓ | 合规 |
| `description` | ≤1024 chars, 含使用关键词 | 181 chars ✓ | 186 chars ✓ | 合规 |
| `license` | 可选 | `Apache-2.0` ✓ | `Apache-2.0` ✓ | 合规 |
| `compatibility` | ≤500 chars | 47 chars ✓ | 47 chars ✓ | 合规 |
| `metadata` | 任意 key-value | author/version/domain ✓ | author/version/domain ✓ | 合规 |
| 目录名 = name | 强制 | `skill-creator/` ✓ | `skill-evaluator/` ✓ | 合规 |

### 6.5 与 MS Agent Framework 的差异

| 维度 | MS Agent Framework Skills | AI Coach 平台实现 |
|------|--------------------------|-------------------|
| **加载方式** | `SkillsProvider` + `agent_framework` 库，渐进式加载 | 直接将 SKILL.md + references 组合为 `instructions` 传入 Azure Agent API |
| **脚本执行** | `run_skill_script` 工具，Agent 按需调用 | 不通过 Agent 执行，由后端直接调用验证脚本 |
| **资源访问** | `read_skill_resource` 工具，Agent 按需读取 | references 内容在组合时一次性拼入 instructions |
| **版本管理** | 文件系统，Git 版本控制 | DB 存储 `template_content`，支持 UI 编辑 |
| **i18n** | 不内置 | 支持 `SKILL_zh.md` 中文版本 |
| **Agent 同步** | 不涉及 | 同步到 Azure AI Foundry Agent Registry |

### 6.6 组合加载流程

```
1. 读取 SKILL.md（保留 YAML frontmatter）
2. 读取 references/ 下所有文件内容
3. 拼接为完整 instructions:
   ┌─────────────────────────────────┐
   │ ---                             │  ← YAML frontmatter 保留
   │ name: skill-creator             │
   │ description: ...                │
   │ ---                             │
   │                                 │
   │ # Coaching Skill Creator        │  ← SKILL.md 正文
   │ ...                             │
   │                                 │
   │ ---                             │
   │ ## Reference Materials          │  ← 自动拼接
   │ ### output-schema.json          │
   │ {json content}                  │
   │ ### scoring-rubric.md           │
   │ {markdown content}              │
   │ ...                             │
   └─────────────────────────────────┘
4. 存入 DB (meta_skill.template_content)
5. 同步到 Azure Agent → instructions 字段
```

### 6.7 关键代码文件

| 文件 | 作用 |
|------|------|
| `backend/app/services/meta_skill_service.py` | `_load_skill_directory()` — 组合 SKILL.md + references |
| `backend/app/services/meta_skill_service.py` | `list_meta_skill_resources()` — 枚举资源文件 |
| `backend/app/services/meta_skill_service.py` | `get_meta_skill_resource_content()` — 读取资源内容 |
| `backend/app/api/meta_skills.py` | REST 端点：resources 列表、下载、CRUD、同步 |
| `frontend/src/pages/admin/meta-skills.tsx` | Admin UI：Instructions tab + Resources tab |
| `frontend/src/components/shared/file-tree-view.tsx` | 资源文件树组件（复用） |

---

## 7. 安全最佳实践

> 来源：MS Agent Framework 官方文档

| 实践 | 说明 |
|------|------|
| **使用前审查** | 阅读所有 Skill 内容（SKILL.md、脚本、资源），验证脚本行为与声明一致 |
| **信任来源** | 仅安装受信作者或经审查的内部贡献者的 Skill |
| **沙箱执行** | 在隔离环境中运行含可执行脚本的 Skill，限制文件系统和网络访问 |
| **审计日志** | 记录加载了哪些 Skill、读取了哪些资源、执行了哪些脚本 |
| **路径遍历防护** | 验证文件名不含 `../`、`/`、`\`（AI Coach 已实现） |

---

## 8. Skills vs Workflows 选择指南

| 维度 | Skills | Workflows |
|------|--------|-----------|
| **控制** | AI 决定如何执行指令（创造性/适应性） | 开发者显式定义执行路径（确定性） |
| **容错** | 单次 Agent turn 内运行，失败需整体重试 | 支持 checkpoint，可从最后成功步骤恢复 |
| **副作用** | 适合幂等或低风险操作 | 适合有副作用的操作（发邮件、支付） |
| **复杂度** | 单域聚焦任务 | 多步骤业务流程、多 Agent 协调 |

> **经验法则**：如果希望 AI 自己决定*如何*完成任务，用 Skill。如果需要保证*执行什么步骤*和*按什么顺序*，用 Workflow。

---

## 附录 A：平台 Skill 资源详情

### skill-creator resources

| 文件 | 类型 | 说明 |
|------|------|------|
| `references/output-schema.json` | JSON Schema | Skill Creator 输出的 JSON 格式定义 |
| `references/scoring-rubric.md` | Markdown | 6 维评分标准（sop_completeness 等） |
| `references/sop-structure-guide.md` | Markdown | SOP 5 阶段结构指南（Opening→Closing） |
| `scripts/validate_creator_output.py` | Python | 验证 Creator 输出是否符合 Schema |

### skill-evaluator resources

| 文件 | 类型 | 说明 |
|------|------|------|
| `references/evaluation-dimensions.md` | Markdown | 6 维评估详细指南 |
| `references/output-schema.json` | JSON Schema | Evaluator 输出格式定义 |
| `references/quality-standards.md` | Markdown | PASS/NEEDS_REVIEW/FAIL 阈值定义 |
| `scripts/validate_evaluator_output.py` | Python | 验证 Evaluator 输出是否符合 Schema |

---

## 附录 B：命名规则对照

| 规则 | SKILL.md `name` | Azure Agent `agent_name` |
|------|-----------------|--------------------------|
| 最大长度 | **64** 字符 | **63** 字符 |
| 允许大写 | **否**（仅小写） | **是** |
| 允许字符 | 小写字母 + 数字 + 连字符 | 字母数字 + 连字符 |
| 连续连字符 | 不允许 | 不允许 |
| 首尾连字符 | 不允许 | 不允许 |
| 必须匹配目录名 | **是** | 不适用 |
| 验证正则 | `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$` | `^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$` |
